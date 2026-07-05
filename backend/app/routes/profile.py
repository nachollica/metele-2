"""
Profile + custom-preset endpoints.

Anything that mutates the caller's User row beyond what authentication needs
goes here. The router is mounted at ``/profile`` so the URL space mirrors the
separation: ``/auth`` is identity, ``/profile`` is user-owned state.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm.attributes import flag_modified

from app.db_models import User
from app.dependencies import CurrentUser, DbSession, SettingsDep
from app.email_validation import validate_email_address
from app.models import MAX_CUSTOM_PRESETS, AuthUser, CustomPreset, PresetSettings

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    """
    Partial update for the caller's profile.

    All three fields are optional; omitted fields are left untouched. ``email``
    accepts null so the user can clear it. ``picture`` is either a public URL
    or a ``data:`` URL produced from a client-side file upload.
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=320)
    picture: str | None = Field(default=None, max_length=1_000_000)

    model_config = {"extra": "forbid"}


# URL schemes we accept for the profile picture: an inline image upload
# (``data:image/…``) or a plain web URL. Anything else — ``javascript:``,
# bare base64, arbitrary text — is rejected before it reaches the DB.
_ALLOWED_PICTURE_PREFIXES = ("data:image/", "http://", "https://")


def _validate_picture(picture: str) -> str:
    if picture.startswith(_ALLOWED_PICTURE_PREFIXES):
        return picture
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="Picture must be an image data: URL or an http(s) URL.",
    )


class CustomPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    settings: PresetSettings

    model_config = {"extra": "forbid"}


class CustomPresetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    settings: PresetSettings | None = None

    model_config = {"extra": "forbid"}


@router.get(
    "/me",
    response_model=AuthUser,
    summary="Same shape as /auth/me; lives under /profile for symmetry with PATCH.",
)
def get_me(user: CurrentUser) -> AuthUser:
    return AuthUser.from_user(user)


@router.patch(
    "/me",
    response_model=AuthUser,
    summary="Update the caller's profile (name, email, picture).",
)
def update_me(
    payload: ProfileUpdate,
    db: DbSession,
    user: CurrentUser,
    settings: SettingsDep,
) -> AuthUser:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        user.name = data["name"]
    if "email" in data:
        # Run the disposable-blocklist + email-validator checks. ``None`` is
        # allowed as a way to clear the field — social-login users don't
        # have to keep an email on file.
        if data["email"] is None:
            user.email = None
        else:
            user.email = validate_email_address(
                data["email"],
                check_deliverability=settings.email_validation_check_deliverability,
            )
    if "picture" in data:
        user.picture = _validate_picture(data["picture"]) if data["picture"] is not None else None
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthUser.from_user(user)


# ---- Custom presets ------------------------------------------------------
#
# Stored as a JSON list on the user row. We expose CRUD endpoints that
# always return the freshly mutated user record so the client can replace
# its local copy in one shot (no separate refetch needed).


def _persist_custom_presets(db: DbSession, user: User, presets: list[CustomPreset]) -> AuthUser:
    user.custom_presets = presets
    # SQLAlchemy can't always detect mutations to JSON columns when we
    # reassign after popping/inserting in place — flag_modified makes the
    # write explicit so the UPDATE is emitted.
    flag_modified(user, "custom_presets")
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthUser.from_user(user)


@router.post(
    "/me/presets",
    response_model=AuthUser,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new custom session preset to the caller's profile.",
)
def create_custom_preset(
    payload: CustomPresetCreate,
    db: DbSession,
    user: CurrentUser,
) -> AuthUser:
    existing = list(user.custom_presets)
    if len(existing) >= MAX_CUSTOM_PRESETS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You can only have up to {MAX_CUSTOM_PRESETS} custom presets.",
        )
    existing.append(
        CustomPreset(
            id=str(uuid.uuid4()),
            name=payload.name.strip(),
            settings=payload.settings,
        )
    )
    return _persist_custom_presets(db, user, existing)


@router.patch(
    "/me/presets/{preset_id}",
    response_model=AuthUser,
    summary="Update an existing custom preset (rename and/or settings).",
)
def update_custom_preset(
    preset_id: str,
    payload: CustomPresetUpdate,
    db: DbSession,
    user: CurrentUser,
) -> AuthUser:
    existing = list(user.custom_presets)
    for preset in existing:
        if preset.id == preset_id:
            if payload.name is not None:
                preset.name = payload.name.strip()
            if payload.settings is not None:
                preset.settings = payload.settings
            return _persist_custom_presets(db, user, existing)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Custom preset {preset_id} not found.",
    )


@router.delete(
    "/me/presets/{preset_id}",
    response_model=AuthUser,
    summary="Delete one of the caller's custom presets.",
)
def delete_custom_preset(
    preset_id: str,
    db: DbSession,
    user: CurrentUser,
) -> AuthUser:
    existing = list(user.custom_presets)
    next_list = [preset for preset in existing if preset.id != preset_id]
    if len(next_list) == len(existing):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Custom preset {preset_id} not found.",
        )
    return _persist_custom_presets(db, user, next_list)

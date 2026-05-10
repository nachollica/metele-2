"""Auth + profile endpoints (Auth0-backed).

Token issuance and the OAuth dance live entirely in Auth0 — the frontend
talks to the tenant directly via the Auth0 SPA SDK and receives an access
token. The backend validates the token (`GET /auth/me`) and lets the user
edit their local profile fields (`PATCH /auth/me`). The local fields are
authoritative for our app — they're seeded from Auth0 `/userinfo` on first
sign-in and from there on can drift freely from what Auth0 holds.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session

from ..auth import get_current_user
from ..db import get_db
from ..db_models import User
from ..models import MAX_CUSTOM_PRESETS, AuthUser, CustomPreset, PresetSettings
from ..settings import Settings, get_settings


router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpdate(BaseModel):
    """Partial update for the caller's profile.

    All three fields are optional; omitted fields are left untouched. `email`
    accepts null so the user can clear it. `picture` is either a public URL
    or a `data:` URL produced from a client-side file upload (see the
    frontend profile screen).
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=320)
    picture: str | None = Field(default=None, max_length=1_000_000)

    model_config = {"extra": "forbid"}


class CustomPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    settings: PresetSettings

    model_config = {"extra": "forbid"}


class CustomPresetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    settings: PresetSettings | None = None

    model_config = {"extra": "forbid"}


class DevLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)

    model_config = {"extra": "forbid"}


class DevLoginResponse(BaseModel):
    """Token issued by the dev-user backdoor. Frontend treats it like an
    Auth0 access token (carries it as a Bearer header for every API call)
    even though server-side it's a shared-secret prefix plus username, not
    a JWT."""

    token: str
    user: AuthUser


@router.post(
    "/dev-login",
    response_model=DevLoginResponse,
    response_model_by_alias=True,
    summary="Issue a dev-user token for the requested username. Disabled in production.",
)
def dev_login(
    payload: DevLoginRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> DevLoginResponse:
    if not settings.dev_user_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev login is disabled.",
        )
    user = db.get(User, payload.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Dev user '{payload.username}' does not exist.",
        )
    return DevLoginResponse(
        token=f"{settings.dev_user_token}:{user.id}",
        user=AuthUser.model_validate(user),
    )


@router.get("/me", response_model=AuthUser, response_model_by_alias=True)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=AuthUser, response_model_by_alias=True)
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        user.name = data["name"]
    if "email" in data:
        user.email = data["email"]
    if "picture" in data:
        user.picture = data["picture"]
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---- Custom presets ------------------------------------------------------
#
# Stored as a JSON list on the user row. We expose CRUD endpoints that
# always return the freshly mutated user record so the client can replace
# its local copy in one shot (no separate refetch needed).


def _persist_custom_presets(
    db: Session, user: User, presets: list[dict]
) -> User:
    user.custom_presets = presets
    # SQLAlchemy can't always detect mutations to JSON columns when we
    # reassign after popping/inserting in place — ``flag_modified`` makes the
    # write explicit so the UPDATE is emitted.
    flag_modified(user, "custom_presets")
    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/me/presets",
    response_model=AuthUser,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new custom session preset to the caller's profile.",
)
def create_custom_preset(
    payload: CustomPresetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    existing = list(user.custom_presets or [])
    if len(existing) >= MAX_CUSTOM_PRESETS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You can only have up to {MAX_CUSTOM_PRESETS} custom presets.",
        )
    preset = CustomPreset(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        settings=payload.settings,
    )
    existing.append(preset.model_dump())
    return _persist_custom_presets(db, user, existing)


@router.patch(
    "/me/presets/{preset_id}",
    response_model=AuthUser,
    response_model_by_alias=True,
    summary="Update an existing custom preset (rename and/or settings).",
)
def update_custom_preset(
    preset_id: str,
    payload: CustomPresetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    existing = list(user.custom_presets or [])
    for entry in existing:
        if entry.get("id") == preset_id:
            if payload.name is not None:
                entry["name"] = payload.name.strip()
            if payload.settings is not None:
                entry["settings"] = payload.settings.model_dump()
            return _persist_custom_presets(db, user, existing)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Custom preset {preset_id} not found.",
    )


@router.delete(
    "/me/presets/{preset_id}",
    response_model=AuthUser,
    response_model_by_alias=True,
    summary="Delete one of the caller's custom presets.",
)
def delete_custom_preset(
    preset_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    existing = list(user.custom_presets or [])
    next_list = [p for p in existing if p.get("id") != preset_id]
    if len(next_list) == len(existing):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Custom preset {preset_id} not found.",
        )
    return _persist_custom_presets(db, user, next_list)

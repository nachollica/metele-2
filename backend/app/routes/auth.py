"""Auth + profile endpoints (Auth0-backed).

Token issuance and the OAuth dance live entirely in Auth0 — the frontend
talks to the tenant directly via the Auth0 SPA SDK and receives an access
token. The backend validates the token (`GET /auth/me`) and lets the user
edit their local profile fields (`PATCH /auth/me`). The local fields are
authoritative for our app — they're seeded from Auth0 `/userinfo` on first
sign-in and from there on can drift freely from what Auth0 holds.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..auth import get_current_user
from ..db import get_db
from ..db_models import User
from ..models import AuthUser


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

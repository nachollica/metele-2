"""Pydantic API models shared across routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    """Public-facing user record. Mirrors `lib/auth/types.ts` on the frontend.

    `id` is the Auth0 ``sub`` claim (e.g. ``google-oauth2|abc123``) — stable
    across logins and unique within the tenant.
    """

    id: str
    email: str | None = None
    name: str
    picture: str | None = Field(default=None, alias="avatarUrl")

    model_config = {
        "populate_by_name": True,
        "from_attributes": True,
    }

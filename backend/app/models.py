"""Pydantic models shared across routes and the user store."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ProviderId = Literal["google", "instagram", "facebook"]


class AuthUser(BaseModel):
    """Public-facing user record. Mirrors `lib/auth/types.ts` on the frontend.

    `id` is a deterministic composite of `<provider>:<provider_user_id>` so the
    same person logging in via the same provider always lands on the same row,
    even though the in-memory store loses state across restarts.
    """

    id: str
    provider: ProviderId
    email: str | None = None
    name: str
    avatar_url: str | None = Field(default=None, alias="avatarUrl")

    model_config = {"populate_by_name": True, "by_alias": True}


class SessionResponse(BaseModel):
    user: AuthUser
    token: str

"""Pydantic API models shared across routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


# Hard cap on user-defined session presets. Mirrors the 5 visible slots in
# the settings screen. Both backend and tests reference this constant so the
# limit stays single-sourced.
MAX_CUSTOM_PRESETS = 5


class PresetSettings(BaseModel):
    """Subset of GameSettings that a preset captures. Mirrors PRESET_KEYS in
    ``lib/metele/types.ts`` — keep the two in sync when adding settings.
    """

    mainTimerSeconds: int = Field(ge=1, le=60)
    globalTimerEnabled: bool
    globalTimerSeconds: int = Field(ge=1, le=3600)
    requiredWordIntervalEnabled: bool
    requiredWordIntervalSeconds: int = Field(ge=5, le=300)
    requiredWordUseTimerEnabled: bool
    requiredWordUseTimerSeconds: int = Field(ge=5, le=300)

    model_config = {"extra": "forbid"}


class CustomPreset(BaseModel):
    """A user-defined session preset. ``id`` is a server-issued opaque token
    (UUID) so client-side renames/edits don't collide and ``DELETE`` is
    stable across reordering.
    """

    id: str
    name: str = Field(min_length=1, max_length=40)
    settings: PresetSettings

    model_config = {"extra": "forbid"}


class AuthUser(BaseModel):
    """Public-facing user record. Mirrors `lib/auth/types.ts` on the frontend.

    `id` is the Auth0 ``sub`` claim (e.g. ``google-oauth2|abc123``) — stable
    across logins and unique within the tenant.
    """

    id: str
    email: str | None = None
    name: str
    picture: str | None = Field(default=None, alias="avatarUrl")
    custom_presets: list[CustomPreset] = Field(
        default_factory=list, alias="customPresets"
    )

    model_config = {
        "populate_by_name": True,
        "from_attributes": True,
    }

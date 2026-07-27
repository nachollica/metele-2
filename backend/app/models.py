"""Pydantic API models shared across routes."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.db_models import User

# Hard cap on user-defined session presets. Mirrors the 5 visible slots in
# the settings screen. Both backend and tests reference this constant so the
# limit stays single-sourced.
MAX_CUSTOM_PRESETS = 5


class PresetSettings(BaseModel):
    """
    Subset of GameSettings that a preset captures. Mirrors PRESET_KEYS in
    ``lib/flowfic/types.ts`` — keep the two in sync when adding settings.
    """

    mainTimerSeconds: int = Field(ge=1, le=60)  # noqa: N815
    globalTimerEnabled: bool  # noqa: N815
    globalTimerSeconds: int = Field(ge=1, le=3600)  # noqa: N815
    requiredWordIntervalEnabled: bool  # noqa: N815
    requiredWordIntervalSeconds: int = Field(ge=5, le=300)  # noqa: N815
    requiredWordUseTimerEnabled: bool  # noqa: N815
    requiredWordUseTimerSeconds: int = Field(ge=5, le=300)  # noqa: N815

    model_config = {"extra": "forbid"}


class CustomPreset(BaseModel):
    """
    A user-defined session preset. ``id`` is a server-issued opaque token
    (UUID) so client-side renames/edits don't collide and ``DELETE`` is
    stable across reordering.
    """

    id: str
    name: str = Field(min_length=1, max_length=40)
    settings: PresetSettings

    model_config = {"extra": "forbid"}


class StorySettings(BaseModel):
    """
    Full GameSettings snapshot persisted alongside a finished story.

    Mirrors ``GameSettings`` in ``lib/flowfic/types.ts`` (the complete set,
    not just the preset-covered subset). Lenient on read: unknown keys are
    ignored so a story written by a newer frontend never breaks an older
    backend. The sound/word-source fields carry defaults so rows saved by the
    pre-rename frontend (which stored ``bellEnabled`` / ``categoryWords*``, now
    ignored) still validate on read. The strict create-time variant is
    ``StorySettingsStrict``.
    """

    mainTimerSeconds: int  # noqa: N815
    globalTimerEnabled: bool  # noqa: N815
    globalTimerSeconds: int  # noqa: N815
    requiredWordIntervalEnabled: bool  # noqa: N815
    requiredWordIntervalSeconds: int  # noqa: N815
    requiredWordUseTimerEnabled: bool  # noqa: N815
    requiredWordUseTimerSeconds: int  # noqa: N815
    soundEnabled: bool = True  # noqa: N815
    soundMode: Literal["bell", "speak"] = "bell"  # noqa: N815
    wordSource: Literal["free", "universe"] = "free"  # noqa: N815
    wordSourceSeeds: str = ""  # noqa: N815

    model_config = {"extra": "ignore"}


class StorySettingsStrict(StorySettings):
    """
    Strict create-time variant of :class:`StorySettings`.

    Rejects unknown keys so a malformed or typo'd create payload fails at the
    API boundary instead of being silently persisted.
    """

    model_config = {"extra": "forbid"}


class StoryStats(BaseModel):
    """
    Outcome stats for a finished story (the GameResult the frontend sends,
    minus the story text, which is persisted on its own column).

    Lenient on read for the same forward-compat reason as
    :class:`StorySettings`.
    """

    reason: str
    durationMs: int  # noqa: N815
    characters: int
    words: int
    requiredWordsUsed: int  # noqa: N815

    model_config = {"extra": "ignore"}


class StoryStatsStrict(StoryStats):
    """Strict create-time variant of :class:`StoryStats`."""

    model_config = {"extra": "forbid"}


class AuthUser(BaseModel):
    """
    Public-facing user record. Mirrors ``lib/auth/types.ts`` on the frontend.

    ``id`` is the Auth0 ``sub`` claim (e.g. ``google-oauth2|abc123``) — stable
    across logins and unique within the tenant. ``avatarUrl`` carries the
    ``User.picture`` value under the frontend's wire key.
    """

    id: str
    email: str | None = None
    name: str
    avatarUrl: str | None = None  # noqa: N815
    customPresets: list[CustomPreset] = Field(default_factory=list)  # noqa: N815

    @classmethod
    def from_user(cls, user: User) -> AuthUser:
        """
        Build the wire model from a ``User`` row, mapping ``picture`` to the
        frontend's ``avatarUrl`` key. Explicit construction (rather than an
        alias on the model) keeps the snake_case↔camelCase hop visible here.
        """
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatarUrl=user.picture,
            customPresets=list(user.custom_presets),
        )

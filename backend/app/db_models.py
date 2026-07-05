"""
SQLModel tables.

Kept in a separate module from the Pydantic API models in ``models.py`` so DB
state is clearly distinct from the wire-level shapes. Tables register on
``SQLModel.metadata`` at import time — see ``db.init_db()`` for the bootstrap.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

from app.json_field import JSONField
from app.models import CustomPreset, StorySettings, StoryStats


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """
    Authenticated user.

    ``id`` is either the Auth0 ``sub`` claim (e.g. ``google-oauth2|abc123``)
    for real users created via social login, or a free-form username for
    rows seeded for the dev-login backdoor (see
    ``app.scripts.seed_dev_user``). Profile fields are populated from
    Auth0's ``/userinfo`` on first sign-in; the user can then override
    ``name``/``email``/``picture`` via ``PATCH /profile/me``.
    """

    __tablename__ = "users"

    id: str = Field(primary_key=True)

    email: str | None = Field(default=None, index=True)
    name: str
    picture: str | None = None

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    custom_presets: list[CustomPreset] = Field(
        default_factory=list,
        sa_column=Column(JSONField(list[CustomPreset]), nullable=False, default=list),
    )


class Story(SQLModel, table=True):
    """A finished writing session."""

    __tablename__ = "stories"

    id: int | None = Field(default=None, primary_key=True)

    # Nullable display title. Not surfaced in the frontend yet — added so the
    # story-list UI can render a heading once we decide how to populate it
    # (manual entry, summarisation, etc.).
    title: str | None = Field(default=None, max_length=200)

    text: str
    lang: str = Field(index=True)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )

    user_id: str | None = Field(default=None, foreign_key="users.id", index=True)

    settings: StorySettings = Field(
        sa_column=Column(JSONField(StorySettings), nullable=False),
    )

    stats: StoryStats = Field(
        sa_column=Column(JSONField(StoryStats), nullable=False),
    )

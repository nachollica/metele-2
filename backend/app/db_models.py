"""SQLModel tables.

Kept in a separate module from the Pydantic API models in ``models.py`` so DB
state is clearly distinct from the wire-level shapes. Tables register on
``SQLModel.metadata`` at import time — see ``db.init_db()`` for the bootstrap.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

from .json_field import JSONField


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """Authenticated user.

    ``id`` is the Auth0 ``sub`` claim (e.g. ``google-oauth2|abc123``). We use
    it directly as the primary key so every place that holds a user reference
    can stick to a single, stable string. Profile fields are populated from
    Auth0's ``/userinfo`` endpoint on first sign-in and refreshed on later
    logins.
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

    # User-defined session presets. Stored as a JSON list of objects shaped
    # like ``{"id": str, "name": str, "settings": {...preset-covered keys...}}``.
    # Validated at the API boundary (see ``models.CustomPreset``); the DB
    # layer treats it as opaque JSON.
    custom_presets: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSONField, nullable=False, default=list),
    )


class Story(SQLModel, table=True):
    """A finished writing session."""

    __tablename__ = "stories"

    id: int | None = Field(default=None, primary_key=True)

    text: str
    lang: str = Field(index=True)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )

    # Owner. Nullable so legacy anonymous rows persist; new rows always carry
    # the authenticated caller's id.
    user_id: str | None = Field(default=None, foreign_key="users.id", index=True)

    settings: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONField, nullable=False),
    )

    stats: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONField, nullable=False),
    )

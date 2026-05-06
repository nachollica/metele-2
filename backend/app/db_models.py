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


class Story(SQLModel, table=True):
    """A finished writing session.

    ``user_id`` is nullable: anonymous sessions are persisted with NULL until
    the auth-aware POST flow lands. ``settings`` is a snapshot of the
    ``GameSettings`` object the frontend used; ``stats`` mirrors the
    ``GameResult`` object the frontend computed at end-of-session. Both are
    stored as JSON so we can evolve the shapes on either side without DB
    migrations.
    """

    __tablename__ = "stories"

    id: int | None = Field(default=None, primary_key=True)

    # Story body — the literal text the player typed (post-edits).
    text: str

    # Frontend locale used for the session (matches the URL segment: en/es/...).
    lang: str = Field(index=True)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )

    # Composite "<provider>:<provider_user_id>" — same key as ``AuthUser.id``.
    # Indexed for the future "list MY stories" query path.
    user_id: str | None = Field(default=None, index=True)

    settings: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONField, nullable=False),
    )

    stats: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONField, nullable=False),
    )

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

from app.enum_field import EnumString
from app.json_field import JSONField
from app.models import CustomPreset, StoryPrivacy, StorySettings, StoryStats


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

    # Who besides the owner can read this story. Defaults to private for both
    # new rows and every row that existed before this column did (see the
    # additive migration in `app.db.migrations`). No index yet — nothing
    # filters on it until a cross-user read path exists.
    privacy: StoryPrivacy = Field(
        default=StoryPrivacy.PRIVATE,
        sa_column=Column(
            EnumString(StoryPrivacy),
            nullable=False,
            server_default=StoryPrivacy.PRIVATE.value,
        ),
    )

    settings: StorySettings = Field(
        sa_column=Column(JSONField(StorySettings), nullable=False),
    )

    stats: StoryStats = Field(
        sa_column=Column(JSONField(StoryStats), nullable=False),
    )


class ConnectionInvite(SQLModel, table=True):
    """
    A user's standing invite link.

    One row per user (``user_id`` is the primary key): no row means the link
    is disabled, so nobody can reach that user through it. ``POST
    /connections/invite`` creates the row or overwrites ``token`` in place
    (regenerate); ``DELETE`` removes it (revoke). Both tables in this module
    are brand new, so they need no additive migration — ``create_all`` builds
    them in their full shape on any dialect.
    """

    __tablename__ = "connection_invites"

    user_id: str = Field(foreign_key="users.id", primary_key=True)
    token: str = Field(unique=True, index=True)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class Connection(SQLModel, table=True):
    """
    A mutual connection between two users.

    One row per pair, canonically ordered (``user_a_id < user_b_id``) so the
    relationship needs no second row for the reverse direction and a unique
    pair can't be inserted twice under swapped columns. Always build rows
    through :meth:`between` rather than the constructor directly, so the
    ordering invariant can't be broken by an out-of-order caller.
    """

    __tablename__ = "connections"

    user_a_id: str = Field(foreign_key="users.id", primary_key=True)
    user_b_id: str = Field(foreign_key="users.id", primary_key=True)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    @classmethod
    def between(cls, user_id: str, other_id: str) -> Connection:
        a, b = sorted((user_id, other_id))
        return cls(user_a_id=a, user_b_id=b)

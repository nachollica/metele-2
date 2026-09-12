"""
Connections endpoints: standing invite links and the mutual connections they
create.

There is no user search anywhere in this feature — the only way to reach
another user is a link they generated and shared out-of-band. Two rows model
the whole thing (see ``app.db_models``): ``ConnectionInvite`` is one user's
standing, revocable link; ``Connection`` is a mutual, immediate pair created
the moment someone accepts one. Nothing here enforces story privacy yet —
that is a read-path concern for a later change; this module only lets users
find each other.
"""

from __future__ import annotations

import secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, or_, select

from app.db_models import Connection, ConnectionInvite, User
from app.dependencies import CurrentUser, DbSession

router = APIRouter(prefix="/connections", tags=["connections"])


# ---- Schemas --------------------------------------------------------------


class PublicUser(BaseModel):
    """The only slice of a ``User`` row ever shown to someone else."""

    id: str
    name: str
    avatarUrl: str | None = None  # noqa: N815

    @classmethod
    def from_user(cls, user: User) -> PublicUser:
        return cls(id=user.id, name=user.name, avatarUrl=user.picture)


class InviteRead(BaseModel):
    """The caller's own invite link. ``token`` is null when disabled."""

    token: str | None


class InvitePreview(BaseModel):
    """
    What an unauthenticated visitor sees before signing in.

    Deliberately just the inviter's name and avatar — the token itself is the
    secret that was handed to this person on purpose, so naming its owner
    isn't a new disclosure, but nothing else about the account is exposed
    pre-auth.
    """

    inviter: PublicUser


class ConnectionRead(BaseModel):
    user: PublicUser
    connectedAt: datetime  # noqa: N815


# ---- Helpers ---------------------------------------------------------------


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _get_invite(db: DbSession, token: str) -> ConnectionInvite:
    invite = db.exec(select(ConnectionInvite).where(ConnectionInvite.token == token)).first()
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite link not found.",
        )
    return invite


# ---- The caller's own invite link ------------------------------------------


@router.get(
    "/invite",
    response_model=InviteRead,
    summary="The caller's own invite link, or null if it has never been created / was revoked.",
)
def get_own_invite(db: DbSession, user: CurrentUser) -> InviteRead:
    invite = db.get(ConnectionInvite, user.id)
    return InviteRead(token=invite.token if invite else None)


@router.post(
    "/invite",
    response_model=InviteRead,
    summary="Create the caller's invite link, or regenerate it if one already exists.",
)
def create_or_regenerate_invite(db: DbSession, user: CurrentUser) -> InviteRead:
    invite = db.get(ConnectionInvite, user.id)
    if invite is None:
        invite = ConnectionInvite(user_id=user.id, token=_new_token())
    else:
        invite.token = _new_token()
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InviteRead(token=invite.token)


@router.delete(
    "/invite",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the caller's invite link. Idempotent when there is none.",
)
def revoke_invite(db: DbSession, user: CurrentUser) -> None:
    invite = db.get(ConnectionInvite, user.id)
    if invite is not None:
        db.delete(invite)
        db.commit()


# ---- Redeeming someone else's link -----------------------------------------


@router.get(
    "/invite/{token}",
    response_model=InvitePreview,
    summary="Preview who an invite link belongs to. Unauthenticated on purpose, "
    "so a visitor without an account can see who invited them before signing up.",
)
def preview_invite(token: str, db: DbSession) -> InvitePreview:
    invite = _get_invite(db, token)
    inviter = db.get(User, invite.user_id)
    if inviter is None:
        # The owning user row is gone (shouldn't happen without a cascade,
        # but the invite would be orphaned) — treat like an unknown link.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite link not found.",
        )
    return InvitePreview(inviter=PublicUser.from_user(inviter))


@router.post(
    "/invite/{token}/accept",
    response_model=ConnectionRead,
    summary="Accept an invite link, connecting the caller with its owner.",
)
def accept_invite(token: str, db: DbSession, user: CurrentUser) -> ConnectionRead:
    invite = _get_invite(db, token)
    if invite.user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can't connect with yourself.",
        )
    inviter = db.get(User, invite.user_id)
    if inviter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite link not found.",
        )

    connection = Connection.between(user.id, inviter.id)
    pair = (connection.user_a_id, connection.user_b_id)
    existing = db.get(Connection, pair)
    if existing is not None:
        # Already connected (e.g. re-opening the same link) — report the
        # existing row rather than a duplicate-key error.
        return ConnectionRead(user=PublicUser.from_user(inviter), connectedAt=existing.created_at)

    db.add(connection)
    try:
        db.commit()
    except IntegrityError:
        # Two concurrent accepts of the same link raced the insert above —
        # get-or-create: roll back our losing insert and report the winner's.
        db.rollback()
        winner = db.get(Connection, pair)
        if winner is None:
            raise
        return ConnectionRead(user=PublicUser.from_user(inviter), connectedAt=winner.created_at)
    db.refresh(connection)
    return ConnectionRead(user=PublicUser.from_user(inviter), connectedAt=connection.created_at)


# ---- The caller's connections ----------------------------------------------


@router.get(
    "",
    response_model=list[ConnectionRead],
    summary="List the caller's connections.",
)
def list_connections(db: DbSession, user: CurrentUser) -> list[ConnectionRead]:
    rows = db.exec(
        select(Connection).where(
            or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id)
        )
    ).all()
    other_ids = [row.user_b_id if row.user_a_id == user.id else row.user_a_id for row in rows]
    others = {u.id: u for u in db.exec(select(User).where(col(User.id).in_(other_ids))).all()}
    return [
        ConnectionRead(user=PublicUser.from_user(others[oid]), connectedAt=row.created_at)
        for row, oid in zip(rows, other_ids, strict=True)
        if oid in others
    ]


@router.delete(
    "/{other_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a connection. Idempotent when the pair isn't connected.",
)
def remove_connection(other_user_id: str, db: DbSession, user: CurrentUser) -> None:
    a, b = sorted((user.id, other_user_id))
    row = db.get(Connection, (a, b))
    if row is not None:
        db.delete(row)
        db.commit()

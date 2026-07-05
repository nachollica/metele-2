"""
Centralized FastAPI dependency-injection wiring.

All ``Annotated[..., Depends(...)]`` type aliases the routers reuse live here,
so a route signature reads as ``user: CurrentUser`` instead of repeating the
``Depends`` plumbing. ``get_current_user`` also lives here (rather than in
:mod:`app.auth`) because it is the one piece of auth that needs the database
and settings dependencies — keeping it here lets :mod:`app.auth` stay a pure,
framework-free library.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.auth import (
    extract_primary_email,
    extract_token,
    fetch_userinfo,
    verify_access_token,
)
from app.db import get_db
from app.db_models import User
from app.settings import Settings, get_settings

# ``Settings``/``Session``/``User`` appear only inside these annotations, but
# FastAPI evaluates dependency annotations at runtime (get_type_hints), so they
# must stay importable at module scope — hence the TC001/TC002 ignore for this
# file in pyproject. This is the single place that plumbing is explained.

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSession = Annotated[Session, Depends(get_db)]
AcceptLanguageHeader = Annotated[str | None, Header()]


def get_current_user(
    settings: SettingsDep,
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """
    Validate the bearer token and return the matching ``User`` row.

    Upserts the local ``users`` row on first contact, populating ``email``,
    ``name`` and ``picture`` from Auth0's ``/userinfo`` so the rest of the
    backend never has to call out to Auth0 again for that user.
    """
    token = extract_token(authorization)

    # Dev-user backdoor. Tokens shaped ``<dev_user_token>:<username>``
    # resolve to a pre-seeded User row and skip JWKS entirely. The
    # production env validator forbids ``dev_user_enabled=True``, so this
    # branch is only reachable in local/development/testing.
    dev_prefix = f"{settings.dev_user_token}:"
    if settings.dev_user_enabled and token.startswith(dev_prefix):
        username = token[len(dev_prefix) :]
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dev token missing username.",
            )
        dev = db.get(User, username)
        if dev is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Dev user '{username}' not seeded.",
            )
        return dev

    claims = verify_access_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing `sub` claim.",
        )

    existing = db.get(User, sub)
    if existing is not None:
        return existing

    info = fetch_userinfo(token, settings)
    now = datetime.now(timezone.utc)
    email = extract_primary_email(info)
    user = User(
        id=sub,
        email=email,
        name=info.get("name") or info.get("nickname") or email or sub,
        picture=info.get("picture"),
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Get-or-create: a concurrent request inserted this same ``sub``
        # between the ``db.get`` above and this commit (two tabs, a fast
        # double-call, etc.). The primary-key conflict is benign — roll back
        # our losing INSERT and return the row the winner committed.
        db.rollback()
        winner = db.get(User, sub)
        if winner is not None:
            return winner
        raise
    db.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

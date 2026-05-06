"""Seed the local-dev backdoor user.

Run::

    uv run python -m app.scripts.seed_dev_user

Idempotent: if the row already exists, refreshes name/email and returns.
The id and the shared-secret token both come from ``Settings``; override
via env (``DEV_USER_ID`` / ``DEV_USER_TOKEN``) if you need different
values, but the defaults are fine for everyday local work.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session

from ..db import engine, init_db
from ..db_models import User
from ..settings import get_settings


def seed_dev_user() -> User:
    init_db()
    settings = get_settings()
    if not settings.dev_user_enabled:
        raise SystemExit(
            "dev_user_enabled is false; refusing to seed. Set "
            "DEV_USER_ENABLED=true in your env if you really want this."
        )

    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        existing = session.get(User, settings.dev_user_id)
        if existing is not None:
            existing.name = "Dev User"
            existing.email = "dev@metele.local"
            existing.updated_at = now
            session.add(existing)
            session.commit()
            session.refresh(existing)
            print(f"Refreshed dev user (id={existing.id}).")
            return existing
        user = User(
            id=settings.dev_user_id,
            email="dev@metele.local",
            name="Dev User",
            picture=None,
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"Seeded dev user (id={user.id}).")
        return user


if __name__ == "__main__":
    seed_dev_user()

"""Seed dev-user rows for the local Auth0-less backdoor.

Run::

    uv run python -m app.scripts.seed_dev_user alice bob carol

Each positional argument is a username. The script creates a User row whose
``id`` is the username (no Auth0 ``sub``-style prefix), with placeholder name
and email. If a row already exists for that id, it is left untouched and a
warning is logged. The script is idempotent across reruns.

The ``dev_user_enabled`` flag still gates the runtime backdoor; it does not
gate seeding, so you can pre-create rows even when the feature is disabled.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from sqlmodel import Session

from ..db import engine, init_db
from ..db_models import User


def _humanize(username: str) -> str:
    return username.replace("_", " ").replace("-", " ").strip().title() or username


def seed_dev_users(usernames: list[str]) -> list[User]:
    init_db()
    seeded: list[User] = []
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        for raw in usernames:
            username = raw.strip()
            if not username:
                print("WARN: skipping empty username.")
                continue
            existing = session.get(User, username)
            if existing is not None:
                print(f"WARN: dev user '{username}' already exists, skipping.")
                continue
            user = User(
                id=username,
                email=f"{username}@metele.local",
                name=_humanize(username),
                picture=None,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"Seeded dev user '{user.id}'.")
            seeded.append(user)
    return seeded


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="seed_dev_user",
        description="Seed one or more dev-user rows by username.",
    )
    parser.add_argument(
        "usernames",
        nargs="+",
        metavar="USERNAME",
        help="Usernames to seed. Each becomes the User row's id.",
    )
    args = parser.parse_args()
    seed_dev_users(args.usernames)


if __name__ == "__main__":
    main()

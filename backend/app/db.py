"""Database engine, session factory, and FastAPI dependency.

We use SQLite locally (file at ``DATABASE_URL`` or ``./metele.db`` by default).
For production we'll point ``DATABASE_URL`` at Postgres — the JSON column
helper in ``json_field.py`` already prefers JSONB on that dialect, so swapping
is a config-only change.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import inspect, text

from sqlmodel import Session, SQLModel, create_engine


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./metele.db")

# SQLite's default driver refuses cross-thread reuse of a connection; FastAPI
# hands the session to the request handler from a worker thread, so we relax
# that for SQLite only. Postgres driver doesn't need this flag.
_connect_args: dict[str, object] = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(DATABASE_URL, connect_args=_connect_args, echo=False)


def init_db() -> None:
    """Create all tables. Idempotent — safe to call on every startup."""
    # Importing here avoids a circular import at module load time: db_models
    # imports from this module to declare its sa_columns.
    from . import db_models  # noqa: F401  (registers tables on SQLModel.metadata)

    SQLModel.metadata.create_all(engine)
    _apply_lightweight_migrations()


def _apply_lightweight_migrations() -> None:
    """Add columns introduced after the initial schema. We don't yet pull in
    Alembic — for the handful of additive columns we have, a probe-and-ALTER
    pass on startup is sufficient and idempotent.
    """
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    user_cols = {c["name"] for c in inspector.get_columns("users")}
    if "custom_presets" not in user_cols:
        col_type = "JSONB" if engine.dialect.name == "postgresql" else "TEXT"
        with engine.begin() as conn:
            conn.execute(
                text(
                    f"ALTER TABLE users ADD COLUMN custom_presets {col_type} "
                    "NOT NULL DEFAULT '[]'"
                )
            )


def get_db() -> Iterator[Session]:
    """FastAPI dependency: per-request SQLModel session."""
    with Session(engine) as session:
        yield session

"""
Database engine, session factory, and FastAPI dependency.

Dialect-specific bits live in sibling modules:

- ``sqlite.py`` — local-dev SQLite engine + its quirks (cross-thread flag,
  TEXT-backed JSON, etc.). Self-contained so we can keep shipping a no-server
  workflow.
- ``postgres.py`` — production Postgres engine and helpers; this is what the
  app modules ultimately import.

The package entry point picks the right backend from ``DATABASE_URL`` and
re-exports the same interface (``engine``, ``init_db``, ``get_db``) so callers
don't care which one is live. Production deploys must point ``DATABASE_URL``
at Postgres; tests still use SQLite.

``DATABASE_URL`` has a single source of truth — ``Settings.database_url`` — so
the location of the SQLite file is never decided in two places.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import Session

from app.db import postgres, sqlite
from app.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Iterator

DATABASE_URL = get_settings().database_url


def _backend():
    return sqlite if DATABASE_URL.startswith("sqlite") else postgres


engine = _backend().build_engine(DATABASE_URL)


def init_db() -> None:
    """Create all tables. Idempotent — safe to call on every startup."""
    # Import registers tables on SQLModel.metadata.
    from app import db_models  # noqa: F401

    _backend().init_schema(engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: per-request SQLModel session."""
    with Session(engine) as session:
        yield session


__all__ = ["DATABASE_URL", "engine", "init_db", "get_db"]

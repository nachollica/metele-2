"""
SQLite backend — local dev + tests.

Kept walled-off from the Postgres helpers so production code doesn't reach in
here. The cross-thread flag is the only real quirk; the JSON column type
already adapts itself via :mod:`app.json_field`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import SQLModel, create_engine

from app.db.migrations import apply_additive_migrations

if TYPE_CHECKING:
    from sqlalchemy import Engine


def build_engine(url: str) -> Engine:
    # SQLite's default driver refuses cross-thread reuse of a connection;
    # FastAPI hands the session to the request handler from a worker thread,
    # so relax that here. Postgres doesn't need this.
    return create_engine(url, connect_args={"check_same_thread": False}, echo=False)


def init_schema(engine: Engine) -> None:
    SQLModel.metadata.create_all(engine)
    apply_additive_migrations(engine)

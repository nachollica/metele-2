"""
Postgres backend — production.

Uses ``psycopg`` (v3) under the hood: ``DATABASE_URL=postgresql+psycopg://…``.
Plain ``postgresql://…`` is auto-upgraded to the psycopg driver so deployers
can paste in the URL their cloud provider hands them.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import SQLModel, create_engine

from app.db.migrations import apply_additive_migrations

if TYPE_CHECKING:
    from sqlalchemy import Engine


def _normalize_url(url: str) -> str:
    # Default the driver to psycopg v3. ``postgres://`` (legacy) also works.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def build_engine(url: str) -> Engine:
    return create_engine(
        _normalize_url(url),
        echo=False,
        pool_pre_ping=True,  # drop stale connections behind the load balancer.
        pool_size=5,
        max_overflow=10,
    )


def init_schema(engine: Engine) -> None:
    SQLModel.metadata.create_all(engine)
    apply_additive_migrations(engine)

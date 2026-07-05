"""
Additive-column migration shim shared by both database backends.

Until Alembic lands, schema evolution is limited to additive ``ALTER TABLE …
ADD COLUMN`` statements that run idempotently on every startup. The probe
logic (does the table exist, does the column exist) is dialect-agnostic and
lives here once; only the DDL string differs per dialect, so each entry in
``_ADDITIVE_COLUMNS`` carries one statement per supported dialect.

To add a new column: append an entry below with the DDL for both dialects.
SQLite can't drop or retype columns, so anything beyond ADD COLUMN needs a
real migration tool instead.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import inspect, text

if TYPE_CHECKING:
    from sqlalchemy import Engine

# (table, column, {dialect name: DDL statement}).
_ADDITIVE_COLUMNS: tuple[tuple[str, str, dict[str, str]], ...] = (
    (
        "users",
        "custom_presets",
        {
            "sqlite": "ALTER TABLE users ADD COLUMN custom_presets TEXT NOT NULL DEFAULT '[]'",
            "postgresql": (
                "ALTER TABLE users ADD COLUMN custom_presets JSONB NOT NULL DEFAULT '[]'::jsonb"
            ),
        },
    ),
    (
        "stories",
        "title",
        {
            "sqlite": "ALTER TABLE stories ADD COLUMN title VARCHAR(200)",
            "postgresql": "ALTER TABLE stories ADD COLUMN title VARCHAR(200)",
        },
    ),
)


def apply_additive_migrations(engine: Engine) -> None:
    """
    Add any missing columns from ``_ADDITIVE_COLUMNS`` to ``engine``'s schema.

    Idempotent and safe to run on every startup: tables that don't exist yet
    are skipped (``create_all`` builds them in their current, full shape) and
    columns already present are left untouched.
    """
    inspector = inspect(engine)
    dialect = engine.dialect.name
    tables = set(inspector.get_table_names())
    for table, column, ddl_by_dialect in _ADDITIVE_COLUMNS:
        if table not in tables:
            continue
        existing = {col["name"] for col in inspector.get_columns(table)}
        if column in existing:
            continue
        with engine.begin() as conn:
            conn.execute(text(ddl_by_dialect[dialect]))

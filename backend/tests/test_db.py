"""
Unit tests for the database layer that don't need a live server.

Covers the Postgres URL normalization (a pure string helper) and the shared
additive-migration shim (``app.db.migrations``), both of which the main suite
otherwise leaves untested because it talks to in-memory SQLite directly.
"""

from __future__ import annotations

from sqlalchemy import create_engine, inspect, text

from app.db import postgres, sqlite
from app.db.migrations import _ADDITIVE_COLUMNS, apply_additive_migrations


class TestNormalizeUrl:
    def test_bare_postgresql_gets_psycopg_driver(self) -> None:
        assert (
            postgres._normalize_url("postgresql://u:p@h:5432/db")
            == "postgresql+psycopg://u:p@h:5432/db"
        )

    def test_legacy_postgres_scheme_is_upgraded(self) -> None:
        # The deprecated ``postgres://`` form (still handed out by some hosts)
        # is normalized through ``postgresql://`` to the psycopg driver.
        assert postgres._normalize_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"

    def test_explicit_psycopg_driver_is_left_untouched(self) -> None:
        url = "postgresql+psycopg://u:p@h/db"
        assert postgres._normalize_url(url) == url

    def test_other_explicit_driver_is_not_clobbered(self) -> None:
        # An operator who picked a different driver on purpose keeps it.
        url = "postgresql+asyncpg://u:p@h/db"
        assert postgres._normalize_url(url) == url


class TestAdditiveMigrations:
    def test_adds_custom_presets_column_to_legacy_users(self, tmp_path) -> None:
        engine = create_engine(f"sqlite:///{tmp_path / 'mig.db'}")
        try:
            # Pre-migration shape: users table without custom_presets.
            with engine.begin() as conn:
                conn.execute(
                    text("CREATE TABLE users (id VARCHAR PRIMARY KEY, name VARCHAR NOT NULL)")
                )
            apply_additive_migrations(engine)
            cols = {c["name"] for c in inspect(engine).get_columns("users")}
            assert "custom_presets" in cols
        finally:
            engine.dispose()

    def test_adds_title_column_to_legacy_stories(self, tmp_path) -> None:
        engine = create_engine(f"sqlite:///{tmp_path / 'mig.db'}")
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("CREATE TABLE stories (id INTEGER PRIMARY KEY, text VARCHAR NOT NULL)")
                )
            apply_additive_migrations(engine)
            cols = {c["name"] for c in inspect(engine).get_columns("stories")}
            assert "title" in cols
        finally:
            engine.dispose()

    def test_missing_tables_are_skipped(self, tmp_path) -> None:
        # A fresh, empty database has nothing to migrate — ``create_all``
        # builds the tables in their full shape afterwards.
        engine = create_engine(f"sqlite:///{tmp_path / 'mig.db'}")
        try:
            apply_additive_migrations(engine)  # must not raise
            assert inspect(engine).get_table_names() == []
        finally:
            engine.dispose()

    def test_is_idempotent_when_columns_already_present(self, tmp_path) -> None:
        # Running the shim against an already-migrated DB is a no-op, not an
        # error (it runs on every startup).
        engine = create_engine(f"sqlite:///{tmp_path / 'mig.db'}")
        try:
            sqlite.init_schema(engine)  # full current schema
            apply_additive_migrations(engine)  # second pass
            cols = {c["name"] for c in inspect(engine).get_columns("users")}
            assert "custom_presets" in cols
        finally:
            engine.dispose()

    def test_every_entry_carries_ddl_for_both_dialects(self) -> None:
        # The registry is the single source of truth for both backends: an
        # entry missing a dialect would crash at startup on that backend.
        for _table, _column, ddl_by_dialect in _ADDITIVE_COLUMNS:
            assert set(ddl_by_dialect) == {"sqlite", "postgresql"}

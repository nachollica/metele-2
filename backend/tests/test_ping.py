"""Tests for the /ping liveness endpoint and the auth-gated /ping/db check."""

from __future__ import annotations

import os


def test_ping_reports_metadata(client, settings):
    res = client.get("/ping")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ok"
    assert body["environment"] == settings.environment  # "testing"
    assert body["devUserEnabled"] is True  # dev backdoor on for the test suite
    assert isinstance(body["version"], str)
    assert body["version"]
    assert isinstance(body["utcStartedAt"], str)
    assert body["utcStartedAt"]


def test_ping_sets_cache_header(client):
    res = client.get("/ping")
    assert "max-age" in res.headers.get("cache-control", "")


def test_ping_reports_worker_identity_and_backend(client):
    res = client.get("/ping")
    body = res.json()
    assert body["pid"] == os.getpid()
    assert body["dbDialect"] == "sqlite"  # the suite runs on SQLite


def test_ping_payload_is_constant_across_calls(client):
    # The response carries a cache header, which is only honest if the body
    # never varies between requests to the same worker. A field that ticks
    # (uptime, a counter) would silently make that header a lie.
    first = client.get("/ping").json()
    second = client.get("/ping").json()
    assert first == second


def test_ping_reports_loaded_word_pools(client, monkeypatch):
    # The route imports the helper by name, so patch it where it is looked up.
    monkeypatch.setattr(
        "app.routes.ping.loaded_pool_sizes",
        lambda: {"en": 34682, "es": 42653},
    )
    body = client.get("/ping").json()
    assert body["wordPools"] == {"en": 34682, "es": 42653}


def test_ping_reports_empty_word_pools_when_nothing_loaded(client):
    # The suite points WORD_DATA_DIR at a nonexistent directory and the
    # lifespan skips preloading under ENVIRONMENT=testing, so no pool is
    # resident. That must surface as `{}` rather than as a healthy-looking
    # payload — it is the signal that a worker's artifacts failed to load.
    assert client.get("/ping").json()["wordPools"] == {}


def test_ping_dev_user_flag_reflects_settings(client, settings, monkeypatch):
    # The frontend dev-login button is driven by this flag, so confirm /ping
    # mirrors the setting rather than hardcoding it.
    monkeypatch.setattr(settings, "dev_user_enabled", False)
    res = client.get("/ping")
    assert res.json()["devUserEnabled"] is False


def test_ping_db_requires_auth(client):
    res = client.get("/ping/db")
    assert res.status_code == 401


def test_ping_db_reports_health_for_authed_user(auth_client):
    res = auth_client.get("/ping/db")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ok"
    assert body["dialect"] == "sqlite"  # the suite runs on SQLite
    assert isinstance(body["latencyMs"], (int, float))


def test_ping_db_returns_503_when_db_unreachable(auth_client):
    # Swap the DB session for one whose connection() raises, simulating a
    # dropped database. The probe must report 503, not 500.
    from sqlalchemy.exc import SQLAlchemyError

    from app.db import get_db

    class _BoomSession:
        def connection(self):
            raise SQLAlchemyError("simulated outage")

    def _broken_db():
        yield _BoomSession()

    auth_client.app.dependency_overrides[get_db] = _broken_db
    res = auth_client.get("/ping/db")
    assert res.status_code == 503

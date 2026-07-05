"""Tests for the /ping liveness endpoint and the auth-gated /ping/db check."""

from __future__ import annotations


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

"""Tests for the dev-user backdoor: a shared-secret-prefix bypass that lets
us exercise authenticated endpoints without spinning up Auth0.

Each dev row is keyed by username. The minted token format is
``<dev_user_token>:<username>`` and the auth dep is exercised end-to-end
against the real ``get_current_user``.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db_models import User
from app.settings import Settings


@pytest.fixture
def dev_user(db_engine, settings: Settings) -> User:
    """Pre-seed one dev row the same way `seed_dev_users` would."""
    user = User(
        id="alice",
        email="alice@metele.local",
        name="Alice",
        picture=None,
    )
    with Session(db_engine) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def test_dev_login_returns_token_and_user(client, settings, dev_user) -> None:
    res = client.post("/auth/dev-login", json={"username": dev_user.id})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token"] == f"{settings.dev_user_token}:{dev_user.id}"
    assert body["user"]["id"] == dev_user.id
    assert body["user"]["customPresets"] == []


def test_dev_login_403_when_username_unknown(client, settings) -> None:
    res = client.post("/auth/dev-login", json={"username": "ghost"})
    assert res.status_code == 403


def test_dev_login_422_when_username_missing(client) -> None:
    res = client.post("/auth/dev-login", json={})
    assert res.status_code == 422


def test_dev_login_404_when_disabled(db_engine) -> None:
    """Dev backdoor must refuse to issue a token when the feature is off."""
    from app.db import get_db
    from app.main import create_app
    from app.settings import get_settings

    locked = Settings(
        frontend_origin="http://localhost:3000",
        dev_user_enabled=False,
    )
    app = create_app()

    def _get_db_override():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: locked
    app.dependency_overrides[get_db] = _get_db_override

    with TestClient(app, follow_redirects=False) as c:
        res = c.post("/auth/dev-login", json={"username": "alice"})
        assert res.status_code == 404


def test_dev_token_authenticates_protected_endpoint(client, settings, dev_user) -> None:
    res = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {settings.dev_user_token}:{dev_user.id}",
        },
    )
    assert res.status_code == 200
    assert res.json()["id"] == dev_user.id


def test_dev_token_works_for_preset_crud(client, settings, dev_user) -> None:
    """Smoke test that the bypass plays nicely with the preset endpoints."""
    headers = {
        "Authorization": f"Bearer {settings.dev_user_token}:{dev_user.id}",
    }
    payload = {
        "name": "DevPreset",
        "settings": {
            "mainTimerSeconds": 5,
            "globalTimerEnabled": False,
            "globalTimerSeconds": 60,
            "requiredWordIntervalEnabled": False,
            "requiredWordIntervalSeconds": 30,
            "requiredWordUseTimerEnabled": False,
            "requiredWordUseTimerSeconds": 30,
        },
    }
    res = client.post("/auth/me/presets", json=payload, headers=headers)
    assert res.status_code == 201
    assert len(res.json()["customPresets"]) == 1


def test_dev_token_for_unseeded_username_is_401(client, settings) -> None:
    """Bypass branch fires on prefix match but rejects unknown usernames."""
    res = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {settings.dev_user_token}:ghost",
        },
    )
    assert res.status_code == 401


def test_unknown_token_with_dev_enabled_falls_through_to_jwks_401(
    client, settings, dev_user
) -> None:
    """Tokens without the dev prefix still hit the Auth0 path — which is
    unconfigured here, so it raises a 401."""
    res = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer not-the-dev-token"},
    )
    assert res.status_code == 401


def test_dev_token_rejected_when_dev_disabled(db_engine) -> None:
    """Even with the right prefix, the bypass must not fire when disabled."""
    from app.db import get_db
    from app.main import create_app
    from app.settings import get_settings

    locked = Settings(
        frontend_origin="http://localhost:3000",
        auth0_domain="t.auth0.com",
        auth0_audience="https://api.test",
        dev_user_enabled=False,
        dev_user_token="dev-test-token",
    )
    user = User(id="alice", email=None, name="Alice")
    with Session(db_engine) as session:
        session.add(user)
        session.commit()
    app = create_app()

    def _get_db_override():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: locked
    app.dependency_overrides[get_db] = _get_db_override

    with TestClient(app, follow_redirects=False) as c:
        res = c.get(
            "/auth/me",
            headers={"Authorization": "Bearer dev-test-token:alice"},
        )
        assert res.status_code == 401

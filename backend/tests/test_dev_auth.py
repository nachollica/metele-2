"""Tests for the dev-user backdoor: a hardcoded shared-secret bypass that
lets us exercise authenticated endpoints without spinning up Auth0.

The dep is exercised end-to-end against the real ``get_current_user``
(no override) so we cover both the bypass branch and its 401 paths.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db_models import User
from app.settings import Settings


@pytest.fixture
def dev_user(db_engine, settings: Settings) -> User:
    """Pre-seed the dev row the same way `seed_dev_user` would."""
    user = User(
        id=settings.dev_user_id,
        email="dev@metele.local",
        name="Dev User",
        picture=None,
    )
    with Session(db_engine) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def test_dev_login_returns_token_and_user(client, settings, dev_user) -> None:
    res = client.post("/auth/dev-login")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token"] == settings.dev_user_token
    assert body["user"]["id"] == settings.dev_user_id
    assert body["user"]["customPresets"] == []


def test_dev_login_503_when_not_seeded(client, settings) -> None:
    res = client.post("/auth/dev-login")
    assert res.status_code == 503


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
        res = c.post("/auth/dev-login")
        assert res.status_code == 404


def test_dev_token_authenticates_protected_endpoint(client, settings, dev_user) -> None:
    res = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {settings.dev_user_token}"},
    )
    assert res.status_code == 200
    assert res.json()["id"] == settings.dev_user_id


def test_dev_token_works_for_preset_crud(client, settings, dev_user) -> None:
    """Smoke test that the bypass plays nicely with the preset endpoints."""
    headers = {"Authorization": f"Bearer {settings.dev_user_token}"}
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


def test_unknown_token_with_dev_enabled_falls_through_to_jwks_401(
    client, settings, dev_user
) -> None:
    """Dev bypass must only fire on the exact configured string. Anything
    else still hits the Auth0 path — which is unconfigured here, so it
    raises a 401."""
    res = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer not-the-dev-token"},
    )
    assert res.status_code == 401


def test_dev_token_rejected_when_dev_disabled(db_engine) -> None:
    """Even with the right string, the bypass must not fire when disabled."""
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
    user = User(id="dev", email=None, name="Dev User")
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
            headers={"Authorization": "Bearer dev-test-token"},
        )
        assert res.status_code == 401

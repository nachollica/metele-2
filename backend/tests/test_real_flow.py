"""Tests for the real OAuth flow with the providers' HTTP calls mocked.

We don't talk to Google/Facebook/Instagram for real — `respx` intercepts the
token + userinfo calls and replays canned responses. This proves the route
plumbing (redirect URLs, state validation, profile mapping) works.
"""

from __future__ import annotations

import base64
import json
from urllib.parse import parse_qs, urlparse

import httpx
import respx

from app.providers import facebook as fb_provider
from app.providers import google as g_provider
from app.providers import instagram as ig_provider


def _state_from_login_redirect(redirect_url: str) -> str:
    qs = parse_qs(urlparse(redirect_url).query)
    return qs["state"][0]


def _frag(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).fragment).items()}


# ---- Google -------------------------------------------------------------


def test_google_login_redirects_to_consent(client, settings):
    res = client.get(
        "/auth/google/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    assert res.status_code == 303
    target = res.headers["location"]
    assert target.startswith(g_provider.AUTHORIZE_URL)
    qs = parse_qs(urlparse(target).query)
    assert qs["client_id"] == ["google-id"]
    assert qs["redirect_uri"] == [f"{settings.backend_origin}/auth/google/callback"]
    assert "state" in qs


@respx.mock
def test_google_callback_full_exchange(client, settings):
    login = client.get(
        "/auth/google/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    state = _state_from_login_redirect(login.headers["location"])

    respx.post(g_provider.TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "fake-google-token"})
    )
    respx.get(g_provider.USERINFO_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "sub": "google-uid-123",
                "name": "Ada Lovelace",
                "email": "ada@example.com",
                "picture": "https://img.example/ada.png",
            },
        )
    )

    res = client.get(
        "/auth/google/callback",
        params={"code": "real-code", "state": state},
    )
    assert res.status_code == 303
    target = res.headers["location"]
    frag = _frag(target)
    user = json.loads(base64.urlsafe_b64decode(frag["user"] + "=="))
    assert user["provider"] == "google"
    assert user["id"] == "google:google-uid-123"
    assert user["email"] == "ada@example.com"
    assert user["name"] == "Ada Lovelace"


# ---- Instagram ----------------------------------------------------------


@respx.mock
def test_instagram_callback_full_exchange(client, settings):
    login = client.get(
        "/auth/instagram/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    state = _state_from_login_redirect(login.headers["location"])

    respx.post(ig_provider.TOKEN_URL).mock(
        return_value=httpx.Response(
            200, json={"access_token": "fake-ig-token", "user_id": 999}
        )
    )
    respx.get(ig_provider.USERINFO_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "999",
                "username": "ada_writes",
                "account_type": "PERSONAL",
            },
        )
    )

    res = client.get(
        "/auth/instagram/callback",
        params={"code": "real-code", "state": state},
    )
    assert res.status_code == 303
    user = json.loads(
        base64.urlsafe_b64decode(_frag(res.headers["location"])["user"] + "==")
    )
    assert user["provider"] == "instagram"
    assert user["name"] == "ada_writes"
    assert user["email"] is None
    assert user["id"] == "instagram:999"


# ---- Facebook -----------------------------------------------------------


@respx.mock
def test_facebook_callback_full_exchange(client, settings):
    login = client.get(
        "/auth/facebook/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    state = _state_from_login_redirect(login.headers["location"])

    respx.get(fb_provider.TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "fake-fb-token"})
    )
    respx.get(fb_provider.USERINFO_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "fb-42",
                "name": "Ada FB",
                "email": "ada@fb.example",
                "picture": {"data": {"url": "https://img.example/ada-fb.png"}},
            },
        )
    )

    res = client.get(
        "/auth/facebook/callback",
        params={"code": "real-code", "state": state},
    )
    assert res.status_code == 303
    user = json.loads(
        base64.urlsafe_b64decode(_frag(res.headers["location"])["user"] + "==")
    )
    assert user["provider"] == "facebook"
    assert user["id"] == "facebook:fb-42"
    assert user["avatarUrl"] == "https://img.example/ada-fb.png"


# ---- State / error handling --------------------------------------------


def test_callback_rejects_tampered_state(client):
    res = client.get(
        "/auth/google/callback",
        params={"code": "x", "state": "not-a-jwt"},
    )
    assert res.status_code == 400


def test_callback_redirects_with_error_when_provider_returns_error(client, settings):
    login = client.get(
        "/auth/google/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    state = _state_from_login_redirect(login.headers["location"])

    res = client.get(
        "/auth/google/callback",
        params={"state": state, "error": "access_denied"},
    )
    assert res.status_code == 303
    target = res.headers["location"]
    qs = parse_qs(urlparse(target).query)
    assert qs["error"] == ["access_denied"]


def test_login_returns_503_when_provider_unconfigured():
    """A separate app instance with no provider creds — the real login
    should refuse with 503 while the mock variant still works."""
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.settings import Settings, get_settings
    from app.users import get_store

    app = create_app()
    bare = Settings(
        frontend_origin="http://localhost:3000",
        backend_origin="http://localhost:8000",
        jwt_secret="test-secret-test-secret-test-secret-32+",
    )
    app.dependency_overrides[get_settings] = lambda: bare
    get_store().clear()

    with TestClient(app, follow_redirects=False) as c:
        real = c.get(
            "/auth/google/login",
            params={"return_to": "http://localhost:3000/en/auth/callback"},
        )
        assert real.status_code == 503
        mock = c.get(
            "/auth/mock/google/login",
            params={"return_to": "http://localhost:3000/en/auth/callback"},
        )
        assert mock.status_code == 303

    get_store().clear()


# ---- Provider mismatch --------------------------------------------------


def test_state_provider_must_match_path(client, settings):
    login = client.get(
        "/auth/google/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    state = _state_from_login_redirect(login.headers["location"])

    # Reuse a Google state on the Facebook callback path.
    res = client.get(
        "/auth/facebook/callback",
        params={"code": "x", "state": state},
    )
    assert res.status_code == 400

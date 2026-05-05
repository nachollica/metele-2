"""End-to-end-ish tests for the mocked OAuth flow.

We hit `/auth/mock/{provider}/login`, follow the redirect into the shared
callback handler, and assert the final redirect carries a session token + a
serialized user blob in the URL fragment — the same shape the frontend
callback page consumes.
"""

from __future__ import annotations

import base64
import json
from urllib.parse import parse_qs, urlparse

import jwt
import pytest

PROVIDERS = ["google", "instagram", "facebook"]


def _follow_login(client, provider: str, return_to: str):
    login = client.get(
        f"/auth/mock/{provider}/login", params={"return_to": return_to}
    )
    assert login.status_code == 303, login.text
    callback_url = login.headers["location"]
    # The mock login redirects to the shared callback (relative URL is fine
    # because TestClient resolves against the app base).
    parsed = urlparse(callback_url)
    callback_path = parsed.path
    callback_qs = parse_qs(parsed.query)
    callback = client.get(
        callback_path,
        params={k: v[0] for k, v in callback_qs.items()},
    )
    assert callback.status_code == 303, callback.text
    return callback.headers["location"]


def _parse_fragment(url: str) -> dict[str, str]:
    fragment = urlparse(url).fragment
    return {k: v[0] for k, v in parse_qs(fragment).items()}


@pytest.mark.parametrize("provider", PROVIDERS)
def test_mock_login_round_trip(client, settings, provider):
    return_to = f"{settings.frontend_origin}/en/auth/callback"
    final = _follow_login(client, provider, return_to)

    assert final.startswith(return_to + "#"), final
    frag = _parse_fragment(final)

    assert "token" in frag
    assert "user" in frag

    decoded = jwt.decode(
        frag["token"], settings.jwt_secret, algorithms=["HS256"]
    )
    assert decoded["sub"].startswith(f"{provider}:")
    assert decoded["provider"] == provider

    raw = base64.urlsafe_b64decode(frag["user"] + "==")
    user_payload = json.loads(raw)
    assert user_payload["provider"] == provider
    assert user_payload["id"] == decoded["sub"]
    assert user_payload["name"]


def test_me_returns_session_user(client, settings):
    return_to = f"{settings.frontend_origin}/en/auth/callback"
    final = _follow_login(client, "google", return_to)
    frag = _parse_fragment(final)
    token = frag["token"]

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "google"
    assert body["email"] == "mock@example.com"
    # Verify alias is honored: avatar_url -> avatarUrl on the wire.
    assert "avatarUrl" in body


def test_me_rejects_missing_token(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_me_rejects_bogus_token(client):
    res = client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401


def test_logout_returns_204(client, settings):
    return_to = f"{settings.frontend_origin}/en/auth/callback"
    final = _follow_login(client, "google", return_to)
    token = _parse_fragment(final)["token"]

    res = client.post(
        "/auth/logout", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 204


def test_return_to_must_be_allowlisted(client):
    res = client.get(
        "/auth/mock/google/login",
        params={"return_to": "https://evil.example.com/cb"},
    )
    assert res.status_code == 400


def test_unknown_provider_404(client, settings):
    res = client.get(
        "/auth/mock/twitter/login",
        params={"return_to": f"{settings.frontend_origin}/en/auth/callback"},
    )
    assert res.status_code == 404

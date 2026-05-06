"""End-to-end tests for the Auth0 token verification path.

We generate a throwaway RSA key pair, stub the JWKS client to return its
public key, and sign tokens with claims that match our test settings.
``/userinfo`` is intercepted with respx so no network hits Auth0.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
import respx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import app.auth as auth_module


@pytest.fixture
def rsa_keys() -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


@pytest.fixture
def stub_jwks(monkeypatch, rsa_keys) -> None:
    """Replace the JWKS client lookup with a stub that returns our public key."""
    _, public_pem = rsa_keys

    class _StubKey:
        key = public_pem

    class _StubClient:
        def get_signing_key_from_jwt(self, _token: str) -> _StubKey:
            return _StubKey()

    monkeypatch.setattr(auth_module, "_jwk_client_for", lambda _settings: _StubClient())


def _make_token(
    private_pem: bytes,
    *,
    settings,
    sub: str = "auth0|test-1",
    aud: str | None = None,
    iss: str | None = None,
    exp_offset_seconds: int = 3600,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": iss or settings.auth0_issuer,
        "aud": aud or settings.auth0_audience,
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=exp_offset_seconds)).timestamp()),
    }
    return jwt.encode(payload, private_pem, algorithm="RS256")


# ---- Bearer-token presence ------------------------------------------------


def test_me_requires_bearer(client) -> None:
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_me_rejects_non_bearer_scheme(client) -> None:
    res = client.get("/auth/me", headers={"Authorization": "Basic abc"})
    assert res.status_code == 401


# ---- JWKS verification ----------------------------------------------------


@respx.mock
def test_me_validates_token_and_upserts_user(client, settings, rsa_keys, stub_jwks) -> None:
    private_pem, _ = rsa_keys
    token = _make_token(private_pem, settings=settings, sub="auth0|new-user")

    respx.get(settings.auth0_userinfo_url).mock(
        return_value=httpx.Response(
            200,
            json={
                "sub": "auth0|new-user",
                "email": "new@example.com",
                "name": "New User",
                "picture": "https://img.example/n.png",
            },
        )
    )

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == "auth0|new-user"
    assert body["email"] == "new@example.com"
    assert body["name"] == "New User"
    assert body["avatarUrl"] == "https://img.example/n.png"


@respx.mock
def test_me_does_not_refetch_userinfo_for_known_user(
    client, settings, rsa_keys, stub_jwks
) -> None:
    private_pem, _ = rsa_keys
    token = _make_token(private_pem, settings=settings, sub="auth0|cached")

    route = respx.get(settings.auth0_userinfo_url).mock(
        return_value=httpx.Response(
            200,
            json={"sub": "auth0|cached", "name": "Cached User"},
        )
    )

    first = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    second = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert first.status_code == 200
    assert second.status_code == 200
    assert route.call_count == 1, "second call should hit DB cache, not Auth0"


def test_me_rejects_token_with_wrong_audience(client, settings, rsa_keys, stub_jwks) -> None:
    private_pem, _ = rsa_keys
    token = _make_token(
        private_pem,
        settings=settings,
        aud="https://wrong-audience",
    )
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_me_rejects_token_with_wrong_issuer(client, settings, rsa_keys, stub_jwks) -> None:
    private_pem, _ = rsa_keys
    token = _make_token(
        private_pem,
        settings=settings,
        iss="https://attacker.example.com/",
    )
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_me_rejects_expired_token(client, settings, rsa_keys, stub_jwks) -> None:
    private_pem, _ = rsa_keys
    token = _make_token(
        private_pem,
        settings=settings,
        exp_offset_seconds=-60,
    )
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


# ---- Profile PATCH --------------------------------------------------------


def test_patch_me_requires_auth(client) -> None:
    res = client.patch("/auth/me", json={"name": "Whatever"})
    assert res.status_code == 401


def test_patch_me_updates_provided_fields(auth_client, test_user) -> None:
    res = auth_client.patch(
        "/auth/me",
        json={"name": "Renamed", "email": "renamed@example.com"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Renamed"
    assert body["email"] == "renamed@example.com"
    # Picture wasn't in the payload — leave it untouched.
    assert body["avatarUrl"] == test_user.picture


def test_patch_me_leaves_omitted_fields_untouched(auth_client, test_user) -> None:
    original_email = test_user.email
    res = auth_client.patch("/auth/me", json={"name": "Just Name"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Just Name"
    assert body["email"] == original_email


def test_patch_me_can_clear_email(auth_client) -> None:
    res = auth_client.patch("/auth/me", json={"email": None})
    assert res.status_code == 200
    assert res.json()["email"] is None


def test_patch_me_accepts_data_url_picture(auth_client) -> None:
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    res = auth_client.patch("/auth/me", json={"picture": data_url})
    assert res.status_code == 200
    assert res.json()["avatarUrl"] == data_url


def test_patch_me_rejects_unknown_fields(auth_client) -> None:
    res = auth_client.patch("/auth/me", json={"id": "spoofed"})
    assert res.status_code == 422


def test_patch_me_rejects_blank_name(auth_client) -> None:
    res = auth_client.patch("/auth/me", json={"name": ""})
    assert res.status_code == 422


def test_me_returns_503_when_misconfigured(client, db_engine) -> None:
    """Backend without AUTH0_DOMAIN/AUDIENCE should refuse requests with 503
    so a misdeploy is loud rather than silent."""
    from fastapi.testclient import TestClient
    from sqlmodel import Session

    from app.db import get_db
    from app.main import create_app
    from app.settings import Settings, get_settings

    bare = Settings(frontend_origin="http://localhost:3000")
    app = create_app()

    def _get_db_override():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: bare
    app.dependency_overrides[get_db] = _get_db_override

    with TestClient(app, follow_redirects=False) as c:
        res = c.get("/auth/me", headers={"Authorization": "Bearer x"})
        assert res.status_code == 503

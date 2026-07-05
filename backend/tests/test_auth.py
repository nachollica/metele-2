"""
End-to-end tests for the Auth0 token verification path.

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
from app.auth import extract_primary_email


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
def test_me_does_not_refetch_userinfo_for_known_user(client, settings, rsa_keys, stub_jwks) -> None:
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


@respx.mock
def test_me_creates_user_without_email_when_provider_omits_it(
    client, settings, rsa_keys, stub_jwks
) -> None:
    """
    Some social connections (older Twitter, custom OIDC) do not return an
    email. The upsert must still succeed — email is optional.
    """
    private_pem, _ = rsa_keys
    token = _make_token(private_pem, settings=settings, sub="twitter|noemail")
    respx.get(settings.auth0_userinfo_url).mock(
        return_value=httpx.Response(
            200,
            json={"sub": "twitter|noemail", "name": "Anon"},
        )
    )

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] is None
    assert body["name"] == "Anon"


@respx.mock
def test_me_picks_first_email_when_userinfo_returns_an_array(
    client, settings, rsa_keys, stub_jwks
) -> None:
    """
    Auth0 normally normalises to a single ``email`` claim; this guards
    the fallback path for providers / custom Actions that hand back a list.
    The implementation must pick the first usable entry.
    """
    private_pem, _ = rsa_keys
    token = _make_token(private_pem, settings=settings, sub="oidc|emails-array")
    respx.get(settings.auth0_userinfo_url).mock(
        return_value=httpx.Response(
            200,
            json={
                "sub": "oidc|emails-array",
                "emails": [
                    {"value": "primary@example.com", "type": "work"},
                    {"value": "secondary@example.com"},
                ],
                "name": "Array Email",
            },
        )
    )

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    assert res.json()["email"] == "primary@example.com"


@respx.mock
def test_me_survives_concurrent_first_insert(
    settings, db_engine, rsa_keys, stub_jwks, monkeypatch
) -> None:
    """
    Two requests for a brand-new ``sub`` can both clear the existence check
    before either commits (this is what the old /auth/me polling loop did to
    itself on first sign-in). The loser's INSERT collides on the primary key;
    get_current_user must swallow that, roll back, and return the row the
    winner committed instead of surfacing a 500 IntegrityError.
    """
    from sqlmodel import Session

    from app.db_models import User
    from app.dependencies import get_current_user

    private_pem, _ = rsa_keys
    sub = "google-oauth2|race"
    token = _make_token(private_pem, settings=settings, sub=sub)

    respx.get(settings.auth0_userinfo_url).mock(
        return_value=httpx.Response(
            200, json={"sub": sub, "name": "Loser View", "email": "loser@example.com"}
        )
    )

    with Session(db_engine) as session:
        # The winning concurrent request already committed this row.
        session.add(User(id=sub, email="winner@example.com", name="Winner"))
        session.commit()

        # Force only the FIRST existence check to miss, so we take the create
        # branch and collide on commit — the exact production ordering.
        real_get = session.get
        state = {"first": True}

        def flaky_get(entity, ident, *args, **kwargs):
            if state["first"] and entity is User and ident == sub:
                state["first"] = False
                return None
            return real_get(entity, ident, *args, **kwargs)

        monkeypatch.setattr(session, "get", flaky_get)

        user = get_current_user(settings=settings, db=session, authorization=f"Bearer {token}")

    assert user.id == sub
    # We get back the committed row, not our rolled-back losing INSERT.
    assert user.name == "Winner"
    assert user.email == "winner@example.com"


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


def test_me_rejects_token_without_sub_claim(client, settings, rsa_keys, stub_jwks) -> None:
    """
    A token that validates (signature/aud/iss/exp) but carries no ``sub`` has
    no stable identity to key the User row on — reject it with 401 rather than
    inventing one.
    """
    private_pem, _ = rsa_keys
    now = datetime.now(timezone.utc)
    payload = {
        "iss": settings.auth0_issuer,
        "aud": settings.auth0_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=3600)).timestamp()),
        # deliberately no "sub"
    }
    token = jwt.encode(payload, private_pem, algorithm="RS256")
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


# ---- extract_primary_email ------------------------------------------------


def test_extract_primary_email_from_direct_string() -> None:
    assert extract_primary_email({"email": "alice@example.com"}) == "alice@example.com"


def test_extract_primary_email_strips_whitespace() -> None:
    assert extract_primary_email({"email": "  alice@example.com  "}) == "alice@example.com"


def test_extract_primary_email_falls_back_to_emails_list_of_strings() -> None:
    assert (
        extract_primary_email({"emails": ["alice@example.com", "bob@example.com"]})
        == "alice@example.com"
    )


def test_extract_primary_email_falls_back_to_emails_list_of_dicts() -> None:
    assert (
        extract_primary_email({"emails": [{"value": "alice@example.com", "type": "home"}]})
        == "alice@example.com"
    )


def test_extract_primary_email_returns_none_when_missing() -> None:
    assert extract_primary_email({"sub": "twitter|abc"}) is None


def test_extract_primary_email_skips_empty_entries_in_array() -> None:
    assert (
        extract_primary_email({"emails": ["", {"value": ""}, {"value": "alice@example.com"}]})
        == "alice@example.com"
    )


# ---- Profile PATCH --------------------------------------------------------


def test_patch_me_requires_auth(client) -> None:
    res = client.patch("/profile/me", json={"name": "Whatever"})
    assert res.status_code == 401


def test_patch_me_updates_provided_fields(auth_client, test_user, settings, monkeypatch) -> None:
    # Keep the validation step syntactic-only so the test doesn't hit DNS.
    monkeypatch.setattr(settings, "email_validation_check_deliverability", False)
    res = auth_client.patch(
        "/profile/me",
        json={"name": "Renamed", "email": "renamed@example.com"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Renamed"
    assert body["email"] == "renamed@example.com"
    # Picture wasn't in the payload — leave it untouched.
    assert body["avatarUrl"] == test_user.picture


def test_patch_me_rejects_malformed_email(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"email": "not-an-email"})
    assert res.status_code == 422


def test_patch_me_rejects_disposable_email(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"email": "burner@mailinator.com"})
    assert res.status_code == 422
    assert "disposable" in res.json()["detail"].lower()


def test_patch_me_leaves_omitted_fields_untouched(auth_client, test_user) -> None:
    original_email = test_user.email
    res = auth_client.patch("/profile/me", json={"name": "Just Name"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Just Name"
    assert body["email"] == original_email


def test_patch_me_can_clear_email(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"email": None})
    assert res.status_code == 200
    assert res.json()["email"] is None


def test_patch_me_accepts_data_url_picture(auth_client) -> None:
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    res = auth_client.patch("/profile/me", json={"picture": data_url})
    assert res.status_code == 200
    assert res.json()["avatarUrl"] == data_url


def test_patch_me_rejects_non_image_picture(auth_client) -> None:
    # Only ``data:image/…`` and http(s) URLs are storable — reject free-form
    # strings and non-image data: URLs before they land in the DB.
    for bad in ("javascript:alert(1)", "data:text/html;base64,AAAA", "not a url"):
        res = auth_client.patch("/profile/me", json={"picture": bad})
        assert res.status_code == 422, bad


def test_patch_me_can_clear_picture(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"picture": None})
    assert res.status_code == 200
    assert res.json()["avatarUrl"] is None


def test_patch_me_rejects_unknown_fields(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"id": "spoofed"})
    assert res.status_code == 422


def test_patch_me_rejects_blank_name(auth_client) -> None:
    res = auth_client.patch("/profile/me", json={"name": ""})
    assert res.status_code == 422


def test_me_returns_503_when_misconfigured(client_factory) -> None:
    """
    Backend without AUTH0_DOMAIN/AUDIENCE should refuse requests with 503
    so a misdeploy is loud rather than silent. Production refuses to boot
    in this state at all; this guards the testing/local fallback.
    """
    from app.settings import Settings

    # Auth0 creds come from the (empty) test environment, so this Settings has
    # no domain/audience — the exact misconfiguration we want to surface.
    bare = Settings(  # type: ignore[call-arg]
        environment="testing",
        frontend_origin="http://localhost:3000",
    )
    c = client_factory(bare)
    res = c.get("/auth/me", headers={"Authorization": "Bearer x"})
    assert res.status_code == 503

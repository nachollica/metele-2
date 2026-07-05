"""
Auth0 token + profile logic (no FastAPI wiring).

Validates RS256 access tokens against the tenant's JWKS, verifies the
``iss``/``aud``/``exp`` claims, and pulls the user's social profile from
Auth0's ``/userinfo`` endpoint. The FastAPI dependency that turns a request
into a ``User`` row lives in :mod:`app.dependencies`; this module stays a
plain, framework-free library so it's easy to test and reuse.

Email/password is intentionally not supported — only social logins go
through Auth0, and the only non-Auth0 path is the dev-user backdoor (see
``settings.dev_user_enabled``), which mints opaque ``<token>:<username>``
strings against pre-seeded ``User`` rows.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict, cast

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

if TYPE_CHECKING:
    from app.settings import Settings

JWT_ALGORITHM = "RS256"

# Module-level JWKS client cache. PyJWKClient itself caches keys; we just
# avoid re-resolving the JWKS URL on every request.
_jwk_clients: dict[str, PyJWKClient] = {}


class AccessTokenClaims(TypedDict, total=False):
    """
    Subset of the standard JWT/OIDC claims on an Auth0 access token.

    ``total=False`` because tenants add custom claims and providers vary; we
    only ever read ``sub``, but the rest document the shape we trust.
    """

    iss: str
    sub: str
    aud: str | list[str]
    exp: int
    iat: int
    azp: str
    scope: str


class Auth0UserInfo(TypedDict, total=False):
    """
    Standard OIDC ``/userinfo`` claims we read off an Auth0 profile.

    ``total=False`` since social providers omit fields (e.g. no ``email``) and
    some hand back a non-standard ``emails`` list — see
    :func:`extract_primary_email`.
    """

    sub: str
    name: str
    nickname: str
    picture: str
    email: str
    email_verified: bool
    emails: list[object]


def _jwk_client_for(settings: Settings) -> PyJWKClient:
    url = settings.auth0_jwks_url
    client = _jwk_clients.get(url)
    if client is None:
        client = PyJWKClient(url, cache_keys=True, lifespan=3600)
        _jwk_clients[url] = client
    return client


def verify_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    """Validate a Bearer token. Returns the decoded claims on success."""
    if not settings.auth0_domain or not settings.auth0_audience:
        # Misconfigured backend — surface as a 503 so it's obvious in dev.
        # In production the settings validator refuses to boot at all, so
        # this branch is only reachable in local/development/testing where
        # the operator hasn't wired Auth0 yet.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth0 is not configured (set AUTH0_DOMAIN/AUDIENCE).",
        )
    try:
        signing_key = _jwk_client_for(settings).get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=[JWT_ALGORITHM],
            audience=settings.auth0_audience,
            issuer=settings.auth0_issuer,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc
    return cast("AccessTokenClaims", claims)


def fetch_userinfo(access_token: str, settings: Settings) -> Auth0UserInfo:
    """Pull the user's profile from Auth0's ``/userinfo`` endpoint."""
    try:
        with httpx.Client(timeout=5.0) as http:
            res = http.get(
                settings.auth0_userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Auth0 userinfo unreachable: {exc}",
        ) from exc
    if res.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Auth0 userinfo failed ({res.status_code}).",
        )
    return cast("Auth0UserInfo", res.json())


def extract_primary_email(info: Auth0UserInfo) -> str | None:
    """
    Pick the best email candidate from an Auth0 ``/userinfo`` payload.

    Auth0 normalises to a single ``email`` claim for most social connections,
    but some providers (older Facebook responses, custom rules, federated
    OIDC providers) hand back an ``emails`` list — either ``[str, ...]`` or
    ``[{"value": str, ...}, ...]``. We accept all three shapes and return the
    first non-empty entry. Returns ``None`` when nothing usable is present,
    which is fine: account creation succeeds without an email.
    """
    direct = info.get("email")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    raw = info.get("emails")
    if isinstance(raw, list):
        for entry in raw:
            if isinstance(entry, str) and entry.strip():
                return entry.strip()
            if isinstance(entry, dict):
                value = entry.get("value") or entry.get("email")
                if isinstance(value, str) and value.strip():
                    return value.strip()
    return None


def extract_token(authorization: str | None) -> str:
    """Pull the bare token out of an ``Authorization: Bearer <token>`` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    return authorization.split(" ", 1)[1].strip()

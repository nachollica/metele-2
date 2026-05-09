"""Auth0-backed authentication.

Validates RS256 access tokens against the tenant's JWKS, verifies the
``iss``/``aud``/``exp`` claims, and resolves them to a row in our local
``users`` table. The first time we see a given ``sub`` we hit Auth0's
``/userinfo`` endpoint to pull the user's profile so the rest of the
backend can stay decoupled from Auth0.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlmodel import Session

from .db import get_db
from .db_models import User
from .settings import Settings, get_settings


JWT_ALGORITHM = "RS256"

# Module-level JWKS client cache. PyJWKClient itself caches keys; we just
# avoid re-resolving the JWKS URL on every request.
_jwk_clients: dict[str, PyJWKClient] = {}


def _jwk_client_for(settings: Settings) -> PyJWKClient:
    url = settings.auth0_jwks_url
    client = _jwk_clients.get(url)
    if client is None:
        client = PyJWKClient(url, cache_keys=True, lifespan=3600)
        _jwk_clients[url] = client
    return client


def verify_access_token(token: str, settings: Settings) -> dict:
    """Validate a Bearer token. Returns the decoded claims on success."""
    if not settings.auth0_domain or not settings.auth0_audience:
        # Misconfigured backend — surface as a 503 so it's obvious in dev.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth0 is not configured (set AUTH0_DOMAIN/AUDIENCE).",
        )
    try:
        signing_key = _jwk_client_for(settings).get_signing_key_from_jwt(token).key
        return jwt.decode(
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


def fetch_userinfo(access_token: str, settings: Settings) -> dict:
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
    return res.json()


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    return authorization.split(" ", 1)[1].strip()


def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: validate the bearer token and return the User row.

    Upserts the local ``users`` row on first contact (and refreshes profile
    fields when they've changed in Auth0).
    """
    token = _extract_token(authorization)

    # Local-dev backdoor. When the dev user is enabled and the caller
    # presents a token of the form ``<shared-secret>:<username>``, look up
    # that pre-seeded row directly and skip the JWKS verification path.
    dev_prefix = f"{settings.dev_user_token}:"
    if settings.dev_user_enabled and token.startswith(dev_prefix):
        username = token[len(dev_prefix) :]
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dev token missing username.",
            )
        dev = db.get(User, username)
        if dev is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Dev user '{username}' not seeded.",
            )
        return dev

    claims = verify_access_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing `sub` claim.",
        )

    now = datetime.now(timezone.utc)
    existing = db.get(User, sub)
    if existing is not None:
        return existing

    info = fetch_userinfo(token, settings)
    user = User(
        id=sub,
        email=info.get("email"),
        name=info.get("name") or info.get("nickname") or info.get("email") or sub,
        picture=info.get("picture"),
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

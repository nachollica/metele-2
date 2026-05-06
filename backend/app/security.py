"""JWT issuance/verification + signed OAuth `state` helpers.

We use HS256 with the shared `jwt_secret`. For the OAuth state we lean on
PyJWT too rather than rolling another HMAC scheme — it gives us tamper
detection and a built-in `exp` claim for free.
"""

from __future__ import annotations

import time
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status

from .models import AuthUser, ProviderId
from .settings import Settings, get_settings
from .users import UserStore, get_store


JWT_ALGORITHM = "HS256"
STATE_TTL_SECONDS = 600  # 10 minutes — plenty for the user to complete OAuth.


# ---- Session JWTs --------------------------------------------------------


def issue_session_token(user: AuthUser, settings: Settings) -> str:
    now = int(time.time())
    payload = {
        "sub": user.id,
        "provider": user.provider,
        "iat": now,
        "exp": now + settings.jwt_ttl_seconds,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:  # InvalidSignature, ExpiredSignature, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        ) from exc


def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    store: UserStore = Depends(get_store),
) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_session_token(token, settings)

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token.",
        )

    user = store.get(user_id)
    if user is None:
        # The token is valid but our in-memory store no longer knows the user
        # (e.g. process restart). Treat as unauthenticated so the frontend
        # forces a fresh sign-in.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session no longer exists.",
        )
    return user


# ---- OAuth `state` parameter ---------------------------------------------


def issue_oauth_state(
    *,
    provider: ProviderId,
    return_to: str,
    mock: bool,
    settings: Settings,
) -> str:
    now = int(time.time())
    payload = {
        "provider": provider,
        "return_to": return_to,
        "mock": mock,
        "iat": now,
        "exp": now + STATE_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_oauth_state(state: str, settings: Settings) -> dict[str, Any]:
    try:
        return jwt.decode(state, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state.",
        ) from exc

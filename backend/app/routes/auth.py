"""
Auth endpoints.

This router only handles authentication concerns:

- ``GET /auth/me`` — return the caller resolved from their bearer token.
- ``POST /auth/dev-login`` — local-dev backdoor for tests + manual QA.

Real account creation happens entirely through Auth0's hosted social-login
flow (handled in the SPA). The backend only validates the Auth0-issued
access tokens against the tenant's JWKS — see :mod:`app.auth`.

Profile editing and per-user preset CRUD live in :mod:`app.routes.profile`
under ``/profile``. Splitting them keeps this module narrowly about token
identity and lets the profile module evolve freely (e.g. add avatars, social
links) without bloating the auth surface.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db_models import User
from app.dependencies import CurrentUser, DbSession, SettingsDep
from app.models import AuthUser

router = APIRouter(prefix="/auth", tags=["auth"])


class DevLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)

    model_config = {"extra": "forbid"}


class DevLoginResponse(BaseModel):
    """
    Token issued by the dev-user backdoor. The frontend treats it like an
    Auth0 access token (carries it as a Bearer header for every API call) even
    though server-side it's a shared-secret prefix plus username, not a JWT.
    """

    token: str
    user: AuthUser


@router.post(
    "/dev-login",
    response_model=DevLoginResponse,
    summary=("Issue a dev-user token for the requested username. Disabled in production."),
)
def dev_login(
    payload: DevLoginRequest,
    settings: SettingsDep,
    db: DbSession,
) -> DevLoginResponse:
    """
    Look up the pre-seeded dev user row and mint a backdoor token.

    The dev backdoor only authenticates usernames that were created out-of-band
    (typically via ``python -m app.scripts.seed_dev_user <username>``); it
    cannot create new accounts. Production refuses to enable this feature at
    all — see ``Settings._enforce_environment_invariants``.
    """
    if not settings.dev_user_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev login is disabled.",
        )
    user = db.get(User, payload.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Dev user '{payload.username}' does not exist.",
        )
    return DevLoginResponse(
        token=f"{settings.dev_user_token}:{user.id}",
        user=AuthUser.from_user(user),
    )


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUser) -> AuthUser:
    return AuthUser.from_user(user)

"""OAuth + session endpoints.

Two parallel `/auth/{provider}/login` flows:

- Real: redirect the user to the provider's consent screen with our signed
  `state` payload. After consent, the provider sends them to
  `/auth/{provider}/callback`, where we exchange the code for a profile and
  redirect back to the frontend with a freshly minted session token.

- Mock (`/auth/mock/{provider}/login`): skip the provider entirely. We mint a
  state payload flagged `mock=True` and redirect straight to the shared
  callback handler with a synthetic `code`. The handler sees the flag and
  generates a deterministic profile instead of doing an HTTP exchange. This
  lets the entire frontend flow (button click → callback → session token) be
  exercised without provider credentials.
"""

from __future__ import annotations

import base64
import json
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse, Response

from ..models import AuthUser, ProviderId
from ..providers import (
    ProviderConfigError,
    ProviderError,
    ProviderProfile,
    get_provider,
)
from ..security import (
    decode_oauth_state,
    get_current_user,
    issue_oauth_state,
    issue_session_token,
)
from ..settings import Settings, get_settings
from ..users import UserStore, get_store


router = APIRouter(prefix="/auth", tags=["auth"])

VALID_PROVIDERS: tuple[ProviderId, ...] = ("google", "instagram", "facebook")


# ---- Helpers -------------------------------------------------------------


def _validate_provider(provider: str) -> ProviderId:
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider '{provider}'.",
        )
    return provider  # type: ignore[return-value]


def _build_redirect_uri(settings: Settings, provider: ProviderId) -> str:
    """Backend-side URL the OAuth provider redirects back to after consent."""
    return f"{settings.backend_origin.rstrip('/')}/auth/{provider}/callback"


def _validate_return_to(return_to: str, settings: Settings) -> str:
    """Block open-redirect abuse: only allow `return_to` URLs whose origin
    matches the configured frontend origin (or the backend, for tests)."""
    parsed = urlparse(return_to)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`return_to` must be an absolute URL.",
        )
    allowed = {settings.frontend_origin.rstrip("/"), settings.backend_origin.rstrip("/")}
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`return_to` origin is not allow-listed.",
        )
    return return_to


def _encode_user_for_fragment(user: AuthUser) -> str:
    """Serialize the user as base64url-encoded JSON so it can ride safely in a
    URL fragment back to the frontend callback page."""
    payload = user.model_dump(by_alias=True)
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _redirect_back_with_session(
    *,
    return_to: str,
    user: AuthUser,
    token: str,
) -> RedirectResponse:
    user_blob = _encode_user_for_fragment(user)
    target = f"{return_to}#token={token}&user={user_blob}"
    # 303 forces the browser to GET the frontend callback even if the chain
    # included a POST somewhere — safer default than 302.
    return RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)


def _redirect_back_with_error(*, return_to: str, error: str) -> RedirectResponse:
    sep = "&" if "?" in return_to else "?"
    return RedirectResponse(
        f"{return_to}{sep}{urlencode({'error': error})}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


def _mock_profile(provider: ProviderId) -> ProviderProfile:
    """Stable mock identity per provider so the upsert always lands on the
    same user row. Exposed as a function (rather than a constant) so tests can
    monkeypatch if they need varied identities."""
    catalog = {
        "google": ProviderProfile(
            provider_user_id="mock-google-1",
            name="Mock Googler",
            email="mock@example.com",
            avatar_url=None,
        ),
        "instagram": ProviderProfile(
            provider_user_id="mock-instagram-1",
            name="mock_grammer",
            email=None,
            avatar_url=None,
        ),
        "facebook": ProviderProfile(
            provider_user_id="mock-facebook-1",
            name="Mock Facebooker",
            email="mock-fb@example.com",
            avatar_url=None,
        ),
    }
    return catalog[provider]


# ---- Login (real) --------------------------------------------------------


@router.get("/{provider}/login")
def provider_login(
    provider: str,
    return_to: str = Query(...),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    pid = _validate_provider(provider)
    return_to = _validate_return_to(return_to, settings)

    try:
        impl = get_provider(pid, settings)
    except ProviderConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    state = issue_oauth_state(
        provider=pid, return_to=return_to, mock=False, settings=settings
    )
    redirect_uri = _build_redirect_uri(settings, pid)
    target = impl.authorize_url(state=state, redirect_uri=redirect_uri)
    return RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)


# ---- Login (mock) --------------------------------------------------------


@router.get("/mock/{provider}/login")
def provider_login_mock(
    provider: str,
    return_to: str = Query(...),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    pid = _validate_provider(provider)
    return_to = _validate_return_to(return_to, settings)

    state = issue_oauth_state(
        provider=pid, return_to=return_to, mock=True, settings=settings
    )
    callback = (
        f"{settings.backend_origin.rstrip('/')}/auth/{pid}/callback"
        f"?{urlencode({'code': f'mock-code-{pid}', 'state': state})}"
    )
    return RedirectResponse(callback, status_code=status.HTTP_303_SEE_OTHER)


# ---- Callback (shared by real + mock) -----------------------------------


@router.get("/{provider}/callback")
async def provider_callback(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    settings: Settings = Depends(get_settings),
    store: UserStore = Depends(get_store),
) -> RedirectResponse:
    pid = _validate_provider(provider)

    if not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state.",
        )
    state_payload = decode_oauth_state(state, settings)
    return_to = state_payload.get("return_to")
    if not isinstance(return_to, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State missing return_to.",
        )
    if state_payload.get("provider") != pid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State / provider mismatch.",
        )
    is_mock = bool(state_payload.get("mock"))

    if error:
        return _redirect_back_with_error(return_to=return_to, error=error)
    if not code:
        return _redirect_back_with_error(return_to=return_to, error="missing_code")

    try:
        if is_mock:
            profile = _mock_profile(pid)
        else:
            try:
                impl = get_provider(pid, settings)
            except ProviderConfigError as exc:
                return _redirect_back_with_error(
                    return_to=return_to, error=f"provider_unconfigured:{exc}"
                )
            redirect_uri = _build_redirect_uri(settings, pid)
            async with httpx.AsyncClient(timeout=10.0) as http:
                profile = await impl.exchange_code(
                    code=code, redirect_uri=redirect_uri, http=http
                )
    except ProviderError as exc:
        return _redirect_back_with_error(return_to=return_to, error=f"provider_error:{exc}")

    user = store.upsert(
        provider=pid,
        provider_user_id=profile.provider_user_id,
        name=profile.name,
        email=profile.email,
        avatar_url=profile.avatar_url,
    )
    token = issue_session_token(user, settings)
    return _redirect_back_with_session(return_to=return_to, user=user, token=token)


# ---- Session APIs --------------------------------------------------------


@router.get("/me", response_model=AuthUser, response_model_by_alias=True)
def me(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: AuthUser = Depends(get_current_user)) -> Response:
    # Stateless JWT: nothing to revoke server-side. The frontend wipes the
    # token from localStorage. We still require auth so unauthenticated calls
    # return 401 — useful for client-side health checks.
    return Response(status_code=status.HTTP_204_NO_CONTENT)

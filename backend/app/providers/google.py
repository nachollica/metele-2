"""Google OAuth 2.0 — using the OpenID Connect userinfo endpoint."""

from __future__ import annotations

from urllib.parse import urlencode

import httpx

from ..settings import Settings
from .base import ProviderConfigError, ProviderError, ProviderProfile, register


AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
SCOPES = "openid email profile"


@register
class GoogleProvider:
    name = "google"

    def __init__(self, settings: Settings) -> None:
        if not settings.google_client_id or not settings.google_client_secret:
            raise ProviderConfigError(
                "Google OAuth not configured (set GOOGLE_CLIENT_ID/SECRET)."
            )
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret

    def authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": SCOPES,
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(
        self,
        *,
        code: str,
        redirect_uri: str,
        http: httpx.AsyncClient,
    ) -> ProviderProfile:
        token_res = await http.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        if token_res.status_code >= 400:
            raise ProviderError(f"Google token exchange failed: {token_res.text}")
        access_token = token_res.json().get("access_token")
        if not access_token:
            raise ProviderError("Google did not return an access_token.")

        info_res = await http.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if info_res.status_code >= 400:
            raise ProviderError(f"Google userinfo failed: {info_res.text}")
        info = info_res.json()
        sub = info.get("sub")
        if not sub:
            raise ProviderError("Google userinfo missing `sub`.")
        return ProviderProfile(
            provider_user_id=str(sub),
            name=info.get("name") or info.get("email") or "Google user",
            email=info.get("email"),
            avatar_url=info.get("picture"),
        )

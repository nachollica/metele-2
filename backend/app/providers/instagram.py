"""Instagram Basic Display API (OAuth 2.0).

Note: Instagram does not return an email — the `email` field stays None and
the user is identified solely by their Instagram username.
"""

from __future__ import annotations

from urllib.parse import urlencode

import httpx

from ..settings import Settings
from .base import ProviderConfigError, ProviderError, ProviderProfile, register


AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
USERINFO_URL = "https://graph.instagram.com/me"
USERINFO_FIELDS = "id,username,account_type"


@register
class InstagramProvider:
    name = "instagram"

    def __init__(self, settings: Settings) -> None:
        if not settings.instagram_client_id or not settings.instagram_client_secret:
            raise ProviderConfigError(
                "Instagram OAuth not configured (set INSTAGRAM_CLIENT_ID/SECRET)."
            )
        self.client_id = settings.instagram_client_id
        self.client_secret = settings.instagram_client_secret

    def authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": "user_profile",
            "state": state,
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
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        if token_res.status_code >= 400:
            raise ProviderError(f"Instagram token exchange failed: {token_res.text}")
        token_payload = token_res.json()
        access_token = token_payload.get("access_token")
        ig_user_id = token_payload.get("user_id")
        if not access_token or ig_user_id is None:
            raise ProviderError("Instagram did not return access_token/user_id.")

        info_res = await http.get(
            USERINFO_URL,
            params={"fields": USERINFO_FIELDS, "access_token": access_token},
        )
        if info_res.status_code >= 400:
            raise ProviderError(f"Instagram userinfo failed: {info_res.text}")
        info = info_res.json()
        username = info.get("username") or f"ig_user_{ig_user_id}"
        return ProviderProfile(
            provider_user_id=str(info.get("id") or ig_user_id),
            name=username,
            email=None,  # Instagram Basic Display API never returns email.
            avatar_url=None,  # Profile picture also not exposed by this API.
        )

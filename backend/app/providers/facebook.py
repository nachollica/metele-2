"""Facebook Login (OAuth 2.0)."""

from __future__ import annotations

from urllib.parse import urlencode

import httpx

from ..settings import Settings
from .base import ProviderConfigError, ProviderError, ProviderProfile, register


AUTHORIZE_URL = "https://www.facebook.com/v18.0/dialog/oauth"
TOKEN_URL = "https://graph.facebook.com/v18.0/oauth/access_token"
USERINFO_URL = "https://graph.facebook.com/v18.0/me"
USERINFO_FIELDS = "id,name,email,picture"


@register
class FacebookProvider:
    name = "facebook"

    def __init__(self, settings: Settings) -> None:
        if not settings.facebook_client_id or not settings.facebook_client_secret:
            raise ProviderConfigError(
                "Facebook OAuth not configured (set FACEBOOK_CLIENT_ID/SECRET)."
            )
        self.client_id = settings.facebook_client_id
        self.client_secret = settings.facebook_client_secret

    def authorize_url(self, *, state: str, redirect_uri: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": "email,public_profile",
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
        token_res = await http.get(
            TOKEN_URL,
            params={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        if token_res.status_code >= 400:
            raise ProviderError(f"Facebook token exchange failed: {token_res.text}")
        access_token = token_res.json().get("access_token")
        if not access_token:
            raise ProviderError("Facebook did not return an access_token.")

        info_res = await http.get(
            USERINFO_URL,
            params={"fields": USERINFO_FIELDS, "access_token": access_token},
        )
        if info_res.status_code >= 400:
            raise ProviderError(f"Facebook userinfo failed: {info_res.text}")
        info = info_res.json()
        fb_id = info.get("id")
        if not fb_id:
            raise ProviderError("Facebook userinfo missing `id`.")
        picture = (info.get("picture") or {}).get("data", {}).get("url")
        return ProviderProfile(
            provider_user_id=str(fb_id),
            name=info.get("name") or info.get("email") or "Facebook user",
            email=info.get("email"),
            avatar_url=picture,
        )

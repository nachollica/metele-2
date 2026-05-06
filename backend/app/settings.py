"""Runtime configuration for the FastAPI backend."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Where the static frontend lives. Used for the CORS allow-list.
    frontend_origin: str = Field(default="http://localhost:3000")

    # Auth0 tenant host (e.g. ``my-tenant.us.auth0.com``). Used to build
    # the issuer (``https://<domain>/``), the JWKS URL, and the userinfo
    # endpoint.
    auth0_domain: str = Field(default="")

    # Auth0 API identifier — the ``aud`` claim our backend requires on every
    # access token. Configured in the Auth0 Dashboard under "APIs".
    auth0_audience: str = Field(default="")

    # Local-only "dev user" backdoor for testing without a real Auth0 tenant.
    # When ``dev_user_enabled`` is true, the backend accepts the literal
    # ``dev_user_token`` string in the Authorization header and resolves it
    # to the row whose id is ``dev_user_id``. NEVER enable in production.
    dev_user_enabled: bool = Field(default=True)
    dev_user_id: str = Field(default="dev")
    dev_user_token: str = Field(default="dev-token-please-rotate")

    @property
    def auth0_issuer(self) -> str:
        return f"https://{self.auth0_domain}/"

    @property
    def auth0_jwks_url(self) -> str:
        return f"https://{self.auth0_domain}/.well-known/jwks.json"

    @property
    def auth0_userinfo_url(self) -> str:
        return f"https://{self.auth0_domain}/userinfo"


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Runtime configuration for the FastAPI backend.

The OAuth provider credentials are loaded from environment variables — when
they are missing, the corresponding `<provider>_login` route returns 503 so
the frontend can surface a clear error. The `/auth/mock/...` endpoints are
always enabled so the end-to-end flow can be exercised without provider
credentials.
"""

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

    # Where the static frontend lives. Used to build callback URLs and the
    # CORS allow-list.
    frontend_origin: str = Field(default="http://localhost:3000")

    # Backend's own externally-visible URL. The OAuth providers redirect back
    # here, so this must match what is registered in each provider's console.
    backend_origin: str = Field(default="http://localhost:8000")

    # Secret used to sign session JWTs and the OAuth `state` parameter. Rotate
    # to invalidate every issued token.
    jwt_secret: str = Field(default="dev-secret-change-me")
    jwt_ttl_seconds: int = Field(default=60 * 60 * 24 * 7)  # 7 days

    google_client_id: str | None = None
    google_client_secret: str | None = None

    instagram_client_id: str | None = None
    instagram_client_secret: str | None = None

    facebook_client_id: str | None = None
    facebook_client_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

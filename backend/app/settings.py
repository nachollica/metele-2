"""
Runtime configuration for the FastAPI backend.

Values come exclusively from the process environment — nothing here reads a
``.env`` file (the justfile loads ``.env`` into the shell for local dev). Every
setting without a sane cross-environment default is mandatory, so a missing
variable fails loudly at boot instead of silently assuming a value.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

Environment = Literal["local", "development", "production", "testing"]
EmbeddingSize = Literal["small", "large"]


class Settings(BaseSettings):
    environment: Environment
    frontend_origin: str
    database_url: str
    auth0_domain: str
    auth0_audience: str
    dev_user_enabled: bool = Field(
        default=False,
        description="Enable the POST /auth/dev-login backdoor. Refused in production.",
    )
    dev_user_token: str = Field(
        default="",
        description="Shared-secret prefix for dev-login tokens. Required when `dev_user_enabled`.",
    )
    email_validation_check_deliverability: bool = Field(
        default=False,
        description="Have email-validator run a DNS MX lookup on profile email updates.",
    )

    # ---- Word embeddings -------------------------------------------------
    # The related-words + match features run on one live multilingual
    # sentence-transformers model. `size` selects a footprint tier (mapped to a
    # concrete model id in app.word_engine); `model` overrides it outright. The
    # model and the per-language vocabulary matrices live under `dir`; on startup
    # the app loads them from there, downloading/building whatever is missing.
    word_embeddings_size: EmbeddingSize = Field(
        default="small",
        description="Model footprint tier: 'small' (MiniLM) or 'large' (mpnet).",
    )
    word_embeddings_model: str = Field(
        default="",
        description="Explicit sentence-transformers model id; overrides `size` when set.",
    )
    word_embeddings_dir: str = Field(
        default="",
        description="Directory for the model cache + vocabulary matrices (blank = engine default).",
    )
    word_embeddings_vocab_size: int = Field(
        default=40_000,
        ge=1_000,
        description="How many of a language's most frequent words form the candidate pool.",
    )
    word_related_per_seed: int = Field(
        default=50,
        ge=1,
        description="Max neighbours harvested per seed word before merging.",
    )
    word_related_min_similarity: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="Cosine floor a related-words candidate must clear to be kept.",
    )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def auth0_issuer(self) -> str:
        return f"https://{self.auth0_domain}/"

    @property
    def auth0_jwks_url(self) -> str:
        return f"https://{self.auth0_domain}/.well-known/jwks.json"

    @property
    def auth0_userinfo_url(self) -> str:
        return f"https://{self.auth0_domain}/userinfo"

    @model_validator(mode="after")
    def _enforce_environment_invariants(self) -> "Settings":
        """
        Refuse to construct a configuration that is unsafe for its environment.

        Failing here means the app won't boot — the desired loud-failure mode
        for a misdeploy, since a server running with the wrong config is worse
        than one that never came up.
        """
        if self.is_production:
            problems: list[str] = []
            if not self.auth0_domain:
                problems.append("AUTH0_DOMAIN must be set")
            if not self.auth0_audience:
                problems.append("AUTH0_AUDIENCE must be set")
            if self.dev_user_enabled:
                problems.append("DEV_USER_ENABLED must be false")
            if _is_unsafe_origin(self.frontend_origin):
                problems.append(f"FRONTEND_ORIGIN must be public (got {self.frontend_origin!r})")
            if self.database_url.startswith("sqlite"):
                problems.append("DATABASE_URL must point at Postgres (SQLite is dev/test only)")
            if not self.email_validation_check_deliverability:
                problems.append("EMAIL_VALIDATION_CHECK_DELIVERABILITY must be true")
            if problems:
                raise ValueError("Invalid production configuration: " + "; ".join(problems))
        elif self.dev_user_enabled and not self.dev_user_token:
            # An empty token collapses the dev-login prefix check to a trivial
            # bypass — refuse to start even outside production.
            raise ValueError("DEV_USER_TOKEN must be set when DEV_USER_ENABLED is true.")
        return self


def _is_unsafe_origin(origin: str) -> bool:
    lowered = origin.lower()
    # Denylisted substrings for rejecting a non-public FRONTEND_ORIGIN — not a
    # socket bind, so S104 (hardcoded all-interfaces bind) is a false positive.
    return any(host in lowered for host in ("localhost", "127.0.0.1", "0.0.0.0"))  # noqa: S104


@lru_cache
def get_settings() -> Settings:
    # Required fields are populated from the environment by pydantic-settings;
    # type checkers without the pydantic plugin can't see that.
    return Settings()  # type: ignore[call-arg]

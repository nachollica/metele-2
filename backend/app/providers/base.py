"""Provider abstraction + registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx

from ..models import ProviderId
from ..settings import Settings


class ProviderConfigError(RuntimeError):
    """The provider is missing client_id/secret in the environment."""


class ProviderError(RuntimeError):
    """The provider rejected the auth code or returned an unexpected payload."""


@dataclass(frozen=True)
class ProviderProfile:
    """Normalized payload extracted from a provider's userinfo endpoint."""

    provider_user_id: str
    name: str
    email: str | None
    avatar_url: str | None


class ProviderConfig(Protocol):
    """Defines the methods every provider implementation must expose."""

    name: ProviderId

    def authorize_url(self, *, state: str, redirect_uri: str) -> str: ...
    async def exchange_code(
        self,
        *,
        code: str,
        redirect_uri: str,
        http: httpx.AsyncClient,
    ) -> ProviderProfile: ...


# Registry is filled in by side-effecting imports below.
_REGISTRY: dict[ProviderId, type[ProviderConfig]] = {}


def register(provider: type[ProviderConfig]) -> type[ProviderConfig]:
    _REGISTRY[provider.name] = provider  # type: ignore[index]
    return provider


def get_provider_config(name: ProviderId) -> type[ProviderConfig]:
    return _REGISTRY[name]


def get_provider(name: ProviderId, settings: Settings) -> ProviderConfig:
    """Instantiate the provider, raising `ProviderConfigError` if not configured."""
    cls = _REGISTRY[name]
    return cls(settings)  # type: ignore[call-arg]


# Trigger registration of each provider implementation. Order is irrelevant.
from . import facebook, google, instagram  # noqa: E402, F401

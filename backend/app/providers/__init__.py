"""OAuth provider definitions.

Each provider exposes:
- `authorize_url(state, redirect_uri)` — where we send the user to initiate
  consent.
- `exchange_code(code, redirect_uri, http)` — swap the auth code for an access
  token + (where applicable) a userinfo payload, and return the normalized
  `ProviderProfile`.

The implementations are intentionally tight: they do the minimum required to
prove the OAuth integration works end-to-end. Real production code would add
PKCE, scope validation, error parsing, etc. — out of scope for this iteration.
"""

from __future__ import annotations

from .base import (
    ProviderConfigError,
    ProviderError,
    ProviderProfile,
    get_provider,
    get_provider_config,
)

__all__ = [
    "ProviderConfigError",
    "ProviderError",
    "ProviderProfile",
    "get_provider",
    "get_provider_config",
]

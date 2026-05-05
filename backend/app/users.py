"""In-memory user store.

Real deployments swap this for a database. Keeping it in-process is enough for
the current scope — the frontend treats the JWT as the source of truth and
only calls `/auth/me` to revalidate, so a restart simply forces the user to
sign in again.
"""

from __future__ import annotations

from threading import Lock

from .models import AuthUser, ProviderId


def composite_id(provider: ProviderId, provider_user_id: str) -> str:
    return f"{provider}:{provider_user_id}"


class UserStore:
    def __init__(self) -> None:
        self._users: dict[str, AuthUser] = {}
        self._lock = Lock()

    def upsert(
        self,
        *,
        provider: ProviderId,
        provider_user_id: str,
        name: str,
        email: str | None,
        avatar_url: str | None,
    ) -> AuthUser:
        user = AuthUser(
            id=composite_id(provider, provider_user_id),
            provider=provider,
            name=name,
            email=email,
            avatar_url=avatar_url,
        )
        with self._lock:
            self._users[user.id] = user
        return user

    def get(self, user_id: str) -> AuthUser | None:
        with self._lock:
            return self._users.get(user_id)

    def clear(self) -> None:
        with self._lock:
            self._users.clear()


# Process-wide singleton. Tests reach for `get_store().clear()` between cases.
_store = UserStore()


def get_store() -> UserStore:
    return _store

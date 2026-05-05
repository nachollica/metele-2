"""Shared pytest fixtures.

Each test gets its own FastAPI app + clean user store so cases stay isolated.
We override `Settings` with deterministic dev values (real provider creds for
the providers we want to exercise; the mock routes don't care).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings, get_settings
from app.users import get_store


@pytest.fixture
def settings() -> Settings:
    return Settings(
        frontend_origin="http://localhost:3000",
        backend_origin="http://localhost:8000",
        jwt_secret="test-secret-test-secret-test-secret-32+",
        google_client_id="google-id",
        google_client_secret="google-secret",
        instagram_client_id="instagram-id",
        instagram_client_secret="instagram-secret",
        facebook_client_id="facebook-id",
        facebook_client_secret="facebook-secret",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    get_store().clear()
    with TestClient(app, follow_redirects=False) as c:
        yield c
    get_store().clear()
    app.dependency_overrides.clear()

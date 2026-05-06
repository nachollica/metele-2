"""Shared pytest fixtures.

Each test gets its own temp SQLite DB and a FastAPI app whose ``Settings``
and ``get_db`` deps are pinned to test values. The auth dep can be either
overridden directly (``auth_client``) for tests that don't care about the
verification path, or exercised end-to-end (``test_auth.py``).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.auth import get_current_user
from app.db import get_db
from app.db_models import User
from app.main import create_app
from app.settings import Settings, get_settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        frontend_origin="http://localhost:3000",
        auth0_domain="test-tenant.us.auth0.com",
        auth0_audience="https://api.metele.test",
        dev_user_enabled=True,
        dev_user_id="dev",
        dev_user_token="dev-test-token",
    )


@pytest.fixture
def db_engine(tmp_path):
    # Importing the model module registers the tables on SQLModel.metadata.
    from app import db_models  # noqa: F401

    url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def client(settings: Settings, db_engine) -> Iterator[TestClient]:
    app = create_app()

    def _get_db_override():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_db] = _get_db_override

    with TestClient(app, follow_redirects=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_engine) -> User:
    """A pre-seeded user row. Use with ``auth_client`` to skip token verify."""
    user = User(
        id="auth0|test-user-1",
        email="test@example.com",
        name="Test User",
        picture=None,
    )
    with Session(db_engine) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


@pytest.fixture
def auth_client(client: TestClient, test_user: User) -> TestClient:
    """Test client whose ``get_current_user`` dep is hard-coded to the
    seeded test user. Bypasses the JWKS path."""
    client.app.dependency_overrides[get_current_user] = lambda: test_user
    return client

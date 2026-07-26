"""
Shared pytest fixtures.

Each test gets its own temp SQLite DB and a FastAPI app whose ``Settings``
and ``get_db`` deps are pinned to test values. The auth dep can be either
overridden directly (``auth_client``) for tests that don't care about the
verification path, or exercised end-to-end (``test_auth.py``).
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, create_engine

from app import word_engine, word_match
from app.db import get_db
from app.db_models import User
from app.dependencies import get_current_user
from app.main import create_app
from app.settings import Settings, get_settings
from app.word_engine import Language, WordConfig, configure
from tests.word_fixtures import DEFAULT_EN, DEFAULT_ES, reconfigure, write_lemma_map, write_pool


@pytest.fixture(autouse=True)
def word_data_dir(tmp_path_factory) -> Iterator[str]:
    """
    Point the word engine at a temp dir seeded with tiny synthetic artifacts.

    The real fastText pools + spaCy lemma maps are built offline and committed;
    the suite writes a handful of words with deterministic unit vectors and an
    empty lemma map, so related/random/match run fast and offline with no
    build-only deps. Tests needing specific pools request this fixture and call
    ``write_pool`` / ``write_lemma_map`` + ``reconfigure`` to override.
    """
    data_dir = str(tmp_path_factory.mktemp("word_data"))
    write_pool(data_dir, Language.ES, DEFAULT_ES)
    write_pool(data_dir, Language.EN, DEFAULT_EN)
    write_lemma_map(data_dir, Language.ES, {})
    write_lemma_map(data_dir, Language.EN, {})
    reconfigure(data_dir)
    yield data_dir
    configure(WordConfig(data_dir="/nonexistent-flowfic-word-data"))
    word_match._map_cache.clear()
    word_engine._pool_cache.clear()


@pytest.fixture
def settings() -> Settings:
    # ``testing`` keeps the production guardrails (Auth0 required, dev-user
    # off, etc.) off so individual tests can wire only what they need. The
    # JWKS-validation path is exercised end-to-end with a stubbed key in
    # ``test_auth.py``; the dev-login backdoor stays on so the rest of the
    # suite can mint per-username tokens without a real Auth0 tenant.
    return Settings(
        environment="testing",
        frontend_origin="http://localhost:3000",
        database_url="sqlite://",
        auth0_domain="test-tenant.us.auth0.com",
        auth0_audience="https://api.flowfic.test",
        dev_user_enabled=True,
        dev_user_token="dev-test-token",
    )


@pytest.fixture
def db_engine(tmp_path) -> Iterator[Engine]:
    # Importing the model module registers the tables on SQLModel.metadata.
    from app import db_models  # noqa: F401

    url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        # Dispose so the pooled SQLite connection is closed at teardown rather
        # than GC'd unclosed (which surfaces as a ResourceWarning).
        engine.dispose()


@pytest.fixture
def client_factory(db_engine) -> Iterator[Callable[[Settings], TestClient]]:
    """
    Build a ``TestClient`` bound to an explicit ``Settings``, sharing the
    per-test SQLite engine.

    Use this for the handful of tests that exercise a non-default configuration
    (a misconfigured backend, the dev backdoor disabled, etc.) so they don't
    each re-wire ``dependency_overrides`` by hand. Clients created here are
    closed when the fixture tears down.
    """
    with ExitStack() as stack:

        def _make(settings: Settings) -> TestClient:
            app = create_app()

            def _get_db_override() -> Iterator[Session]:
                with Session(db_engine) as session:
                    yield session

            app.dependency_overrides[get_settings] = lambda: settings
            app.dependency_overrides[get_db] = _get_db_override
            return stack.enter_context(TestClient(app, follow_redirects=False))

        yield _make


@pytest.fixture
def client(
    settings: Settings,
    client_factory: Callable[[Settings], TestClient],
) -> TestClient:
    return client_factory(settings)


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
    """
    Test client whose ``get_current_user`` dep is hard-coded to the
    seeded test user. Bypasses the JWKS path.
    """
    client.app.dependency_overrides[get_current_user] = lambda: test_user  # type: ignore[attr-defined]
    return client

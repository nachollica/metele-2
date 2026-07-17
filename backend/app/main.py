"""FastAPI entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.db import engine, init_db
from app.routes.auth import router as auth_router
from app.routes.ping import router as ping_router
from app.routes.profile import router as profile_router
from app.routes.stories import router as stories_router
from app.routes.words import router as words_router
from app.settings import get_settings
from app.word_engine import LANGUAGES, EmbeddingConfig, configure, ensure_ready, resolve_model_id
from app.word_match import preload as preload_matchers

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from app.settings import Settings

logger = logging.getLogger(__name__)


def _embedding_config(settings: Settings) -> EmbeddingConfig:
    """Translate the app settings into the engine's config object."""
    return EmbeddingConfig(
        model_id=resolve_model_id(settings.word_embeddings_size, settings.word_embeddings_model),
        cache_dir=settings.word_embeddings_dir,
        vocab_size=settings.word_embeddings_vocab_size,
        per_seed=settings.word_related_per_seed,
        min_similarity=settings.word_related_min_similarity,
    )


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    # Skip the heavy model load in the test suite; unit tests stub the engine.
    if settings.environment != "testing":
        configure(_embedding_config(settings))
        try:
            # Load the related-words model + matrices (downloading anything
            # missing) and warm the lemmatisers used by /words/match.
            ensure_ready()
            preload_matchers(LANGUAGES)
        except Exception:
            # Don't take the whole app down if a corpus/model can't be prepared;
            # word features degrade until the artifact is available.
            logger.exception("Word-feature preload failed; degraded until available")
    yield
    # Close the connection pool on shutdown so a stopped server doesn't leave
    # database sockets dangling.
    engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    init_db()
    # Hide the interactive docs and OpenAPI schema in production.
    docs_disabled = settings.is_production
    app = FastAPI(
        title="FLOWFIC backend",
        version=__version__,
        root_path="/api",
        docs_url=None if docs_disabled else "/docs",
        redoc_url=None if docs_disabled else "/redoc",
        openapi_url=None if docs_disabled else "/openapi.json",
        lifespan=_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language"],
    )

    app.include_router(auth_router)
    app.include_router(ping_router)
    app.include_router(profile_router)
    app.include_router(words_router)
    app.include_router(stories_router)

    return app


app = create_app()

"""FastAPI entrypoint."""

from __future__ import annotations

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

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
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

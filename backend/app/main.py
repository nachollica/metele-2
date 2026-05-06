"""FastAPI entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routes.auth import router as auth_router
from .routes.stories import router as stories_router
from .routes.words import router as words_router
from .settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    init_db()
    app = FastAPI(title="METELE backend", version="0.1.0")

    # The frontend is served as static assets on a different origin and
    # talks to the API as XHR/fetch with a Bearer token. Allow Authorization
    # in preflight responses; credentials stay off (no cookies).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language"],
    )

    app.include_router(auth_router)
    app.include_router(words_router)
    app.include_router(stories_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

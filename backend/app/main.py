"""FastAPI entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.auth import router as auth_router
from .settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="METELE backend", version="0.1.0")

    # The frontend is on a different origin (static export served by nginx,
    # backend on its own host). The auth flow itself uses redirects, but
    # `/auth/me` and `/auth/logout` are XHR/fetch — those need CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(auth_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

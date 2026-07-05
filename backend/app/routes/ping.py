"""
Health / metadata endpoints.

``GET /ping`` is an unauthenticated liveness probe that also carries a little
non-sensitive metadata (version, environment, whether the dev-user backdoor is
enabled). The frontend reads it to decide whether the backend is reachable and
whether to show the dev-login shortcut.

``GET /ping/db`` is an authenticated ops check that confirms the database
answers a trivial query; it never exposes the connection string.
"""

import time
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.dependencies import CurrentUser, DbSession, SettingsDep
from app.settings import Environment

# Process start time, captured once at import.
_UTC_STARTED_AT = datetime.now(tz=UTC).isoformat()

router = APIRouter(
    prefix="/ping",
    tags=["meta"],
)


class PingResponse(BaseModel):
    """Public liveness payload."""

    status: Literal["ok"] = "ok"
    version: str
    environment: Environment
    devUserEnabled: bool  # noqa: N815
    utcStartedAt: str  # noqa: N815


class PingDbResponse(BaseModel):
    """
    Authenticated DB health payload. Carries only non-sensitive details:
    the dialect name and the probe latency — never the connection URL.
    """

    status: Literal["ok"] = "ok"
    dialect: str
    latencyMs: float  # noqa: N815


@router.get("", response_model=PingResponse)
def ping(
    settings: SettingsDep,
    response: Response,
) -> PingResponse:
    """
    Liveness + metadata. The payload is constant for the life of the
    process, so a short shared cache is fine. The frontend's liveness check
    sends ``cache: no-store`` to bypass this and get an honest up/down signal;
    the header only helps incidental or CDN callers. Note that in production
    the Caddy proxy overrides every ``/api/*`` response with ``no-store``, so
    this header is effectively dev-only.
    """
    response.headers["Cache-Control"] = "public, max-age=10"
    return PingResponse(
        version=__version__,
        environment=settings.environment,
        devUserEnabled=settings.dev_user_enabled,
        utcStartedAt=_UTC_STARTED_AT,
    )


@router.get("/db", response_model=PingDbResponse)
def ping_db(
    _user: CurrentUser,
    db: DbSession,
) -> PingDbResponse:
    """
    Confirm the database answers a trivial query. Auth-gated so it isn't an
    open probe. Returns 503 if the query fails.
    """
    start = time.monotonic()
    try:
        db.connection().execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not reachable.",
        ) from exc
    latency_ms = round((time.monotonic() - start) * 1000, 2)
    return PingDbResponse(
        dialect=db.get_bind().dialect.name,
        latencyMs=latency_ms,
    )

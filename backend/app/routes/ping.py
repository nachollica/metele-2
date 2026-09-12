"""
Health / metadata endpoints.

``GET /ping`` is an unauthenticated liveness probe that also carries a little
non-sensitive metadata (version, environment, whether the dev-user backdoor is
enabled, plus which worker answered and what it has loaded). The frontend reads
it to decide whether the backend is reachable and whether to show the dev-login
shortcut; ops tooling reads it to confirm what a deployed process actually is
before pointing load at it.

``GET /ping/db`` is an authenticated ops check that confirms the database
answers a trivial query; it never exposes the connection string.
"""

import os
import time
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.db import engine
from app.dependencies import CurrentUser, DbSession, SettingsDep
from app.settings import Environment
from app.word_engine import loaded_pool_sizes

# Process start time, captured once at import.
_UTC_STARTED_AT = datetime.now(tz=UTC).isoformat()

router = APIRouter(
    prefix="/ping",
    tags=["meta"],
)


class PingResponse(BaseModel):
    """
    Public liveness payload.

    Every field is constant for the life of the worker process, which is what
    lets the response carry a cache header honestly. Anything that changes per
    request — an uptime counter, a request tally — belongs on an authenticated
    ops route instead; ``utcStartedAt`` already yields uptime by subtraction
    without making the body vary.
    """

    status: Literal["ok"] = "ok"
    version: str
    environment: Environment
    devUserEnabled: bool  # noqa: N815
    utcStartedAt: str  # noqa: N815
    # OS pid of the worker that answered. Constant per process, and across a
    # burst of calls it reveals how many workers are live and whether load is
    # actually spreading across them.
    pid: int
    # Database backend in use ("postgresql" / "sqlite"), never the URL. Read off
    # the engine rather than a session, so this stays a pure liveness probe with
    # no database round-trip; `GET /ping/db` is the route that actually asks.
    dbDialect: str  # noqa: N815
    # Words resident per language in *this* worker. An empty object means the
    # artifacts never loaded — the failure that otherwise only shows up as
    # silently empty word pools mid-game.
    wordPools: dict[str, int]  # noqa: N815


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
        pid=os.getpid(),
        dbDialect=engine.dialect.name,
        wordPools=loaded_pool_sizes(),
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

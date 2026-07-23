"""
Gamification endpoints — writing streak, XP/level, weekly stats, achievements
and curated challenges.

Everything is derived on read from the caller's finished stories (see
:mod:`app.gamification`); there is no gamification state to persist. Each route
accepts an optional ``tz`` query param (an IANA name such as
``America/Argentina/Buenos_Aires``) so day boundaries — which decide streaks
and the "today"/"this week" windows — line up with the player's wall clock
rather than UTC. Unknown or missing zones fall back to UTC.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlmodel import col, select

from app.db_models import Story
from app.dependencies import CurrentUser, DbSession
from app.gamification import (
    AchievementRead,
    ChallengeRead,
    Overview,
    StoryStat,
    compute_achievements,
    compute_challenges,
    compute_overview,
    resolve_tz,
)

router = APIRouter(prefix="/stats", tags=["stats"])

TzParam = Annotated[str | None, Query(description="IANA timezone name; defaults to UTC.")]


def _load_stats(db: DbSession, user_id: str) -> list[StoryStat]:
    """
    Pull the gamification-relevant slice of the caller's stories.

    Only ``created_at`` and the ``stats`` blob are selected — never the story
    text — so this stays cheap even for a prolific writer. The ``stats`` column
    round-trips as a typed ``StoryStats`` model (see ``JSONField``).
    """
    rows = db.exec(
        select(col(Story.created_at), col(Story.stats)).where(Story.user_id == user_id)
    ).all()
    return [
        StoryStat(
            created_at=created_at,
            words=stats.words,
            duration_ms=stats.durationMs,
            required_words_used=stats.requiredWordsUsed,
        )
        for created_at, stats in rows
    ]


@router.get(
    "/overview",
    response_model=Overview,
    summary="Streak, XP/level, weekly totals and the 7-day words chart.",
)
def overview(db: DbSession, user: CurrentUser, tz: TzParam = None) -> Overview:
    zone = resolve_tz(tz)
    today = datetime.now(zone).date()
    return compute_overview(_load_stats(db, user.id), zone, today)


@router.get(
    "/achievements",
    response_model=list[AchievementRead],
    summary="Progress toward every achievement (fixed display order).",
)
def achievements(db: DbSession, user: CurrentUser, tz: TzParam = None) -> list[AchievementRead]:
    zone = resolve_tz(tz)
    today = datetime.now(zone).date()
    return compute_achievements(_load_stats(db, user.id), zone, today)


@router.get(
    "/challenges",
    response_model=list[ChallengeRead],
    summary="Curated challenges with live progress derived from activity.",
)
def challenges(db: DbSession, user: CurrentUser, tz: TzParam = None) -> list[ChallengeRead]:
    zone = resolve_tz(tz)
    today = datetime.now(zone).date()
    return compute_challenges(_load_stats(db, user.id), zone, today)

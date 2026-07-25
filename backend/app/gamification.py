"""
Gamification derived entirely from a user's finished stories.

Everything the dashboard shows — writing streak, XP/level, weekly stats, the
7-day words chart, achievement progress and the curated daily challenges — is
computed on read from the ``stories`` table. There is no mutable per-user
counter to drift out of sync: replay the same stories and you get the same
numbers.

The module is pure and framework-free (no FastAPI, no DB session). The route in
``app.routes.stats`` loads the lightweight :class:`StoryStat` records and hands
them here; the Pydantic response models produced below go straight back onto
the wire. Display text (achievement names, challenge descriptions, weekday
labels) lives in the frontend i18n dictionaries — the backend only speaks ids
and numbers, mirroring how session presets already work.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Tunables. Grouped here so the game economy can be rebalanced in one place.
# ---------------------------------------------------------------------------

# XP awarded per finished story.
XP_PER_WORD = 1
XP_PER_REQUIRED_WORD = 5
XP_PER_SESSION = 20

# Level curve: XP needed to advance FROM ``level`` to ``level + 1`` grows
# linearly, so early levels come quickly and later ones take longer. With these
# constants level 12 needs 960 XP for its final push — the "…/1000 XP" feel of
# the reference design.
LEVEL_BASE_XP = 300
LEVEL_STEP_XP = 60

# Rolling window (in days, inclusive of today) behind the weekly summary and the
# chart. Deltas compare this window against the equally-sized window before it.
WEEK_DAYS = 7

# Local-hour windows for the time-of-day achievements ([start, end)).
NIGHT_HOURS = (0, 5)
EARLY_HOURS = (5, 8)

_HOUR_MS = 3_600_000


# ---------------------------------------------------------------------------
# Input record
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StoryStat:
    """
    The slice of a finished story the gamification math needs.

    Built by the route from ``Story.created_at`` and the persisted
    ``Story.stats`` blob — never carries the story text.
    """

    created_at: datetime
    words: int
    duration_ms: int
    required_words_used: int


# ---------------------------------------------------------------------------
# Wire models (returned as-is by the /stats routes)
# ---------------------------------------------------------------------------


class LevelInfo(BaseModel):
    """Where the user sits on the XP curve."""

    level: int
    totalXp: int  # noqa: N815
    xpIntoLevel: int  # noqa: N815
    xpForLevel: int  # noqa: N815


class ChartPoint(BaseModel):
    """One day on the rolling words chart."""

    date: str  # ISO ``YYYY-MM-DD`` in the requested timezone
    words: int


class WeeklySummary(BaseModel):
    """
    Totals for the current rolling week plus the percentage change against the
    previous week. A delta is ``None`` when the previous week had nothing to
    compare against (avoids a divide-by-zero and a meaningless "+100%").
    """

    sessions: int
    words: int
    durationMs: int  # noqa: N815
    deltaSessions: float | None  # noqa: N815
    deltaWords: float | None  # noqa: N815
    deltaDurationMs: float | None  # noqa: N815


class Overview(BaseModel):
    """Everything the home + stats screens need in one payload."""

    streak: int
    totalSessions: int  # noqa: N815
    totalWords: int  # noqa: N815
    totalDurationMs: int  # noqa: N815
    level: LevelInfo
    weekly: WeeklySummary
    chart: list[ChartPoint]


class AchievementRead(BaseModel):
    """
    Progress toward one achievement. ``current``/``target`` are integers in the
    achievement's own display unit (sessions, days, hours, words) for the
    "N / M" label; ``progress`` is the precise 0–1 ratio for the bar.
    """

    id: str
    unlocked: bool
    current: int
    target: int
    progress: float


class ChallengeRead(BaseModel):
    """A curated challenge with progress derived from real activity."""

    id: str
    current: int
    target: int
    progress: float
    completed: bool


# ---------------------------------------------------------------------------
# Timezone helpers
# ---------------------------------------------------------------------------


def resolve_tz(tz: str | None) -> tzinfo:
    """
    Resolve a client-supplied IANA timezone name, falling back to UTC.

    An empty, missing or unrecognized name yields ``timezone.utc`` so a bad
    query param degrades gracefully instead of erroring the whole dashboard.
    """
    if not tz:
        return timezone.utc
    try:
        return ZoneInfo(tz)
    except ZoneInfoNotFoundError, ValueError:
        return timezone.utc


def _ensure_aware(dt: datetime) -> datetime:
    """
    Treat a naive datetime as UTC.

    Postgres hands back timezone-aware values, but SQLite drops the zone and
    returns naive datetimes; the whole codebase stores UTC, so that is the
    correct assumption to re-attach before converting to the user's zone.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _local_date(dt: datetime, tz: tzinfo) -> date:
    return _ensure_aware(dt).astimezone(tz).date()


def _local_hour(dt: datetime, tz: tzinfo) -> int:
    return _ensure_aware(dt).astimezone(tz).hour


# ---------------------------------------------------------------------------
# Streak + level (small, independently testable pieces)
# ---------------------------------------------------------------------------


def compute_streak(active_days: set[date], today: date) -> int:
    """
    Count consecutive active days ending at today (or yesterday).

    Tolerating "yesterday" means a streak stays alive through the current day
    until it actually lapses — the user hasn't necessarily written yet today.
    A gap of two or more days resets the streak to zero.
    """
    if today in active_days:
        cursor = today
    elif (today - timedelta(days=1)) in active_days:
        cursor = today - timedelta(days=1)
    else:
        return 0
    streak = 0
    while cursor in active_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def xp_to_advance(level: int) -> int:
    """XP required to go from ``level`` to ``level + 1`` (level ≥ 1)."""
    return LEVEL_BASE_XP + LEVEL_STEP_XP * (level - 1)


def level_for_xp(total_xp: int) -> LevelInfo:
    """
    Walk the level curve to place ``total_xp`` on it.

    Returns the 1-based level, the XP banked into the current level, and the XP
    that level needs to complete (the denominator of the "…/N XP" progress).
    """
    level = 1
    remaining = max(total_xp, 0)
    while remaining >= xp_to_advance(level):
        remaining -= xp_to_advance(level)
        level += 1
    return LevelInfo(
        level=level,
        totalXp=max(total_xp, 0),
        xpIntoLevel=remaining,
        xpForLevel=xp_to_advance(level),
    )


def _story_xp(stat: StoryStat) -> int:
    return (
        stat.words * XP_PER_WORD + stat.required_words_used * XP_PER_REQUIRED_WORD + XP_PER_SESSION
    )


def _pct_delta(current: int, previous: int) -> float | None:
    """Percentage change, or ``None`` when there is no baseline to compare to."""
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Aggregates:
    """Per-user rollups shared by every derived metric, computed in one pass."""

    active_days: set[date]
    words_by_day: dict[date, int]
    sessions_by_day: dict[date, int]
    duration_by_day: dict[date, int]
    total_sessions: int
    total_words: int
    total_duration_ms: int
    max_session_words: int
    night_sessions: int
    early_sessions: int


def _aggregate(stats: list[StoryStat], tz: tzinfo) -> _Aggregates:
    words_by_day: dict[date, int] = {}
    sessions_by_day: dict[date, int] = {}
    duration_by_day: dict[date, int] = {}
    total_words = 0
    total_duration = 0
    max_words = 0
    night = 0
    early = 0
    for s in stats:
        day = _local_date(s.created_at, tz)
        words_by_day[day] = words_by_day.get(day, 0) + s.words
        sessions_by_day[day] = sessions_by_day.get(day, 0) + 1
        duration_by_day[day] = duration_by_day.get(day, 0) + s.duration_ms
        total_words += s.words
        total_duration += s.duration_ms
        max_words = max(max_words, s.words)
        hour = _local_hour(s.created_at, tz)
        if NIGHT_HOURS[0] <= hour < NIGHT_HOURS[1]:
            night += 1
        elif EARLY_HOURS[0] <= hour < EARLY_HOURS[1]:
            early += 1
    return _Aggregates(
        active_days=set(sessions_by_day),
        words_by_day=words_by_day,
        sessions_by_day=sessions_by_day,
        duration_by_day=duration_by_day,
        total_sessions=len(stats),
        total_words=total_words,
        total_duration_ms=total_duration,
        max_session_words=max_words,
        night_sessions=night,
        early_sessions=early,
    )


def _window_totals(agg: _Aggregates, start: date, end: date) -> tuple[int, int, int]:
    """Sum sessions, words and duration over the inclusive [start, end] range."""
    sessions = words = duration = 0
    day = start
    while day <= end:
        sessions += agg.sessions_by_day.get(day, 0)
        words += agg.words_by_day.get(day, 0)
        duration += agg.duration_by_day.get(day, 0)
        day += timedelta(days=1)
    return sessions, words, duration


def _weekly_summary(agg: _Aggregates, today: date) -> WeeklySummary:
    cur_start = today - timedelta(days=WEEK_DAYS - 1)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=WEEK_DAYS - 1)
    cur_sessions, cur_words, cur_duration = _window_totals(agg, cur_start, today)
    prev_sessions, prev_words, prev_duration = _window_totals(agg, prev_start, prev_end)
    return WeeklySummary(
        sessions=cur_sessions,
        words=cur_words,
        durationMs=cur_duration,
        deltaSessions=_pct_delta(cur_sessions, prev_sessions),
        deltaWords=_pct_delta(cur_words, prev_words),
        deltaDurationMs=_pct_delta(cur_duration, prev_duration),
    )


def _chart(agg: _Aggregates, today: date) -> list[ChartPoint]:
    start = today - timedelta(days=WEEK_DAYS - 1)
    return [
        ChartPoint(
            date=(start + timedelta(days=i)).isoformat(),
            words=agg.words_by_day.get(start + timedelta(days=i), 0),
        )
        for i in range(WEEK_DAYS)
    ]


def compute_overview(stats: list[StoryStat], tz: tzinfo, today: date) -> Overview:
    """Build the full overview payload for the home + stats screens."""
    agg = _aggregate(stats, tz)
    total_xp = sum(_story_xp(s) for s in stats)
    return Overview(
        streak=compute_streak(agg.active_days, today),
        totalSessions=agg.total_sessions,
        totalWords=agg.total_words,
        totalDurationMs=agg.total_duration_ms,
        level=level_for_xp(total_xp),
        weekly=_weekly_summary(agg, today),
        chart=_chart(agg, today),
    )


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

# (id, target, raw-value extractor). ``raw`` is measured in the achievement's
# display unit; the "N / M" label and the progress bar both derive from it.
_ACHIEVEMENTS: tuple[tuple[str, int], ...] = (
    ("first_session", 1),
    ("streak_7", 7),
    ("streak_30", 30),
    ("wordsmith", 10_000),
    ("marathon", 5),
    ("big_session", 750),
    ("night_owl", 1),
    ("early_bird", 1),
)

# All achievement ids, exposed so tests and tooling can assert completeness.
ACHIEVEMENT_IDS: tuple[str, ...] = tuple(a[0] for a in _ACHIEVEMENTS)


def _achievement_raw(agg: _Aggregates, streak: int) -> dict[str, float]:
    return {
        "first_session": float(agg.total_sessions),
        "streak_7": float(streak),
        "streak_30": float(streak),
        "wordsmith": float(agg.total_words),
        "marathon": agg.total_duration_ms / _HOUR_MS,
        "big_session": float(agg.max_session_words),
        "night_owl": float(agg.night_sessions),
        "early_bird": float(agg.early_sessions),
    }


def compute_achievements(stats: list[StoryStat], tz: tzinfo, today: date) -> list[AchievementRead]:
    """Progress toward every achievement, in the fixed display order above."""
    agg = _aggregate(stats, tz)
    streak = compute_streak(agg.active_days, today)
    raw = _achievement_raw(agg, streak)
    out: list[AchievementRead] = []
    for ach_id, target in _ACHIEVEMENTS:
        value = raw[ach_id]
        progress = min(value / target, 1.0) if target > 0 else 0.0
        out.append(
            AchievementRead(
                id=ach_id,
                unlocked=value >= target,
                current=min(int(value), target),
                target=target,
                progress=round(progress, 4),
            )
        )
    return out


# ---------------------------------------------------------------------------
# Challenges (curated ids, progress derived from real activity — not persisted)
# ---------------------------------------------------------------------------

_CHALLENGES: tuple[tuple[str, int], ...] = (
    ("daily_600", 600),
    ("weekly_5_sessions", 5),
    ("keep_streak", 1),
)

CHALLENGE_IDS: tuple[str, ...] = tuple(c[0] for c in _CHALLENGES)


def compute_challenges(stats: list[StoryStat], tz: tzinfo, today: date) -> list[ChallengeRead]:
    """
    The curated challenge set with live progress.

    None of this is persisted: "words written today" and "sessions this week"
    are read straight from the aggregates, so a challenge fills as the user
    writes and resets naturally with the calendar.
    """
    agg = _aggregate(stats, tz)
    week_start = today - timedelta(days=WEEK_DAYS - 1)
    week_sessions, _, _ = _window_totals(agg, week_start, today)
    raw: dict[str, int] = {
        "daily_600": agg.words_by_day.get(today, 0),
        "weekly_5_sessions": week_sessions,
        "keep_streak": 1 if today in agg.active_days else 0,
    }
    out: list[ChallengeRead] = []
    for ch_id, target in _CHALLENGES:
        value = raw[ch_id]
        progress = min(value / target, 1.0) if target > 0 else 0.0
        out.append(
            ChallengeRead(
                id=ch_id,
                current=min(value, target),
                target=target,
                progress=round(progress, 4),
                completed=value >= target,
            )
        )
    return out

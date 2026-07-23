"""Unit tests for the pure gamification math in ``app.gamification``."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.gamification import (
    ACHIEVEMENT_IDS,
    CHALLENGE_IDS,
    AchievementRead,
    StoryStat,
    compute_achievements,
    compute_challenges,
    compute_overview,
    compute_streak,
    level_for_xp,
    resolve_tz,
    xp_to_advance,
)

UTC = timezone.utc
TODAY = date(2026, 7, 23)


def _stat(
    dt: datetime,
    *,
    words: int = 10,
    duration_ms: int = 60_000,
    required: int = 0,
) -> StoryStat:
    return StoryStat(
        created_at=dt,
        words=words,
        duration_ms=duration_ms,
        required_words_used=required,
    )


def _at(day: date, hour: int = 12) -> datetime:
    return datetime(day.year, day.month, day.day, hour, 0, tzinfo=UTC)


# ---- resolve_tz ----------------------------------------------------------


def test_resolve_tz_none_is_utc() -> None:
    assert resolve_tz(None) is UTC


def test_resolve_tz_empty_is_utc() -> None:
    assert resolve_tz("") is UTC


def test_resolve_tz_valid_name() -> None:
    assert resolve_tz("America/Argentina/Buenos_Aires") == ZoneInfo(
        "America/Argentina/Buenos_Aires"
    )


def test_resolve_tz_garbage_falls_back_to_utc() -> None:
    assert resolve_tz("Not/A_Zone") is UTC


# ---- streak --------------------------------------------------------------


def test_streak_empty_is_zero() -> None:
    assert compute_streak(set(), TODAY) == 0


def test_streak_today_only() -> None:
    assert compute_streak({TODAY}, TODAY) == 1


def test_streak_counts_consecutive_back_from_today() -> None:
    days = {TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=2)}
    assert compute_streak(days, TODAY) == 3


def test_streak_survives_when_today_not_yet_written() -> None:
    # Last activity was yesterday: the streak is still alive today.
    days = {TODAY - timedelta(days=1), TODAY - timedelta(days=2)}
    assert compute_streak(days, TODAY) == 2


def test_streak_resets_after_two_day_gap() -> None:
    days = {TODAY - timedelta(days=2), TODAY - timedelta(days=3)}
    assert compute_streak(days, TODAY) == 0


def test_streak_ignores_future_and_stops_at_gap() -> None:
    days = {
        TODAY,
        TODAY - timedelta(days=1),
        # gap at day-2
        TODAY - timedelta(days=3),
    }
    assert compute_streak(days, TODAY) == 2


# ---- level curve ---------------------------------------------------------


def test_xp_to_advance_grows_with_level() -> None:
    assert xp_to_advance(1) < xp_to_advance(2) < xp_to_advance(3)


def test_level_for_zero_xp() -> None:
    info = level_for_xp(0)
    assert info.level == 1
    assert info.xpIntoLevel == 0
    assert info.xpForLevel == xp_to_advance(1)


def test_level_advances_on_exact_boundary() -> None:
    info = level_for_xp(xp_to_advance(1))
    assert info.level == 2
    assert info.xpIntoLevel == 0


def test_level_partial_progress() -> None:
    info = level_for_xp(xp_to_advance(1) + 50)
    assert info.level == 2
    assert info.xpIntoLevel == 50
    assert info.totalXp == xp_to_advance(1) + 50


def test_level_never_negative() -> None:
    info = level_for_xp(-100)
    assert info.level == 1
    assert info.totalXp == 0


# ---- overview ------------------------------------------------------------


def test_overview_empty() -> None:
    ov = compute_overview([], UTC, TODAY)
    assert ov.streak == 0
    assert ov.totalSessions == 0
    assert ov.totalWords == 0
    assert ov.level.level == 1
    assert len(ov.chart) == 7
    assert all(p.words == 0 for p in ov.chart)


def test_overview_totals_and_xp() -> None:
    stats = [
        _stat(_at(TODAY), words=100, required=2),
        _stat(_at(TODAY - timedelta(days=1)), words=50, required=0),
    ]
    ov = compute_overview(stats, UTC, TODAY)
    assert ov.totalSessions == 2
    assert ov.totalWords == 150
    # xp = (100 + 2*5 + 20) + (50 + 0 + 20) = 130 + 70 = 200
    assert ov.level.totalXp == 200
    assert ov.streak == 2


def test_overview_chart_places_words_on_the_right_day() -> None:
    stats = [_stat(_at(TODAY - timedelta(days=2)), words=42)]
    ov = compute_overview(stats, UTC, TODAY)
    # chart is oldest -> newest across the last 7 days; day-2 is index 4.
    assert ov.chart[4].date == (TODAY - timedelta(days=2)).isoformat()
    assert ov.chart[4].words == 42
    assert ov.chart[-1].date == TODAY.isoformat()


def test_overview_weekly_delta_vs_previous_week() -> None:
    stats = [
        _stat(_at(TODAY), words=200),  # current week
        _stat(_at(TODAY - timedelta(days=8)), words=100),  # previous week
    ]
    ov = compute_overview(stats, UTC, TODAY)
    assert ov.weekly.words == 200
    # (200 - 100) / 100 * 100 = +100%
    assert ov.weekly.deltaWords == 100.0


def test_overview_weekly_delta_none_without_baseline() -> None:
    stats = [_stat(_at(TODAY), words=200)]
    ov = compute_overview(stats, UTC, TODAY)
    assert ov.weekly.deltaWords is None


# ---- achievements --------------------------------------------------------


def _by_id(items: list[AchievementRead]) -> dict[str, AchievementRead]:
    return {a.id: a for a in items}


def test_achievements_all_present_and_ordered() -> None:
    items = compute_achievements([], UTC, TODAY)
    assert tuple(a.id for a in items) == ACHIEVEMENT_IDS


def test_achievements_empty_all_locked() -> None:
    items = compute_achievements([], UTC, TODAY)
    assert all(not a.unlocked for a in items)
    assert all(a.current == 0 for a in items)


def test_first_session_unlocks_immediately() -> None:
    items = _by_id(compute_achievements([_stat(_at(TODAY))], UTC, TODAY))
    first = items["first_session"]
    assert first.unlocked is True
    assert first.current == 1
    assert first.progress == 1.0


def test_marathon_partial_progress() -> None:
    # 4 hours total -> 4/5, not yet unlocked.
    stats = [_stat(_at(TODAY), duration_ms=4 * 3_600_000)]
    marathon = _by_id(compute_achievements(stats, UTC, TODAY))["marathon"]
    assert marathon.current == 4
    assert marathon.target == 5
    assert marathon.unlocked is False
    assert marathon.progress == pytest.approx(0.8)


def test_night_owl_uses_local_hour() -> None:
    stats = [_stat(_at(TODAY, hour=2))]  # 02:00 UTC
    night = _by_id(compute_achievements(stats, UTC, TODAY))["night_owl"]
    assert night.unlocked is True


def test_streak_achievement_unlocks_at_seven_days() -> None:
    stats = [_stat(_at(TODAY - timedelta(days=i))) for i in range(7)]
    streak7 = _by_id(compute_achievements(stats, UTC, TODAY))["streak_7"]
    assert streak7.current == 7
    assert streak7.unlocked is True


# ---- challenges ----------------------------------------------------------


def test_challenges_all_present() -> None:
    items = compute_challenges([], UTC, TODAY)
    assert tuple(c.id for c in items) == CHALLENGE_IDS


def test_daily_600_tracks_todays_words() -> None:
    stats = [_stat(_at(TODAY), words=600)]
    daily = {c.id: c for c in compute_challenges(stats, UTC, TODAY)}["daily_600"]
    assert daily.current == 600
    assert daily.completed is True


def test_keep_streak_completes_when_written_today() -> None:
    stats = [_stat(_at(TODAY))]
    keep = {c.id: c for c in compute_challenges(stats, UTC, TODAY)}["keep_streak"]
    assert keep.completed is True


def test_weekly_sessions_challenge() -> None:
    stats = [_stat(_at(TODAY - timedelta(days=i))) for i in range(5)]
    weekly = {c.id: c for c in compute_challenges(stats, UTC, TODAY)}["weekly_5_sessions"]
    assert weekly.current == 5
    assert weekly.completed is True


# ---- timezone sensitivity ------------------------------------------------


def test_timezone_shifts_day_boundary() -> None:
    # 01:00 UTC on the 24th is still the 23rd at UTC-3 (Buenos Aires).
    dt = datetime(2026, 7, 24, 1, 0, tzinfo=UTC)
    ba = ZoneInfo("America/Argentina/Buenos_Aires")
    daily = {c.id: c for c in compute_challenges([_stat(dt, words=600)], ba, TODAY)}["daily_600"]
    assert daily.current == 600  # counted as "today" in BA

    # In UTC that same story lands on the 24th, so it is not "today" (the 23rd).
    daily_utc = {c.id: c for c in compute_challenges([_stat(dt, words=600)], UTC, TODAY)}[
        "daily_600"
    ]
    assert daily_utc.current == 0


def test_naive_datetime_treated_as_utc() -> None:
    naive = datetime(2026, 7, 23, 12, 0)  # noqa: DTZ001 — intentional naive input
    ov = compute_overview([_stat(naive, words=10)], UTC, TODAY)
    assert ov.totalWords == 10
    assert ov.streak == 1

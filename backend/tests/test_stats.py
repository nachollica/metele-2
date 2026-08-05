"""Tests for the ``/stats`` gamification endpoints (auth + wiring)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import Session

from app.db_models import Story
from app.models import StorySettings, StoryStats

URL = "/stats"

_SETTINGS: dict[str, object] = {
    "idleTimerEnabled": True,
    "mainTimerSeconds": 15,
    "globalTimerSeconds": 600,
    "requiredWordIntervalEnabled": True,
    "requiredWordIntervalSeconds": 30,
    "requiredWordUseTimerEnabled": False,
    "requiredWordUseTimerSeconds": 20,
    "soundEnabled": True,
    "soundMode": "bell",
    "wordSource": "free",
    "wordSourceSeeds": "",
}


def _seed(
    db_engine,
    user_id: str | None,
    *,
    words: int = 10,
    duration_ms: int = 60_000,
    required: int = 0,
    created_at: datetime | None = None,
) -> None:
    stats = {
        "reason": "idle",
        "durationMs": duration_ms,
        "characters": words * 5,
        "words": words,
        "requiredWordsUsed": required,
    }
    with Session(db_engine) as s:
        row = Story(
            text="hello world",
            lang="en",
            user_id=user_id,
            created_at=created_at or datetime.now(UTC),
            settings=StorySettings.model_validate(_SETTINGS),
            stats=StoryStats.model_validate(stats),
        )
        s.add(row)
        s.commit()


# ---- Auth gate -----------------------------------------------------------


def test_overview_requires_auth(client) -> None:
    assert client.get(f"{URL}/overview").status_code == 401


def test_achievements_requires_auth(client) -> None:
    assert client.get(f"{URL}/achievements").status_code == 401


def test_challenges_requires_auth(client) -> None:
    assert client.get(f"{URL}/challenges").status_code == 401


# ---- Overview ------------------------------------------------------------


def test_overview_zeroes_for_new_user(auth_client) -> None:
    body = auth_client.get(f"{URL}/overview", params={"tz": "UTC"}).json()
    assert body["totalSessions"] == 0
    assert body["totalWords"] == 0
    assert body["streak"] == 0
    assert body["level"]["level"] == 1
    assert len(body["chart"]) == 7


def test_overview_aggregates_callers_stories(auth_client, db_engine, test_user) -> None:
    _seed(db_engine, test_user.id, words=100)
    _seed(db_engine, test_user.id, words=50)
    res = auth_client.get(f"{URL}/overview", params={"tz": "UTC"})
    assert res.status_code == 200
    body = res.json()
    assert body["totalSessions"] == 2
    assert body["totalWords"] == 150
    assert body["streak"] == 1  # both seeded "now" (today, UTC)
    assert body["weekly"]["words"] == 150
    assert body["chart"][-1]["words"] == 150  # newest point is today


def test_overview_excludes_other_users(auth_client, db_engine, test_user) -> None:
    from app.db_models import User

    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    _seed(db_engine, "auth0|other", words=999)
    _seed(db_engine, test_user.id, words=10)

    body = auth_client.get(f"{URL}/overview", params={"tz": "UTC"}).json()
    assert body["totalWords"] == 10


def test_overview_accepts_iana_tz(auth_client, db_engine, test_user) -> None:
    _seed(db_engine, test_user.id, words=10)
    res = auth_client.get(f"{URL}/overview", params={"tz": "America/Argentina/Buenos_Aires"})
    assert res.status_code == 200


def test_overview_tolerates_missing_tz(auth_client) -> None:
    assert auth_client.get(f"{URL}/overview").status_code == 200


# ---- Achievements --------------------------------------------------------


def test_achievements_shape_and_first_unlock(auth_client, db_engine, test_user) -> None:
    _seed(db_engine, test_user.id, words=10)
    body = auth_client.get(f"{URL}/achievements", params={"tz": "UTC"}).json()
    assert isinstance(body, list)
    by_id = {a["id"]: a for a in body}
    assert by_id["first_session"]["unlocked"] is True
    assert by_id["first_session"]["current"] == 1


# ---- Challenges ----------------------------------------------------------


def test_challenges_track_today(auth_client, db_engine, test_user) -> None:
    _seed(db_engine, test_user.id, words=600)
    body = auth_client.get(f"{URL}/challenges", params={"tz": "UTC"}).json()
    by_id = {c["id"]: c for c in body}
    assert by_id["daily_600"]["current"] == 600
    assert by_id["daily_600"]["completed"] is True
    assert by_id["keep_streak"]["completed"] is True

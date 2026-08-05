"""Tests for ``/stories`` ownership filtering and auth gating."""

from __future__ import annotations

import pytest
from sqlmodel import Session

from app.db_models import Story, User
from app.models import StorySettings, StoryStats

URL = "/stories"

# A complete, valid GameSettings/GameResult pair. Stories now persist typed
# settings/stats, so seeds and create payloads must carry the full shape.
VALID_SETTINGS: dict[str, object] = {
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
VALID_STATS: dict[str, object] = {
    "reason": "idle",
    "durationMs": 1234,
    "characters": 42,
    "words": 8,
    "requiredWordsUsed": 2,
}


def _seed_story(db_engine, user_id: str | None, *, text: str = "hi", lang: str = "en") -> int:
    with Session(db_engine) as s:
        row = Story(
            text=text,
            lang=lang,
            user_id=user_id,
            settings=StorySettings.model_validate(VALID_SETTINGS),
            stats=StoryStats.model_validate(VALID_STATS),
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        return row.id  # type: ignore[return-value]


# ---- Auth gate -----------------------------------------------------------


def test_list_requires_auth(client) -> None:
    assert client.get(URL).status_code == 401


def test_create_requires_auth(client) -> None:
    assert client.post(URL, json={"text": "x", "lang": "en"}).status_code == 401


def test_detail_requires_auth(client) -> None:
    assert client.get(f"{URL}/1").status_code == 401


# ---- List ----------------------------------------------------------------


def test_list_returns_only_callers_stories(auth_client, db_engine, test_user) -> None:
    mine = _seed_story(db_engine, test_user.id, text="mine")
    # Seed another user + their story; should NOT show up.
    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    _seed_story(db_engine, "auth0|other", text="not mine")

    res = auth_client.get(URL)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    ids = [item["id"] for item in body["items"]]
    assert ids == [mine]


def test_list_excludes_anonymous_legacy_rows(auth_client, db_engine) -> None:
    # Anonymous (user_id=None) rows from before auth was enforced are not
    # surfaced to any caller.
    _seed_story(db_engine, None, text="legacy anon")

    res = auth_client.get(URL)
    assert res.status_code == 200
    assert res.json()["items"] == []


def test_list_pagination(auth_client, db_engine, test_user) -> None:
    for i in range(5):
        _seed_story(db_engine, test_user.id, text=f"#{i}")

    res = auth_client.get(URL, params={"limit": 2, "offset": 1})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 5
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert len(body["items"]) == 2


# ---- Detail --------------------------------------------------------------


def test_detail_returns_callers_story(auth_client, db_engine, test_user) -> None:
    sid = _seed_story(db_engine, test_user.id, text="hello")
    res = auth_client.get(f"{URL}/{sid}")
    assert res.status_code == 200
    assert res.json()["text"] == "hello"


def test_detail_404s_on_other_users_story(auth_client, db_engine) -> None:
    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    sid = _seed_story(db_engine, "auth0|other")
    res = auth_client.get(f"{URL}/{sid}")
    assert res.status_code == 404


def test_detail_404s_on_unknown_id(auth_client) -> None:
    assert auth_client.get(f"{URL}/9999").status_code == 404


# ---- Create --------------------------------------------------------------


def test_create_persists_with_caller_as_owner(auth_client, test_user) -> None:
    res = auth_client.post(
        URL,
        json={
            "text": "fresh",
            "lang": "en",
            "settings": VALID_SETTINGS,
            "stats": VALID_STATS,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user_id"] == test_user.id
    assert body["text"] == "fresh"
    assert body["settings"] == VALID_SETTINGS
    assert body["stats"] == VALID_STATS


@pytest.mark.parametrize("field", ["text", "lang", "settings", "stats"])
def test_create_validates_required_fields(auth_client, field: str) -> None:
    payload: dict[str, object] = {
        "text": "x",
        "lang": "en",
        "settings": VALID_SETTINGS,
        "stats": VALID_STATS,
    }
    payload.pop(field)
    assert auth_client.post(URL, json=payload).status_code == 422


def test_create_rejects_unknown_settings_key(auth_client) -> None:
    # Strict create: an unexpected key in settings is a 422, not silently kept.
    res = auth_client.post(
        URL,
        json={
            "text": "x",
            "lang": "en",
            "settings": {**VALID_SETTINGS, "bogus": 1},
            "stats": VALID_STATS,
        },
    )
    assert res.status_code == 422


# ---- Update --------------------------------------------------------------


def test_update_requires_auth(client) -> None:
    assert client.patch(f"{URL}/1", json={"title": "x"}).status_code == 401


def test_update_sets_and_trims_title(auth_client, db_engine, test_user) -> None:
    sid = _seed_story(db_engine, test_user.id, text="body")
    res = auth_client.patch(f"{URL}/{sid}", json={"title": "  My Tale  "})
    assert res.status_code == 200, res.text
    assert res.json()["title"] == "My Tale"


def test_update_blank_title_clears_to_null(auth_client, db_engine, test_user) -> None:
    sid = _seed_story(db_engine, test_user.id, text="body")
    auth_client.patch(f"{URL}/{sid}", json={"title": "Named"})
    res = auth_client.patch(f"{URL}/{sid}", json={"title": "   "})
    assert res.status_code == 200
    assert res.json()["title"] is None


def test_update_404s_on_other_users_story(auth_client, db_engine) -> None:
    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    sid = _seed_story(db_engine, "auth0|other")
    assert auth_client.patch(f"{URL}/{sid}", json={"title": "x"}).status_code == 404


def test_update_404s_on_unknown_id(auth_client) -> None:
    assert auth_client.patch(f"{URL}/9999", json={"title": "x"}).status_code == 404


def test_update_rejects_overlong_title(auth_client, db_engine, test_user) -> None:
    sid = _seed_story(db_engine, test_user.id)
    res = auth_client.patch(f"{URL}/{sid}", json={"title": "x" * 201})
    assert res.status_code == 422


def test_update_rejects_unknown_field(auth_client, db_engine, test_user) -> None:
    # Strict update: only the title is editable — other keys are a 422.
    sid = _seed_story(db_engine, test_user.id)
    res = auth_client.patch(f"{URL}/{sid}", json={"text": "hacked"})
    assert res.status_code == 422


# ---- Count ---------------------------------------------------------------


def test_count_requires_auth(client) -> None:
    assert client.get(f"{URL}/count").status_code == 401


def test_count_returns_only_callers_stories(auth_client, db_engine, test_user) -> None:
    for _ in range(3):
        _seed_story(db_engine, test_user.id)
    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    _seed_story(db_engine, "auth0|other")
    _seed_story(db_engine, None)  # legacy anon — must not count

    res = auth_client.get(f"{URL}/count")
    assert res.status_code == 200
    assert res.json() == {"count": 3}


def test_count_zero_when_user_has_no_stories(auth_client) -> None:
    res = auth_client.get(f"{URL}/count")
    assert res.status_code == 200
    assert res.json() == {"count": 0}


# ---- Delete --------------------------------------------------------------


def test_delete_requires_auth(client) -> None:
    assert client.delete(f"{URL}/1").status_code == 401


def test_delete_removes_callers_story(auth_client, db_engine, test_user) -> None:
    sid = _seed_story(db_engine, test_user.id, text="bye")
    res = auth_client.delete(f"{URL}/{sid}")
    assert res.status_code == 204
    # Row gone — detail now 404s.
    assert auth_client.get(f"{URL}/{sid}").status_code == 404
    with Session(db_engine) as s:
        assert s.get(Story, sid) is None


def test_delete_404s_on_other_users_story(auth_client, db_engine) -> None:
    other = User(id="auth0|other", email=None, name="Other", picture=None)
    with Session(db_engine) as s:
        s.add(other)
        s.commit()
    sid = _seed_story(db_engine, "auth0|other")
    res = auth_client.delete(f"{URL}/{sid}")
    assert res.status_code == 404
    # Row still present.
    with Session(db_engine) as s:
        assert s.get(Story, sid) is not None


def test_delete_404s_on_unknown_id(auth_client) -> None:
    assert auth_client.delete(f"{URL}/9999").status_code == 404


# ---- Title -----------------------------------------------------------------


def test_create_persists_optional_title(auth_client, test_user) -> None:
    res = auth_client.post(
        URL,
        json={
            "title": "My Tale",
            "text": "once upon",
            "lang": "en",
            "settings": VALID_SETTINGS,
            "stats": VALID_STATS,
        },
    )
    assert res.status_code == 201
    assert res.json()["title"] == "My Tale"


def test_create_defaults_title_to_null(auth_client) -> None:
    res = auth_client.post(
        URL,
        json={"text": "x", "lang": "en", "settings": VALID_SETTINGS, "stats": VALID_STATS},
    )
    assert res.status_code == 201
    assert res.json()["title"] is None

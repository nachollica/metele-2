"""
Tests for the custom-preset endpoints under ``/profile/me/presets``.

We use the ``auth_client`` fixture, which short-circuits the JWKS path and
pins a seeded user — preset CRUD is independent from token verification, so
exercising both layers in every test would be redundant.
"""

from __future__ import annotations

from app.models import MAX_CUSTOM_PRESETS


def _valid_settings() -> dict:
    """Settings payload that satisfies ``PresetSettings`` validation."""
    return {
        "mainTimerSeconds": 7,
        "globalTimerEnabled": True,
        "globalTimerSeconds": 300,
        "requiredWordIntervalEnabled": True,
        "requiredWordIntervalSeconds": 30,
        "requiredWordUseTimerEnabled": True,
        "requiredWordUseTimerSeconds": 25,
    }


def _create(auth_client, name: str = "My Mode") -> dict:
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": name, "settings": _valid_settings()},
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_me_returns_empty_custom_presets_for_new_user(auth_client) -> None:
    res = auth_client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["customPresets"] == []


def test_create_custom_preset_assigns_id_and_persists(auth_client) -> None:
    body = _create(auth_client, "Sprint")
    presets = body["customPresets"]
    assert len(presets) == 1
    assert presets[0]["name"] == "Sprint"
    assert isinstance(presets[0]["id"], str)
    assert presets[0]["id"]
    assert presets[0]["settings"] == _valid_settings()

    # Round-trip: GET /me reflects the same list.
    me_res = auth_client.get("/auth/me")
    assert me_res.json()["customPresets"] == presets


def test_create_trims_whitespace_in_name(auth_client) -> None:
    body = _create(auth_client, "   Trimmed   ")
    assert body["customPresets"][0]["name"] == "Trimmed"


def test_create_rejects_blank_name(auth_client) -> None:
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": "", "settings": _valid_settings()},
    )
    assert res.status_code == 422


def test_create_rejects_invalid_settings(auth_client) -> None:
    bad = _valid_settings()
    bad["mainTimerSeconds"] = 0  # below ge=1
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": "Bad", "settings": bad},
    )
    assert res.status_code == 422


def test_create_rejects_unknown_settings_field(auth_client) -> None:
    bad = _valid_settings()
    bad["bogus"] = True
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": "Bad", "settings": bad},
    )
    assert res.status_code == 422


def test_create_enforces_max_limit(auth_client) -> None:
    # Fill to capacity.
    for i in range(MAX_CUSTOM_PRESETS):
        _create(auth_client, f"P{i}")
    # The (n+1)-th create must be rejected with 409.
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": "Overflow", "settings": _valid_settings()},
    )
    assert res.status_code == 409, res.text
    assert "5" in res.json()["detail"]


def test_update_custom_preset_renames(auth_client) -> None:
    created = _create(auth_client, "Original")["customPresets"][0]
    res = auth_client.patch(
        f"/profile/me/presets/{created['id']}",
        json={"name": "Renamed"},
    )
    assert res.status_code == 200
    presets = res.json()["customPresets"]
    assert len(presets) == 1
    assert presets[0]["id"] == created["id"]
    assert presets[0]["name"] == "Renamed"
    # Settings preserved when only name updated.
    assert presets[0]["settings"] == _valid_settings()


def test_update_custom_preset_changes_settings(auth_client) -> None:
    created = _create(auth_client)["customPresets"][0]
    new_settings = _valid_settings()
    new_settings["mainTimerSeconds"] = 12
    res = auth_client.patch(
        f"/profile/me/presets/{created['id']}",
        json={"settings": new_settings},
    )
    assert res.status_code == 200
    presets = res.json()["customPresets"]
    assert presets[0]["settings"]["mainTimerSeconds"] == 12


def test_update_unknown_preset_404s(auth_client) -> None:
    res = auth_client.patch(
        "/profile/me/presets/does-not-exist",
        json={"name": "x"},
    )
    assert res.status_code == 404


def test_delete_removes_one_and_keeps_others(auth_client) -> None:
    a = _create(auth_client, "A")["customPresets"][0]
    b = _create(auth_client, "B")["customPresets"][-1]
    res = auth_client.delete(f"/profile/me/presets/{a['id']}")
    assert res.status_code == 200
    presets = res.json()["customPresets"]
    assert len(presets) == 1
    assert presets[0]["id"] == b["id"]


def test_delete_unknown_preset_404s(auth_client) -> None:
    res = auth_client.delete("/profile/me/presets/missing")
    assert res.status_code == 404


def test_delete_frees_a_slot_under_the_limit(auth_client) -> None:
    """After hitting the cap, deleting should let the user create again."""
    created_ids = [
        _create(auth_client, f"P{i}")["customPresets"][-1]["id"] for i in range(MAX_CUSTOM_PRESETS)
    ]
    overflow = auth_client.post(
        "/profile/me/presets",
        json={"name": "Overflow", "settings": _valid_settings()},
    )
    assert overflow.status_code == 409

    auth_client.delete(f"/profile/me/presets/{created_ids[0]}")
    res = auth_client.post(
        "/profile/me/presets",
        json={"name": "After", "settings": _valid_settings()},
    )
    assert res.status_code == 201
    assert len(res.json()["customPresets"]) == MAX_CUSTOM_PRESETS


def test_endpoints_require_auth(client) -> None:
    assert client.post("/profile/me/presets", json={}).status_code == 401
    assert client.patch("/profile/me/presets/x", json={}).status_code == 401
    assert client.delete("/profile/me/presets/x").status_code == 401

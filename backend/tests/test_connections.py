"""Tests for the `/connections` invite-link and connection endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db_models import Connection, ConnectionInvite, User
from app.dependencies import get_current_user

URL = "/connections"


def _other_user(db_engine, *, id_: str = "auth0|other", name: str = "Other") -> User:
    user = User(id=id_, email=None, name=name, picture=None)
    with Session(db_engine) as s:
        s.add(user)
        s.commit()
        s.refresh(user)
    return user


def _client_as(client_factory, settings, db_engine, user: User) -> TestClient:
    """A second authenticated client, sharing the same DB, acting as `user`."""
    other_client = client_factory(settings)
    other_client.app.dependency_overrides[get_current_user] = lambda: user  # type: ignore[attr-defined]
    return other_client


# ---- Own invite link -------------------------------------------------------


def test_get_invite_requires_auth(client) -> None:
    assert client.get(f"{URL}/invite").status_code == 401


def test_get_invite_is_null_before_creation(auth_client) -> None:
    res = auth_client.get(f"{URL}/invite")
    assert res.status_code == 200
    assert res.json()["token"] is None


def test_create_invite_issues_a_token(auth_client) -> None:
    res = auth_client.post(f"{URL}/invite")
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    assert isinstance(token, str)
    assert len(token) > 20


def test_get_invite_returns_created_token(auth_client) -> None:
    created = auth_client.post(f"{URL}/invite").json()["token"]
    res = auth_client.get(f"{URL}/invite")
    assert res.json()["token"] == created


def test_regenerate_invite_replaces_the_token(auth_client) -> None:
    first = auth_client.post(f"{URL}/invite").json()["token"]
    second = auth_client.post(f"{URL}/invite").json()["token"]
    assert first != second
    # The old token no longer resolves.
    assert auth_client.get(f"{URL}/invite/{first}").status_code == 404


def test_revoke_invite_disables_the_link(auth_client) -> None:
    token = auth_client.post(f"{URL}/invite").json()["token"]
    assert auth_client.delete(f"{URL}/invite").status_code == 204
    assert auth_client.get(f"{URL}/invite").json()["token"] is None
    assert auth_client.get(f"{URL}/invite/{token}").status_code == 404


def test_revoke_invite_is_idempotent_when_none_exists(auth_client) -> None:
    assert auth_client.delete(f"{URL}/invite").status_code == 204


def test_revoke_invite_requires_auth(client) -> None:
    assert client.delete(f"{URL}/invite").status_code == 401


# ---- Public preview ---------------------------------------------------------


def test_preview_invite_is_unauthenticated(client, auth_client, test_user) -> None:
    token = auth_client.post(f"{URL}/invite").json()["token"]
    res = client.get(f"{URL}/invite/{token}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["inviter"]["id"] == test_user.id
    assert body["inviter"]["name"] == test_user.name
    # Nothing beyond name/avatar is exposed pre-auth.
    assert set(body["inviter"]) == {"id", "name", "avatarUrl"}


def test_preview_unknown_token_404s(client) -> None:
    assert client.get(f"{URL}/invite/does-not-exist").status_code == 404


def test_preview_orphaned_invite_404s(client, db_engine) -> None:
    # A row that outlived its user (no cascade wires this up today, but
    # nothing prevents it either) must read as "not found", not 500.
    with Session(db_engine) as s:
        s.add(ConnectionInvite(user_id="auth0|ghost", token="orphan-token"))
        s.commit()
    assert client.get(f"{URL}/invite/orphan-token").status_code == 404


# ---- Accepting a link -------------------------------------------------------


def test_accept_requires_auth(client, db_engine, test_user) -> None:
    # Seed the invite directly rather than via `auth_client`: that fixture
    # overrides `get_current_user` on this same underlying TestClient, so a
    # `client.post` afterwards would no longer be the anonymous request this
    # test means to send.
    with Session(db_engine) as s:
        s.add(ConnectionInvite(user_id=test_user.id, token="seeded-token"))
        s.commit()
    assert client.post(f"{URL}/invite/seeded-token/accept").status_code == 401


def test_accept_unknown_token_404s(auth_client) -> None:
    assert auth_client.post(f"{URL}/invite/does-not-exist/accept").status_code == 404


def test_accept_own_link_is_rejected(auth_client) -> None:
    token = auth_client.post(f"{URL}/invite").json()["token"]
    assert auth_client.post(f"{URL}/invite/{token}/accept").status_code == 409


def test_accept_orphaned_invite_404s(auth_client, db_engine) -> None:
    with Session(db_engine) as s:
        s.add(ConnectionInvite(user_id="auth0|ghost", token="orphan-token"))
        s.commit()
    assert auth_client.post(f"{URL}/invite/orphan-token/accept").status_code == 404


def test_accept_creates_a_mutual_connection(
    auth_client, client_factory, settings, db_engine, test_user
) -> None:
    other = _other_user(db_engine)
    other_client = _client_as(client_factory, settings, db_engine, other)

    token = auth_client.post(f"{URL}/invite").json()["token"]
    res = other_client.post(f"{URL}/invite/{token}/accept")
    assert res.status_code == 200, res.text
    assert res.json()["user"]["id"] == test_user.id

    # Both sides see each other, symmetrically — a single ordered row serves
    # for both directions.
    mine = auth_client.get(URL).json()
    theirs = other_client.get(URL).json()
    assert [c["user"]["id"] for c in mine] == [other.id]
    assert [c["user"]["id"] for c in theirs] == [test_user.id]


def test_accept_same_link_twice_is_idempotent(
    auth_client, client_factory, settings, db_engine
) -> None:
    other = _other_user(db_engine)
    other_client = _client_as(client_factory, settings, db_engine, other)
    token = auth_client.post(f"{URL}/invite").json()["token"]

    first = other_client.post(f"{URL}/invite/{token}/accept")
    second = other_client.post(f"{URL}/invite/{token}/accept")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["connectedAt"] == second.json()["connectedAt"]

    with Session(db_engine) as s:
        assert len(s.exec(select(Connection)).all()) == 1


# ---- Listing / removing connections -----------------------------------------


def test_list_connections_requires_auth(client) -> None:
    assert client.get(URL).status_code == 401


def test_list_connections_empty_by_default(auth_client) -> None:
    assert auth_client.get(URL).json() == []


def test_remove_connection_requires_auth(client) -> None:
    assert client.delete(f"{URL}/auth0|other").status_code == 401


def test_remove_connection_disconnects_both_sides(
    auth_client, client_factory, settings, db_engine, test_user
) -> None:
    other = _other_user(db_engine)
    other_client = _client_as(client_factory, settings, db_engine, other)
    token = auth_client.post(f"{URL}/invite").json()["token"]
    other_client.post(f"{URL}/invite/{token}/accept")

    res = auth_client.delete(f"{URL}/{other.id}")
    assert res.status_code == 204
    assert auth_client.get(URL).json() == []
    assert other_client.get(URL).json() == []


def test_remove_connection_is_idempotent_when_not_connected(auth_client) -> None:
    assert auth_client.delete(f"{URL}/auth0|nobody").status_code == 204


def test_connection_between_orders_ids_regardless_of_argument_order() -> None:
    a = Connection.between("z-user", "a-user")
    b = Connection.between("a-user", "z-user")
    assert (a.user_a_id, a.user_b_id) == (b.user_a_id, b.user_b_id) == ("a-user", "z-user")


def test_accept_survives_concurrent_double_accept(db_engine, test_user, monkeypatch) -> None:
    """
    Two concurrent accepts of the same link can both clear the "already
    connected?" check before either commits. The loser's INSERT collides on
    the composite primary key; `accept_invite` must swallow that, roll back,
    and report the winner's row instead of surfacing a 500 IntegrityError.
    Mirrors `test_me_survives_concurrent_first_insert` in test_auth.py, which
    covers the same get-or-create shape in `get_current_user`.
    """
    from app.routes.connections import accept_invite

    other = _other_user(db_engine)
    invite_token = "race-token"
    with Session(db_engine) as s:
        s.add(ConnectionInvite(user_id=other.id, token=invite_token))
        # The winning concurrent request already committed this row.
        s.add(Connection.between(test_user.id, other.id))
        s.commit()

        # Force only the FIRST existence check to miss, so accept_invite takes
        # the insert branch and collides on commit — the exact production
        # ordering under a race.
        real_get = s.get
        state = {"first": True}
        pair = tuple(sorted((test_user.id, other.id)))

        def flaky_get(entity, ident, *args, **kwargs):
            if state["first"] and entity is Connection and ident == pair:
                state["first"] = False
                return None
            return real_get(entity, ident, *args, **kwargs)

        monkeypatch.setattr(s, "get", flaky_get)
        result = accept_invite(token=invite_token, db=s, user=test_user)

    assert result.user.id == other.id


def test_invite_table_holds_one_row_per_user(auth_client, db_engine, test_user) -> None:
    auth_client.post(f"{URL}/invite")
    auth_client.post(f"{URL}/invite")  # regenerate
    with Session(db_engine) as s:
        rows = s.exec(
            select(ConnectionInvite).where(ConnectionInvite.user_id == test_user.id)
        ).all()
    assert len(rows) == 1

"""First login on the default password, changing a password, the login limit, and what needs no login."""

import pytest
from test_accounts import auth, client

from zombie_bus_server import accounts, config
from zombie_bus_server import app as app_mod


def fresh(name: str) -> None:
    """A rider on the default password (their name), with no failed logins against them."""
    store = app_mod.store
    store.delete_user(name.lower())
    store.add_user(name, name)


def login(name: str, pw: str):
    r = client.post("/api/login", json={"name": name, "password": pw})
    return r, {"Authorization": f"Bearer {r.json().get('token')}"}


def test_a_rider_on_the_default_password_must_set_one_before_riding():
    fresh("Dora")
    r, h = login("dora", "Dora")
    assert r.status_code == 200 and r.json()["mustChange"] is True
    assert client.get("/api/me", headers=h).json()["mustChange"] is True
    # Nothing else until a password is set: no rooms, no rides, no profile, no Strava.
    assert client.post("/api/rooms", headers=h).status_code == 403
    assert client.post("/api/rides", json={"summary": {}}, headers=h).status_code == 403
    assert client.put("/api/profile/dora", json={"id": "dora"}, headers=h).status_code == 403
    assert client.get("/api/strava", headers=h).json()["detail"] == "Set your password first"
    pw = "/api/riders/dora/password"
    assert client.post(pw, json={"password": "short"}, headers=h).status_code == 400
    assert client.post(pw, json={"password": "  DORA  "}, headers=h).status_code == 400
    assert client.post(pw, json={"password": "pedal-power-9"}, headers=h).json() == {"ok": True}
    assert client.get("/api/me", headers=h).json()["mustChange"] is False
    assert client.post("/api/rooms", headers=h).status_code == 200
    assert login("dora", "Dora")[0].status_code == 401
    assert login("dora", "pedal-power-9")[0].json()["mustChange"] is False


def test_changing_a_password_needs_the_current_one():
    fresh("Evie")
    _, h = login("evie", "Evie")
    client.post("/api/riders/evie/password", json={"password": "first-one-here"}, headers=h)
    pw = "/api/riders/evie/password"
    assert client.post(pw, json={"password": "second-one-here"}, headers=h).status_code == 403
    r = client.post(pw, json={"password": "second-one-here", "current": "wrong-one"}, headers=h)
    assert r.status_code == 403
    r = client.post(pw, json={"password": "second-one-here", "current": "first-one-here"}, headers=h)
    assert r.json() == {"ok": True}
    assert login("evie", "second-one-here")[0].status_code == 200


def test_existing_riders_are_never_locked_out():
    # A database from before: no must_change column. Whoever still has their name as the password must change.
    import sqlite3
    import tempfile
    from pathlib import Path

    from zombie_bus_server.store import Store

    path = Path(tempfile.mkdtemp()) / "old.db"
    old = Store(path)
    old.add_user("Gus", "Gus")
    old.add_user("Hal", "hal-has-one")
    with old.db:
        old.db.executescript(
            "CREATE TABLE u2 AS SELECT id, name, salt, hash FROM users; DROP TABLE users;"
            " ALTER TABLE u2 RENAME TO users;"
        )
    assert "must_change" not in [c[1] for c in sqlite3.connect(path).execute("PRAGMA table_info(users)")]
    again = Store(path)
    assert again.login("gus", "Gus")["mustChange"] is True
    assert again.login("hal", "hal-has-one")["mustChange"] is False


def test_five_wrong_passwords_then_a_friendly_wait(monkeypatch):
    fresh("Fred")
    now = [1_000_000.0]
    monkeypatch.setattr(accounts.time, "time", lambda: now[0])
    for _ in range(config.LOGIN_FAILS):
        assert login("fred", "nope")[0].status_code == 401
    r, _ = login("fred", "Fred")  # even the right one waits
    assert r.status_code == 429 and "try again in 10 mins" in r.json()["detail"]
    assert auth()[0].status_code == 200  # other names are not held up
    now[0] += config.LOGIN_WINDOW_S - 61
    assert "try again in 2 mins" in login("fred", "Fred")[0].json()["detail"]
    now[0] += 62
    assert login("fred", "Fred")[0].status_code == 200


def test_a_good_login_clears_the_count(monkeypatch):
    fresh("Gwen")
    monkeypatch.setattr(accounts.time, "time", lambda: 2_000_000.0)
    for _ in range(config.LOGIN_FAILS - 1):
        login("gwen", "nope")
    assert login("gwen", "Gwen")[0].status_code == 200
    for _ in range(config.LOGIN_FAILS - 1):
        assert login("gwen", "nope")[0].status_code == 401
    assert login("gwen", "Gwen")[0].status_code == 200


@pytest.mark.parametrize("path", ["/api/riders", "/api/health", "/api/strava/callback?state=x&code=y"])
def test_these_need_no_login(path):
    r = client.get(path, follow_redirects=False)
    assert r.status_code in (200, 302, 303, 307)


def test_postcard_pages_need_no_login():
    assert client.get("/p/not-a-real-card").status_code == 404  # public route: not found, never 401
    assert client.get("/p/not-a-real-card.png").status_code == 404


def test_a_rider_on_the_default_password_can_still_watch_on_the_tv():
    fresh("Tilly")
    _, h = auth()
    code = client.post("/api/rooms", headers=h).json()["code"]
    r, _ = login("tilly", "Tilly")
    with client.websocket_connect(f"/ws/{code}?token={r.json()['token']}") as ws:
        ws.send_json({"t": "join", "profile": {"name": "Tilly", "ftp": 200}})
        assert ws.receive_json() == {"t": "error", "msg": "Set your password first"}
        ws.send_json({"t": "watch"})
        assert ws.receive_json()["t"] in ("lobby", "tick", "watching")

import time

from fastapi.testclient import TestClient

from zombie_bus_server.app import app

client = TestClient(app)


# Riders the tests have taken past the first login: the password each set in place of the default.
OWN: dict[str, str] = {}


def own(name: str) -> str:
    return f"{name.lower()}-rides-on"


def auth(name="alex", pw="Alex"):
    """Logs in. A seeded rider still on the default password sets their own first, as the app makes them;
    later logins with the default name go on working here by using that password."""
    if name in OWN and pw.lower() == name:
        pw = OWN[name]
    r = client.post("/api/login", json={"name": name, "password": pw})
    h = {"Authorization": f"Bearer {r.json().get('token')}"}
    if r.status_code == 200 and r.json().get("mustChange"):
        r2 = client.post(f"/api/riders/{name}/password", json={"password": own(name)}, headers=h)
        assert r2.json()["ok"]
        OWN[name] = own(name)
    return r, h


def test_seeded_accounts_log_in_with_their_names():
    names = {u["name"] for u in client.get("/api/riders", headers=auth()[1]).json()}
    assert {"Alex", "Luke", "Steve", "Angus", "Ali", "Jack"} <= names
    for n in ["Alex", "Luke", "Steve", "Angus", "Ali", "Jack"]:
        r, _ = auth(n.lower(), n)
        assert r.status_code == 200 and r.json()["id"] == n.lower()


def test_wrong_password_and_missing_token():
    assert auth("alex", "luke")[0].status_code == 401
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/rooms").status_code == 401


def test_profile_only_writable_by_owner():
    _, h = auth()
    me = client.get("/api/me", headers=h).json()
    assert me == {"id": "alex", "name": "Alex", "admin": True, "mustChange": False, "username": "Alex"}
    assert client.put("/api/profile/alex", json={"id": "alex", "updated": 1}, headers=h).json()["saved"]
    assert client.put("/api/profile/luke", json={"id": "luke", "updated": 1}, headers=h).status_code == 403
    assert client.get("/api/profile/alex", headers=h).json()["id"] == "alex"


def test_admin_adds_resets_and_removes_riders():
    _, h = auth()
    r = client.post("/api/riders", json={"name": "Newbie"}, headers=h)
    assert r.json() == {"id": "newbie", "name": "Newbie"}
    assert client.post("/api/riders", json={"name": "newbie"}, headers=h).status_code == 409
    assert client.post("/api/riders", json={"name": " "}, headers=h).status_code == 400
    r = client.post("/api/login", json={"name": "newbie", "password": "Newbie"})
    assert r.status_code == 200 and r.json()["mustChange"] is True
    nh = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/me", headers=nh).json()["admin"] is False
    pw = {"password": "secret-pedals"}
    assert client.post("/api/riders/newbie/password", json=pw, headers=nh).json()["ok"]
    client.put("/api/profile/newbie", json={"id": "newbie", "updated": 1}, headers=nh)
    assert auth("newbie", "newbie")[0].status_code == 401
    assert auth("newbie", "secret-pedals")[0].json()["mustChange"] is False

    # A reset puts the name back as the password, and the rider must set their own again.
    assert client.post("/api/riders/newbie/reset", headers=h).json() == {"ok": True}
    r = client.post("/api/login", json={"name": "newbie", "password": "Newbie"})
    assert r.status_code == 200 and r.json()["mustChange"] is True
    assert client.post("/api/riders/nobody/reset", headers=h).status_code == 404

    assert client.delete("/api/riders/newbie", headers=h).status_code == 200
    assert client.get("/api/me", headers=nh).status_code == 401
    assert client.post("/api/login", json={"name": "newbie", "password": "Newbie"}).status_code == 401
    assert client.get("/api/profile/newbie", headers=h).status_code == 200
    assert client.delete("/api/riders/newbie", headers=h).status_code == 404


def test_luke_and_alex_are_admins_and_nobody_else():
    for name, admin in (("luke", True), ("alex", True), ("steve", False)):
        _, h = auth(name, name.title())
        assert client.get("/api/me", headers=h).json()["admin"] is admin


def test_non_admins_are_refused_and_nobody_removes_themselves():
    _, h = auth()
    client.post("/api/riders", json={"name": "Pat", "password": "pat-own-pw"}, headers=h)
    _, ph = auth("pat", "pat-own-pw")
    assert client.post("/api/riders", json={"name": "X"}, headers=ph).status_code == 403
    assert client.delete("/api/riders/luke", headers=ph).status_code == 403
    assert client.post("/api/riders/luke/reset", headers=ph).status_code == 403
    assert (
        client.post("/api/riders/luke/password", json={"password": "xxxxxxxxxx"}, headers=ph).status_code
        == 403
    )
    assert (
        client.post("/api/riders/alex/password", json={"password": "xxxxxxxxxx"}, headers=h).status_code
        == 403
    )
    assert client.delete("/api/riders/alex", headers=h).status_code == 400


def test_backup_copies_and_prunes(tmp_path):
    import sqlite3
    import time

    from zombie_bus_server.app import store

    for _ in range(3):
        dest = store.backup(tmp_path, keep=2)
        time.sleep(1.05)
    files = sorted(tmp_path.glob("cranky-*.db"))
    assert len(files) == 2 and files[-1] == dest
    names = {r[0] for r in sqlite3.connect(dest).execute("SELECT name FROM users")}
    assert "Alex" in names


def test_backup_runs_nightly_and_catches_up_at_startup(monkeypatch):
    from zombie_bus_server import app as a
    from zombie_bus_server import config

    monkeypatch.setattr(a.time, "localtime", lambda _: time.struct_time((2026, 11, 14, 15, 30, 0, 0, 0, 0)))
    monkeypatch.setattr(config, "BACKUP_HOUR", 17)
    assert a.backup_wait(1e9, None) == 0  # no backup yet: straight away
    assert a.backup_wait(1e9, 1e9 - 25 * 3600) == 0  # the last one missed a night
    assert a.backup_wait(1e9, 1e9 - 3600) == 5400  # 15:30 now, 17:00 tonight
    monkeypatch.setattr(config, "BACKUP_HOUR", 15)
    assert a.backup_wait(1e9, 1e9 - 3600) == 23.5 * 3600  # missed today's hour: tomorrow


def test_restore_swaps_in_the_backup_and_keeps_the_old_file(tmp_path):
    from zombie_bus_server.store import restore_pending

    db = tmp_path / "zombie_bus.db"
    assert not restore_pending(db)
    db.write_text("live")
    (tmp_path / "restore.db").write_text("backup")
    assert restore_pending(db)
    assert db.read_text() == "backup"
    assert (tmp_path / "zombie_bus.db.before-restore").read_text() == "live"
    assert not (tmp_path / "restore.db").exists()

import time

from fastapi.testclient import TestClient

from zombie_bus_server.app import app

client = TestClient(app)


def auth(name="alex", pw="Alex"):
    r = client.post("/api/login", json={"name": name, "password": pw})
    return r, {"Authorization": f"Bearer {r.json().get('token')}"}


def test_seeded_accounts_log_in_with_their_names():
    names = {u["name"] for u in client.get("/api/riders").json()}
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
    assert client.get("/api/me", headers=h).json() == {"id": "alex", "name": "Alex", "admin": True}
    assert client.put("/api/profile/alex", json={"id": "alex", "updated": 1}, headers=h).json()["saved"]
    assert client.put("/api/profile/luke", json={"id": "luke", "updated": 1}, headers=h).status_code == 403
    assert client.get("/api/profile/alex", headers=h).json()["id"] == "alex"


def test_admin_adds_resets_and_removes_riders():
    _, h = auth()
    r = client.post("/api/riders", json={"name": "Newbie"}, headers=h)
    assert r.json() == {"id": "newbie", "name": "Newbie"}
    assert client.post("/api/riders", json={"name": "newbie"}, headers=h).status_code == 409
    assert client.post("/api/riders", json={"name": " "}, headers=h).status_code == 400
    r, nh = auth("newbie", "Newbie")
    assert r.status_code == 200 and client.get("/api/me", headers=nh).json()["admin"] is False

    assert (
        client.post("/api/riders/newbie/password", json={"password": "secret"}, headers=h).status_code == 200
    )
    assert auth("newbie", "newbie")[0].status_code == 401
    assert auth("newbie", "secret")[0].status_code == 200

    client.put("/api/profile/newbie", json={"id": "newbie", "updated": 1}, headers=nh)
    assert client.delete("/api/riders/newbie", headers=h).status_code == 200
    assert client.get("/api/me", headers=nh).status_code == 401
    assert auth("newbie", "secret")[0].status_code == 401
    assert client.get("/api/profile/newbie", headers=h).status_code == 200
    assert client.delete("/api/riders/newbie", headers=h).status_code == 404


def test_non_admins_are_limited_and_nobody_removes_themselves():
    _, h = auth()
    client.post("/api/riders", json={"name": "Pat", "password": "pw"}, headers=h)
    _, ph = auth("pat", "pw")
    assert client.post("/api/riders", json={"name": "X"}, headers=ph).status_code == 403
    assert client.delete("/api/riders/luke", headers=ph).status_code == 403
    assert client.post("/api/riders/luke/password", json={"password": "x"}, headers=ph).status_code == 403
    assert client.post("/api/riders/pat/password", json={"password": "new"}, headers=ph).status_code == 200
    assert auth("pat", "new")[0].status_code == 200
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

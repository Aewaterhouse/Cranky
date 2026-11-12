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

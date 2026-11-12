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
    assert client.get("/api/me", headers=h).json() == {"id": "alex", "name": "Alex"}
    assert client.put("/api/profile/alex", json={"id": "alex", "updated": 1}, headers=h).json()["saved"]
    assert client.put("/api/profile/luke", json={"id": "luke", "updated": 1}, headers=h).status_code == 403
    assert client.get("/api/profile/alex", headers=h).json()["id"] == "alex"

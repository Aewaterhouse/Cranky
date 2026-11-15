"""Usernames: log in by username in any case, change it (self or admin), clashes and bad ones refused, and
everything on the rider's id (history, ladder, crew results) unchanged. The login page lists nobody."""

from datetime import date

from test_accounts import auth, client
from test_ladder import result

from zombie_bus_server import app as app_mod
from zombie_bus_server import config, ladder

NAMES = ["Alex", "Luke", "Steve", "Angus", "Ali", "Jack", "Kat"]


def rider(name: str, pw: str) -> dict:
    """A fresh rider with their own password set; returns their auth header."""
    app_mod.store.delete_user(name.lower())
    app_mod.store.add_user(name, pw)
    return auth(name.lower(), pw)[1]


def login(username: str, pw: str):
    return client.post("/api/login", json={"username": username, "password": pw})


def test_login_by_username_in_any_case():
    rider("Ursula", "ursula-pw-123")
    for u in ("ursula", "URSULA", "  UrSuLa "):
        assert login(u, "ursula-pw-123").json()["id"] == "ursula"
    assert login("ursula", "wrong-pw-123").json()["detail"] == "Wrong username or password"
    assert login("nobody-here", "wrong-pw-123").json()["detail"] == "Wrong username or password"


def test_a_rider_changes_their_username_and_keeps_everything():
    h = rider("Vera", "vera-pw-1234")
    store = app_mod.store
    ride = {"record": {"date": "2026-11-10T00:00:00.000Z", "secs": 600}}
    assert client.post("/api/rides", json={"summary": ride}, headers=h).status_code == 200
    store.add_result("Bus Quick 30", result(900, [("Vera", 0.9)], d=date.today().isoformat()))
    season = ladder.season_of(date.today())
    before = client.get("/api/ladder", headers=h).json()
    rides_before = client.get("/api/rides/vera", headers=h).json()

    r = client.post("/api/riders/vera/username", json={"username": "Vee Rides_1"}, headers=h)
    assert r.json() == {"ok": True, "username": "Vee Rides_1"}
    assert login("vera", "vera-pw-1234").status_code == 401  # the old username no longer logs in
    r = login("vee rides_1", "vera-pw-1234")
    assert r.json()["id"] == "vera" and r.json()["name"] == "Vera"  # same id, same shown name
    me = client.get("/api/me", headers=h).json()
    assert me["username"] == "Vee Rides_1" and me["name"] == "Vera"
    assert client.get("/api/rides/vera", headers=h).json() == rides_before
    after = client.get("/api/ladder", headers=h).json()
    assert after["season"] == season and after["riders"] == before["riders"]
    assert any(x["name"] == "Vera" for x in after["riders"])


def test_clashing_and_invalid_usernames_are_refused():
    h = rider("Wanda", "wanda-pw-123")
    rider("Xena", "xena-pw-1234")
    url = "/api/riders/wanda/username"
    for bad in ("ab", "x" * 25, "no!good", "émile", "   "):
        assert client.post(url, json={"username": bad}, headers=h).status_code == 400, bad
    assert client.post(url, json={"username": "XENA"}, headers=h).json()["detail"] == "That username is taken"
    assert client.post(url, json={"username": "wanda"}, headers=h).status_code == 200  # own, new case: fine
    # Someone else's username: only an admin may change it.
    assert client.post("/api/riders/xena/username", json={"username": "Xen"}, headers=h).status_code == 403
    _, ah = auth()
    assert client.post("/api/riders/xena/username", json={"username": "Xen"}, headers=ah).status_code == 200
    assert login("xen", "xena-pw-1234").status_code == 200
    assert (
        client.post("/api/riders/nobody/username", json={"username": "Nobody"}, headers=ah).status_code == 404
    )


def test_a_reset_goes_back_to_the_username_and_admins_see_usernames():
    rider("Yasmin", "yasmin-pw-12")
    _, ah = auth()
    client.post("/api/riders/yasmin/username", json={"username": "Yaz"}, headers=ah)
    client.post("/api/riders/yasmin/reset", headers=ah)
    r = login("yaz", "Yaz")
    assert r.status_code == 200 and r.json()["mustChange"] is True
    listed = {x["id"]: x for x in client.get("/api/riders", headers=ah).json()}
    assert listed["yasmin"]["username"] == "Yaz"
    plain = client.get("/api/riders", headers=rider("Zed", "zed-pw-1234")).json()
    assert all("username" not in x for x in plain)


def test_the_login_page_lists_no_riders():
    assert client.get("/api/riders").status_code == 401
    page = client.get("/")
    body = page.text if page.status_code == 200 else ""
    assert not any(n in body for n in NAMES)
    assert config.SEED_USERS == NAMES

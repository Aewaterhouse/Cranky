from test_accounts import auth, client


def test_crew_curves_list_riders_with_curves_and_weights():
    _, h = auth("luke", "Luke")
    _, a = auth("angus", "Angus")
    best = {"5": {"w": 900, "date": "2026-01-01T08:00:00Z"}}
    client.put("/api/profile/luke", json={"updated": 1, "weightKg": 70, "allTime": best}, headers=h)
    client.put("/api/profile/angus", json={"updated": 1, "weightKg": 0, "allTime": {}}, headers=a)
    rows = {r["id"]: r for r in client.get("/api/crew/curves", headers=a).json()}
    assert rows["luke"] == {"id": "luke", "name": "Luke", "weightKg": 70, "best": best}
    assert rows["angus"]["weightKg"] is None and rows["angus"]["best"] == {}


def test_crew_curves_need_login():
    assert client.get("/api/crew/curves").status_code == 401

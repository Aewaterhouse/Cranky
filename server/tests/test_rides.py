from test_accounts import auth, client


def summary(date: str, **extra) -> dict:
    return {
        "planName": "Sweet Spot",
        "record": {"date": date, "secs": 1800, "kj": 300},
        "avgPower": 160,
        "np": 180,
        "tss": 40,
        "compliance": 0.9,
        "power": [100] * 10,
        **extra,
    }


def test_ride_list_detail_and_delete():
    _, h = auth("luke", "Luke")
    for s in (summary("2026-01-01T08:00:00Z"), summary("2026-02-01T08:00:00Z", crew=True)):
        assert client.post("/api/rides", json={"summary": s}, headers=h).status_code == 200
    rows = client.get("/api/rides", headers=h).json()
    assert [r["date"][:10] for r in rows] == ["2026-02-01", "2026-01-01"]
    assert rows[0] == {
        "id": rows[0]["id"],
        "date": "2026-02-01T08:00:00Z",
        "plan": "Sweet Spot",
        "secs": 1800,
        "avgPower": 160,
        "np": 180,
        "tss": 40,
        "kj": 300,
        "compliance": 0.9,
        "crew": True,
        "route": None,
        "distance": None,
    }
    assert rows[1]["crew"] is False
    detail = client.get(f"/api/rides/{rows[0]['id']}", headers=h).json()
    assert detail["power"] == [100] * 10
    assert client.delete(f"/api/rides/{rows[0]['id']}", headers=h).json() == {"ok": True}
    assert len(client.get("/api/rides", headers=h).json()) == 1
    assert client.get(f"/api/rides/{rows[0]['id']}", headers=h).status_code == 404


def test_rides_are_private_and_need_login():
    _, steve = auth("steve", "Steve")
    _, angus = auth("angus", "Angus")
    client.post("/api/rides", json={"summary": summary("2026-03-01T08:00:00Z")}, headers=steve)
    mine = client.get("/api/rides", headers=steve).json()
    assert len(mine) == 1 and client.get("/api/rides", headers=angus).json() == []
    n = mine[0]["id"]
    assert client.get(f"/api/rides/{n}", headers=angus).status_code == 404
    assert client.delete(f"/api/rides/{n}", headers=angus).status_code == 404
    assert len(client.get("/api/rides", headers=steve).json()) == 1
    assert client.get("/api/rides").status_code == 401
    assert client.delete(f"/api/rides/{n}").status_code == 401


def test_old_rides_with_missing_fields_still_list():
    _, h = auth("jack", "Jack")
    client.post("/api/rides", json={"summary": {"record": {"date": "2025-01-01T00:00:00Z"}}}, headers=h)
    row = client.get("/api/rides", headers=h).json()[0]
    assert row["plan"] is None and row["tss"] is None and row["crew"] is False


def test_free_rides_list_their_route_and_distance():
    _, h = auth("ali", "Ali")
    free = summary(
        "2026-04-01T08:00:00Z", route={"id": "willunga-hill", "name": "Willunga Hill"}, distance=2900
    )
    client.post("/api/rides", json={"summary": free}, headers=h)
    row = next(r for r in client.get("/api/rides", headers=h).json() if r["date"] == "2026-04-01T08:00:00Z")
    assert (row["route"], row["distance"], row["crew"]) == ("willunga-hill", 2900, False)


def test_posting_the_same_ride_twice_stores_it_once():
    """A ride queued offline may be sent again after a dropped reply: the start time makes it one ride."""
    _, h = auth("angus", "Angus")
    had = len(client.get("/api/rides", headers=h).json())
    s = summary("2026-03-01T08:00:00.123Z")
    first = client.post("/api/rides", json={"summary": s}, headers=h).json()
    again = client.post("/api/rides", json={"summary": s}, headers=h).json()
    assert (first["saved"], again["saved"]) == (True, False)
    other = client.post("/api/rides", json={"summary": summary("2026-03-01T09:00:00.000Z")}, headers=h)
    assert other.json()["saved"] is True
    assert len(client.get("/api/rides", headers=h).json()) == had + 2
    # The same start time from another rider is another ride.
    _, h2 = auth("ali", "Ali")
    assert client.post("/api/rides", json={"summary": s}, headers=h2).json()["saved"] is True


def test_rides_without_a_date_are_never_merged():
    _, h = auth("jack", "Jack")
    had = len(client.get("/api/rides", headers=h).json())
    for _ in range(2):
        assert client.post("/api/rides", json={"summary": {"planName": "Old"}}, headers=h).json()["saved"]
    assert len(client.get("/api/rides", headers=h).json()) == had + 2

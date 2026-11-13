from test_accounts import auth, client

SEG = "test-hill:climb:1000"


def effort(secs: float, date: str, **extra) -> dict:
    return {
        "route": "test-hill",
        "segment": SEG,
        "secs": secs,
        "watts": 250,
        "wkg": 3.2,
        "date": date,
        "name": "ignored extra field",
        **extra,
    }


def post(h: dict, *efforts: dict) -> dict:
    r = client.post("/api/efforts", json={"efforts": list(efforts)}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_efforts_store_once_and_give_bests_and_leaderboards():
    _, ali = auth("ali", "Ali")
    _, steve = auth("steve", "Steve")
    ride = {"record": {"date": "2026-05-01T08:00:00Z", "secs": 900}, "planName": "Test Hill"}
    client.post("/api/rides", json={"summary": ride}, headers=ali)
    first = effort(400, "2026-05-01T08:10:00Z", rideDate="2026-05-01T08:00:00Z")
    assert post(ali, first, effort(380, "2026-05-02T08:10:00Z", wkg=3.0)) == {"saved": 2}
    # A retried sync sends the same efforts again: nothing is stored twice.
    assert post(ali, first) == {"saved": 0}
    assert post(steve, effort(390, "2026-05-03T08:10:00Z", wkg=3.9)) == {"saved": 1}

    mine = client.get("/api/efforts/mine", headers=ali).json()
    best = next(b for b in mine if b["segment"] == SEG)
    assert (best["secs"], best["count"], best["route"]) == (380, 2, "test-hill")
    assert "trace" not in best

    board = client.get(f"/api/segments/{SEG}/leaderboard", headers=steve).json()
    assert [(r["id"], r["name"], r["secs"]) for r in board] == [
        ("ali", "Ali", 380),
        ("steve", "Steve", 390),
    ]
    by_wkg = client.get(f"/api/segments/{SEG}/leaderboard?by=wkg", headers=steve).json()
    assert [(r["id"], r["wkg"]) for r in by_wkg] == [("steve", 3.9), ("ali", 3.2)]
    # Their best W/kg came on his slower go, which links back to the ride it was part of.
    rides = client.get("/api/rides", headers=ali).json()
    assert by_wkg[1]["ride"] == rides[-1]["id"] and by_wkg[1]["secs"] == 400

    pre = client.get("/api/efforts?route=test-hill", headers=steve).json()
    assert pre["mine"][SEG]["secs"] == 390
    assert [r["id"] for r in pre["crew"][SEG]] == ["ali", "steve"]
    assert client.get("/api/efforts?route=nowhere", headers=steve).json() == {"mine": {}, "crew": {}}


def test_only_the_best_effort_keeps_its_trace_for_ghosts():
    _, h = auth("angus", "Angus")
    seg = "test-hill:route:0"
    post(h, effort(600, "2026-06-01T08:00:00Z", segment=seg, trace=[50, 100, 150]))
    post(h, effort(650, "2026-06-02T08:00:00Z", segment=seg, trace=[40, 80, 120]))
    ghost = client.get(f"/api/segments/{seg}/ghost/angus", headers=h).json()
    assert (ghost["name"], ghost["secs"], ghost["trace"]) == ("Angus", 600, [50, 100, 150])
    post(h, effort(590, "2026-06-03T08:00:00Z", segment=seg, trace=[60, 120, 180]))
    ghost = client.get(f"/api/segments/{seg}/ghost/angus", headers=h).json()
    assert (ghost["secs"], ghost["trace"]) == (590, [60, 120, 180])
    assert client.get("/api/efforts?route=test-hill", headers=h).json()["mine"][seg]["trace"] == [
        60,
        120,
        180,
    ]
    # Anyone in the crew can ride against it; a rider with no effort gives a 404.
    _, other = auth("alex", "Alex")
    assert client.get(f"/api/segments/{seg}/ghost/angus", headers=other).status_code == 200
    assert client.get(f"/api/segments/{seg}/ghost/alex", headers=other).status_code == 404


def test_efforts_need_login_and_sane_values():
    _, h = auth("jack", "Jack")
    assert client.post("/api/efforts", json={"efforts": []}).status_code == 401
    assert client.get("/api/efforts?route=test-hill").status_code == 401
    assert client.get(f"/api/segments/{SEG}/leaderboard").status_code == 401
    bad = [
        effort(0, "2026-05-01T08:10:00Z"),
        effort(100, "2026-05-01T08:10:00Z", segment="other-route:climb:0"),
        effort(100, "2026-05-01T08:10:00Z", trace=list(range(20000))),
    ]
    for e in bad:
        assert client.post("/api/efforts", json={"efforts": [e]}, headers=h).status_code == 422
    assert client.get(f"/api/segments/{SEG}/leaderboard?by=vibes", headers=h).status_code == 422
    assert all(r["id"] != "jack" for r in client.get(f"/api/segments/{SEG}/leaderboard", headers=h).json())


def test_efforts_table_is_added_to_an_existing_database_without_touching_it(tmp_path):
    from zombie_bus_server.efforts import Efforts
    from zombie_bus_server.store import Store

    store = Store(tmp_path / "old.db")
    store.add_user("Old", "old")
    store.add_ride("old", {"record": {"date": "2025-01-01T00:00:00Z"}})
    for _ in range(2):  # opening twice is harmless
        Efforts(store)
    assert store.users() == [{"id": "old", "name": "Old"}] and len(store.rides("old")) == 1

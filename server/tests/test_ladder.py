from datetime import date

from zombie_bus_server import ladder


def result(score, crew, awards=(), d="2026-11-12", plan="Bus Quick 30"):
    return {
        "score": score,
        "distance": 30000,
        "date": d,
        "plan": plan,
        "riders": [{"name": n, "compliance": c, "bot": n.startswith("Bot")} for n, c in crew],
        "awards": [{"award": a, "name": n, "why": ""} for a, n in awards],
    }


def test_seasons_and_bounds():
    assert ladder.season_of(date(2026, 11, 12)) == "2026-Q4"
    assert ladder.bounds("2026-Q4") == ("2026-10-01", "2027-01-01")
    assert ladder.bounds("2026-Q1") == ("2026-01-01", "2026-04-01")


def test_ladder_ranks_runs_and_riders_and_ignores_bots():
    res = [
        result(2000, [("Alex", 0.9), ("Luke", 0.8), ("Bot Dazza", 1.0)], [("Iron Lungs", "Bot Dazza")]),
        result(3000, [("Alex", 1.0), ("Kat", 0.95)], [("Iron Lungs", "Alex"), ("Sync Master", "Kat")]),
        result(1000, [("Luke", 0.7)], [("Iron Lungs", "Luke")]),
    ]
    out = ladder.build("2026-Q4", res)
    assert [r["score"] for r in out["runs"]] == [3000, 2000, 1000]
    table = {r["name"]: r for r in out["riders"]}
    assert set(table) == {"Alex", "Luke", "Kat"}
    assert table["Alex"] == {"name": "Alex", "rides": 2, "best": 3000, "compliance": 0.95, "awards": 1}
    assert out["riders"][0]["best"] == 3000
    titles = {t["award"]: t["name"] for t in out["titles"]}
    assert titles["Sync Master"] == "Kat" and titles["Iron Lungs"] in ("Alex", "Luke")


def test_ladder_endpoint_and_store_round_trip():
    from fastapi.testclient import TestClient

    from zombie_bus_server.app import app, store

    c = TestClient(app)
    token = c.post("/api/login", json={"name": "alex", "password": "alex"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    store.add_result("Bus Quick 30", result(4321, [("Alex", 0.9)]))
    season = ladder.season_of(date.today())
    out = c.get("/api/ladder", headers=h).json()
    assert out["season"] == season and any(r["score"] == 4321 for r in out["runs"])
    assert c.get("/api/ladder?season=nope", headers=h).status_code == 400
    assert c.get("/api/ladder?season=2001-Q1", headers=h).json()["runs"] == []

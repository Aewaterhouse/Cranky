import json
from datetime import UTC, datetime

from zombie_bus_server.store import Store

CREW = {
    "score": 812,
    "distance": 9000,
    "riders": [{"id": "luke", "name": "Luke"}, {"id": "amy", "name": "Amy"}],
}


def ride(date: str, **extra) -> dict:
    return {"planName": "Sweet Spot", "record": {"date": date, "secs": 1800}, "crew": True, **extra}


def test_old_bus_rides_get_their_result_from_the_ladder(tmp_path):
    s = Store(tmp_path / "t.db")
    start = datetime(2026, 11, 10, 9, 0, tzinfo=UTC)
    day = start.astimezone().strftime("%Y-%m-%d")  # the server's local day, as add_result records it
    s.add_ride("luke", ride(start.isoformat()))
    s.add_ride("luke", ride("2026-11-01T09:00:00Z"))  # no result that day
    s.add_ride("luke", ride(start.isoformat().replace("09:", "10:"), route={"id": "x"}))  # a group free ride
    s.add_ride("amy", ride(start.isoformat()))
    with s.db:
        s.db.execute(
            "INSERT INTO results (date, plan, json) VALUES (?, ?, ?)",
            (day, "Sweet Spot", json.dumps(CREW)),
        )
    assert s.backfill_bus_results() == 2
    luke = s.rides("luke")
    assert luke[0]["group"]["score"] == 812
    assert "group" not in luke[1] and "group" not in luke[2]
    assert s.rides("amy")[0]["group"]["riders"][1]["name"] == "Amy"
    assert s.backfill_bus_results() == 0  # once only

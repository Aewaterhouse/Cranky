"""Rides on the simulated trainer are test rides: stored, shown in History, counted nowhere."""

import asyncio

from test_accounts import auth, client
from test_bots import lobby_with
from test_efforts import SEG, effort, post
from test_resume import join
from test_rides import summary

from zombie_bus_server import discord
from zombie_bus_server.modes.common import counted
from zombie_bus_server.store import Store


def save(h: dict, s: dict) -> int:
    r = client.post("/api/rides", json={"summary": s}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_a_test_ride_is_stored_and_listed_but_counts_for_nothing():
    _, h = auth("jack", "Jack")
    _, kat = auth("alex", "Alex")
    date = "2026-03-03T07:00:00Z"
    post(h, effort(200, "2026-03-03T07:10:00Z", rideDate=date))  # timed before the ride arrives
    n = save(h, summary(date, test=True, prs=2))
    row = next(r for r in client.get("/api/rides", headers=h).json() if r["id"] == n)
    assert row["test"] is True
    assert client.get(f"/api/rides/{n}", headers=h).json()["test"] is True
    # Segments: the effort timed before the ride arrived is dropped, and later ones are never stored.
    assert post(h, effort(190, "2026-03-03T07:20:00Z", rideDate=date))["saved"] == 0
    assert post(h, effort(180, "2026-03-03T07:30:00Z", test=True))["saved"] == 0
    assert not client.get("/api/efforts/mine", headers=h).json()
    assert all(r["id"] != "jack" for r in client.get(f"/api/segments/{SEG}/leaderboard", headers=h).json())
    # The crew feed leaves it out and it takes no kudos.
    assert all(f["n"] != n for f in client.get("/api/feed", headers=kat).json())
    assert client.post(f"/api/kudos/{n}", headers=kat).json() == {"given": False}
    # Strava refuses it, connected or not.
    assert client.post(f"/api/strava/upload/{n}", json={"fit": "AA=="}, headers=h).status_code in (409, 422)
    # Still deletable as now.
    assert client.delete(f"/api/rides/{n}", headers=h).status_code == 200


def test_the_test_flag_is_validated_and_a_real_ride_is_unchanged():
    _, h = auth("jack", "Jack")
    bad = client.post("/api/rides", json={"summary": summary("2026-03-04T07:00:00Z", test="yes")}, headers=h)
    assert bad.status_code == 422
    n = save(h, summary("2026-03-05T07:00:00Z", test=False))
    assert "test" not in client.get(f"/api/rides/{n}", headers=h).json()
    assert "test" not in next(r for r in client.get("/api/rides", headers=h).json() if r["id"] == n)
    # A room result that marks me as a test rider makes my ride a test ride whatever the summary says.
    group = {"riders": [{"id": "jack", "name": "Jack", "test": True}]}
    n = save(h, summary("2026-03-06T07:00:00Z", crew=True, group=group))
    assert client.get(f"/api/rides/{n}", headers=h).json()["test"] is True


def test_the_strava_upload_refuses_a_test_ride_even_when_connected(monkeypatch):
    from zombie_bus_server import app as app_mod

    _, h = auth("jack", "Jack")
    n = save(h, summary("2026-03-07T07:00:00Z", test=True))
    monkeypatch.setattr(app_mod.strava, "status", lambda rid: {"connected": True})
    r = client.post(f"/api/strava/upload/{n}", json={"fit": "AA=="}, headers=h)
    assert r.status_code == 422 and "simulator" in r.json()["detail"]


def test_counted_drops_test_riders_and_their_awards():
    rows = [{"id": "a", "test": True}, {"id": "b"}, {"id": "bot1", "bot": True}]
    awards = [{"award": "X", "id": "a", "name": "A"}, {"award": "Y", "id": "b", "name": "B"}]
    got = counted({"score": 5, "riders": rows, "awards": awards})
    assert [r["id"] for r in got["riders"]] == ["b", "bot1"] and got["awards"] == [awards[1]]
    assert counted({"riders": [{"id": "a", "test": True}, {"id": "bot1", "bot": True}]}) is None
    plain = {"riders": [{"id": "b"}], "awards": []}
    assert counted(plain) is plain


async def bus_room(tmp_path, sims: list[bool], monkeypatch):
    posts: list[str] = []
    monkeypatch.setattr(discord, "post", posts.append)
    room, ws = await lobby_with(0, code="SIMS")
    room.store = Store(tmp_path / "s.db")
    for i, sim in enumerate(sims):
        await room.handle(f"h{i}", ws, {**join(f"H{i}"), "sim": sim})
    room.start()
    room.task.cancel()
    await room.finish()
    await asyncio.sleep(0.05)
    return room, posts


def test_a_mixed_crew_counts_only_the_riders_on_real_trainers(tmp_path, monkeypatch):
    async def main():
        room, posts = await bus_room(tmp_path, [False, True], monkeypatch)
        rows = {r["id"]: r for r in room.summary["riders"]}
        assert rows["h1"]["test"] is True and "test" not in rows["h0"]
        stored = room.store.results("2000-01-01", "2100-01-01")
        assert len(stored) == 1
        assert [r["id"] for r in stored[0]["riders"] if not r.get("bot")] == ["h0"]
        assert all(a.get("id") != "h1" for a in stored[0]["awards"])
        assert len(posts) == 1 and "H1" not in posts[0].replace("H10", "")

    asyncio.run(main())


def test_an_all_simulator_crew_adds_nothing_to_the_ladder_or_records(tmp_path, monkeypatch):
    async def main():
        room, posts = await bus_room(tmp_path, [True, True], monkeypatch)
        assert all(r["test"] for r in room.summary["riders"] if not r.get("bot"))
        s = room.store
        assert s.results("2000-01-01", "2100-01-01") == []
        assert s.db.execute("SELECT COUNT(*) FROM bests").fetchone()[0] == 0
        assert s.db.execute("SELECT COUNT(*) FROM titles").fetchone()[0] == 0
        assert posts == [] and "crewBest" not in room.summary and "titles" not in room.summary

    asyncio.run(main())


def test_the_simulator_flag_sticks_once_riding_and_survives_the_start(tmp_path, monkeypatch):
    async def main():
        room, ws = await lobby_with(0, code="STCK")
        await room.handle("h0", ws, {**join("H0"), "sim": True})
        await room.handle("h0", ws, {**join("H0"), "sim": False})  # swapped to a real trainer in the lobby
        assert room.riders["h0"].sim is False
        room.start()
        room.task.cancel()
        await room.handle("h0", ws, {"t": "data", "p": 200, "w": 200, "cad": 90, "sim": True})
        await room.handle("h0", ws, {**join("H0"), "sim": False})  # a reconnect mid-ride can't clear it
        assert room.riders["h0"].sim is True
        lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
        assert lobby["riders"][0]["sim"] is True

    asyncio.run(main())

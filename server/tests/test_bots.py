"""Bot riders: seats, simulation, sprint grades, snapshots."""

import asyncio

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_resume import FakeWS, join, ride

from zombie_bus_server import app as app_mod
from zombie_bus_server import config
from zombie_bus_server.plan import generate
from zombie_bus_server.session import Room

SHORT = {
    "id": "short",
    "name": "Short",
    "blocks": [
        {"type": "ramp", "dur": 20, "pct": [50, 70]},
        {"type": "steady", "dur": 30, "pct": 90},
        {"type": "sprint", "dur": 10},
        {"type": "steady", "dur": 20, "pct": 60},
    ],
}


async def lobby_with(humans: int, code="BOTS") -> tuple[Room, FakeWS]:
    room, ws = Room(code), FakeWS()
    room.plan = generate(SHORT, 0)
    for n in range(humans):
        await room.handle(f"h{n}", ws, join(f"H{n}"))
    return room, ws


def test_bot_count_respects_seats_and_host_rules():
    async def main():
        room, ws = await lobby_with(1)
        await room.handle("h0", ws, {"t": "bots", "n": 5})
        assert sum(r.bot for r in room.riders.values()) == 5 and len(room.riders) == config.MAX_RIDERS
        assert room.host == "h0" and all(r.connected for r in room.riders.values())
        lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
        assert [r["bot"] for r in lobby["riders"]] == [False] + [True] * 5

        await room.handle("h1", ws, join("H1"))  # a human takes a bot's seat
        assert len(room.riders) == config.MAX_RIDERS and sum(r.bot for r in room.riders.values()) == 4
        await room.handle("h1", ws, {"t": "bots", "n": 0})  # not the host
        assert sum(r.bot for r in room.riders.values()) == 4
        await room.handle("h0", ws, {"t": "bots", "n": 1})
        assert sum(r.bot for r in room.riders.values()) == 1
        with pytest.raises(ValidationError):
            await room.handle("h0", ws, {"t": "bots", "n": 9})
        await room.disconnect("h0", ws)
        assert room.host == "h1"

    asyncio.run(main())


def test_bots_ride_a_short_plan_and_report_sprints():
    async def main():
        room, ws = await lobby_with(1)
        await room.handle("h0", ws, {"t": "bots", "n": 3})
        await room.handle("h0", ws, {"t": "start"})
        await ride(room, ws, "h0", 100)
        return room, ws

    room, ws = asyncio.run(main())
    assert room.state == "done"
    ticks = [m for m in ws.sent if m["t"] == "tick" and m["i"] >= 0]
    bots = [r for r in room.riders.values() if r.bot]
    assert len(bots) == 3
    assert all(r.id in ticks[-1]["riders"] and ticks[-1]["riders"][r.id]["st"] != "spectator" for r in bots)
    mid = next(m for m in ticks if m["i"] == 1)["riders"]
    assert all(mid[r.id]["tgt"] and 0.9 * mid[r.id]["tgt"] <= mid[r.id]["w"] for r in bots)
    summary = next(m for m in ws.sent if m["t"] == "end")["summary"]
    rows = {x["id"]: x for x in summary["riders"]}
    assert set(rows) == {"h0"} | {r.id for r in bots}
    for r in bots:
        assert r.comp_n > 20 and 0.4 <= rows[r.id]["compliance"] <= 1.0
        assert len(rows[r.id]["sprints"]) == 1 and rows[r.id]["sprints"][0] in config.BOT_GRADES
    assert summary["distance"] > 0


def test_bots_are_repeatable_and_survive_a_snapshot():
    async def grades(code):
        room, ws = await lobby_with(1, code)
        await room.handle("h0", ws, {"t": "bots", "n": 4})
        await room.handle("h0", ws, {"t": "start"})
        await ride(room, ws, "h0", 100)
        return {r.id: (r.ftp, r.tier, r.look, r.sprints) for r in room.riders.values() if r.bot}

    assert asyncio.run(grades("SAME")) == asyncio.run(grades("SAME"))

    async def snap():
        room, ws = await lobby_with(1)
        await room.handle("h0", ws, {"t": "bots", "n": 2})
        return Room.from_dict(room.to_dict())

    new = asyncio.run(snap())
    assert [r.bot and r.connected for r in new.riders.values()] == [False, True, True]


def test_bot_names_stay_out_of_the_room_list():
    client = TestClient(app_mod.app)
    app_mod.store.add_user("Botfan", "pw")
    token = client.post("/api/login", json={"name": "botfan", "password": "pw"}).json()["token"]

    async def build():
        room, ws = await lobby_with(1, "LIST")
        await room.handle("h0", ws, {"t": "bots", "n": 2})
        return room

    app_mod.rooms["LIST"] = asyncio.run(build())
    rows = client.get("/api/rooms", headers={"Authorization": f"Bearer {token}"}).json()
    assert next(r for r in rows if r["code"] == "LIST")["riders"] == ["H0"]

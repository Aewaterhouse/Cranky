"""The crew game kit on the bus: game inputs and questions, and what is left of the games that have gone."""

import asyncio

import pytest
from pydantic import ValidationError
from test_bots import lobby_with

from zombie_bus_server import config as C
from zombie_bus_server import session
from zombie_bus_server.store import Store

DT = 1 / C.TICK_HZ


async def riding(monkeypatch, code="ACTS"):
    """A bus ride under way whose game inputs land in `room.acts_seen`."""
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)
    room, ws = await lobby_with(2, code)
    room.start()
    room.task.cancel()
    room.acts_seen = []
    room.mode.on_act = lambda room_, r, k, v: room.acts_seen.append((r.id, k, v))
    return room, ws


def test_act_reaches_the_game_only_in_a_ride_and_is_rate_limited(monkeypatch):
    async def main():
        room, ws = await lobby_with(2, "LOBY")
        await room.handle("h1", ws, {"t": "act", "k": "emoji", "v": "wave"})  # lobby: dropped, nothing breaks
        room, ws = await riding(monkeypatch)
        room.step(DT)
        for n in range(C.ACT_LIMIT[0] + 5):
            await room.handle("h1", ws, {"t": "act", "k": "vote", "v": n})
        await room.handle("h0", ws, {"t": "act", "k": "card"})
        return room

    acts = asyncio.run(main()).acts_seen
    assert [a for a in acts if a[0] == "h1"] == [("h1", "vote", n) for n in range(C.ACT_LIMIT[0])]
    assert acts[-1] == ("h0", "card", None)


def test_a_games_question_rides_in_that_riders_tick_only(monkeypatch):
    async def main():
        room, ws = await riding(monkeypatch, "ASKS")
        opts = [{"v": "tea", "label": "Tea"}, {"v": "beer", "label": "Beer", "off": True}]
        room.mode.ask = lambda room_, r: (
            {"k": "drink", "title": "Drink?", "opts": opts} if r.id == "h1" else None
        )
        room.el = 1.0
        return room.step(DT)

    t = asyncio.run(main())
    assert t["riders"]["h1"]["ask"]["opts"][1] == {"v": "beer", "label": "Beer", "off": True}
    assert t["riders"]["h0"]["ask"] is None
    assert "game" not in t and "band" not in t["riders"]["h0"]


@pytest.mark.parametrize(
    "bad", [{"k": "Bad Key"}, {"k": ""}, {"k": "x", "v": "y" * 301}, {"k": "x", "v": [1]}]
)
def test_act_is_validated(monkeypatch, bad):
    async def main():
        room, ws = await lobby_with(1, "BADA")
        await room.handle("h0", ws, {"t": "act", **bad})

    with pytest.raises(ValidationError):
        asyncio.run(main())


@pytest.mark.parametrize("gone", ["madness", "ambo", "climate", "watch", "hunt"])
def test_a_stale_client_picking_a_game_that_has_gone_is_told_and_the_bus_stays(gone):
    async def main():
        room, ws = await lobby_with(1, "GONE")
        await room.handle("h0", ws, {"t": "game", "game": gone})
        await room.handle("h0", ws, {"t": "game", "game": "bus"})
        return room, ws

    room, ws = asyncio.run(main())
    assert room.game == "bus" and room.lobby_msg()["game"] == "bus"
    assert [m["msg"] for m in ws.sent if m["t"] == "error"] == [
        "That game has gone. Zombie Bus is the crew game now."
    ]


def test_a_stale_client_shopping_at_the_servo_is_refused_and_the_ride_rolls_on(monkeypatch):
    async def main():
        room, ws = await riding(monkeypatch, "SHOP")
        with pytest.raises(ValidationError):  # the socket loop answers "Bad message" and carries on
            await room.handle("h0", ws, {"t": "buy", "item": "plating"})
        return room

    room = asyncio.run(main())
    assert room.state == "running" and room.mode.armour == 100


def test_a_saved_room_of_a_game_that_has_gone_comes_back_as_an_empty_bus_lobby():
    snap = {"code": "OLDC", "game": "climate", "state": "running", "host": "h0", "riders": [{"id": "h0"}]}
    room = session.Room.from_dict({**snap, "plan_id": "x", "minutes": 0, "plan": {}, "el": 9, "mode": {}})
    assert (room.code, room.game, room.state, room.riders) == ("OLDC", "bus", "lobby", {})


def test_a_bus_snapshot_with_fields_riders_no_longer_keep_still_restores(monkeypatch):
    async def main():
        room, _ = await riding(monkeypatch, "SNAP")
        return room.to_dict()

    d = asyncio.run(main())
    d["riders"][0]["rs_spikes"] = 3  # power shape, kept for the games that have gone
    assert session.Room.from_dict(d).riders["h0"].name


def test_titles_of_games_that_have_gone_are_not_worn(tmp_path):
    store = Store(tmp_path / "t.db")
    with store.db:
        store.db.execute("INSERT INTO titles VALUES (?, ?, ?)", ("🚑 Paramedic of the Week", "a", "Al"))
    store.take_titles([{"award": "Fell Off King", "id": "a", "name": "Al"}])
    assert store.titles_of("a") == ["👑 Fell Off King"]

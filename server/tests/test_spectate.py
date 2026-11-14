"""TV spectators: no seat, same broadcasts, never affect the game."""

import asyncio

from test_bots import SHORT
from test_resume import FakeWS, join, ride

from zombie_bus_server import config
from zombie_bus_server.plan import generate
from zombie_bus_server.session import Room

ACTIONS = [
    {"t": "data", "p": 400, "w": 400, "cad": 90, "s": 1},
    {"t": "sprint", "blk": 2, "dur": 10, "avg": 300, "pct": 1, "grade": "MEGA", "combo": 1},
    {"t": "tier", "tier": "easy"},
    {"t": "buy", "item": "plating"},
    {"t": "start"},
    {"t": "setup", "plan": "bus-crew-45", "minutes": 30},
    {"t": "bots", "n": 3},
    {"t": "end"},
]


def new_room() -> Room:
    room = Room("TVTV")
    room.plan = generate(SHORT, 0)
    return room


def test_spectator_gets_broadcasts_and_holds_no_seat():
    async def main():
        room, ws, tv = new_room(), FakeWS(), FakeWS()
        await room.handle("h0", ws, join("H0"))
        await room.handle("h0", tv, {"t": "watch"})  # same account, second device
        assert [m["t"] for m in tv.sent] == ["lobby"]
        assert len(room.riders) == 1 and room.riders["h0"].ws is ws
        for n in range(1, config.MAX_RIDERS):
            await room.handle(f"h{n}", FakeWS(), join(f"H{n}"))
        await room.handle("spec", FakeWS(), {"t": "watch"})
        assert len(room.humans()) == config.MAX_RIDERS and "spec" not in room.riders
        await room.handle("h0", ws, {"t": "start"})
        await ride(room, ws, "h0", 3)
        assert any(m["t"] == "tick" for m in tv.sent)
        await room.finish()
        assert tv.sent[-1]["t"] == "lobby" and any(m["t"] == "end" for m in tv.sent)
        late = FakeWS()  # joining after the end still gets the summary
        await room.handle("h0", late, {"t": "watch"})
        assert [m["t"] for m in late.sent] == ["lobby", "end"]

    asyncio.run(main())


def test_spectator_cannot_act_even_as_the_host():
    async def main():
        room, ws, tv = new_room(), FakeWS(), FakeWS()
        await room.handle("h0", ws, join("H0"))
        await room.handle("h0", tv, {"t": "watch"})

        def snap():
            return (room.plan_id, room.minutes, room.state, len(room.riders), room.riders["h0"].tier)

        before = snap()
        for a in ACTIONS:
            await room.handle("h0", tv, a)
        assert snap() == before
        assert room.riders["h0"].p == 0 and not room.riders["h0"].sprints
        await room.handle("h0", tv, join("Sneaky"))  # a join from the TV socket is ignored too
        assert room.riders["h0"].name == "H0" and room.riders["h0"].ws is ws

    asyncio.run(main())


def test_spectators_do_not_keep_a_room_alive_or_leave_ghosts():
    async def main():
        room, ws, tv = new_room(), FakeWS(), FakeWS()
        await room.handle("h0", ws, join("H0"))
        await room.handle("h0", tv, {"t": "watch"})
        await room.disconnect("h0", ws)
        assert not any(x.connected for x in room.humans())  # idle logic sees nobody
        assert room.watchers == [tv]
        await room.disconnect("h0", tv)
        assert room.watchers == [] and "h0" not in room.riders  # a lobby seat is freed
        await room.handle("h0", FakeWS(), join("H0"))  # coming back takes a seat again
        assert room.riders["h0"].connected

    asyncio.run(main())


def test_dead_spectator_socket_is_dropped():
    async def main():
        class Dead(FakeWS):
            async def send_json(self, msg):
                if self.sent:
                    raise RuntimeError("gone")
                await super().send_json(msg)

        room, ws, tv = new_room(), FakeWS(), Dead()
        await room.handle("h0", ws, join("H0"))
        await room.handle("h0", tv, {"t": "watch"})
        await room.lobby()
        assert room.watchers == []

    asyncio.run(main())

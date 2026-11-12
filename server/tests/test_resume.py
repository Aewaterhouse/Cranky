"""Room snapshots: a restart resumes the ride from the saved clock."""

import asyncio
import json
import sqlite3

from test_multiplayer import PLAN

from zombie_bus_server import config
from zombie_bus_server.plan import generate
from zombie_bus_server.session import Room
from zombie_bus_server.store import Store


class FakeWS:
    def __init__(self):
        self.sent: list[dict] = []

    async def send_json(self, msg):
        self.sent.append(msg)


def join(name, ftp=250):
    return {"t": "join", "name": name, "ftp": ftp, "tier": "hard", "look": {"hat": "cap"}}


async def ride(room, ws, rid, secs):
    """Feeds on-target data for riders until the room clock has moved `secs`."""
    end = room.el + secs
    while room.el < end and room.state == "running":
        for r in room.riders.values():
            if r.connected:
                await room.handle(r.id, ws, {"t": "data", "p": 250, "w": 250, "cad": 90, "s": 0.95})
        await asyncio.sleep(0.01)


def test_room_resumes_after_restart(tmp_path):
    async def main():
        store = Store(tmp_path / "a.db")
        room = Room("ABCD", store)
        room.plan = generate(PLAN, 0)
        ws = FakeWS()
        await room.handle("alex", ws, join("Alex"))
        await room.handle("luke", ws, join("Luke", 200))
        await room.handle("alex", ws, {"t": "start"})
        await ride(room, ws, "alex", 80)
        await room.handle(
            "alex", ws, {"t": "sprint", "blk": 3, "dur": 10, "avg": 700, "pct": 1, "grade": "MEGA"}
        )
        room.task.cancel()
        room.save()
        return room, store

    room, store = asyncio.run(main())
    assert room.state == "running" and room.el > 70 and room.mode.dist > 0

    snaps = store.load_rooms(config.ROOM_RESUME_MAX_AGE_S)
    assert [s["code"] for s in snaps] == ["ABCD"]
    json.dumps(snaps[0])

    async def after():
        new = Room.from_dict(snaps[0], store)
        assert new.paused and new.task is None
        assert not any(r.connected for r in new.riders.values())
        assert new.el == room.el and new.plan == room.plan and new.host == "alex"
        assert new.mode.to_dict() == room.mode.to_dict()
        for rid, r in room.riders.items():
            old = r.to_dict()
            assert new.riders[rid].to_dict() == old and old["look"] == {"hat": "cap"}
        assert new.riders["alex"].comp_n > 0 and new.riders["alex"].sprints == ["MEGA"]

        el = new.el
        await asyncio.sleep(0.1)
        assert new.el == el  # clock is paused until someone returns
        ws = FakeWS()
        await new.handle("alex", ws, join("Alex"))
        await ride(new, ws, "alex", 5)
        assert not new.paused and new.el > el + 4
        assert any(m["t"] == "tick" and m["riders"]["alex"]["st"] == "riding" for m in ws.sent)
        new.task.cancel()

    asyncio.run(after())


def test_running_room_keeps_snapshotting_and_finish_deletes_it(tmp_path):
    async def main():
        store = Store(tmp_path / "b.db")
        room = Room("WXYZ", store)
        room.plan = generate(PLAN, 0)
        ws = FakeWS()
        await room.handle("alex", ws, join("Alex"))
        assert store.load_rooms(900)[0]["state"] == "lobby"
        config.SNAPSHOT_S, old = 0.01, config.SNAPSHOT_S
        try:
            await room.handle("alex", ws, {"t": "start"})
            await ride(room, ws, "alex", 20)
            assert store.load_rooms(900)[0]["el"] > 0
        finally:
            config.SNAPSHOT_S = old
        await room.handle("alex", ws, {"t": "end"})
        assert room.state == "done" and store.load_rooms(900) == []

    asyncio.run(main())


def test_old_snapshots_are_dropped(tmp_path):
    store = Store(tmp_path / "c.db")
    store.save_room("OLD1", {"code": "OLD1"})
    store.save_room("NEW1", {"code": "NEW1"})
    with sqlite3.connect(tmp_path / "c.db") as db:
        db.execute("UPDATE rooms SET saved_at = saved_at - 1000 WHERE code = 'OLD1'")
    assert [s["code"] for s in store.load_rooms(config.ROOM_RESUME_MAX_AGE_S)] == ["NEW1"]
    assert [s["code"] for s in store.load_rooms(0.0)] == []

"""Road rooms: the bus room's lobby, sockets, spectators and snapshots around a `RoadSim`."""

from __future__ import annotations

import asyncio
import random
import time
from typing import TYPE_CHECKING

from fastapi import WebSocket

from . import config as C
from . import road_bots
from .modes.road import RoadSim
from .protocol import Bots, ClientMsg, Data, End, Join, RoadSetup, Start, Watch
from .ride_stats import profile_kg
from .road_route import load_lap
from .session import Rider, Room

if TYPE_CHECKING:
    from .store import Store


class RoadRoom(Room):
    """A group ride on a route. The host picks the route, laps and options; the server owns the positions."""

    kind = "road"

    def __init__(self, code: str, store: Store | None = None) -> None:
        super().__init__(code, store)
        self.route, self.laps = C.ROAD_DEFAULT_ROUTE, C.ROAD_DEFAULT_LAPS
        self.style, self.together, self.drafting = "social", True, C.DRAFT_DEFAULT
        self.sim: RoadSim | None = None
        self.rngs: dict[str, random.Random] = {}
        self.empty_s = 0.0
        self.plan = {"name": load_lap(self.route).name}  # what the list of open rooms shows

    def kg_of(self, rid: str) -> float:
        """A rider's weight from their stored profile; a bot's from its card."""
        if rid in road_bots.BOTS:
            return road_bots.BOTS[rid][2]
        profile = self.store.get_profile(rid) if self.store else None
        return float((profile or {}).get("weightKg") or C.ROAD_DEFAULT_KG)

    def weight_of(self, rid: str) -> float | None:
        """The weight a rider set (a bot's from its card), or None: no W/kg on the crew cards."""
        return road_bots.BOTS[rid][2] if rid in road_bots.BOTS else profile_kg(self.store, rid)

    def lobby_msg(self) -> dict:
        lap = load_lap(self.route)
        return {
            "t": "lobby",
            "kind": "road",
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "route": self.route,
            "laps": self.laps,
            "distance": lap.distance * self.laps,
            "style": self.style,
            "together": self.together,
            "draft": self.drafting,
            "riders": [
                {
                    "id": r.id,
                    "name": r.name,
                    "ftp": r.ftp,
                    "kg": self.kg_of(r.id),
                    "weightKg": self.weight_of(r.id),
                    "connected": r.connected,
                    "look": r.look,
                    "bot": r.bot,
                    "line": road_bots.BOTS[r.id][4] if r.bot else None,
                }
                for r in self.riders.values()
            ],
        }

    def to_dict(self) -> dict:
        return {
            "kind": "road",
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "route": self.route,
            "laps": self.laps,
            "style": self.style,
            "together": self.together,
            "draft": self.drafting,
            "riders": [r.to_dict() for r in self.riders.values()],
            "sim": self.sim.to_dict() if self.sim else None,
        }

    @classmethod
    def from_dict(cls, d: dict, store: Store | None = None) -> RoadRoom:
        """Rebuilds a room with every rider disconnected. A running ride stays paused until a rider joins."""
        room = cls(d["code"], store)
        room.host, room.state, room.route, room.laps = d["host"], d["state"], d["route"], d["laps"]
        room.style, room.together = d["style"], d["together"]
        room.drafting = d.get("draft", C.DRAFT_DEFAULT)
        room.plan = {"name": load_lap(room.route).name}
        room.riders = {x["id"]: Rider.from_dict(x) for x in d["riders"]}
        room.sim = RoadSim.from_dict(d["sim"]) if d["sim"] else None
        room.paused = room.state == "running"
        for r in room.riders.values():
            r.connected = r.bot
        return room

    async def join(self, rid: str, ws: WebSocket, msg: Join) -> None:
        r = self.riders.get(rid)
        if r:
            r.name, r.ftp, r.look = msg.name, msg.ftp, msg.look
        else:
            if len(self.riders) >= C.ROAD_MAX_RIDERS:
                bots = sum(x.bot for x in self.riders.values())
                if self.state == "running" or not bots:
                    await ws.send_json({"t": "error", "msg": "That ride is full. Start another one."})
                    return
                road_bots.set_bots(self, bots - 1)
            r = self.riders[rid] = Rider(rid, msg.name, msg.ftp, "hard", look=msg.look)
            if self.state == "running" and self.sim:  # late: on the back of the group
                self.sim.add(rid, self.kg_of(rid), r.ftp)
        r.ws, r.connected, r.last_data = ws, True, time.monotonic()
        if self.paused:
            self.paused = False
            self.task = asyncio.create_task(self.run())
        if self.host is None or not self.riders[self.host].connected:
            self.host = rid
        if self.state == "lobby":
            road_bots.assume_ftps(self)
        await self.lobby()
        if self.state == "done" and self.summary:
            await self.send(r, {"t": "end", "summary": self.summary})

    async def handle(self, rid: str, ws: WebSocket, raw: dict) -> None:
        """Applies one client message."""
        msg = ClientMsg.validate_python(raw)
        if isinstance(msg, Watch):
            return await self.watch(ws)
        if ws in self.watchers:
            return
        if isinstance(msg, Join):
            return await self.join(rid, ws, msg)
        r = self.riders.get(rid)
        if not r:
            return
        if isinstance(msg, Data):
            r.p, r.w, r.cad, r.hr, r.last_data = msg.p, msg.w, msg.cad, msg.hr or None, time.monotonic()
        elif not isinstance(msg, RoadSetup | Bots | Start | End):
            return
        elif rid != self.host:
            await self.send(r, {"t": "error", "msg": "Only the host can do that."})
        elif isinstance(msg, RoadSetup) and self.state != "running":
            try:
                lap = load_lap(msg.route)
            except KeyError:
                return await self.send(r, {"t": "error", "msg": f"Unknown route {msg.route}"})
            self.route, self.laps = msg.route, max(1, min(lap.laps_max(), msg.laps))
            self.style, self.state, self.plan = msg.style, "lobby", {"name": lap.name}
            self.together = msg.style == "social" if msg.together is None else msg.together
            self.drafting = msg.draft or self.drafting
            await self.lobby()
        elif isinstance(msg, Bots) and self.state != "running":
            road_bots.set_bots(self, msg.n)
            await self.lobby()
        elif isinstance(msg, Start) and self.state != "running":
            self.start()
            await self.lobby()
        elif isinstance(msg, End) and self.state == "running":
            await self.finish()

    def start(self) -> None:
        road_bots.assume_ftps(self)
        self.sim = RoadSim(self.route, self.laps, self.together, drafting=self.drafting)
        for r in self.riders.values():
            self.sim.add(r.id, self.kg_of(r.id), r.ftp, r.bot)
        self.state, self.summary, self.empty_s = "running", None, 0.0
        self.task = asyncio.create_task(self.run())

    async def run(self) -> None:
        dt = 1 / C.ROAD_TICK_HZ
        while self.state == "running" and self.sim:
            await asyncio.sleep(dt / C.TIME_SCALE)
            tick = self.step(dt)
            self.empty_s = 0.0 if any(r.connected for r in self.humans()) else self.empty_s + dt
            if self.sim.rules.over(self.sim) or self.empty_s > C.ROAD_ABANDON_S:
                await self.broadcast(tick)
                await self.finish()
                return
            await self.broadcast(tick)
            if time.monotonic() - self.saved_at >= C.SNAPSHOT_S:
                self.save()

    def step(self, dt: float) -> dict:
        """Feeds the riders' latest power to the sim, advances it one tick and returns the tick message."""
        sim, now = self.sim, time.monotonic()
        assert sim
        road_bots.drive(self, self.rngs)
        for r in self.riders.values():
            m = sim.movers[r.id]
            fresh = r.bot or (r.connected and now - r.last_data <= C.STALE_DATA_S)
            m.p, m.cad, m.hr, m.here = (r.p if fresh else 0.0), (r.cad if fresh else 0.0), r.hr, r.connected
        fx = sim.step(dt)
        return {
            "t": "tick",
            "kind": "road",
            "el": round(sim.el, 2),
            "riders": sim.riders(),
            "game": sim.rules.state(sim),
            "fx": fx,
        }

    async def finish(self) -> None:
        self.state = "done"
        if self.task and self.task is not asyncio.current_task():
            self.task.cancel()
        sim, lap = self.sim, load_lap(self.route)
        assert sim
        rows = [{**x, "name": self.riders[x["id"]].name} for x in sim.rules.results(sim)]
        self.summary = {
            "kind": "road",
            "route": self.route,
            "name": lap.name,
            "laps": self.laps,
            "distance": sim.road.distance,
            "secs": round(max(0.0, sim.el)),
            "style": self.style,
            "together": self.together,
            "riders": rows,
        }
        await self.broadcast({"t": "end", "summary": self.summary})
        await self.lobby()

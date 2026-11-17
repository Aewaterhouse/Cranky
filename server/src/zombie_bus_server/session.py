"""Rooms: riders, lobby, server-owned clock and 2 Hz broadcast."""

from __future__ import annotations

import asyncio
import random
import time
from typing import TYPE_CHECKING

from fastapi import WebSocket

from . import bots, discord, room_handle, room_tick
from . import config as C
from .modes.common import counted, mark_test
from .modes.zombie_bus import ZombieBus, roll_weather, weekly_mutator
from .plan import generate, load_plans, total
from .rider import Rider

if TYPE_CHECKING:
    from .store import Store

__all__ = ["MODES", "Rider", "Room"]
MODES = {"bus": ZombieBus}


class Room:
    """A crew session. The host picks the plan; the server owns the clock."""

    kind = "bus"

    def __init__(self, code: str, store: Store | None = None) -> None:
        self.code = code
        self.store = store
        self.paused = False  # a restored running room waits for its first rider
        self.saved_at = 0.0
        self.brains: dict[str, bots.Brain] = {}
        self.acts: dict[str, list[float]] = {}  # when each rider's recent game inputs arrived
        self.load = 1.0
        self.riders: dict[str, Rider] = {}
        self.watchers: list[WebSocket] = []  # TV spectators: no seat, never counted
        self.host: str | None = None
        self.state = "lobby"
        self.plan_id = "bus-crew-45"
        self.minutes = 0
        self.difficulty = "normal"
        self.campaign = False  # this bus ride is the crew's next campaign leg
        self.trainers = "choose"  # erg, gears or choose: the host's pick for this ride
        self.game = "bus"
        self.plan = generate(load_plans()[self.plan_id], 0)
        self.el = 0.0
        self.mode = ZombieBus()
        self.task: asyncio.Task | None = None
        self.idle_since = time.monotonic()
        self.summary: dict | None = None

    async def send(self, r: Rider, msg: dict) -> None:
        if r.ws and r.connected:
            try:
                await r.ws.send_json(msg)
            except Exception:  # noqa: BLE001 - a dead socket is cleaned up by its handler
                r.connected = False

    async def broadcast(self, msg: dict) -> None:
        await asyncio.gather(
            *(self.send(r, msg) for r in self.riders.values()), *(self.tell(w, msg) for w in self.watchers)
        )

    async def tell(self, ws: WebSocket, msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception:  # noqa: BLE001 - a dead spectator is dropped
            self.unwatch(ws)

    def unwatch(self, ws: WebSocket) -> None:
        if ws in self.watchers:
            self.watchers.remove(ws)

    async def lobby(self) -> None:
        """Snapshots the room and broadcasts the lobby."""
        self.save()
        await self.broadcast(self.lobby_msg())

    def to_dict(self) -> dict:
        return {
            "kind": "bus",
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "plan_id": self.plan_id,
            "minutes": self.minutes,
            "difficulty": self.difficulty,
            "campaign": self.campaign,
            "trainers": self.trainers,
            "game": self.game,
            "plan": self.plan,
            "el": self.el,
            "riders": [r.to_dict() for r in self.riders.values()],
            "mode": self.mode.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: dict, store: Store | None = None) -> Room:
        """Rebuilds a room with every rider disconnected. A running room stays paused until a rider joins."""
        room = cls(d["code"], store)
        if d.get("game", "bus") not in MODES:  # a room of a game that has gone: an empty bus lobby
            return room
        room.host, room.state, room.plan_id = d["host"], d["state"], d["plan_id"]
        room.minutes, room.plan, room.el = d["minutes"], d["plan"], d["el"]
        room.difficulty = d.get("difficulty", "normal")
        room.campaign = d.get("campaign", False)
        room.trainers = d.get("trainers", "choose")
        room.riders = {x["id"]: Rider.from_dict(x) for x in d["riders"]}
        room.mode = ZombieBus.from_dict(d["mode"])
        room.paused = room.state == "running"
        for r in room.riders.values():
            r.connected = r.bot
        return room

    def save(self) -> None:
        """Writes the snapshot, or deletes it once the room is done."""
        if not self.store or not self.riders:
            return
        self.saved_at = time.monotonic()
        if self.state == "done":
            self.store.delete_room(self.code)
        else:
            self.store.save_room(self.code, self.to_dict())

    def lobby_msg(self) -> dict:
        return {
            "t": "lobby",
            "kind": "bus",
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "plan": self.plan,
            "minutes": self.minutes,
            "mutator": weekly_mutator() if self.difficulty != "easy" else None,
            "difficulty": self.difficulty,
            "trainers": self.trainer_mode,
            "game": self.game,
            "trophies": self.store.legends() if hasattr(self.store, "legends") else 0,
            "campaign": self.campaign_view(),
            "riders": [
                {
                    "id": r.id,
                    "name": r.name,
                    "tier": r.tier,
                    "ftp": r.ftp,
                    "connected": r.connected,
                    "look": r.look,
                    "bot": r.bot,
                    "erg": self.erg_of(r),
                    "titles": self.titles(r.id),
                    "ready": r.ready or r.bot,
                    "sim": r.sim,
                }
                for r in self.riders.values()
            ],
        }

    def campaign_view(self) -> dict | None:
        """The campaign leg this bus ride counts as, for the lobby, or None when it is a one-off."""
        if not (self.campaign and hasattr(self.store, "campaign")):
            return None
        c, stops = self.store.campaign(), C.CAMPAIGN_STOPS
        return {
            "leg": c["leg"] + 1,
            "of": len(stops) - 1,
            "from": stops[c["leg"]],
            "to": stops[c["leg"] + 1],
            "armour": c["armour"],
            "stops": stops,
            "trips": c["trips"],
        }

    def titles(self, rid: str) -> list[str]:
        """The held titles a rider wears in the lobby (test stand-ins for the store may have none)."""
        lookup = getattr(self.store, "titles_of", None)
        return lookup(rid) if lookup else []

    def humans(self) -> list[Rider]:
        return [r for r in self.riders.values() if not r.bot]

    async def disconnect(self, rid: str, ws: WebSocket) -> None:
        if ws in self.watchers:
            return self.unwatch(ws)
        r = self.riders.get(rid)
        if r and r.ws is ws:
            r.connected = False
            if self.host == rid:
                self.host = next((x.id for x in self.humans() if x.connected), rid)
            # In the lobby a seat is only a seat: free it (a rider who comes back just joins again).
            # During a ride the seat waits, so a dropped rider can rejoin where they were.
            if self.state == "lobby" and not r.connected:
                del self.riders[rid]
            if not any(x.connected for x in self.humans()):
                self.idle_since = time.monotonic()
            await self.lobby()

    async def watch(self, ws: WebSocket) -> None:
        """Seats a TV spectator and catches it up."""
        if ws not in self.watchers:
            self.watchers.append(ws)
        await self.tell(ws, self.lobby_msg())
        if self.state == "done" and self.summary:
            await self.tell(ws, {"t": "end", "summary": self.summary})

    async def handle(self, rid: str, ws: WebSocket, raw: dict) -> None:
        """Applies one client message."""
        await room_handle.handle(self, rid, ws, raw)

    @property
    def trainer_mode(self) -> str:
        """The ride's trainer mode: the host's pick (erg, gears or choose)."""
        return self.trainers

    def erg_of(self, r: Rider) -> bool:
        """Whether the rider is on ERG: the ride's mode, or the rider's own when they choose."""
        return r.erg if self.trainer_mode == "choose" else self.trainer_mode == "erg"

    def aim(self, r: Rider, i: int, bel: float) -> int | None:
        """A rider's target watts in block `i`, from the plan and the rider's tier."""
        return r.target(self.plan["blocks"][i], bel, self.load) if i >= 0 else None

    def deal(self) -> None:
        """Builds the plan from the picked workout."""
        self.plan = generate(load_plans()[self.plan_id], self.minutes)

    def start(self) -> None:
        mode = ZombieBus(self.difficulty, weekly_mutator() if self.difficulty != "easy" else None)
        mode.weather = roll_weather(random.Random())
        if self.campaign_view():
            mode.armour = float(self.store.campaign()["armour"])
        self.state, self.el, self.mode, self.summary = ("running", -float(C.COUNTDOWN_S), mode, None)
        for r in self.riders.values():
            r.reset_stats()
        self.task = asyncio.create_task(self.run())

    async def run(self) -> None:
        dt = 1 / C.TICK_HZ
        total_s = total(self.plan["blocks"])
        while self.state == "running":
            await asyncio.sleep(dt / C.TIME_SCALE)
            self.el += dt
            if self.el >= total_s:
                await self.finish()
                return
            await self.broadcast(self.step(dt))
            if time.monotonic() - self.saved_at >= C.SNAPSHOT_S:
                self.save()

    def step(self, dt: float) -> dict:
        """Advances the session one tick and returns the tick message."""
        return room_tick.step(self, dt)

    async def finish(self) -> None:
        self.state = "done"
        if self.task and self.task is not asyncio.current_task():
            self.task.cancel()
        self.summary = self.mode.summary(self)
        mark_test(self.summary, self.riders)
        # Test riders (simulator) count for nothing: the records see the real riders only, or nothing at all.
        real = counted(self.summary)
        if self.store and real and real.get("score") is not None:  # the crew's best before this ride
            self.summary["crewBest"] = self.store.crew_best(self.game, real["score"])
        if real and self.campaign_view():
            self.summary["campaign"] = self.store.ride_leg(real["armour"])
        if real and hasattr(self.store, "take_titles") and real.get("awards"):
            self.summary["titles"] = self.store.take_titles(real["awards"])
        await self.broadcast({"t": "end", "summary": self.summary})
        if not real:
            return await self.lobby()
        if self.store:  # the season ladder
            self.store.add_result(self.plan["name"], {**real, "game": self.game})
        text = discord.format_summary(self.plan["name"], real)
        self.chat = asyncio.create_task(asyncio.to_thread(discord.post, text))
        await self.lobby()

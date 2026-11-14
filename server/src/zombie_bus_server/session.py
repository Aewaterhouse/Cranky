"""Rooms: riders, lobby, server-owned clock and 2 Hz broadcast."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from fastapi import WebSocket

from . import bots, discord, room_handle, room_tick
from . import config as C
from .modes.ambulance import Ambulance
from .modes.climate import Climate
from .modes.dating import Dating
from .modes.vo2_madness import Vo2Madness
from .modes.zombie_bus import ZombieBus, weekly_mutator
from .plan import generate, load_plans, total
from .rider import Rider

if TYPE_CHECKING:
    from .store import Store

__all__ = ["MODES", "Rider", "Room"]
MODES = {"bus": ZombieBus, "madness": Vo2Madness, "ambo": Ambulance, "date": Dating, "climate": Climate}


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
        room.host, room.state, room.plan_id = d["host"], d["state"], d["plan_id"]
        room.minutes, room.plan, room.el = d["minutes"], d["plan"], d["el"]
        room.difficulty = d.get("difficulty", "normal")
        room.trainers = d.get("trainers", "choose")
        room.riders = {x["id"]: Rider.from_dict(x) for x in d["riders"]}
        room.game = d.get("game", "bus")
        room.mode = MODES[room.game].from_dict(d["mode"])
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
            "mutator": weekly_mutator() if self.difficulty != "easy" and self.game == "bus" else None,
            "difficulty": self.difficulty,
            "trainers": self.trainer_mode,
            "game": self.game,
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
                }
                for r in self.riders.values()
            ],
        }

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
        """The ride's trainer mode: the host's pick, or gears for everyone in a game that is never on ERG."""
        return "gears" if MODES[self.game].no_erg else self.trainers

    def erg_of(self, r: Rider) -> bool:
        """Whether the rider is on ERG: the ride's mode, or the rider's own when they choose."""
        return r.erg if self.trainer_mode == "choose" else self.trainer_mode == "erg"

    def aim(self, r: Rider, i: int, bel: float) -> tuple[int | None, tuple[int, int] | str | None]:
        """A rider's target watts and band in block `i`: the game's band if it sets one, else the plan's."""
        band = self.mode.band(self, r, i, bel) if i >= 0 else None
        if band is None:
            return (r.target(self.plan["blocks"][i], bel, self.load) if i >= 0 else None), None
        if isinstance(band, str):
            return None, band
        lo, hi = r.band_w(*band)
        return round((lo + hi) / 2), (lo, hi)

    def deal(self) -> None:
        """Builds the plan for the chosen game: its own (a fresh one each time), or the picked workout."""
        self.plan = MODES[self.game].deal(self.minutes) or generate(load_plans()[self.plan_id], self.minutes)

    def start(self) -> None:
        # a game that deals its own plan deals again, so nobody has seen the order in the lobby
        self.plan = MODES[self.game].deal(self.minutes) or self.plan
        self.state, self.el, self.mode, self.summary = (
            "running",
            -float(C.COUNTDOWN_S),
            MODES[self.game](self.difficulty),
            None,
        )
        for r in self.riders.values():
            r.reset_stats()
        self.mode.begin(self)
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
        await self.broadcast({"t": "end", "summary": self.summary})
        if self.store and self.game == "bus":  # the season ladder ranks bus scores only
            self.store.add_result(self.plan["name"], self.summary)
        text = discord.format_summary(self.plan["name"], self.summary)
        self.chat = asyncio.create_task(asyncio.to_thread(discord.post, text))
        await self.lobby()

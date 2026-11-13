"""Rooms: riders, lobby, server-owned clock and 2 Hz broadcast."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field, fields
from typing import TYPE_CHECKING

from fastapi import WebSocket

from . import bots, discord
from . import config as C
from .modes.zombie_bus import ZombieBus, weekly_mutator
from .plan import block_target, event_for, generate, load_plans, locate, total
from .protocol import (
    Bots,
    Buy,
    ClientMsg,
    Data,
    Difficulty,
    End,
    Join,
    Setup,
    Sprint,
    Start,
    Tick,
    TierMsg,
    Watch,
)

if TYPE_CHECKING:
    from .store import Store

NOT_SAVED = ("ws", "connected", "last_data")


@dataclass
class Rider:
    """One rider slot. Survives disconnects for the life of the room."""

    id: str
    name: str
    ftp: int
    tier: str
    ws: WebSocket | None = None
    connected: bool = False
    last_data: float = 0.0
    p: float = 0.0
    w: float = 0.0
    cad: float = 0.0
    s: float | None = None
    hr: int | None = None
    hrp: float | None = None
    st: str = "riding"
    low_s: float = 0.0
    zero_s: float = 0.0
    fell_cool_until: float = 0.0
    comp_sum: float = 0.0
    comp_n: int = 0
    band_s: float = 0.0
    falls: int = 0
    rb_dmg: float = 0.0
    mega: int = 0
    sync_hits: int = 0
    sync_n: int = 0
    sprints: list[str] = field(default_factory=list)
    look: dict[str, str] = field(default_factory=dict)
    bot: bool = False

    def reset_stats(self) -> None:
        fresh = Rider(
            self.id, self.name, self.ftp, self.tier, self.ws, self.connected, look=self.look, bot=self.bot
        )
        self.__dict__.update(
            {k: v for k, v in fresh.__dict__.items() if k not in ("ws", "connected", "last_data")}
        )

    def to_dict(self) -> dict:
        """JSON-safe snapshot of everything except the socket and liveness."""
        return {f.name: getattr(self, f.name) for f in fields(self) if f.name not in NOT_SAVED}

    @classmethod
    def from_dict(cls, d: dict) -> Rider:
        return cls(**d)

    def target(self, b: dict, bel: float) -> int | None:
        f = block_target(b, self.tier, bel)
        return None if f is None else min(round(f * self.ftp), round(self.ftp * 1.5))


class Room:
    """A crew session. The host picks the plan; the server owns the clock."""

    def __init__(self, code: str, store: Store | None = None) -> None:
        self.code = code
        self.store = store
        self.paused = False  # a restored running room waits for its first rider
        self.saved_at = 0.0
        self.brains: dict[str, bots.Brain] = {}
        self.riders: dict[str, Rider] = {}
        self.watchers: list[WebSocket] = []  # TV spectators: no seat, never counted
        self.host: str | None = None
        self.state = "lobby"
        self.plan_id = "bus-crew-45"
        self.minutes = 0
        self.difficulty = "normal"
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
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "plan_id": self.plan_id,
            "minutes": self.minutes,
            "difficulty": self.difficulty,
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
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "plan": self.plan,
            "minutes": self.minutes,
            "mutator": weekly_mutator() if self.difficulty != "easy" else None,
            "difficulty": self.difficulty,
            "riders": [
                {
                    "id": r.id,
                    "name": r.name,
                    "tier": r.tier,
                    "ftp": r.ftp,
                    "connected": r.connected,
                    "look": r.look,
                    "bot": r.bot,
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

    async def handle(self, rid: str, ws: WebSocket, raw: dict) -> None:
        """Applies one client message."""
        msg = ClientMsg.validate_python(raw)
        if isinstance(msg, Watch):
            if ws not in self.watchers:
                self.watchers.append(ws)
            await self.tell(ws, self.lobby_msg())
            if self.state == "done" and self.summary:
                await self.tell(ws, {"t": "end", "summary": self.summary})
            return
        if ws in self.watchers:  # spectators only watch
            return
        r = self.riders.get(rid)
        if isinstance(msg, Join):
            if r:
                r.name, r.ftp, r.look = msg.name, msg.ftp, msg.look
                if self.state != "running":
                    r.tier = msg.tier
            elif len(self.humans()) >= C.MAX_RIDERS:
                await ws.send_json(
                    {"t": "error", "msg": f"Bus full ({C.MAX_RIDERS} seats). Catch the next one."}
                )
                return
            else:
                if len(self.riders) >= C.MAX_RIDERS:  # a bot gives up its seat
                    bots.set_bots(self, len(self.riders) - len(self.humans()) - 1)
                r = self.riders[rid] = Rider(rid, msg.name, msg.ftp, msg.tier, look=msg.look)
            r.ws, r.connected, r.last_data = ws, True, time.monotonic()
            if self.paused:
                self.paused = False
                self.task = asyncio.create_task(self.run())
            if self.host is None or not self.riders[self.host].connected:
                self.host = rid
            await self.lobby()
            if self.state == "done" and self.summary:
                await self.send(r, {"t": "end", "summary": self.summary})
            return
        if not r:
            return
        if isinstance(msg, Data):
            r.p, r.w, r.cad, r.s, r.last_data = msg.p, msg.w, msg.cad, msg.s, time.monotonic()
            r.hr, r.hrp = msg.hr or None, msg.hrp if msg.hr else None
        elif isinstance(msg, Sprint):
            self.mode.on_sprint(r, msg.blk, msg.grade, msg.combo)
        elif isinstance(msg, Buy) and self.state == "running":
            self.mode.buy(r, msg.item)
        elif isinstance(msg, TierMsg):
            r.tier = msg.tier
            await self.lobby()
        elif rid != self.host:
            await self.send(r, {"t": "error", "msg": "Only the host can do that."})
        elif isinstance(msg, Setup) and self.state != "running":
            if msg.plan not in load_plans():
                await self.send(r, {"t": "error", "msg": f"Unknown plan {msg.plan}"})
                return
            self.plan_id, self.minutes, self.state = msg.plan, msg.minutes, "lobby"
            self.plan = generate(load_plans()[msg.plan], msg.minutes)
            await self.lobby()
        elif isinstance(msg, Difficulty) and self.state != "running":
            self.difficulty = msg.level
            await self.lobby()
        elif isinstance(msg, Bots) and self.state == "lobby":
            bots.set_bots(self, msg.n)
            await self.lobby()
        elif isinstance(msg, Start) and self.state != "running":
            self.start()
            await self.lobby()
        elif isinstance(msg, End) and self.state == "running":
            await self.finish()

    def start(self) -> None:
        self.state, self.el, self.mode, self.summary = (
            "running",
            -float(C.COUNTDOWN_S),
            ZombieBus(self.difficulty),
            None,
        )
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

    def update_states(self, dt: float) -> None:
        now = time.monotonic()
        for r in self.riders.values():
            if now - r.last_data > C.STALE_DATA_S:
                r.p = r.w = r.cad = 0.0
                r.s = r.hr = r.hrp = None
            r.zero_s = r.zero_s + dt if r.p < 1 else 0.0
            if not r.connected or r.zero_s >= C.SPECTATOR_NO_POWER_S:
                r.st = "spectator"
            elif r.st == "spectator" and r.zero_s == 0:
                r.st = "riding"

    def step(self, dt: float) -> dict:
        """Advances the session one tick and returns the tick message."""
        blocks = self.plan["blocks"]
        loc = locate(blocks, self.el) if self.el >= 0 else None
        i, bel = loc if loc else (-1, 0.0)
        ev = event_for(blocks, i) if i >= 0 else "warmup"
        bots.drive(self, dt, i, bel)
        self.update_states(dt)
        fx = self.mode.tick(self, dt, i, bel, ev) if i >= 0 else []
        riders = {
            r.id: {
                "name": r.name,
                "tier": r.tier,
                "tgt": r.target(blocks[i], bel) if i >= 0 else None,
                "w": round(r.w),
                "cad": round(r.cad),
                "s": r.s,
                "st": r.st,
                "hr": r.hr,
                "hrp": None if r.hrp is None else round(r.hrp, 2),
            }
            for r in self.riders.values()
        }
        tick = Tick(el=self.el, i=i, bel=bel, ev=ev, riders=riders, bus=self.mode.state(self, i, bel), fx=fx)
        return tick.model_dump()

    async def finish(self) -> None:
        self.state = "done"
        if self.task and self.task is not asyncio.current_task():
            self.task.cancel()
        self.summary = self.mode.summary(self)
        await self.broadcast({"t": "end", "summary": self.summary})
        if self.store:
            self.store.add_result(self.plan["name"], self.summary)
        text = discord.format_summary(self.plan["name"], self.summary)
        self.chat = asyncio.create_task(asyncio.to_thread(discord.post, text))
        await self.lobby()

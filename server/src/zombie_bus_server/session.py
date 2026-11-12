"""Rooms: riders, lobby, server-owned clock and 2 Hz broadcast."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

from fastapi import WebSocket

from . import config as C
from .modes.zombie_bus import ZombieBus
from .plan import block_target, event_for, generate, load_plans, locate, total
from .protocol import Buy, ClientMsg, Data, End, Join, Setup, Sprint, Start, Tick, TierMsg


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

    def reset_stats(self) -> None:
        fresh = Rider(self.id, self.name, self.ftp, self.tier, self.ws, self.connected, look=self.look)
        self.__dict__.update(
            {k: v for k, v in fresh.__dict__.items() if k not in ("ws", "connected", "last_data")}
        )

    def target(self, b: dict, bel: float) -> int | None:
        f = block_target(b, self.tier, bel)
        return None if f is None else min(round(f * self.ftp), round(self.ftp * 1.5))


class Room:
    """A crew session. The host picks the plan; the server owns the clock."""

    def __init__(self, code: str) -> None:
        self.code = code
        self.riders: dict[str, Rider] = {}
        self.host: str | None = None
        self.state = "lobby"
        self.plan_id = "bus-crew-45"
        self.minutes = 0
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
        await asyncio.gather(*(self.send(r, msg) for r in self.riders.values()))

    def lobby_msg(self) -> dict:
        return {
            "t": "lobby",
            "code": self.code,
            "host": self.host,
            "state": self.state,
            "plan": self.plan,
            "minutes": self.minutes,
            "riders": [
                {
                    "id": r.id,
                    "name": r.name,
                    "tier": r.tier,
                    "ftp": r.ftp,
                    "connected": r.connected,
                    "look": r.look,
                }
                for r in self.riders.values()
            ],
        }

    async def connect(self, rid: str, ws: WebSocket) -> None:
        r = self.riders.get(rid)
        if r:
            r.ws, r.connected = ws, True

    async def disconnect(self, rid: str, ws: WebSocket) -> None:
        r = self.riders.get(rid)
        if r and r.ws is ws:
            r.connected = False
            if self.host == rid:
                self.host = next((x.id for x in self.riders.values() if x.connected), rid)
            if not any(x.connected for x in self.riders.values()):
                self.idle_since = time.monotonic()
            await self.broadcast(self.lobby_msg())

    async def handle(self, rid: str, ws: WebSocket, raw: dict) -> None:
        """Applies one client message."""
        msg = ClientMsg.validate_python(raw)
        r = self.riders.get(rid)
        if isinstance(msg, Join):
            if r:
                r.name, r.ftp, r.look = msg.name, msg.ftp, msg.look
                if self.state != "running":
                    r.tier = msg.tier
            else:
                r = self.riders[rid] = Rider(rid, msg.name, msg.ftp, msg.tier, look=msg.look)
            r.ws, r.connected, r.last_data = ws, True, time.monotonic()
            if self.host is None or not self.riders[self.host].connected:
                self.host = rid
            await self.broadcast(self.lobby_msg())
            if self.state == "done" and self.summary:
                await self.send(r, {"t": "end", "summary": self.summary})
            return
        if not r:
            return
        if isinstance(msg, Data):
            r.p, r.w, r.cad, r.s, r.last_data = msg.p, msg.w, msg.cad, msg.s, time.monotonic()
        elif isinstance(msg, Sprint):
            self.mode.on_sprint(r, msg.blk, msg.grade, msg.combo)
        elif isinstance(msg, Buy) and self.state == "running":
            self.mode.buy(r, msg.item)
        elif isinstance(msg, TierMsg):
            r.tier = msg.tier
            await self.broadcast(self.lobby_msg())
        elif rid != self.host:
            await self.send(r, {"t": "error", "msg": "Only the host can do that."})
        elif isinstance(msg, Setup) and self.state != "running":
            if msg.plan not in load_plans():
                await self.send(r, {"t": "error", "msg": f"Unknown plan {msg.plan}"})
                return
            self.plan_id, self.minutes, self.state = msg.plan, msg.minutes, "lobby"
            self.plan = generate(load_plans()[msg.plan], msg.minutes)
            await self.broadcast(self.lobby_msg())
        elif isinstance(msg, Start) and self.state != "running":
            self.start()
            await self.broadcast(self.lobby_msg())
        elif isinstance(msg, End) and self.state == "running":
            await self.finish()

    def start(self) -> None:
        self.state, self.el, self.mode, self.summary = "running", -float(C.COUNTDOWN_S), ZombieBus(), None
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

    def update_states(self, dt: float) -> None:
        now = time.monotonic()
        for r in self.riders.values():
            if now - r.last_data > C.STALE_DATA_S:
                r.p = r.w = r.cad = 0.0
                r.s = None
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
        await self.broadcast(self.lobby_msg())

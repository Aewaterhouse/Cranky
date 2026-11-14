"""What a bus room does with each client message."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from fastapi import WebSocket

from . import bots
from . import config as C
from .plan import load_plans
from .protocol import (
    Act,
    Bots,
    Buy,
    ClientMsg,
    Data,
    Difficulty,
    End,
    Erg,
    Game,
    Join,
    Setup,
    Sprint,
    Start,
    TierMsg,
    TrainerMode,
    Watch,
)
from .ride_stats import profile_kg
from .rider import Rider

if TYPE_CHECKING:
    from .session import Room


async def handle(room: Room, rid: str, ws: WebSocket, raw: dict) -> None:
    """Applies one client message."""
    msg = ClientMsg.validate_python(raw)
    if isinstance(msg, Watch):
        return await room.watch(ws)
    if ws in room.watchers:  # spectators only watch
        return
    r = room.riders.get(rid)
    if isinstance(msg, Join):
        if r:
            r.name, r.ftp, r.look = msg.name, msg.ftp, msg.look
            if room.state != "running":
                r.tier = msg.tier
        elif len(room.humans()) >= C.MAX_RIDERS:
            await ws.send_json({"t": "error", "msg": f"Bus full ({C.MAX_RIDERS} seats). Catch the next one."})
            return
        else:
            if len(room.riders) >= C.MAX_RIDERS:  # a bot gives up its seat
                bots.set_bots(room, len(room.riders) - len(room.humans()) - 1)
            r = room.riders[rid] = Rider(rid, msg.name, msg.ftp, msg.tier, look=msg.look)
        r.kg = profile_kg(room.store, rid)
        r.ws, r.connected, r.last_data = ws, True, time.monotonic()
        if room.paused:
            room.paused = False
            room.task = asyncio.create_task(room.run())
        if room.host is None or not room.riders[room.host].connected:
            room.host = rid
        await room.lobby()
        if room.state == "done" and room.summary:
            await room.send(r, {"t": "end", "summary": room.summary})
        return
    if not r:
        return
    if isinstance(msg, Data):
        r.p, r.w, r.cad, r.s, r.last_data = msg.p, msg.w, msg.cad, msg.s, time.monotonic()
        r.hr, r.hrp = msg.hr or None, msg.hrp if msg.hr else None
    elif isinstance(msg, Erg):
        r.erg = msg.on
        await room.lobby()
    elif isinstance(msg, Sprint):
        room.mode.on_sprint(r, msg.blk, msg.grade, msg.combo)
    elif isinstance(msg, Buy) and room.state == "running":
        room.mode.buy(r, msg.item)
    elif isinstance(msg, Act):
        now, (most, window) = time.monotonic(), C.ACT_LIMIT
        recent = room.acts[rid] = [t for t in room.acts.get(rid, []) if now - t < window]
        if room.state == "running" and room.el >= 0 and len(recent) < most:
            recent.append(now)
            room.mode.on_act(room, r, msg.k, msg.v)
    elif isinstance(msg, TierMsg):
        r.tier = msg.tier
        await room.lobby()
    elif rid != room.host:
        await room.send(r, {"t": "error", "msg": "Only the host can do that."})
    elif isinstance(msg, Setup) and room.state != "running":
        if msg.plan not in load_plans():
            await room.send(r, {"t": "error", "msg": f"Unknown plan {msg.plan}"})
            return
        room.plan_id, room.minutes, room.state = msg.plan, msg.minutes, "lobby"
        room.deal()
        await room.lobby()
    elif isinstance(msg, Game) and room.state != "running":
        room.game, room.state = msg.game, "lobby"
        room.deal()
        await room.lobby()
    elif isinstance(msg, TrainerMode) and room.state != "running":
        room.trainers = msg.mode
        await room.lobby()
    elif isinstance(msg, Difficulty) and room.state != "running":
        room.difficulty = msg.level
        await room.lobby()
    elif isinstance(msg, Bots) and room.state == "lobby":
        bots.set_bots(room, msg.n)
        await room.lobby()
    elif isinstance(msg, Start) and room.state != "running":
        room.start()
        await room.lobby()
    elif isinstance(msg, End) and room.state == "running":
        await room.finish()

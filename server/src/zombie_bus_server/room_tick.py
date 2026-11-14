"""One tick of a bus room: rider states, the mode's rules and the tick message."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

from . import bots
from . import config as C
from .plan import event_for, locate
from .protocol import Tick
from .ride_stats import on_target

if TYPE_CHECKING:
    from .session import Room


def update_states(room: Room, dt: float) -> None:
    now = time.monotonic()
    for r in room.riders.values():
        if now - r.last_data > C.STALE_DATA_S:
            r.p = r.w = r.cad = 0.0
            r.s = r.hr = r.hrp = None
        r.zero_s = r.zero_s + dt if r.p < 1 else 0.0
        if not r.connected or r.zero_s >= C.SPECTATOR_NO_POWER_S:
            r.st = "spectator"
        elif r.st == "spectator" and r.zero_s == 0:
            r.st = "riding"


def step(room: Room, dt: float) -> dict:
    """Advances the session one tick and returns the tick message."""
    blocks = room.plan["blocks"]
    loc = locate(blocks, room.el) if room.el >= 0 else None
    i, bel = loc if loc else (-1, 0.0)
    ev = event_for(blocks, i) if i >= 0 else "warmup"
    fallen = sum(r.st == "fell" for r in room.riders.values())
    load = room.load = 1 + min(C.FELL_LOAD_MAX, C.FELL_LOAD * fallen)
    bots.drive(room, dt, i, bel)
    update_states(room, dt)
    fx = room.mode.tick(room, dt, i, bel, ev) if i >= 0 else []
    stats = None
    if i >= 0:
        for r in room.riders.values():
            if r.st != "spectator":
                r.sample(r.p, dt)
        if round(room.el * C.TICK_HZ) % round(C.STATS_EVERY_S * C.TICK_HZ) == 0:
            stats = {
                r.id: r.report(r.ftp, r.kg, on_target(r.band_s, r.comp_n), r.falls)
                for r in room.riders.values()
            }
    riders = {
        r.id: {
            "name": r.name,
            "tier": r.tier,
            "tgt": r.target(blocks[i], bel, load) if i >= 0 else None,
            "w": round(r.w),
            "cad": round(r.cad),
            "s": r.s,
            "st": r.st,
            "hr": r.hr,
            "hrp": None if r.hrp is None else round(r.hrp, 2),
            "erg": room.erg_of(r),
        }
        for r in room.riders.values()
    }
    tick = Tick(
        el=room.el,
        i=i,
        bel=bel,
        ev=ev,
        riders=riders,
        bus=room.mode.state(room, i, bel),
        fx=fx,
        load=load,
        stats=stats,
    )
    return tick.model_dump()

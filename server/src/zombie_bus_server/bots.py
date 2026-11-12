"""Bot riders: NPCs that fill empty seats and are simulated server-side each tick."""

from __future__ import annotations

import random
import statistics
import time
from typing import TYPE_CHECKING

from . import config as C

if TYPE_CHECKING:
    from .session import Rider, Room


class Brain:
    """Per-bot behaviour state, seeded so runs are repeatable."""

    def __init__(self, seed: str) -> None:
        self.rng = random.Random(seed)
        self.comp = self.rng.uniform(*C.BOT_COMP)
        self.bad_until = 0.0
        self.bad_comp = 0.5
        self.last_i = -1
        self.combo = 0

    def compliance(self, el: float, dt: float) -> float:
        """Slow random walk, with the odd bad patch."""
        rng = self.rng
        self.comp = min(C.BOT_COMP[1], max(C.BOT_COMP[0], self.comp + rng.gauss(0, C.BOT_COMP_WALK)))
        if el >= self.bad_until and rng.random() < C.BOT_BAD_PER_S * dt:
            self.bad_until = el + rng.uniform(*C.BOT_BAD_S)
            self.bad_comp = rng.uniform(*C.BOT_BAD_COMP)
        return self.bad_comp if el < self.bad_until else self.comp

    def step(self, room: Room, r: Rider, dt: float, i: int, bel: float, cad: float) -> None:
        """Sets the rider's power, cadence and compliance for this tick; reports a finished sprint."""
        blocks, rng = room.plan["blocks"], self.rng
        if i != self.last_i:
            if self.last_i >= 0 and blocks[self.last_i]["type"] == "sprint":
                grade = rng.choices(list(C.BOT_GRADES), list(C.BOT_GRADES.values()))[0]
                self.combo = 0 if grade == "FAIL" else self.combo + 1
                room.mode.on_sprint(r, self.last_i, grade, self.combo)
            self.last_i = i
        comp = self.compliance(room.el, dt)
        tgt = r.target(blocks[i], bel) if i >= 0 else None
        if tgt is not None:
            jitter = rng.uniform(1 - C.BOT_POWER_JITTER, 1 + C.BOT_POWER_JITTER)
            w = tgt * jitter * min(1.0, comp / C.BOT_COMP[0])
            r.s = comp
        else:
            sprint = i >= 0 and blocks[i]["type"] == "sprint"
            w = r.ftp * (rng.uniform(*C.BOT_SPRINT_X) if sprint else C.BOT_IDLE_X)
            r.s = None
        r.p = r.w = w
        r.cad = cad + rng.uniform(-C.BOT_CAD_JITTER, C.BOT_CAD_JITTER)
        r.last_data = time.monotonic()


def drive(room: Room, dt: float, i: int, bel: float) -> None:
    """Runs every bot for one tick. Cadence follows the median of the humans who are pedalling."""
    cads = [r.cad for r in room.riders.values() if not r.bot and r.connected and r.cad >= C.SYNC_MIN_CADENCE]
    cad = statistics.median(cads) if cads else C.BOT_CAD_DEFAULT
    for r in room.riders.values():
        if r.bot:
            room.brains.setdefault(r.id, Brain(f"{room.code}:{r.id}")).step(room, r, dt, i, bel, cad)


def set_bots(room: Room, n: int) -> None:
    """Sets the bot count so humans + bots never exceed the seats."""
    from .session import Rider

    humans = sum(not r.bot for r in room.riders.values())
    want = max(0, min(n, C.MAX_RIDERS - humans, len(C.BOT_NAMES)))
    bots = [r for r in room.riders.values() if r.bot]
    for r in bots[want:]:
        del room.riders[r.id]
        room.brains.pop(r.id, None)
    count = min(len(bots), want)
    for name in C.BOT_NAMES:
        rid = f"bot-{name.lower()}"
        if count >= want:
            break
        if rid in room.riders:
            continue
        rng = random.Random(f"{room.code}:{rid}:make")
        look = {slot: rng.choice(ids) for slot, ids in C.BOT_LOOKS.items()}
        ftp, tier = rng.randint(*C.BOT_FTP), rng.choice(C.TIERS)
        room.riders[rid] = Rider(rid, name, ftp, tier, connected=True, look=look, bot=True)
        count += 1

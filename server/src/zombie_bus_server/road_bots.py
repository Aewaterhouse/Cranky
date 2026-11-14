"""Road bots: NPC riders with a personality, each riding at a fraction of an assumed FTP."""

from __future__ import annotations

import random
import statistics
from typing import TYPE_CHECKING

from . import config as C
from .session import Rider

if TYPE_CHECKING:
    from .modes.road import Mover, RoadSim
    from .road_room import RoadRoom

BOTS = {
    f"bot-{name.split()[-1].lower()}": (name, kind, kg, fit, line)
    for name, kind, kg, fit, line in C.ROAD_BOTS
}


def set_bots(room: RoadRoom, n: int) -> None:
    """Sets the bot count so humans + bots never exceed the places on the road."""
    humans = len(room.humans())
    have = [r for r in room.riders.values() if r.bot]
    want = max(0, min(n, C.ROAD_MAX_RIDERS - humans, len(BOTS)))
    for r in have[want:]:
        del room.riders[r.id]
    for rid, (name, *_rest) in BOTS.items():
        if sum(r.bot for r in room.riders.values()) >= want:
            break
        if rid not in room.riders:
            rng = random.Random(f"{room.code}:{rid}:make")
            look = {slot: rng.choice(ids) for slot, ids in C.BOT_LOOKS.items()}
            room.riders[rid] = Rider(rid, name, 0, "hard", connected=True, look=look, bot=True)
    assume_ftps(room)


def assume_ftps(room: RoadRoom) -> None:
    """Gives each bot an FTP from the humans' median W/kg, so the bots ride with the people in the room."""
    wkgs = [r.ftp / room.kg_of(r.id) for r in room.humans()]
    wkg = statistics.median(wkgs) if wkgs else C.ROAD_BOT_WKG
    for r in room.riders.values():
        if r.bot:
            _, _, kg, fit, _ = BOTS[r.id]
            r.ftp = round(wkg * kg * fit)


def bot_power(kind: str, ftp: float, sim: RoadSim, m: Mover, rng: random.Random) -> float:
    """The watts a bot of this personality puts out right now."""
    x = C.ROAD_BOT_X[kind]
    f = x["x"]
    if kind == "surger" and sim.el % x["every_s"] < x["surge_s"] and sim.el > x["every_s"]:
        f = x["surge_x"]
    elif kind == "climber" and sim.road.grade_at(m.d) >= x["climb_pct"]:
        f = x["climb_x"]
    elif kind == "sprinter" and sim.rules.line(sim, m) - m.d <= x["sprint_m"]:
        f = x["sprint_x"]
    elif kind == "sucker" and m.draft < 1:
        f = x["sit_x"]
    return ftp * f * rng.uniform(1 - C.ROAD_BOT_JITTER, 1 + C.ROAD_BOT_JITTER)


forms: dict[str, float] = {}


def drive(room: RoadRoom, rngs: dict[str, random.Random]) -> None:
    """Sets every bot's power, cadence and a faked heart rate for this tick."""
    sim = room.sim
    for r in room.riders.values():
        if r.bot and sim and sim.el > 0:
            rng = rngs.setdefault(r.id, random.Random(f"{room.code}:{r.id}"))
            # Form on the day, drawn once per ride: bots split up and no two rides play out the same.
            key = f"{r.id}:form:{id(sim)}"
            form = forms.setdefault(key, random.Random(key + room.code).uniform(*C.ROAD_BOT_FORM))
            r.p = r.w = form * bot_power(BOTS[r.id][1], r.ftp, sim, sim.movers[r.id], rng)
            r.cad = C.ROAD_BOT_CAD + rng.uniform(-C.BOT_CAD_JITTER, C.BOT_CAD_JITTER)
            frac = min(1.0, C.BOT_HR_REST + (C.BOT_HR_AT_FTP - C.BOT_HR_REST) * r.p / max(1, r.ftp))
            r.hr = round(frac * C.BOT_HR_MAX)

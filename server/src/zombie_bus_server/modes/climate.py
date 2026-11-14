"""Climate Lawsuit rules: each rider runs an energy company; watts earn coins and emissions raise the sea."""

from __future__ import annotations

import random
from statistics import fmean
from typing import TYPE_CHECKING

from .. import bots
from .. import config as C
from .. import config_games as G
from . import climate_text as T
from . import script
from .climate_court import Court
from .climate_economy import Economy, fuel_cost, level_of, stage_of
from .climate_view import ClimateView
from .common import Band, CrewGame, tally
from .script import Seg

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

FUELS = G.CLIM_FUELS
__all__ = ["Climate", "cap", "fuel_cost", "level_of", "stage_of"]


def cap(b: tuple[float, float], x: float = 1.0) -> tuple[float, float]:
    """A band scaled by `x`, neither edge over the target cap."""
    return min(C.TARGET_CAP, b[0] * x), min(C.TARGET_CAP, b[1] * x)


class Climate(Economy, Court, ClimateView, CrewGame):
    """One town, 1980 to sentencing. `cos` is every company; emissions stay secret until the Trial."""

    no_erg = True

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.seed, self.events, self.ev_n, self.last_i = 0, [], 0, -1
        self.cos: dict[str, dict] = {}  # rider -> {name, fuel, coins, on}
        self.emit_t: dict[str, float] = {}
        self.next_fuel: dict[str, str] = {}
        self.locked: dict[str, int] = {}  # rider -> the decade the lobbyist has them on coal
        self.bribed: dict[str, bool] = {}
        self.switched: dict[str, int] = {}  # rider -> the decade they first left coal
        self.walls, self.walls_by = 0, {}
        self.level, self.stage, self.top, self.flooded = 0.0, 0, 0, False
        self.n = 0  # the decade, 1 to 4 (0 in the 1980s)
        self.cues: list[dict] = []
        self.cue_hold: dict[str, list[float]] = {}  # rider -> [sum of share, ticks] over the cue running now
        self.demand: dict | None = None
        self.miner, self.miner_used = 0, False
        self.offer: dict | None = None
        self.lobby_done = False
        self.court_init()

    @classmethod
    def deal(cls, minutes: int) -> dict:
        """The 1980s, four decades, the Trial and sentencing."""
        segs = [Seg("The 1980s", G.CLIM_EIGHTIES_S, "eighties", ("say",))]
        segs += [
            Seg(f"The {d}", G.CLIM_DECADE_S, "decade", ("heat", "kettle", "miner", "lobby", "say"))
            for d in G.CLIM_DECADES
        ]
        segs += [
            Seg("The Trial", G.CLIM_TRIAL_S, "trial", ("say",)),
            Seg("Sentencing", G.CLIM_COOL_S, "cool", ("say",)),
        ]
        plan = script.plan("climate", "Climate Lawsuit", segs)
        for n, b in enumerate((b for b in plan["blocks"] if b["kind"] == "decade"), 1):
            b["decade"], b["n"] = G.CLIM_DECADES[n - 1], n
        plan["desc"] = (
            "Watts earn coins; emissions raise the sea. Flood the town and somebody gets sued. No ERG."
        )
        return plan

    def begin(self, room: Room) -> None:
        self.seed = random.randrange(2**31)
        self.events = script.schedule(room.plan, self.seed, G.CLIM_EVENT_S)
        short = G.CLIM_MIN_RIDERS - len(room.riders)
        if short > 0:
            bots.set_bots(room, sum(r.bot for r in room.riders.values()) + short)
        names = list(T.COMPANIES)
        self.rng("names").shuffle(names)
        for n, (rid, r) in enumerate(room.riders.items()):
            self.cos[rid] = {
                "name": names[n % len(names)].format(n=r.name),
                "fuel": "coal",
                "coins": 0.0,
                "on": False,
            }
            self.emit_t[rid] = 0.0
        self.cues = self.make_cues(room.plan)

    def rng(self, *tag: object) -> random.Random:
        return random.Random(f"{self.seed}:{tag}")

    def make_cues(self, plan: dict) -> list[dict]:
        """Wind gusts and gas surges through every decade, each `{k, t, end}` in ride seconds."""
        k, out, start = plan.get("scale", 1.0), [], 0.0
        for b in plan["blocks"]:
            if b["kind"] == "decade":
                for kind, c in (("gust", G.CLIM_GUST), ("surge", G.CLIM_SURGE)):
                    rng, t = self.rng("cues", kind, b["n"]), start + 20 * k
                    while t + (c["secs"] + 5) * k < start + b["dur"]:
                        out.append({"k": kind, "t": round(t, 2), "end": round(t + c["secs"] * k, 2)})
                        t += c["every"] * k * rng.uniform(0.85, 1.15)
            start += b["dur"]
        return sorted(out, key=lambda c: c["t"])

    # --- the script -------------------------------------------------------------------------------------

    def kind(self, room: Room, i: int | None = None) -> str:
        if i is None:
            i = self.last_i
        return room.plan["blocks"][i]["kind"] if i >= 0 else "eighties"

    def event(self, room: Room, i: int) -> str:
        self.sync(room, i)
        return self.kind(room, i)

    def sync(self, room: Room, i: int) -> None:
        if i == self.last_i or i < 0:
            return
        self.last_i = i
        b = room.plan["blocks"][i]
        if b["kind"] == "decade":
            self.new_decade(room, b["n"])
        elif b["kind"] == "trial":
            self.open_trial(room)
        elif b["kind"] == "cool":
            self.open_cool(room)

    def new_decade(self, room: Room, n: int) -> None:
        """Pays for and fits everyone's chosen fuel; the lobbyist's clients stay on coal."""
        self.n, self.miner, self.demand = n, 0, None
        for rid, co in self.cos.items():
            want = "coal" if self.locked.get(rid) == n else self.next_fuel.get(rid, co["fuel"])
            cost = fuel_cost(co["fuel"], want, n)
            if cost <= co["coins"]:
                co["coins"] -= cost
                co["fuel"] = want
                if want != "coal":
                    self.switched.setdefault(rid, n)
        self.next_fuel = {}
        self.emit(
            "say",
            f"The {G.CLIM_DECADES[n - 1]}. {self.rng('say', n).choice(T.DECADE[G.CLIM_DECADES[n - 1]])}",
        )

    def choosing(self, room: Room) -> int | None:
        """The decade whose fuel is being chosen right now, or None outside the last seconds before one."""
        i = self.last_i
        blocks = room.plan["blocks"]
        if i < 0 or blocks[i]["kind"] not in ("eighties", "decade") or self.n >= len(G.CLIM_DECADES):
            return None
        end = sum(b["dur"] for b in blocks[: i + 1])
        return self.n + 1 if end - room.el <= G.CLIM_CHOOSE_S * room.plan.get("scale", 1.0) else None

    def cue(self, el: float, kind: str) -> dict | None:
        return next((c for c in self.cues if c["k"] == kind and c["t"] <= el < c["end"]), None)

    def fuel_cue(self, room: Room, rid: str) -> dict | None:
        """The gust (wind) or surge (gas) this company is being paid for right now."""
        fuel = self.cos[rid]["fuel"] if rid in self.cos else ""
        kind = {"wind": "gust", "gas": "surge"}.get(fuel)
        return self.cue(room.el, kind) if kind and self.kind(room) == "decade" else None

    # --- targets ----------------------------------------------------------------------------------------

    def band(self, room: Room, r: Rider, i: int, bel: float) -> Band:
        self.sync(room, i)
        kind = self.kind(room, i)
        if kind in ("trial", "cool"):
            return self.court_band(room, r, kind)
        x = G.CLIM_MINER["x"] if self.miner == self.n and self.n else 1.0
        if self.demand:
            return cap(G.CLIM_HEAT["band"] if self.demand["k"] == "heat" else G.CLIM_KETTLE["band"], x)
        c = self.fuel_cue(room, r.id)
        if c:
            return cap((G.CLIM_GUST if c["k"] == "gust" else G.CLIM_SURGE)["band"], x)
        fuel = self.cos[r.id]["fuel"] if r.id in self.cos and kind == "decade" else "coal"
        return cap(FUELS[fuel]["band"], x)

    # --- one tick ---------------------------------------------------------------------------------------

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        self.sync(room, i)
        kind, el = self.kind(room, i), room.el
        act = [r for r in room.riders.values() if r.st == "riding"]
        tally(act, dt)
        self.speed = (fmean(min(C.TARGET_CAP, r.w / r.ftp) for r in act) if act else 0.0) * G.CLIM_MS_AT_FTP
        self.dist += self.speed * dt
        due, self.ev_n = script.due(self.events, self.ev_n, el)
        for e in due:
            self.on_event(room, e, kind)
        if kind in ("eighties", "decade") and not self.flooded:
            self.economy(room, act, dt / room.plan.get("scale", 1.0))
            self.cue_tick(room, act)
            self.demand_tick(room, act)
            self.sea(room)
        if self.offer and el >= self.offer["until"]:
            self.offer = None
        self.court_tick(room, act, dt, kind)
        self.bots_answer(room)
        return super().tick(room, dt, i, bel, ev)

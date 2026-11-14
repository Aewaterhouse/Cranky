"""Climate Lawsuit's economy: coins, tonnes, gusts and surges, demand events, the sea and seawalls."""

from __future__ import annotations

from statistics import fmean
from typing import TYPE_CHECKING

from .. import config as C
from .. import config_games as G
from . import climate_text as T

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

FUELS = G.CLIM_FUELS


def fuel_cost(old: str, new: str, n: int) -> int:
    """Coins to change from `old` to `new` fuel for decade `n` (1 to 4). Coal and staying put are free."""
    if new in (old, "coal"):
        return 0
    return round(G.CLIM_COST[new] * G.CLIM_COST_FALL[n - 1])


def level_of(emit: dict[str, float], walls: int) -> float:
    """The sea level: each company's emissions, on average, against the flood mark, less the seawalls."""
    return max(0.0, (fmean(emit.values()) if emit else 0.0) / G.CLIM_FLOOD_T - G.CLIM_WALL_STEP * walls)


def stage_of(level: float) -> int:
    return sum(level >= s for s in G.CLIM_STAGES)


class Economy:
    """Mixed into `Climate`."""

    def economy(self, room: Room, act: list[Rider], dt: float) -> None:
        """Coins and tonnes for this tick. `dt` is unscaled, so a short test game has the full economy."""
        pay = G.CLIM_MINER["pay"] if self.miner == self.n and self.n else 1.0
        for r in act:
            co = self.cos.get(r.id)
            if not co:
                continue
            fuel = co["fuel"] if self.n else "coal"
            f, share = FUELS[fuel], min(C.TARGET_CAP, r.w / r.ftp)
            if fuel == "solar":
                lo, hi = f["band"]
                co["on"] = lo - G.CLIM_SOLAR_SLACK <= share <= hi + G.CLIM_SOLAR_SLACK
            elif fuel == "wind":
                c = self.fuel_cue(room, r.id)
                co["on"] = bool(c) and share >= G.CLIM_CUE_HELD
            else:
                co["on"] = share > G.CLIM_EARN_MIN
            if co["on"]:
                co["coins"] += f["rate"] * share * dt * pay
            self.emit_t[r.id] = self.emit_t.get(r.id, 0.0) + f["emit"] * share * dt

    def cue_tick(self, room: Room, act: list[Rider]) -> None:
        """Tracks each gust and surge as it runs and pays the companies that held it when it ends."""
        live = {r.id: r for r in act}
        for rid in list(self.cos):
            c, r = self.fuel_cue(room, rid), live.get(rid)
            if c and r:
                s = self.cue_hold.setdefault(rid, [0.0, 0, c["end"]])
                s[0] += min(C.TARGET_CAP, r.w / r.ftp)
                s[1] += 1
            elif rid in self.cue_hold and room.el >= self.cue_hold[rid][2]:
                total, n, _ = self.cue_hold.pop(rid)
                spec = G.CLIM_GUST if self.cos[rid]["fuel"] == "wind" else G.CLIM_SURGE
                if n and total / n >= G.CLIM_CUE_HELD:
                    pay = G.CLIM_MINER["pay"] if self.miner == self.n and self.n else 1.0
                    self.cos[rid]["coins"] += spec["pay"] * pay

    def on_event(self, room: Room, e: dict, kind: str) -> None:
        k = e["k"]
        if k in ("heat", "kettle") and not self.demand:
            self.demand = {"k": k, "end": e["t"] + e["dur"], "sum": 0.0, "n": 0}
            self.emit("say", " ".join(T.EVENTS[k]))
        elif k == "miner" and not self.miner_used and self.n:
            self.miner, self.miner_used = self.n, True
            self.emit("say", " ".join(T.EVENTS["miner"]))
        elif k == "miner":
            self.emit("say", T.MINER_AGAIN)
        elif k == "lobby" and not self.lobby_done and 0 < self.n < len(G.CLIM_DECADES):
            self.lobby_done = True
            who = min(self.cos, key=lambda rid: self.cos[rid]["coins"])
            self.offer = {"who": who, "until": room.el + G.CLIM_BRIBE_S * room.plan.get("scale", 1.0)}
            self.emit("say", T.LOBBY)
        else:
            self.banter(room, kind)

    def banter(self, room: Room, kind: str) -> None:
        lines = {"eighties": T.EIGHTIES, "trial": T.TRIAL, "cool": T.COOL}.get(kind)
        lines = lines or T.DECADE[G.CLIM_DECADES[max(1, self.n) - 1]]
        self.emit("say", self.rng("say", round(room.el)).choice(lines))

    def demand_tick(self, room: Room, act: list[Rider]) -> None:
        """Heatwave and half time: the crew's mean effort over the event decides if the lights stay on."""
        d = self.demand
        if not d:
            return
        if room.el < d["end"]:
            if act:
                d["sum"] += fmean(min(C.TARGET_CAP, r.w / r.ftp) for r in act)
                d["n"] += 1
            return
        need = (G.CLIM_HEAT if d["k"] == "heat" else G.CLIM_KETTLE)["need"]
        self.demand = None
        if d["n"] and d["sum"] / d["n"] >= need:
            self.emit("say", T.HELD[d["k"]])
            return
        for co in self.cos.values():
            co["coins"] = max(0.0, co["coins"] - G.CLIM_BLACKOUT)
        self.emit("blackout", T.BLACKOUT.format(n=G.CLIM_BLACKOUT))

    def sea(self, room: Room) -> None:
        """Raises the water; a new stage gets a splash and the last one floods the town for good."""
        self.level = level_of(self.emit_t, self.walls)
        self.stage = stage_of(self.level)
        if self.stage > self.top:
            self.top = self.stage
            self.emit("flood" if self.stage == 4 else "stage", T.STAGE[self.stage])
            if self.stage == 4:
                self.flooded = True

    def switch_cost(self, old: str, new: str, n: int) -> int:
        return fuel_cost(old, new, n)

    def wall_cost(self) -> int:
        first, more = G.CLIM_WALL_COST
        return first + more * self.walls

    def build_wall(self, room: Room, r: Rider) -> None:
        co, cost = self.cos.get(r.id), self.wall_cost()
        if not co or co["coins"] < cost or self.flooded or self.kind(room) not in ("eighties", "decade"):
            return
        co["coins"] -= cost
        self.walls += 1
        self.walls_by[r.id] = self.walls_by.get(r.id, 0) + 1
        self.emit("wall", T.WALL.format(name=r.name), r.id)
        self.sea(room)

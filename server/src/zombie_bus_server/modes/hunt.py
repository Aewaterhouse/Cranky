"""The Hunt: one rider is the fox, the rest the hounds, a round each in turn. Speed comes from staying on
target (ERG holds the power), so the fox escapes by riding cleaner than the pack, not by being stronger."""

from __future__ import annotations

import statistics
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import CrewGame, compliance, crew_scrap, rider_row, tally

if TYPE_CHECKING:
    from ..session import Rider, Room


class Hunt(CrewGame):
    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.round = -1
        self.fox: str | None = None
        self.gap = 0.0
        self.pts: dict[str, int] = {}
        self.order: list[str] = []

    def begin(self, room: Room) -> None:
        self.order = sorted(room.riders, key=lambda rid: (room.riders[rid].bot, rid))

    @staticmethod
    def pace(rs: list[Rider]) -> float:
        """Speed from on-target riding: the mean compliance of these riders, mapped onto HUNT_V."""
        c = statistics.fmean(r.s if r.s is not None else 1.0 for r in rs) if rs else 0.0
        return G.HUNT_V[0] + (G.HUNT_V[1] - G.HUNT_V[0]) * c

    def end_round(self, room: Room, caught: bool) -> None:
        hounds = [rid for rid in room.riders if rid != self.fox]
        fox = room.riders[self.fox].name if self.fox in room.riders else "The fox"
        if caught:
            for rid in hounds:
                self.pts[rid] = self.pts.get(rid, 0) + G.HUNT_CATCH
            self.emit("caught", f"The hounds caught {fox}!")
        else:
            self.pts[self.fox] = self.pts.get(self.fox, 0) + G.HUNT_ESCAPE
            self.emit("escaped", f"{fox} got away with {round(self.gap)} m to spare!", self.fox)

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        riding = [r for r in room.riders.values() if r.st == "riding"]
        tally(riding, dt)
        n = int(max(0.0, room.el) // G.HUNT_ROUND_S) if room.el > 0 and self.order else -1
        if n != self.round and n >= 0:
            if self.fox is not None and self.gap > 0:
                self.end_round(room, False)
            self.round, self.fox, self.gap = n, self.order[n % len(self.order)], float(G.HUNT_START)
            name = room.riders[self.fox].name if self.fox in room.riders else "?"
            self.emit("fox", f"{name} is the fox! Hounds, ride clean to run them down.", self.fox)
        if self.fox is not None and self.gap > 0:
            fox = [r for r in riding if r.id == self.fox]
            hounds = [r for r in riding if r.id != self.fox]
            if fox and hounds:
                self.gap += (self.pace(fox) - self.pace(hounds) - G.HUNT_HOUND_EDGE) * dt
            if self.gap <= 0:
                self.end_round(room, True)
        self.speed = G.HUNT_V[1]
        self.dist += self.speed * dt
        return super().tick(room, dt, i, bel, ev)

    def game(self, room: Room, i: int, bel: float) -> dict:
        left = G.HUNT_ROUND_S - max(0.0, room.el) % G.HUNT_ROUND_S
        return {
            "g": "hunt",
            "fox": self.fox,
            "gap": round(max(0.0, self.gap), 1),
            "pts": self.pts,
            "left": round(left),
            "caught": self.gap <= 0,
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        order = sorted(rs, key=lambda r: (-self.pts.get(r.id, 0), -comp[r.id]))
        if order and self.pts.get(order[0].id):
            awards.append(
                {
                    "award": "Top Dog",
                    "id": order[0].id,
                    "name": order[0].name,
                    "why": f"{self.pts[order[0].id]} points",
                }
            )
        return {
            "mode": "hunt",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist),
            "score": max(self.pts.values(), default=0),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [rider_row(r, comp, points=self.pts.get(r.id, 0)) for r in order],
            "awards": awards,
        }

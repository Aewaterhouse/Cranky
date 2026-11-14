"""Last Rider Standing: a shared ramp test as an elimination game. The last one holding their step wins."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import Band, CrewGame, award, compliance, crew_scrap, rider_row, tally

if TYPE_CHECKING:
    from ..session import Rider, Room


class LastStanding(CrewGame):
    """Out after `LAST_OUT_S` under `LAST_OUT_S_BAND` on target, or stopped. Out riders spin free."""

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.low: dict[str, float] = {}  # seconds each rider has been off their step
        self.out: list[str] = []  # in the order they went
        self.reached: dict[str, int] = {}  # each rider's last step, % FTP
        self.winner: str | None = None
        self.limit: dict[str, float] = {}  # each bot's breaking point, a share of FTP

    @classmethod
    def deal(cls, minutes: int) -> dict:
        """Warm-up, one-minute steps up to the 150% cap, a hold there, then a cool-down."""
        pcts = list(range(G.LAST_FROM, G.LAST_TO + 1, G.LAST_STEP)) + [G.LAST_TO] * G.LAST_HOLDS
        blocks = [{"type": "steady", "dur": G.LAST_WARM_S, "pct": 55, "label": "Warm-up"}]
        blocks += [
            {"type": "steady", "dur": 60, "pct": p, "label": f"Step {n}"} for n, p in enumerate(pcts, 1)
        ]
        blocks.append({"type": "steady", "dur": G.LAST_COOL_S, "pct": 45, "label": "Victory lap"})
        return {
            "id": "last-standing",
            "name": "Last Rider Standing",
            "blocks": blocks,
            "desc": "A ramp test for the whole crew. Hold each step; the last one still holding wins.",
        }

    def begin(self, room: Room) -> None:
        rng = random.Random()
        self.limit = {r.id: rng.uniform(*G.LAST_BOT_LIMIT) for r in room.riders.values() if r.bot}

    def standing(self, room: Room) -> list[str]:
        return [rid for rid in room.riders if rid not in self.out]

    def band(self, room: Room, r: Rider, i: int, bel: float) -> Band:
        last = i == len(room.plan["blocks"]) - 1
        return "free" if r.id in self.out or self.winner or last else None

    def bot(self, room: Room, r: Rider, w: float, tgt: float | None, rng: random.Random) -> float:
        # Past its breaking point a bot fades and drops out like anyone else.
        return w * 0.6 if tgt and tgt > r.ftp * self.limit.get(r.id, 9) else w

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        riding = [r for r in room.riders.values() if r.st == "riding"]
        tally(riding, dt)
        self.speed = G.WATCH_SPEED
        self.dist += self.speed * dt
        b = room.plan["blocks"][i]
        if 0 < i < len(room.plan["blocks"]) - 1 and not self.winner and bel >= G.LAST_GRACE_S:
            for r in room.riders.values():
                if r.id in self.out:
                    continue
                self.reached[r.id] = b["pct"]
                off = r.st != "riding" or r.p < 1 or (r.s is not None and r.s < G.LAST_OUT_BAND)
                self.low[r.id] = self.low.get(r.id, 0.0) + dt if off else 0.0
                if self.low[r.id] >= G.LAST_OUT_S:
                    self.out.append(r.id)
                    left = len(room.riders) - len(self.out)
                    self.emit("out", f"{r.name} is out at {b['pct']}%. {left} still standing.", r.id)
            left = self.standing(room)
            if len(room.riders) > 1 and len(left) <= 1:
                self.winner = left[0] if left else self.out[-1]
                name = room.riders[self.winner].name
                self.emit("winner", f"{name} is the last rider standing! Victory lap, everyone.", self.winner)
        return super().tick(room, dt, i, bel, ev)

    def order(self, room: Room) -> list[str]:
        """Winner first, then everyone by how long they lasted."""
        still = [rid for rid in self.standing(room) if rid != self.winner]
        return ([self.winner] if self.winner else []) + still + self.out[::-1]

    def game(self, room: Room, i: int, bel: float) -> dict:
        return {
            "g": "last",
            "standing": self.standing(room),
            "out": self.out,
            "winner": self.winner,
            "step": room.plan["blocks"][i].get("pct"),
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        order = self.order(room)
        if self.winner:
            awards.append(
                {
                    "award": "Last One Standing",
                    "id": self.winner,
                    "name": room.riders[self.winner].name,
                    "why": f"held {self.reached.get(self.winner, 0)}%",
                }
            )
        if self.out and len(rs) > 2:
            first = self.out[0]
            awards.append(
                {
                    "award": "First Off the Bus",
                    "id": first,
                    "name": room.riders[first].name,
                    "why": f"out at {self.reached.get(first, 0)}%",
                }
            )
        award(awards, rs, "Iron Lungs", lambda r: comp[r.id], lambda r: f"{comp[r.id]:.0%} on target")
        return {
            "mode": "last",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist),
            "score": max(self.reached.values(), default=0),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [
                {**rider_row(r, comp), "reached": self.reached.get(r.id, 0)}
                for r in sorted(rs, key=lambda r: order.index(r.id))
            ],
            "awards": awards,
        }

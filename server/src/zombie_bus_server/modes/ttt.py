"""Team Time Trial: the room splits into two teams on the same workout, and the team more on target wins."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import CrewGame, award, compliance, crew_scrap, rider_row, tally

if TYPE_CHECKING:
    from ..session import Room

TEAMS = ("Maroons", "Blues")  # State of Origin; the client dresses them in maroon and sky blue


class TeamTrial(CrewGame):
    """Riders are dealt into two teams by seat; each team's score is its riders' mean compliance so far."""

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.team: dict[str, int] = {}

    def begin(self, room: Room) -> None:
        # Alternate seats, humans first, so two mates end up on different teams.
        seats = sorted(room.riders.values(), key=lambda r: (r.bot, r.id))
        if self.mut.get("shuffle"):  # this week's twist: teams out of a hat
            random.Random(room.code).shuffle(seats)
        self.team = {r.id: k % 2 for k, r in enumerate(seats)}

    def scores(self, room: Room) -> list[float]:
        comp = compliance(room.riders.values())
        out = []
        for t in (0, 1):
            vals = [comp[rid] for rid, k in self.team.items() if k == t and rid in comp]
            out.append(sum(vals) / len(vals) if vals else 0.0)
        return out

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        tally([r for r in room.riders.values() if r.st == "riding"], dt)
        self.speed = G.WATCH_SPEED
        self.dist += self.speed * dt
        return super().tick(room, dt, i, bel, ev)

    def game(self, room: Room, i: int, bel: float) -> dict:
        return {
            "g": "ttt",
            "teams": list(TEAMS),
            "team": self.team,
            "scores": [round(s, 3) for s in self.scores(room)],
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        a, b = self.scores(room)
        win = 0 if a >= b else 1
        best = max((r for r in rs if self.team.get(r.id) == win), key=lambda r: comp[r.id], default=None)
        if best:
            awards.append(
                {
                    "award": f"Team {TEAMS[win]} wins",
                    "id": best.id,
                    "name": best.name,
                    "why": f"{a:.1%} to {b:.1%}, led by {best.name}",
                }
            )
        award(awards, rs, "Metronome", lambda r: comp[r.id], lambda r: f"{comp[r.id]:.0%} on target")
        return {
            "mode": "ttt",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist),
            "score": round(100 * max(a, b)),
            "difficulty": "normal",
            "syncPct": 0,
            "teams": {"names": list(TEAMS), "scores": [round(a, 3), round(b, 3)], "winner": win},
            "riders": [
                rider_row(r, comp, team=TEAMS[self.team.get(r.id, 0)])
                for r in sorted(rs, key=lambda r: (self.team.get(r.id, 0), -comp[r.id]))
            ],
            "awards": awards,
        }

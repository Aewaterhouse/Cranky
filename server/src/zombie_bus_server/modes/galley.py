"""Galley Ship: row in time. A drum sets the cadence; the more of the crew on the beat, the faster the ship
runs from the pirates. Over the driver's workout, so ERG holds the power and cadence is free."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import CrewGame, award, compliance, crew_scrap, rider_row, tally

if TYPE_CHECKING:
    from ..session import Room


class Galley(CrewGame):
    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.gap = float(G.GALLEY_GAP)  # metres to the pirates
        self.hull = 100.0
        self.sync = 0.0  # share of the crew on the beat, smoothed
        self.on: dict[str, float] = {}  # seconds each rider rowed on the beat
        self.beat = G.GALLEY_BEATS[0]

    def tol(self) -> int:
        """How close to the beat counts: this week's twist may make it tighter or looser."""
        return self.mut.get("tol", G.GALLEY_TOL)

    def beat_at(self, el: float) -> int:
        return G.GALLEY_BEATS[int(max(0.0, el) // G.GALLEY_BEAT_S) % len(G.GALLEY_BEATS)]

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        rowing = [r for r in room.riders.values() if r.st == "riding"]
        tally(rowing, dt)
        beat = self.beat_at(room.el)
        if beat != self.beat:
            self.beat = beat
            self.emit("drum", f"The drum changes: row at {beat} rpm!")
        for r in rowing:  # bots row to the drum, now and then a few beats off it
            if r.bot:
                rng = random.Random(f"{room.code}:{r.id}:{int(room.el // G.GALLEY_BOT_SPELL_S)}")
                r.cad = beat + (
                    rng.uniform(-2, 2) if rng.random() > G.GALLEY_BOT_OFF else rng.choice((-9, 9))
                )
        on = [r for r in rowing if abs(r.cad - beat) <= self.tol()]
        for r in on:
            self.on[r.id] = self.on.get(r.id, 0.0) + dt
        share = len(on) / len(rowing) if rowing else 0.0
        self.sync += (share - self.sync) * min(1.0, dt / G.GALLEY_SMOOTH_S)
        self.speed = G.GALLEY_V[0] + (G.GALLEY_V[1] - G.GALLEY_V[0]) * self.sync
        self.dist += self.speed * dt
        self.gap = min(G.GALLEY_GAP_MAX, self.gap + (self.speed - G.GALLEY_PIRATES) * dt)
        if self.gap <= 0:
            self.hull = max(0.0, self.hull - G.GALLEY_HIT)
            self.gap = G.GALLEY_KNOCK
            self.emit("boarded", "Pirates boarded! Cutlasses everywhere. Row together!")
        return super().tick(room, dt, i, bel, ev)

    def game(self, room: Room, i: int, bel: float) -> dict:
        return {
            "g": "galley",
            "beat": self.beat,
            "sync": round(self.sync, 2),
            "gap": round(self.gap, 1),
            "hull": round(self.hull),
            "tol": self.tol(),
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        award(
            awards,
            rs,
            "Drummer's Pet",
            lambda r: self.on.get(r.id, 0.0),
            lambda r: f"{round(self.on.get(r.id, 0))} s on the beat",
        )
        award(
            awards,
            rs,
            "Off Beat",
            lambda r: -self.on.get(r.id, 0.0),
            lambda r: f"{round(self.on.get(r.id, 0))} s on the beat",
        )
        return {
            "mode": "galley",
            "distance": round(self.dist),
            "armour": round(self.hull),
            "scrap": crew_scrap(self.dist),
            "score": round(self.dist / 10 * (0.5 + self.hull / 200)),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [
                rider_row(r, comp, beat=round(self.on.get(r.id, 0)))
                for r in sorted(rs, key=lambda r: -self.on.get(r.id, 0.0))
            ],
            "awards": awards,
        }

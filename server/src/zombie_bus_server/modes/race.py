"""Road races: first across the line after the host's laps wins."""

from __future__ import annotations

from .. import config as C
from .road import RULES, Mover, RoadSim, Rules


class Race(Rules):
    """Everyone from the line, no keep-together; results in finish order with gaps to the winner."""

    name = "race"
    race = True

    def __init__(self) -> None:
        self.lead = -1  # lap lines the leader has crossed (-1 before the first tick)

    @staticmethod
    def laps_done(sim: RoadSim, m: Mover) -> int:
        return min(sim.road.laps, int(m.d / sim.road.lap.distance + 1e-9))

    @staticmethod
    def crossed(sim: RoadSim, m: Mover, line: float) -> float:
        """When a rider crossed `line` (estimated back from their speed this tick)."""
        return m.fin if m.fin is not None else sim.el - (m.d - line) / max(0.1, m.v * m.band)

    def after(self, sim: RoadSim, dt: float) -> list[dict]:
        lead = max((self.laps_done(sim, m) for m in sim.movers.values()), default=0)
        fx = []
        while self.lead < lead:
            self.lead += 1
            fx += self.on_lap(sim, self.lead)
        return fx

    def on_lap(self, sim: RoadSim, done: int) -> list[dict]:
        """Effects as the leader starts lap `done + 1`: the bell for the last lap."""
        last = sim.road.laps > 1 and done == sim.road.laps - 1
        return [{"k": "bell", "id": None, "text": "LAST LAP"}] if last else []

    def state(self, sim: RoadSim) -> dict | None:
        return {"kind": self.name, "lap": min(sim.road.laps, self.lead + 1), "laps": sim.road.laps}

    def over(self, sim: RoadSim) -> bool:
        humans = [m for m in sim.movers.values() if not m.bot and m.here]
        home = sum(m.fin is not None for m in sim.movers.values())
        late = sim.first_fin is not None and sim.el - sim.first_fin > C.RACE_GRACE_S
        full = home >= min(C.RACE_PODIUM, len(sim.movers))
        return late or (bool(humans) and full and all(m.fin is not None for m in humans))

    def results(self, sim: RoadSim) -> list[dict]:
        rows = super().results(sim)
        best = next((r["time"] for r in rows if r["time"] is not None), 0.0)
        return [{**r, "gap": None if r["time"] is None else round(r["time"] - best, 1)} for r in rows]

    def extra(self, sim: RoadSim, rows: list[dict]) -> dict:
        return {"podium": [r["id"] for r in rows if r["time"] is not None][: C.RACE_PODIUM]}


RULES.update(race=Race)

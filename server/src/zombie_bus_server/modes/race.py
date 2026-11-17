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
        # Every rider still here gets to the line: no DNF because a bot won. Once the humans are home,
        # wait for the podium to fill (or the grace to run out); with nobody left, it is over.
        if not humans:
            return True
        return all(m.fin is not None for m in humans) and (full or late)

    def results(self, sim: RoadSim) -> list[dict]:
        rows = super().results(sim)
        best = next((r["time"] for r in rows if r["time"] is not None), 0.0)
        return [{**r, "gap": None if r["time"] is None else round(r["time"] - best, 1)} for r in rows]

    def extra(self, sim: RoadSim, rows: list[dict]) -> dict:
        home = sorted((r for r in rows if r["time"] is not None), key=lambda r: r.get("line", r["place"]))
        return {"podium": [r["id"] for r in home][: C.RACE_PODIUM]}


class Crit(Race):
    """Many laps of a short loop and a sprint prime on one lap around halfway. The finish decides the race."""

    name = "crit"

    def __init__(self) -> None:
        super().__init__()
        self.prime = 0  # the lap whose line is the prime, picked when the first rider is placed
        self.prime_by: str | None = None

    def place(self, sim: RoadSim, m: Mover) -> None:
        super().place(sim, m)
        if not self.prime:
            laps = sim.road.laps
            lo, hi = (round(laps * f) for f in C.CRIT_PRIME_AT)
            hi = max(1, min(laps - 1, hi))
            self.prime = sim.rng.randint(max(1, min(lo, hi)), hi)

    def line(self, sim: RoadSim, m: Mover) -> float:
        prime = self.prime * sim.road.lap.distance
        return prime if self.prime_by is None and m.d < prime else sim.road.distance

    def on_lap(self, sim: RoadSim, done: int) -> list[dict]:
        bell = [{"k": "bell", "id": None, "text": "PRIME NEXT LAP"}] if done == self.prime - 1 else []
        return super().on_lap(sim, done) + bell

    def after(self, sim: RoadSim, dt: float) -> list[dict]:
        fx = super().after(sim, dt)
        line = self.prime * sim.road.lap.distance
        over = [m for m in sim.movers.values() if m.d >= line - 1e-6]
        if self.prime_by is None and over:
            self.prime_by = min(over, key=lambda m: self.crossed(sim, m, line)).id
            fx.append({"k": "bell", "id": self.prime_by, "text": "PRIME!"})
        return fx

    def state(self, sim: RoadSim) -> dict | None:
        return {**super().state(sim), "prime": self.prime, "primeBy": self.prime_by}

    def results(self, sim: RoadSim) -> list[dict]:
        return [{**r, "prime": r["id"] == self.prime_by} for r in super().results(sim)]

    def extra(self, sim: RoadSim, rows: list[dict]) -> dict:
        award = self.prime_by and {"kind": "prime", "id": self.prime_by}
        return {**super().extra(sim, rows), "award": award}


class Handicap(Race):
    """A race on even terms: the room feeds the sim each rider's power as a share of FTP, at one W/kg."""

    name = "handicap"


RULES.update(race=Race, crit=Crit, handicap=Handicap)

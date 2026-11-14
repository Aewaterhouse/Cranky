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
        home = sorted((r for r in rows if r["time"] is not None), key=lambda r: r.get("line", r["place"]))
        return {"podium": [r["id"] for r in home][: C.RACE_PODIUM]}


class Points(Race):
    """A sprint at the end of every lap: points to the first four across, more on the last. Most wins."""

    name = "points"

    def __init__(self) -> None:
        super().__init__()
        self.pts: dict[str, int] = {}
        self.seen: dict[str, int] = {}  # lap lines each rider has crossed
        self.n: dict[str, int] = {}  # riders across each line so far (string keys survive a snapshot)
        self.warned = 0  # sprints the bell has gone for

    def line(self, sim: RoadSim, m: Mover) -> float:
        return min(sim.road.distance, (self.laps_done(sim, m) + 1) * sim.road.lap.distance)

    def after(self, sim: RoadSim, dt: float) -> list[dict]:
        fx = super().after(sim, dt)
        lap, laps = sim.road.lap.distance, sim.road.laps
        cross = []
        for m in sim.movers.values():
            done = self.laps_done(sim, m)
            cross += [
                (self.crossed(sim, m, k * lap), k, m.id)
                for k in range(self.seen.get(m.id, done) + 1, done + 1)
            ]
            self.seen[m.id] = done
        for _, k, rid in sorted(cross):
            place = self.n.get(str(k), 0)
            self.n[str(k)] = place + 1
            if place < len(C.POINTS):
                got = C.POINTS[place] * (C.POINTS_LAST_X if k == laps else 1)
                self.pts[rid] = self.pts.get(rid, 0) + got
                fx.append({"k": "points", "id": rid, "text": f"+{got}"})
        lead = max((m.d for m in sim.movers.values()), default=0.0)
        if self.warned < laps and lead >= (self.warned + 1) * lap - C.POINTS_WARN_M:
            self.warned += 1
            text = "FINAL SPRINT · DOUBLE POINTS" if self.warned == laps else f"SPRINT {self.warned} · POINTS"
            fx.append({"k": "bell", "id": None, "text": text})
        return fx

    def state(self, sim: RoadSim) -> dict | None:
        return {**super().state(sim), "pts": self.pts}

    def results(self, sim: RoadSim) -> list[dict]:
        rows = [{**r, "line": r["place"], "pts": self.pts.get(r["id"], 0)} for r in super().results(sim)]
        rows.sort(key=lambda r: (-r["pts"], r["line"]))
        return [{**r, "place": k + 1} for k, r in enumerate(rows)]

    def extra(self, sim: RoadSim, rows: list[dict]) -> dict:
        top = rows[0] if rows and rows[0]["pts"] else None
        return {**super().extra(sim, rows), "award": top and {"kind": "points", "id": top["id"]}}


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


RULES.update(race=Race, points=Points, crit=Crit)

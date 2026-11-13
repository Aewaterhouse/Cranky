"""Road rides: the server owns everyone's position on a route. A game is a `Rules` on top."""

from __future__ import annotations

import statistics
from dataclasses import asdict, dataclass

from .. import config as C
from ..road_physics import band_factor, draft_factor, speed_limit, step_speed, total_mass
from ..road_route import Road


@dataclass
class Mover:
    """One rider on the road. `v` is the physics speed; distance covered is `v * band`."""

    id: str
    kg: float
    ftp: int
    bot: bool = False
    here: bool = True  # connected (bots always are)
    d: float = 0.0
    v: float = 0.0
    p: float = 0.0
    cad: float = 0.0
    hr: int | None = None
    draft: float = 1.0
    band: float = 1.0
    lane: float = C.ROAD_LANES[0]
    start_el: float = 0.0
    start_d: float = 0.0
    fin: float | None = None
    work: float = 0.0
    saved: float = 0.0

    @property
    def moving(self) -> bool:
        return self.fin is None and self.v >= C.ROAD_STOPPED_MS

    @property
    def st(self) -> str:
        if self.fin is not None:
            return "finished"
        return "away" if not self.here else "riding" if self.moving else "stopped"


class Rules:
    """The plain group ride.

    A road game subclasses this and overrides what it needs; it never touches the physics (`RoadSim.step`) or
    the transport (`RoadRoom`).
    """

    name = "ride"

    def place(self, sim: RoadSim, m: Mover) -> None:
        """Where a rider starts: on the line before the start, later on the back of whoever is moving."""
        if sim.el <= 0:
            return
        out = [o for o in sim.movers.values() if o.fin is None and o is not m]
        back = min((o for o in out if o.moving), key=lambda o: o.d, default=None)
        back = back or min(out, key=lambda o: o.d, default=None)
        if back:
            m.d = m.start_d = max(0.0, back.d - C.ROAD_LATE_GAP_M)
            m.v = back.v
        m.start_el = sim.el

    def tune(self, sim: RoadSim, live: list[Mover]) -> None:
        """Sets each rider's `draft`, `band` and `lane` for this tick."""
        moving = [m for m in live if m.v >= C.DRAFT_MIN_MS]
        pack = [m for m in live if m.moving or m.p > 0]
        mid = statistics.median(m.d for m in pack) if sim.together and len(pack) > 1 else None
        for m in live:
            m.draft = draft_factor([o.d - m.d for o in moving if o is not m])
            m.band = band_factor(m.d - mid) if mid is not None and m in pack else 1.0
        for k, m in enumerate(sim.ranked()):
            m.lane = C.ROAD_LANES[k % len(C.ROAD_LANES)]

    def after(self, sim: RoadSim, dt: float) -> list[dict]:
        """Rule-set effects after the riders have moved (scoring, eliminations). Returns fx."""
        return []

    def state(self, sim: RoadSim) -> dict | None:
        """Extra game state for the tick's `game` field."""
        return None

    def over(self, sim: RoadSim) -> bool:
        """True when the ride should end: every human present is home, or the grace has run out."""
        humans = [m for m in sim.movers.values() if not m.bot and m.here]
        late = sim.first_fin is not None and sim.el - sim.first_fin > C.ROAD_FINISH_GRACE_S
        return late or (bool(humans) and all(m.fin is not None for m in humans))

    def results(self, sim: RoadSim) -> list[dict]:
        """Finishers who rode the whole way by time, then everyone else by how far they got."""
        rows = []
        for m in sim.movers.values():
            secs = max(1e-6, (m.fin if m.fin is not None else sim.el) - m.start_el)
            full = m.fin is not None and m.start_d == 0
            rows.append(
                {
                    "id": m.id,
                    "bot": m.bot,
                    "time": round(m.fin - m.start_el, 1) if m.fin is not None else None,
                    "dist": round(m.d - m.start_d),
                    "late": m.start_d > 0,
                    "avgPower": round(m.work / secs),
                    "wkg": round(m.work / secs / m.kg, 2),
                    "saved": round(m.saved / secs),
                    "_key": (0, m.fin) if full else (1, -m.d),
                }
            )
        rows.sort(key=lambda r: r.pop("_key"))
        return [{**r, "place": k + 1} for k, r in enumerate(rows)]


RULES: dict[str, type[Rules]] = {"ride": Rules}


class RoadSim:
    """Positions on a road, stepped with the same physics as the client's free ride."""

    def __init__(self, route: str, laps: int = 1, together: bool = False, game: str = "ride") -> None:
        self.route, self.together, self.game = route, together, game
        self.road = Road(route, laps)
        self.rules = RULES[game]()
        self.movers: dict[str, Mover] = {}
        self.order: list[str] = []
        self.el = -float(C.ROAD_COUNTDOWN_S)
        self.first_fin: float | None = None

    def add(self, rid: str, kg: float | None, ftp: int, bot: bool = False) -> Mover:
        """Puts a rider on the road (a late joiner lands where the rules say)."""
        m = self.movers[rid] = Mover(rid, kg or C.ROAD_DEFAULT_KG, ftp, bot)
        self.rules.place(self, m)
        self.order.append(rid)
        return m

    def ranked(self) -> list[Mover]:
        """Riders still out, front first. One bubble pass with a metre of slack, so lanes do not flicker."""
        o = [i for i in self.order if self.movers[i].fin is None]
        for k in range(len(o) - 1):
            if self.movers[o[k + 1]].d > self.movers[o[k]].d + 1:
                o[k], o[k + 1] = o[k + 1], o[k]
        self.order = o + [i for i in self.order if self.movers[i].fin is not None]
        return [self.movers[i] for i in o]

    def step(self, dt: float) -> list[dict]:
        """Advances the ride by `dt` seconds and returns the one-shot effects."""
        self.el += dt
        if self.el <= 0:
            return []
        fx: list[dict] = []
        live = [m for m in self.movers.values() if m.fin is None]
        self.rules.tune(self, live)
        road = self.road
        for m in live:
            lim = speed_limit(m.v, lambda s, m=m: road.curv_at(m.d + s))
            m.v = step_speed(m.v, m.p, road.grade_at(m.d), total_mass(m.kg), dt, 0, lim, m.draft)
            go = m.v * m.band * dt
            m.work += m.p * dt
            m.saved += 0.5 * C.ROAD_RHO * C.ROAD_CDA * (1 - m.draft) * m.v**3 * dt
            if m.d + go >= road.distance:
                m.fin = self.el - dt * (1 - (road.distance - m.d) / go)
                m.d, m.v, m.p = road.distance, 0.0, 0.0
                self.first_fin = m.fin if self.first_fin is None else self.first_fin
                done = sum(o.fin is not None for o in self.movers.values())
                fx.append({"k": "finish", "id": m.id, "text": str(done)})
            else:
                m.d += go
        return fx + self.rules.after(self, dt)

    def riders(self) -> dict[str, dict]:
        """The per-rider part of a tick. `v` is the ground speed (band included)."""
        return {
            m.id: {
                "d": round(m.d, 1),
                "v": round(m.v * m.band, 2),
                "w": round(m.p),
                "cad": round(m.cad),
                "hr": m.hr,
                "lane": m.lane,
                "draft": round(m.draft, 3),
                "band": round(m.band, 3),
                "st": m.st,
                "fin": None if m.fin is None else round(m.fin - m.start_el, 1),
            }
            for m in self.movers.values()
        }

    def to_dict(self) -> dict:
        return {
            "route": self.route,
            "laps": self.road.laps,
            "together": self.together,
            "game": self.game,
            "el": self.el,
            "first_fin": self.first_fin,
            "movers": [asdict(m) for m in self.movers.values()],
        }

    @classmethod
    def from_dict(cls, d: dict) -> RoadSim:
        sim = cls(d["route"], d["laps"], d["together"], d["game"])
        sim.el, sim.first_fin = d["el"], d["first_fin"]
        sim.movers = {m["id"]: Mover(**m) for m in d["movers"]}
        sim.order = sorted(sim.movers, key=lambda i: -sim.movers[i].d)
        return sim

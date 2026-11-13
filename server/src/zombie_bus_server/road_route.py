"""Route geometry for road rides, so the server sees the same gradients and bends as the client.

A port of the client's `packToRoute`/`buildRoute` (core/route.ts) and of the centreline curvature in
scene/route/roadPath.ts. Both sides run content/tests/road-vectors.json.
"""

import json
import math
from dataclasses import dataclass
from functools import cache

from . import config as C

SPUR_M, SPUR_GAP_M, SPUR_PAD = 80, 6, 15
UTURN_GAP_M, UTURN_MIN_M, UTURN_TAPER_M = 10, 300, 80
BULB_HOLD_M, BULB_FADE_M = 25, 40
ROUTES = C.CONTENT / "routes"


def _clamp(v: float) -> float:
    return min(1.0, max(0.0, v))


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    rad = math.pi / 180
    a = (
        math.sin((lat2 - lat1) * rad / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin((lon2 - lon1) * rad / 2) ** 2
    )
    return 2 * 6371000 * math.asin(min(1.0, math.sqrt(a)))


def _resample(pts: list[list[float]]) -> tuple[float, list[float], list[float], list[float]]:
    """Evenly spaced heights, latitudes and longitudes along the track, and the spacing."""
    dist = [0.0]
    for a, b in zip(pts, pts[1:], strict=False):
        dist.append(dist[-1] + haversine(a[0], a[1], b[0], b[1]))
    total = dist[-1]
    step = C.ROAD_SPACING_M
    space = max(step, math.ceil(total / C.ROAD_MAX_STORED / step) * step)
    out: tuple[list[float], list[float], list[float]] = ([], [], [])
    j = 0
    for i in range(math.floor(total / space) + 1):
        d = i * space
        while j < len(pts) - 2 and dist[j + 1] < d:
            j += 1
        span = dist[j + 1] - dist[j]
        f = _clamp((d - dist[j]) / span) if span > 0 else 0.0
        for k, col in enumerate((2, 0, 1)):
            out[k].append(pts[j][col] + (pts[j + 1][col] - pts[j][col]) * f)
    return space, *out


def _grades(el: list[float], space: float) -> list[float]:
    """Smoothed heights to a gradient (%) per sample, clamped like the client's."""
    n = len(el)
    half = max(1, math.floor(C.ROAD_SMOOTH_M / space / 2 + 0.5))
    sm = []
    for i in range(n):
        w = min(half, i, n - 1 - i)
        sm.append(sum(el[i - w : i + w + 1]) / (2 * w + 1))
    top = C.ROAD_MAX_GRADE_PCT
    rise = [(sm[i - 1 if i == n - 1 else i + 1] - sm[i]) * (-1 if i == n - 1 else 1) for i in range(n)]
    return [round(max(-top, min(top, r / space * 100)), 2) for r in rise]


def _split_uturns(x: list[float], z: list[float], space: float) -> None:
    """A long out-and-back becomes two carriageways with a loop at the turn (see roadPath.ts)."""
    n = len(x)

    def lo(c: int, q: int) -> int:
        return -(-c // 2) - 1 - q

    def hi(c: int, q: int) -> int:
        return c // 2 + 1 + q

    def gap(c: int, q: int) -> float:
        return math.hypot(x[hi(c, q)] - x[lo(c, q)], z[hi(c, q)] - z[lo(c, q)])

    def fit(c: int) -> float:
        return gap(c, 0) + gap(c, 1) + gap(c, 2) + gap(c, 3)

    c = 10
    while c < 2 * n - 12:
        if gap(c, 1) > UTURN_GAP_M or gap(c, 3) > UTURN_GAP_M:
            c += 1
            continue
        k = c + 1
        while k <= c + 6 and k < 2 * n - 12:
            if fit(k) < fit(c):
                c = k
            k += 1
        m = 3
        while lo(c, m) > 1 and hi(c, m) < n - 2 and gap(c, m + 1) < UTURN_GAP_M:
            m += 1
        if m * space < UTURN_MIN_M:
            c += 1
            continue
        a = lo(c, m) - 1
        ox, oz = x[a : lo(c, 0) + 2], z[a : lo(c, 0) + 2]
        for q in range(m + 1):
            i, j = lo(c, q), hi(c, q)
            k = i - a
            fx, fz = ox[k + 1] - ox[k - 1], oz[k + 1] - oz[k - 1]
            bulb = _clamp(1 - ((j - i) * space * 0.5 - BULB_HOLD_M) / BULB_FADE_M)
            shift = C.ROAD_UTURN_SHIFT_M + (C.ROAD_UTURN_BULB_M - C.ROAD_UTURN_SHIFT_M) * bulb
            w = shift * _clamp((m - q) * space / UTURN_TAPER_M) / (math.hypot(fx, fz) or 1)
            x[i], z[i] = ox[k] + fz * w, oz[k] - fx * w
            x[j], z[j] = ox[k] - fz * w, oz[k] + fx * w
        c = 2 * hi(c, m) + 1


def _despur(x: list[float], z: list[float], space: float) -> None:
    """Cuts out short out-and-back spurs and spreads the points evenly over the join."""
    n = len(x)
    reach = math.floor(SPUR_M / space + 0.5)
    i = 1
    while i < n - 2:
        j = min(n - 1, i + reach)
        while j > i + 1 and math.hypot(x[j] - x[i], z[j] - z[i]) > SPUR_GAP_M:
            j -= 1
        if j <= i + 1:
            i += 1
            continue
        a, b = max(0, i - SPUR_PAD), min(n - 1, j + SPUR_PAD)
        keep = [k for k in range(a, b + 1) if k <= i or k >= j]
        qx, qz = [x[k] for k in keep], [z[k] for k in keep]
        ln = [0.0]
        for k in range(1, len(qx)):
            ln.append(ln[-1] + math.hypot(qx[k] - qx[k - 1], qz[k] - qz[k - 1]))
        seg = 0
        for k in range(a + 1, b):
            at = (k - a) / (b - a) * ln[-1]
            while seg < len(ln) - 2 and ln[seg + 1] < at:
                seg += 1
            t = (at - ln[seg]) / ((ln[seg + 1] - ln[seg]) or 1)
            x[k] = qx[seg] + (qx[seg + 1] - qx[seg]) * t
            z[k] = qz[seg] + (qz[seg + 1] - qz[seg]) * t
        i = b + 1


def _curvature(lat: list[float], lon: list[float], space: float) -> list[float]:
    """Signed curvature (1/m) at each sample of the drawn centreline."""
    n = len(lat)
    lat0, lon0 = round(lat[0], 5), round(lon[0], 5)
    east = 111320 * math.cos(lat0 * math.pi / 180)
    x = [(round(v, 5) - lon0) * east for v in lon]
    z = [-(round(v, 5) - lat0) * 110540 for v in lat]
    _split_uturns(x, z, space)
    _despur(x, z, space)
    for _ in range(C.ROAD_SMOOTH_PASSES):
        for a in (x, z):
            prev = a[0]
            for i in range(1, n - 1):
                cur = a[i]
                a[i] = (prev + 2 * cur + a[i + 1]) / 4
                prev = cur
    raw = [0.0] * n
    for i in range(1, n - 1):
        a = math.atan2(x[i] - x[i - 1], z[i - 1] - z[i])
        b = math.atan2(x[i + 1] - x[i], z[i] - z[i + 1])
        turn = math.atan2(math.sin(b - a), math.cos(b - a))
        raw[i] = turn / max(1.0, math.hypot(x[i + 1] - x[i - 1], z[i + 1] - z[i - 1]) / 2)
    return [(raw[i - 1] + 2 * c + raw[i + 1]) / 4 if 0 < i < n - 1 else c for i, c in enumerate(raw)]


@dataclass(frozen=True)
class Lap:
    """One lap of a bundled route, resampled."""

    id: str
    name: str
    loop: bool
    space: float
    grade: tuple[float, ...]
    curv: tuple[float, ...]

    @property
    def distance(self) -> float:
        return (len(self.grade) - 1) * self.space

    def laps_max(self) -> int:
        """The most laps the host may pick: 1 unless the route is a circuit."""
        if not self.loop:
            return 1
        return max(1, min(C.ROAD_LAPS_MAX, math.floor(C.ROAD_LAPS_MAX_M / max(1.0, self.distance))))


@cache
def load_lap(route_id: str) -> Lap:
    """Loads and resamples content/routes/<id>.json. Raises KeyError for an unknown route."""
    path = ROUTES / f"{route_id}.json"
    if route_id == "index" or not route_id.replace("-", "").isalnum() or not path.exists():
        raise KeyError(route_id)
    pack = json.loads(path.read_text())
    space, el, lat, lon = _resample(pack["pts"])
    return Lap(
        pack["id"],
        pack["name"],
        bool(pack.get("loop")),
        space,
        tuple(_grades(el, space)),
        tuple(_curvature(lat, lon, space)),
    )


class Road:
    """A lap ridden `laps` times: the whole ride's distance, and the gradient and curvature anywhere on it."""

    def __init__(self, route_id: str, laps: int = 1) -> None:
        self.lap = load_lap(route_id)
        self.laps = max(1, min(self.lap.laps_max(), laps))
        self.distance = self.lap.distance * self.laps

    def grade_at(self, d: float) -> float:
        """Gradient (%) at `d` metres, as the client's `routeAt` on the `withLaps` route reads it."""
        n = len(self.lap.grade)
        last = n - 1 + (self.laps - 1) * (n - 1)
        i = min(math.floor(max(d, 0.0) / self.lap.space), last - 1)
        return self.lap.grade[i if i < n else (i - 1) % (n - 1) + 1]

    def curv_at(self, d: float) -> float:
        """Curvature (1/m) at `d` metres, as `RoadPath.poseAt` gives it; straight beyond the end."""
        c = self.lap.curv
        u = (d % self.lap.distance if self.laps > 1 else d) / self.lap.space
        if u > len(c) - 1:
            return 0.0
        i = max(0, min(math.floor(u), len(c) - 2))
        return c[i] + (c[i + 1] - c[i]) * _clamp(u - i)

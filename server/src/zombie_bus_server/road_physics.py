"""Road physics: a line-for-line port of client/src/core/physics.ts, plus drafting and the keep-together band.

Both sides run content/tests/road-vectors.json, so a change here needs the same change there.
"""

import math
from collections.abc import Callable

from . import config as C

G = 9.81


def total_mass(weight_kg: float | None = None) -> float:
    """Rider plus bike, kg."""
    return (weight_kg or C.ROAD_DEFAULT_KG) + C.ROAD_BIKE_KG


def resistance(v: float, grade_pct: float, mass: float, wind: float = 0, draft: float = 1) -> float:
    """Force opposing motion at `v` m/s in newtons; `draft` scales the aerodynamic drag (1 is clean air)."""
    th = math.atan(grade_pct / 100)
    air = v + wind
    return mass * G * (
        math.sin(th) + C.ROAD_CRR * math.cos(th)
    ) + 0.5 * C.ROAD_RHO * C.ROAD_CDA * draft * air * abs(air)


def step_speed(
    v: float,
    power: float,
    grade_pct: float,
    mass: float,
    dt: float,
    wind: float = 0,
    limit: float = C.ROAD_MAX_MS,
    draft: float = 1,
) -> float:
    """Advances speed `v` by `dt` seconds: momentum, a drive-force cap, and braking down to `limit`."""
    n = max(1, math.ceil(dt / 0.1))
    h = dt / n
    for _ in range(n):
        drive = min(power * C.ROAD_DRIVETRAIN / max(v, 0.5), C.ROAD_MAX_DRIVE_N)
        nxt = v + (drive - resistance(v, grade_pct, mass, wind, draft)) / mass * h
        v = max(limit, min(nxt, v - C.ROAD_MAX_BRAKE_MS2 * h)) if nxt > limit else nxt
        v = min(C.ROAD_MAX_MS, max(0.0, v))
    return v


def corner_speed(curv: float) -> float:
    """The fastest a bend of curvature `curv` (1/m) can be taken."""
    return min(
        C.ROAD_MAX_MS, max(C.ROAD_CORNER_MIN_MS, math.sqrt(C.ROAD_CORNER_LAT_MS2 / max(1e-6, abs(curv))))
    )


def speed_limit(v: float, curv_at: Callable[[float], float]) -> float:
    """The speed allowed now at speed `v`, so gentle braking reaches every bend ahead at its speed."""
    lim = float(C.ROAD_MAX_MS)
    step = C.ROAD_CORNER_STEP_M
    reach = v * v / (2 * C.ROAD_BRAKE_MS2)
    s = 0.0
    while s <= reach + step:
        lim = min(lim, math.sqrt(corner_speed(curv_at(s)) ** 2 + 2 * C.ROAD_BRAKE_MS2 * max(0.0, s - step)))
        s += step
    return lim


def draft_factor(gaps: list[float]) -> float:
    """CdA multiplier (1 is clean air) for a rider, given the metres to each moving rider ahead."""
    near = [g for g in gaps if 0 < g <= C.DRAFT_BUNCH_M]
    if not near or min(near) >= C.DRAFT_REACH_M:
        return 1.0
    fade = min(1.0, (C.DRAFT_REACH_M - min(near)) / (C.DRAFT_REACH_M - C.DRAFT_FULL_M))
    return 1 - min(C.DRAFT_CAP, C.DRAFT_WHEEL * fade * (1 + C.DRAFT_BUNCH_X * (len(near) - 1)))


def band_factor(gap: float) -> float:
    """Keep-together scale on distance covered for a rider `gap` metres ahead of the group's middle."""
    over = max(0.0, abs(gap) - C.BAND_DEAD_M) / (C.BAND_FULL_M - C.BAND_DEAD_M)
    return 1 - math.copysign(min(1.0, over) * C.BAND_MAX, gap)

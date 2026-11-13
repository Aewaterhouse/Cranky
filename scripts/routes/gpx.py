"""Routes cut from a recorded ride (GPX) or a course file (FIT): the rider's own line and heights.

The recordings stay out of git (they start and end at home); only the cut section is used.
"""

import math
import re
from pathlib import Path

import fit
import terrain

SPACING_M = 10
LOOP_SEARCH_M = 400  # how far either side of the stated lap end to look for the true closure
SPARSE_M = 15  # tracks with points further apart than this are not position-smoothed
OFFSET_EVERY = 10  # compare every 10th point with SRTM to remove the altimeter's offset

Point = tuple[float, float]


def haversine(a: Point, b: Point) -> float:
    """Returns the great-circle distance in metres between two (lat, lon) points."""
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def parse(text: str) -> list[tuple[float, float, float | None]]:
    """Returns (lat, lon, ele) for every track point; ele is None where the file has none."""
    out = []
    for attrs, body in re.findall(r"<trkpt([^>]*)>(.*?)</trkpt>", text, re.S):
        lat = re.search(r'lat="([-\d.]+)"', attrs)
        lon = re.search(r'lon="([-\d.]+)"', attrs)
        ele = re.search(r"<ele>([-\d.]+)", body)
        if lat and lon:
            out.append((float(lat[1]), float(lon[1]), float(ele[1]) if ele else None))
    return out


def fill(values: list[float | None]) -> list[float]:
    """Fills gaps by carrying the nearest known value across them (linear between neighbours)."""
    known = [i for i, v in enumerate(values) if v is not None]
    if not known:
        return [0.0] * len(values)
    out = []
    k = 0
    for i, v in enumerate(values):
        while k < len(known) - 1 and known[k + 1] <= i:
            k += 1
        a = known[k]
        b = known[min(k + 1, len(known) - 1)]
        if v is not None or a == b or i <= a:
            out.append(v if v is not None else values[a])
        else:
            out.append(values[a] + (values[b] - values[a]) * (i - a) / (b - a))
    return out


def cut(pts: list, from_km: float, to_km: float, loop: bool) -> list:
    """Returns the track between two distances; a loop ends where it comes back to its start."""
    dist = [0.0]
    for a, b in zip(pts, pts[1:], strict=False):
        dist.append(dist[-1] + haversine(a[:2], b[:2]))
    start = min(range(len(pts)), key=lambda i: abs(dist[i] - from_km * 1000))
    end = min(range(len(pts)), key=lambda i: abs(dist[i] - to_km * 1000))
    if loop:
        near = [i for i in range(start + 1, len(pts)) if abs(dist[i] - to_km * 1000) <= LOOP_SEARCH_M]
        end = min(near, key=lambda i: haversine(pts[i][:2], pts[start][:2]))
    return pts[start : end + 1]


def resample(pts: list[tuple[float, float, float]], step: float) -> list[tuple[float, float, float]]:
    """Returns (lat, lon, ele) every `step` metres along the track."""
    out = [pts[0]]
    carry = 0.0
    for a, b in zip(pts, pts[1:], strict=False):
        seg = haversine(a[:2], b[:2])
        at = step - carry
        while at <= seg:
            f = at / seg
            out.append(tuple(a[k] + (b[k] - a[k]) * f for k in range(3)))
            at += step
        carry = (carry + seg) % step
    return out


def _average(section: list) -> list:
    """Three-point moving average of (lat, lon, ele)."""
    out = []
    for i in range(len(section)):
        near = section[max(0, i - 1) : i + 2]
        out.append(tuple(sum(q[k] for q in near) / len(near) for k in range(3)))
    return out


def route(file: Path, from_km: float, to_km: float, loop: bool) -> tuple[list[Point], list[float]]:
    """Returns the 10 m centreline and heights for a section of a recorded ride."""
    raw = fit.track(file) if file.suffix.lower() == ".fit" else parse(file.read_text())
    ele = fill([p[2] for p in raw])
    section = cut([(la, lo, e) for (la, lo, _), e in zip(raw, ele, strict=False)], from_km, to_km, loop)
    # A three-point average takes the GPS jitter out of a recording. A course file's points are already
    # clean and far apart, where averaging would only cut the corners.
    spacing = sum(haversine(a[:2], b[:2]) for a, b in zip(section, section[1:], strict=False)) / len(section)
    smooth = section if spacing > SPARSE_M else _average(section)
    if loop:
        # Altimeters drift over a lap; spread the mismatch so the lap closes exactly.
        drift = smooth[-1][2] - smooth[0][2]
        n = len(smooth)
        smooth = [(p[0], p[1], p[2] - drift * i / n) for i, p in enumerate(smooth)]
        smooth.append(smooth[0])
    fine = resample(smooth, SPACING_M)
    heights = [p[2] for p in fine]
    line = [(p[0], p[1]) for p in fine]
    gaps = sorted(terrain.height(*line[i]) - heights[i] for i in range(0, len(line), OFFSET_EVERY))
    offset = gaps[len(gaps) // 2]
    return line, [h + offset for h in heights]

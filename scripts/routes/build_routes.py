"""Builds bundled free-ride route packs from OpenStreetMap roads and SRTM heights.

Usage: python3 scripts/routes/build_routes.py [route-id ...] [--force]

Reads scripts/routes/routes.json, writes content/routes/<id>.json (centreline plus a
height grid of the land around it, see terrain.py) and index.json.
A route whose length or climb is too far from its published figures is not written
unless --force is given. Network replies are cached in scripts/routes/.cache.
"""

import heapq
import json
import math
import sys
from pathlib import Path

import features
import gpx
import terrain
from net import fetch

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
OUT = ROOT / "content" / "routes"
OVERPASS = "https://overpass-api.de/api/interpreter"
ELEVATION = "https://api.opentopodata.org/v1/srtm30m"
ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|road"
PAD_DEG = 0.02
SNAP_MAX_M = 300
SPUR_MAX_M = 250  # out-and-back stubs up to this long (each way) are dropped
SPACING_M = 10  # matches CFG.freeRide.spacingM on the client
SMOOTH_M = 100  # matches CFG.freeRide.smoothM
MAX_STORED = 4000  # matches CFG.freeRide.maxStored
MAX_GRADE = 20.0
ELE_STEP_M = 30  # SRTM resolution; sampling finer buys nothing
ELE_BATCH = 100
DIST_TOL = 0.05
GAIN_TOL = 0.10
PROFILE_N = 60
GPX_SMOOTH_M = 100
# SRTM is noisy on roads cut into hillsides, so heights are averaged along the road first.
# 300 m removes most of it; wider windows are tried only when the climb is still over.
SMOOTH_TRY_M = [300, 400, 600, 800]

Point = tuple[float, float]


def haversine(a: Point, b: Point) -> float:
    """Returns the great-circle distance in metres between two (lat, lon) points."""
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def road_graph(waypoints: list[Point]) -> tuple[dict[int, Point], dict[int, list]]:
    """Fetches the public roads around the waypoints as nodes and an undirected graph."""
    lats, lons = [w[0] for w in waypoints], [w[1] for w in waypoints]
    box = f"{min(lats) - PAD_DEG},{min(lons) - PAD_DEG},{max(lats) + PAD_DEG},{max(lons) + PAD_DEG}"
    query = f'[out:json][timeout:120];way["highway"~"^({ROADS})(_link)?$"]({box});out geom;'
    pos: dict[int, Point] = {}
    adj: dict[int, list] = {}
    for way in fetch(OVERPASS, {"data": query})["elements"]:
        ids = way["nodes"]
        for n, g in zip(ids, way["geometry"], strict=False):
            pos[n] = (g["lat"], g["lon"])
        for a, b in zip(ids, ids[1:], strict=False):
            d = haversine(pos[a], pos[b])
            adj.setdefault(a, []).append((b, d))
            adj.setdefault(b, []).append((a, d))
    return pos, adj


def shortest(adj: dict[int, list], start: int, goal: int) -> list[int]:
    """Returns the node ids of the shortest path (plain Dijkstra)."""
    dist = {start: 0.0}
    prev: dict[int, int] = {}
    heap = [(0.0, start)]
    while heap:
        d, n = heapq.heappop(heap)
        if n == goal:
            break
        if d > dist[n]:
            continue
        for m, w in adj.get(n, []):
            if d + w < dist.get(m, math.inf):
                dist[m], prev[m] = d + w, n
                heapq.heappush(heap, (d + w, m))
    if goal not in dist:
        raise ValueError("no road joins two of the waypoints")
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    return path[::-1]


def drop_spurs(nodes: list[int], pos: dict[int, Point]) -> list[int]:
    """Removes short out-and-back stubs left when a waypoint snaps just off the through road."""
    out = list(nodes)
    c = 1
    while c < len(out) - 1:
        k = 0
        while c - k > 0 and c + k < len(out) - 1 and out[c - k - 1] == out[c + k + 1]:
            k += 1
        stub = out[c : c + k + 1]
        length = sum(haversine(pos[a], pos[b]) for a, b in zip(stub, stub[1:], strict=False))
        if k and length <= SPUR_MAX_M:
            del out[c - k + 1 : c + k + 1]
            c = max(1, c - k)
        else:
            c += 1
    return out


def trace(waypoints: list[Point]) -> tuple[list[Point], float, set[int]]:
    """Routes along roads through the waypoints; returns the line and the worst snap in metres."""
    pos, adj = road_graph(waypoints)
    snaps = [min(adj, key=lambda n: haversine(pos[n], w)) for w in waypoints]
    worst = max(haversine(pos[n], w) for n, w in zip(snaps, waypoints, strict=False))
    nodes: list[int] = []
    for a, b in zip(snaps, snaps[1:], strict=False):
        leg = shortest(adj, a, b)
        nodes += leg[1:] if nodes else leg
    nodes = drop_spurs(nodes, pos)
    line = [pos[n] for n in nodes]
    return line, worst, set(nodes)


def resample(line: list[Point], step: float) -> list[Point]:
    """Returns points every `step` metres along the line, starting at its first point."""
    out = [line[0]]
    carry = 0.0
    for a, b in zip(line, line[1:], strict=False):
        seg = haversine(a, b)
        at = step - carry
        while at <= seg:
            f = at / seg
            out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
            at += step
        carry = (carry + seg) % step
    return out


def elevations(pts: list[Point]) -> list[float]:
    """Looks up SRTM heights for the points, a batch at a time."""
    out: list[float] = []
    for i in range(0, len(pts), ELE_BATCH):
        locs = "|".join(f"{la:.5f},{lo:.5f}" for la, lo in pts[i : i + ELE_BATCH])
        res = fetch(f"{ELEVATION}?locations={locs}", pause=1.1)["results"]
        out += [r["elevation"] or 0.0 for r in res]
    return out


def smooth(ele: list[float], window_m: float) -> list[float]:
    """Moving average along the road; the window shrinks at the ends so they stay put."""
    half = round(window_m / SPACING_M / 2)
    if not half:
        return ele
    acc = [0.0]
    for e in ele:
        acc.append(acc[-1] + e)
    n = len(ele)
    out = []
    for i in range(n):
        w = min(half, i, n - 1 - i)
        out.append((acc[i + w + 1] - acc[i - w]) / (2 * w + 1))
    return out


def calibrate(ele: list[float], gain: float | None) -> tuple[list[float], int]:
    """Smooths with the narrowest window that brings the climb within tolerance of `gain`."""

    def off(w: int) -> float:
        return abs(stats(smooth(ele, w))["gainM"] - gain) if gain else 0.0

    ok = [w for w in SMOOTH_TRY_M if off(w) <= GAIN_TOL * (gain or 0)]
    best = ok[0] if ok else min(SMOOTH_TRY_M, key=off)
    return smooth(ele, best), best


def stats(ele: list[float]) -> dict:
    """Mirrors the client's buildRoute: smoothing, ascent and gradient figures."""
    total = (len(ele) - 1) * SPACING_M
    space = max(SPACING_M, math.ceil(total / MAX_STORED / SPACING_M) * SPACING_M)
    el = ele[:: space // SPACING_M]
    n = len(el)
    half = max(1, round(SMOOTH_M / space / 2))
    sm = []
    for i in range(n):
        w = min(half, i, n - 1 - i)
        sm.append(sum(el[i - w : i + w + 1]) / (2 * w + 1))
    rises = sum(max(0.0, b - a) for a, b in zip(sm, sm[1:], strict=False))
    grades = sorted(
        max(-MAX_GRADE, min(MAX_GRADE, (b - a) / space * 100)) for a, b in zip(sm, sm[1:], strict=False)
    )
    return {
        "km": round((n - 1) * space / 1000, 1),
        "gainM": round(rises),
        "avgGrade": round((sm[-1] - sm[0]) / ((n - 1) * space) * 100, 1),
        "maxGrade": round(max(0.0, grades[int(len(grades) * 0.99)]), 1),
        "profile": [round(sm[round(i * (n - 1) / (PROFILE_N - 1))], 1) for i in range(PROFILE_N)],
    }


def road_heights(line: list[Point]) -> tuple[list[Point], list[float]]:
    """Returns the 10 m centreline of a traced road and its SRTM heights."""
    heights = elevations(resample(line, ELE_STEP_M))
    fine = resample(line, SPACING_M)
    ratio = SPACING_M / ELE_STEP_M
    ele = []
    for i in range(len(fine)):
        x = min(i * ratio, len(heights) - 1)
        j = min(int(x), len(heights) - 2)
        ele.append(heights[j] + (heights[j + 1] - heights[j]) * (x - j))
    return fine, ele


def build(spec: dict) -> tuple[dict, dict, list[str]]:
    """Builds one pack; returns (pack, index entry, problems)."""
    if "gpx" in spec:
        nodes, snap = None, 0.0
        fine, ele = gpx.route(ROOT / spec["gpx"], *spec["cutKm"], spec.get("loop", False))
    else:
        line, snap, nodes = trace([tuple(w) for w in spec["waypoints"]])
        fine, ele = road_heights(line)
    pub = spec["published"]
    # A recorded ride's altimeter is far smoother than SRTM, so it needs only a light pass.
    ele, window = (smooth(ele, GPX_SMOOTH_M), GPX_SMOOTH_M) if nodes is None else calibrate(ele, pub["gainM"])
    s = {**stats(ele), "smoothM": window}
    problems = []
    if snap > SNAP_MAX_M:
        problems.append(f"a waypoint is {snap:.0f} m from the nearest road")
    if pub["km"] and abs(s["km"] - pub["km"]) > DIST_TOL * pub["km"]:
        problems.append(f"length {s['km']} km vs published {pub['km']} km")
    if pub["gainM"] and abs(s["gainM"] - pub["gainM"]) > GAIN_TOL * pub["gainM"]:
        problems.append(f"climb {s['gainM']} m vs published {pub['gainM']} m")
    head = {k: spec[k] for k in ("id", "name", "region", "blurb", "loop") if k in spec}
    pts = [[round(la, 5), round(lo, 5), round(e, 1)] for (la, lo), e in zip(fine, ele, strict=False)]
    s.pop("smoothM")
    grid = terrain.grid(fine)
    pack = {**head, "published": pub, "pts": pts, "terrain": grid}
    try:
        pack["features"] = features.build(fine, nodes, grid, fetch)
    except OSError as err:
        # Keep what an earlier build fetched; a pack with none falls back to the scene's defaults.
        old_file = OUT / f"{spec['id']}.json"
        old = json.loads(old_file.read_text()) if old_file.exists() else {}
        same = {k: v for k, v in old.get("terrain", {}).items() if k != "cover"} == grid
        if "features" in old and same:
            pack["features"] = old["features"]
            grid["cover"] = old["terrain"].get("cover")
        kept = "old" if "features" in pack else "no"
        print(f"     {spec['id']}: map server refused ({err}); kept {kept} features")
    real = {"real": True} if "gpx" in spec else {}  # cut from a crew recording, not drawn from map data
    return pack, {**head, **real, **s, "smoothM": window}, problems


def put(file: Path, text: str) -> None:
    """Writes only when the content changed, so a dev server watching the packs is not reloaded."""
    if not file.exists() or file.read_text() != text:
        file.write_text(text)


def main(argv: list[str]) -> int:
    """Builds the named routes (or all of them) and rewrites the index."""
    force = "--force" in argv
    want = [a for a in argv if not a.startswith("--")]
    specs = json.loads((HERE / "routes.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    index_file = OUT / "index.json"
    index = {e["id"]: e for e in json.loads(index_file.read_text())} if index_file.exists() else {}
    failed = 0
    for spec in specs:
        if want and spec["id"] not in want:
            continue
        try:
            pack, entry, problems = build(spec)
        except (ValueError, OSError, KeyError) as err:
            print(f"FAIL {spec['id']}: {err}")
            failed += 1
            continue
        line = (
            f"{spec['id']}: {entry['km']} km, {entry['gainM']} m, max {entry['maxGrade']}%, "
            f"smoothed {entry.pop('smoothM')} m"
        )
        if problems and not force:
            print(f"FAIL {line} ({'; '.join(problems)})")
            failed += 1
            continue
        print(f"{'WARN' if problems else 'ok  '} {line} {'; '.join(problems)}")
        put(OUT / f"{spec['id']}.json", json.dumps(pack, separators=(",", ":")))
        index[spec["id"]] = entry
    order = [s["id"] for s in specs]
    kept = sorted(index.values(), key=lambda e: order.index(e["id"]) if e["id"] in order else 99)
    put(index_file, json.dumps(kept, indent=1) + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

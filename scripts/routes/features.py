"""Map features around a route from OpenStreetMap: land cover, side roads, buildings, landmarks.

Everything is in the terrain grid's local metres (east, north) from its (lat0, lon0) corner.
Land cover is rasterised onto the terrain grid, one letter per known cell (see COVER).
"""

import math
from collections.abc import Callable

OVERPASS = "https://overpass-api.de/api/interpreter"
M_PER_DEG_LAT = 110540
M_PER_DEG_LON = 111320
AREA_REACH_M = 900
ROAD_REACH_M = 300
BUILDING_REACH_M = 150
POLY_STEP = 40  # every 40th 10 m point: a 400 m polyline is plenty for "around" queries
MAX_BUILDINGS = 6000
MIN_BUILDING_M2 = 20
ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|road"
MAIN = {"motorway", "trunk", "primary", "secondary", "tertiary"}
# Letter and priority per tag value; higher priorities paint over lower ones.
COVER = {
    "w": (9, {"water", "bay", "reservoir", "basin", "wetland"}),
    "a": (8, {"beach", "sand"}),
    "r": (7, {"bare_rock", "scree", "shingle"}),
    "u": (6, {"residential", "commercial", "retail", "industrial"}),
    "p": (5, {"park", "pitch", "golf_course", "playground", "garden", "recreation_ground", "cemetery"}),
    "f": (4, {"forest", "wood"}),
    "s": (4, {"scrub", "heath"}),
    "g": (3, {"farmland", "meadow", "grass", "farmyard", "orchard", "vineyard", "grassland"}),
    "b": (1, {"national_park", "nature_reserve", "protected_area"}),
}
AREA_KEYS = ("natural", "landuse", "leisure", "boundary")
POI_KINDS = {
    "peak": "peak",
    "viewpoint": "viewpoint",
    "tower": "tower",
    "communications_tower": "tower",
    "mast": "tower",
    "cafe": "cafe",
}

Point = tuple[float, float]
Fetch = Callable[..., dict]


def cover_class(tags: dict) -> tuple[int, str] | None:
    """Returns (priority, letter) for an area's tags, or None when it is not land cover."""
    best = None
    for key in AREA_KEYS:
        for letter, (prio, values) in COVER.items():
            if tags.get(key) in values and (best is None or prio > best[0]):
                best = (prio, letter)
    return best


def rings(element: dict) -> list[list[dict]]:
    """Returns the closed outer rings of a way or multipolygon relation, as lat/lon dicts."""
    if element["type"] == "way":
        g = element.get("geometry", [])
        return [g] if len(g) > 3 and g[0] == g[-1] else []
    parts = [
        list(m["geometry"])
        for m in element.get("members", [])
        if m["type"] == "way" and m.get("role") != "inner" and m.get("geometry")
    ]
    done = []
    while parts:
        ring = parts.pop()
        grew = True
        while ring[0] != ring[-1] and grew:
            grew = False
            for i, p in enumerate(parts):
                if p[0] == ring[-1] or p[-1] == ring[-1]:
                    ring += (p if p[0] == ring[-1] else p[::-1])[1:]
                    parts.pop(i)
                    grew = True
                    break
        if len(ring) > 3 and ring[0] == ring[-1]:
            done.append(ring)
    return done


def fill(ring: list[Point], cell: float, known: set, letter: str, out: dict) -> None:
    """Scanline-fills a ring of (east, north) points into `out` for the known grid cells."""
    ys = [p[1] for p in ring]
    for r in range(max(0, math.ceil(min(ys) / cell)), math.floor(max(ys) / cell) + 1):
        y = r * cell
        xs = sorted(
            a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])
            for a, b in zip(ring, ring[1:], strict=False)
            if (a[1] <= y) != (b[1] <= y)
        )
        for x0, x1 in zip(xs[::2], xs[1::2], strict=False):
            for c in range(max(0, math.ceil(x0 / cell)), math.floor(x1 / cell) + 1):
                if (r, c) in known:
                    out[(r, c)] = letter


def footprint(pts: list[Point]) -> tuple[float, float, float, float, float]:
    """Returns centre east, north, width, depth and rotation (degrees from east) of a footprint."""
    a, b = max(zip(pts, pts[1:], strict=False), key=lambda s: math.dist(s[0], s[1]))
    rot = math.atan2(b[1] - a[1], b[0] - a[0])
    ux, uy = math.cos(rot), math.sin(rot)
    along = [p[0] * ux + p[1] * uy for p in pts]
    across = [-p[0] * uy + p[1] * ux for p in pts]
    ca, cc = (min(along) + max(along)) / 2, (min(across) + max(across)) / 2
    width, depth = max(along) - min(along), max(across) - min(across)
    return ca * ux - cc * uy, ca * uy + cc * ux, width, depth, math.degrees(rot) % 180


def side_roads(ways: list[dict], on_route: Callable, local: Callable, near: Callable) -> list[dict]:
    """Splits nearby roads at the route so only the parts that are not the route remain."""
    out = []
    for way in ways:
        tags = way.get("tags", {})
        if tags.get("highway", "").removesuffix("_link") not in ROADS.split("|"):
            continue
        kind = "main" if tags.get("highway", "").removesuffix("_link") in MAIN else "street"
        pts = [local(g["lat"], g["lon"]) for g in way["geometry"]]
        piece: list[Point] = []
        off = False  # the piece has at least one point that is not on the route

        def close(piece: list[Point], off: bool, tags: dict = tags, kind: str = kind) -> None:
            if off and len(piece) > 1:
                line = [[round(x), round(y)] for x, y in piece]
                out.append({"n": tags.get("name", ""), "k": kind, "p": line})

        for n, pt in zip(way["nodes"], pts, strict=False):
            if on_route(n, pt):
                # A junction ends one piece and starts the next.
                piece.append(pt)
                close(piece, off)
                piece, off = [pt], False
            elif near(pt):
                piece.append(pt)
                off = True
            else:
                close(piece, off)
                piece, off = [], False
        close(piece, off)
    return out


def build(line: list[Point], route_nodes: set[int] | None, grid: dict, fetch: Fetch) -> dict:
    """Adds `cover` to the terrain grid and returns the pack's `features` block."""
    lat0, lon0, cell = grid["lat0"], grid["lon0"], grid["cell"]
    k = M_PER_DEG_LON * math.cos(math.radians(lat0))

    def local(lat: float, lon: float) -> Point:
        return ((lon - lon0) * k, (lat - lat0) * M_PER_DEG_LAT)

    poly = ",".join(f"{la:.5f},{lo:.5f}" for la, lo in [*line[::POLY_STEP], line[-1]])
    coarse = {(round(x / 100), round(y / 100)) for x, y in (local(*p) for p in line[::5])}

    # Without road ids (a recorded ride) anything within about 12 m of the line is the route.
    close = {(round(x / 6), round(y / 6)) for x, y in (local(*p) for p in line)}

    def on_route(node: int, p: Point) -> bool:
        if route_nodes is not None:
            return node in route_nodes
        cx, cy = round(p[0] / 6), round(p[1] / 6)
        return any((cx + i, cy + j) in close for i in range(-2, 3) for j in range(-2, 3))

    def near(p: Point) -> bool:
        cx, cy = round(p[0] / 100), round(p[1] / 100)
        return any((cx + i, cy + j) in coarse for i in range(-4, 5) for j in range(-4, 5))

    def ask(body: str) -> list[dict]:
        # Anything at all beside the route rides along as a sentinel: a reply without it is a busy server.
        query = f"[out:json][timeout:300];({body}way(around:60,{poly});node(around:60,{poly});>;);out geom;"
        reply = fetch(OVERPASS, {"data": query}, pause=5, check=lambda d: d.get("elements"))
        return reply["elements"]

    area = f"(around:{AREA_REACH_M},{poly})"
    # One tag at a time: a single query for every kind of area times out on the longer routes.
    areas = [el for key in AREA_KEYS for el in ask(f'way{area}["{key}"];rel{area}["{key}"];')]
    heights = {
        (r, run[0] + i): h
        for r, row in enumerate(grid["runs"])
        for run in row or []
        for i, h in enumerate(run[1])
    }
    # Sea and bays are 0 m in SRTM; unmapped land defaults to open grass.
    cover = {rc: "w" if h <= 0 else "g" for rc, h in heights.items()}
    classed = [(cls, el) for el in areas if (cls := cover_class(el.get("tags", {})))]
    for (_, letter), el in sorted(classed, key=lambda x: x[0][0]):
        for ring in rings(el):
            fill([local(g["lat"], g["lon"]) for g in ring], cell, heights.keys(), letter, cover)
    grid["cover"] = [
        ["".join(cover[(r, run[0] + i)] for i in range(len(run[1]))) for run in row] if row else None
        for r, row in enumerate(grid["runs"])
    ]

    roads = ask(f'way(around:{ROAD_REACH_M},{poly})["highway"~"^({ROADS})(_link)?$"];')
    buildings = []
    for b in ask(f'way(around:{BUILDING_REACH_M},{poly})["building"];'):
        pts = [local(g["lat"], g["lon"]) for g in b.get("geometry", [])]
        if len(pts) < 4 or "building" not in b.get("tags", {}):
            continue
        e, n, width, depth, rot = footprint(pts)
        tags = b.get("tags", {})
        try:
            tall = float(tags["height"]) if "height" in tags else float(tags["building:levels"]) * 3
        except (KeyError, ValueError):
            tall = 4.0
        if width * depth >= MIN_BUILDING_M2:
            buildings.append([round(e), round(n), round(width), round(depth), round(rot), round(tall)])
    step = max(1, math.ceil(len(buildings) / MAX_BUILDINGS))

    pois = []
    spot = f"(around:{AREA_REACH_M},{poly})"
    for el in ask(
        f'node{spot}["natural"="peak"];node{spot}["tourism"="viewpoint"];'
        f'nwr{spot}["man_made"~"^(tower|communications_tower|mast)$"];'
        f'node(around:{BUILDING_REACH_M},{poly})["amenity"="cafe"];'
    ):
        tags = el.get("tags", {})
        kind = next((POI_KINDS[v] for v in tags.values() if v in POI_KINDS), None)
        # Light poles and pylons are tagged as towers too; only broadcast towers are landmarks.
        if kind == "tower" and "communication" not in (tags["man_made"] + tags.get("tower:type", "")):
            continue
        g = el if el["type"] == "node" else (el.get("geometry") or [None])[0]
        if kind and g:
            e, n = local(g["lat"], g["lon"])
            pois.append({"n": tags.get("name", ""), "k": kind, "at": [round(e), round(n)]})

    return {
        "roads": side_roads(roads, on_route, local, near),
        "buildings": buildings[::step],
        "pois": pois,
    }

"""Height grid for the land either side of a route, from SRTM 1-arc-second tiles.

The grid is in local metres from its south-west corner (lat0, lon0):
east = (lon - lon0) * 111320 * cos(lat0), north = (lat - lat0) * 110540.
Row r is north = r * cell and column c is east = c * cell. Only cells near the route are kept.
"""

import gzip
import math
import sys
import urllib.request
from array import array
from pathlib import Path

TILES = "https://s3.amazonaws.com/elevation-tiles-prod/skadi"
CACHE = Path(__file__).parent / ".cache"
CELL_M = 60
REACH_M = 900
M_PER_DEG_LAT = 110540
M_PER_DEG_LON = 111320
SIDE = 3601  # samples per tile edge
VOID = -32768

Point = tuple[float, float]
_tiles: dict[str, array] = {}


def _tile(lat: float, lon: float) -> array:
    """Returns the SRTM tile covering a point, downloading it once."""
    la, lo = math.floor(lat), math.floor(lon)
    ns, ew = ("S" if la < 0 else "N"), ("W" if lo < 0 else "E")
    name = f"{ns}{abs(la):02d}{ew}{abs(lo):03d}"
    if name not in _tiles:
        file = CACHE / f"{name}.hgt.gz"
        if not file.exists():
            CACHE.mkdir(exist_ok=True)
            req = urllib.request.Request(
                f"{TILES}/{name[:3]}/{name}.hgt.gz", headers={"User-Agent": "route-pack-builder"}
            )
            with urllib.request.urlopen(req, timeout=300) as r:
                file.write_bytes(r.read())
        data = array("h", gzip.decompress(file.read_bytes()))
        if sys.byteorder == "little":
            data.byteswap()
        _tiles[name] = data
    return _tiles[name]


def height(lat: float, lon: float) -> float:
    """Returns the bilinear SRTM height at a point; voids (sea) count as 0 m."""
    data = _tile(lat, lon)
    y = (math.floor(lat) + 1 - lat) * (SIDE - 1)
    x = (lon - math.floor(lon)) * (SIDE - 1)
    r, c = min(int(y), SIDE - 2), min(int(x), SIDE - 2)
    fy, fx = y - r, x - c

    def at(rr: int, cc: int) -> float:
        v = data[rr * SIDE + cc]
        return 0.0 if v == VOID else float(v)

    top = at(r, c) + (at(r, c + 1) - at(r, c)) * fx
    bottom = at(r + 1, c) + (at(r + 1, c + 1) - at(r + 1, c)) * fx
    return top + (bottom - top) * fy


def near_cells(xy: list[Point], cell: float, reach: float) -> set[tuple[int, int]]:
    """Returns the (row, col) cells within `reach` metres of any (east, north) point."""
    span = math.ceil(reach / cell)
    cells: set[tuple[int, int]] = set()
    for x, y in xy:
        c0, r0 = round(x / cell), round(y / cell)
        for r in range(r0 - span, r0 + span + 1):
            for c in range(c0 - span, c0 + span + 1):
                if (c * cell - x) ** 2 + (r * cell - y) ** 2 <= reach * reach:
                    cells.add((r, c))
    return cells


def to_runs(cells: dict[tuple[int, int], int], rows: int) -> list:
    """Packs known cells into, per row, runs of [start column, heights]; None for empty rows."""
    by_row: dict[int, list[int]] = {}
    for r, c in cells:
        by_row.setdefault(r, []).append(c)
    out: list = []
    for r in range(rows):
        runs: list = []
        for c in sorted(by_row.get(r, [])):
            if runs and runs[-1][0] + len(runs[-1][1]) == c:
                runs[-1][1].append(cells[(r, c)])
            else:
                runs.append([c, [cells[(r, c)]]])
        out.append(runs or None)
    return out


def grid(line: list[Point]) -> dict:
    """Builds the terrain block of a pack for a route given as (lat, lon) points."""
    pad_lat = (REACH_M + CELL_M) / M_PER_DEG_LAT
    lat0 = min(p[0] for p in line) - pad_lat
    k = M_PER_DEG_LON * math.cos(math.radians(lat0))
    lon0 = min(p[1] for p in line) - (REACH_M + CELL_M) / k
    # Every fifth 10 m point is plenty to mark a 900 m corridor.
    xy = [((lo - lon0) * k, (la - lat0) * M_PER_DEG_LAT) for la, lo in line[::5]]
    cells = {
        (r, c): round(height(lat0 + r * CELL_M / M_PER_DEG_LAT, lon0 + c * CELL_M / k))
        for r, c in near_cells(xy, CELL_M, REACH_M)
    }
    rows = max(r for r, _ in cells) + 1
    return {
        "cell": CELL_M,
        "lat0": round(lat0, 6),
        "lon0": round(lon0, 6),
        "cols": max(c for _, c in cells) + 1,
        "rows": rows,
        "runs": to_runs(cells, rows),
    }

"""Heights from the Queensland Government's elevation service: bare-earth LiDAR (0.5 to 1 m) where flown.

Data © State of Queensland and Geoscience Australia, CC BY 4.0 (owner approved, 2026-11-15).
"""

import array
import hashlib
import json
import sys
import urllib.parse
import urllib.request

from net import AGENT, CACHE, fetch

SERVICE = "https://spatial-img.information.qld.gov.au/arcgis/rest/services/Elevation/QldDem/ImageServer"
URL = f"{SERVICE}/getSamples"
BATCH = 100  # the service takes about a quarter of a second a point
LOWEST_M = -100  # anything below is the service's no-data value

Point = tuple[float, float]


def heights(points: list[Point]) -> list[float | None]:
    """Returns the ground height at each (lat, lon), or None where the service has none."""
    out: list[float | None] = []
    for i in range(0, len(points), BATCH):
        batch = points[i : i + BATCH]
        geom = {
            "points": [[lo, la] for la, lo in batch],
            "spatialReference": {"wkid": 4326},
        }
        reply = fetch(
            URL,
            {
                "geometry": json.dumps(geom),
                "geometryType": "esriGeometryMultipoint",
                "returnFirstValueOnly": "true",
                "f": "json",
            },
            pause=0.5,
            check=lambda d: "samples" in d,
        )
        got = {s["locationId"]: s.get("value") for s in reply["samples"]}
        for j in range(len(batch)):
            try:
                out.append(float(got[j]))
            except (KeyError, TypeError, ValueError):
                out.append(None)
    return out


def raster(
    south: float, west: float, dlat: float, dlon: float, rows: int, cols: int
) -> list[list[float | None]]:
    """Returns heights on a rows x cols lattice from (south, west) in (dlat, dlon) steps; row 0 is south.

    One raw float image request (cached on disk) instead of a point at a time.
    """
    bbox = (
        west - dlon / 2,
        south - dlat / 2,
        west + (cols - 0.5) * dlon,
        south + (rows - 0.5) * dlat,
    )
    query = {
        "bbox": ",".join(f"{v:.7f}" for v in bbox),
        "bboxSR": 4326,
        "imageSR": 4326,
        "size": f"{cols},{rows}",
        "format": "bsq",
        "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation",
        "f": "image",
    }
    url = f"{SERVICE}/exportImage?{urllib.parse.urlencode(query)}"
    hit = CACHE / f"{hashlib.sha1(url.encode()).hexdigest()}.f32"
    if not hit.exists():
        with urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=300
        ) as r:
            body = r.read()
        CACHE.mkdir(exist_ok=True)
        hit.write_bytes(body)
    vals = array.array("f", hit.read_bytes()[: rows * cols * 4])
    if sys.byteorder == "big":
        vals.byteswap()
    if len(vals) < rows * cols:
        raise OSError("short LiDAR image")
    # The image's first row is its north edge.
    return [
        [
            v if v > LOWEST_M and v == v else None
            for v in vals[(rows - 1 - r) * cols : (rows - r) * cols]
        ]
        for r in range(rows)
    ]

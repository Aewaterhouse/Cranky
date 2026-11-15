"""Made-up rides for the Strava text tests and docs/strava-samples.md (one per mode), with their context."""

BEST = {"1": 980, "5": 870, "15": 640, "30": 520, "60": 412, "120": 360, "300": 301, "600": 270, "1200": 251}
PREV = {1: 1010, 5: 820, 15: 600, 30: 515, 60: 398, 120: 361, 300: 296, 600: 262, 1200: 255, 3600: 220}

BUS = {
    "planName": "Lunch Break Quickie",
    "np": 231,
    "avgPower": 210,
    "record": {"date": "2026-11-15T01:00:00.000Z", "secs": 1800, "kj": 1010, "best": BEST},
    "crew": True,
    "sprints": [
        {"blk": 3, "dur": 10, "avg": 812, "pct": 0.93, "grade": "MEGA", "combo": 2},
        {"blk": 7, "dur": 10, "avg": 690, "pct": 0.79, "grade": "GREAT", "combo": 0},
    ],
    "group": {
        "distance": 15300,
        "armour": 64,
        "gap": 42,
        "score": 1234,
        "riders": [
            {"id": "luke", "name": "Luke", "inBandSecs": 1500, "kj": 300.0, "falls": 1},
            {"id": "alex", "name": "Alex", "inBandSecs": 1200, "kj": 280.0, "falls": 0},
            {"id": "steve", "name": "Steve", "inBandSecs": 900, "kj": 220.0, "falls": 3},
        ],
        "awards": [
            {"award": "Iron Lungs", "id": "luke", "name": "Luke", "why": "92% compliance"},
            {"award": "Fell Off King", "id": "steve", "name": "Steve", "why": "fell off 3x"},
        ],
        "highlights": [{"t": 754, "text": "Air strike flattened the front of the horde"}],
    },
}

FREE = {
    "planName": "Mount Coot-tha",
    "route": {"id": "coot-tha", "name": "Mount Coot-tha", "done": True},
    "distance": 12345,
    "ascent": 280,
    "np": 248,
    "avgPower": 221,
    "record": {"date": "2026-11-15T02:00:00.000Z", "secs": 2400, "kj": 530, "best": BEST},
    "segments": [
        {
            "segment": "coot-tha:climb:2400",
            "name": "Mt Coot-tha Lookout climb",
            "kind": "climb",
            "secs": 412.3,
            "watts": 301,
            "pr": True,
            "prevS": 431.0,
            "crewBest": True,
        },
        {
            "segment": "coot-tha:sprint:9800",
            "name": "Mount Coot-tha · sprint",
            "kind": "sprint",
            "secs": 21.4,
            "watts": 702,
            "pr": False,
        },
        {
            "segment": "coot-tha:route:0",
            "name": "Mount Coot-tha",
            "kind": "route",
            "secs": 2391,
            "watts": 222,
            "pr": True,
            "first": True,
        },
    ],
}
FREE_PLACES = {"coot-tha:climb:2400": (1, 4), "coot-tha:sprint:9800": (2, 3), "coot-tha:route:0": (3, 3)}

SOLO = {
    "planName": "Sweet Spot 3x10",
    "np": 240,
    "avgPower": 220,
    "tss": 70,
    "if": 0.86,
    "compliance": 0.93,
    "record": {"date": "2026-11-15T03:00:00.000Z", "secs": 3700, "kj": 814, "best": BEST},
}

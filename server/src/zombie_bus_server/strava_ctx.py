"""What a ride's Strava post needs from the rest of the store: the old power bests and the crew placings."""

import json
import sqlite3
from typing import Any

from .store import Store


def ride_context(store: Store, rider: str, ride: dict[str, Any]) -> dict[str, Any]:
    """`prev`: the rider's best watts at each duration over rides before this one (test rides never count).

    `places`: for each segment ridden, (place, riders) among each crew rider's best time on it, this ride's
    effort taking its place among them.
    """
    date = (ride.get("record") or {}).get("date") or ""
    prev: dict[int, float] = {}
    with store.lock:
        rows = store.db.execute(
            "SELECT json_extract(json, '$.record.best') FROM rides"
            " WHERE rider = ? AND date < ? AND json_extract(json, '$.test') IS NOT 1",
            (rider, date),
        ).fetchall()
    for (best,) in rows:
        for d, w in (json.loads(best) if best else {}).items():
            if isinstance(w, int | float):
                prev[int(d)] = max(prev.get(int(d), 0), w)
    places: dict[str, tuple[int, int]] = {}
    for e in ride.get("segments") or []:
        seg, secs = (e.get("segment"), e.get("secs")) if isinstance(e, dict) else (None, None)
        if not seg or not secs or seg in places:
            continue
        try:
            with store.lock:
                bests = dict(
                    store.db.execute(
                        "SELECT rider, MIN(secs) FROM efforts WHERE segment = ? GROUP BY rider", (seg,)
                    ).fetchall()
                )
        except sqlite3.OperationalError:  # no efforts table yet
            bests = {}
        bests[rider] = secs
        places[seg] = (1 + sum(1 for r, t in bests.items() if r != rider and t < secs), len(bests))
    return {"prev": prev, "places": places}

"""A crew game's session as a script: named segments, with events scattered through them by a seeded random.

Everything here is plain dicts and lists so it rides in the plan and in a game's snapshot. Times are seconds
from the start of the ride. A scaled script (`scale` under 1) shrinks segments, events and gaps alike.
"""

from __future__ import annotations

import random
from typing import NamedTuple

from .. import config as C


class Seg(NamedTuple):
    """One stretch of a session: its name, length, what kind of riding it is and the events it can throw."""

    name: str
    secs: float
    kind: str
    events: tuple[str, ...] = ()


def plan(gid: str, name: str, segs: list[Seg], scale: float | None = None) -> dict:
    """Returns the session as a plan of `free` blocks (no block ever carries a target), one per segment."""
    k = C.SCRIPT_SCALE if scale is None else scale
    blocks = [
        {
            "type": "free",
            "dur": max(1, round(s.secs * k)),
            "label": s.name,
            "kind": s.kind,
            "events": list(s.events),
        }
        for s in segs
    ]
    return {"id": gid, "name": name, "scale": k, "blocks": blocks}


def schedule(plan: dict, seed: int | str, durs: dict[str, float]) -> list[dict]:
    """Places events through every segment that lists some.

    Each event starts a random quiet gap after the last one ended (or the segment began), is never the same
    kind twice running when the segment has a choice, and ends before the segment does. When the drawn event
    will not fit but the quiet left would be too long, the shortest kind is squeezed in at the end.

    Args:
        plan: A plan from `plan()`.
        seed: Seeds the draw: the same seed gives the same session.
        durs: Seconds each event kind lasts (0 for a one-off).

    Returns:
        Events in time order, each `{"t": start, "k": kind, "dur": seconds, "i": block index}`.
    """
    rng, k, out, start = random.Random(seed), plan.get("scale", 1.0), [], 0.0
    lo, hi = (g * k for g in C.SCRIPT_GAP_S)
    for i, b in enumerate(plan["blocks"]):
        end, quiet, last = start + b["dur"] - C.SCRIPT_CLEAR_S * k, start, None
        while b["events"]:
            kinds = [e for e in b["events"] if e != last] or b["events"]
            kind, t = rng.choice(kinds), quiet + rng.uniform(lo, hi)
            if t + durs[kind] * k > end:
                kind = min(b["events"], key=lambda e: durs[e])
                t = min(t, end - durs[kind] * k)
                if t < quiet or start + b["dur"] - quiet <= C.SCRIPT_MAX_GAP_S * k:
                    break
            out.append({"t": round(t, 2), "k": kind, "dur": round(durs[kind] * k, 2), "i": i})
            quiet, last = t + durs[kind] * k, kind
        start += b["dur"]
    return out


def longest_gap(plan: dict, events: list[dict]) -> float:
    """The longest stretch with no event running and nothing starting, in unscaled seconds.

    A segment starting counts as something happening, and so does the end of the ride.
    """
    marks, t = [], 0.0
    for b in plan["blocks"]:
        marks.append((t, t))
        t += b["dur"]
    marks += [(e["t"], e["t"] + e["dur"]) for e in events] + [(t, t)]
    worst = quiet = 0.0
    for a, z in sorted(marks):
        worst, quiet = max(worst, a - quiet), max(quiet, z)
    return worst / plan.get("scale", 1.0)


def worst_gap(plan: dict, durs: dict[str, float], seeds: range = range(200)) -> float:
    """The longest quiet stretch over many seeds: a game's tests hold this to `SCRIPT_MAX_GAP_S`."""
    return max(longest_gap(plan, schedule(plan, s, durs)) for s in seeds)


def due(events: list[dict], n: int, el: float) -> tuple[list[dict], int]:
    """Returns the events from index `n` that have started by `el`, and the index to pass next time."""
    m = n
    while m < len(events) and events[m]["t"] <= el:
        m += 1
    return events[n:m], m


def running(events: list[dict], el: float) -> list[dict]:
    """The events in progress at `el`."""
    return [e for e in events if e["t"] <= el < e["t"] + e["dur"]]

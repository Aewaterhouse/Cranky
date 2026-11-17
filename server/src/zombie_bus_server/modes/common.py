"""The crew game's base: the compliance tally, awards and the riders' result rows."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING

from ..plan import event_for

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room


class CrewGame:
    """What a bus room asks of its game beyond what the bus's own parts define."""

    def event(self, room: Room, i: int) -> str:
        """The tick's `ev` for block `i`."""
        return event_for(room.plan["blocks"], i)


def tally(active: Iterable[Rider], dt: float) -> None:
    """Adds this tick's compliance to each rider who has a score."""
    for r in active:
        if r.s is not None:
            r.comp_sum += r.s
            r.comp_n += 1
            r.band_s += dt if r.s >= 0.999 else 0


def compliance(rs: Iterable[Rider]) -> dict[str, float]:
    """Each rider's mean compliance over the ride, by id."""
    return {r.id: r.comp_sum / r.comp_n if r.comp_n else 0.0 for r in rs}


def award(
    awards: list[dict], rs: list[Rider], name: str, key: Callable[[Rider], float], why: Callable[[Rider], str]
) -> None:
    """Gives `name` to the rider with the highest `key`, if it is above zero."""
    best = max(rs, key=key, default=None)
    if best and key(best) > 0:
        awards.append({"award": name, "id": best.id, "name": best.name, "why": why(best)})


def rider_row(r: Rider, comp: dict[str, float], **extra: object) -> dict:
    """A rider's row on the results screen; a game adds its own columns through `extra`."""
    return {
        "id": r.id,
        "name": r.name,
        "compliance": round(comp[r.id], 3),
        "inBandSecs": round(r.band_s),
        "sprints": r.sprints,
        "falls": r.falls,
        "bot": r.bot,
        **extra,
    }


def mark_test(summary: dict, riders: dict[str, Rider]) -> None:
    """Flags the result rows of riders on the simulated trainer (test riders) with `test`."""
    for row in summary.get("riders", []):
        if (r := riders.get(row.get("id", ""))) and r.sim:
            row["test"] = True


def counted(summary: dict) -> dict | None:
    """The result as the crew's records see it: test riders' rows and awards left out.

    None when test riders rode and no real one did: then the room adds nothing anywhere. A room with no
    test riders is returned as it is.
    """
    rows = summary.get("riders", [])
    test = {r.get("id") for r in rows if r.get("test")}
    if not test:
        return summary
    if not any(not r.get("bot") and not r.get("test") for r in rows):
        return None
    awards = [a for a in summary.get("awards", []) if a.get("id") not in test]
    return {**summary, "riders": [r for r in rows if not r.get("test")], "awards": awards}

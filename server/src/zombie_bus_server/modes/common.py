"""What every crew game does the same way: the compliance tally, awards and the riders' result rows."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..rider import Rider


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

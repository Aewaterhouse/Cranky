"""What every crew game does the same way: the compliance tally, awards and the riders' result rows."""

from __future__ import annotations

import copy
from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING, ClassVar, Self

from .. import config as C
from ..plan import event_for

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

Band = tuple[float, float] | str | None  # (lo, hi) as fractions of FTP, "sprint", "free", or None: the plan's


class CrewGame:
    """What a bus room asks of its game. A game overrides what it needs; the rest are no-ops.

    State lives in plain JSON-safe attributes so the default snapshot works. `fx` collects one-shot effects
    for `tick` to hand back, `speed` (m/s) and `dist` (m) feed the default `state`.
    """

    no_erg: ClassVar[bool] = False  # True: nobody rides this game on ERG, whatever the host or rider picked

    def __init__(self, level: str = "normal") -> None:
        self.level = level
        self.speed = self.dist = 0.0
        self.fx: list[dict] = []

    @classmethod
    def deal(cls, minutes: int) -> dict | None:
        """The game's own plan (dealt for the lobby and again at the start), or None: the picked workout."""
        return None

    def begin(self, room: Room) -> None:
        """Called once as the ride starts, after the riders' stats are reset."""

    def to_dict(self) -> dict:
        return copy.deepcopy(vars(self))

    @classmethod
    def from_dict(cls, d: dict) -> Self:
        game = cls()
        vars(game).update(copy.deepcopy(d))
        return game

    def emit(self, k: str, text: str | None = None, rid: str | None = None) -> None:
        self.fx.append({"k": k, "text": text, "id": rid})

    def event(self, room: Room, i: int) -> str:
        """The tick's `ev` for block `i`."""
        return event_for(room.plan["blocks"], i)

    def band(self, room: Room, r: Rider, i: int, bel: float) -> Band:
        """This rider's target right now. None leaves it to the plan block and the rider's tier."""
        return None

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        """Advances the game by `dt` seconds in block `i`. Returns fx since the last tick."""
        fx, self.fx = self.fx, []
        return fx

    def state(self, room: Room, i: int, bel: float) -> dict:
        """The tick's `bus` field. Games that are not the bus send a neutral one and use `game`."""
        return {
            "speed": round(self.speed, 2),
            "dist": round(self.dist),
            "armour": 100,
            "gap": C.GAP_MAX,
            "scrap": 0,
            "sync": False,
            "tune": False,
            "rb": None,
            "combo": 0,
            "shop": False,
            "repel": 0,
            "syncw": 0,
        }

    def game(self, room: Room, i: int, bel: float) -> dict | None:
        """The tick's `game` field: whatever this game's HUD and scene need."""
        return None

    def summary(self, room: Room) -> dict:
        raise NotImplementedError

    def buy(self, r: Rider, item: str) -> None:
        """A shop purchase."""

    def on_sprint(self, r: Rider, blk: int, grade: str, combo: int) -> None:
        """A rider's graded sprint."""

    def on_act(self, room: Room, r: Rider, k: str, v: str | float | bool | None) -> None:
        """A rider's game input (`act`): an emoji, a card, a vote. Unknown kinds are ignored."""


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


def shape_awards(
    awards: list[dict],
    rs: list[Rider],
    names: tuple[str, str, str] = ("Smoothest", "Spikiest", "Most Punished"),
) -> None:
    """Gives the three awards any game can make from ride data: smoothest, spikiest and most punished."""
    smooth, spiky, punished = names
    rode = [r for r in rs if r.rs_dev_n >= C.SHAPE_MIN_S]
    if rode:
        best = min(rode, key=lambda r: r.spread(r.ftp))
        why = f"power within {best.spread(best.ftp):.1%} of FTP"
        awards.append({"award": smooth, "id": best.id, "name": best.name, "why": why})
    award(awards, rs, spiky, lambda r: r.rs_spikes, lambda r: f"{r.rs_spikes} spikes")
    award(awards, rs, punished, lambda r: r.rs_punished, lambda r: f"{r.rs_punished:.0f} s of punishment")


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

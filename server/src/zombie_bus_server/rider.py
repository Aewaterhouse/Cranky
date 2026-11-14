"""One rider slot in a room."""

from __future__ import annotations

from dataclasses import dataclass, field, fields

from fastapi import WebSocket

from .plan import block_target
from .ride_stats import RideStats

NOT_SAVED = ("ws", "connected", "last_data")


@dataclass
class Rider(RideStats):
    """One rider slot. Survives disconnects for the life of the room."""

    id: str
    name: str
    ftp: int
    tier: str
    ws: WebSocket | None = None
    connected: bool = False
    last_data: float = 0.0
    p: float = 0.0
    w: float = 0.0
    cad: float = 0.0
    s: float | None = None
    hr: int | None = None
    hrp: float | None = None
    st: str = "riding"
    low_s: float = 0.0
    zero_s: float = 0.0
    fell_cool_until: float = 0.0
    comp_sum: float = 0.0
    comp_n: int = 0
    band_s: float = 0.0
    falls: int = 0
    rb_dmg: float = 0.0
    mega: int = 0
    sync_hits: int = 0
    sync_n: int = 0
    sprints: list[str] = field(default_factory=list)
    look: dict[str, str] = field(default_factory=dict)
    bot: bool = False
    erg: bool = True
    kg: float | None = None  # from the rider's stored profile, for W/kg

    def reset_stats(self) -> None:
        fresh = Rider(
            self.id,
            self.name,
            self.ftp,
            self.tier,
            self.ws,
            self.connected,
            look=self.look,
            bot=self.bot,
            erg=self.erg,
            kg=self.kg,
        )
        self.__dict__.update(
            {k: v for k, v in fresh.__dict__.items() if k not in ("ws", "connected", "last_data")}
        )

    def to_dict(self) -> dict:
        """JSON-safe snapshot of everything except the socket and liveness."""
        return {f.name: getattr(self, f.name) for f in fields(self) if f.name not in NOT_SAVED}

    @classmethod
    def from_dict(cls, d: dict) -> Rider:
        return cls(**d)

    def target(self, b: dict, bel: float, load: float = 1.0) -> int | None:
        """Returns the rider's target in watts (None on sprint blocks), never over 150% FTP.

        Args:
            b: The current block.
            bel: Seconds into the block.
            load: Multiplier for riders still on the bus while others have fallen off.
        """
        f = block_target(b, self.tier, bel)
        if f is None:
            return None
        if self.st != "riding":
            load = 1.0
        return min(round(f * self.ftp * load), round(self.ftp * 1.5))

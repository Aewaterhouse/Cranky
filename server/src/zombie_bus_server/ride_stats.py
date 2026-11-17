"""A rider's ride so far, worked out from the power the server receives (never trusted from the client)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from . import config as C

if TYPE_CHECKING:
    from .store import Store


@dataclass(kw_only=True)
class RideStats:
    """Running power stats, kept as plain fields so a rider's snapshot stays JSON.

    NP is the fourth-power mean of the rolling `NP_WINDOW_S` average of one-second powers; before a full
    window it rolls over the seconds there are.
    """

    rs_secs: float = 0.0
    rs_joules: float = 0.0
    rs_bucket: float = 0.0
    rs_bucket_t: float = 0.0
    rs_roll: list[float] = field(default_factory=list)
    rs_np4: float = 0.0
    rs_np_n: int = 0

    def sample(self, watts: float, dt: float) -> None:
        """Adds `dt` seconds at `watts`."""
        self.rs_secs += dt
        self.rs_joules += watts * dt
        self.rs_bucket += watts * dt
        self.rs_bucket_t += dt
        if self.rs_bucket_t < 1 - 1e-9:
            return
        self.rs_roll = [*self.rs_roll, self.rs_bucket / self.rs_bucket_t][-C.NP_WINDOW_S :]
        self.rs_np4 += (sum(self.rs_roll) / len(self.rs_roll)) ** 4
        self.rs_np_n += 1
        self.rs_bucket = self.rs_bucket_t = 0.0

    @property
    def avg(self) -> float:
        return self.rs_joules / self.rs_secs if self.rs_secs else 0.0

    @property
    def np(self) -> float:
        return (self.rs_np4 / self.rs_np_n) ** 0.25 if self.rs_np_n else self.avg

    def report(self, ftp: int, kg: float | None, on: float | None, falls: int) -> dict:
        """The ride so far as the tick sends it."""
        return {
            "ftp": ftp,
            "kg": kg,
            "avg": round(self.avg),
            "np": round(self.np),
            "on": None if on is None else round(on, 3),
            "kj": round(self.rs_joules / 1000, 1),
            "falls": falls,
        }


def on_target(band_s: float, scored_ticks: int) -> float | None:
    """Share of scored time spent on target (None before anything has been scored)."""
    return min(1.0, band_s / (scored_ticks / C.TICK_HZ)) if scored_ticks else None


def profile_kg(store: Store | None, rid: str) -> float | None:
    """A rider's weight from their stored profile, or None when they have not set one."""
    kg = ((store.get_profile(rid) if store else None) or {}).get("weightKg")
    return float(kg) if isinstance(kg, (int, float)) and kg > 0 else None

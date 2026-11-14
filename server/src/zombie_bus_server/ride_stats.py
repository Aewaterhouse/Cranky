"""A rider's ride so far, worked out from the power the server receives (never trusted from the client)."""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import fmean
from typing import TYPE_CHECKING

from . import config as C

if TYPE_CHECKING:
    from .store import Store


@dataclass(kw_only=True)
class RideStats:
    """Running power stats, kept as plain fields so a rider's snapshot stays JSON.

    NP is the fourth-power mean of the rolling `NP_WINDOW_S` average of one-second powers; before a full
    window it rolls over the seconds there are.

    Power shape: each second, the rider's 3 s power is compared with their own mean 3 s power over the last
    `SHAPE_WINDOW_S`. `rs_dev` is that gap in watts right now; the mean gap is the rider's spread (low is
    smooth), and a spike is each time 3 s power jumps more than `SPIKE_PCT` of FTP above that mean.
    `rs_punished` is seconds of penalty, which only games add to.
    """

    rs_secs: float = 0.0
    rs_joules: float = 0.0
    rs_bucket: float = 0.0
    rs_bucket_t: float = 0.0
    rs_roll: list[float] = field(default_factory=list)
    rs_np4: float = 0.0
    rs_np_n: int = 0
    rs_p3: list[float] = field(default_factory=list)
    rs_dev: float = 0.0
    rs_dev_sum: float = 0.0
    rs_dev_n: int = 0
    rs_spikes: int = 0
    rs_spiking: bool = False
    rs_punished: float = 0.0

    def sample(self, watts: float, dt: float, ftp: int = 0) -> None:
        """Adds `dt` seconds at `watts`. Spikes are only counted when `ftp` is given."""
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
        self.rs_p3 = [*self.rs_p3, fmean(self.rs_roll[-3:])][-C.SHAPE_WINDOW_S :]
        over = self.rs_p3[-1] - fmean(self.rs_p3)
        self.rs_dev = abs(over)
        self.rs_dev_sum += self.rs_dev
        self.rs_dev_n += 1
        spiking = bool(ftp) and over > C.SPIKE_PCT * ftp
        self.rs_spikes += spiking and not self.rs_spiking
        self.rs_spiking = spiking

    def punish(self, dt: float) -> None:
        """Adds `dt` seconds of penalty (a fine, a forced recovery): the game decides what counts."""
        self.rs_punished += dt

    def spread(self, ftp: int) -> float:
        """Mean gap between 3 s power and the rider's own rolling mean, as a share of FTP. Low is smooth."""
        return self.rs_dev_sum / self.rs_dev_n / ftp if self.rs_dev_n and ftp else 0.0

    def shape(self, ftp: int) -> dict:
        """The rider's power shape for a results row."""
        return {
            "spread": round(100 * self.spread(ftp), 1),
            "spikes": self.rs_spikes,
            "punished": round(self.rs_punished),
        }

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

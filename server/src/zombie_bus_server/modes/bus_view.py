"""Zombie Bus tick state and end-of-ride summary."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config as C
from .common import award, compliance, rider_row

if TYPE_CHECKING:
    from ..session import Room


class BusView:
    """Mixed into `ZombieBus`, which holds the state."""

    def state(self, room: Room, i: int, bel: float) -> dict:
        return {
            "speed": round(self.speed, 2),
            "dist": round(self.dist),
            "armour": round(self.armour, 1),
            "gap": round(self.gap, 1),
            "sync": self.sync,
            "tune": self.tune,
            "rb": self.rb_progress(room, i, bel),
            "combo": self.combo,
            "nitro": round(self.nitro, 2),
            "boost": room.el < self.nitro_until,
            "shop": self.ev == "servo" and not self.shopped and not self.mut.get("no_shop"),
            "wares": self.wares,
            "weather": self.weather,
            "zed": C.ZED_TYPES[self.ev]["tip"] if self.ev in C.ZED_TYPES else None,
            "roles": {
                rid: {
                    "role": st["role"],
                    "tip": C.ROLES[st["role"]]["tip"],
                    "cd": max(0, round(st["ready"] - room.el)),
                }
                for rid, st in self.roles.items()
            },
            "boss": (
                {
                    "name": C.BOSSES[self.boss["kind"]]["name"],
                    "left": round(max(0.0, 1 - self.boss["done"] / self.boss["need"]), 3),
                }
                if self.boss and self.boss["i"] == i and not self.boss.get("over")
                else None
            ),
            "repel": self.repel,
            "syncw": self.syncw,
            "streak": round(min(1.0, self.streak / C.STREAKS[self.streak_n][0]), 2),
            "next": C.STREAKS[self.streak_n][1],
            "gunship": room.el < self.gunship_until,
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []

        award(awards, rs, "Iron Lungs", lambda r: comp[r.id], lambda r: f"{comp[r.id]:.0%} compliance")
        award(awards, rs, "Fell Off King", lambda r: r.falls, lambda r: f"fell off {r.falls}x")
        award(awards, rs, "Roadblock MVP", lambda r: r.rb_dmg, lambda r: f"{int(r.rb_dmg)} roadblock damage")
        award(
            awards,
            rs,
            "Sync Master",
            lambda r: r.sync_hits / r.sync_n if r.sync_n else 0,
            lambda r: f"{r.sync_hits / r.sync_n:.0%} in sync",
        )
        award(awards, rs, "PR Hunter", lambda r: r.mega, lambda r: f"{r.mega} MEGA+ sprints")
        score = round(self.dist / 10 * (0.5 + self.armour / 200) * C.DIFFICULTY[self.level]["score"])
        return {
            "distance": round(self.dist),
            "armour": round(self.armour),
            "gap": round(self.gap),
            "score": score,
            "difficulty": self.level,
            "syncPct": round(100 * self.sync_ticks / self.ticks) if self.ticks else 0,
            "riders": [rider_row(r, comp, kj=round(r.rs_joules / 1000, 1)) for r in rs],
            "awards": awards,
            "highlights": self.highlights,
        }

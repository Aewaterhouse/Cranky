"""What Kidney Stone Express shows: the tick's game state, the results and the awards."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config_games as G
from . import ambulance_text as T
from .common import award, compliance, rider_row

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

PATIENTS = G.AMBO_PATIENTS


class AmboView:
    """The read-only half of `Ambulance` (which holds all the state these methods read)."""

    def game(self, room: Room, i: int, bel: float) -> dict:
        k, el, blocks = room.plan.get("scale", 1.0), room.el, room.plan["blocks"]
        patient = None
        if self.open or self.rev > 0:
            p = PATIENTS[self.pid]
            rough = el - self.hurt_at < 3 * k
            lines = (T.ROUGH if rough else T.CALM)[self.pid]
            line = lines[int(el / (G.AMBO_LINE_S * k)) % len(lines)]
            patient = {"id": self.pid, "name": p["name"], "icon": p["icon"], "line": line}
        cur = self.ev_view(room)
        return {
            "g": "ambo",
            "phase": self.phase(room, i),
            "run": self.run,
            "runs": sum(b["kind"] == "run" for b in blocks),
            "patient": patient,
            "comfort": round(self.comfort),
            "dist": round(max(0.0, self.left)) if self.open else 0,
            "total": round(self.total),
            "speed": round(self.speed * 3.6),
            "par": round(max(0.0, self.run_end - el)) if self.open else 0,
            "eta": round(self.left / self.speed) if self.open and self.speed > 0.5 else None,
            "event": cur,
            "brake": self.open and self.arrived is None and not self.gone and self.left <= self.brake_m,
            "perk": self.perk,
            "sweet": round(self.sweet, 2),
            "queue": round(max(0.0, self.queue_until - el)) if blocks[i]["kind"] == "ramp" else 0,
            "reviews": self.reviews,
            "score": self.score,
            "siren": cur.get("who") if cur else None,
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp = compliance(rs)
        return {
            "mode": "ambo",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": 0,
            "score": self.score,
            "difficulty": "normal",
            "syncPct": 0,
            "delivered": sum(not x["walked"] for x in self.reviews),
            "reviews": self.reviews,
            "riders": [
                rider_row(
                    r,
                    comp,
                    spread=round(100 * self.jerk(r.id), 1),
                    spikes=self.spikes.get(r.id, 0),
                    fines=self.fines.get(r.id, 0),
                )
                for r in sorted(rs, key=lambda r: self.jerk(r.id))
            ],
            "awards": self.awards(rs),
        }

    def jerk(self, rid: str) -> float:
        """A rider's mean roughness in steady riding, as a share of FTP. Low is smooth."""
        tot, n = self.rough.get(rid, (0.0, 0))
        return tot / n if n else 0.0

    def awards(self, rs: list[Rider]) -> list[dict]:
        """Paramedic of the Week (smoothest), Learner Driver (spikiest) and Lead Foot (most fines)."""
        out: list[dict] = []
        rode = [r for r in rs if self.rough.get(r.id, (0, 0))[1]]
        if rode:
            best = min(rode, key=lambda r: self.jerk(r.id))
            why = f"power within {self.jerk(best.id):.1%} of FTP of dead smooth"
            out.append({"award": "Paramedic of the Week", "id": best.id, "name": best.name, "why": why})
        award(
            out,
            rs,
            "Learner Driver",
            lambda r: self.spikes.get(r.id, 0),
            lambda r: f"{self.spikes[r.id]} spikes",
        )
        award(
            out,
            rs,
            "Lead Foot",
            lambda r: self.fines.get(r.id, 0),
            lambda r: f"{self.fines[r.id]} speeding fines",
        )
        return out

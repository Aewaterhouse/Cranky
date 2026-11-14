"""VO2 Madness rules: mystery-box intervals for the whole pack, scored on who is trying hardest."""

from __future__ import annotations

import copy
import random
from typing import TYPE_CHECKING

from .. import config as C
from .common import CrewGame, compliance, rider_row, tally
from .common import award as give

if TYPE_CHECKING:
    from ..session import Rider, Room


def deal(minutes: int, rng: random.Random | None = None) -> dict:
    """Deals a session: warm-up, then mystery rounds (recover, then one interval from the deck), cool-down."""
    rng = rng or random.Random()
    total = (minutes or C.MAD_MINUTES) * 60
    warm = max(C.MAD_WARM_S[0], min(C.MAD_WARM_S[1], round(total * 0.15 / 30) * 30))
    cool = max(C.MAD_COOL_S[0], min(C.MAD_COOL_S[1], round(total * 0.1 / 30) * 30))
    blocks = [{"type": "ramp", "dur": warm, "pct": [45, 80], "label": "Warm-up"}]
    left, last, rounds = total - warm - cool, None, 0
    while True:
        fits = [d for d in C.MAD_DECK if d["name"] != last and d["rest"] + work_s(d) <= left]
        if not fits:
            break
        d = rng.choices(fits, [x.get("weight", 1) for x in fits])[0]
        twist = rng.choice(list(C.MAD_TWISTS)) if rng.random() < C.MAD_TWIST_CHANCE else None
        rounds += 1
        tag = {"label": d["name"], "round": rounds}
        rest = {"type": "steady", "dur": d["rest"], "pct": C.MAD_REST_PCT, "box": True}
        blocks.append({**rest, "label": "Recover", "round": rounds})
        blocks += [{**copy.deepcopy(b), "work": True, "twist": twist, **tag} for b in d["blocks"]]
        left -= d["rest"] + work_s(d)
        last = d["name"]
    blocks.append({"type": "steady", "dur": cool + left, "pct": 45, "label": "Cool-down"})
    return {
        "id": "vo2-madness",
        "name": "VO2 Madness",
        "desc": "Mystery-box VO2 intervals. The deck is reshuffled when the ride starts.",
        "goal": "vo2",
        "rounds": rounds,
        "blocks": blocks,
    }


def work_s(d: dict) -> int:
    return sum(b["dur"] for b in d["blocks"])


def zone(hrp: float) -> int:
    """Heart-rate zone 0..4: under 60, 70, 80 and 90% of max, then over."""
    return sum(hrp >= f for f in C.MAD_ZONES)


class Vo2Madness(CrewGame):
    """Pack state for one ride. Same interface as ZombieBus so the room can run either."""

    deal = staticmethod(deal)

    def __init__(self, level: str = "normal", mutator: dict | None = None) -> None:
        self.pts: dict[str, float] = {}
        self.red: dict[str, float] = {}
        self.crown_s: dict[str, float] = {}
        self.slack: dict[str, float] = {}
        self.crown: str | None = None
        self.lead: str | None = None
        self.rival: str | None = None
        self.rival_s = 0.0
        self.boxed = -1
        self.last_i = -1
        self.dist = 0.0
        self.speed = 0.0
        self.fx: list[dict] = []

    def to_dict(self) -> dict:
        return copy.deepcopy(vars(self))

    @classmethod
    def from_dict(cls, d: dict) -> Vo2Madness:
        mad = cls()
        vars(mad).update(copy.deepcopy(d))
        return mad

    def emit(self, k: str, text: str | None = None, rid: str | None = None) -> None:
        self.fx.append({"k": k, "text": text, "id": rid})

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        """Scores one tick of block `i`. Returns fx since the last tick."""
        blocks = room.plan["blocks"]
        b = blocks[i]
        active = [r for r in room.riders.values() if r.st == "riding"]
        if i != self.last_i:
            self.last_i = i
            if b.get("work") and not blocks[i - 1].get("work"):
                self.emit("go", f"GO! {b['label']}")
            elif b.get("box"):
                self.emit("rest", "Recover. The mystery box is loading...")
        nxt = blocks[i + 1] if i + 1 < len(blocks) else {}
        if b.get("box") and self.boxed != i and b["dur"] - bel <= C.MAD_BOX_S:
            self.boxed = i
            twist = C.MAD_TWISTS.get(nxt.get("twist") or "", None)
            extra = f" Twist: {twist[0]}. {twist[1]}" if twist else ""
            self.emit("box", f"{nxt['label']}!{extra}")
        comp = [r.s if r.s is not None else 1.0 for r in active]
        tally(active, dt)
        self.speed = C.MAD_SPEED[0] + (C.MAD_SPEED[1] - C.MAD_SPEED[0]) * (
            sum(comp) / len(comp) if comp else 0
        )
        self.dist += self.speed * dt
        if b.get("work"):
            self.score(room, active, b, dt)
            self.hardest(room, active, dt)
            self.sandbag(room, active, dt)
        else:
            self.rival, self.rival_s = None, 0.0
        lead = max(self.pts, key=lambda k: self.pts[k], default=None)
        if lead and lead != self.lead and self.pts[lead] >= C.MAD_LEAD_MIN:
            self.lead = lead
            self.emit("lead", f"{room.riders[lead].name} takes the lead!", lead)
        fx, self.fx = self.fx, []
        return fx

    def score(self, room: Room, active: list[Rider], b: dict, dt: float) -> None:
        """Effort points: heart-rate zone times compliance, bent by the round's twist."""
        twist = b.get("twist")
        ranked = sorted(active, key=lambda r: self.pts.get(r.id, 0))
        cads = [r.cad for r in active]
        synced = (
            len(cads) >= 2 and max(cads) - min(cads) <= 2 * C.SYNC_RPM and min(cads) >= C.SYNC_MIN_CADENCE
        )
        for r in active:
            hot = r.hrp is not None and r.hrp >= C.MAD_ZONES[-1]
            rate = C.MAD_ZONE_PTS[zone(r.hrp)] if r.hrp is not None else C.MAD_NO_HR_PTS
            rate *= r.s if r.s is not None else 1.0
            if twist == "double":
                rate *= 2
            elif twist == "redline" and hot:
                rate += C.MAD_REDLINE_PTS
            elif twist == "sync" and synced:
                rate *= 1.5
            elif twist == "underdog" and len(ranked) > 1 and r is ranked[0]:
                rate *= 3
            elif twist == "tax" and len(ranked) > 1 and r is ranked[-1]:
                rate *= 0.5
            rate += C.MAD_CROWN_PTS if r.id == self.crown else 0
            self.pts[r.id] = self.pts.get(r.id, 0) + rate * dt
            self.red[r.id] = self.red.get(r.id, 0) + (dt if hot else 0)

    def hardest(self, room: Room, active: list[Rider], dt: float) -> None:
        """The crown goes to whoever holds the highest share of their max heart rate."""
        hr = [r for r in active if r.hrp is not None]
        if self.crown:
            self.crown_s[self.crown] = self.crown_s.get(self.crown, 0) + dt
        best = max(hr, key=lambda r: r.hrp, default=None)
        holder = room.riders.get(self.crown or "")
        if not best or best.id == self.crown or best.hrp < C.MAD_CROWN_MIN:
            self.rival, self.rival_s = None, 0.0
            return
        if holder in hr and best.hrp - holder.hrp < C.MAD_CROWN_MARGIN:
            return
        self.rival_s = self.rival_s + dt if self.rival == best.id else 0.0
        self.rival = best.id
        if self.rival_s >= C.MAD_CROWN_HOLD_S:
            self.crown, self.rival, self.rival_s = best.id, None, 0.0
            self.emit("crown", f"{best.name} is trying hardest! {best.hrp:.0%} of max", best.id)

    def sandbag(self, room: Room, active: list[Rider], dt: float) -> None:
        """Calls out anyone coasting while the rest of the pack suffers."""
        hr = [r for r in active if r.hrp is not None]
        for r in hr:
            others = [x.hrp for x in hr if x is not r]
            lazy = others and r.hrp < C.MAD_SANDBAG[0] and sum(others) / len(others) >= C.MAD_SANDBAG[1]
            self.slack[r.id] = self.slack.get(r.id, 0) + dt if lazy else 0.0
            if self.slack[r.id] >= C.MAD_SANDBAG_S:
                self.slack[r.id] = -C.MAD_SANDBAG_COOL_S
                self.emit("sandbag", f"{r.name} is having a picnic at {r.hrp:.0%} of max.", r.id)

    def buy(self, r: Rider, item: str) -> None:
        """No shop in this mode."""

    def on_sprint(self, r: Rider, blk: int, grade: str, combo: int) -> None:
        r.sprints.append(grade)
        r.mega += grade in ("MEGA", "LEGEND")
        self.pts[r.id] = self.pts.get(r.id, 0) + C.MAD_SPRINT_PTS[grade]
        self.emit("slowmo" if grade in ("MEGA", "LEGEND") else "sprint", f"{r.name}: {grade}", r.id)

    def state(self, room: Room, i: int, bel: float) -> dict:
        blocks = room.plan["blocks"]
        b = blocks[i] if i >= 0 else {}
        nxt = blocks[i + 1] if 0 <= i < len(blocks) - 1 else {}
        shown = b.get("box") and self.boxed == i
        return {
            "speed": round(self.speed, 2),
            "dist": round(self.dist),
            "armour": 100,
            "gap": C.GAP_MAX,
            "scrap": int(sum(self.pts.values())),
            "sync": False,
            "tune": False,
            "rb": None,
            "combo": 0,
            "shop": False,
            "repel": 0,
            "syncw": 0,
            "mad": {
                "pts": {k: int(v) for k, v in self.pts.items()},
                "red": {k: int(v) for k, v in self.red.items()},
                "crown": self.crown,
                "lead": self.lead,
                "round": b.get("round", 0),
                "rounds": room.plan.get("rounds", 0),
                "work": bool(b.get("work")),
                "box": bool(b.get("box")),
                "next": nxt.get("label") if shown else None,
                "twist": (b if b.get("work") else nxt if shown else {}).get("twist"),
            },
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []

        def award(name: str, score: dict, why) -> None:
            give(awards, rs, name, lambda r: score.get(r.id, 0), lambda r: why(score[r.id]))

        award("Maddest", self.pts, lambda v: f"{int(v)} effort points")
        award("Red Liner", self.red, lambda v: f"{int(v)} s over {C.MAD_ZONES[-1]:.0%} of max")
        award("Crown Hog", self.crown_s, lambda v: f"wore the crown for {int(v)} s")
        award("PR Hunter", {r.id: r.mega for r in rs}, lambda v: f"{v} MEGA+ sprints")
        return {
            "mode": "madness",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": int(sum(self.pts.values())),
            "score": int(sum(self.pts.values())),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [
                rider_row(
                    r, comp, falls=0, points=int(self.pts.get(r.id, 0)), redSecs=int(self.red.get(r.id, 0))
                )
                for r in sorted(rs, key=lambda r: -self.pts.get(r.id, 0))
            ],
            "awards": awards,
        }

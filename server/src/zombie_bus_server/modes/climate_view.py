"""What Climate Lawsuit shows: the tick's `game` field, and the results with their awards."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config_games as G
from . import climate_text as T
from .common import compliance, crew_scrap, rider_row

if TYPE_CHECKING:
    from ..session import Room


class ClimateView:
    """Mixed into `Climate`."""

    def name(self, room: Room, rid: str) -> str:
        r = room.riders.get(rid)
        return r.name if r else "?"

    def event_view(self, room: Room) -> dict | None:
        d = self.demand
        if d:
            name, text = T.EVENTS[d["k"]]
            return {"k": d["k"], "name": name, "text": text, "left": max(0, round(d["end"] - room.el))}
        if self.miner and self.miner == self.n and self.kind(room) == "decade":
            name, text = T.EVENTS["miner"]
            end = sum(b["dur"] for b in room.plan["blocks"][: self.last_i + 1])
            return {"k": "miner", "name": name, "text": text, "left": max(0, round(end - room.el))}
        return None

    def game(self, room: Room, i: int, bel: float) -> dict:
        self.sync(room, i)
        kind = self.kind(room, i)
        cues = {}
        for rid in self.cos:
            c = self.fuel_cue(room, rid)
            if c:
                cues[rid] = {"k": c["k"], "left": max(0, round(c["end"] - room.el, 1))}
        trial = None
        if kind in ("trial", "cool"):
            held = {rid: round(self.held(rid), 2) for rid in self.defendants}
            trial = {
                "defendants": self.defendants,
                "target": self.target,
                "held": held.get(self.defendants[0], 0.0) if self.defendants else 0.0,
                "heldBy": held,
                "bar": round(self.bar(), 2),
                "verdicts": self.verdicts,
            }
        return {
            "g": "climate",
            "phase": kind,
            "decade": G.CLIM_DECADES[self.n - 1] if self.n and kind == "decade" else None,
            "n": self.n,
            "level": round(min(1.0, self.level), 3),
            "stage": self.stage,
            "stageName": G.CLIM_STAGE_NAMES[self.stage],
            "walls": self.walls,
            "wallCost": self.wall_cost(),
            "cos": {
                rid: {"name": c["name"], "fuel": c["fuel"], "coins": round(c["coins"], 1), "on": c["on"]}
                for rid, c in self.cos.items()
            },
            "event": self.event_view(room),
            "cue": cues,
            "trial": trial,
            "ledger": self.ledger() if kind in ("trial", "cool") else None,
            "flooded": self.flooded,
        }

    def ledger(self) -> dict:
        """Everything that was secret until the Trial: emissions, envelopes and seawalls."""
        return {
            rid: {
                "emit": round(self.emit_t.get(rid, 0.0)),
                "bribed": self.bribed.get(rid, False),
                "walls": self.walls_by.get(rid, 0),
            }
            for rid in self.cos
        }

    def summary(self, room: Room) -> dict:
        self.decide(room)
        rs = list(room.riders.values())
        comp = compliance(rs)
        rows = [
            rider_row(
                r,
                comp,
                company=self.cos.get(r.id, {}).get("name"),
                coins=round(self.cos.get(r.id, {}).get("coins", 0.0)),
                emit=round(self.emit_t.get(r.id, 0.0)),
                bribed=self.bribed.get(r.id, False),
                walls=self.walls_by.get(r.id, 0),
                fuel=self.cos.get(r.id, {}).get("fuel"),
                verdict=self.verdicts.get(r.id),
            )
            for r in rs
        ]
        coins = sum(c["coins"] for c in self.cos.values())
        return {
            "mode": "climate",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist, 0 if self.flooded else G.SCRAP_TOWN_SAVED),
            "syncPct": 0,
            "difficulty": "normal",
            "score": 0 if self.flooded else round(coins),
            "flooded": self.flooded,
            "level": round(min(1.0, self.level), 3),
            "stageName": G.CLIM_STAGE_NAMES[self.stage],
            "walls": self.walls,
            "verdicts": self.verdicts,
            "riders": sorted(rows, key=lambda x: -x["coins"]),
            "awards": self.awards(room, rows),
        }

    def awards(self, room: Room, rows: list[dict]) -> list[dict]:
        out = []

        def give(award: str, row: dict | None, why: str) -> None:
            if row:
                out.append({"award": award, "id": row["id"], "name": row["name"], "why": why})

        rich = max(rows, key=lambda x: x["coins"], default=None)
        if rich and not self.flooded:
            give("Greenwashing Award", rich, f"{rich['company']} made {rich['coins']} coins and a nice ad")
        dirty = max(rows, key=lambda x: x["emit"], default=None)
        if dirty and dirty["emit"] > 0:
            give("Polluter of the Decade", dirty, f"{dirty['emit']} tonnes, give or take")
        walls = max(rows, key=lambda x: x["walls"], default=None)
        if walls and walls["walls"]:
            give("Seawall Enthusiast", walls, f"{walls['walls']} seawalls, none designed by an engineer")
        if self.switched:
            first = min(self.switched, key=lambda rid: (self.switched[rid], rid))
            row = next((x for x in rows if x["id"] == first), None)
            give("Early Adopter", row, f"left coal in the {G.CLIM_DECADES[self.switched[first] - 1]}")
        for row in rows:
            if row["bribed"]:
                give("Brown Paper Bag", row, f"took the lobbyist's {G.CLIM_BRIBE} coins")
        return out

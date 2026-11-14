"""What Speed Dating shows: the tick's game state and the results."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config_games as G
from . import dating_text as T
from .common import compliance, crew_scrap, rider_row

if TYPE_CHECKING:
    from ..session import Room

THEMES = G.DATE_THEMES


class DateView:
    """The read-only half of `Dating` (which holds all the state these methods read)."""

    def couples(self) -> list[dict]:
        """Every couple that has scored, best first."""
        rows = [
            {"a": kk.split("|")[0], "b": kk.split("|")[1], "pts": round(p)} for kk, p in self.table.items()
        ]
        return sorted((r for r in rows if r["pts"] > 0), key=lambda r: -r["pts"])

    def game(self, room: Room, i: int, bel: float) -> dict:
        b, theme = room.plan["blocks"][i], None
        if b["kind"] in ("date", "gap"):
            tid = G.DATE_ORDER[self.n - 1]
            t = THEMES[tid]
            theme = {"id": tid, "name": t["name"], "icon": t["icon"], "text": T.THEME_TEXT[tid]}
        pairs = [
            [a, c, round(self.match.get(f, 0.0), 2), round(self.pts.get(f, 0.0))]
            for a, c in self.pairs
            for f in ["|".join(sorted((a, c)))]
        ]
        return {
            "g": "date",
            "phase": self.phase(room, i),
            "n": self.n,
            "of": len(G.DATE_ORDER),
            "theme": theme,
            "pairs": pairs,
            "chap": self.chap,
            "card": self.card_view(room),
            "profiles": self.profiles,
            "emoji": G.DATE_EMOJI,
            "emojiLeft": self.emoji_left,
            "said": self.said,
            "table": self.couples(),
            "chat": self.chat,
            **self.finale_view(room),
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp = compliance(rs)
        rows = [rider_row(r, comp, **self.report(room, r.id)) for r in rs]
        return {
            "mode": "date",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist, G.SCRAP_WEDDING if self.married else 0),
            "score": round(sum(self.table.values())),
            "difficulty": "normal",
            "syncPct": 0,
            "couples": [
                {**c, "names": [self.name(room, c["a"]), self.name(room, c["b"])]} for c in self.couples()
            ],
            "married": self.married,
            "divorced": self.divorced,
            "chat": self.leak or self.leaked(room),
            "riders": sorted(rows, key=lambda r: -r["match"]),
            "awards": self.awards(room, rows),
        }

    def awards(self, room: Room, rows: list[dict]) -> list[dict]:
        """Best Match (a couple), Third Wheel (the costliest Chaperone) and Red Flag (the worst match)."""
        out, best = [], self.ranked()
        if best:
            a, b = best[0]
            rate = self.table.get("|".join(sorted((a, b))), 0.0) / self.met["|".join(sorted((a, b)))]
            who = f"{self.name(room, a)} + {self.name(room, b)}"
            out.append({"award": "Best Match", "id": a, "name": who, "why": f"{rate:.0f} points a date"})
        chaps = {rid: p for rid, p in self.chap_pts.items() if rid in room.riders and p > 0}
        if chaps:
            rid = max(chaps, key=chaps.get)
            why = f"cost the couples {chaps[rid]:.0f} points"
            out.append({"award": "Third Wheel", "id": rid, "name": self.name(room, rid), "why": why})
        dated = [r for r in rows if self.stats.get(r["id"], {}).get("n")]
        if dated:
            r = min(dated, key=lambda r: r["match"])
            why = f"{r['match']:.0%} average match"
            out.append({"award": "Red Flag", "id": r["id"], "name": r["name"], "why": why})
        return out

    def report(self, room: Room, rid: str) -> dict:
        """A rider's compatibility report: how well they matched, with whom, who led, and their red flags."""
        st = {**self.blank(), **(self.stats.get(rid) or {})}
        by = sorted(((s / n, o) for o, (s, n) in st["by"].items() if n), reverse=True)
        avg = st["m"] / st["n"] if st["n"] else 0.0
        lead = st["lead"] / st["n"] if st["n"] else 0.5
        react = st["gap"] / st["gaps"] if st["gaps"] else None
        turtles = st["sent"].get("🐢", 0)
        flags = [
            T.FLAGS["ahead"] if lead > 0.65 else T.FLAGS["behind"] if lead < 0.35 else "",
            T.FLAGS["out"].format(n=round(st["out"])) if st["out"] >= 60 else "",
            T.FLAGS["slow"].format(n=round(react, 1)) if react and react >= 2 else "",
            T.FLAGS["read"] if st["n"] and not st["sent"] else "",
            T.FLAGS["turtle"].format(n=turtles) if turtles >= 2 else "",
            T.FLAGS["target"] if st["hit"] >= 3 else "",
            T.FLAGS["cold"] if st["n"] and avg < 0.3 else "",
        ]
        mine = sum(p for kk, p in self.table.items() if rid in kk.split("|")) + self.chap_pts.get(rid, 0.0)
        return {
            "match": round(avg, 3),
            "best": self.name(room, by[0][1]) if by else None,
            "worst": self.name(room, by[-1][1]) if len(by) > 1 else None,
            "lead": round(lead, 2),
            "react": None if react is None else round(react, 1),
            "flags": [f for f in flags if f],
            "points": round(mine),
            "confetti": round(self.confetti_s.get(rid, 0.0)),
        }

"""What Speed Dating shows: the tick's game state and the results."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config_games as G
from . import dating_text as T
from .common import compliance, rider_row

if TYPE_CHECKING:
    from ..session import Room

THEMES = G.DATE_THEMES
EMOJI = ["😍", "😬", "🔥", "🐢", "🚀", "🙈"]


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
            "emoji": EMOJI,
            "emojiLeft": self.emoji_left,
            "said": self.said,
            "table": self.couples(),
            "chat": self.chat,
            **self.finale_view(room),
        }

    def card_view(self, room: Room) -> dict | None:
        return None

    def finale_view(self, room: Room) -> dict:
        return {"couple": None, "exes": None, "tandem": None, "tug": None}

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp = compliance(rs)
        return {
            "mode": "date",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": 0,
            "score": round(sum(self.table.values())),
            "difficulty": "normal",
            "syncPct": 0,
            "couples": self.couples(),
            "riders": [rider_row(r, comp, **self.report(room, r.id)) for r in rs],
            "awards": [],
        }

    def report(self, room: Room, rid: str) -> dict:
        """A rider's compatibility report: how well they matched, with whom, and who led."""
        st = self.stats.get(rid) or {"m": 0.0, "n": 0, "lead": 0, "gap": 0.0, "gaps": 0, "by": {}}
        name = lambda o: room.riders[o].name if o in room.riders else "?"  # noqa: E731
        by = sorted(((s / n, o) for o, (s, n) in st["by"].items() if n), reverse=True)
        return {
            "match": round(st["m"] / st["n"], 3) if st["n"] else 0.0,
            "best": name(by[0][1]) if by else None,
            "worst": name(by[-1][1]) if len(by) > 1 else None,
            "lead": round(st["lead"] / st["n"], 2) if st["n"] else 0.0,
            "react": round(st["gap"] / st["gaps"], 1) if st["gaps"] else None,
        }

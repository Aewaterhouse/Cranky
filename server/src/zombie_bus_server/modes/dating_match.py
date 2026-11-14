"""Speed Dating's matchmaking: who dates whom, the prompts in a date, and how a couple scores."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config_games as G
from . import dating_text as T

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

THEMES = G.DATE_THEMES


def key(a: str, b: str) -> str:
    """A couple's name in the books, whichever way round they are."""
    return "|".join(sorted((a, b)))


def rounds(ids: list[str], n: int) -> list[dict]:
    """Round-robin couples for `n` dates. With an odd number one rider per date is the Chaperone, in turn.

    Returns:
        One `{"pairs": [[a, b], ...], "chap": id | None}` per date.
    """
    ring: list[str | None] = [*ids, *([None] if len(ids) % 2 else [])]
    out = []
    for _ in range(n):
        pairs, chap = [], None
        for j in range(len(ring) // 2):
            a, b = ring[j], ring[-1 - j]
            if a is None or b is None:
                chap = a or b
            else:
                pairs.append([a, b])
        out.append({"pairs": pairs, "chap": chap})
        ring = [ring[0], ring[-1], *ring[1:-1]]
    return out


def match(pa: float, pb: float, ba: tuple[float, float], bb: tuple[float, float]) -> float:
    """How well two riders match, 0 to 1, from their shares of FTP. Nothing unless both are in their band."""
    tol = G.DATE_BAND_TOL
    if not (ba[0] - tol <= pa <= ba[1] + tol and bb[0] - tol <= pb <= bb[1] + tol):
        return 0.0
    full, none = G.DATE_MATCH_FULL, G.DATE_MATCH_NONE
    return min(1.0, max(0.0, (none - abs(pa - pb)) / (none - full)))


def prompts(theme: str, rng: random.Random) -> list[dict]:
    """A date's prompts (surges, efforts, the sprint) as `{"t", "secs", "k", "band"}`, `t` seconds in."""
    p = THEMES[theme].get("prompt")
    if not p:
        return []
    if "at" in p:
        at = list(p["at"])
    elif "every" in p:
        slack = p["every"] - p["secs"] - 4
        at = [w + rng.uniform(4, slack) for w in range(0, G.DATE_DATE_S, p["every"])]
    else:
        at = sorted(rng.uniform(30, G.DATE_DATE_S - 30 - p["secs"]) for _ in range(p["n"]))
    return [{"t": round(t, 1), "secs": p["secs"], "k": p["k"], "band": p["band"]} for t in at]


class Matching:
    """The scoring half of `Dating` (which holds the state)."""

    def score(
        self, room: Room, pairs: list[list[str]], dt: float, i: int, bel: float, book: dict[str, float]
    ) -> None:
        """Scores each couple for this tick into `book` and keeps the numbers for the report."""
        k, secs = room.plan.get("scale", 1.0), dt / room.plan.get("scale", 1.0)
        a_ = min(1.0, dt / max(dt, G.DATE_SMOOTH_S * k))
        for a, b in pairs:
            ra, rb, kk = room.riders.get(a), room.riders.get(b), key(a, b)
            if not ra or not rb or ra.st != "riding" or rb.st != "riding":
                self.match[kk] = self.match.get(kk, 0.0) * (1 - a_)
                continue
            ba, bb = self.band(room, ra, i, bel), self.band(room, rb, i, bel)
            if isinstance(ba, str) or isinstance(bb, str) or ba is None or bb is None:
                continue
            pa, pb = ra.w / ra.ftp, rb.w / rb.ftp
            m = match(pa, pb, ba, bb)
            self.match[kk] = self.match.get(kk, 0.0) + (m - self.match.get(kk, 0.0)) * a_
            gain = m * G.DATE_PTS_S * secs
            self.pts[kk] = self.pts.get(kk, 0.0) + gain
            book[kk] = book.get(kk, 0.0) + gain
            self.lost(kk, G.DATE_PTS_S * secs - gain)
            for r, o, p, q, band in ((ra, rb, pa, pb, ba), (rb, ra, pb, pa, bb)):
                st = self.stats.setdefault(r.id, self.blank())
                st["m"], st["n"], st["lead"] = st["m"] + m, st["n"] + 1, st["lead"] + (p > q)
                st["out"] += secs * (not band[0] - G.DATE_BAND_TOL <= p <= band[1] + G.DATE_BAND_TOL)
                by = st["by"].setdefault(o.id, [0.0, 0])
                by[0], by[1] = by[0] + m, by[1] + 1
            held = self.spark.get(kk, 0.0)
            if held >= 0:
                held = held + secs if self.match[kk] > G.DATE_SPARK[0] else 0.0
                if held >= G.DATE_SPARK[1]:
                    held = -1.0
                    self.emit("match", f"{ra.name} and {rb.name} are in sync. Get a room.", a)
                    self.chat_log.append(T.CHAT_MATCH.format(a=ra.name, b=rb.name, n=self.n))
                self.spark[kk] = held

    def react(self, room: Room, act: list[Rider]) -> None:
        """Notes when each dater first answers the prompt that is on, and settles prompts that have ended."""
        el = room.el
        for n, p in enumerate(self.prompts):
            if p["t"] <= el < p["end"]:
                at = G.DATE_SPRINT_AT if isinstance(p["band"], str) else p["band"][0] - G.DATE_REACT_UNDER
                if str(n) not in self.reacts:
                    self.reacts[str(n)] = {}
                    self.emit("say", self.rng("prompt", n, self.n).choice(T.PROMPT_TEXT[p["k"]]))
                seen = self.reacts[str(n)]
                for r in act:
                    if r.id not in seen and self.partner(r.id) and r.p / r.ftp >= at:
                        seen[r.id] = el
            elif el >= p["end"]:
                self.settle(room, p)

    def settle(self, room: Room, p: dict) -> None:
        """Pays each couple for reacting to a prompt together: full marks at the same instant."""
        if p["done"]:
            return
        p["done"] = True
        seen, k = self.reacts.get(str(self.prompts.index(p)), {}), room.plan.get("scale", 1.0)
        for a, b in self.pairs:
            if a not in seen or b not in seen:
                continue
            gap, kk = abs(seen[a] - seen[b]) / k, key(a, b)
            gain = G.DATE_REACT_PTS * max(0.0, 1 - gap / G.DATE_REACT_MAX_S)
            self.pts[kk] = self.pts.get(kk, 0.0) + gain
            self.table[kk] = self.table.get(kk, 0.0) + gain
            for rid in (a, b):
                st = self.stats.setdefault(rid, self.blank())
                st["gap"], st["gaps"] = st["gap"] + gap, st["gaps"] + 1

"""Speed Dating rules: riders rotate through couples and score by matching each other's effort."""

from __future__ import annotations

import random
from statistics import fmean
from typing import TYPE_CHECKING

from .. import bots
from .. import config as C
from .. import config_games as G
from . import dating_text as T
from . import script
from .common import Band, CrewGame, tally
from .dating_view import DateView
from .script import Seg

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

THEMES = G.DATE_THEMES
FIXED = {"bar": G.DATE_BAR, "gap": G.DATE_GAP, "cool": G.DATE_COOL}


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


class Dating(DateView, CrewGame):
    """One night. `pairs` are the couples riding together right now; `rounds` is who dates whom, when."""

    no_erg = True

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.seed, self.events, self.ev_n, self.last_i = 0, [], 0, -1
        self.rounds: list[dict] = []
        self.n, self.pairs, self.chap = 0, [], None
        self.match: dict[str, float] = {}  # each current couple's match, smoothed for the screen
        self.pts: dict[str, float] = {}  # and their points on this date
        self.table: dict[str, float] = {}  # every couple's points over the night
        self.spark: dict[str, float] = {}  # seconds each couple has held a spark; -1 once it is called
        self.prompts: list[dict] = []
        self.reacts: dict[str, dict[str, float]] = {}  # prompt index -> rider -> ride time they reacted
        self.stats: dict[str, dict] = {}
        self.profiles: dict[str, str] = {}
        self.emoji_left: dict[str, int] = {}
        self.said: dict[str, list] = {}
        self.card: dict | None = None
        self.chat_log: list[str] = []
        self.chat: list[str] = []

    @classmethod
    def deal(cls, minutes: int) -> dict:
        """The night: the bar, six dates with a walk between, the proposal, wedding, divorce and the chat."""
        segs = [Seg("The Bar", G.DATE_BAR_S, "bar", ("say",))]
        for n, tid in enumerate(G.DATE_ORDER, 1):
            if n > 1:
                segs.append(Seg("Next table", G.DATE_GAP_S, "gap", ("say",)))
            segs.append(Seg(f"Date {n}: {THEMES[tid]['name']}", G.DATE_DATE_S, "date", ("card", "say")))
        segs += [
            Seg("The Proposal", G.DATE_PROPOSAL_S, "proposal", ("say",)),
            Seg("The Wedding", G.DATE_LEG_S, "wedding", ("confetti", "say")),
            Seg("The Divorce", G.DATE_LEG_S, "divorce", ("say",)),
            Seg("The Wedding", G.DATE_LEG_S, "wedding", ("confetti", "say")),
            Seg("The group chat", G.DATE_COOL_S, "cool", ("say",)),
        ]
        plan = script.plan("date", "Speed Dating", segs)
        dates = [b for b in plan["blocks"] if b["kind"] == "date"]
        for n, (b, tid) in enumerate(zip(dates, G.DATE_ORDER, strict=True), 1):
            b["theme"], b["n"] = tid, n
        plan["desc"] = "Six dates, emoji only. Match your date's effort. No ERG."
        return plan

    def begin(self, room: Room) -> None:
        self.seed = random.randrange(2**31)
        self.events = script.schedule(room.plan, self.seed, G.DATE_EVENT_S)
        short = G.DATE_MIN_RIDERS - len(room.riders)
        if short > 0:
            bots.set_bots(room, sum(r.bot for r in room.riders.values()) + short)
        ids = list(room.riders)
        self.rounds = rounds(ids, len(G.DATE_ORDER))
        self.stats = {rid: self.blank() for rid in ids}
        self.meet(room)

    @staticmethod
    def blank() -> dict:
        """A rider's running numbers for the compatibility report."""
        return {
            "m": 0.0,
            "n": 0,
            "lead": 0,
            "out": 0.0,
            "gap": 0.0,
            "gaps": 0,
            "by": {},
            "sent": {},
            "hit": 0,
        }

    def rng(self, *tag: object) -> random.Random:
        return random.Random(f"{self.seed}:{tag}")

    def meet(self, room: Room) -> None:
        """Hook: the bar opens (profiles are dealt here)."""

    # --- the script -------------------------------------------------------------------------------------

    def sync(self, room: Room, i: int) -> None:
        """Handles a change of block: closes the last one, opens this one."""
        if i == self.last_i or i < 0:
            return
        blocks = room.plan["blocks"]
        if self.last_i >= 0:
            self.close(room, blocks[self.last_i])
        self.last_i = i
        b, start = blocks[i], sum(x["dur"] for x in blocks[:i])
        if b["kind"] in ("date", "gap"):
            nxt = b if b["kind"] == "date" else blocks[i + 1]
            self.seat(room, nxt["n"])
            if b["kind"] == "date":
                self.start_date(room, b, start)
        else:
            self.open(room, b, start)

    def seat(self, room: Room, n: int) -> None:
        """Sits everyone at their table for date `n` (during the walk there too, so they see who it is)."""
        rnd = self.rounds[n - 1]
        self.n, self.pairs, self.chap = n, [list(p) for p in rnd["pairs"]], rnd["chap"]
        self.match = {key(a, b): 0.0 for a, b in self.pairs}
        self.pts = {key(a, b): 0.0 for a, b in self.pairs}
        self.spark, self.card = {}, None

    def start_date(self, room: Room, b: dict, start: float) -> None:
        k = room.plan.get("scale", 1.0)
        self.prompts = [
            {**p, "t": start + p["t"] * k, "end": start + (p["t"] + p["secs"]) * k, "done": False}
            for p in prompts(b["theme"], self.rng("prompts", b["n"]))
        ]
        self.reacts = {}
        self.emit("say", f"Date {b['n']}: {THEMES[b['theme']]['name']}. {T.THEME_TEXT[b['theme']]}")

    def open(self, room: Room, b: dict, start: float) -> None:
        """Hook: a block that is not a date or the walk to one begins."""
        self.pairs, self.chap, self.match, self.pts = [], None, {}, {}

    def close(self, room: Room, b: dict) -> None:
        """Hook: a block ends."""
        if b["kind"] == "date":
            for p in self.prompts:
                self.settle(room, p)

    def phase(self, room: Room, i: int) -> str:
        return room.plan["blocks"][i]["kind"]

    def event(self, room: Room, i: int) -> str:
        self.sync(room, i)
        return self.phase(room, i)

    def partner(self, rid: str) -> str | None:
        """Who this rider is riding with right now."""
        return next((b if a == rid else a for a, b in self.pairs if rid in (a, b)), None)

    def prompt(self, el: float) -> dict | None:
        return next((p for p in self.prompts if p["t"] <= el < p["end"]), None)

    def date_band(self, room: Room, r: Rider, b: dict) -> Band:
        """A dater's band: the theme's, or its prompt's while one is on."""
        p = self.prompt(room.el)
        band = p["band"] if p else THEMES[b["theme"]]["band"]
        return band if isinstance(band, str) else tuple(band)

    def band(self, room: Room, r: Rider, i: int, bel: float) -> Band:
        self.sync(room, i)
        b = room.plan["blocks"][i]
        if b["kind"] == "date":
            if not self.partner(r.id):
                return G.DATE_CHAP
            return self.card_band(room, r, self.date_band(room, r, b))
        return FIXED.get(b["kind"]) or self.finale_band(room, r, b)

    def card_band(self, room: Room, r: Rider, band: Band) -> Band:
        """Hook: what a Chaperone's card does to a dater's band."""
        return band

    def finale_band(self, room: Room, r: Rider, b: dict) -> Band:
        """Hook: bands for the proposal, wedding and divorce."""
        return G.DATE_BAR

    def say(self, room: Room, b: dict) -> None:
        lines = T.DATE[b["theme"]] if b["kind"] == "date" else getattr(T, b["kind"].upper())
        self.emit("say", self.rng("say", round(room.el)).choice(lines))

    # --- one tick ---------------------------------------------------------------------------------------

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        self.sync(room, i)
        b, el = room.plan["blocks"][i], room.el
        act = [r for r in room.riders.values() if r.st == "riding"]
        tally(act, dt)
        self.speed = (fmean(min(C.TARGET_CAP, r.w / r.ftp) for r in act) if act else 0.0) * G.DATE_MS_AT_FTP
        self.dist += self.speed * dt
        due, self.ev_n = script.due(self.events, self.ev_n, el)
        for e in due:
            self.say(room, b) if e["k"] == "say" else self.on_event(room, b, e)
        if b["kind"] == "date":
            self.react(room, act)
            self.score(room, self.pairs, dt, i, bel, self.table)
        self.extra_tick(room, act, dt, i, bel)
        return super().tick(room, dt, i, bel, ev)

    def on_event(self, room: Room, b: dict, e: dict) -> None:
        """Hook: a scripted card or confetti moment."""

    def extra_tick(self, room: Room, act: list[Rider], dt: float, i: int, bel: float) -> None:
        """Hook: cards, bots' emoji and the finale."""

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

    def lost(self, kk: str, pts: float) -> None:
        """Hook: points a couple dropped this tick (a Chaperone's card banks them)."""

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

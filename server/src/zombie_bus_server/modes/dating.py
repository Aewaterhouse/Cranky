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
from .dating_finale import Finale
from .dating_match import Matching, key, match, prompts, rounds
from .dating_social import Social
from .dating_view import DateView
from .script import Seg

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

THEMES = G.DATE_THEMES
FIXED = {"bar": G.DATE_BAR, "gap": G.DATE_GAP, "cool": G.DATE_COOL}


__all__ = ["Dating", "key", "match", "prompts", "rounds"]


class Dating(Social, Finale, Matching, DateView, CrewGame):
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
        self.used: dict[str, list[str]] = {}  # cards each Chaperone has played on this date
        self.pick: str | None = None  # the card the Chaperone is aiming
        self.chap_pts: dict[str, float] = {}  # points each Chaperone has cost the couples
        self.picked: list[str] = []
        self.prof_opts: dict[str, list[str]] = {}
        self.met: dict[str, int] = {}  # dates each couple has had
        self.date_end = 0.0
        self.chat_log: list[str] = []
        self.chat: list[str] = []
        self.finale_init()

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
        self.spark, self.card, self.used, self.pick = {}, None, {}, None
        self.emoji_left = {x: G.DATE_EMOJI_N for p in self.pairs for x in p}

    def start_date(self, room: Room, b: dict, start: float) -> None:
        k = room.plan.get("scale", 1.0)
        self.prompts = [
            {**p, "t": start + p["t"] * k, "end": start + (p["t"] + p["secs"]) * k, "done": False}
            for p in prompts(b["theme"], self.rng("prompts", b["n"]))
        ]
        self.reacts, self.date_end = {}, start + b["dur"]
        for a, c in self.pairs:
            self.met[key(a, c)] = self.met.get(key(a, c), 0) + 1
        self.emit("say", f"Date {b['n']}: {THEMES[b['theme']]['name']}. {T.THEME_TEXT[b['theme']]}")

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

    def say(self, room: Room, b: dict) -> None:
        kind = "reception" if b["kind"] == "divorce" and not self.exes else b["kind"]
        lines = T.DATE[b["theme"]] if kind == "date" else getattr(T, kind.upper())
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
        self.social_tick(room, act, dt)
        self.finale_tick(room, act, dt, i, bel)
        return super().tick(room, dt, i, bel, ev)

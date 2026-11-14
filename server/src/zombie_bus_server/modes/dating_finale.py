"""Speed Dating's ending: the proposal, the wedding, the divorce and the leaked group chat."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .. import config_games as G
from . import dating_text as T
from .common import Band
from .dating_match import key

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room


class Finale:
    """The last four segments of `Dating` (which holds the rest of the state)."""

    def finale_init(self) -> None:
        self.finalists: list[list[str]] = []
        self.off: dict[str, float] = {}  # the ride-off for the ring
        self.couple: list[str] | None = None
        self.exes: list[str] | None = None
        self.tug = 0.0
        self.divorced: dict | None = None
        self.married: dict | None = None
        self.legs, self.tandem_ok, self.tandem_n = 0, 0, 0
        self.tandem: list[float] | None = None
        self.conf_until = 0.0
        self.confetti_s: dict[str, float] = {}
        self.leak: list[str] = []
        self.cool_at = 0.0

    def ranked(self, worst: bool = False) -> list[list[str]]:
        """Couples who have dated, by points a date: best first, or worst first."""
        rate = {kk: self.table.get(kk, 0.0) / n for kk, n in self.met.items() if n}
        return [kk.split("|") for kk in sorted(rate, key=lambda kk: rate[kk], reverse=not worst)]

    def open(self, room: Room, b: dict, start: float) -> None:
        """Sets up whichever of the bar, proposal, wedding, divorce or group chat is starting."""
        kind, names = b["kind"], lambda p: [self.name(room, x) for x in p]  # noqa: E731
        self.pairs, self.chap, self.card, self.tandem = [], None, None, None
        if kind == "proposal":
            best = self.ranked()
            self.finalists = best[:1] + [p for p in best[1:] if not set(p) & set(best[0])][:1] if best else []
            self.pairs, self.off = [list(p) for p in self.finalists], {}
            if len(self.finalists) == 2:
                (a, c), (d, e) = (names(p) for p in self.finalists)
                self.emit("say", T.RIDE_OFF.format(a=a, b=c, c=d, d=e))
        elif kind == "wedding" and self.couple:
            self.legs += 1
            self.pairs = [list(self.couple)]
        elif kind == "divorce":
            rest = [p for p in self.ranked(worst=True) if not self.couple or set(p) != set(self.couple)]
            self.exes = rest[0] if rest and len(room.riders) >= G.DATE_MIN_RIDERS else None
            self.pairs, self.tug = ([list(self.exes)] if self.exes else []), 0.0
        elif kind == "cool":
            self.cool_at, self.leak = start, self.leaked(room)
        self.match = {key(*p): 0.0 for p in self.pairs}
        self.pts = {key(*p): 0.0 for p in self.pairs}

    def close(self, room: Room, b: dict) -> None:
        """Ends a block: settles a date, names the engaged couple, marries them or divorces the exes."""
        kind, name = b["kind"], lambda x: self.name(room, x)  # noqa: E731
        if kind == "date":
            for p in self.prompts:
                self.settle(room, p)
        elif kind == "proposal" and self.finalists:
            won = max(self.finalists, key=lambda p: self.off.get(key(*p), 0.0))
            self.couple = list(won)
            lost = next((p for p in self.finalists if p != won), None)
            a, c = name(won[0]), name(won[1])
            line = T.ENGAGED.format(a=a, b=c, c=name(lost[0]), d=name(lost[1])) if lost else ""
            line = line or T.ENGAGED_SOLO.format(a=a, b=c)
            self.emit("engaged", line, won[0])
            self.chat_log.append(f"💍 {line}")
        elif kind == "wedding" and self.couple and self.legs >= 2 and not self.married:
            held = self.tandem_ok / self.tandem_n if self.tandem_n else 0.0
            a, c = self.couple
            self.married = {"a": name(a), "b": name(c), "ids": [a, c], "held": round(held, 2)}
            line = T.MARRIED.format(a=name(a), b=name(c), pct=round(held * 100))
            self.emit("married", line, a)
            self.chat_log.append(f"💒 {line}")
        elif kind == "divorce" and self.exes and not self.divorced:
            self.decide(room)

    def decide(self, room: Room) -> None:
        """The rope has gone all the way, or time is up: whoever is ahead keeps the house."""
        a, b = self.exes
        w, lo = (b, a) if self.tug > 0 else (a, b)
        self.divorced = {"winner": self.name(room, w), "loser": self.name(room, lo), "ids": [w, lo]}
        line = T.DIVORCED.format(w=self.divorced["winner"], l=self.divorced["loser"])
        self.emit("divorced", line, w)
        self.chat_log.append(f"⚖️ {line}")

    def finale_band(self, room: Room, r: Rider, b: dict) -> Band:
        kind = b["kind"]
        if kind == "proposal":
            return G.DATE_PROPOSAL if self.partner(r.id) else G.DATE_TEMPO
        if kind == "wedding":
            if self.couple and r.id in self.couple:
                return G.DATE_TANDEM_BAND
            return G.DATE_CONFETTI if room.el < self.conf_until else G.DATE_GUEST
        if kind == "divorce" and self.exes and r.id in self.exes and not self.divorced:
            return "free"
        return G.DATE_WATCH

    def confetti(self, room: Room, e: dict) -> None:
        if self.kind(room) == "wedding" and self.couple:
            self.conf_until = e["t"] + e["dur"]
            self.emit("say", T.CONFETTI)

    def finale_tick(self, room: Room, act: list[Rider], dt: float, i: int, bel: float) -> None:
        kind, secs = self.kind(room), dt / room.plan.get("scale", 1.0)
        riding = {r.id: r for r in act}
        if kind == "proposal":
            self.score(room, self.pairs, dt, i, bel, self.off)
        elif kind == "wedding" and self.couple:
            two = [riding[x] for x in self.couple if x in riding]
            w, tgt = sum(r.w for r in two), sum(room.riders[x].ftp for x in self.couple) * G.DATE_TANDEM
            off = abs(w / tgt - 1)
            self.tandem, self.tandem_n = [round(w), round(tgt)], self.tandem_n + 1
            self.tandem_ok += off <= G.DATE_TANDEM_TOL
            self.match[key(*self.couple)] = max(0.0, 1 - off / (3 * G.DATE_TANDEM_TOL))
            if room.el < self.conf_until:
                for r in act:
                    if r.id not in self.couple and r.w / r.ftp >= G.DATE_CONFETTI[0] - G.DATE_BAND_TOL:
                        self.confetti_s[r.id] = self.confetti_s.get(r.id, 0.0) + secs
        elif kind == "divorce" and self.exes and not self.divorced:
            a, b = (riding.get(x) for x in self.exes)
            pull = (b.p / b.ftp if b else 0.0) - (a.p / a.ftp if a else 0.0)
            self.tug = max(-1.0, min(1.0, self.tug + pull * G.DATE_TUG_RATE * secs))
            if abs(self.tug) >= 1:
                self.decide(room)
        elif kind == "cool" and self.leak:
            dur = room.plan["blocks"][i]["dur"]
            n = 1 + int((room.el - self.cool_at) / max(1.0, dur * 0.8) * len(self.leak))
            self.chat = self.leak[:n]

    def leaked(self, room: Room) -> list[str]:
        """The group chat: every emoji and card of the night, thinned to fit, and who said nothing at all."""
        log, most = self.chat_log, G.DATE_CHAT_MAX
        if len(log) > most:
            log = [log[round(n * (len(log) - 1) / (most - 1))] for n in range(most)]
        quiet = [
            T.CHAT_QUIET.format(a=r.name)
            for r in room.riders.values()
            if not self.stats.get(r.id, {}).get("sent")
        ]
        return [T.CHAT_OPEN, *log, *quiet]

    def finale_view(self, room: Room) -> dict:
        kind = self.kind(room)
        return {
            "couple": self.couple,
            "exes": self.exes,
            "tandem": (
                {"w": self.tandem[0], "tgt": self.tandem[1]} if kind == "wedding" and self.tandem else None
            ),
            "tug": round(self.tug, 2) if kind == "divorce" and self.exes else None,
        }

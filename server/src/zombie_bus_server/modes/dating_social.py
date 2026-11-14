"""Speed Dating's talking: profiles, emoji, the Chaperone's cards and the bots' characters."""

from __future__ import annotations

import math
import random
from typing import TYPE_CHECKING

from .. import config as C
from .. import config_games as G
from . import dating_text as T
from .common import Band
from .dating_match import key

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

CARDS = G.DATE_CARDS


class Social:
    """Everything a rider can say or play in `Dating` (which holds the state)."""

    def meet(self, room: Room) -> None:
        """Deals everyone three profiles; the first is theirs unless they pick another. Bots pick now."""
        for r in room.riders.values():
            rng = self.rng("profile", r.id)
            opts = self.prof_opts[r.id] = rng.sample(T.PROFILES, 3)
            self.profiles[r.id] = rng.choice(opts) if r.bot else opts[0]

    def kind(self, room: Room) -> str:
        return room.plan["blocks"][self.last_i]["kind"] if self.last_i >= 0 else ""

    def name(self, room: Room, rid: str) -> str:
        return T.AUNTY if rid == "aunty" else room.riders[rid].name if rid in room.riders else "?"

    def cards_left(self, by: str) -> list[str]:
        return [c for c in CARDS if c not in self.used.get(by, [])]

    def can_play(self, room: Room) -> bool:
        """A card needs a date in progress, nothing already in play and time to run."""
        fits = room.el + G.DATE_CARD_S * room.plan.get("scale", 1.0) <= self.date_end
        return self.kind(room) == "date" and not self.card and bool(self.pairs) and fits

    def ask(self, room: Room, r: Rider) -> dict | None:
        kind, k = self.kind(room), room.plan.get("scale", 1.0)
        if kind == "bar" and r.id in self.prof_opts and r.id not in self.picked:
            left = G.DATE_PROFILE_S * k - room.el
            if left <= 0:
                return None
            opts = [{"v": str(n), "label": line} for n, line in enumerate(self.prof_opts[r.id])]
            v = str(self.prof_opts[r.id].index(self.profiles[r.id]))
            return {
                "k": "profile",
                "title": T.PROFILE_ASK,
                "sub": T.PROFILE_SUB,
                "opts": opts,
                "left": round(left),
                "v": v,
            }
        if r.id != self.chap or not self.can_play(room) or not self.cards_left(r.id):
            return None
        if not self.pick:
            left = self.cards_left(r.id)
            opts = [
                {"v": c, "label": d["name"], "icon": d["icon"], "sub": T.CARDS[c], "off": c not in left}
                for c, d in CARDS.items()
            ]
            return {"k": "card", "title": T.CARD_ASK, "sub": T.CARD_SUB.format(n=len(left)), "opts": opts}
        if CARDS[self.pick]["both"]:
            opts = [
                {"v": key(a, b), "label": f"{self.name(room, a)} + {self.name(room, b)}"}
                for a, b in self.pairs
            ]
        else:
            opts = [
                {"v": x, "label": self.name(room, x), "sub": f"dating {self.name(room, self.partner(x))}"}
                for p in self.pairs
                for x in p
            ]
        title = T.AIM_ASK.format(card=CARDS[self.pick]["name"])
        return {"k": "aim", "title": title, "opts": [*opts, {"v": "back", "label": "Back", "icon": "↩️"}]}

    def on_act(self, room: Room, r: Rider, k: str, v: str | float | bool | None) -> None:
        v = v if isinstance(v, str) else ""
        if k == "profile" and v in ("0", "1", "2") and self.kind(room) == "bar" and r.id in self.prof_opts:
            self.profiles[r.id] = self.prof_opts[r.id][int(v)]
            self.picked.append(r.id)
        elif k == "emoji":
            self.send(room, r, v)
        elif k == "card" and r.id == self.chap and v in self.cards_left(r.id) and self.can_play(room):
            self.pick = v
        elif k == "aim" and r.id == self.chap and self.pick and self.can_play(room):
            both = CARDS[self.pick]["both"]
            who = next((p for p in self.pairs if key(*p) == v), None) if both else None
            if not both and self.partner(v):
                who = [v]
            if who:
                self.play(room, r.id, self.pick, list(who))
            self.pick = None

    def send(self, room: Room, r: Rider, e: str) -> None:
        """An emoji to your date: the only talking allowed, five a date."""
        o = self.partner(r.id)
        if self.kind(room) != "date" or not o or e not in G.DATE_EMOJI or self.emoji_left.get(r.id, 0) <= 0:
            return
        self.emoji_left[r.id] -= 1
        self.said[r.id] = [e, round(room.el, 1)]
        sent = self.stats.setdefault(r.id, self.blank())["sent"]
        sent[e] = sent.get(e, 0) + 1
        self.chat_log.append(T.CHAT_EMOJI.format(n=self.n, a=r.name, b=self.name(room, o), e=e))
        self.emit("emoji", None, r.id)

    def play(self, room: Room, by: str, k: str, who: list[str]) -> None:
        """Puts card `k` on `who` (one dater, or a couple) for the next 15 seconds."""
        until = room.el + G.DATE_CARD_S * room.plan.get("scale", 1.0)
        self.card = {"k": k, "who": who, "pair": key(who[0], self.partner(who[0])), "by": by, "until": until}
        self.used.setdefault(by, []).append(k)
        names = " and ".join(self.name(room, x) for x in who)
        said = {"by": self.name(room, by), "card": CARDS[k]["name"], "who": names, "text": T.CARDS[k]}
        self.emit("card", T.CARD_FX.format(**said), who[0])
        self.chat_log.append(T.CHAT_CARD.format(**said))
        for x in who:
            self.stats.setdefault(x, self.blank())["hit"] += 1

    def card_band(self, room: Room, r: Rider, band: Band) -> Band:
        """A card moves its target; their date may follow them there, so the couple can still match."""
        c = self.card
        if not c or room.el >= c["until"]:
            return band
        cb = tuple(CARDS[c["k"]]["band"])
        if r.id in c["who"]:
            return cb
        if key(r.id, self.partner(r.id)) != c["pair"] or isinstance(band, str) or band is None:
            return band
        return (min(band[0], cb[0]), max(band[1], cb[1]))

    def card_view(self, room: Room) -> dict | None:
        c = self.card
        if not c:
            return None
        left = round(max(0.0, c["until"] - room.el), 1)
        return {
            "k": c["k"],
            "name": CARDS[c["k"]]["name"],
            "text": T.CARDS[c["k"]],
            "who": c["who"],
            "left": left,
        }

    def lost(self, kk: str, pts: float) -> None:
        """The Chaperone banks what the couple under their card drops."""
        if self.card and self.card["pair"] == kk:
            by = self.card["by"]
            self.chap_pts[by] = self.chap_pts.get(by, 0.0) + pts

    def on_event(self, room: Room, b: dict, e: dict) -> None:
        """A scripted moment: confetti at the wedding; on a date, Aunty Carol or a bot Chaperone plays a card
        at whoever is winning (a human Chaperone gets a nudge instead)."""
        if e["k"] == "confetti":
            return self.confetti(room, e)
        if b["kind"] != "date" or not self.pairs:
            return
        by = self.chap or "aunty"
        left = self.cards_left(by)
        if by in room.riders and not room.riders[by].bot:
            if left:
                line = T.NUDGE.format(name=self.name(room, by), n=len(left), s="s" * (len(left) != 1))
                self.emit("say", line, by)
            return
        if not left or not self.can_play(room):
            return
        rng = self.rng("card", self.n, e["t"])
        k = rng.choice(left)
        pair = max(self.pairs, key=lambda p: self.pts.get(key(*p), 0.0))
        self.play(room, by, k, list(pair) if CARDS[k]["both"] else [rng.choice(pair)])

    def social_tick(self, room: Room, act: list[Rider], dt: float) -> None:
        if self.card and room.el >= self.card["until"]:
            self.card = None
        if self.kind(room) != "date":
            return
        for r in act:
            if r.bot and self.partner(r.id):
                rng = self.rng("emoji", r.id, round(room.el * C.TICK_HZ))
                if rng.random() < G.DATE_BOT_EMOJI_PER_S * dt / room.plan.get("scale", 1.0):
                    self.send(room, r, rng.choice(G.DATE_EMOJI))

    def bot(self, room: Room, r: Rider, w: float, tgt: float | None, rng: random.Random) -> float:
        """Bot characters: Clingy copies its date, Aloof ignores them, Chaotic wanders. Exes pull hard."""
        if self.exes and r.id in self.exes and not self.divorced and self.kind(room) == "divorce":
            return r.ftp * rng.uniform(0.9, 1.25)
        o = room.riders.get(self.partner(r.id) or "")
        if not o or tgt is None or r.name not in C.BOT_NAMES:
            return w
        n = C.BOT_NAMES.index(r.name)
        kind = G.DATE_BOTS[n % len(G.DATE_BOTS)]
        if kind == "clingy" and o.w > 0:
            return min(C.TARGET_CAP, G.DATE_CLING * o.w / o.ftp + (1 - G.DATE_CLING) * tgt / r.ftp) * r.ftp
        if kind == "chaotic":
            return tgt * (1 + G.DATE_CHAOS * math.sin(room.el / 4 + n))
        return float(tgt) if kind == "aloof" else w

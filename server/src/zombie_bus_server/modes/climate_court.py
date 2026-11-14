"""Climate Lawsuit's questions and courtroom: fuel choices, the lobbyist, seawalls, the Trial, sentencing and
the GUILTY sash, and how the bots answer."""

from __future__ import annotations

import random
import time
from collections import Counter
from typing import TYPE_CHECKING

from .. import config as C
from .. import config_games as G
from . import climate_text as T

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

YES_NO = [{"v": "yes", "label": "Yes"}, {"v": "no", "label": "No"}]


class Court:
    """Mixed into `Climate`. Trial times are ride seconds; `held` is seconds each defendant held the dock."""

    def court_init(self) -> None:
        self.trial_t = 0.0
        self.defendants: list[str] = []
        self.votes: dict[str, str] = {}
        self.target: int | None = None
        self.dock_s, self.held_s = 0.0, {}
        self.verdicts: dict[str, str] = {}
        self.appeals: dict[str, bool] = {}
        self.cool_t = 0.0
        self.answered: list[str] = []  # bot questions answered, as "k:rider"
        self.wait: dict[str, float] = {}

    def scale(self, room: Room) -> float:
        return room.plan.get("scale", 1.0)

    # --- the Trial and sentencing ----------------------------------------------------------------------

    def open_trial(self, room: Room) -> None:
        self.trial_t = room.el
        top = max(self.cos, key=lambda rid: self.emit_t.get(rid, 0.0))
        self.defendants = [top]
        name = room.riders[top].name if top in room.riders else "?"
        self.emit("say", T.DEFENDANT.format(name=name, t=round(self.emit_t.get(top, 0.0))))

    def open_cool(self, room: Room) -> None:
        self.cool_t = room.el
        self.decide(room)

    def voting(self, room: Room) -> bool:
        return self.kind(room) == "trial" and room.el < self.trial_t + G.CLIM_VOTE_S * self.scale(room)

    def in_dock(self, room: Room) -> bool:
        k = self.scale(room)
        start = self.trial_t + G.CLIM_VOTE_S * k
        return self.kind(room) == "trial" and start <= room.el < start + G.CLIM_DOCK_S * k

    def sashed(self, room: Room, rid: str) -> bool:
        r = room.riders.get(rid)
        return bool(r and r.look.get("sash"))

    def court_band(self, room: Room, r: Rider, kind: str):
        if kind == "trial" and self.target and r.id in self.defendants and self.in_dock(room):
            t = self.target / 100
            return min(C.TARGET_CAP, t - G.CLIM_DOCK_HALF), min(C.TARGET_CAP, t + G.CLIM_DOCK_HALF)
        service = room.el < self.cool_t + G.CLIM_SERVICE["secs"] * self.scale(room)
        if kind == "cool" and service and self.verdicts.get(r.id) == "guilty":
            return G.CLIM_SERVICE["band"]
        return G.CLIM_EASY

    def court_tick(self, room: Room, act: list[Rider], dt: float, kind: str) -> None:
        if kind != "trial":
            return
        if not self.voting(room) and self.target is None:
            tally_ = Counter(self.votes.values())
            best = max(tally_.values(), default=0)
            # A tie goes the harsher way; nobody voting means 100%.
            pick = max((v for v, n in tally_.items() if n == best), key=int, default="100")
            self.target = int(pick)
            self.emit("say", T.TARGET.format(t=self.target))
        if self.in_dock(room):
            self.dock_s += dt
            t, live = (self.target or 100) / 100, {r.id: r for r in act}
            for rid in self.defendants:
                r = live.get(rid)
                if r and abs(r.w / r.ftp - t) <= G.CLIM_DOCK_HALF + 0.01:
                    self.held_s[rid] = self.held_s.get(rid, 0.0) + dt
        elif self.target is not None and self.dock_s and not self.verdicts:
            self.decide(room)

    def held(self, rid: str) -> float:
        return self.held_s.get(rid, 0.0) / self.dock_s if self.dock_s else 0.0

    def decide(self, room: Room) -> None:
        """Verdicts on everyone in the dock, and the sash for anyone found guilty of flooding the town."""
        if self.verdicts or not self.defendants:
            return
        for rid in self.defendants:
            name = room.riders[rid].name if rid in room.riders else "?"
            free = self.held(rid) >= G.CLIM_ACQUIT
            self.verdicts[rid] = "acquitted" if free else "guilty"
            if free:
                self.sash(room, rid, False)
                text = T.ACQUIT
            elif self.flooded:
                self.sash(room, rid, True)
                text = T.GUILTY_SASH
            else:
                text = T.GUILTY
            self.emit("verdict", text.format(name=name), rid)

    def sash(self, room: Room, rid: str, on: bool) -> None:
        """Puts the sash on (for 30 days) or takes it off, in the store and on the rider's look now."""
        store, r = getattr(room, "store", None), room.riders.get(rid)
        if r and r.bot:
            return
        if store:
            store.set_sash(rid, time.time() + G.CLIM_SASH_DAYS * 86400 if on else None)
        if r:
            r.look = {**r.look, "sash": True} if on else {k: v for k, v in r.look.items() if k != "sash"}

    # --- questions and answers --------------------------------------------------------------------------

    def ask(self, room: Room, r: Rider) -> dict | None:
        rid, k = r.id, self.scale(room)
        if self.offer and self.offer["who"] == rid:
            return {
                "k": "bribe",
                "title": "💰 The lobbyist",
                "sub": T.BRIBE_ASK.format(n=G.CLIM_BRIBE),
                "opts": YES_NO,
                "left": round(self.offer["until"] - room.el),
            }
        n = self.choosing(room)
        if n and rid in self.cos and self.locked.get(rid) != n:
            co = self.cos[rid]
            opts = []
            for f in G.CLIM_FUELS:
                cost = self.switch_cost(co["fuel"], f, n)
                sub = T.FUEL_SUB[f] + (f" {cost} coins" if cost else "")
                opts.append(
                    {
                        "v": f,
                        "label": f.title(),
                        "icon": T.FUEL_ICON[f],
                        "sub": sub,
                        "off": cost > co["coins"],
                    }
                )
            end = sum(b["dur"] for b in room.plan["blocks"][: self.last_i + 1])
            return {
                "k": "fuel",
                "title": f"Pick your fuel for the {G.CLIM_DECADES[n - 1]}",
                "sub": "Leaving coal costs coins, less each decade. Going back is free.",
                "opts": opts,
                "left": round(end - room.el),
                "v": self.next_fuel.get(rid, co["fuel"]),
            }
        if not self.voting(room):
            return None
        left = round(self.trial_t + G.CLIM_VOTE_S * k - room.el)
        if self.sashed(room, rid) and rid not in self.defendants and rid not in self.appeals:
            return {
                "k": "appeal",
                "title": "⚖️ Appeal your conviction?",
                "sub": T.APPEAL_ASK,
                "opts": YES_NO,
                "left": left,
            }
        if rid in self.defendants:
            return None
        opts = [{"v": v, "label": f"Hold {v}%", "sub": "for three minutes"} for v in G.CLIM_TARGETS]
        names = " and ".join(room.riders[d].name for d in self.defendants if d in room.riders)
        return {
            "k": "verdict_target",
            "title": f"The jury sets {names}'s effort",
            "sub": "Hold it for 80% of three minutes and they walk on a technicality.",
            "opts": opts,
            "left": left,
            "v": self.votes.get(rid),
        }

    def on_act(self, room: Room, r: Rider, k: str, v: str | float | bool | None) -> None:
        rid = r.id
        if k == "wall":
            self.build_wall(room, r)
        elif k == "fuel" and v in G.CLIM_FUELS and self.choosing(room) and rid in self.cos:
            self.next_fuel[rid] = str(v)
        elif k == "bribe" and self.offer and self.offer["who"] == rid and v in ("yes", "no"):
            self.offer = None
            if v == "yes":
                self.cos[rid]["coins"] += G.CLIM_BRIBE
                self.bribed[rid] = True
                self.locked[rid] = self.n + 1
        elif k == "appeal" and self.voting(room) and self.sashed(room, rid) and v in ("yes", "no"):
            self.appeals[rid] = v == "yes"
            if v == "yes" and rid not in self.defendants:
                self.defendants.append(rid)
                self.emit("say", T.APPEAL.format(name=r.name), rid)
        elif (
            k == "verdict_target" and v in G.CLIM_TARGETS and self.voting(room) and rid not in self.defendants
        ):
            self.votes[rid] = str(v)

    # --- bots -------------------------------------------------------------------------------------------

    def character(self, r: Rider) -> str:
        return G.CLIM_BOTS[C.BOT_NAMES.index(r.name) % len(G.CLIM_BOTS)] if r.name in C.BOT_NAMES else ""

    def bot(self, room: Room, r: Rider, w: float, tgt: float | None, rng: random.Random) -> float:
        """The Baron burns a little harder than he needs to."""
        co = self.cos.get(r.id)
        if co and co["fuel"] == "coal" and self.character(r) == "baron" and self.kind(room) == "decade":
            return min(C.TARGET_CAP * r.ftp, w * 1.08)
        return w

    def bots_answer(self, room: Room) -> None:
        """Bots answer questions in character a few seconds after they are asked; Greenie builds walls."""
        for r in room.riders.values():
            if not r.bot:
                continue
            kind = self.character(r) or "fence"
            if kind == "greenie" and self.level > 0.3 and r.id in self.cos:
                if self.cos[r.id]["coins"] >= self.wall_cost() + 10 and self.kind(room) == "decade":
                    self.build_wall(room, r)
            q = self.ask(room, r)
            if not q:
                continue
            tag = f"{q['k']}:{r.id}:{self.n}"
            if tag in self.answered:
                continue
            due = self.wait.setdefault(
                tag, room.el + random.Random(tag).uniform(*G.CLIM_BOT_ASK_S) * self.scale(room)
            )
            if room.el < due:
                continue
            self.answered.append(tag)
            self.on_act(room, r, q["k"], self.bot_answer(r, kind, q))

    def bot_answer(self, r: Rider, kind: str, q: dict) -> str:
        k, ok = q["k"], [o["v"] for o in q["opts"] if not o.get("off")]
        if k == "fuel":
            prefs = {"baron": ["coal"], "greenie": ["solar", "wind", "gas"], "fence": ["gas"]}[kind]
            return next((f for f in prefs if f in ok), q.get("v") or "coal")
        if k == "bribe":
            return (
                "yes" if kind == "baron" or (kind == "fence" and random.Random(r.id).random() < 0.5) else "no"
            )
        if k == "appeal":
            return "yes"
        return {"baron": "90", "greenie": "105", "fence": "100"}[kind]

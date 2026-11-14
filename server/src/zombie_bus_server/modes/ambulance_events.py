"""Kidney Stone Express road events: green wave, M1 roadworks, speed hump and the car that won't pull over."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config as C
from .. import config_games as G
from . import ambulance_text as T
from .common import Band

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

PATIENTS = G.AMBO_PATIENTS


def crew_band(e: dict, el: float) -> tuple[float, float] | None:
    """The band event `e` puts on the whole crew at ride time `el` (a hump only bites in its second half)."""
    if not e["t"] <= el < e["t"] + e["dur"]:
        return None
    if e["k"] == "hump":
        return G.AMBO_HUMP if el >= e["t"] + e["dur"] / 2 else None
    return {"green": G.AMBO_GREEN, "roadworks": G.AMBO_ROADWORKS}.get(e["k"])


class RoadEvents:
    """The road half of `Ambulance`. `cur` is the event in progress, with whatever is being counted for it."""

    @staticmethod
    def run_events(pid: str) -> tuple[str, ...]:
        return PATIENTS[pid]["events"]

    def on_road(self) -> bool:
        """Still driving a patient, short of the braking zone: the only time the road throws anything."""
        return self.open and self.arrived is None and self.left > self.brake_m

    def ev_all(self, evs: list[dict], el: float) -> tuple[float, float] | None:
        return next((b for b in (crew_band(e, el) for e in evs) if b), None)

    def ev_band(self, room: Room, r: Rider) -> Band:
        if not self.cur:
            return None
        if self.cur["k"] == "siren":
            return "sprint" if r.id == self.cur["who"] else None
        return crew_band(self.cur, room.el)

    def ev_start(self, room: Room, e: dict) -> None:
        if not self.on_road():
            return
        self.cur = {**e, "who": None, "hit": 0, "n": 0, "sum": 0.0, "low": False, "fined": []}
        if e["k"] == "siren":
            act = sorted(r.id for r in room.riders.values() if r.st == "riding")
            self.cur["who"] = self.rng("siren", e["t"]).choice(act) if act else None

    def ev_tick(self, room: Room, act: list[Rider], dt: float) -> None:
        c, el, k = self.cur, room.el, room.plan.get("scale", 1.0)
        if not c:
            return
        if not self.on_road():  # the hospital comes first
            self.cur = None
        elif el >= c["t"] + c["dur"]:
            self.cur = None
            getattr(self, f"end_{c['k']}")(room, c, k)
        elif c["k"] == "green":
            c["n"] += len(act)
            c["hit"] += sum(self.sm[r.id] / r.ftp >= G.AMBO_GREEN_AT for r in act)
        elif c["k"] == "roadworks" and el >= c["t"] + G.AMBO_GRACE_S * k:
            for r in act:
                if self.sm[r.id] / r.ftp > G.AMBO_FINE_OVER:
                    r.punish(dt)
                    if r.id not in c["fined"]:
                        c["fined"].append(r.id)
                        self.fines[r.id] = self.fines.get(r.id, 0) + 1
                        self.comfort -= G.AMBO_FINE_COMFORT
                        self.emit("fine", f"{r.name} cops a speeding fine in the roadworks.", r.id)
        elif c["k"] == "hump" and el >= c["t"] + c["dur"] / 2:
            c["low"] |= bool(act) and all(r.p / r.ftp < G.AMBO_HUMP_MAX for r in act)
            heavy = max(act, key=lambda r: r.p / r.ftp, default=None)  # who to blame if it goes wrong
            if heavy and heavy.p / heavy.ftp >= G.AMBO_HUMP_MAX:
                c["heavy"] = heavy.id
        elif c["k"] == "siren":
            who = room.riders.get(c["who"])
            if who:
                c["sum"], c["n"] = c["sum"] + who.p / who.ftp, c["n"] + 1

    def end_green(self, room: Room, c: dict, k: float) -> None:
        caught = self.perk == "green" or (c["n"] and c["hit"] / c["n"] >= G.AMBO_GREEN_NEED)
        if self.perk == "green":
            self.perk = None
        self.left += (-G.AMBO_GREEN_M if caught else G.AMBO_GREEN_M / 2) * k
        self.emit(
            "say",
            "Green, green, green. Caught the lot." if caught else "Missed the wave. Red light. Indicator on.",
        )

    def end_roadworks(self, room: Room, c: dict, k: float) -> None:
        n = len(c["fined"])
        self.emit(
            "say",
            (
                f"Through the roadworks. {n} fine{'s' * (n != 1)} in the mail."
                if n
                else "Through the roadworks. Not a cone touched."
            ),
        )

    def end_hump(self, room: Room, c: dict, k: float) -> None:
        if c["low"]:
            return self.emit("say", "Over the hump like a hovercraft.")
        if self.perk == "spike":
            self.perk = None
            return self.emit("perk", "Free spike used on the speed hump. Nobody felt a thing.")
        self.comfort -= G.AMBO_HUMP_COMFORT * PATIENTS[self.pid]["strict"]
        self.hurt_at = room.el
        who = room.riders.get(c.get("heavy") or "")
        self.emit(
            "say",
            (
                f"BANG. {who.name} kept the power on over the hump and the patient left the stretcher."
                if who
                else "BANG. The patient left the stretcher for a moment there."
            ),
            who.id if who else None,
        )

    def end_siren(self, room: Room, c: dict, k: float) -> None:
        who = room.riders.get(c["who"])
        loud = c["n"] and c["sum"] / c["n"] >= G.AMBO_SIREN_NEED
        self.left += (-G.AMBO_SIREN_M if loud else G.AMBO_SIREN_M) * k
        name = who.name if who else "The siren"
        self.emit(
            "say",
            (
                f"{name} on the siren and the Hilux finally pulls over."
                if loud
                else f"{name}'s siren was more of a polite cough. Still stuck behind the Hilux."
            ),
            c["who"],
        )

    def ev_view(self, room: Room) -> dict | None:
        c = self.cur
        if not c:
            return None
        name, text = T.EVENTS[c["k"]]
        who = room.riders.get(c["who"])
        if c["k"] == "hump" and room.el < c["t"] + c["dur"] / 2:
            text = T.HUMP_WARN
        return {
            "k": c["k"],
            "name": name,
            "text": text.format(name=who.name if who else ""),
            "left": round(max(0.0, c["t"] + c["dur"] - room.el), 1),
            "who": c["who"],
        }

    def bot(self, room: Room, r: Rider, w: float, tgt: float | None, rng: random.Random) -> float:
        """Bot characters: Smooth sits dead on target, Twitchy spikes, Lead Foot speeds in the roadworks."""
        kind = G.AMBO_BOTS[C.BOT_NAMES.index(r.name) % len(G.AMBO_BOTS)] if r.name in C.BOT_NAMES else ""
        if kind == "smooth":
            return tgt or w
        if kind == "twitchy" and rng.random() < G.AMBO_TWITCH_PER_S / C.TICK_HZ:
            return w * G.AMBO_TWITCH_X
        if kind == "leadfoot" and self.cur and self.cur["k"] == "roadworks":
            return r.ftp * G.AMBO_LEADFOOT_X
        return w

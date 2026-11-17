"""Zombie Bus crew play: rolling turns, crew roles, zombie types and the boss fight."""

from __future__ import annotations

import random
import statistics
from typing import TYPE_CHECKING

from .. import config as C
from ..plan import event_for

if TYPE_CHECKING:
    from ..session import Rider, Room


class CrewPlay:
    """Mixed into `ZombieBus`, which holds the state."""

    def turns(self, room: Room, active: list[Rider], ev: str) -> None:
        """Rolling turns, a team move: each rider takes the front for FRONT_S; a clean turn gains metres."""
        if len(active) < 2 or ev in C.FELL_FREE_EVENTS:
            self.front = None
            return
        f = self.front
        r = room.riders.get(f["id"]) if f else None
        if f and r in active and room.el - f["t"] < C.FRONT_S:
            if r.s is not None:
                f["s"], f["n"] = f["s"] + r.s, f["n"] + 1
            return
        order = sorted(a.id for a in active)
        nxt = order[(order.index(f["id"]) + 1) % len(order)] if f and f["id"] in order else order[0]
        name = room.riders[nxt].name
        if f and r in active and f["n"] and f["s"] / f["n"] >= C.FRONT_CLEAN:
            self.gap += C.FRONT_GAP
            self.emit(
                "turn", f"{r.name} did a clean turn on the front (+{C.FRONT_GAP} m). {name}, you're up.", nxt
            )
        else:
            self.emit("turn", f"{name}, take the front.", nxt)
        self.front = {"id": nxt, "t": room.el, "s": 0.0, "n": 0}

    def role_tick(self, room: Room, active: list[Rider], ev: str, dt: float) -> None:
        """Crew roles: each rider's ability fires by itself once they hold its cue, then cools down."""
        for n, rid in enumerate(sorted(room.riders)):
            self.roles.setdefault(rid, {"role": list(C.ROLES)[n % len(C.ROLES)], "held": 0.0, "ready": 0.0})
        if ev in C.ROLE_QUIET:
            return
        for r in active:
            st = self.roles[r.id]
            role = C.ROLES[st["role"]]
            cue = {
                "spin": r.cad >= role.get("rpm", 0),
                "grind": 0 < r.cad <= role.get("rpm", 0),
                "target": (r.s or 0) >= role.get("s", 1),
            }[role["cue"]]
            st["held"] = st["held"] + dt if cue and room.el >= st["ready"] else 0.0
            if st["held"] < role["hold"]:
                continue
            st["held"], st["ready"] = 0.0, room.el + C.ROLE_CD
            self.gap += role.get("gap", 0)
            self.armour = min(100.0, self.armour + role.get("armour", 0))
            self.emit("role", f"{r.name}, {role['name'].lower()}: {role['done']}", r.id)

    def zed_pull(self, ev: str, active: list[Rider], comp: float) -> float:
        """Metres a second the event's zombie type gains when the crew rides the way it hunts: runners chase a
        low cadence, brutes a crew off target."""
        z = C.ZED_TYPES.get(ev)
        if not z or not active:
            return 0.0
        if z["kind"] == "runners":
            weak = statistics.fmean(r.cad for r in active) < z["rpm"]
        else:
            weak = comp < z["comp"]
        return z["pull"] if weak else 0.0

    def pick_boss(self, room: Room) -> dict:
        """The ride's last long effort before the cool-down is the boss; which boss is drawn for the room."""
        blocks = room.plan["blocks"]
        fights = [j for j in range(1, len(blocks) - 1) if event_for(blocks, j) in C.BOSS_EVENTS]
        if not fights:
            return {"i": -1, "over": True}
        i = fights[-1]
        kind = random.Random(f"{room.code}:boss").choice(sorted(C.BOSSES))
        return {"i": i, "kind": kind, "need": blocks[i]["dur"] * C.BOSS_SHARE, "done": 0.0}

    def end_boss(self) -> None:
        """The boss block is over: beaten for armour, or it lands its blow."""
        b, boss = self.boss, C.BOSSES[self.boss["kind"]]
        b["over"] = True
        if b["done"] >= b["need"]:
            self.armour = min(100.0, self.armour + C.BOSS_ARMOUR)
            self.emit("bosswin", boss["win"])
        else:
            self.damage(C.BOSS_HIT, boss["lose"])

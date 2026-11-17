"""Zombie Bus boosts: personal challenges, nitro, clean-riding streaks and roadblock sprints."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config as C

if TYPE_CHECKING:
    from ..session import Rider, Room


class Boosts:
    """Mixed into `ZombieBus`, which holds the state."""

    def run_challenge(self, room: Room, active: list[Rider], ev: str) -> None:
        """Hands one human rider a 20 s cadence drill now and then; cheers them if they hold it."""
        ch = self.challenge
        if ch:
            r = room.riders.get(ch["id"])
            limit = C.CHALLENGES[ch["kind"]][0]
            cad = r.cad if r and r.st == "riding" else 0
            ch["ok"] += (cad >= limit) if ch["kind"] == "spin" else (0 < cad <= limit)
            ch["n"] += 1
            if room.el < ch["until"]:
                return
            self.challenge = None
            self.next_challenge = room.el + random.randint(*C.CHALLENGE_EVERY_S)
            name = r.name if r else "Someone"
            if ch["ok"] / ch["n"] >= C.CHALLENGE_PASS:
                self.emit("challenge_won", f"{name} nailed it!", ch["id"])
            else:
                self.emit("challenge_lost", f"{name} fluffed the challenge.", ch["id"])
            return
        humans = [r for r in active if not r.bot and r.cad > 0]
        if room.el < self.next_challenge or ev not in C.CHALLENGE_EVENTS or not humans:
            return
        r, kind = random.choice(humans), random.choice(list(C.CHALLENGES))
        self.challenge = {"id": r.id, "kind": kind, "until": room.el + C.CHALLENGE_S, "ok": 0, "n": 0}
        self.emit("challenge", f"{r.name}: {C.CHALLENGES[kind][1]} for {C.CHALLENGE_S} s", r.id)

    def charge_nitro(self, room: Room, comp: float, ev: str, dt: float, riding: bool) -> bool:
        """Charges or drains the nitro and fires it when full. Returns True while boosting."""
        if room.el < self.nitro_until:
            return True
        if riding and ev in C.NITRO_EVENTS and comp >= C.NITRO_MIN:
            self.nitro += dt / C.NITRO_CHARGE_S * self.mut.get("nitro", 1)
        else:
            self.nitro = max(0.0, self.nitro - dt / C.NITRO_DECAY_S)
        if self.nitro >= 1:
            self.nitro, self.nitro_until = 0.0, room.el + C.NITRO_S
            self.emit("nitro", "NITRO! Perfect riding lit the afterburner.")
            return True
        return False

    def run_streak(self, room: Room, comp: float, ev: str, dt: float, riding: bool) -> None:
        """Counts unbroken clean riding and pays out air support. A fall or a lapse resets it."""
        if room.el < self.gunship_until:
            self.gap += C.GUNSHIP_GAP * dt if riding else 0
            return
        if any(r.st == "fell" for r in room.riders.values()):
            self.streak, self.streak_n, self.streak_low = 0.0, 0, 0.0
            return
        if not riding or ev not in C.STREAK_EVENTS:
            return
        if comp < C.STREAK_MIN:
            self.streak_low += dt
            if self.streak_low >= C.STREAK_GRACE_S:
                self.streak, self.streak_n = 0.0, 0
            return
        self.streak_low = 0.0
        self.streak += dt
        need, kind = C.STREAKS[self.streak_n]
        if self.streak < need:
            return
        self.streak_n += 1
        if kind == "drop":
            self.emit("drop", f"{need} s streak: supply drop!")
        elif kind == "airstrike":
            self.gap += C.AIRSTRIKE_GAP
            self.emit("airstrike", f"{need} s streak: air strike on the horde! +{C.AIRSTRIKE_GAP} m")
        else:
            self.streak, self.streak_n = 0.0, 0
            self.gunship_until = room.el + C.GUNSHIP_S
            self.emit("gunship", f"{need} s streak: the crew is up in the gunship for {C.GUNSHIP_S} s!")

    def on_sprint(self, r: Rider, blk: int, grade: str, combo: int) -> None:
        """Applies one rider's sprint grade to the current roadblock."""
        r.sprints.append(grade)
        rb = self.rb
        if not rb or rb["blk"] != blk or r.id in rb["reported"]:
            return
        rb["reported"].add(r.id)
        if grade != "FAIL":
            rb["landed"].add(r.id)
        mult = 1 + C.COMBO_STEP * max(0, combo - 1)
        self.combo = max(self.combo, combo)
        dmg = C.RB_DAMAGE[grade] * mult * (C.RAM_MULT if self.ram else 1)
        rb["dmg"] += dmg
        r.rb_dmg += dmg
        combo_txt = f" (combo x{combo})" if combo > 1 else ""
        if grade == "FAIL":
            self.gap -= C.RB_FAIL_GAP
            self.damage(C.RB_FAIL_ARMOUR, f"{r.name} FAILED the sprint. Zombies got a grab!")
        elif grade in ("MEGA", "LEGEND"):
            r.mega += 1
            self.emit("slowmo", f"{r.name}: {grade}!{combo_txt}", r.id)
        else:
            self.emit("sprint", f"{r.name}: {grade}{combo_txt}", r.id)

    def resolve_roadblock(self) -> None:
        rb, self.rb, self.ram = self.rb, None, False
        assert rb
        if rb["dmg"] >= rb["hp"]:
            self.gap += C.RB_SMASH_GAP
            self.emit("smash", "Roadblock SMASHED!")
            # A team move: every rider on the bus landed their sprint, so the harpoon drags the bus clear.
            if len(rb["expect"]) > 1 and rb["expect"] <= rb["landed"]:
                self.gap += C.HARPOON_GAP
                self.emit("harpoon", f"Everyone sprinted together: HARPOON! +{C.HARPOON_GAP} m on the horde")
        else:
            self.damage(C.RB_CRASH_ARMOUR, "Ploughed through the roadblock. Ouch.")
            self.emit("crash")

    def rb_progress(self, room: Room, i: int, bel: float) -> float | None:
        if not self.rb:
            return None
        return min(1.0, bel / self.rb["dur"]) if i == self.rb["blk"] else 1.0

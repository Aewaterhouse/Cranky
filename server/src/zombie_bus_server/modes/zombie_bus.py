"""Zombie Bus rules: group compliance drives the bus, the horde chases, events map from plan blocks."""

from __future__ import annotations

import copy
import random
import statistics
from datetime import date
from typing import TYPE_CHECKING

from .. import config as C
from ..plan import is_over

if TYPE_CHECKING:
    from ..session import Rider, Room


def weekly_mutator(today: date | None = None) -> dict:
    """This ISO week's mutator."""
    week = (today or date.today()).isocalendar().week
    return C.MUTATORS[week % len(C.MUTATORS)]


class ZombieBus:
    """Bus state for one ride. `tick` runs at TICK_HZ; `on_sprint` applies sprint grades."""

    def __init__(self, level: str = "normal", mutator: dict | None = None) -> None:
        self.level = level
        self.mut = (mutator or {}) if level != "easy" else {}
        self.speed = 0.0
        self.nitro = 0.0
        self.challenge: dict | None = None
        self.next_challenge = float(random.randint(*C.CHALLENGE_EVERY_S))
        self.nitro_until = -1.0
        self.dist = 0.0
        self.armour = float(self.mut.get("armour", 100))
        self.gap = float(C.GAP_START)
        self.scrap = 0.0
        self.sync = False
        self.tune = False
        self.sync_s = 0.0
        self.sync_ticks = 0
        self.ticks = 0
        self.combo = 0
        self.rb: dict | None = None
        self.last_i = -1
        self.over: dict | None = None
        self.hauls: dict[str, dict] = {}
        self.fx: list[dict] = []
        self.ev = ""
        self.repel = 0
        self.syncw = 0
        self.streak = 0.0
        self.streak_n = 0
        self.streak_low = 0.0
        self.gunship_until = -1.0

    def to_dict(self) -> dict:
        """JSON-safe copy of all state (the roadblock's rider sets become sorted lists)."""
        d = copy.deepcopy(vars(self))
        for k in ("expect", "reported"):
            if d["rb"]:
                d["rb"][k] = sorted(d["rb"][k])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> ZombieBus:
        bus = cls()
        vars(bus).update(copy.deepcopy(d))
        for k in ("expect", "reported"):
            if bus.rb:
                bus.rb[k] = set(bus.rb[k])
        return bus

    def emit(self, k: str, text: str | None = None, rid: str | None = None) -> None:
        self.fx.append({"k": k, "text": text, "id": rid})

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        """Advances the bus by `dt` seconds in block `i` (event `ev`). Returns fx since the last tick."""
        b = room.plan["blocks"][i]
        self.ev = ev
        if i != self.last_i:
            self.block_change(room, i, b, ev)
        active = [r for r in room.riders.values() if r.st == "riding"]
        self.fell_off(room, active, dt)
        active = [r for r in active if r.st == "riding"]
        comp = statistics.fmean([r.s if r.s is not None else 1.0 for r in active]) if active else 0.0
        for r in active:
            if r.s is not None:
                r.comp_sum += r.s
                r.comp_n += 1
                r.band_s += dt if r.s >= 0.999 else 0
        self.hauling(room, active, dt)
        self.cadence_sync(active, dt)

        self.run_challenge(room, active, ev)
        boost = self.charge_nitro(room, comp, ev, dt, bool(active))
        self.run_streak(room, comp, ev, dt, bool(active))
        self.speed = (C.V_MIN + (C.V_MAX - C.V_MIN) * comp) * (C.TUNE_MULT if self.tune else 1)
        self.speed *= C.NITRO_SPEED if boost else 1
        self.gap += C.NITRO_GAP * dt if boost else 0
        self.speed *= C.LIMP_MULT if self.armour <= 0 else 1
        self.dist += self.speed * dt
        self.scrap += self.speed * dt * C.SCRAP_PER_M * self.mut.get("scrap", 1)
        neutral = C.NEUTRAL[ev]
        if ev == "longhaul":
            neutral += min(C.LONGHAUL_CREEP_MAX, C.LONGHAUL_CREEP * bel / 60)
        if ev == "surge":
            neutral = self.surge(b, bel, comp, neutral)
        if neutral is not None and active:
            neutral += C.DIFFICULTY[self.level]["neutral"]
            k = C.GAP_K_AWAY if comp > neutral else C.GAP_K
            creep = C.DIFFICULTY[self.level]["creep"]
            self.gap += (k * (comp - neutral) - creep + (C.TUNE_GAP_BONUS if self.tune else 0)) * dt
        self.gap = min(C.GAP_MAX, self.gap)
        if self.gap <= 0:
            self.gap = 0
            if self.armour > 0:
                self.damage(C.HIT_DAMAGE, "The horde caught the bus!")
                self.gap = C.HIT_KNOCKBACK
        if self.rb and room.el >= self.rb["deadline"] or self.rb and self.rb["expect"] <= self.rb["reported"]:
            self.resolve_roadblock()
        fx, self.fx = self.fx, []
        return fx

    def run_challenge(self, room: Room, active: list[Rider], ev: str) -> None:
        """Hands one human rider a 20 s cadence drill now and then; pays scrap if they hold it."""
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
                self.scrap += C.CHALLENGE_SCRAP
                self.emit("challenge_won", f"{name} nailed it! +{C.CHALLENGE_SCRAP} scrap", ch["id"])
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
            self.scrap += C.NITRO_SCRAP
            self.emit("nitro", f"NITRO! Perfect riding lit the afterburner. +{C.NITRO_SCRAP} scrap")
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
            self.scrap += C.DROP_SCRAP
            self.emit("drop", f"{need} s streak: supply drop! +{C.DROP_SCRAP} scrap")
        elif kind == "airstrike":
            self.gap += C.AIRSTRIKE_GAP
            self.emit("airstrike", f"{need} s streak: air strike on the horde! +{C.AIRSTRIKE_GAP} m")
        else:
            self.streak, self.streak_n = 0.0, 0
            self.gunship_until = room.el + C.GUNSHIP_S
            self.emit("gunship", f"{need} s streak: the crew is up in the gunship for {C.GUNSHIP_S} s!")

    def block_change(self, room: Room, i: int, b: dict, ev: str) -> None:
        if self.rb:
            self.rb["deadline"] = min(self.rb["deadline"], room.el + C.RB_GRACE_S)
        self.last_i = i
        self.over = None
        if ev == "roadblock":
            ids = {r.id for r in room.riders.values() if r.st == "riding"}
            self.rb = {
                "blk": i,
                "hp": C.RB_HP_PER_RIDER * max(1, len(ids)),
                "dmg": 0.0,
                "dur": b["dur"],
                "deadline": room.el + b["dur"] + C.RB_GRACE_S,
                "expect": ids,
                "reported": set(),
            }
            self.emit("roadblock", "ROADBLOCK! Sprint to smash it!")
        elif ev == "servo":
            self.emit("servo", f"Servo stop! {int(self.scrap)} scrap in the tin. Shop's open.")
        elif ev == "surge":
            self.emit("surge", "HORDE SURGE! Clean overs shake them off.")
        elif ev == "longhaul":
            self.emit("longhaul", "Long haul. Hold your zone.")
        elif ev == "rampup":
            self.emit("rampup", "Ramp-up! Climb out of the valley, it only gets harder.")

    def damage(self, n: float, text: str) -> None:
        if self.repel > 0:
            self.repel -= 1
            self.emit("repel", "Horde repellent! Zombies sprayed off, no damage.")
            return
        self.armour = max(
            0.0, self.armour - n * C.DIFFICULTY[self.level]["damage"] * self.mut.get("damage", 1)
        )
        self.emit("hit", text if self.armour > 0 else "Armour gone! Limping on...")

    def surge(self, b: dict, bel: float, comp: float, neutral: float) -> float:
        """Grab at the start of each under, shake off after each clean over. Returns the neutral."""
        over = is_over(b, bel)
        if self.over is None or self.over["on"] != over:
            if self.over and self.over["on"] and self.over["n"]:
                if self.over["sum"] / self.over["n"] >= C.SHAKE_COMPLIANCE:
                    self.gap += C.SHAKE_GAP
                    self.scrap += C.SHAKE_SCRAP
                    self.emit("shake", "Clean over! Shook them off.")
            if not over:
                self.gap -= C.SURGE_GRAB
                self.emit("grab", "Zombies grabbed the bus!")
            self.over = {"on": over, "sum": 0.0, "n": 0}
        self.over["sum"] += comp
        self.over["n"] += 1
        return neutral if over else C.SURGE_UNDER_NEUTRAL

    def fell_off(self, room: Room, active: list[Rider], dt: float) -> None:
        for r in active:
            if r.s is None:
                continue
            r.low_s = r.low_s + dt if r.s < C.DIFFICULTY[self.level]["fell"] else 0.0
            if r.low_s >= C.FELL_AFTER_S and room.el >= r.fell_cool_until:
                r.low_s = 0.0
                r.falls += 1
                r.st = "fell"
                if r.tier != "easy":
                    r.tier = C.TIERS[C.TIERS.index(r.tier) + 1]
                self.hauls[r.id] = {"until": room.el + C.HAUL_S, "sum": 0.0, "n": 0}
                self.emit(
                    "fell",
                    f"{r.name} fell off the bus! Dropped to {r.tier}. "
                    f"Everyone else's targets go up {round(C.FELL_LOAD * 100)}% until they are hauled back!",
                    r.id,
                )

    def hauling(self, room: Room, active: list[Rider], dt: float) -> None:
        for rid, h in list(self.hauls.items()):
            others = [r.s if r.s is not None else 1.0 for r in active if r.id != rid]
            h["sum"] += statistics.fmean(others) if others else 0.0
            h["n"] += 1
            if room.el < h["until"]:
                continue
            del self.hauls[rid]
            r = room.riders[rid]
            r.fell_cool_until = room.el + C.FELL_COOLDOWN_S
            if r.st == "fell":
                r.st = "riding"
            if others and h["sum"] / h["n"] >= C.HAUL_MIN:
                self.scrap += C.HAUL_SCRAP
                self.emit("hauled", f"Crew hauled {r.name} back aboard! +{C.HAUL_SCRAP} scrap", rid)
            else:
                self.emit("hauled", f"{r.name} clambered back on.", rid)

    def cadence_sync(self, active: list[Rider], dt: float) -> None:
        cads = [r.cad for r in active if r.cad >= C.SYNC_MIN_CADENCE]
        self.ticks += 1
        self.sync = len(active) >= 2 and len(cads) == len(active)
        if self.sync:
            med = statistics.median(cads)
            for r in active:
                r.sync_n += 1
                r.sync_hits += abs(r.cad - med) <= C.SYNC_RPM + self.syncw
            self.sync = all(abs(c - med) <= C.SYNC_RPM + self.syncw for c in cads)
        self.sync_ticks += self.sync
        self.sync_s = self.sync_s + dt if self.sync else 0.0
        tune = self.sync_s >= C.SYNC_HOLD_S
        if tune and not self.tune:
            self.emit("tune", f"Engine in tune! x{C.TUNE_MULT} speed")
        self.tune = tune

    def buy(self, r: Rider, item: str) -> None:
        """Servo Stop shop: session-only upgrades paid from the bus scrap tin."""
        cost = C.SHOP[item]
        if self.ev != "servo" or self.scrap < cost or self.mut.get("no_shop"):
            return
        self.scrap -= cost
        if item == "plating":
            self.armour = min(100.0, self.armour + C.PLATING_ARMOUR)
            text = f"{r.name} bolted on armour plating (+{C.PLATING_ARMOUR})"
        elif item == "repellent":
            self.repel += 1
            text = f"{r.name} bought horde repellent (one free fail)"
        else:
            self.syncw += C.SYNC_WIDEN_RPM
            text = f"{r.name} tuned the carby: sync window ±{C.SYNC_RPM + self.syncw} rpm"
        self.emit("buy", text, r.id)

    def on_sprint(self, r: Rider, blk: int, grade: str, combo: int) -> None:
        """Applies one rider's sprint grade to the current roadblock."""
        r.sprints.append(grade)
        rb = self.rb
        if not rb or rb["blk"] != blk or r.id in rb["reported"]:
            return
        rb["reported"].add(r.id)
        mult = 1 + C.COMBO_STEP * max(0, combo - 1)
        self.combo = max(self.combo, combo)
        dmg = C.RB_DAMAGE[grade] * mult
        rb["dmg"] += dmg
        r.rb_dmg += dmg
        self.scrap += C.RB_SCRAP[grade] * mult
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
        rb, self.rb = self.rb, None
        assert rb
        if rb["dmg"] >= rb["hp"]:
            self.scrap += C.RB_SMASH_SCRAP
            self.gap += C.RB_SMASH_GAP
            self.emit("smash", f"Roadblock SMASHED! +{C.RB_SMASH_SCRAP} scrap")
        else:
            self.damage(C.RB_CRASH_ARMOUR, "Ploughed through the roadblock. Ouch.")
            self.emit("crash")

    def rb_progress(self, room: Room, i: int, bel: float) -> float | None:
        if not self.rb:
            return None
        return min(1.0, bel / self.rb["dur"]) if i == self.rb["blk"] else 1.0

    def state(self, room: Room, i: int, bel: float) -> dict:
        return {
            "speed": round(self.speed, 2),
            "dist": round(self.dist),
            "armour": round(self.armour, 1),
            "gap": round(self.gap, 1),
            "scrap": int(self.scrap),
            "sync": self.sync,
            "tune": self.tune,
            "rb": self.rb_progress(room, i, bel),
            "combo": self.combo,
            "nitro": round(self.nitro, 2),
            "boost": room.el < self.nitro_until,
            "shop": self.ev == "servo" and not self.mut.get("no_shop"),
            "repel": self.repel,
            "syncw": self.syncw,
            "streak": round(min(1.0, self.streak / C.STREAKS[self.streak_n][0]), 2),
            "next": C.STREAKS[self.streak_n][1],
            "gunship": room.el < self.gunship_until,
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp = {r.id: r.comp_sum / r.comp_n if r.comp_n else 0.0 for r in rs}
        awards = []

        def award(name: str, key, why, need=lambda v: v > 0) -> None:
            best = max(rs, key=key, default=None)
            if best and need(key(best)):
                awards.append({"award": name, "id": best.id, "name": best.name, "why": why(best)})

        award("Iron Lungs", lambda r: comp[r.id], lambda r: f"{comp[r.id]:.0%} compliance")
        award("Fell Off King", lambda r: r.falls, lambda r: f"fell off {r.falls}x")
        award("Roadblock MVP", lambda r: r.rb_dmg, lambda r: f"{int(r.rb_dmg)} roadblock damage")
        award(
            "Sync Master",
            lambda r: r.sync_hits / r.sync_n if r.sync_n else 0,
            lambda r: f"{r.sync_hits / r.sync_n:.0%} in sync",
        )
        award("PR Hunter", lambda r: r.mega, lambda r: f"{r.mega} MEGA+ sprints")
        score = round(
            (self.dist / 10 * (0.5 + self.armour / 200) + self.scrap) * C.DIFFICULTY[self.level]["score"]
        )
        return {
            "distance": round(self.dist),
            "armour": round(self.armour),
            "gap": round(self.gap),
            "scrap": int(self.scrap),
            "score": score,
            "difficulty": self.level,
            "syncPct": round(100 * self.sync_ticks / self.ticks) if self.ticks else 0,
            "riders": [
                {
                    "id": r.id,
                    "name": r.name,
                    "compliance": round(comp[r.id], 3),
                    "inBandSecs": round(r.band_s),
                    "sprints": r.sprints,
                    "falls": r.falls,
                    "kj": round(r.rs_joules / 1000, 1),
                    "bot": r.bot,
                }
                for r in rs
            ],
            "awards": awards,
        }

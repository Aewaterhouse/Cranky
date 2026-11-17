"""Zombie Bus rules: group compliance drives the bus, the horde chases, events map from plan blocks."""

from __future__ import annotations

import copy
import random
import statistics
from datetime import date
from typing import TYPE_CHECKING

from .. import config as C
from ..plan import is_over
from .bus_boost import Boosts
from .bus_crew import CrewPlay
from .bus_servo import Servo
from .bus_view import BusView
from .common import CrewGame, tally

if TYPE_CHECKING:
    from ..session import Rider, Room


def roll_weather(rng: random.Random) -> str:
    """A ride's weather, mostly clear: each kind with its weight in `config.WEATHER`."""
    kinds = list(C.WEATHER)
    return rng.choices(kinds, [C.WEATHER[k]["weight"] for k in kinds])[0]


def weekly_mutator(today: date | None = None) -> dict:
    """This ISO week's twist for the bus."""
    return C.MUTATORS[(today or date.today()).isocalendar().week % len(C.MUTATORS)]


class ZombieBus(Boosts, BusView, Servo, CrewPlay, CrewGame):
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
        self.boss: dict | None = None  # the final fight: {i, kind, need (s on target), done}
        self.roles: dict[str, dict] = {}  # rider -> {role, held (s on the cue), ready (ride time)}
        self.highlights: list[dict] = []  # the ride's best moments for the results: {t (ride s), text}
        self.clock = 0.0
        self.whisker = False  # the horde got within a whisker and has not been shaken off yet
        self.weather = "clear"  # rolled by the room as the ride starts (`roll_weather`)
        self.front: dict | None = None  # rolling turns: {id, t (turn start), s (compliance sum), n}
        self.road_votes: dict[str, str] = {}  # the next leg, voted at the servo
        self.leg: dict = {}  # the leg the crew picked: its damage multiplier until the next stop
        self.streak = 0.0
        self.streak_n = 0
        self.streak_low = 0.0
        self.gunship_until = -1.0

    def to_dict(self) -> dict:
        """JSON-safe copy of all state (the roadblock's rider sets become sorted lists)."""
        d = copy.deepcopy(vars(self))
        for k in ("expect", "reported", "landed"):
            if d["rb"]:
                d["rb"][k] = sorted(d["rb"][k])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> ZombieBus:
        bus = cls()
        # Keys from removed features (the servo shop's upgrades) are left out, unread.
        vars(bus).update({k: v for k, v in copy.deepcopy(d).items() if k in vars(bus)})
        for k in ("expect", "reported", "landed"):
            if bus.rb:
                bus.rb[k] = set(bus.rb.get(k, []))
        return bus

    def emit(self, k: str, text: str | None = None, rid: str | None = None) -> None:
        self.fx.append({"k": k, "text": text, "id": rid})
        if k in C.HIGHLIGHTS and text and len(self.highlights) < C.HIGHLIGHT_MAX:
            self.highlights.append({"t": round(self.clock), "text": text})

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        """Advances the bus by `dt` seconds in block `i` (event `ev`). Returns fx since the last tick."""
        b = room.plan["blocks"][i]
        self.clock = room.el
        if self.ev == "servo" and ev != "servo":
            self.pick_leg(room)
        self.ev = ev
        if i != self.last_i:
            self.block_change(room, i, b, ev)
        active = [r for r in room.riders.values() if r.st == "riding"]
        # No falling off while ERG is still ramping (the start, a new block) or in the warm-up and cool-down.
        if room.el >= C.FELL_GRACE_S and bel >= C.FELL_STEP_GRACE_S and ev not in C.FELL_FREE_EVENTS:
            self.fell_off(room, active, dt)
        active = [r for r in active if r.st == "riding"]
        comp = statistics.fmean([r.s if r.s is not None else 1.0 for r in active]) if active else 0.0
        tally(active, dt)
        self.hauling(room, active, dt)
        self.turns(room, active, ev)
        self.role_tick(room, active, ev, dt)
        if self.boss and self.boss["i"] == i and not self.boss.get("over"):
            self.boss["done"] += comp * dt
        self.cadence_sync(active, dt)

        self.run_challenge(room, active, ev)
        boost = self.charge_nitro(room, comp, ev, dt, bool(active))
        self.run_streak(room, comp, ev, dt, bool(active))
        self.speed = (C.V_MIN + (C.V_MAX - C.V_MIN) * comp) * (C.TUNE_MULT if self.tune else 1)
        self.speed *= C.NITRO_SPEED if boost else 1
        self.gap += C.NITRO_GAP * dt if boost else 0
        self.speed *= C.LIMP_MULT if self.armour <= 0 else 1
        self.dist += self.speed * dt
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
        self.gap -= self.zed_pull(ev, active, comp) * dt
        self.gap = min(C.GAP_MAX, self.gap)
        if 0 < self.gap < C.WHISKER[0]:
            self.whisker = True
        elif self.whisker and self.gap > C.WHISKER[1]:
            self.whisker = False
            self.emit("escape", "Escaped the horde by a whisker!")
        if self.gap <= 0:
            self.whisker = False
            self.gap = 0
            if self.armour > 0:
                self.damage(C.HIT_DAMAGE, "The horde caught the bus!")
                self.gap = C.HIT_KNOCKBACK
        if self.rb and room.el >= self.rb["deadline"] or self.rb and self.rb["expect"] <= self.rb["reported"]:
            self.resolve_roadblock()
        fx, self.fx = self.fx, []
        return fx

    def block_change(self, room: Room, i: int, b: dict, ev: str) -> None:
        if self.boss and self.last_i == self.boss["i"] and not self.boss.get("over"):
            self.end_boss()
        if self.boss is None:
            self.boss = self.pick_boss(room)
        if self.boss and i == self.boss["i"]:
            self.emit("boss", C.BOSSES[self.boss["kind"]]["start"])
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
                "landed": set(),  # riders whose sprint was HIT or better: all of them fires the harpoon
            }
            self.emit("roadblock", "ROADBLOCK! Sprint to smash it!")
        elif ev == "servo":
            rng = random.Random(f"{room.code}:{i}")
            self.road_votes = {r.id: rng.choice(list(C.LEGS)) for r in room.riders.values() if r.bot}
            self.emit("servo", "Servo stop! Vote which way next.")
        elif ev == "surge":
            self.emit("surge", "HORDE SURGE! Clean overs shake them off.")
        elif ev == "longhaul":
            self.emit("longhaul", "Long haul. Hold your zone.")
        elif ev == "rampup":
            self.emit("rampup", "Ramp-up! Climb out of the valley, it only gets harder.")

    def damage(self, n: float, text: str) -> None:
        self.armour = max(
            0.0,
            self.armour
            - n
            * C.DIFFICULTY[self.level]["damage"]
            * self.mut.get("damage", 1)
            * self.leg.get("damage", 1)
            * C.WEATHER[self.weather].get("damage", 1),
        )
        self.emit("hit", text if self.armour > 0 else "Armour gone! Limping on...")

    def surge(self, b: dict, bel: float, comp: float, neutral: float) -> float:
        """Grab at the start of each under, shake off after each clean over. Returns the neutral."""
        over = is_over(b, bel)
        if self.over is None or self.over["on"] != over:
            if self.over and self.over["on"] and self.over["n"]:
                if self.over["sum"] / self.over["n"] >= C.SHAKE_COMPLIANCE:
                    self.gap += C.SHAKE_GAP
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
                self.emit("hauled", f"Crew hauled {r.name} back aboard!", rid)
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
                r.sync_hits += abs(r.cad - med) <= C.SYNC_RPM
            self.sync = all(abs(c - med) <= C.SYNC_RPM for c in cads)
        self.sync_ticks += self.sync
        self.sync_s = self.sync_s + dt if self.sync else 0.0
        tune = self.sync_s >= C.SYNC_HOLD_S
        if tune and not self.tune:
            self.emit("tune", f"Engine in tune! x{C.TUNE_MULT} speed")
        self.tune = tune

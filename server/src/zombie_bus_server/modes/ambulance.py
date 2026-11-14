"""Kidney Stone Express rules: crew power drives an ambulance; smooth power keeps the patient comfortable."""

from __future__ import annotations

import random
from statistics import fmean
from typing import TYPE_CHECKING

from .. import config as C
from .. import config_games as G
from . import ambulance_text as T
from . import script
from .ambulance_events import RoadEvents
from .ambulance_view import PATIENTS, AmboView
from .common import Band, CrewGame, tally
from .script import Seg

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

DT = 1 / C.TICK_HZ
V = G.AMBO_KMH_AT_FTP / 3.6  # metres a second with the whole crew at FTP


def mid(b: tuple[float, float]) -> float:
    return (b[0] + b[1]) / 2


def rx(pid: str, t: float) -> tuple[float, float]:
    """The patient's prescription `t` unscaled seconds into their run."""
    p = PATIENTS[pid]
    lead = p.get("lead")
    if lead:
        if t < lead[0]:
            return lead[1:]
        t -= lead[0]
    t %= sum(c[0] for c in p["cycle"])
    for secs, lo, hi in p["cycle"]:
        if t < secs:
            return lo, hi
        t -= secs
    return p["cycle"][-1][1:]


class Ambulance(RoadEvents, AmboView, CrewGame):
    """One shift. The run in progress is `open` from pick-up until the patient is delivered or walks."""

    no_erg = True

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.seed, self.events, self.ev_n, self.cur, self.last_i = 0, [], 0, None, -1
        self.sm: dict[str, float] = {}  # each rider's smoothed watts
        self.mids: dict[str, float | None] = {}  # the middle of the band each rider last had
        self.grace: dict[str, float] = {}  # roughness is forgiven until this ride time
        self.rough: dict[str, list[float]] = {}  # [sum of jerk, samples] in steady riding
        self.spikes: dict[str, int] = {}
        self.spiking: dict[str, bool] = {}
        self.fines: dict[str, int] = {}
        self.run, self.pid, self.open, self.gone, self.fell = 0, None, False, False, False
        self.comfort, self.total, self.left, self.brake_m, self.run_end = 100.0, 0.0, 0.0, 0.0, 0.0
        self.arrived: float | None = None
        self.rev = self.queue_until = self.free_until = self.sweet = 0.0
        self.hurt_at = -99.0
        self.good, self.perk = True, None
        self.reviews: list[dict] = []
        self.score = 0

    @classmethod
    def deal(cls, minutes: int) -> dict:
        """The shift: base station, five patients (the easiest first) with ramping between, the drive home."""
        rest = [p for p in PATIENTS if p != G.AMBO_FIRST]
        order = [G.AMBO_FIRST, *random.sample(rest, len(rest))]
        segs = [Seg("Base station", G.AMBO_BASE_S, "base", ("say",))]
        for n, pid in enumerate(order):
            segs.append(Seg(PATIENTS[pid]["name"], G.AMBO_RUN_S, "run", cls.run_events(pid)))
            if n < len(order) - 1:
                segs.append(Seg("Hospital ramping", G.AMBO_RAMP_S, "ramp", ("say",)))
        segs.append(Seg("Drive home", G.AMBO_COOL_S, "cool", ("say",)))
        plan = script.plan("ambo", "Kidney Stone Express", segs)
        for b, pid in zip([b for b in plan["blocks"] if b["kind"] == "run"], order, strict=True):
            b["patient"] = pid
        plan["desc"] = "Five patients across South East Queensland. No ERG: your gears, your problem."
        return plan

    def begin(self, room: Room) -> None:
        self.seed = random.randrange(2**31)
        self.events = script.schedule(room.plan, self.seed, G.AMBO_EVENT_S)

    def rng(self, *tag: object) -> random.Random:
        return random.Random(f"{self.seed}:{tag}")

    # --- the script -------------------------------------------------------------------------------------

    def sync(self, room: Room, i: int) -> None:
        """Handles a change of block: a late arrival, the next pick-up, the length of the queue."""
        if i == self.last_i or i < 0:
            return
        self.last_i = i
        blocks, k = room.plan["blocks"], room.plan.get("scale", 1.0)
        start = sum(b["dur"] for b in blocks[:i])
        if self.open and self.rev <= 0:  # the block ran out before the hospital did
            self.deliver(room, -self.left / (V * 0.8) / k)
        b = blocks[i]
        if b["kind"] == "run":
            self.run, self.pid, self.open, self.gone, self.fell = (
                self.run + 1,
                b["patient"],
                True,
                False,
                False,
            )
            self.comfort, self.arrived, self.sweet, self.cur = 100.0, None, 0.0, None
            self.total, self.brake_m = self.par(room, i, start)
            self.left, self.run_end = self.total, start + b["dur"]
            self.emit("say", f"New job: {PATIENTS[self.pid]['name']}. {T.CALM[self.pid][0]}")
        elif b["kind"] == "ramp":
            self.queue_until = start + (G.AMBO_RAMP_GOOD_S if self.good else G.AMBO_RAMP_S) * k

    def par(self, room: Room, i: int, start: float) -> tuple[float, float]:
        """The run's length: what riding the prescription (and obeying every event) covers in the block.

        Returns:
            Metres to the hospital, and how many of them are the braking zone.
        """
        b, k = room.plan["blocks"][i], room.plan.get("scale", 1.0)
        evs = [e for e in self.events if e["i"] == i]
        cruise, m, t = b["dur"] - G.AMBO_BRAKE_S * k, 0.0, 0.0
        while t < cruise:
            m += mid(self.ev_all(evs, start + t) or rx(b["patient"], t / k)) * V * DT
            t += DT
        brake = mid(G.AMBO_BRAKE) * V * G.AMBO_BRAKE_S * k
        return m + brake, brake

    def phase(self, room: Room, i: int) -> str:
        kind = room.plan["blocks"][i]["kind"]
        if self.rev > 0:
            return "reverse"
        return "ramp" if kind == "run" and self.arrived is not None else kind

    def event(self, room: Room, i: int) -> str:
        self.sync(room, i)
        return self.phase(room, i)

    def queued(self, room: Room, i: int) -> bool:
        """In the hospital queue: ramping, or delivered early and waiting for the block to end."""
        kind = room.plan["blocks"][i]["kind"]
        return (kind == "ramp" and room.el < self.queue_until) or (kind == "run" and self.arrived is not None)

    def band(self, room: Room, r: Rider, i: int, bel: float) -> Band:
        self.sync(room, i)
        b = room.plan["blocks"][i]
        if self.rev > 0:
            return G.AMBO_REVERSE
        if b["kind"] != "run":
            fixed = {"base": G.AMBO_BASE, "cool": G.AMBO_COOL, "ramp": G.AMBO_ROLL}[b["kind"]]
            return G.AMBO_QUEUE if self.queued(room, i) else fixed
        if self.gone:
            return G.AMBO_ROLL
        if self.arrived is not None:
            return G.AMBO_QUEUE
        if self.left <= self.brake_m:
            return G.AMBO_BRAKE
        return self.ev_band(room, r) or rx(b["patient"], bel / room.plan.get("scale", 1.0))

    def say(self, room: Room, i: int) -> None:
        kind = room.plan["blocks"][i]["kind"]
        lines = {"base": T.BASE, "ramp": T.RAMP, "cool": T.COOL}.get(kind) or T.CALM[self.pid]
        self.emit("say", self.rng("say", round(room.el)).choice(lines))

    # --- one tick ---------------------------------------------------------------------------------------

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        self.sync(room, i)
        k, el = room.plan.get("scale", 1.0), room.el
        act = [r for r in room.riders.values() if r.st == "riding"]
        tally(act, dt)
        a = min(1.0, dt / max(dt, G.AMBO_SMOOTH_S * k))
        for r in act:
            was = self.sm.get(r.id, r.p)
            self.sm[r.id] = was + (r.p - was) * a
        # nobody adds more than the cap to the speed, so the siren rider's sprint is a nudge, not a rocket
        team = fmean(min(C.TARGET_CAP, self.sm[r.id] / r.ftp) for r in act) if act else 0.0
        self.speed = 0.0 if self.rev > 0 else team * V
        self.dist += self.speed * dt
        due, self.ev_n = script.due(self.events, self.ev_n, el)
        for e in due:
            self.say(room, i) if e["k"] == "say" else self.ev_start(room, e)
        cost = self.roughness(room, act, i, bel)
        if self.rev > 0:
            self.rev -= dt
            for r in act:
                r.punish(dt)
            if self.rev <= 0:
                self.deliver(room, (self.run_end - el) / k)
        elif self.open and self.arrived is None:
            self.left -= self.speed * dt
            self.ev_tick(room, act, dt)
            self.hurt(room, cost, dt / k)
            if self.comfort <= 0:
                self.walk(room)
            elif self.left <= 0:
                self.arrive(room, team)
        elif self.queued(room, i):
            self.sweet_talk(room, act, i, dt / k)
        return super().tick(room, dt, i, bel, ev)

    def roughness(self, room: Room, act: list[Rider], i: int, bel: float) -> float:
        """Comfort a second the crew is costing: jerky power and power outside the band, forgiven for a
        moment after a rider's band moves. Also keeps each rider's own roughness and spike count."""
        k, el, cost = room.plan.get("scale", 1.0), room.el, 0.0
        p = PATIENTS.get(self.pid or "", {"tol": 1.0, "strict": 1.0})
        for r in act:
            band = self.band(room, r, i, bel)
            m = None if isinstance(band, str) else mid(band)
            was = self.mids.get(r.id)
            if m is None or was is None or abs(m - was) > 0.02:
                self.grace[r.id] = el + G.AMBO_GRACE_S * k
            self.mids[r.id] = m
            if m is None or el < self.grace[r.id]:
                self.spiking[r.id] = False
                continue
            pct, jerk = self.sm[r.id] / r.ftp, abs(r.p - self.sm[r.id]) / r.ftp
            tot = self.rough.setdefault(r.id, [0.0, 0])
            tot[0], tot[1] = tot[0] + jerk, tot[1] + 1
            spiking = jerk > G.AMBO_SPIKE
            self.spikes[r.id] = self.spikes.get(r.id, 0) + (spiking and not self.spiking.get(r.id, False))
            self.spiking[r.id] = spiking
            out = max(0.0, band[0] - pct, pct - band[1])
            cost += G.AMBO_ROUGH_RATE * max(0.0, jerk - p["tol"])
            cost += G.AMBO_OUT_RATE * max(0.0, out - G.AMBO_OUT_DEAD)
        return cost / len(act) * p["strict"] if act else 0.0

    def hurt(self, room: Room, cost: float, secs: float) -> None:
        """Takes `cost` Comfort a second for `secs` unscaled seconds, or gives a little back."""
        if cost > 1 and self.perk == "spike":
            self.perk, self.free_until = None, room.el + G.AMBO_PERK_S * room.plan.get("scale", 1.0)
            self.emit("perk", "Free spike used. The patient was looking the other way.")
        if cost <= 0 or room.el < self.free_until:
            self.comfort = min(100.0, self.comfort + (G.AMBO_REFILL * secs if cost <= 0 else 0))
            return
        self.comfort -= cost * secs
        self.hurt_at = room.el

    def walk(self, room: Room) -> None:
        self.comfort, self.gone = 0.0, True
        self.emit("walked", f"{PATIENTS[self.pid]['name']} has got out and is walking the rest.")
        self.finish_run(room, 0.0, walked=True)

    def arrive(self, room: Room, team: float) -> None:
        self.arrived = room.el
        if team <= G.AMBO_DOORS_MAX:
            return self.deliver(room, (self.run_end - room.el) / room.plan.get("scale", 1.0))
        self.fell, self.rev = True, G.AMBO_REVERSE_S * room.plan.get("scale", 1.0)
        self.speed = 0.0
        self.comfort = max(1.0, self.comfort - G.AMBO_FALL_COMFORT)
        self.emit(
            "fellout", f"Too hot! {PATIENTS[self.pid]['name']} fell out the back door. Reversing. Beep. Beep."
        )

    def deliver(self, room: Room, delta: float) -> None:
        """Hands the patient over `delta` unscaled seconds early (late when negative)."""
        (rate, most), by = (G.AMBO_EARLY, delta) if delta >= 0 else (G.AMBO_LATE, delta)
        self.finish_run(room, self.comfort * (1 + min(most, abs(by) * rate) * (1 if by >= 0 else -1)), delta)

    def finish_run(self, room: Room, pts: float, delta: float = 0.0, walked: bool = False) -> None:
        """Closes the run: its points, whether it was a good one, and the entry for the results."""
        p = PATIENTS[self.pid]
        self.open = False
        self.good = not walked and not self.fell and self.comfort >= G.AMBO_GOOD_COMFORT
        self.score += round(pts * G.AMBO_SCORE_X)
        entry = {
            "id": self.pid,
            "patient": p["name"],
            "icon": p["icon"],
            "comfort": round(self.comfort),
            "delta": round(delta),
            "walked": walked,
            "fell": self.fell,
            "pts": round(pts),
        }
        stars = 1 + sum(pts >= need for need in G.AMBO_STARS)
        entry["stars"] = 1 if walked else min(stars, G.AMBO_FELL_STARS) if self.fell else stars
        entry["text"] = T.review(self.pid, entry["stars"], walked, self.fell, delta < -G.AMBO_BRAKE_S)
        self.reviews.append(entry)
        self.emit("review", f"{'★' * entry['stars']}{'☆' * (5 - entry['stars'])} {entry['text']}")
        if not walked:
            self.emit("delivered", f"{p['name']} delivered. Comfort {round(self.comfort)}%.")

    def sweet_talk(self, room: Room, act: list[Rider], i: int, secs: float) -> None:
        """In the queue, the whole crew spinning easy earns a perk for the next run."""
        easy = all(r.cad >= G.AMBO_SWEET_RPM and self.sm[r.id] / r.ftp <= G.AMBO_SWEET_MAX for r in act)
        if not act or not easy or self.perk or self.sweet >= 1:
            return
        self.sweet = min(1.0, self.sweet + secs / G.AMBO_SWEET_S)
        if self.sweet >= 1:
            nxt = next((b for b in room.plan["blocks"][i + 1 :] if b["kind"] == "run"), None)
            green = nxt and "green" in PATIENTS[nxt["patient"]]["events"] and self.good
            self.perk = "green" if green else "spike"
            what = "every light green on the next wave" if green else "one free spike"
            self.emit("perk", f"Triage sweet-talked. Next run: {what}.")

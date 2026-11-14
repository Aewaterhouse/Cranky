"""The Zombie Bus servo stop: the shop (three of six upgrades), the route vote and the servo's own pick."""

from __future__ import annotations

import random
from collections import Counter
from typing import TYPE_CHECKING

from .. import config as C

if TYPE_CHECKING:
    from ..session import Rider, Room

T_SHORTCUT = {
    True: "Shortcut paid off! Down a fire trail and out ahead of the horde.",
    False: "Shortcut was a dead end. Reverse out, the horde is right there!",
}


class Servo:
    """Mixed into `ZombieBus`, which holds the state."""

    def ask(self, room: Room, r: Rider) -> dict | None:
        """At a servo stop: which way next. Everyone votes; the most votes wins as the stop closes."""
        if self.ev != "servo" or r.bot:
            return None
        opts = [{"v": k, "label": v["name"], "icon": v["icon"], "sub": v["desc"]} for k, v in C.LEGS.items()]
        return {
            "k": "road",
            "title": "🗺️ Which way next?",
            "sub": "Most votes wins when the servo closes.",
            "opts": opts,
            "v": self.road_votes.get(r.id),
        }

    def on_act(self, room: Room, r: Rider, k: str, v: object) -> None:
        if k == "road" and self.ev == "servo" and v in C.LEGS:
            self.road_votes[r.id] = str(v)
        elif k == "emoji" and v in C.BUS_EMOJI:  # the horn and reactions, fallen riders' heckles too
            self.emit("emoji", str(v), r.id)

    def pick_leg(self, room: Room) -> None:
        """Counts the road votes (a tie is a coin toss) and sets the next leg; a shortcut is a gamble now."""
        if not self.road_votes:
            return
        n = Counter(self.road_votes.values())
        rng = random.Random(f"{room.code}:{round(room.el)}")
        pick = rng.choice(sorted(k for k, c in n.items() if c == max(n.values())))
        self.leg, self.road_votes = C.LEGS[pick], {}
        if pick == "shortcut":
            lucky = rng.random() < C.SHORTCUT_LUCK
            self.gap += C.SHORTCUT_GAP if lucky else -C.SHORTCUT_GAP
            self.emit("leg", T_SHORTCUT[lucky])
        else:
            self.emit("leg", f"The crew picked {self.leg['name']}. {self.leg['desc']}")

    def auto_shop(self) -> None:
        """Nobody bought at the stop: the tin buys what helps most, so nobody lets go of the bars."""
        if self.shopped:
            return
        order = ["plating"] * (self.armour < C.AUTO_PLATING_UNDER) + [
            "repellent",
            "ram",
            "nitro",
            "sync",
            "magnet",
        ]
        item = next((k for k in order if k in self.wares and self.scrap >= C.SHOP[k]), None)
        if item:
            self.buy(None, item)

    def buy(self, r: Rider | None, item: str) -> None:
        """Servo Stop shop: session-only upgrades paid from the bus scrap tin (no rider: the servo picked)."""
        cost = C.SHOP[item]
        if self.ev != "servo" or item not in self.wares or self.scrap < cost or self.mut.get("no_shop"):
            return
        self.scrap -= cost
        self.shopped = True
        name = r.name if r else "Nobody let go of the bars, so the servo"
        if item == "plating":
            self.armour = min(100.0, self.armour + C.PLATING_ARMOUR)
            text = f"{name} bolted on armour plating (+{C.PLATING_ARMOUR})"
        elif item == "repellent":
            self.repel += 1
            text = f"{name} bought horde repellent (one free fail)"
        elif item == "nitro":
            self.nitro = 1.0
            text = f"{name} poured a can of nitro in the tank"
        elif item == "ram":
            self.ram = True
            text = f"{name} welded on a ram: the next roadblock takes half as much again"
        elif item == "magnet":
            self.magnet = C.MAGNET_SCRAP
            text = f"{name} hung a scrap magnet off the back: more scrap until the next stop"
        else:
            self.syncw += C.SYNC_WIDEN_RPM
            text = f"{name} tuned the carby: sync window ±{C.SYNC_RPM + self.syncw} rpm"
        self.emit("buy", text, r.id if r else None)

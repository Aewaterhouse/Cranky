"""The Zombie Bus servo stop: the crew's vote on the next leg."""

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
            "sub": "Most votes wins as you pull out.",
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

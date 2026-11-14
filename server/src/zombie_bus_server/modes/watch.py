"""Watch party: the crew rides the driver's workout on ERG while everyone watches the same YouTube video.

The server only keeps the room's video, its position and whether it is playing; each player follows that and
jumps back when it drifts (an ad, a buffer, a late join). The workout never waits for the video.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import CrewGame, award, compliance, rider_row, tally

if TYPE_CHECKING:
    from ..rider import Rider
    from ..session import Room

# A YouTube id, a Twitch channel or a video file on the web (see `videoSource` in the client).
VID = re.compile(r"^([\w-]{11}|tw:\w{3,25}|url:https://\S{8,250})$")


class Watch(CrewGame):
    """The room's video and queue. Only the driver holds the remote; anyone can queue a video."""

    early_acts = True  # the video can go on during the countdown

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.vid: str | None = None
        self.playing = False
        self.pos = 0.0
        self.at = 0.0
        self.queue: list[dict] = []
        self.added: dict[str, int] = {}
        self.title: str | None = None
        self.held = False  # the driver paused: the workout waits with the video
        self.played: list[dict] = []  # queue entries already played, for their titles

    def where(self, el: float) -> float:
        """The video's position at ride time `el`."""
        return self.pos + (el - self.at if self.playing else 0.0)

    def cue(self, room: Room, vid: str | None, play: bool) -> None:
        self.vid, self.pos, self.at, self.playing = vid, 0.0, room.el, play and vid is not None
        self.title = next((q["title"] for q in self.played if q["vid"] == vid), None)

    def on_act(self, room: Room, r: Rider, k: str, v: str | float | bool | None) -> None:
        if k == "add" and isinstance(v, str) and VID.match(v) and len(self.queue) < G.WATCH_QUEUE_MAX:
            self.added[r.id] = self.added.get(r.id, 0) + 1
            if self.vid is None:
                self.cue(room, v, True)
                self.emit("say", f"{r.name} put on a video.")
            else:
                self.queue.append({"vid": v, "title": None, "by": r.name})
                self.emit("say", f"{r.name} queued a video.")
            return
        if k == "title" and isinstance(v, str) and "\t" in v:
            # A player names the video it loaded: the source, a tab, then the title.
            vid, title = v.split("\t", 1)
            title = title.strip()[:120]
            if vid == self.vid:
                self.title = title
            for q in self.queue:
                if q["vid"] == vid:
                    q["title"] = title
            return
        if k == "emoji" and v in G.WATCH_EMOJI:
            self.emit("emoji", str(v), r.id)
            return
        if r.id != room.host:
            return
        at = next((n for n, q in enumerate(self.queue) if q["vid"] == v), None)
        if k == "up" and at:
            self.queue[at - 1], self.queue[at] = self.queue[at], self.queue[at - 1]
        elif k == "drop" and at is not None:
            self.queue.pop(at)
        if k in ("play", "pause") and self.vid:
            self.pos, self.at, self.playing = self.where(room.el), room.el, k == "play"
            self.held = k == "pause" and room.el >= 0
        elif k == "seek" and self.vid:
            try:
                step = max(-G.WATCH_SEEK_MAX, min(G.WATCH_SEEK_MAX, float(v)))  # type: ignore[arg-type]
            except (TypeError, ValueError):
                return
            self.pos, self.at = max(0.0, self.where(room.el) + step), room.el
        elif k == "next":
            nxt = self.queue.pop(0) if self.queue else None
            if nxt:
                self.played.append(nxt)
            self.cue(room, nxt["vid"] if nxt else None, True)
            self.held = False

    def holds(self, room: Room) -> bool:
        return self.held

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        tally([r for r in room.riders.values() if r.st == "riding"], dt)
        self.speed = G.WATCH_SPEED
        self.dist += self.speed * dt
        return super().tick(room, dt, i, bel, ev)

    def game(self, room: Room, i: int, bel: float) -> dict:
        return {
            "g": "watch",
            "vid": self.vid,
            "title": self.title,
            "playing": self.playing,
            "pos": round(self.pos, 2),
            "at": round(self.at, 2),
            "queue": self.queue,
        }

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        award(awards, rs, "On the Couch", lambda r: comp[r.id], lambda r: f"{comp[r.id]:.0%} on target")
        award(
            awards, rs, "Programme Director", lambda r: self.added.get(r.id, 0), lambda r: "picked the videos"
        )
        return {
            "mode": "watch",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": 0,
            "score": round(100 * sum(comp.values()) / max(1, len(comp))),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [rider_row(r, comp) for r in sorted(rs, key=lambda r: -comp[r.id])],
            "awards": awards,
        }

"""Pub Quiz: questions every so often over the driver's workout. Right answers score, more if on target."""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

from .. import config_games as G
from .common import CrewGame, compliance, crew_scrap, rider_row, tally
from .quiz_text import QUESTIONS

if TYPE_CHECKING:
    from ..session import Rider, Room


class PubQuiz(CrewGame):
    """`n` is the open question (in the night's draw), `opts` its shuffled answers, `got` the answers."""

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.draw: list[int] = []
        self.n = -1  # the question on (index into draw), -1 before the first
        self.opts: list[str] = []
        self.open_at = self.close_at = 0.0
        self.got: dict[str, list] = {}  # rider -> [answer index, ride time, on target]
        self.pts: dict[str, int] = {}
        self.right: dict[str, int] = {}

    def begin(self, room: Room) -> None:
        self.draw = random.sample(range(len(QUESTIONS)), len(QUESTIONS))

    def ask(self, room: Room, r: Rider) -> dict | None:
        if r.bot or not self.is_open(room) or r.id in self.got:
            return None
        q = QUESTIONS[self.draw[self.n]][0]
        opts = [{"v": str(k), "label": a} for k, a in enumerate(self.opts)]
        return {
            "k": "quiz",
            "title": f"🍺 Q{self.n + 1}: {q}",
            "opts": opts,
            "left": round(self.close_at - room.el),
        }

    def is_open(self, room: Room) -> bool:
        return self.n >= 0 and room.el < self.close_at

    def on_act(self, room: Room, r: Rider, k: str, v: object) -> None:
        if k == "quiz" and self.is_open(room) and r.id not in self.got and str(v).isdigit() and int(v) < 4:
            self.got[r.id] = [int(v), room.el, (r.s or 0) >= G.QUIZ_ON_TARGET]

    def tick(self, room: Room, dt: float, i: int, bel: float, ev: str) -> list[dict]:
        tally([r for r in room.riders.values() if r.st == "riding"], dt)
        self.speed = G.WATCH_SPEED
        self.dist += self.speed * dt
        total = sum(b["dur"] for b in room.plan["blocks"])
        if self.n >= 0 and self.close_at <= room.el and self.open_at > 0:
            self.settle(room)
        due = G.QUIZ_FIRST_S + (self.n + 1) * G.QUIZ_EVERY_S
        if (
            not self.is_open(room)
            and room.el >= due
            and room.el < total - G.QUIZ_LAST_S
            and self.n + 1 < len(self.draw)
        ):
            self.n += 1
            q, answers = QUESTIONS[self.draw[self.n]]
            self.opts = random.Random(f"{room.code}:{self.n}").sample(answers, 4)
            self.open_at, self.close_at, self.got = room.el, room.el + self.mut.get("open", G.QUIZ_OPEN_S), {}
            self.emit("quiz", f"Question {self.n + 1}: {q}")
        for r in room.riders.values():  # bots answer after a think, about half of them right
            if r.bot and self.is_open(room) and r.id not in self.got:
                rng = random.Random(f"{room.code}:{self.n}:{r.id}")
                if room.el - self.open_at >= rng.uniform(4, self.mut.get("open", G.QUIZ_OPEN_S) - 2):
                    right = self.opts.index(QUESTIONS[self.draw[self.n]][1][0])
                    self.got[r.id] = [right if rng.random() < 0.5 else (right + 1) % 4, room.el, True]
        return super().tick(room, dt, i, bel, ev)

    def settle(self, room: Room) -> None:
        """Scores the closed question and says the answer and who got it."""
        right = self.opts.index(QUESTIONS[self.draw[self.n]][1][0])
        winners = sorted((t, rid) for rid, (a, t, _) in self.got.items() if a == right)
        for k, (_, rid) in enumerate(winners):
            on = self.got[rid][2]
            self.pts[rid] = (
                self.pts.get(rid, 0)
                + G.QUIZ_PTS
                + (G.QUIZ_ON_PTS if on else 0)
                + (G.QUIZ_FAST if k == 0 else 0)
            )
            self.right[rid] = self.right.get(rid, 0) + 1
        names = [room.riders[rid].name for _, rid in winners if rid in room.riders]
        who = ", ".join(names) if names else "nobody"
        self.emit("answer", f"It was {self.opts[right]}. Got it: {who}.")
        self.open_at = 0.0

    def game(self, room: Room, i: int, bel: float) -> dict:
        return {"g": "quiz", "pts": self.pts, "n": self.n + 1, "open": self.is_open(room)}

    def summary(self, room: Room) -> dict:
        rs = list(room.riders.values())
        comp, awards = compliance(rs), []
        order = sorted(rs, key=lambda r: (-self.pts.get(r.id, 0), -comp[r.id]))
        asked = self.n + 1
        if order and self.pts.get(order[0].id):
            top = order[0]
            awards.append(
                {
                    "award": "Quizmaster",
                    "id": top.id,
                    "name": top.name,
                    "why": f"{self.right.get(top.id, 0)} of {asked} right, {self.pts[top.id]} points",
                }
            )
        if len(order) > 2:
            low = order[-1]
            awards.append(
                {
                    "award": "Knows Nothing",
                    "id": low.id,
                    "name": low.name,
                    "why": f"{self.right.get(low.id, 0)} of {asked} right",
                }
            )
        return {
            "mode": "quiz",
            "distance": round(self.dist),
            "armour": 100,
            "scrap": crew_scrap(self.dist),
            "score": max(self.pts.values(), default=0),
            "difficulty": "normal",
            "syncPct": 0,
            "riders": [rider_row(r, comp, points=self.pts.get(r.id, 0)) for r in order],
            "awards": awards,
        }

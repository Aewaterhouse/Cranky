"""Pub Quiz: questions open and close on time, right answers score, on target and fastest score more."""

import asyncio

from test_bots import lobby_with

from zombie_bus_server import config_games as G
from zombie_bus_server.modes.quiz_text import QUESTIONS


def test_a_question_opens_scores_and_names_who_got_it():
    async def main():
        room, ws = await lobby_with(2, code="QUIZ")
        await room.handle("h0", ws, {"t": "game", "game": "quiz"})
        await room.handle("h0", ws, {"t": "bots", "n": 1})
        room.start()
        room.task.cancel()
        g = room.mode
        for r in room.riders.values():
            r.s, r.st = 1.0, "riding"
        fx = []
        room.el = G.QUIZ_FIRST_S
        fx += g.tick(room, 0.25, 1, 5, "")
        q = g.ask(room, room.riders["h0"])
        assert q["k"] == "quiz" and len(q["opts"]) == 4
        right = g.opts.index(QUESTIONS[g.draw[0]][1][0])
        g.on_act(room, room.riders["h0"], "quiz", str(right))
        room.riders["h1"].s = 0.5
        room.el += 1
        g.on_act(room, room.riders["h1"], "quiz", str(right))
        g.on_act(room, room.riders["h1"], "quiz", str((right + 1) % 4))  # a second answer does not count
        assert g.ask(room, room.riders["h0"]) is None
        room.el = G.QUIZ_FIRST_S + G.QUIZ_OPEN_S + 1
        fx += g.tick(room, 0.25, 1, 5, "")
        return room, g, fx

    room, g, fx = asyncio.run(main())
    assert g.pts["h0"] == G.QUIZ_PTS + G.QUIZ_ON_PTS + G.QUIZ_FAST
    assert g.pts["h1"] == G.QUIZ_PTS
    said = [f["text"] for f in fx if f["k"] == "answer"][0]
    assert said.startswith("It was ") and "H0, H1" in said

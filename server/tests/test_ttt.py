"""Team Time Trial: two teams on one workout, decided by who is more on target."""

import asyncio

from test_bots import lobby_with


def test_teams_alternate_and_the_steadier_team_wins():
    async def main():
        room, ws = await lobby_with(2, code="TTT1")
        await room.handle("h0", ws, {"t": "game", "game": "ttt"})
        await room.handle("h0", ws, {"t": "bots", "n": 2})
        room.start()
        room.task.cancel()
        g = room.mode
        g.mut = {}
        g.begin(room)  # deal again by seat, whatever this week's twist is
        assert g.team["h0"] != g.team["h1"]
        for _ in range(40):
            for r in room.riders.values():
                r.s, r.st = (1.0 if g.team[r.id] == g.team["h1"] else 0.6), "riding"
            g.tick(room, 0.25, 1, 5, "longhaul")
        await room.finish()
        return room, g

    room, g = asyncio.run(main())
    s = room.summary
    assert s["teams"]["winner"] == g.team["h1"] and s["teams"]["scores"][g.team["h1"]] > 0.95
    assert s["awards"][0]["award"].startswith("Team ")


def test_the_tick_carries_both_teams_scores():
    async def main():
        room, ws = await lobby_with(2, code="TTT2")
        await room.handle("h0", ws, {"t": "game", "game": "ttt"})
        room.start()
        room.task.cancel()
        room.el = 2.0
        return room.step(0.25)

    g = asyncio.run(main())["game"]
    assert g["g"] == "ttt" and g["teams"] == ["Maroons", "Blues"] and len(g["scores"]) == 2


def test_a_workout_game_swaps_the_bus_run_for_its_own_workout():
    async def main():
        room, ws = await lobby_with(1, code="TTT3")
        room.plan_id = "bus-crew-45"
        await room.handle("h0", ws, {"t": "game", "game": "quiz"})
        return room

    room = asyncio.run(main())
    assert room.plan_id == "coffee-spin-45" and room.plan["name"] == "Coffee Spin"

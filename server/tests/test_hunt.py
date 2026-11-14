"""The Hunt: a fox each round; clean hounds catch a ragged fox, a clean fox escapes a ragged pack."""

import asyncio

from test_bots import lobby_with

from zombie_bus_server import config_games as G


def hunt(fox_s, hound_s, secs=G.HUNT_ROUND_S + 10):
    async def main():
        room, ws = await lobby_with(3, code=f"H{int(fox_s * 10)}{int(hound_s * 10)}")
        await room.handle("h0", ws, {"t": "game", "game": "hunt"})
        room.start()
        room.task.cancel()
        g, fx = room.mode, []
        g.mut = {}  # the plain hunt, whatever this week's twist is
        for _ in range(int(secs / 0.5)):
            room.el += 0.5
            for r in room.riders.values():
                r.s, r.st = (fox_s if r.id == g.fox else hound_s), "riding"
            fx += g.tick(room, 0.5, 1, 5, "")
        await room.finish()
        return room, g, fx

    return asyncio.run(main())


def test_clean_hounds_catch_a_ragged_fox():
    room, g, fx = hunt(0.6, 1.0)
    assert any(f["k"] == "caught" for f in fx) and g.pts["h1"] == G.HUNT_CATCH and "h0" not in g.pts


def test_a_clean_fox_escapes_and_the_next_rider_is_the_fox():
    room, g, fx = hunt(1.0, 0.8)
    assert [f["id"] for f in fx if f["k"] == "fox"][:2] == ["h0", "h1"]
    assert g.pts["h0"] == G.HUNT_ESCAPE and any(f["k"] == "escaped" for f in fx)
    assert room.summary["awards"][0]["award"] == "Top Dog"

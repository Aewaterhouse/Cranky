"""Galley Ship: rowing on the drum's beat outruns the pirates; off the beat they board."""

import asyncio

from test_bots import lobby_with

from zombie_bus_server import config_games as G


def row(cad):
    async def main():
        room, ws = await lobby_with(2, code=f"GAL{cad}")
        await room.handle("h0", ws, {"t": "game", "game": "galley"})
        room.start()
        room.task.cancel()
        g, fx = room.mode, []
        for _ in range(int(240 / 0.25)):
            room.el += 0.25
            for r in room.riders.values():
                r.cad, r.s, r.st = (g.beat_at(room.el) if cad is None else cad), 1.0, "riding"
            fx += g.tick(room, 0.25, 1, 5, "")
        await room.finish()
        return room, g, fx

    return asyncio.run(main())


def test_on_the_beat_the_ship_pulls_away_and_the_drum_changes():
    room, g, fx = row(None)
    assert g.hull == 100 and g.gap > G.GALLEY_GAP and g.sync > 0.95
    assert any(f["k"] == "drum" and str(G.GALLEY_BEATS[1]) in f["text"] for f in fx)
    assert room.summary["awards"][0]["award"] == "Drummer's Pet"


def test_off_the_beat_the_pirates_board():
    room, g, fx = row(60)
    assert g.hull < 100 and any(f["k"] == "boarded" for f in fx)

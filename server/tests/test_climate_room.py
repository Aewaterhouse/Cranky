"""Climate Lawsuit in a room: bots in character, a whole game played fast, and the words afterwards."""

import asyncio
import random

from climate_town import Town
from test_bots import lobby_with
from test_script import DT, play

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server import discord, strava_text
from zombie_bus_server.modes.climate import Climate
from zombie_bus_server.rider import Rider


def bot(town, rid, name):
    town.riders[rid] = Rider(rid, name, 200, "hard", connected=True, bot=True)


def test_bots_choose_fuels_and_take_envelopes_in_character():
    town = Town()
    for rid, name in zip(("r0", "r1", "r2"), C.BOT_NAMES[:3], strict=True):  # Baron, Greenie, Fence-sitter
        bot(town, rid, name)
    town.to("decade", 1, -40)
    for co in town.game.cos.values():
        co["coins"] = 100
    town.to("decade", 1, 2)
    assert [town.game.cos[r]["fuel"] for r in ("r0", "r1", "r2")] == ["coal", "solar", "gas"]
    town.game.on_event(town, {"k": "lobby", "t": town.el, "dur": 0}, "decade")
    town.game.offer["who"] = "r0"
    town.ride(15)
    assert town.game.bribed == {"r0": True}


def test_greenie_builds_seawalls_once_the_sea_is_up():
    town = Town()
    bot(town, "r1", C.BOT_NAMES[1])
    town.to("decade", 2, 30)
    town.game.cos["r1"]["coins"] = 200
    town.ride(2)
    assert town.game.walls_by.get("r1", 0) >= 1


def test_bots_vote_and_appeal_in_character():
    town = Town()
    for rid, name in zip(("r0", "r1", "r2"), C.BOT_NAMES[:3], strict=True):
        bot(town, rid, name)
    town.to("trial", 1, -1)
    town.game.emit_t["r3"] = 1e6
    town.ride(G.CLIM_VOTE_S + 2)
    assert town.game.votes == {"r0": "90", "r1": "105", "r2": "100"} and town.game.target == 105


def test_the_baron_burns_a_little_harder_on_coal():
    town = Town()
    bot(town, "r0", C.BOT_NAMES[0])
    town.to("decade", 1, 5)
    game, r = town.game, town.riders["r0"]
    assert game.bot(town, r, 150.0, 150.0, random.Random(1)) > 150
    assert game.bot(town, town.riders["r1"], 150.0, 150.0, random.Random(1)) == 150


def test_four_bots_play_a_whole_game_to_a_sane_summary(monkeypatch):
    monkeypatch.setattr(C, "SCRIPT_SCALE", 0.125)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "CLIM")
        await room.handle("h0", ws, {"t": "game", "game": "climate"})
        await room.handle("h0", ws, {"t": "bots", "n": 4})
        room.riders.pop("h0")
        room.start()
        ticks = play(room)
        await room.finish()
        return room, ticks, ws

    room, ticks, ws = asyncio.run(main())
    assert 330 <= len(ticks) * DT <= 345
    assert [t["ev"] for t in ticks][0] == "eighties" and {t["ev"] for t in ticks} == {
        "eighties",
        "decade",
        "trial",
        "cool",
    }
    assert all(t["ev"] == t["game"]["phase"] for t in ticks)
    for t in ticks:
        for rid, r in t["riders"].items():
            cap = round(room.riders[rid].ftp * C.TARGET_CAP)
            assert not r["erg"] and r["band"][0] <= r["tgt"] <= r["band"][1] <= cap
    asked = {r["ask"]["k"] for t in ticks for r in t["riders"].values() if r.get("ask")}
    assert {"fuel", "verdict_target"} <= asked
    s = room.summary
    assert s["mode"] == "climate" and len(s["riders"]) == 4 and s["verdicts"]
    assert {"company", "coins", "emit", "bribed"} <= set(s["riders"][0])
    assert any(a["award"] == "Polluter of the Decade" for a in s["awards"])
    lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
    assert lobby["game"] == "climate" and lobby["trainers"] == "gears"


def test_strava_and_discord_tell_the_story():
    s = {
        "mode": "climate",
        "score": 0,
        "flooded": True,
        "stageName": "Everything",
        "distance": 30000,
        "verdicts": {"a": "guilty"},
        "riders": [{"id": "a", "name": "Al", "company": "AlCorp", "coins": 80, "emit": 1700, "bribed": True}],
        "awards": [{"award": "Polluter of the Decade", "name": "Al", "why": "1700 tonnes"}],
    }
    text = discord.format_summary("Climate Lawsuit", s)
    assert "FLOODED" in text and "Guilty: Al" in text and "AlCorp" in text
    title, desc = strava_text.describe({"group": s, "planName": "Climate Lawsuit"}, "a")
    assert "flooded" in title and "guilty" in title and "took the envelope" in desc and "AlCorp" in desc
    assert Climate.no_erg

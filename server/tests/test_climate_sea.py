"""Climate Lawsuit's sea: the level and its stages, seawalls, demand events, the lobbyist and the tuning."""

import pytest
from climate_town import Town, kinds

from zombie_bus_server import config_games as G
from zombie_bus_server.modes.climate import level_of, stage_of


def test_the_sea_is_the_average_company_against_the_flood_mark_less_the_walls():
    assert level_of({"a": 0.0, "b": 2 * G.CLIM_FLOOD_T}, 0) == pytest.approx(1.0)
    assert level_of({"a": G.CLIM_FLOOD_T / 2}, 1) == pytest.approx(0.5 - G.CLIM_WALL_STEP)
    assert level_of({"a": 1.0}, 3) == 0.0 and level_of({}, 0) == 0.0
    assert [stage_of(x) for x in (0.0, 0.15, 0.39, 0.4, 0.7, 1.0)] == [0, 1, 1, 2, 3, 4]


def test_all_coal_floods_the_town_in_the_2010s():
    town = Town()
    town.to("decade", 3)
    assert not town.view()["flooded"]
    fx = town.to("decade", 4)
    assert town.view()["flooded"] and kinds(fx).count("flood") == 1
    v = town.view()
    assert v["stage"] == 4 and v["stageName"] == "Everything" and v["level"] == 1.0


def test_half_the_town_on_solar_from_the_2000s_just_survives():
    town = Town()
    fx = town.to("decade", 2, -20)
    town.act("r0", "fuel", "solar")
    town.act("r1", "fuel", "solar")
    fx += town.to("trial")
    v = town.view()
    assert not v["flooded"] and 0.9 < v["level"] < 1.0 and "flood" not in kinds(fx)
    assert kinds(fx).count("stage") == 3


def test_a_flooded_town_stops_earning_and_emitting():
    town = Town()
    town.to("decade", 4, 10)
    assert town.view()["flooded"]
    coins, tonnes = town.game.cos["r0"]["coins"], town.game.emit_t["r0"]
    town.ride(30)
    assert town.game.cos["r0"]["coins"] == coins and town.game.emit_t["r0"] == tonnes


def test_a_seawall_knocks_the_sea_back_and_each_costs_more():
    town = Town()
    town.to("decade", 2)
    level, coins = town.view()["level"], town.game.cos["r0"]["coins"]
    assert town.view()["wallCost"] == 30
    town.act("r0", "wall", True)
    v = town.view()
    assert (
        v["walls"] == 1
        and v["wallCost"] == 45
        and v["level"] == pytest.approx(level - G.CLIM_WALL_STEP, abs=0.01)
    )
    assert town.game.cos["r0"]["coins"] == pytest.approx(coins - 30)
    town.game.cos["r1"]["coins"] = 10
    town.act("r1", "wall", True)  # can't afford it
    assert town.view()["walls"] == 1 and town.game.walls_by == {"r0": 1}


def test_a_heatwave_the_crew_holds_keeps_the_lights_on_and_one_it_misses_blacks_out():
    for power, out in ((None, False), (lambda r, b, el: 0.7, True)):
        town = Town()
        town.to("decade", 1, 10)
        town.game.on_event(town, {"k": "heat", "t": town.el, "dur": G.CLIM_EVENT_S["heat"]}, "decade")
        assert town.game.band(town, town.riders["r0"], 1, 10) == G.CLIM_HEAT["band"]
        assert town.view()["event"]["k"] == "heat" and town.view()["event"]["left"] == 120
        coins = town.game.cos["r0"]["coins"]
        fx = town.ride(G.CLIM_EVENT_S["heat"] + 1, power)
        assert ("blackout" in kinds(fx)) is out and town.view()["event"] is None
        if out:
            assert town.game.cos["r0"]["coins"] < coins


def test_half_time_kettles_ask_everyone_over_110_for_30_seconds():
    town = Town()
    town.to("decade", 2, 10)
    town.game.on_event(town, {"k": "kettle", "t": town.el, "dur": 30}, "decade")
    assert town.game.band(town, town.riders["r0"], 2, 10) == G.CLIM_KETTLE["band"]
    fx = town.ride(31)
    assert "blackout" not in kinds(fx)


def test_the_bitcoin_miner_lifts_targets_and_profits_for_the_rest_of_the_decade_once():
    town = Town()
    town.to("decade", 2, 10)
    plain = town.game.band(town, town.riders["r0"], 2, 10)
    town.game.on_event(town, {"k": "miner", "t": town.el, "dur": 0}, "decade")
    lifted = town.game.band(town, town.riders["r0"], 2, 10)
    assert (
        lifted == pytest.approx((plain[0] * 1.05, plain[1] * 1.05)) and town.view()["event"]["k"] == "miner"
    )
    fx = []
    town.game.on_event(town, {"k": "miner", "t": town.el, "dur": 0}, "decade")
    fx += town.game.fx
    assert town.game.miner_used and any("second bitcoin" in f["text"] for f in fx)
    town.to("decade", 3, 5)
    assert town.view()["event"] is None and town.game.band(town, town.riders["r0"], 3, 5) == plain


def test_the_lobbyist_offers_the_poorest_company_a_secret_envelope_once():
    town = Town()
    town.to("decade", 1, 10)
    town.game.cos["r2"]["coins"] = 1
    town.game.on_event(town, {"k": "lobby", "t": town.el, "dur": 0}, "decade")
    q = town.ask("r2")
    assert q["k"] == "bribe" and [o["v"] for o in q["opts"]] == ["yes", "no"] and town.ask("r0") is None
    town.act("r0", "bribe", "yes")  # not your envelope
    assert not town.game.bribed
    town.act("r2", "bribe", "yes")
    assert town.game.bribed == {"r2": True} and town.game.cos["r2"]["coins"] == 1 + G.CLIM_BRIBE
    assert town.view()["ledger"] is None and "bribed" not in town.view()["cos"]["r2"]
    town.game.on_event(town, {"k": "lobby", "t": town.el, "dur": 0}, "decade")
    assert town.game.offer is None
    town.to("decade", 2, -20)
    assert town.ask("r2") is None  # no fuel choice: the envelope has them on coal
    town.act("r2", "fuel", "solar")
    town.to("decade", 2, 1)
    assert town.game.cos["r2"]["fuel"] == "coal"
    town.to("trial", 1, 5)
    assert town.view()["ledger"]["r2"]["bribed"] and not town.view()["ledger"]["r0"]["bribed"]


def test_an_envelope_left_on_the_table_goes_away():
    town = Town()
    town.to("decade", 1, 10)
    town.game.on_event(town, {"k": "lobby", "t": town.el, "dur": 0}, "decade")
    who = town.game.offer["who"]
    town.ride(G.CLIM_BRIBE_S + 1)
    assert town.ask(who) is None and not town.game.bribed

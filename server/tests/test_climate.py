"""Climate Lawsuit: the script, the fuels and their bands, coins and tonnes, switching and the 90 s rule."""

import pytest
from climate_town import DT, Town, deal, kinds, mid

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server.modes import script
from zombie_bus_server.modes.climate import Climate, fuel_cost
from zombie_bus_server.plan import locate


def band(town, rid):
    return town.game.band(town, town.riders[rid], *locate(town.plan["blocks"], town.el))


def test_the_session_is_the_briefs_45_minutes_and_never_goes_quiet():
    p = Climate.deal(45)
    assert [b["kind"] for b in p["blocks"]] == ["eighties", *["decade"] * 4, "trial", "cool"]
    assert [b["label"] for b in p["blocks"]][:2] == ["The 1980s", "The 1990s"]
    assert sum(b["dur"] for b in p["blocks"]) == 45 * 60
    assert {b["type"] for b in p["blocks"]} == {"free"}
    assert script.worst_gap(p, G.CLIM_EVENT_S) <= C.SCRIPT_MAX_GAP_S
    small = deal(0.125)
    assert script.worst_gap(small, G.CLIM_EVENT_S, range(50)) <= C.SCRIPT_MAX_GAP_S


def test_bots_fill_the_town_and_every_company_has_a_name_and_starts_on_coal():
    town = Town(2)
    assert len(town.riders) == 4 and sum(r.bot for r in town.riders.values()) == 2
    cos = town.view()["cos"]
    assert len({c["name"] for c in cos.values()}) == 4 and {c["fuel"] for c in cos.values()} == {"coal"}


def test_the_eighties_are_coal_for_everyone_and_coal_earns_on_any_power():
    town = Town()
    town.ride(60)
    assert band(town, "r0") == G.CLIM_FUELS["coal"]["band"]
    v = town.view()
    assert v["phase"] == "eighties" and v["decade"] is None and v["level"] > 0
    assert all(c["on"] and c["coins"] > 0 for c in v["cos"].values())
    town.ride(10, lambda r, b, el: 0.1)  # soft-pedalling earns nothing
    assert not town.view()["cos"]["r0"]["on"]


def test_each_fuel_has_its_own_band_and_none_is_over_the_cap():
    town = Town()
    town.to("decade", 1, -20)
    for rid, f in zip(("r0", "r1", "r2", "r3"), ("coal", "gas", "solar", "wind"), strict=True):
        town.game.cos[rid]["coins"] = 100
        town.act(rid, "fuel", f)
    town.to("decade", 1, 1)
    assert [town.view()["cos"][r]["fuel"] for r in ("r0", "r1", "r2", "r3")] == [
        "coal",
        "gas",
        "solar",
        "wind",
    ]
    for _ in range(0, 400, 2):
        town.ride(2)
        for rid in town.riders:
            b = band(town, rid)
            assert 0 < b[0] <= b[1] <= C.TARGET_CAP
    town.to("decade", 2, 5)
    assert band(town, "r2") == G.CLIM_FUELS["solar"]["band"]


def test_solar_earns_only_in_its_band_and_wind_only_on_gusts():
    town = Town()
    town.to("decade", 1, -20)
    town.game.cos["r0"]["coins"] = town.game.cos["r1"]["coins"] = 100
    town.act("r0", "fuel", "solar")
    town.act("r1", "fuel", "wind")
    town.to("decade", 1, 1)
    before = town.game.cos["r0"]["coins"]
    town.ride(10, lambda r, b, el: 0.7)  # clouds
    assert town.game.cos["r0"]["coins"] == before and not town.view()["cos"]["r0"]["on"]
    town.ride(10)
    assert town.game.cos["r0"]["coins"] > before
    gust = next(c for c in town.game.cues if c["k"] == "gust" and c["t"] > town.el)
    town.ride(gust["t"] - town.el - 0.5)
    wind = town.game.cos["r1"]["coins"]
    town.ride(1.5)
    v = town.view()
    assert v["cue"]["r1"]["k"] == "gust" and "r0" not in v["cue"] and band(town, "r1") == G.CLIM_GUST["band"]
    town.ride(gust["end"] - town.el + 1)
    assert town.game.cos["r1"]["coins"] == pytest.approx(wind + G.CLIM_GUST["pay"])


def test_a_gust_or_surge_that_is_not_held_pays_nothing():
    town = Town()
    town.to("decade", 1, -20)
    town.game.cos["r1"]["coins"] = 100
    town.act("r1", "fuel", "gas")
    town.to("decade", 1, 1)
    surge = next(c for c in town.game.cues if c["k"] == "surge" and c["t"] > town.el)
    town.ride(surge["t"] - town.el)
    coins = town.game.cos["r1"]["coins"]
    town.ride(surge["end"] - surge["t"] + 1, lambda r, b, el: 0.8)
    assert town.game.cos["r1"]["coins"] - coins < G.CLIM_SURGE["pay"] / 2


def test_tonnes_follow_fuel_and_effort():
    town = Town()
    town.to("decade", 1, -20)
    for rid, f in (("r1", "gas"), ("r2", "solar"), ("r3", "wind")):
        town.game.cos[rid]["coins"] = 100
        town.act(rid, "fuel", f)
    town.to("decade", 1, 1)
    e0 = dict(town.game.emit_t)
    town.ride(30, lambda r, b, el: 0.8)
    d = {rid: town.game.emit_t[rid] - e0[rid] for rid in e0}
    assert d["r0"] == pytest.approx(0.8 * 30, rel=0.02) and d["r1"] == pytest.approx(d["r0"] / 2, rel=0.02)
    assert d["r2"] == pytest.approx(d["r0"] / 10, rel=0.02) and d["r3"] == 0


def test_leaving_coal_costs_less_each_decade_and_going_back_is_free():
    assert [fuel_cost("coal", "solar", n) for n in (1, 2, 3, 4)] == [35, 28, 21, 16]
    assert fuel_cost("solar", "coal", 2) == 0 and fuel_cost("gas", "gas", 1) == 0
    town = Town()
    town.to("decade", 1, -20)
    town.game.cos["r0"]["coins"] = 50
    q = town.ask("r0")
    assert q["k"] == "fuel" and q["v"] == "coal" and 15 <= q["left"] <= 20
    off = {o["v"]: o.get("off") for o in q["opts"]}
    assert off == {"coal": False, "gas": False, "solar": False, "wind": False}
    town.game.cos["r0"]["coins"] = 30
    assert {o["v"]: o["off"] for o in town.ask("r0")["opts"]}["solar"]
    town.act("r0", "fuel", "gas")
    assert town.ask("r0")["v"] == "gas"
    coins = town.game.cos["r0"]["coins"]
    town.to("decade", 1, 1)
    assert town.game.cos["r0"]["fuel"] == "gas" and town.game.cos["r0"]["coins"] < coins - 15
    assert town.game.switched == {"r0": 1} and town.ask("r0") is None


def test_a_fuel_you_can_no_longer_afford_when_the_decade_starts_is_not_fitted():
    town = Town()
    town.to("decade", 1, -20)
    town.game.cos["r0"]["coins"] = 40
    town.act("r0", "fuel", "wind")
    town.game.cos["r0"]["coins"] = 10
    town.to("decade", 1, 1, lambda r, b, el: 0.0)
    assert town.game.cos["r0"]["fuel"] == "coal"


def test_the_fuel_question_is_only_open_before_a_decade():
    town = Town()
    town.ride(30)
    assert town.ask("r0") is None
    town.act("r0", "fuel", "gas")
    assert town.game.next_fuel == {}
    town.to("decade", 4, G.CLIM_DECADE_S - 20)  # the 2020s are the last decade
    assert town.ask("r0") is None


def test_a_scaled_game_keeps_the_full_economy():
    full, small = Town(), Town(scale=0.125)
    full.to("decade", 1)
    small.to("decade", 1)
    assert small.game.cos["r0"]["coins"] == pytest.approx(full.game.cos["r0"]["coins"], rel=0.05)
    assert small.game.emit_t["r0"] == pytest.approx(full.game.emit_t["r0"], rel=0.05)


def test_the_tick_view_has_every_field_the_hud_reads():
    town = Town()
    town.to("decade", 2, 30)
    v = town.view()
    want = {"g", "phase", "decade", "n", "level", "stage", "stageName", "walls", "wallCost"}
    assert want | {"cos", "event", "cue", "trial", "ledger", "flooded"} <= set(v)
    assert v["g"] == "climate" and v["decade"] == "2000s" and v["n"] == 2 and v["ledger"] is None
    assert set(v["cos"]["r0"]) == {"name", "fuel", "coins", "on"}
    assert town.game.event(town, locate(town.plan["blocks"], town.el)[0]) == "decade"
    assert DT > 0 and kinds([]) == [] and mid((0, 2)) == 1

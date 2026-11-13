"""Road rides without sockets: the sim, its rules, the bots and the snapshot."""

import asyncio
import random

import pytest

from zombie_bus_server import config as C
from zombie_bus_server import road_bots
from zombie_bus_server.modes.road import RoadSim
from zombie_bus_server.road_room import RoadRoom
from zombie_bus_server.session import Rider

DT = 1 / C.ROAD_TICK_HZ
FOUR = [(300, 80), (280, 60), (250, 75), (200, 90)]  # watts, kg


def ride(sim: RoadSim, secs: float) -> None:
    for _ in range(round((secs - min(sim.el, 0)) / DT)):
        sim.step(DT)


def four(route: str, laps: int = 1, together: bool = False) -> RoadSim:
    sim = RoadSim(route, laps, together)
    for k, (w, kg) in enumerate(FOUR):
        sim.add(f"r{k}", kg, 250).p = w
    return sim


def test_countdown_holds_everyone_on_the_line():
    sim = four("nundah-crit")
    for _ in range(C.COUNTDOWN_S * C.ROAD_TICK_HZ - 1):
        sim.step(DT)
    assert sim.el < 0 and all(m.d == 0 and m.v == 0 for m in sim.movers.values())
    ride(sim, 5)
    assert all(m.d > 0 for m in sim.movers.values())


def test_more_watts_per_kilo_wins_uphill():
    sim = four("willunga-hill")
    while not sim.rules.over(sim):
        sim.step(DT)
    rows = sim.rules.results(sim)
    assert [r["id"] for r in rows] == ["r1", "r0", "r2", "r3"]
    assert [r["place"] for r in rows] == [1, 2, 3, 4]
    assert all(r["time"] and r["dist"] == sim.road.distance and not r["late"] for r in rows)
    assert rows[0]["avgPower"] == pytest.approx(280, abs=3) and rows[0]["wkg"] == pytest.approx(
        4.67, abs=0.05
    )
    assert rows[0]["time"] < rows[1]["time"] < rows[2]["time"] < rows[3]["time"]


def pair(monkeypatch, wheel: float) -> RoadSim:
    """A 250 W leader and a 215 W follower of the same weight, started on the wheel at speed."""
    monkeypatch.setattr(C, "DRAFT_WHEEL", wheel)
    sim = RoadSim("beach-road")
    lead, follow = sim.add("lead", 75, 250), sim.add("follow", 75, 250)
    lead.p, follow.p = 250, 215
    ride(sim, 0)
    lead.d, lead.v, follow.d, follow.v = 501.0, 10.0, 500.0, 10.0
    ride(sim, 120)
    return sim


def test_drafting_saves_power_for_a_follower(monkeypatch):
    sim = pair(monkeypatch, C.DRAFT_WHEEL)
    lead, follow = sim.movers["lead"], sim.movers["follow"]
    assert 0 < lead.d - follow.d < C.DRAFT_REACH_M  # still on the wheel with 35 W less
    assert follow.draft < 1 and lead.draft == 1
    saved = next(r for r in sim.rules.results(sim) if r["id"] == "follow")["saved"]
    assert saved > 15
    alone = pair(monkeypatch, 0.0)
    assert alone.movers["lead"].d - alone.movers["follow"].d > 3 * C.DRAFT_REACH_M  # dropped without it


def test_a_bunch_drafts_better_than_one_wheel():
    sim = four("beach-road")
    ride(sim, 0)
    for k, m in enumerate(sim.movers.values()):
        m.d, m.v = 400 - 2.0 * k, 10.0
    sim.step(DT)
    drafts = [m.draft for m in sim.movers.values()]
    assert drafts[0] == 1 and drafts[1] > drafts[2] > drafts[3] >= 1 - C.DRAFT_CAP
    assert {m.lane for m in sim.movers.values()} == set(C.ROAD_LANES)


def test_keep_together_narrows_the_gaps():
    def spread(together: bool) -> float:
        sim = four("nundah-crit", 5, together)
        ride(sim, 300)
        ds = [m.d for m in sim.movers.values()]
        assert all(1 - C.BAND_MAX <= m.band <= 1 + C.BAND_MAX for m in sim.movers.values())
        return max(ds) - min(ds)

    apart, banded = spread(False), spread(True)
    assert banded < apart * 0.6
    assert banded < C.BAND_FULL_M * 2


def test_the_band_never_changes_the_physics_speed():
    free, band = four("nundah-crit", 5, False), four("nundah-crit", 5, True)
    for sim in (free, band):
        sim.movers["r3"].p = 0  # a rider who stops just stops
        ride(sim, 60)
    assert band.movers["r3"].v == free.movers["r3"].v == 0 and band.movers["r3"].st == "stopped"
    assert band.movers["r3"].band == 1  # a stopped rider does not drag the group back
    assert band.movers["r0"].d > 300


def test_late_joiner_starts_on_the_back_of_the_group():
    sim = four("nundah-crit", 5)
    ride(sim, 90)
    back = min(m.d for m in sim.movers.values())
    late = sim.add("late", 70, 220)
    assert late.d == pytest.approx(back - C.ROAD_LATE_GAP_M) and late.v > 3 and late.start_el == sim.el
    ride(sim, 100)
    row = next(r for r in sim.rules.results(sim) if r["id"] == "late")
    assert row["late"] and row["dist"] < sim.movers["late"].d


def test_ride_ends_when_the_humans_present_are_home():
    sim = four("nundah-crit")
    sim.movers["r3"].here = False  # walked off; nobody waits for them
    sim.add("bot-dave", 84, 200, bot=True).p = 50
    fx = []
    while not sim.rules.over(sim):
        fx += sim.step(DT)
    assert [f["k"] for f in fx].count("finish") >= 3 and fx[0]["text"] == "1"
    rows = {r["id"]: r for r in sim.rules.results(sim)}
    assert rows["bot-dave"]["time"] is None and rows["bot-dave"]["dist"] < sim.road.distance
    assert rows["r0"]["place"] < rows["bot-dave"]["place"]


def test_snapshot_round_trip():
    sim = four("nundah-crit", 3, True)
    ride(sim, 40)
    back = RoadSim.from_dict(sim.to_dict())
    assert back.riders() == sim.riders() and back.el == sim.el and back.road.laps == 3
    sim.step(DT)
    back.step(DT)
    assert back.riders() == sim.riders()


def test_bots_have_personalities():
    sim = RoadSim("willunga-hill")
    ride(sim, 200)
    rng = random.Random(1)
    m = sim.add("bot-x", 70, 250, bot=True)
    m.d = 1000
    watts = {k: road_bots.bot_power(k, 250, sim, m, rng) / 250 for k in C.ROAD_BOT_X}
    assert watts["climber"] > 0.9 > watts["diesel"] > 0.7  # 7% is the goat's moment
    assert watts["sucker"] > 0.78
    m.draft = 0.8
    assert road_bots.bot_power("sucker", 250, sim, m, rng) / 250 < 0.72
    m.d = sim.road.distance - 100
    assert road_bots.bot_power("sprinter", 250, sim, m, rng) / 250 > 2
    sim.el = C.ROAD_BOT_X["surger"]["every_s"] * 2 + 1
    assert road_bots.bot_power("surger", 250, sim, m, rng) / 250 > 1.1


def test_bots_fill_the_room_and_copy_the_humans_fitness():
    room = RoadRoom("TEST")
    room.riders["a"] = Rider("a", "A", 300, "hard", connected=True)
    road_bots.set_bots(room, 9)
    bots = [r for r in room.riders.values() if r.bot]
    assert len(bots) == len(C.ROAD_BOTS) and all(len(r.name) <= 24 for r in bots)
    wkg = 300 / C.ROAD_DEFAULT_KG
    assert all(r.ftp == pytest.approx(wkg * room.kg_of(r.id), rel=0.06) for r in bots)
    lobby = room.lobby_msg()
    assert all(x["line"] for x in lobby["riders"] if x["bot"]) and lobby["kind"] == "road"
    road_bots.set_bots(room, 2)
    assert sum(r.bot for r in room.riders.values()) == 2

    async def go() -> dict:
        room.start()
        room.task.cancel()
        return [room.step(DT) for _ in range(200)][-1]

    tick = asyncio.run(go())
    assert all(v["d"] > 100 for k, v in tick["riders"].items() if k != "a")
    assert "tgt" not in str(tick)
    back = RoadRoom.from_dict(room.to_dict())
    assert back.paused and back.sim and back.sim.riders().keys() == tick["riders"].keys()

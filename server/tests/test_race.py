"""Road races without sockets: finish order, laps, bells, the bots racing it out."""

import asyncio
import time

from zombie_bus_server import config as C
from zombie_bus_server import road_bots
from zombie_bus_server.modes.road import RoadSim
from zombie_bus_server.road_room import RoadRoom
from zombie_bus_server.session import Rider

DT = 1 / C.ROAD_TICK_HZ
FOUR = [(300, 80), (280, 60), (250, 75), (200, 90)]  # watts, kg


def racers(game: str, laps: int = 3, route: str = "nundah-crit", seed: int = 1) -> RoadSim:
    sim = RoadSim(route, laps, True, game, seed=seed)
    for k, (w, kg) in enumerate(FOUR):
        sim.add(f"r{k}", kg, 250).p = w
    return sim


def race_out(sim: RoadSim) -> list[dict]:
    fx: list[dict] = []
    while not sim.rules.over(sim):
        fx += sim.step(DT)
    return fx


def test_a_race_is_first_across_the_line_after_the_laps():
    sim = racers("race")
    assert not sim.together  # keep-together never runs in a race
    fx = race_out(sim)
    rows = sim.rules.results(sim)
    by_fin = sorted(sim.movers, key=lambda i: sim.movers[i].fin)
    assert [r["id"] for r in rows] == by_fin and by_fin[-1] == "r3"
    assert all(m.d == sim.road.distance == 3 * sim.road.lap.distance for m in sim.movers.values())
    assert rows[0]["gap"] == 0 <= rows[1]["gap"] < rows[2]["gap"] < rows[3]["gap"]
    assert rows[1]["gap"] == round(rows[1]["time"] - rows[0]["time"], 1)
    bells = [f["text"] for f in fx if f["k"] == "bell"]
    assert bells == ["LAST LAP"]
    assert sim.rules.state(sim) == {"kind": "race", "lap": 3, "laps": 3}
    assert sim.rules.extra(sim, rows)["podium"] == by_fin[:3]


def test_a_race_waits_for_the_podium_then_ends():
    sim = racers("race", 1)
    for m in list(sim.movers.values())[1:]:
        m.bot = True
    sim.movers["r3"].p = 0  # never gets there
    while sim.movers["r0"].fin is None:
        sim.step(DT)
    assert not sim.rules.over(sim)  # the human is home but the podium is not full
    race_out(sim)
    assert sum(m.fin is not None for m in sim.movers.values()) == 3


def test_race_state_survives_a_snapshot():
    sim = racers("race")
    while sim.rules.lead < 1:
        sim.step(DT)
    back = RoadSim.from_dict(sim.to_dict())
    assert back.game == "race" and back.rules.lead == 1 and not back.together


def bot_room(game: str, laps: int) -> RoadRoom:
    room = RoadRoom("RACE")
    room.riders["h"] = Rider("h", "H", 250, "hard", connected=True)
    road_bots.set_bots(room, 3)
    room.route, room.laps, room.game = "nundah-crit", laps, game
    return room


def run_room(room: RoadRoom) -> None:
    async def go():
        room.start()
        room.task.cancel()
        h = room.riders["h"]
        while not room.sim.rules.over(room.sim):
            h.p, h.last_data = 240, time.monotonic()
            room.step(DT)
        await room.finish()

    asyncio.run(go())


def test_four_riders_race_to_the_end_with_bots():
    room = bot_room("race", 2)
    run_room(room)
    s = room.summary
    assert s["game"] == "race" and len(s["riders"]) == 4 and len(s["podium"]) == 3
    assert s["riders"][0]["gap"] == 0 and s["riders"][0]["id"] == s["podium"][0]
    assert room.lobby_msg()["game"] == "race"


def spread(sim: RoadSim) -> RoadSim:
    """No wheels to sit on and a big spread of watts: the same order every lap."""
    sim.drafting = "off"
    for k, m in enumerate(sim.movers.values()):
        m.p = 400 - 90 * k
    return sim


def test_points_on_every_lap_double_on_the_last():
    sim = spread(racers("points"))
    fx = race_out(sim)
    pts = sim.rules.pts
    assert sorted(pts.values(), reverse=True) == [20, 12, 8, 4]  # 5+5+10, 3+3+6, 2+2+4, 1+1+2
    got = sorted(f["text"] for f in fx if f["k"] == "points")
    assert got == sorted(["+5", "+3", "+2", "+1"] * 2 + ["+10", "+6", "+4", "+2"])
    bells = [f["text"] for f in fx if f["k"] == "bell"]
    assert bells == ["SPRINT 1 · POINTS", "SPRINT 2 · POINTS", "LAST LAP", "FINAL SPRINT · DOUBLE POINTS"]
    rows = sim.rules.results(sim)
    assert [r["pts"] for r in rows] == [20, 12, 8, 4] and rows[0]["line"] == 1
    assert sim.rules.state(sim)["pts"] == pts
    extra = sim.rules.extra(sim, rows)
    assert extra["award"] == {"kind": "points", "id": rows[0]["id"]} and extra["podium"][0] == rows[0]["id"]


def test_points_ties_go_to_the_better_finish():
    sim = spread(racers("points", 2))
    race_out(sim)
    line = [r["id"] for r in by_line(sim)]
    sim.rules.pts = {line[3]: 9, line[1]: 9, line[0]: 1}
    rows = sim.rules.results(sim)
    assert [r["id"] for r in rows] == [line[1], line[3], line[0], line[2]]
    assert sim.rules.extra(sim, rows)["podium"] == line[:3]  # the podium is still the line


def by_line(sim: RoadSim) -> list[dict]:
    return sorted(sim.rules.results(sim), key=lambda r: r["line"])


def test_points_survive_a_snapshot_and_a_late_joiner_scores_only_what_they_ride():
    sim = racers("points", 4)
    while sim.rules.lead < 1:
        sim.step(DT)
    late = sim.add("late", 70, 250)
    late.p, late.d = 400, max(m.d for m in sim.movers.values())
    back = RoadSim.from_dict(sim.to_dict())
    assert back.rules.pts == sim.rules.pts and back.rules.seen == sim.rules.seen
    race_out(back)
    assert back.rules.n == {"1": 4, "2": 5, "3": 5, "4": 5}  # the late joiner missed the first line


def test_four_riders_points_race_with_bots():
    room = bot_room("points", 3)
    run_room(room)
    s = room.summary
    assert s["game"] == "points" and s["award"]["kind"] == "points"
    assert sum(r["pts"] for r in s["riders"]) >= 11 * 2 + 20  # the fourth may still be out at the end


def test_the_crit_prime_is_one_lap_around_halfway():
    for laps in (1, 2, 5, 10, 20):
        primes = {racers("crit", laps, seed=s).rules.prime for s in range(200)}
        lo, hi = round(laps * 0.4), round(laps * 0.6)
        assert primes <= set(range(max(1, min(lo, laps - 1)), max(1, min(hi, laps - 1)) + 1))
        assert laps < 2 or primes.isdisjoint({laps})  # never the finish when there is a choice
    assert len({racers("crit", 20, seed=s).rules.prime for s in range(200)}) > 2  # it moves about


def test_crit_rings_the_prime_and_crowns_its_winner():
    sim = spread(racers("crit", 6, seed=3))
    prime = sim.rules.prime
    fx = race_out(sim)
    bells = [(f["text"], f["id"]) for f in fx if f["k"] == "bell"]
    first = next(r["id"] for r in sim.rules.results(sim))  # the strongest takes everything here
    assert bells == [("PRIME NEXT LAP", None), ("PRIME!", first), ("LAST LAP", None)]
    assert sim.rules.prime_by == first and sim.rules.state(sim)["prime"] == prime
    rows = sim.rules.results(sim)
    assert [r["prime"] for r in rows] == [True, False, False, False]
    assert sim.rules.extra(sim, rows)["award"] == {"kind": "prime", "id": first}


def test_a_weaker_rider_can_take_the_prime_and_still_lose():
    sim = spread(racers("crit", 4, seed=1))
    prime_at = sim.rules.prime * sim.road.lap.distance
    sim.movers["r3"].d = prime_at - 1  # a breakaway just short of the prime line
    while sim.rules.prime_by is None:
        sim.step(DT)
    sim.movers["r3"].p = 60  # then blows up
    race_out(sim)
    rows = sim.rules.results(sim)
    assert sim.rules.prime_by == "r3" and rows[0]["id"] == "r0"
    back = RoadSim.from_dict(sim.to_dict())
    assert back.rules.prime_by == "r3" and back.rules.prime == sim.rules.prime


def test_four_riders_crit_with_bots():
    room = bot_room("crit", 8)
    run_room(room)
    s = room.summary
    assert s["game"] == "crit" and s["award"]["kind"] == "prime" and len(s["podium"]) == 3
    assert sum(r["prime"] for r in s["riders"]) == 1


def test_a_slow_human_is_not_cut_off_when_the_bots_finish():
    sim = racers("race", 1)
    for m in list(sim.movers.values())[:3]:
        m.bot = True
    slow = sim.movers["r3"]
    slow.p = 0  # stopped until well after the grace
    while sim.first_fin is None or sim.el - sim.first_fin <= C.RACE_GRACE_S + 5:
        sim.step(DT)
    assert slow.fin is None and not sim.rules.over(sim)  # well past the grace, still racing
    slow.p = 250
    race_out(sim)
    assert slow.fin is not None

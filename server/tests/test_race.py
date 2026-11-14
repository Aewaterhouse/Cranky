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

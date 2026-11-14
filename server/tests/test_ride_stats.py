import asyncio
import time

from zombie_bus_server import config as C
from zombie_bus_server.ride_stats import RideStats, on_target, profile_kg
from zombie_bus_server.session import Rider, Room

DT = 1 / C.TICK_HZ


def ride(stats, watts, secs):
    for _ in range(round(secs * C.TICK_HZ)):
        stats.sample(watts, DT)


def test_average_and_kj():
    s = RideStats()
    ride(s, 200, 60)
    ride(s, 100, 60)
    assert s.avg == 150
    assert s.report(250, 75.0, None, 0)["kj"] == 18.0  # 200 W x 60 s + 100 W x 60 s


def test_np_equals_steady_power_and_beats_average_when_surging():
    steady = RideStats()
    ride(steady, 200, 120)
    assert round(steady.np) == 200
    surgy = RideStats()
    for _ in range(4):
        ride(surgy, 400, 60)
        ride(surgy, 0, 60)
    assert round(surgy.avg) == 200
    assert surgy.np > 260
    assert len(surgy.rs_roll) == C.NP_WINDOW_S


def test_time_on_target_and_falls_in_the_report():
    assert on_target(0, 0) is None
    assert on_target(30, 120) == 0.5  # 30 s on target out of 60 s scored
    r = RideStats().report(250, None, on_target(45, 120), 2)
    assert r["on"] == 0.75
    assert r["falls"] == 2
    assert r["kg"] is None


def test_no_weight_unless_the_profile_has_one():
    class Store:
        def get_profile(self, rid):
            return {"a": {"weightKg": 72}, "b": {"weightKg": 0}, "c": {}}.get(rid)

    assert profile_kg(Store(), "a") == 72.0
    assert profile_kg(Store(), "b") is None
    assert profile_kg(Store(), "c") is None
    assert profile_kg(Store(), "nobody") is None
    assert profile_kg(None, "a") is None


def test_rider_snapshot_round_trips_and_reset_clears_the_ride():
    r = Rider("a", "A", 250, "hard", kg=70.0)
    ride(r, 300, 10)
    back = Rider.from_dict(r.to_dict())
    assert back.avg == 300
    back.reset_stats()
    assert back.avg == 0 and back.kg == 70.0


def test_room_sends_the_ride_so_far_once_a_second():
    class Ws:
        async def send_json(self, m):
            pass

    class Store:
        def get_profile(self, rid):
            return {"weightKg": 80} if rid == "r0" else None

        def save_room(self, code, d):
            pass

    async def go():
        room = Room("STAT", Store())
        for i in range(2):
            await room.handle(f"r{i}", Ws(), {"t": "join", "name": f"R{i}", "ftp": 200, "tier": "hard"})
        ticks = []
        for _ in range(20):
            for r in room.riders.values():
                r.p, r.w, r.s, r.last_data = 250, 250, 1.0, time.monotonic()
            room.el += DT
            ticks.append(room.step(DT))
        with_stats = [t for t in ticks if t["stats"]]
        assert len(with_stats) == len(ticks) // C.TICK_HZ
        s = with_stats[-1]["stats"]
        assert s["r0"]["kg"] == 80 and s["r1"]["kg"] is None
        assert s["r0"]["ftp"] == 200 and s["r0"]["avg"] == 250
        assert s["r0"]["kj"] == 2.5  # 250 W for 10 s

    asyncio.run(go())

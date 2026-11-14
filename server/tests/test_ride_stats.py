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


def shaped(watts: list[float], ftp=200) -> Rider:
    r = Rider("a", "A", ftp, "hard")
    for w in watts:
        for _ in range(C.TICK_HZ):
            r.sample(w, DT, ftp)
    return r


def test_steady_power_is_smooth_and_surging_is_not():
    steady, wobbly = shaped([200] * 120), shaped([180, 220] * 60)
    surger = shaped(([180] * 20 + [300] * 10) * 4)
    assert steady.spread(200) == 0 and steady.rs_spikes == 0 and steady.rs_dev == 0
    assert 0 < wobbly.spread(200) < 0.05 and wobbly.rs_spikes == 0  # 3 s power smooths a 1 s wobble
    assert surger.spread(200) > wobbly.spread(200)
    assert surger.rs_spikes == 4  # one per surge, however long it lasts
    assert surger.shape(200) == {"spread": round(100 * surger.spread(200), 1), "spikes": 4, "punished": 0}


def test_a_spike_is_measured_against_the_riders_own_ftp():
    assert shaped([150] * 40 + [185] * 10, ftp=200).rs_spikes == 1  # 35 W is over 15% of 200
    assert shaped([150] * 40 + [185] * 10, ftp=300).rs_spikes == 0
    assert shaped([150] * 40 + [185] * 10, ftp=0).rs_spikes == 0  # no FTP given: not counted


def test_punished_time_adds_up_and_survives_a_snapshot():
    r = shaped([200] * 5)
    r.punish(30)
    r.punish(0.5)
    back = Rider.from_dict(r.to_dict())
    assert back.rs_punished == 30.5 and back.rs_p3 == r.rs_p3 and back.shape(200)["punished"] == 30
    back.reset_stats()
    assert back.rs_punished == 0 and back.rs_p3 == []


def test_shape_awards_pick_smoothest_spikiest_and_most_punished():
    from zombie_bus_server.modes.common import shape_awards

    a, b, c = shaped([200] * 90), shaped(([180] * 20 + [300] * 10) * 3), shaped([200, 210] * 10)
    a.id, b.id, c.id = "a", "b", "c"
    b.punish(45)
    awards: list[dict] = []
    shape_awards(awards, [a, b, c], ("Paramedic of the Week", "Learner Driver", "Lead Foot"))
    assert [(x["award"], x["id"]) for x in awards] == [
        ("Paramedic of the Week", "a"),
        ("Learner Driver", "b"),
        ("Lead Foot", "b"),
    ]
    none: list[dict] = []
    shape_awards(none, [c])  # too short a ride to judge, no spikes, no punishment
    assert none == []

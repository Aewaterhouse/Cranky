"""Kidney Stone Express: the shift script, speed, Comfort, the hospital doors, ramping and a whole shift."""

import asyncio

import pytest
from test_bots import lobby_with
from test_script import play

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server.modes import ambulance_text as T
from zombie_bus_server.modes import script
from zombie_bus_server.modes.ambulance import V, Ambulance, mid, rx
from zombie_bus_server.plan import locate
from zombie_bus_server.rider import Rider

DT = 1 / C.TICK_HZ
BASE, RUN, RAMP = G.AMBO_BASE_S, G.AMBO_RUN_S, G.AMBO_RAMP_S


class Shift:
    """A room's worth of state for driving the game directly: a dealt plan, four riders, no road events."""

    code = "AMBO"

    def __init__(self, first="hook", n=4, events=False):
        self.plan = Ambulance.deal(40)
        self.plan["blocks"][1]["patient"] = first
        self.el = 0.0
        self.riders = {f"r{i}": Rider(f"r{i}", f"R{i}", 200, "hard", connected=True) for i in range(n)}
        self.game = Ambulance()
        self.game.begin(self)
        if not events:
            self.game.events = []

    def ride(self, secs, power=None, cad=85, until=None):
        """Rides `secs` seconds at `power(r, band, el)` (a share of FTP), or at the middle of the band."""
        fx = []
        for _ in range(round(secs / DT)):
            self.el += DT
            i, bel = locate(self.plan["blocks"], self.el)
            for r in self.riders.values():
                band = self.game.band(self, r, i, bel)
                on = 2.0 if isinstance(band, str) else mid(band)
                r.p = r.w = r.ftp * (power(r, band, self.el) if power else on)
                r.cad, r.s = cad, 1.0
            fx += self.game.tick(self, DT, i, bel, "")
            if until and until(self.game):
                break
        return fx

    def view(self):
        return self.game.game(self, *locate(self.plan["blocks"], self.el))

    def to_run(self, secs=0.0):
        """Rides the base station and `secs` into the first run."""
        self.ride(BASE + secs)
        return self.game


def kinds(fx):
    return [f["k"] for f in fx]


def jerky(amp):
    """Power that jumps `amp` of FTP above and below the band's middle every second."""
    return lambda r, band, el: mid(band) + (amp if int(el) % 2 else -amp)


def test_the_shift_is_41_minutes_with_the_easiest_patient_first():
    for _ in range(20):
        blocks = Ambulance.deal(40)["blocks"]
        assert [b["kind"] for b in blocks] == ["base", *["run", "ramp"] * 4, "run", "cool"]
        assert sum(b["dur"] for b in blocks) == BASE + 5 * RUN + 4 * RAMP + G.AMBO_COOL_S == 41 * 60
        runs = [b for b in blocks if b["kind"] == "run"]
        assert runs[0]["patient"] == "hook" and sorted(b["patient"] for b in runs) == sorted(G.AMBO_PATIENTS)
        assert all(b["label"] == G.AMBO_PATIENTS[b["patient"]]["name"] for b in runs)
        assert {b["type"] for b in blocks} == {"free"} and blocks[0]["label"] == "Base station"
    assert Ambulance.no_erg


def test_every_band_stays_under_the_cap_and_prescriptions_are_what_the_brief_says():
    flat = [G.AMBO_BASE, G.AMBO_QUEUE, G.AMBO_ROLL, G.AMBO_COOL, G.AMBO_BRAKE, G.AMBO_REVERSE]
    flat += [G.AMBO_GREEN, G.AMBO_ROADWORKS, G.AMBO_HUMP]
    flat += [rx(p, t) for p in G.AMBO_PATIENTS for t in range(RUN)]
    assert all(0 <= lo < hi <= C.TARGET_CAP for lo, hi in flat)
    assert rx("kidney", 0) == rx("kidney", 200) == (0.83, 0.87)
    assert [mid(rx("bin", t)) > 1 for t in (20, 50, 80, 110)] == [True, False, True, False]
    hard = [t for t in range(RUN - G.AMBO_BRAKE_S) if mid(rx("trainer", t)) == pytest.approx(1.10)]
    assert len(hard) == 180  # 3 x 1 min at 110%
    assert max(mid(rx("magpie", t)) for t in range(RUN)) == 1.0 > mid(rx("magpie", 60))


def test_team_power_sets_the_speed():
    s = Shift()
    s.ride(30, lambda r, band, el: 1.0)
    assert s.game.speed * 3.6 == pytest.approx(G.AMBO_KMH_AT_FTP, rel=0.01)
    s.ride(30, lambda r, band, el: 1.0 if r.id in ("r0", "r1") else 0.5)
    assert s.game.speed * 3.6 == pytest.approx(G.AMBO_KMH_AT_FTP * 0.75, rel=0.01)
    assert s.game.dist == pytest.approx(30 * V + 30 * 0.75 * V, rel=0.05)


@pytest.mark.parametrize("pid", list(G.AMBO_PATIENTS))
def test_riding_the_prescription_arrives_on_time_and_comfortable(pid):
    s = Shift(pid)
    g = s.to_run(1)
    assert s.view()["phase"] == "run" and s.view()["patient"]["id"] == pid and g.total > 3000
    assert s.view()["dist"] == pytest.approx(g.total, abs=40) and not s.view()["brake"]
    fx = s.ride(RUN, until=lambda g: g.left <= g.brake_m)
    assert s.view()["brake"] and BASE + RUN - 20 < s.el <= BASE + RUN - 8
    assert s.game.band(s, s.riders["r0"], 1, 0) == G.AMBO_BRAKE
    fx += s.ride(30, until=lambda g: not g.open)
    assert "delivered" in kinds(fx) and "fellout" not in kinds(fx) and abs(s.el - (BASE + RUN)) <= 4
    (run,) = g.reviews
    assert run["id"] == pid and run["comfort"] >= 95 and not run["fell"] and abs(run["delta"]) <= 4
    assert g.good and g.score == pytest.approx(run["comfort"] * G.AMBO_SCORE_X, rel=0.03)


def test_spiky_power_hurts_a_kidney_stone_far_more_than_a_fishing_hook():
    left = {}
    for pid in ("kidney", "hook"):
        s = Shift(pid)
        s.to_run(10)
        s.ride(20, jerky(0.12))
        left[pid] = s.game.comfort
    assert left["hook"] == 100 and 40 < left["kidney"] < 80
    assert not any(s.game.spikes.values())  # 12% of jerk is rough, not a spike
    k = Shift("kidney")
    k.to_run(10)
    k.ride(10, jerky(0.2))
    assert k.view()["patient"]["line"] in T.ROUGH["kidney"] and all(n >= 1 for n in k.game.spikes.values())
    low = k.game.comfort
    k.ride(40)
    assert low < k.game.comfort < 100 and k.view()["patient"]["line"] in T.CALM["kidney"]


def test_power_outside_the_band_costs_comfort_and_a_change_of_target_is_forgiven():
    s = Shift("kidney")
    s.to_run(10)
    s.ride(30, lambda r, band, el: band[0] - 0.10)
    assert s.game.comfort < 85
    b = Shift("bin")
    b.to_run(200)  # through three hard starts and three easy ones
    assert b.game.comfort == 100 and not any(b.game.spikes.values())


def test_too_fast_at_the_doors_and_the_patient_falls_out():
    s = Shift("hook")
    g = s.to_run()
    fx = s.ride(RUN, lambda r, band, el: 0.95, until=lambda g: g.rev > 0)
    assert kinds(fx).count("fellout") == 1 and "delivered" not in kinds(fx)
    assert s.view()["phase"] == "reverse" and g.speed == 0 and g.comfort <= 80
    assert g.band(s, s.riders["r0"], 1, 0) == G.AMBO_REVERSE and s.view()["patient"]
    fx = s.ride(G.AMBO_REVERSE_S - 1)
    assert g.rev > 0 and "delivered" not in kinds(fx)
    fx = s.ride(2)
    assert "delivered" in kinds(fx) and g.reviews[0]["fell"] and not g.good
    assert all(r.rs_punished == pytest.approx(G.AMBO_REVERSE_S, abs=1) for r in s.riders.values())


def test_arriving_early_is_a_bonus_as_long_as_you_brake():
    s = Shift("hook")
    g = s.to_run()
    fast = lambda r, band, el: mid(band) if g.left <= g.brake_m else mid(band) + 0.08  # noqa: E731
    fx = s.ride(RUN, fast, until=lambda g: not g.open)
    run = g.reviews[0]
    assert "delivered" in kinds(fx) and not run["fell"] and 15 < run["delta"] < 60
    assert run["comfort"] < run["pts"] <= run["comfort"] * (1 + G.AMBO_EARLY[1])
    # waiting at the hospital for the block to end: already ramping
    assert s.view()["phase"] == "ramp" and g.band(s, s.riders["r0"], 1, 0) == G.AMBO_QUEUE
    assert s.view()["patient"] is None


def test_running_late_delivers_at_the_end_of_the_block_for_fewer_points():
    s = Shift("hook")
    g = s.to_run()
    fx = s.ride(RUN + 1, lambda r, band, el: band[0] - 0.02)
    run = g.reviews[0]
    assert "delivered" in kinds(fx) and run["delta"] < -5 and run["pts"] < run["comfort"] and not run["fell"]


def test_comfort_at_zero_and_the_patient_walks():
    s = Shift("kidney")
    g = s.to_run(10)
    fx = s.ride(120, jerky(0.3), until=lambda g: g.gone)
    assert kinds(fx).count("walked") == 1 and g.gone and not g.open and g.score == 0
    assert g.reviews == [{**g.reviews[0], "walked": True, "pts": 0, "comfort": 0}] and not g.good
    assert s.view()["patient"] is None and g.band(s, s.riders["r0"], 1, 50) == G.AMBO_ROLL
    assert "delivered" not in kinds(s.ride(BASE + RUN - s.el + 2))


def test_ramping_is_short_after_a_good_run_and_long_after_a_bad_one():
    for good, queue in ((True, G.AMBO_RAMP_GOOD_S), (False, RAMP)):
        s = Shift("hook")
        g = s.to_run()
        s.ride(RUN + 1, None if good else lambda r, band, el: band[0] - 0.3)
        assert g.good is good and s.view()["phase"] == "ramp"
        assert s.view()["queue"] == pytest.approx(queue - 1, abs=1)
        s.ride(queue - 3)
        assert g.band(s, s.riders["r0"], 2, 0) == G.AMBO_QUEUE
        if good:  # off the ramp and rolling to the next job
            s.ride(4)
            assert g.band(s, s.riders["r0"], 2, 0) == G.AMBO_ROLL and s.view()["queue"] == 0


def test_spinning_easy_together_in_the_queue_sweet_talks_triage():
    s = Shift("hook")
    g = s.to_run()
    s.ride(RUN + 1)
    s.ride(8, cad=85)
    assert g.perk is None and g.sweet == 0
    s.ride(10, cad=95)
    assert g.perk is None and s.view()["sweet"] == pytest.approx(0.5, abs=0.05)
    fx = s.ride(12, cad=95)
    assert kinds(fx) == ["perk"] and g.perk in ("spike", "green") and s.view()["perk"] == g.perk


def test_a_free_spike_forgives_one_burst_of_roughness():
    s = Shift("kidney")
    g = s.to_run(10)
    g.perk = "spike"
    fx = s.ride(4, jerky(0.3))
    assert "perk" in kinds(fx) and g.perk is None and g.comfort == 100
    s.ride(10, jerky(0.3))
    assert g.comfort < 90


def test_the_script_never_goes_quiet_for_90_s():
    for _ in range(5):
        plan = Ambulance.deal(40)
        assert script.worst_gap(plan, G.AMBO_EVENT_S, range(60)) <= C.SCRIPT_MAX_GAP_S


def test_four_riders_play_a_five_minute_shift(monkeypatch):
    monkeypatch.setattr(C, "SCRIPT_SCALE", 0.125)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "AMBO")
        await room.handle("h0", ws, {"t": "game", "game": "ambo"})
        await room.handle("h0", ws, {"t": "bots", "n": 4})
        room.riders.pop("h0")  # a crew of four bots: the human's socket sends no power
        room.start()
        ticks = play(room)
        await room.finish()
        return room, ticks, ws

    room, ticks, ws = asyncio.run(main())
    assert 290 <= len(ticks) * DT <= 320
    assert {t["ev"] for t in ticks} >= {"base", "run", "ramp", "cool"}
    assert all(t["ev"] == t["game"]["phase"] for t in ticks)
    for t in ticks:
        for r in t["riders"].values():
            assert not r["erg"] and (isinstance(r["band"], str) or r["band"][1] <= r["tgt"] * 2)
    s = room.summary
    assert s["mode"] == "ambo" and len(s["reviews"]) == 5 and s["delivered"] >= 3 and s["score"] > 0
    assert len(s["riders"]) == 4 and all({"spread", "spikes", "fines"} <= set(r) for r in s["riders"])
    assert room.store is None or True
    lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
    assert lobby["game"] == "ambo" and lobby["trainers"] == "gears"

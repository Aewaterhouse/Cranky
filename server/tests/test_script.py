"""Scripted sessions: segments, seeded events, the 90 s rule and running a whole game fast."""

import asyncio
import time

import pytest
from test_bots import lobby_with

from zombie_bus_server import config as C
from zombie_bus_server import session
from zombie_bus_server.modes import script
from zombie_bus_server.modes.common import CrewGame
from zombie_bus_server.modes.script import Seg

DT = 1 / C.TICK_HZ
SEGS = [
    Seg("Base station", 360, "warmup", ("banter",)),
    *[
        s
        for n in range(5)
        for s in (Seg(f"Run {n + 1}", 300, "run", ("wave", "hump", "siren")), Seg("Ramping", 90, "rest"))
    ],
    Seg("Drive home", 240, "cooldown", ("banter",)),
]
DURS = {"banter": 0, "wave": 20, "hump": 3, "siren": 10}


def play(room) -> list[dict]:
    """Runs a started room to the end of its plan with no sleeping. Returns every tick."""
    if room.task:
        room.task.cancel()
    total, ticks = sum(b["dur"] for b in room.plan["blocks"]), []
    while room.el + DT < total:
        room.el += DT
        ticks.append(room.step(DT))
    return ticks


def test_plan_is_free_blocks_so_no_block_has_a_target():
    p = script.plan("amb", "Ambulance", SEGS, 1)
    assert sum(b["dur"] for b in p["blocks"]) == 2550
    assert {b["type"] for b in p["blocks"]} == {"free"} and p["blocks"][1]["kind"] == "run"
    assert sum(b["dur"] for b in script.plan("amb", "Ambulance", SEGS, 0.125)["blocks"]) == pytest.approx(
        2550 / 8, abs=6
    )


def test_same_seed_same_session_and_events_stay_inside_their_segment():
    p = script.plan("amb", "Ambulance", SEGS, 1)
    a, b = script.schedule(p, 7, DURS), script.schedule(p, 7, DURS)
    assert a == b != script.schedule(p, 8, DURS) and a == sorted(a, key=lambda e: e["t"])
    starts = [sum(x["dur"] for x in p["blocks"][:i]) for i in range(len(p["blocks"]) + 1)]
    for e in a:
        assert e["k"] in p["blocks"][e["i"]]["events"] and e["dur"] == DURS[e["k"]]
        assert starts[e["i"]] < e["t"] and e["t"] + e["dur"] <= starts[e["i"] + 1] - C.SCRIPT_CLEAR_S + 0.01
    runs = [[e["k"] for e in a if e["i"] == i] for i in range(1, 11, 2)]
    assert all(len(r) >= 3 and all(x != y for x, y in zip(r, r[1:], strict=False)) for r in runs)


@pytest.mark.parametrize("scale", [1, 0.125])
def test_nothing_goes_quiet_for_over_90_s(scale):
    p = script.plan("amb", "Ambulance", SEGS, scale)
    assert (
        script.worst_gap(p, DURS, range(300)) <= C.SCRIPT_MAX_GAP_S + 1
    )  # scaled blocks round to whole seconds


def test_the_check_catches_a_dull_script():
    dull = script.plan("dull", "Dull", [Seg("Warm-up", 360, "warmup"), Seg("Go", 300, "run", ("wave",))], 1)
    assert script.longest_gap(dull, script.schedule(dull, 1, DURS)) == 360
    long_event = script.plan("x", "X", [Seg("Go", 200, "run", ("heat",))], 1)
    assert script.worst_gap(long_event, {"heat": 120}) <= C.SCRIPT_MAX_GAP_S  # a running event is not quiet


def test_due_and_running():
    ev = [
        {"t": 10, "k": "a", "dur": 5, "i": 0},
        {"t": 12, "k": "b", "dur": 0, "i": 0},
        {"t": 30, "k": "c", "dur": 2, "i": 0},
    ]
    assert script.due(ev, 0, 9.5) == ([], 0)
    assert script.due(ev, 0, 12) == (ev[:2], 2) and script.due(ev, 2, 29) == ([], 2)
    assert script.running(ev, 14) == ev[:1] and script.running(ev, 15) == []


class Scripted(CrewGame):
    """The least a scripted game does: deal the script, schedule its events, emit them as they come due."""

    no_erg = True

    @classmethod
    def deal(cls, minutes):
        return script.plan("amb", "Ambulance", SEGS)

    def begin(self, room):
        self.events, self.n = script.schedule(room.plan, room.code, DURS), 0

    def band(self, room, r, i, bel):
        return (0.8, 0.9) if room.plan["blocks"][i]["kind"] == "run" else (0.5, 0.65)

    def tick(self, room, dt, i, bel, ev):
        due, self.n = script.due(self.events, self.n, room.el)
        for e in due:
            self.emit(e["k"])
        return super().tick(room, dt, i, bel, ev)

    def summary(self, room):
        return {"mode": "amb", "riders": []}


def test_a_40_minute_scripted_game_runs_in_seconds(monkeypatch):
    monkeypatch.setitem(session.MODES, "amb", Scripted)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "FAST")
        room.game = "amb"
        await room.handle("h0", ws, {"t": "bots", "n": 3})
        room.start()
        snap = type(room).from_dict(room.to_dict())
        return room, play(room), snap

    began = time.monotonic()
    room, ticks, snap = asyncio.run(main())
    assert time.monotonic() - began < 20
    assert ticks[-1]["el"] > 40 * 60 and ticks[-1]["i"] == len(SEGS) - 1
    fx = [f["k"] for t in ticks for f in t["fx"]]
    assert len(fx) == len(room.mode.events) > 20 and snap.mode.events == room.mode.events
    assert all(r["band"] and not r["erg"] for t in ticks[::50] for r in t["riders"].values())

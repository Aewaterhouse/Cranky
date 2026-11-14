"""VO2 Madness: the dealt session, effort scoring, the crown, the mystery box and the room flow."""

import asyncio
import random

from test_bots import lobby_with
from test_zombie_bus import FakeRoom, set_all

from zombie_bus_server import config as C
from zombie_bus_server.modes.vo2_madness import Vo2Madness, deal, zone
from zombie_bus_server.plan import block_target


def test_deal_is_a_sane_vo2_session():
    for seed in range(30):
        for minutes in (20, 40, 60):
            plan = deal(minutes, random.Random(seed))
            blocks = plan["blocks"]
            assert sum(b["dur"] for b in blocks) == minutes * 60
            assert blocks[0]["label"] == "Warm-up" and blocks[-1]["label"] == "Cool-down"
            assert plan["rounds"] >= 2
            work = sum(b["dur"] for b in blocks if b.get("work"))
            rest = sum(b["dur"] for b in blocks if b.get("box"))
            assert 0.15 * minutes * 60 <= work <= rest * 1.7
            names = [blocks[i + 1]["label"] for i, b in enumerate(blocks) if b.get("box")]
            assert all(a != b for a, b in zip(names, names[1:], strict=False))
            for i, b in enumerate(blocks):
                if b.get("work") and not blocks[i - 1].get("work"):
                    assert blocks[i - 1].get("box") and blocks[i - 1]["label"] == "Recover"
                tgt = [block_target(b, "hard", t) for t in range(0, b["dur"], 5)]
                assert all(t is None or t <= 1.5 for t in tgt)


T = {"label": "Two-Minute Terror", "round": 1}


def madness(n=3):
    plan = {"rounds": 1, "blocks": [
        {"type": "ramp", "dur": 60, "pct": [45, 80], "label": "Warm-up"},
        {"type": "steady", "dur": 30, "pct": 50, "box": True, "label": "Recover", "round": 1},
        {"type": "steady", "dur": 120, "pct": 115, "work": True, "twist": None, **T},
        {"type": "steady", "dur": 60, "pct": 45, "label": "Cool-down"},
    ]}  # fmt: skip
    room = FakeRoom(plan["blocks"], n)
    room.plan = plan
    return room, Vo2Madness()


def run(room, mad, secs, i, bel0=0.0):
    fx = []
    for k in range(int(secs * 2)):
        room.el += 0.5
        fx += mad.tick(room, 0.5, i, bel0 + k * 0.5, "longhaul")
    return fx


def test_effort_scores_by_heart_rate_zone_and_the_hardest_trier_takes_the_crown():
    room, mad = madness()
    set_all(room, 1.0)
    r0, r1, r2 = room.riders.values()
    r0.hrp, r1.hrp, r2.hrp = 0.93, 0.75, None
    r2.p = r2.ftp  # no strap: scored on power, at FTP like 85% of max
    assert run(room, mad, 20, 1) and mad.pts == {}  # nothing scores in recovery
    fx = run(room, mad, 10, 2)
    assert mad.crown == "r0" and [f["id"] for f in fx if f["k"] == "crown"] == ["r0"]
    assert mad.pts["r0"] > mad.pts["r2"] > mad.pts["r1"] > 0
    assert mad.pts["r2"] == C.MAD_ZONE_PTS[zone(0.85)] * 10 and mad.red == {"r0": 10, "r1": 0, "r2": 0}
    r1.hrp = 0.97  # a challenger must hold it before the crown moves
    run(room, mad, C.MAD_CROWN_HOLD_S - 1, 2)
    assert mad.crown == "r0"
    run(room, mad, 2, 2)
    assert mad.crown == "r1"
    awards = {a["award"]: a["id"] for a in mad.summary(room)["awards"]}
    assert awards["Maddest"] == "r0" and awards["Red Liner"] == "r0"


def test_twists_bend_the_scoring():
    scores = {}
    for twist in (None, "double", "underdog"):
        room, mad = madness(2)
        room.plan["blocks"][2]["twist"] = twist
        set_all(room, 1.0)
        for r in room.riders.values():
            r.hrp = 0.85
        mad.pts = {"r0": 100.0, "r1": 0.0}
        run(room, mad, 10, 2)
        scores[twist] = (mad.pts["r0"] - 100, mad.pts["r1"])
    assert scores["double"][1] == 2 * scores[None][1]
    assert scores["underdog"] == (scores[None][0], 3 * scores[None][1])


def test_mystery_box_hides_the_interval_until_it_opens():
    room, mad = madness()
    set_all(room, 1.0)
    fx = run(room, mad, 30 - C.MAD_BOX_S - 1, 1)
    assert not any(f["k"] == "box" for f in fx) and mad.state(room, 1, 0)["mad"]["next"] is None
    fx = run(room, mad, 2, 1, bel0=30 - C.MAD_BOX_S - 1)
    assert [f["text"] for f in fx if f["k"] == "box"] == ["Two-Minute Terror!"]
    assert mad.state(room, 1, 0)["mad"]["next"] == "Two-Minute Terror"
    assert any(f["k"] == "go" for f in run(room, mad, 1, 2))


def test_sandbagger_gets_called_out():
    room, mad = madness()
    set_all(room, 1.0)
    r0, r1, r2 = room.riders.values()
    r0.hrp, r1.hrp, r2.hrp = 0.6, 0.9, 0.88
    fx = run(room, mad, C.MAD_SANDBAG_S + 1, 2)
    assert [f["id"] for f in fx if f["k"] == "sandbag"] == ["r0"]


def test_room_runs_madness_and_keeps_it_off_the_ladder(monkeypatch):
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "MADD")
        await room.handle("h0", ws, {"t": "game", "game": "madness"})
        lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
        assert lobby["game"] == "madness" and lobby["plan"]["id"] == "vo2-madness"
        await room.handle("h0", ws, {"t": "bots", "n": 2})
        await room.handle("h0", ws, {"t": "start"})
        data = {"t": "data", "p": 250, "w": 250, "cad": 90, "s": 0.95, "hr": 170, "hrp": 0.92}
        while room.el < 3:
            await room.handle("h0", ws, data)
            await asyncio.sleep(0.01)
        tick = [m for m in ws.sent if m["t"] == "tick"][-1]
        snap = type(room).from_dict(room.to_dict())
        await room.handle("h0", ws, {"t": "end"})
        return room, tick, snap

    room, tick, snap = asyncio.run(main())
    assert tick["bus"]["mad"]["rounds"] >= 2 and tick["bus"]["mad"]["work"] is False
    assert isinstance(snap.mode, Vo2Madness) and snap.game == "madness"
    assert room.summary["mode"] == "madness" and len(room.summary["riders"]) == 3

from zombie_bus_server import config as C
from zombie_bus_server.modes.zombie_bus import ZombieBus
from zombie_bus_server.session import Rider


class FakeRoom:
    def __init__(self, blocks, n=4):
        self.plan = {"blocks": blocks}
        self.el = 0.0
        self.riders = {f"r{i}": Rider(f"r{i}", f"R{i}", 200, "hard", connected=True) for i in range(n)}


STEADY = [{"type": "steady", "dur": 60, "pct": 50}, {"type": "steady", "dur": 600, "pct": 90}]


def run(room, bus, secs, i=1, ev="longhaul", bel0=0.0):
    fx = []
    for k in range(int(secs * 2)):
        room.el += 0.5
        fx += bus.tick(room, 0.5, i, bel0 + k * 0.5, ev)
    return fx


def set_all(room, s=1.0, cad=90):
    for r in room.riders.values():
        r.s, r.cad, r.p = s, cad, 200


def test_good_riding_pulls_away_bad_riding_gets_hit():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 30)
    assert bus.gap > C.GAP_START and bus.armour == 100
    set_all(room, 0.65)
    room.riders["r0"].cad = 120
    fx = run(room, bus, 70)
    assert bus.armour < 100 and any(f["k"] == "hit" for f in fx)


def test_fell_off_drops_tier_and_haul_back():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    room.riders["r0"].s = 0.3
    fx = run(room, bus, 31)
    r0 = room.riders["r0"]
    assert r0.st == "fell" and r0.tier == "medium" and any(f["k"] == "fell" for f in fx)
    fx = run(room, bus, 21, bel0=31)
    assert r0.st == "riding" and any(f["k"] == "hauled" and "+" in f["text"] for f in fx)


def test_cadence_sync_tunes_engine():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0, cad=90)
    room.riders["r1"].cad = 94
    fx = run(room, bus, C.SYNC_HOLD_S + 1)
    assert bus.tune and any(f["k"] == "tune" for f in fx)
    room.riders["r1"].cad = 110
    run(room, bus, 1)
    assert not bus.tune


def test_surge_grabs_on_under_and_shakes_on_clean_over():
    ou = {"type": "over-under", "dur": 240, "pct": [105, 90], "step": 30}
    room, bus = FakeRoom([STEADY[0], ou]), ZombieBus()
    set_all(room, 1.0)
    fx = run(room, bus, 70, ev="surge")
    kinds = [f["k"] for f in fx]
    assert "grab" in kinds and "shake" in kinds


def test_roadblock_smash_and_fail():
    blocks = [STEADY[0], {"type": "sprint", "dur": 10}, STEADY[1]]
    room, bus = FakeRoom(blocks), ZombieBus()
    set_all(room, None)
    run(room, bus, 1, i=1, ev="roadblock")
    for r in room.riders.values():
        bus.on_sprint(r, 1, "GREAT", 2)
    fx = run(room, bus, 1, i=1, ev="roadblock", bel0=1)
    assert any(f["k"] == "smash" for f in fx) and bus.rb is None

    run(room, bus, 1, i=2, ev="longhaul")
    room.plan["blocks"].append({"type": "sprint", "dur": 10})
    run(room, bus, 1, i=3, ev="roadblock")
    armour = bus.armour
    bus.on_sprint(room.riders["r0"], 3, "FAIL", 0)
    fx = run(room, bus, 20, i=3, ev="roadblock")
    assert bus.armour < armour and any(f["k"] == "crash" for f in fx)


def test_summary_awards():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 0.9)
    room.riders["r2"].s = 1.0
    run(room, bus, 10)
    s = bus.summary(room)
    assert s["awards"][0] == {"award": "Iron Lungs", "id": "r2", "name": "R2", "why": "100% compliance"}
    assert s["distance"] > 0 and len(s["riders"]) == 4


def test_servo_shop_upgrades():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    r0 = room.riders["r0"]
    run(room, bus, 1, ev="longhaul")
    bus.scrap, bus.armour = 500, 50
    bus.buy(r0, "plating")
    assert bus.armour == 50, "shop is closed outside servo stops"
    run(room, bus, 1, ev="servo")
    bus.scrap = 500
    bus.buy(r0, "plating")
    bus.buy(r0, "repellent")
    bus.buy(r0, "sync")
    assert bus.armour == 75 and bus.repel == 1 and bus.syncw == 3
    assert bus.scrap == 500 - 40 - 60 - 50
    bus.damage(10, "x")
    assert bus.armour == 75 and bus.repel == 0
    bus.scrap = 10
    bus.buy(r0, "plating")
    assert bus.armour == 75


def test_bus_is_full_at_six():
    import asyncio

    from zombie_bus_server.session import Room

    class Ws:
        def __init__(self):
            self.sent = []

        async def send_json(self, m):
            self.sent.append(m)

    async def go():
        room = Room("TEST")
        socks = [Ws() for _ in range(7)]
        for i, ws in enumerate(socks):
            await room.handle(f"r{i}", ws, {"t": "join", "name": f"R{i}", "ftp": 200, "tier": "hard"})
        assert len(room.riders) == C.MAX_RIDERS
        assert "Bus full" in socks[6].sent[-1]["msg"]
        await room.handle("r0", socks[0], {"t": "join", "name": "R0", "ftp": 210, "tier": "hard"})
        assert room.riders["r0"].ftp == 210

    asyncio.run(go())

"""Last Rider Standing without sockets: the ramp, who goes out when, the winner and the cap."""

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server.modes.last_standing import LastStanding
from zombie_bus_server.plan import locate
from zombie_bus_server.rider import Rider

DT = 1 / C.TICK_HZ
LIMITS = {"r0": 1.45, "r1": 1.2, "r2": 0.9, "r3": 1.05}  # share of FTP each can hold


class Ramp:
    code = "LAST"

    def __init__(self):
        self.plan = LastStanding.deal(0)
        self.el = 0.0
        self.riders = {k: Rider(k, k.upper(), 200, "hard", connected=True) for k in LIMITS}
        self.game = LastStanding()
        self.game.begin(self)

    def ride(self):
        fx = []
        total = sum(b["dur"] for b in self.plan["blocks"])
        while self.el < total - DT:
            self.el += DT
            i, bel = locate(self.plan["blocks"], self.el)
            pct = self.plan["blocks"][i]["pct"] / 100
            for r in self.riders.values():
                held = pct <= LIMITS[r.id]
                r.p = r.w = r.ftp * (pct if held else pct * 0.6)
                r.s, r.cad, r.st = (1.0 if held else 0.4), 90, "riding"
            fx += self.game.tick(self, DT, i, bel, "")
        return fx


def test_the_ramp_climbs_to_the_cap_and_never_past_it():
    blocks = LastStanding.deal(0)["blocks"]
    steps = [b["pct"] for b in blocks[1:-1]]
    assert steps[0] == G.LAST_FROM and max(steps) == 150 and steps == sorted(steps)
    assert all(b["pct"] <= C.TARGET_CAP * 100 for b in blocks)


def test_riders_go_out_in_order_and_the_strongest_is_last_standing():
    ramp = Ramp()
    fx = ramp.ride()
    assert ramp.game.out == ["r2", "r3", "r1"] and ramp.game.winner == "r0"
    outs = [f["text"] for f in fx if f["k"] == "out"]
    assert outs[0].startswith("R2 is out at 96%") and "3 still standing" in outs[0]
    s = ramp.game.summary(ramp)
    assert [r["id"] for r in s["riders"]] == ["r0", "r1", "r3", "r2"]
    assert s["awards"][0]["award"] == "Last One Standing" and s["awards"][1]["name"] == "R2"
    assert ramp.game.band(ramp, ramp.riders["r2"], 5, 0) == "free"


def test_a_room_deals_and_runs_last_rider_standing():
    import asyncio

    from test_bots import lobby_with

    async def main():
        room, ws = await lobby_with(1, code="LRS1")
        await room.handle("h0", ws, {"t": "game", "game": "last"})
        await room.handle("h0", ws, {"t": "bots", "n": 2})
        room.start()
        room.task.cancel()
        room.el = 2.0
        room.step(DT)
        tick = room.step(DT)
        await room.finish()
        return room, tick

    room, tick = asyncio.run(main())
    assert room.plan["id"] == "last-standing" and tick["game"]["g"] == "last"
    assert room.summary["mode"] == "last" and len(room.summary["riders"]) == 3

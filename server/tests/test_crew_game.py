"""The crew game kit: per-rider bands, the 150% cap, game inputs and games that are never on ERG."""

import asyncio

import pytest
from pydantic import ValidationError
from test_bots import lobby_with

from zombie_bus_server import config as C
from zombie_bus_server import session
from zombie_bus_server.modes.common import CrewGame
from zombie_bus_server.rider import Rider

DT = 1 / C.TICK_HZ
PLAN = {"id": "toy", "name": "Toy", "blocks": [{"type": "free", "dur": 60, "label": "Toy"}] * 3}


class Toy(CrewGame):
    """Bands by rider: the host gets a wild one, bots sprint, everyone else rides free."""

    no_erg = True

    def __init__(self, level: str = "normal") -> None:
        super().__init__(level)
        self.acts: list = []

    @classmethod
    def deal(cls, minutes):
        return PLAN

    def band(self, room, r, i, bel):
        return (0.9, 9.0) if r.id == "h0" else "sprint" if r.bot else "free"

    def game(self, room, i, bel):
        return {"acts": len(self.acts)}

    def on_act(self, room, r, k, v):
        self.acts.append((r.id, k, v))

    def ask(self, room, r):
        opts = [{"v": "tea", "label": "Tea"}, {"v": "beer", "label": "Beer", "off": True}]
        return {"k": "drink", "title": "Drink?", "opts": opts, "left": 9} if r.id == "h1" else None


async def toy_room(monkeypatch, humans=2):
    monkeypatch.setitem(session.MODES, "toy", Toy)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)
    room, ws = await lobby_with(humans, "TOYS")
    room.game = "toy"
    room.deal()
    return room, ws


def test_band_watts_never_pass_the_cap_and_stay_in_order():
    r = Rider("a", "A", 200, "hard")
    assert r.band_w(0.85, 0.9) == (170, 180)
    assert r.band_w(1.4, 2.5) == (280, 300)
    assert r.band_w(3.0, 2.0) == (300, 300)
    assert r.band_w(0.9, 0.5) == (100, 180)
    for ftp in (50, 137, 600):
        for lo, hi in ((0, 0), (1.49, 1.51), (5, 9), (-1, 0.2)):
            a, b = Rider("a", "A", ftp, "easy").band_w(lo, hi)
            assert 0 <= a <= b <= round(ftp * C.TARGET_CAP)


def test_tick_carries_each_riders_band_and_a_capped_target(monkeypatch):
    async def main():
        room, ws = await toy_room(monkeypatch)
        await room.handle("h0", ws, {"t": "trainers", "mode": "erg"})
        await room.handle("h0", ws, {"t": "bots", "n": 1})
        room.start()
        room.task.cancel()
        return room, [room.step(DT) for _ in range(4)][-1], [m for m in ws.sent if m["t"] == "lobby"][-1]

    room, tick, lobby = asyncio.run(main())
    host, other, bot = (tick["riders"][k] for k in ("h0", "h1", "bot-" + C.BOT_NAMES[0].lower()))
    ftp = room.riders["h0"].ftp
    assert host["band"] == (round(0.9 * ftp), round(1.5 * ftp)) and host["tgt"] == round(1.2 * ftp)
    assert (other["band"], other["tgt"]) == ("free", None) and (bot["band"], bot["tgt"]) == ("sprint", None)
    assert tick["game"] == {"acts": 0} and tick["ev"] == "warmup"
    # never on ERG, whatever the host picked
    assert lobby["trainers"] == "gears" and not any(r["erg"] for r in tick["riders"].values())
    assert not any(r["erg"] for r in lobby["riders"])


def test_older_games_send_no_band(monkeypatch):
    async def main():
        monkeypatch.setattr(C, "COUNTDOWN_S", 0)
        room, ws = await lobby_with(1, "OLDG")
        room.start()
        room.task.cancel()
        return [room.step(DT) for _ in range(50)][-1]

    tick = asyncio.run(main())
    assert tick["riders"]["h0"]["band"] is None and tick["riders"]["h0"]["tgt"] and tick["game"] is None


def test_act_reaches_the_game_only_in_a_ride_and_is_rate_limited(monkeypatch):
    async def main():
        room, ws = await toy_room(monkeypatch)
        await room.handle("h1", ws, {"t": "act", "k": "emoji", "v": "wave"})  # lobby: dropped
        room.start()
        room.task.cancel()
        room.step(DT)
        for n in range(C.ACT_LIMIT[0] + 5):
            await room.handle("h1", ws, {"t": "act", "k": "vote", "v": n})
        await room.handle("h0", ws, {"t": "act", "k": "card"})
        return room

    room = asyncio.run(main())
    acts = room.mode.acts
    assert [a for a in acts if a[0] == "h1"] == [("h1", "vote", n) for n in range(C.ACT_LIMIT[0])]
    assert acts[-1] == ("h0", "card", None)


def test_a_games_question_rides_in_that_riders_tick_only(monkeypatch):
    async def main():
        room, ws = await toy_room(monkeypatch)
        room.start()
        room.task.cancel()
        room.el = -3.0
        early = room.step(DT)  # still in the countdown
        room.el = 1.0
        t = room.step(DT)
        await room.handle("h1", ws, {"t": "act", "k": t["riders"]["h1"]["ask"]["k"], "v": "tea"})
        return room, early, t

    room, early, t = asyncio.run(main())
    assert early["riders"]["h1"]["ask"] is None
    assert t["riders"]["h1"]["ask"]["opts"][1] == {"v": "beer", "label": "Beer", "off": True}
    assert t["riders"]["h0"]["ask"] is None
    assert room.mode.acts[-1] == ("h1", "drink", "tea")


@pytest.mark.parametrize(
    "bad", [{"k": "Bad Key"}, {"k": ""}, {"k": "x", "v": "y" * 65}, {"k": "x", "v": [1]}]
)
def test_act_is_validated(monkeypatch, bad):
    async def main():
        room, ws = await toy_room(monkeypatch)
        await room.handle("h0", ws, {"t": "act", **bad})

    with pytest.raises(ValidationError):
        asyncio.run(main())


def test_a_crew_game_snapshot_round_trips():
    toy = Toy("hard")
    toy.acts.append(["h0", "x", 1])
    toy.emit("go", "Go")
    back = Toy.from_dict(toy.to_dict())
    assert vars(back) == vars(toy) and back.state(None, 0, 0)["armour"] == 100

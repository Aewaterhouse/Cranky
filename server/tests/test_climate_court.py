"""Climate Lawsuit's courtroom: the defendant, the jury, the dock, verdicts, sentencing and the sash."""

import asyncio
import time

import pytest
from climate_town import Town, kinds
from test_bots import FakeWS, join

from zombie_bus_server import config_games as G
from zombie_bus_server.avatars import clean_look, wear_sash
from zombie_bus_server.protocol import ClientMsg
from zombie_bus_server.session import Room
from zombie_bus_server.store import Store

VOTE, DOCK = G.CLIM_VOTE_S, G.CLIM_DOCK_S


def dirtiest(town, rid="r3"):
    """Gives `rid` the most tonnes in town so they are the defendant."""
    town.game.emit_t[rid] = max(town.game.emit_t.values()) + 100


def to_trial(town, rid="r3"):
    town.to("trial", 1, -1)
    dirtiest(town, rid)
    return town.ride(2)


def test_the_highest_emitter_is_the_defendant_and_the_ledger_comes_out():
    town = Town()
    fx = to_trial(town)
    v = town.view()
    assert v["phase"] == "trial" and v["trial"]["defendants"] == ["r3"] and v["trial"]["target"] is None
    assert set(v["ledger"]["r0"]) == {"emit", "bribed", "walls"}
    assert any("R3 is the defendant" in f["text"] for f in fx if f["text"])


def test_the_jury_votes_and_a_tie_goes_the_harsher_way():
    town = Town()
    to_trial(town)
    q = town.ask("r0")
    assert q["k"] == "verdict_target" and [o["v"] for o in q["opts"]] == ["90", "100", "105"]
    assert town.ask("r3") is None  # the defendant has no vote
    town.act("r3", "verdict_target", "90")
    town.act("r0", "verdict_target", "90")
    town.act("r1", "verdict_target", "105")
    town.act("r2", "verdict_target", "999")
    assert town.game.votes == {"r0": "90", "r1": "105"} and town.ask("r0")["v"] == "90"
    town.ride(VOTE)
    assert town.view()["trial"]["target"] == 105 and town.ask("r0") is None


def test_nobody_voting_means_100():
    town = Town()
    to_trial(town)
    town.ride(VOTE)
    assert town.view()["trial"]["target"] == 100


def test_the_defendant_rides_the_target_in_the_dock_and_everyone_else_spins_easy():
    town = Town()
    to_trial(town)
    town.ride(VOTE + 5)
    r3 = town.game.band(town, town.riders["r3"], 5, 70)
    assert r3 == pytest.approx((1 - G.CLIM_DOCK_HALF, 1 + G.CLIM_DOCK_HALF))
    assert town.game.band(town, town.riders["r0"], 5, 70) == G.CLIM_EASY


@pytest.mark.parametrize("held, verdict", [(0.85, "acquitted"), (0.7, "guilty")])
def test_holding_80_percent_of_the_dock_is_an_acquittal(held, verdict):
    town = Town()
    to_trial(town)
    town.ride(VOTE)
    start = town.el

    def power(r, b, el):
        on = (el - start) / DOCK < held
        return 1.0 if r.id != "r3" or on else 0.6

    fx = town.ride(DOCK + 2, power)
    v = town.view()["trial"]
    assert v["verdicts"] == {"r3": verdict} and kinds(fx).count("verdict") == 1
    assert v["held"] == pytest.approx(held, abs=0.03) and v["heldBy"]["r3"] == v["held"]


def test_sentencing_is_community_service_for_the_guilty():
    town = Town()
    to_trial(town)
    town.to("cool", 1, 5, lambda r, b, el: 0.5)
    assert town.game.verdicts == {"r3": "guilty"}
    assert town.game.band(town, town.riders["r3"], 6, 5) == G.CLIM_SERVICE["band"]
    assert town.game.band(town, town.riders["r0"], 6, 5) == G.CLIM_EASY
    town.ride(G.CLIM_SERVICE["secs"])
    assert town.game.band(town, town.riders["r3"], 6, 125) == G.CLIM_EASY


def test_the_town_survives_the_richest_wins_and_nobody_gets_a_sash():
    town = Town()
    town.to("decade", 2, -20)
    town.act("r0", "fuel", "solar")
    town.act("r1", "fuel", "solar")
    town.to("cool", 1, 5, lambda r, b, el: 0.5 if el > town.at("trial") else sum(b) / 2)
    s = town.game.summary(town)
    assert not s["flooded"] and s["score"] > 0 and s["verdicts"]
    assert s["awards"][0]["award"] == "Greenwashing Award" and s["awards"][0]["id"] == s["riders"][0]["id"]
    assert not any(r.look.get("sash") for r in town.riders.values())
    assert {"company", "coins", "emit", "bribed"} <= set(s["riders"][0])


class Sashes:
    """A store stand-in that only keeps sashes."""

    def __init__(self):
        self.s = {}

    def sash_until(self, rid):
        u = self.s.get(rid)
        return u if u and u > time.time() else None

    def set_sash(self, rid, until):
        if until is None:
            self.s.pop(rid, None)
        else:
            self.s[rid] = until


def test_a_flooded_town_puts_the_sash_on_the_guilty_for_30_days():
    town = Town()
    town.store = Sashes()
    to_trial(town)  # all coal: flooded in the 2010s
    assert town.game.flooded
    town.to("cool", 1, 5, lambda r, b, el: 0.5)
    assert town.riders["r3"].look["sash"] is True
    assert town.store.sash_until("r3") == pytest.approx(time.time() + 30 * 86400, abs=60)
    s = town.game.summary(town)
    assert (
        s["score"] == 0 and s["flooded"] and not any(a["award"] == "Greenwashing Award" for a in s["awards"])
    )


def test_a_sashed_rider_can_appeal_and_an_acquittal_takes_it_off():
    town = Town()
    town.store = Sashes()
    town.store.set_sash("r1", time.time() + 999)
    town.riders["r1"].look = {"sash": True}
    to_trial(town)
    q = town.ask("r1")
    assert q["k"] == "appeal" and [o["v"] for o in q["opts"]] == ["yes", "no"]
    town.act("r1", "appeal", "yes")
    assert town.game.defendants == ["r3", "r1"] and town.ask("r1") is None
    town.ride(VOTE)
    fx = town.ride(DOCK + 2, lambda r, b, el: 1.0)
    assert town.game.verdicts == {"r3": "acquitted", "r1": "acquitted"} and kinds(fx).count("verdict") == 2
    assert "sash" not in town.riders["r1"].look and town.store.sash_until("r1") is None


def test_an_appeal_is_only_for_the_sashed_and_a_no_is_final():
    town = Town()
    town.riders["r1"].look = {"sash": True}
    to_trial(town)
    town.act("r0", "appeal", "yes")
    assert town.game.defendants == ["r3"]
    town.act("r1", "appeal", "no")
    assert town.ask("r1")["k"] == "verdict_target" and town.game.defendants == ["r3"]


def test_the_sash_is_kept_apart_from_the_profile_and_comes_off_after_30_days(tmp_path):
    store = Store(tmp_path / "s.db")
    assert store.sash_until("a") is None
    store.set_sash("a", time.time() + 100)
    assert store.sash_until("a") > time.time()
    store.put_profile("a", {"updated": 1, "look": {"hat": "x", "sash": False}})
    assert store.sash_until("a")
    store.set_sash("a", time.time() - 1)  # 30 days are up
    assert store.sash_until("a") is None
    store.set_sash("b", time.time() + 100)
    store.set_sash("b", None)
    assert store.sash_until("b") is None


def test_nobody_can_put_on_or_take_off_their_own_sash(tmp_path):
    assert clean_look({"hat": "x", "sash": True}) == {"hat": "x"}
    msg = ClientMsg.validate_python(join("A") | {"look": {"hat": "x", "sash": True}})
    assert msg.look == {"hat": "x"}
    store = Store(tmp_path / "s.db")
    assert wear_sash(store, "a", {"sash": True}) == {}
    store.set_sash("a", time.time() + 100)
    assert wear_sash(store, "a", {"hat": "x"}) == {"hat": "x", "sash": True}
    assert wear_sash(None, "a", {"sash": True}) == {}

    async def main():
        room, ws = Room("SASH", store), FakeWS()
        await room.handle("a", ws, join("A") | {"look": {"hat": "x"}})
        await room.handle("b", ws, join("B") | {"look": {"sash": True}})
        return room, ws

    room, ws = asyncio.run(main())
    assert room.riders["a"].look == {"hat": "x", "sash": True} and room.riders["b"].look == {}
    lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
    assert next(r for r in lobby["riders"] if r["id"] == "a")["look"]["sash"] is True

"""Speed Dating: who dates whom, the six themes, match scoring, reacting together and a whole night."""

import asyncio
import random
from itertools import combinations

import pytest
from test_bots import lobby_with
from test_script import play

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server.modes import script
from zombie_bus_server.modes.dating import Dating, key, match, prompts, rounds
from zombie_bus_server.plan import locate
from zombie_bus_server.rider import Rider

DT = 1 / C.TICK_HZ
BAR, DATE, GAP = G.DATE_BAR_S, G.DATE_DATE_S, G.DATE_GAP_S


def mid(b):
    return (b[0] + b[1]) / 2


class Night:
    """A room's worth of state for driving the game directly: a dealt plan, `n` riders, no script events."""

    code = "DATE"
    load = 1.0

    def __init__(self, n=4, events=False):
        self.plan = Dating.deal(40)
        self.el = 0.0
        self.riders = {f"r{i}": Rider(f"r{i}", f"R{i}", 200, "hard", connected=True) for i in range(n)}
        self.game = Dating()
        self.game.begin(self)
        if not events:
            self.game.events = []

    def at(self, kind, n=1):
        """Seconds from the start to the `n`th block of `kind`."""
        t = 0.0
        for b in self.plan["blocks"]:
            n -= b["kind"] == kind
            if n == 0:
                return t
            t += b["dur"]
        raise KeyError(kind)

    def ride(self, secs, power=None):
        """Rides `secs` seconds at `power(r, band, el)` (a share of FTP), or at the middle of the band."""
        fx = []
        for _ in range(round(secs / DT)):
            self.el += DT
            i, bel = locate(self.plan["blocks"], self.el)
            for r in self.riders.values():
                band = self.game.band(self, r, i, bel)
                on = 1.5 if band == "sprint" else 1.0 if band == "free" else mid(band)
                r.p = r.w = r.ftp * (power(r, band, self.el) if power else on)
                r.cad, r.s, r.st = 85, 1.0, "riding"
            fx += self.game.tick(self, DT, i, bel, "")
        return fx

    def to(self, kind, n=1, secs=0.0, power=None):
        """Rides up to `secs` into the `n`th block of `kind`."""
        return self.ride(self.at(kind, n) + secs - self.el, power)

    def view(self):
        return self.game.game(self, *locate(self.plan["blocks"], self.el))


def kinds(fx):
    return [f["k"] for f in fx]


def test_the_night_is_the_briefs_segments_and_never_goes_quiet():
    p = Dating.deal(40)
    kinds_ = [b["kind"] for b in p["blocks"]]
    assert kinds_ == [
        "bar",
        *["date", "gap"] * 5,
        "date",
        "proposal",
        "wedding",
        "divorce",
        "wedding",
        "cool",
    ]
    assert sum(b["dur"] for b in p["blocks"]) == 44 * 60
    assert [b["theme"] for b in p["blocks"] if b["kind"] == "date"] == list(G.DATE_ORDER)
    assert p["blocks"][5]["label"] == "Date 3: Meeting the Parents"
    assert {b["type"] for b in p["blocks"]} == {"free"}
    assert script.worst_gap(p, G.DATE_EVENT_S, range(300)) <= C.SCRIPT_MAX_GAP_S


@pytest.mark.parametrize("n", [4, 5, 6])
def test_everyone_dates_every_night_and_the_chaperone_takes_turns(n):
    ids = [f"r{i}" for i in range(n)]
    rs = rounds(ids, 6)
    for r in rs:
        seated = [x for p in r["pairs"] for x in p] + ([r["chap"]] if r["chap"] else [])
        assert sorted(seated) == ids and len(r["pairs"]) == n // 2
    chaps = [r["chap"] for r in rs]
    if n % 2:
        assert sorted(chaps[:n]) == ids  # everyone has a turn before anyone has a second
    else:
        assert chaps == [None] * 6
    met = {key(*p) for r in rs for p in r["pairs"]}
    want = {key(a, b) for a, b in combinations(ids, 2)}
    assert met == want if n <= 5 else len(met) == 15
    for a, b in zip(rs, rs[1:], strict=False):
        assert not {key(*p) for p in a["pairs"]} & {key(*p) for p in b["pairs"]}


def test_match_is_full_within_two_points_none_at_ten_and_nothing_out_of_band():
    band = (0.80, 0.90)
    assert match(0.85, 0.86, band, band) == 1
    assert match(0.84, 0.86, band, band) == pytest.approx(1)
    assert match(0.81, 0.87, band, band) == pytest.approx(0.5)
    assert match(0.80, 0.90, band, band) == pytest.approx(0)
    assert match(0.60, 0.60, band, band) == 0  # two people soft-pedalling together score nothing
    assert match(0.85, 0.95, band, band) == 0
    assert match(0.905, 0.895, band, band) == 1  # the band has a point of give


def test_each_theme_rides_its_band_and_its_prompts():
    for tid, lo, hi in (("coffee", 0.65, 0.75), ("dinner", 0.80, 0.90), ("moving", 0.90, 0.95)):
        assert G.DATE_THEMES[tid]["band"] == (lo, hi) and prompts(tid, random.Random(1)) == []
    for seed in range(50):
        surges = prompts("parents", random.Random(seed))
        assert len(surges) == 6 and all(p["band"] == (1.0, 1.1) and p["secs"] == 8 for p in surges)
        assert all(w * 30 <= p["t"] and p["t"] + 8 <= w * 30 + 30 for w, p in enumerate(surges))
        (ex,) = prompts("ex", random.Random(seed))
        assert ex["band"] == "sprint" and ex["secs"] == 15 and 30 <= ex["t"] <= DATE - 45
    ikea = prompts("ikea", random.Random(1))
    assert [(p["t"], p["secs"], p["band"]) for p in ikea] == [(t, 30, (1.05, 1.15)) for t in (20, 80, 140)]


def test_daters_get_the_theme_band_and_a_chaperone_spins_easy():
    night = Night(5)
    night.to("date", 2, 30)
    g = night.game
    assert g.n == 2 and len(g.pairs) == 2 and g.chap in night.riders
    i, bel = locate(night.plan["blocks"], night.el)
    for rid, r in night.riders.items():
        want = G.DATE_CHAP if rid == g.chap else (0.80, 0.90)
        assert g.band(night, r, i, bel) == want
    assert night.view()["chap"] == g.chap and night.view()["theme"]["id"] == "dinner"


def test_a_couple_on_the_same_power_scores_a_point_a_second_and_gets_called_a_match():
    night = Night(4)
    night.to("date", 1)
    fx = night.ride(60)
    g = night.game
    assert all(p == pytest.approx(60, abs=1) for p in g.pts.values())
    assert kinds(fx).count("match") == 2
    v = night.view()
    assert v["phase"] == "date" and v["n"] == 1 and v["of"] == 6
    assert all(m == 1 and pts in (59, 60) for _, _, m, pts in v["pairs"])
    assert [r["pts"] for r in v["table"]] == [round(p) for p in g.pts.values()]


def test_a_couple_apart_or_out_of_band_scores_nothing():
    night = Night(4)
    night.to("date", 1)
    a, b = night.game.pairs[0]
    c, d = night.game.pairs[1]
    # one couple 8.5 points apart, the other together but too easy
    off = {a: 0.66, b: 0.745, c: 0.5, d: 0.5}
    night.ride(60, lambda r, band, el: off[r.id])
    g = night.game
    assert g.pts[key(a, b)] == pytest.approx(60 * 0.015 / 0.08, rel=0.1)
    assert g.pts[key(c, d)] <= G.DATE_PTS_S * DT  # the one tick on the way in
    assert g.stats[c]["out"] == pytest.approx(60, abs=1) and g.stats[a]["out"] == 0
    assert g.stats[b]["lead"] >= g.stats[b]["n"] - 1 and g.stats[a]["lead"] == 0


def test_reacting_to_a_surge_together_pays_and_a_slow_date_pays_less():
    night = Night(4)
    night.to("date", 3)
    g = night.game
    a, b = g.pairs[0]
    slow = {b: 2.0}

    def power(r, band, el):
        p = g.prompt(el - slow.get(r.id, 0.0))
        return mid(p["band"]) if p and g.prompt(el) else mid(G.DATE_THEMES["parents"]["band"])

    before = dict(g.table)
    night.ride(DATE - 1, power)
    for p in g.prompts:
        g.settle(night, p)
    c, d = g.pairs[1]
    assert g.stats[c]["gaps"] == 6 and g.stats[c]["gap"] == 0
    assert g.stats[a]["gap"] / g.stats[a]["gaps"] == pytest.approx(2.0, abs=0.5)
    quick = g.table[key(c, d)] - before.get(key(c, d), 0)
    late = g.table[key(a, b)] - before.get(key(a, b), 0)
    assert quick - late > 6 * G.DATE_REACT_PTS * 0.3


def test_the_ex_is_a_sprint_with_no_target_and_nothing_scores_during_it():
    night = Night(4)
    night.to("date", 6)
    g = night.game
    (ex,) = g.prompts
    night.ride(ex["t"] - night.el + 1)
    i, bel = locate(night.plan["blocks"], night.el)
    assert {g.band(night, r, i, bel) for r in night.riders.values()} == {"sprint"}
    before = dict(g.pts)
    night.ride(10)
    assert g.pts == before
    night.ride(10)
    assert all(g.pts[kk] == pytest.approx(before[kk] + G.DATE_REACT_PTS + 5, abs=2) for kk in before)


def test_the_walk_between_dates_shows_the_next_table():
    night = Night(4)
    night.to("gap", 1, 5)
    v = night.view()
    assert v["phase"] == "gap" and v["n"] == 2 and v["theme"]["id"] == "dinner"
    assert [p[:2] for p in v["pairs"]] == night.game.rounds[1]["pairs"] and all(p[2] == 0 for p in v["pairs"])


def test_bands_never_pass_the_cap_all_night():
    night = Night(5)
    total = sum(b["dur"] for b in night.plan["blocks"])
    while night.el < total - 2:
        night.ride(2)
        i, bel = locate(night.plan["blocks"], night.el)
        for r in night.riders.values():
            band = night.game.band(night, r, i, bel)
            assert isinstance(band, str) or 0 < band[0] < band[1] <= C.TARGET_CAP


@pytest.mark.parametrize("humans", [1, 5])
def test_a_room_plays_a_scaled_night(monkeypatch, humans):
    monkeypatch.setattr(C, "SCRIPT_SCALE", 0.125)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "DATE")
        await room.handle("h0", ws, {"t": "game", "game": "date"})
        await room.handle("h0", ws, {"t": "bots", "n": humans - 1})
        room.start()
        ticks = play(room)
        await room.finish()
        return room, ticks, ws

    room, ticks, ws = asyncio.run(main())
    assert len(room.riders) == max(4, humans)  # bots fill the bar to four
    assert {t["ev"] for t in ticks} >= {"bar", "date", "gap", "proposal", "wedding", "divorce", "cool"}
    assert all(t["ev"] == t["game"]["phase"] for t in ticks)
    for t in ticks:
        for rid, r in t["riders"].items():
            cap = round(room.riders[rid].ftp * C.TARGET_CAP)
            assert not r["erg"] and (
                isinstance(r["band"], str) or r["band"][0] <= r["tgt"] <= r["band"][1] <= cap
            )
    s = room.summary
    assert s["mode"] == "date" and s["score"] > 0 and len(s["couples"]) >= 3
    assert len(s["riders"]) == len(room.riders)
    lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
    assert lobby["game"] == "date" and lobby["trainers"] == "gears"

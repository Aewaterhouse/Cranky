"""Speed Dating's talking and ending: profiles, emoji, Chaperone cards, bots, the proposal, wedding, divorce,
the leaked chat and the results."""

import asyncio
import json
import random
from types import SimpleNamespace as NS

import pytest
from test_bots import lobby_with
from test_dating import DATE, DT, Night, kinds, mid
from test_script import play

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server import discord, strava_text
from zombie_bus_server.modes import dating_text as T
from zombie_bus_server.modes.dating import Dating, key
from zombie_bus_server.plan import locate

CARD = G.DATE_CARD_S


def band_of(night, rid):
    return night.game.band(night, night.riders[rid], *locate(night.plan["blocks"], night.el))


def act(night, rid, k, v):
    night.game.on_act(night, night.riders[rid], k, v)


def ask(night, rid):
    return night.game.ask(night, night.riders[rid])


def test_bots_fill_the_bar_to_four():
    night = Night(2)
    assert len(night.riders) == 4 and sum(r.bot for r in night.riders.values()) == 2
    assert len(night.game.rounds[0]["pairs"]) == 2


def test_the_bar_asks_each_rider_for_a_profile_and_keeps_the_first_by_default():
    night = Night(4)
    night.ride(5)
    q = ask(night, "r1")
    assert q["k"] == "profile" and len(q["opts"]) == 3 and q["v"] == "0" and 80 <= q["left"] <= 85
    assert night.view()["profiles"]["r1"] == q["opts"][0]["label"] in T.PROFILES
    act(night, "r1", "profile", "2")
    assert night.view()["profiles"]["r1"] == q["opts"][2]["label"] and ask(night, "r1") is None
    act(night, "r0", "profile", "7")  # not an option
    assert ask(night, "r0")["v"] == "0"
    night.ride(G.DATE_PROFILE_S)
    assert ask(night, "r0") is None


def test_emoji_reach_your_date_five_a_date_and_only_on_a_date():
    night = Night(4)
    night.ride(10)
    act(night, "r0", "emoji", "🔥")
    assert night.game.said == {}
    night.to("date", 1, 5)
    a, b = night.game.pairs[0]
    assert night.view()["emojiLeft"][a] == 5
    for e in ["🔥", "🐢", "🐢", "nope", "😍", "🚀", "🙈", "😬"]:
        act(night, a, "emoji", e)
    v = night.view()
    assert v["emojiLeft"][a] == 0 and v["said"][a][0] == "🚀" and v["said"][a][1] == pytest.approx(night.el)
    assert v["emoji"] == G.DATE_EMOJI and len(night.game.chat_log) == 5
    assert night.game.chat_log[0] == f"Date 1 · {night.riders[a].name} → {night.riders[b].name}: 🔥"
    night.to("date", 2, 5)
    assert night.view()["emojiLeft"][a] == 5


def test_the_chaperone_picks_a_card_then_a_target_and_it_moves_their_band():
    night = Night(5)
    night.to("date", 1, 10)
    g = night.game
    chap, (a, b), (c, d) = g.chap, *g.pairs
    assert ask(night, a) is None
    q = ask(night, chap)
    assert q["k"] == "card" and [o["v"] for o in q["opts"]] == ["ex", "check", "ring"]
    assert not any(o["off"] for o in q["opts"])
    act(night, a, "card", "ex")  # not the Chaperone
    assert g.pick is None
    act(night, chap, "card", "ex")
    q = ask(night, chap)
    assert q["k"] == "aim" and [o["v"] for o in q["opts"]] == [a, b, c, d, "back"]
    act(night, chap, "aim", "back")
    assert ask(night, chap)["k"] == "card"
    act(night, chap, "card", "ex")
    act(night, chap, "aim", a)
    assert kinds(g.fx) == ["card"] and night.riders[a].name in g.fx[0]["text"]
    v = night.view()["card"]
    assert v["k"] == "ex" and v["who"] == [a] and v["left"] == CARD and v["name"] == "Your ex just texted"
    assert band_of(night, a) == (1.05, 1.15)
    assert band_of(night, b) == (0.65, 1.15)  # their date may follow them up
    assert band_of(night, c) == band_of(night, d) == (0.65, 0.75)
    assert ask(night, chap) is None  # one card at a time
    night.ride(CARD + 1)
    assert night.view()["card"] is None and band_of(night, a) == (0.65, 0.75)
    q = ask(night, chap)
    assert [o["off"] for o in q["opts"]] == [True, False, False] and "2 left" in q["sub"]
    act(night, chap, "card", "ex")  # already played on this date
    assert g.pick is None
    act(night, chap, "card", "ring")
    assert [o["v"] for o in ask(night, chap)["opts"]] == [key(a, b), key(c, d), "back"]
    act(night, chap, "aim", key(c, d))
    assert band_of(night, c) == band_of(night, d) == (0.95, 1.05) and band_of(night, a) == (0.65, 0.75)
    night.ride(CARD + 1)
    act(night, chap, "card", "check")
    act(night, chap, "aim", b)
    assert band_of(night, b) == (0.50, 0.60) and band_of(night, a) == (0.50, 0.75)
    night.ride(CARD + 1)
    assert ask(night, chap) is None  # three cards a date
    night.to("date", 2, 10)
    assert ask(night, night.game.chap)["k"] == "card" and night.game.chap != chap


def test_the_chaperone_banks_what_the_couple_drops_and_a_date_who_follows_drops_less():
    def night_with(follow):
        night = Night(5)
        night.to("date", 1, 10)
        g = night.game
        a, b = g.pairs[0]
        act(night, g.chap, "card", "ex")
        act(night, g.chap, "aim", a)

        def power(r, band, el):
            return 1.10 if r.id == b and follow and g.card else mid(band) if r.id != b else 0.70

        night.ride(CARD, power)
        return g.chap_pts[g.chap], g.pts[key(a, b)]

    alone, kept_alone = night_with(False)
    together, kept_together = night_with(True)
    assert alone == pytest.approx(CARD * G.DATE_PTS_S, abs=1.5)
    assert together < 6 and kept_together > kept_alone + 8


def test_no_card_starts_too_late_to_finish():
    night = Night(5)
    night.to("date", 1, DATE - CARD + 2)
    assert ask(night, night.game.chap) is None
    act(night, night.game.chap, "card", "ex")
    assert night.game.pick is None


def test_aunty_carol_plays_the_cards_when_everyone_has_a_date():
    night = Night(4, events=True)
    night.to("date", 1)
    fx = night.ride(DATE - 1)
    cards = [f for f in fx if f["k"] == "card"]
    assert 1 <= len(cards) <= 3 and all(f["text"].startswith("Aunty Carol plays") for f in cards)
    assert night.game.chap is None and night.view()["chap"] is None
    assert len(night.game.used["aunty"]) == len(cards) == len(set(night.game.used["aunty"]))


def test_a_bot_chaperone_plays_and_a_human_one_is_nudged():
    for bot in (True, False):
        night = Night(5, events=True)
        night.to("date", 1)
        chap = night.game.chap
        night.riders[chap].bot = bot
        fx = night.ride(DATE - 1)
        assert ("card" in kinds(fx)) == bot
        nudged = [f for f in fx if f["k"] == "say" and f["id"] == chap]
        assert bool(nudged) != bot and all("3 cards left" in f["text"] for f in nudged)


def test_bot_characters_clingy_aloof_and_chaotic():
    g, rng = Dating(), random.Random(1)
    clingy, aloof, chaotic = (NS(id=n, name=n, ftp=200, bot=True) for n in C.BOT_NAMES[:3])
    date = NS(id="h", name="Alex", ftp=300, w=270.0, bot=False)
    room = NS(riders={"h": date}, plan={"blocks": [{"kind": "date"}]}, el=10.0)
    g.last_i = 0
    for bot_ in (clingy, aloof, chaotic):
        assert g.bot(room, bot_, 111.0, 150.0, rng) == 111.0  # nobody to date: as it was
        g.pairs = [[bot_.id, "h"]]
        room.riders[bot_.id] = bot_
    g.pairs = [[clingy.id, "h"]]
    assert g.bot(room, clingy, 111.0, 150.0, rng) == pytest.approx(200 * (0.7 * 0.9 + 0.3 * 0.75))
    g.pairs = [[aloof.id, "h"]]
    assert g.bot(room, aloof, 111.0, 150.0, rng) == 150.0
    g.pairs = [[chaotic.id, "h"]]
    rode = []
    for el in range(60):
        room.el = float(el)
        rode.append(g.bot(room, chaotic, 111.0, 150.0, rng))
    assert min(rode) < 150 * 0.9 and max(rode) > 150 * 1.1 and max(rode) <= 150 * (1 + G.DATE_CHAOS)


def matched_only(night, good):
    """Power that keeps couple `good` together in the band and splits everyone else across it."""
    return lambda r, band, el: (
        1.0
        if isinstance(band, str)
        else mid(band) if r.id in good else band[0] + (band[1] - band[0]) * (int(r.id[1:]) % 2)
    )


def test_the_two_best_couples_ride_off_and_the_better_match_gets_engaged():
    night = Night(4)
    night.to("proposal", 1, 1)
    g = night.game
    assert len(g.finalists) == 2 and not set(g.finalists[0]) & set(g.finalists[1])
    assert night.view()["phase"] == "proposal" and [p[:2] for p in night.view()["pairs"]] == g.finalists
    assert night.view()["couple"] is None
    under = g.finalists[1]
    for rid in night.riders:
        assert band_of(night, rid) == G.DATE_PROPOSAL
    fx = night.to("wedding", 1, 1, matched_only(night, under))
    assert g.couple == under and night.view()["couple"] == under
    (e,) = [f for f in fx if f["k"] == "engaged"]
    assert night.riders[under[0]].name in e["text"] and "Ikea" in e["text"]


def test_spare_riders_hold_tempo_at_the_proposal():
    night = Night(6)
    night.to("proposal", 1, 1)
    spare = [rid for rid in night.riders if not night.game.partner(rid)]
    assert len(spare) == 2 and all(band_of(night, rid) == G.DATE_TEMPO for rid in spare)


def test_the_wedding_is_a_tandem_on_summed_power_with_confetti_from_the_guests():
    night = Night(4, events=True)
    night.to("wedding", 1, 2)
    g = night.game
    a, b = g.couple
    guests = [rid for rid in night.riders if rid not in g.couple]
    v = night.view()
    assert v["phase"] == "wedding" and v["tandem"] == {"w": 380, "tgt": 380} and v["pairs"][0][:2] == [a, b]
    assert band_of(night, a) == G.DATE_TANDEM_BAND and band_of(night, guests[0]) == G.DATE_GUEST
    conf = next(e for e in g.events if e["k"] == "confetti")
    night.ride(conf["t"] - night.el + 1)
    assert band_of(night, guests[0]) == G.DATE_CONFETTI and band_of(night, a) == G.DATE_TANDEM_BAND
    fx = night.to("cool", 1, 1)
    assert g.confetti_s[guests[0]] >= 8
    (m,) = [f for f in fx if f["k"] == "married"]
    assert g.married["held"] == 1 and "100%" in m["text"] and g.married["ids"] == [a, b]
    assert night.view()["tandem"] is None


def test_a_wobbly_tandem_still_marries_but_says_so():
    night = Night(4)
    night.to("wedding", 1, 1)
    a = night.game.couple[0]
    night.to(
        "cool", 1, 1, lambda r, band, el: 0.60 if r.id == a else 1.0 if isinstance(band, str) else mid(band)
    )
    assert night.game.married["held"] < 0.05


def test_the_worst_couple_divorce_by_tug_of_war_and_the_stronger_keeps_the_house():
    night = Night(4)
    night.to("divorce", 1, 1)
    g = night.game
    a, b = g.exes
    assert set(g.exes) != set(g.couple) and g.exes == g.ranked(worst=True)[0] or set(g.exes) != set(g.couple)
    assert band_of(night, a) == band_of(night, b) == "free"
    assert all(band_of(night, rid) == G.DATE_WATCH for rid in night.riders if rid not in g.exes)
    v = night.view()
    assert v["phase"] == "divorce" and v["exes"] == [a, b] and v["tug"] == 0 and v["pairs"][0][:2] == [a, b]
    fx = night.ride(30, lambda r, band, el: {a: 0.9, b: 1.3}.get(r.id, 0.55))
    assert 0.6 < night.view()["tug"] < 0.8 and "divorced" not in kinds(fx)
    fx = night.ride(30, lambda r, band, el: {a: 0.9, b: 1.3}.get(r.id, 0.55))
    (d,) = [f for f in fx if f["k"] == "divorced"]
    assert g.divorced["ids"] == [b, a] and night.riders[b].name in d["text"] and d["id"] == b
    assert band_of(night, a) == G.DATE_WATCH  # it is over: the exes can sit up
    assert "divorced" not in kinds(night.to("cool", 1, 1))


def test_a_divorce_that_runs_out_of_time_goes_to_whoever_is_ahead():
    night = Night(4)
    night.to("divorce", 1, 1)
    a, b = night.game.exes
    fx = night.to("wedding", 2, 1, lambda r, band, el: {a: 1.02, b: 1.0}.get(r.id, 0.55))
    assert "divorced" in kinds(fx) and night.game.divorced["ids"] == [a, b]


def test_the_group_chat_leaks_a_line_at_a_time_and_the_summary_tells_the_night():
    night = Night(5, events=True)
    night.to("date", 1, 5)
    a, b = night.game.pairs[0]
    act(night, a, "emoji", "🐢")
    act(night, a, "emoji", "🐢")
    act(night, night.game.chap, "card", "check")
    act(night, night.game.chap, "aim", b)
    night.to("cool", 1, 2)
    g = night.game
    assert night.view()["chat"] == [T.CHAT_OPEN]
    night.ride(G.DATE_COOL_S - 4)
    chat = night.view()["chat"]
    assert chat == g.leak and len(chat) <= G.DATE_CHAT_MAX + 6
    assert any("🐢" in line for line in chat) and any("No regrets" in line for line in chat)
    s = g.summary(night)
    json.dumps(s)
    assert s["mode"] == "date" and s["score"] == round(sum(g.table.values())) > 0
    assert s["married"]["ids"] == g.couple and s["divorced"]["winner"] and s["chat"] == g.leak
    assert [a_["award"] for a_ in s["awards"]] == ["Best Match", "Third Wheel", "Red Flag"]
    assert " + " in s["awards"][0]["name"] and s["couples"][0]["names"]
    rows = {r["id"]: r for r in s["riders"]}
    assert len(rows) == 5
    for r in rows.values():
        assert {"match", "best", "worst", "lead", "react", "flags", "points", "confetti"} <= set(r)
        assert 0 <= r["match"] <= 1 and r["best"] and r["worst"]
    assert T.FLAGS["turtle"].format(n=2) in rows[a]["flags"]
    assert any(T.FLAGS["read"] in r["flags"] for r in rows.values())
    text = discord.format_summary("Speed Dating", s)
    assert "Speed Dating" in text and "got married" in text and "kept the house" in text and "🚩" in text
    title, body = strava_text.describe(
        {"planName": "Speed Dating", "group": s, "np": 200, "avgPower": 190}, a
    )
    assert title.startswith("💘 Speed Dating") and "% compatible" in title
    assert "Red flags:" in body and "Best Match" in body and "got married" in body


def test_a_night_survives_a_snapshot_mid_date():
    night = Night(5, events=True)
    night.to("date", 3, 40)
    act(night, night.game.chap, "card", "ring")
    snap = json.loads(json.dumps(night.game.to_dict()))
    night.game = Dating.from_dict(snap)
    night.to("cool", 1, 5)
    assert night.game.married and night.game.summary(night)["score"] > 0


def test_a_five_rider_room_gives_the_human_a_turn_as_chaperone(monkeypatch):
    monkeypatch.setattr(C, "SCRIPT_SCALE", 0.125)
    monkeypatch.setattr(C, "COUNTDOWN_S", 0)

    async def main():
        room, ws = await lobby_with(1, "DATE")
        await room.handle("h0", ws, {"t": "game", "game": "date"})
        await room.handle("h0", ws, {"t": "bots", "n": 4})
        room.start()
        return room, play(room)

    room, ticks = asyncio.run(main())
    asks = [t["riders"]["h0"]["ask"] for t in ticks if t["riders"]["h0"]["ask"]]
    assert {q["k"] for q in asks} == {"profile", "card"}
    chaps = {t["game"]["chap"] for t in ticks if t["game"]["phase"] == "date"}
    assert len(chaps) == 5 and None not in chaps
    assert any(t["game"]["card"] for t in ticks) and any(f["k"] == "emoji" for t in ticks for f in t["fx"])
    last = ticks[-1]["game"]
    assert last["phase"] == "cool" and last["couple"] and last["chat"] and DT

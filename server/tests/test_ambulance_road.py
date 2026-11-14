"""Kidney Stone Express on the road: the four road events, the reviews, the awards and the chat text."""

import pytest  # noqa: F401
from test_ambulance import BASE, RUN, Shift, kinds

from zombie_bus_server import config as C
from zombie_bus_server import config_games as G
from zombie_bus_server.modes import ambulance_text as T
from zombie_bus_server.modes import script
from zombie_bus_server.modes.ambulance import Ambulance, V, mid, rx

DT = 1 / C.TICK_HZ


def on_road(pid, kind, at=40.0, **kw):
    """A shift whose first run has one road event `at` seconds in, ridden to just before it."""
    s = Shift(pid, **kw)
    s.game.events = [{"t": BASE + at, "k": kind, "dur": G.AMBO_EVENT_S[kind], "i": 1}]
    s.ride(BASE + at - 1)
    return s, s.game


def says(fx):
    return " ".join(f["text"] for f in fx if f["k"] == "say")


def test_each_patients_road_only_throws_what_suits_them_and_never_goes_quiet():
    for _ in range(5):
        plan = Ambulance.deal(40)
        for b in plan["blocks"]:
            want = G.AMBO_PATIENTS[b["patient"]]["events"] if b["kind"] == "run" else ("say",)
            assert tuple(b["events"]) == want
        assert script.worst_gap(plan, G.AMBO_EVENT_S, range(60)) <= C.SCRIPT_MAX_GAP_S
        g = Shift(events=True).game
        runs = [[e["k"] for e in g.events if e["i"] == i] for i in (1, 3, 5, 7, 9)]
        assert all(2 <= len(r) <= 5 for r in runs)
    assert "green" not in G.AMBO_PATIENTS["kidney"]["events"]


def test_the_run_is_as_long_as_the_prescription_with_its_events():
    plain, _ = on_road("hook", "say")
    slow, g = on_road("hook", "roadworks")
    fast, _ = on_road("hook", "green")
    assert slow.game.total < plain.game.total < fast.game.total
    fx = slow.ride(RUN, until=lambda g: not g.open)  # obeying the roadworks still arrives on time
    assert "delivered" in kinds(fx) and abs(g.reviews[0]["delta"]) <= 4 and g.fines == {}


def test_green_wave_caught_by_a_crew_that_lifts_and_missed_by_one_that_does_not():
    for lift, word in ((True, "Caught"), (False, "Missed")):
        s, g = on_road("hook", "green")
        s.ride(2)
        ev = s.view()["event"]
        assert ev["k"] == "green" and ev["name"] == "Green light wave" and 17 <= ev["left"] <= 20
        assert g.band(s, s.riders["r0"], 1, 45) == G.AMBO_GREEN
        before = g.left
        fx = s.ride(20, None if lift else lambda r, band, el: 0.76)
        gone = before - g.left  # the road covered, with the wave's bonus or the red light's cost
        assert word in says(fx) and s.view()["event"] is None
        assert gone > 20 * V * 0.9 + 150 if lift else gone < 20 * V * 0.8


def test_a_sweet_talked_green_wave_is_caught_whatever_the_crew_does():
    s, g = on_road("hook", "green")
    g.perk = "green"
    fx = s.ride(23, lambda r, band, el: 0.76)
    assert "Caught" in says(fx) and g.perk is None


def test_roadworks_fine_each_speeder_once_and_cost_comfort():
    s, g = on_road("hook", "roadworks")
    s.ride(2)
    assert g.band(s, s.riders["r0"], 1, 45) == G.AMBO_ROADWORKS
    fx = s.ride(26, lambda r, band, el: 0.8 if r.id in ("r0", "r1") else mid(band))
    fines = [f for f in fx if f["k"] == "fine"]
    assert sorted(f["id"] for f in fines) == ["r0", "r1"] and g.fines == {"r0": 1, "r1": 1}
    assert g.comfort <= 100 - 2 * G.AMBO_FINE_COMFORT + 5 and "2 fines" in says(fx)
    assert s.riders["r0"].rs_punished > 15 and s.riders["r2"].rs_punished == 0
    row = {r["id"]: r for r in g.summary(s)["riders"]}
    assert row["r0"]["fines"] == 1 and row["r2"]["fines"] == 0
    assert {"award": "Lead Foot", "id": "r0"}.items() <= next(
        a for a in g.summary(s)["awards"] if a["award"] == "Lead Foot"
    ).items()


def test_speed_hump_needs_everyone_off_the_gas_at_the_same_moment():
    def staggered(r, band, el):  # each rider backs off in turn, never all together
        return 0.1 if int(el * 2) % 4 == int(r.id[1]) else 0.76

    for over, bounced in ((None, False), (staggered, True), (lambda r, band, el: 0.76, True)):
        s, g = on_road("kidney", "hump")
        s.ride(2)
        assert s.view()["event"]["text"].startswith("Speed hump ahead")
        assert g.band(s, s.riders["r0"], 1, 45) == rx("kidney", 45)  # the 3-2-1: nothing changes yet

        def how(r, band, el, over=over):
            return over(r, band, el) if over and band == G.AMBO_HUMP else mid(band)

        fx = s.ride(3, how)
        assert g.band(s, s.riders["r0"], 1, 45) == G.AMBO_HUMP
        fx += s.ride(5, how)
        assert ("BANG" in says(fx)) is bounced and ("hovercraft" in says(fx)) is not bounced
        lost = 100 - g.comfort
        assert lost >= G.AMBO_HUMP_COMFORT * 2 - 3 if bounced else lost < 5


def test_the_siren_rider_sprints_while_the_rest_hold_steady():
    for watts, word in ((1.6, "pulls over"), (0.9, "polite cough")):
        s, g = on_road("hook", "siren")
        s.ride(2)
        who = s.view()["siren"]
        ev = s.view()["event"]
        assert who in s.riders and ev["who"] == who and s.riders[who].name in ev["text"]
        bands = {rid: g.band(s, r, 1, 45) for rid, r in s.riders.items()}
        assert bands.pop(who) == "sprint" and set(bands.values()) == {rx("hook", 45)}
        before = g.comfort
        fx = s.ride(12, lambda r, band, el, watts=watts: watts if band == "sprint" else mid(band))
        assert word in says(fx) and s.view()["siren"] is None
        assert g.comfort == before == 100 and not g.spikes.get(who)  # the sprint is not roughness


def test_the_road_goes_quiet_in_the_braking_zone():
    s, g = on_road("hook", "green", at=RUN - 20)
    s.ride(8)
    assert s.view()["event"] is None or not s.view()["brake"]
    s.ride(4)
    assert s.view()["brake"] and s.view()["event"] is None and g.band(s, s.riders["r0"], 1, 0) == G.AMBO_BRAKE


# --- reviews and awards -----------------------------------------------------------------------------------


def test_stars_follow_comfort_and_time_and_a_fall_or_a_walk_caps_them():
    def stars(comfort, delta=0.0, fell=False, walked=False):
        s = Shift("hook")
        g = s.to_run(5)
        g.comfort, g.fell = comfort, fell
        g.finish_run(s, 0.0, walked=True) if walked else g.deliver(s, delta)
        return g.reviews[0]

    assert [stars(c)["stars"] for c in (10, 30, 55, 75, 95)] == [1, 2, 3, 4, 5]
    assert stars(85, delta=30)["stars"] == 5 and stars(95, delta=-40)["stars"] == 3
    fell, walked = stars(95, fell=True), stars(95, walked=True)
    assert fell["stars"] == 2 and fell["text"] == T.FELL
    assert walked["stars"] == 1 and walked["text"] == T.WALKED["hook"] and walked["pts"] == 0
    assert stars(95)["text"] == T.REVIEWS["hook"]["high"] and stars(40)["text"] == T.REVIEWS["hook"]["low"]
    assert stars(95, delta=-40)["text"].endswith(T.LATE)


def test_a_delivery_posts_its_review_and_the_awards_name_the_smoothest_and_the_spikiest():
    s = Shift("hook")
    g = s.to_run()
    fx = s.ride(RUN + 2, lambda r, band, el: mid(band) + (0.2 if r.id == "r3" and int(el) % 8 == 0 else 0))
    review = next(f["text"] for f in fx if f["k"] == "review")
    assert review.startswith("★") and g.reviews[0]["text"] in review and kinds(fx).count("review") == 1
    summary = g.summary(s)
    awards = {a["award"]: a["id"] for a in summary["awards"]}
    assert awards["Learner Driver"] == "r3" and awards["Paramedic of the Week"] != "r3"
    assert "Lead Foot" not in awards and summary["riders"][-1]["id"] == "r3"
    assert (
        summary["riders"][-1]["spikes"] > 5
        and summary["riders"][-1]["spread"] > summary["riders"][0]["spread"]
    )


def test_strava_and_discord_tell_the_shift():
    from zombie_bus_server import discord, strava_text

    s = Shift("hook")
    g = s.to_run()
    s.ride(RUN + 2)
    summary = g.summary(s)
    text = discord.format_summary("Kidney Stone Express", summary)
    assert "Kidney Stone Express" in text and "1/1 patients" in text and "★★★★★" in text
    title, body = strava_text.describe(
        {"planName": "Kidney Stone Express", "group": summary, "np": 200, "avgPower": 190}, "r0"
    )
    assert title.startswith("🚑 Kidney Stone Express") and "1/1" in title
    assert "Fishing Hook in Thumb" in body and "Paramedic of the Week" in body


def test_bot_characters_smooth_twitchy_and_lead_foot():
    import random
    from types import SimpleNamespace as NS

    game, rng = Ambulance(), random.Random(1)
    smooth, twitchy, lead = (NS(name=n, ftp=200) for n in C.BOT_NAMES[:3])
    assert game.bot(None, smooth, 151.0, 160.0, rng) == 160.0
    rode = [game.bot(None, twitchy, 100.0, 100.0, rng) for _ in range(2000)]
    assert set(rode) == {100.0, 100.0 * G.AMBO_TWITCH_X} and 10 < rode.count(130.0) < 100
    assert game.bot(None, lead, 100.0, 100.0, rng) == 100.0
    game.cur = {"k": "roadworks"}
    assert game.bot(None, lead, 100.0, 100.0, rng) == 200 * G.AMBO_LEADFOOT_X > 200 * G.AMBO_FINE_OVER
    assert game.bot(None, NS(name="Alex", ftp=200), 100.0, 100.0, rng) == 100.0


def test_the_hump_names_who_kept_the_power_on():
    s, g = on_road("kidney", "hump")
    s.ride(2)

    def r2_hot(r, band, el):
        return 0.9 if r.id == "r2" and band == G.AMBO_HUMP else mid(band)

    fx = s.ride(8, r2_hot)
    bang = [f for f in fx if f["k"] == "say" and "BANG" in (f["text"] or "")]
    assert bang and s.riders["r2"].name in bang[0]["text"] and bang[0]["id"] == "r2"

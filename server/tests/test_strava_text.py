"""The Strava title and description: power PR lines, segments with crew placings, caps, each mode."""

import copy

from strava_samples import BUS, FREE, FREE_PLACES, PREV, SOLO
from test_accounts import auth, client

from zombie_bus_server import app as app_mod
from zombie_bus_server.strava_ctx import ride_context
from zombie_bus_server.strava_text import cap, describe, power_prs


def test_power_prs_name_the_duration_new_value_and_old_best_biggest_gain_first():
    lines = power_prs(SOLO, PREV)
    assert lines[:2] == ["🔥 15 s: 640 W (was 600)", "🔥 5 s: 870 W (was 820)"]  # +6.7%, +6.1%
    assert "🔥 1 min: 412 W (was 398)" in lines and "🔥 15 s: 640 W (was 600)" in lines
    # Not beaten (1 s, 2 min, 20 min) or never ridden before (60 min has no new value): left out.
    assert not any(x.startswith(("🔥 1 s", "🔥 2 min", "🔥 20 min", "🔥 60 min")) for x in lines)
    assert power_prs(SOLO, {}) == []  # a first ride has nothing to beat


def test_a_long_list_is_cut_with_plus_n_more():
    _, about = describe(SOLO, "luke", ctx={"prev": PREV})
    prs = about.split("New power bests\n")[1].split("\n\n")[0].split("\n")
    assert len(prs) == 4 and prs[-1] == "+ 3 more"  # six beaten, three shown
    lines = cap([("Head", [f"item {i}" for i in range(10)], 4)], 10_000)
    assert lines == ["", "Head", "item 0", "item 1", "item 2", "+ 7 more"]
    tight = cap([("Head", [f"a long item number {i}" for i in range(10)], 6)], 80)
    assert len("\n".join(tight)) <= 80 or len(tight) == 4
    assert tight[-1].startswith("+ ")


def test_bus_ride_post():
    title, about = describe(BUS, "luke", "https://www.cranky.life/p/abc", {"prev": PREV})
    assert title == "🧟 Zombie Bus · Lunch Break Quickie · survived with a 42 m gap"
    assert about.startswith("Score 1234 · 15.3 km · armour 64%\n\nThe bus\nMe: NP 231 W")
    assert "🏆 Iron Lungs: Luke (92% compliance)" in about and "🏆 Fell Off King" in about
    assert "⚡ Sprint 1: 812 W for 10 s, MEGA" in about
    assert "🧟 Kept the horde 42 m back" in about and "🪦 Fell off 1×" in about
    assert "✨ Best bit: Air strike flattened the front of the horde" in about
    assert "🥧 Burned off 2.4 meat pies" in about
    assert about.endswith("Postcard: https://www.cranky.life/p/abc\nRidden on Cranky · cranky.life")


def test_free_ride_post_names_each_segment_with_time_and_crew_placing():
    title, about = describe(FREE, "luke", ctx={"prev": PREV, "places": FREE_PLACES})
    assert title == "👑 Mount Coot-tha · Cranky free ride"
    assert "⛰️ Mt Coot-tha Lookout climb: 6:52, 301 W, 👑 fastest of 4 in the crew · PR (was 7:11)" in about
    assert "⚡ Mount Coot-tha · sprint: 21.4 s, 702 W, 🥈 2nd of 3 in the crew" in about
    assert "⏱️ Mount Coot-tha: 39:51, 222 W, 🥉 3rd of 3 in the crew · first go" in about
    assert about.index("KOMs and sprints") < about.index("Segments")
    assert "✨ Best bit: Mt Coot-tha Lookout climb in 6:52, quicker than the whole crew" in about
    assert "segment PR" not in about  # no bare counts


def test_solo_workout_post():
    title, about = describe(SOLO, "luke", ctx={"prev": PREV})
    assert title == "💪 Sweet Spot 3x10 · Cranky workout"
    assert about.startswith("1:01:40 · NP 240 W · avg 220 W\nTSS 70 · IF 0.86 · 93% on plan")
    assert "New power bests\n🔥 15 s: 640 W (was 600)" in about
    assert "✨ Best bit: a new 15 s best, 640 W" in about
    assert about.endswith("\nRidden on Cranky · cranky.life")


def test_every_post_stays_under_the_length_cap():
    huge = copy.deepcopy(FREE)
    huge["segments"] = [dict(FREE["segments"][0], segment=f"s{i}", name=f"Climb {i}") for i in range(40)]
    _, about = describe(huge, "luke", "https://www.cranky.life/p/abc", {"prev": PREV})
    assert len(about) < 1700 and "more" in about


def test_context_has_the_old_bests_and_the_crew_placings():
    _, h = auth("luke", "Luke")
    _, hs = auth("steve", "Steve")
    store = app_mod.store
    with store.lock, store.db:
        store.db.execute("DELETE FROM rides WHERE rider IN ('luke', 'steve')")
        store.db.execute("DELETE FROM efforts WHERE segment LIKE 'ctx:%'")
    old = {"record": {"date": "2026-11-01T00:00:00.000Z", "secs": 600, "best": {"60": 398, "5": 820}}}
    test = {"record": {"date": "2026-11-02T00:00:00.000Z", "secs": 600, "best": {"60": 999}}, "test": True}
    later = {"record": {"date": "2026-12-01T00:00:00.000Z", "secs": 600, "best": {"60": 999}}}
    for r in (old, test, later):
        assert client.post("/api/rides", json={"summary": r}, headers=h).status_code == 200
    for who, hh, secs in (("steve", hs, 400.0), ("luke", h, 450.0)):
        e = {
            "route": "ctx",
            "segment": "ctx:climb:0",
            "secs": secs,
            "watts": 300,
            "wkg": 4,
            "date": f"2026-11-0{1 if who == 'steve' else 2}T00:00:00Z",
        }
        assert client.post("/api/efforts", json={"efforts": [e]}, headers=hh).status_code == 200
    ride = {
        "record": {"date": "2026-11-15T00:00:00.000Z"},
        "segments": [{"segment": "ctx:climb:0", "secs": 390}],
    }
    ctx = ride_context(store, "luke", ride)
    assert ctx["prev"] == {60: 398, 5: 820}  # not the test ride, not the later one
    assert ctx["places"] == {"ctx:climb:0": (1, 2)}  # 390 s beats Steve's 400 s
    ctx = ride_context(store, "luke", {**ride, "segments": [{"segment": "ctx:climb:0", "secs": 420}]})
    assert ctx["places"]["ctx:climb:0"] == (2, 2)


def test_old_rides_in_games_that_have_gone_still_get_a_plain_post():
    ambo = {
        **copy.deepcopy(BUS),
        "group": {"mode": "ambo", "score": 4321, "riders": [{"id": "luke", "name": "Luke"}], "reviews": [1]},
    }
    title, about = describe(ambo, "luke")
    assert (
        title.startswith("🚑 Kidney Stone Express · ")
        and "Crew score 4321" in about
        and "Crew: Luke" in about
    )
    for mode in ("madness", "date", "climate", "watch", "last", "ttt", "quiz", "galley", "hunt"):
        title, about = describe({"group": {"mode": mode, "awards": [{"award": "X"}, "junk"]}}, "luke")
        assert " · Ride" in title and "Crew score" not in about and "🏆 X: ?" in about
    assert describe({"group": {"mode": "madness"}}, "luke")[0] == "🤯 VO2 Madness · Ride"


def test_an_old_bus_ride_with_scrap_still_posts_and_never_mentions_it():
    old = copy.deepcopy(BUS)
    old["group"]["scrap"] = 412
    title, about = describe(old, "luke")
    assert title.startswith("🧟 Zombie Bus · ") and "Score 1234" in about
    assert "scrap" not in (title + about).lower()


def test_an_old_bus_ride_with_servo_shop_fields_still_posts_and_never_mentions_the_shop():
    old = copy.deepcopy(BUS)
    old["group"] |= {"shop": True, "wares": ["plating", "ram"], "repel": 1, "syncw": 3}
    title, about = describe(old, "luke")
    assert title.startswith("🧟 Zombie Bus · ") and "Score 1234" in about
    assert not {"shop", "upgrade", "repellent"} & set((title + about).lower().split())

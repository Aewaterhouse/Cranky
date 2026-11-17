from zombie_bus_server import config as C
from zombie_bus_server.modes.zombie_bus import ZombieBus
from zombie_bus_server.session import Rider


class FakeRoom:
    code = "TEST"

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
    room, bus = FakeRoom(STEADY), ZombieBus("easy")  # above easy the horde gains on even a perfect crew
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
    room.el = C.FELL_GRACE_S  # past the start's grace, as is the block
    fx = run(room, bus, 31, bel0=C.FELL_STEP_GRACE_S)
    r0 = room.riders["r0"]
    assert r0.st == "fell" and r0.tier == "medium" and any(f["k"] == "fell" for f in fx)
    fx = run(room, bus, 21, bel0=31 + C.FELL_STEP_GRACE_S)
    assert r0.st == "riding" and any(f["k"] == "hauled" and "Crew hauled" in f["text"] for f in fx)


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
    gap = bus.gap
    fx = run(room, bus, 1, i=1, ev="roadblock", bel0=1)
    assert any(f["k"] == "smash" for f in fx) and bus.rb is None
    assert any(f["k"] == "harpoon" for f in fx) and bus.gap >= gap + C.RB_SMASH_GAP + C.HARPOON_GAP - 5

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
    bus.armour = 50
    bus.buy(r0, "plating")
    assert bus.armour == 50, "shop is closed outside servo stops"
    run(room, bus, 1, ev="servo")
    bus.wares = list(C.SHOP)
    assert bus.state(room, 1, 0)["shop"]
    bus.buy(r0, "plating")
    assert bus.armour == 75 and not bus.state(room, 1, 0)["shop"], "one free pick a stop"
    bus.buy(r0, "repellent")
    assert bus.repel == 0
    run(room, bus, 1, i=0)
    run(room, bus, 1, ev="servo")
    bus.wares = list(C.SHOP)
    bus.buy(r0, "repellent")
    bus.damage(10, "x")
    assert bus.armour == 75 and bus.repel == 0


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


def test_discord_summary_text():
    from zombie_bus_server.discord import format_summary, post

    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 0.9)
    run(room, bus, 10)
    text = format_summary("Bus Quick 30", bus.summary(room))
    assert "Bus Quick 30" in text and "Iron Lungs" in text and "Crew: R0 90%" in text
    post(text)  # no webhook configured: a silent no-op


def test_difficulty_scales_gap_damage_and_score():
    gaps, scores = {}, {}
    for level in ("easy", "normal", "nightmare"):
        room, bus = FakeRoom(STEADY), ZombieBus(level)
        set_all(room, 0.95)
        room.riders["r0"].cad = 120
        run(room, bus, 10)
        gaps[level], scores[level] = bus.gap, bus.summary(room)["score"]
        bus.damage(10, "x")
        assert bus.armour == 100 - 10 * C.DIFFICULTY[level]["damage"]
    assert gaps["easy"] > gaps["normal"] > gaps["nightmare"]
    assert scores["nightmare"] > scores["normal"] > scores["easy"]


def test_nitro_charges_on_clean_riding_and_fires():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 0.9)
    run(room, bus, 20)
    assert bus.nitro == 0
    set_all(room, 1.0)
    fx = run(room, bus, C.NITRO_CHARGE_S / 2)
    assert 0.4 < bus.nitro < 0.6 and not any(f["k"] == "nitro" for f in fx)
    fx = run(room, bus, C.NITRO_CHARGE_S / 2 + 1)
    assert any(f["k"] == "nitro" for f in fx) and bus.state(room, 1, 0)["boost"]
    fast = bus.speed
    run(room, bus, C.NITRO_S + 1)
    assert not bus.state(room, 1, 0)["boost"] and bus.speed < fast


def test_personal_challenge_pays_when_held():
    for cad, won in ((112, True), (88, False)):
        room, bus = FakeRoom(STEADY, n=2), ZombieBus()
        set_all(room, 0.9, cad=cad)
        bus.next_challenge = 0
        fx = run(room, bus, 1)
        start = [f for f in fx if f["k"] == "challenge"]
        assert len(start) == 1 and bus.challenge
        bus.challenge["kind"] = "spin"
        fx = run(room, bus, C.CHALLENGE_S + 1)
        kinds = {f["k"] for f in fx}
        assert ("challenge_won" in kinds) == won and ("challenge_lost" in kinds) != won
        assert bus.challenge is None and bus.next_challenge > room.el


def test_weekly_mutators_apply_above_easy():
    from datetime import date, timedelta

    from zombie_bus_server.modes.zombie_bus import weekly_mutator

    assert weekly_mutator(date(2026, 11, 12)) in C.MUTATORS
    weeks = {weekly_mutator(date(2026, 1, 5) + timedelta(weeks=i))["id"] for i in range(len(C.MUTATORS))}
    assert weeks == {m["id"] for m in C.MUTATORS}
    bolts = next(m for m in C.MUTATORS if m["id"] == "bolts")
    assert ZombieBus("normal", bolts).armour == 70 and ZombieBus("easy", bolts).armour == 100
    closed = next(m for m in C.MUTATORS if m["id"] == "closed")
    room, bus = FakeRoom(STEADY), ZombieBus("normal", closed)
    set_all(room, 1.0)
    run(room, bus, 1, ev="servo")
    bus.armour = 50
    bus.buy(room.riders["r0"], "plating")
    assert bus.armour == 50 and not bus.state(room, 1, 0)["shop"]


def kinds(fx):
    return [f["k"] for f in fx if f["k"] in ("drop", "airstrike", "gunship")]


def test_streak_pays_out_in_order_then_starts_again():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 0.92)
    assert kinds(run(room, bus, 44)) == []
    assert kinds(run(room, bus, 2)) == ["drop"]
    assert bus.state(room, 1, 0)["next"] == "airstrike"
    assert kinds(run(room, bus, 46)) == ["airstrike"]
    assert kinds(run(room, bus, 60)) == ["gunship"]
    st = bus.state(room, 1, 0)
    assert st["gunship"] and st["streak"] == 0 and st["next"] == "drop"
    run(room, bus, C.GUNSHIP_S)
    assert not bus.state(room, 1, 0)["gunship"] and bus.streak > 0


def test_streak_resets_on_a_lapse_or_a_fall_and_holds_outside_its_events():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 30)
    set_all(room, 0.8)
    run(room, bus, C.STREAK_GRACE_S - 1)
    assert bus.streak == 30
    run(room, bus, 2)
    assert bus.streak == 0
    set_all(room, 1.0)
    run(room, bus, 30)
    run(room, bus, 20, ev="servo")
    assert bus.streak == 30
    room.riders["r0"].st = "fell"
    run(room, bus, 1)
    assert bus.streak == 0


def test_gunship_opens_the_gap():
    gaps = []
    for until in (-1.0, 1e9):
        room, bus = FakeRoom(STEADY), ZombieBus()
        set_all(room, 0.85)
        bus.gunship_until = until
        run(room, bus, 10)
        gaps.append(bus.gap)
    assert abs(gaps[1] - gaps[0] - C.GUNSHIP_GAP * 10) < 0.01


def test_nightmare_catches_a_perfect_crew_and_harder_levels_drop_riders_sooner():
    room, bus = FakeRoom(STEADY), ZombieBus("nightmare")
    set_all(room, 1.0)
    for n, r in enumerate(room.riders.values()):
        r.cad = 70 + 15 * n  # out of cadence sync, so no tune-up bonus
    fx = run(room, bus, 120)
    assert any(f["k"] == "hit" for f in fx)
    falls = {}
    for level in ("easy", "nightmare"):
        room, bus = FakeRoom(STEADY), ZombieBus(level)
        set_all(room, 0.55)  # under nightmare's line, over easy's
        room.el = C.FELL_GRACE_S
        run(room, bus, C.FELL_AFTER_S + 2, bel0=C.FELL_STEP_GRACE_S)
        falls[level] = sum(r.st == "fell" for r in room.riders.values())
    assert falls == {"easy": 0, "nightmare": 4}


def test_nobody_falls_off_while_erg_ramps_at_the_start_a_new_block_or_the_warm_up():
    for el0, bel0, ev in ((0.0, 60.0, "longhaul"), (120.0, 0.0, "longhaul"), (120.0, 60.0, "warmup")):
        room, bus = FakeRoom(STEADY), ZombieBus()
        set_all(room, 0.2)
        room.el = el0
        secs = C.FELL_STEP_GRACE_S - 1 if bel0 == 0 else (C.FELL_GRACE_S - 1 if el0 == 0 else 40)
        run(room, bus, secs, ev=ev, bel0=bel0)
        assert all(r.st == "riding" for r in room.riders.values()), (el0, bel0, ev)


def test_a_servo_stop_where_nobody_buys_picks_for_the_crew():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 1, ev="servo")
    bus.armour, bus.wares = 50, list(C.SHOP)
    fx = run(room, bus, 1, ev="longhaul")
    assert bus.armour == 50 + C.PLATING_ARMOUR
    assert any(f["k"] == "buy" and f["id"] is None and "servo" in f["text"] for f in fx)
    run(room, bus, 1, ev="servo")
    bus.buy(room.riders["r0"], "sync")
    fx = run(room, bus, 1, ev="longhaul")
    assert not [
        f for f in fx if f["k"] == "buy" and f["id"] is None
    ], "someone shopped, so the servo keeps out of it"


def test_the_crew_votes_the_next_leg_at_the_servo():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 1, i=0)
    run(room, bus, 1, ev="servo")
    q = bus.ask(room, room.riders["r0"])
    assert q["k"] == "road" and [o["v"] for o in q["opts"]] == list(C.LEGS)
    for rid in ("r0", "r1", "r2"):
        bus.on_act(room, room.riders[rid], "road", "easy")
    bus.on_act(room, room.riders["r3"], "road", "nowhere")
    assert bus.ask(room, room.riders["r0"])["v"] == "easy" and "r3" not in bus.road_votes
    fx = run(room, bus, 1, ev="longhaul")
    assert bus.leg == C.LEGS["easy"] and any(f["k"] == "leg" for f in fx)
    assert bus.ask(room, room.riders["r0"]) is None
    armour, bus.repel = bus.armour, 0  # the servo's free pick may have been repellent
    bus.damage(10, "ouch")
    assert armour - bus.armour == 10 * C.DIFFICULTY["normal"]["damage"] * 0.5


def test_the_shortcut_moves_the_horde_one_way_or_the_other():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 1, i=0)
    run(room, bus, 1, ev="servo")
    bus.on_act(room, room.riders["r0"], "road", "shortcut")
    gap = bus.gap
    run(room, bus, 0.5, ev="longhaul")
    assert abs(abs(bus.gap - gap) - C.SHORTCUT_GAP) < 3


def test_each_stop_offers_three_upgrades_and_only_those_sell():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 1, i=0)
    run(room, bus, 1, ev="servo")
    assert len(bus.wares) == C.SHOP_OFFER and set(bus.wares) <= set(C.SHOP)
    assert bus.state(room, 1, 0)["wares"] == bus.wares
    off = next(k for k in C.SHOP if k not in bus.wares)
    bus.buy(room.riders["r0"], off)
    assert not bus.shopped
    bus.wares = ["nitro", "ram", "sync"]
    bus.buy(room.riders["r0"], "nitro")
    assert bus.nitro == 1.0 and bus.shopped


def test_riders_and_the_fallen_can_honk_and_heckle():
    room, bus = FakeRoom(STEADY), ZombieBus()
    room.riders["r1"].st = "fell"
    bus.on_act(room, room.riders["r1"], "emoji", "📯")
    bus.on_act(room, room.riders["r0"], "emoji", "🍆")
    assert [(f["k"], f["text"], f["id"]) for f in bus.fx] == [("emoji", "📯", "r1")]


def test_no_harpoon_unless_every_rider_lands_their_sprint():
    blocks = [STEADY[0], {"type": "sprint", "dur": 10}, STEADY[1]]
    room, bus = FakeRoom(blocks), ZombieBus()
    set_all(room, None)
    run(room, bus, 1, i=1, ev="roadblock")
    for r in list(room.riders.values())[:3]:
        bus.on_sprint(r, 1, "LEGEND", 3)
    bus.on_sprint(room.riders["r3"], 1, "FAIL", 0)
    snap = ZombieBus.from_dict(bus.to_dict())
    assert snap.rb["landed"] == {"r0", "r1", "r2"}
    fx = run(room, bus, 1, i=1, ev="roadblock", bel0=1)
    assert any(f["k"] == "smash" for f in fx) and not any(f["k"] == "harpoon" for f in fx)


def test_rolling_turns_rotate_and_a_clean_turn_gains_metres():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    fx = run(room, bus, 1)
    assert bus.front["id"] == "r0" and [f["text"] for f in fx if f["k"] == "turn"] == ["R0, take the front."]
    gap = bus.gap
    fx = run(room, bus, C.FRONT_S)
    assert bus.gap > gap
    turn = [f for f in fx if f["k"] == "turn"]
    assert turn[0]["id"] == "r1" and "R0 did a clean turn" in turn[0]["text"]
    room.riders["r1"].s = 0.85
    fx = run(room, bus, C.FRONT_S)
    assert [f["text"] for f in fx if f["k"] == "turn"] == ["R2, take the front."]


def test_weather_is_mostly_clear_and_each_kind_bites():
    import random as rnd

    from zombie_bus_server.modes.zombie_bus import roll_weather

    rng = rnd.Random(4)
    rolls = [roll_weather(rng) for _ in range(2000)]
    assert set(rolls) == set(C.WEATHER) and rolls.count("clear") > 1000
    wet = ZombieBus()
    wet.weather = "rain"
    wet.damage(10, "x")
    assert 100 - wet.armour == 10 * C.DIFFICULTY["normal"]["damage"] * 1.2
    room2, night = FakeRoom(STEADY), ZombieBus()
    night.weather = "night"
    assert night.state(room2, 1, 0)["weather"] == "night"


BOSS_PLAN = [
    STEADY[0],
    {"type": "steady", "dur": 120, "pct": 90},
    {"type": "steady", "dur": 100, "pct": 95},
    STEADY[0],
]


def boss_ride(s):
    room, bus = FakeRoom(BOSS_PLAN), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 1, i=0, ev="warmup")
    run(room, bus, 5, i=1)
    fx = run(room, bus, 1, i=2)
    assert bus.boss["i"] == 2 and any(f["k"] == "boss" for f in fx)
    assert bus.state(room, 2, 0)["boss"]["left"] > 0.9
    set_all(room, s)
    run(room, bus, 99, i=2)
    armour = bus.armour
    fx = run(room, bus, 1, i=3, ev="cooldown")
    assert bus.state(room, 3, 0)["boss"] is None
    return bus, fx, armour


def test_the_last_long_effort_is_a_boss_and_riding_on_target_beats_it():
    bus, fx, armour = boss_ride(1.0)
    assert any(f["k"] == "bosswin" for f in fx) and bus.armour == min(100, armour + C.BOSS_ARMOUR)


def test_a_boss_the_crew_cannot_hold_lands_a_big_hit():
    bus, fx, armour = boss_ride(0.5)
    assert not any(f["k"] == "bosswin" for f in fx) and bus.armour < armour


def test_runners_chase_a_slow_cadence_and_brutes_a_crew_off_target():
    fast, slow = (FakeRoom(STEADY), ZombieBus()), (FakeRoom(STEADY), ZombieBus())
    set_all(fast[0], 1.0, cad=95)
    set_all(slow[0], 1.0, cad=70)
    for room, bus in (fast, slow):
        run(room, bus, 20)
    assert slow[1].gap < fast[1].gap - 3  # the gunner claws a few metres back at 70 rpm
    assert fast[1].state(fast[0], 1, 0)["zed"].startswith("🏃 RUNNERS")
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 0.8)
    assert bus.zed_pull("rampup", list(room.riders.values()), 0.8) == C.ZED_TYPES["rampup"]["pull"]
    assert bus.zed_pull("rampup", list(room.riders.values()), 0.95) == 0
    assert bus.zed_pull("servo", list(room.riders.values()), 0.1) == 0


def test_crew_roles_fire_on_their_cue_then_cool_down():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0, cad=90)
    run(room, bus, 1)
    assert [bus.roles[f"r{i}"]["role"] for i in range(4)] == [*C.ROLES, "driver"]
    room.riders["r0"].cad = 105  # the driver spins it up
    gap = bus.gap
    fx = run(room, bus, 6)
    roles = [f for f in fx if f["k"] == "role"]
    assert [f["id"] for f in roles if "floored" in f["text"]] == ["r0"]
    assert bus.state(room, 1, 0)["roles"]["r0"]["cd"] > 80
    fx = run(room, bus, 10)
    assert not [f for f in fx if f["k"] == "role" and f["id"] == "r0"]  # cooling down
    assert bus.gap > gap


def test_the_best_moments_land_in_the_summary_with_their_time():
    room, bus = FakeRoom(STEADY), ZombieBus()
    set_all(room, 1.0)
    run(room, bus, 2)
    bus.gap = 2
    run(room, bus, 1)
    bus.gap = 20
    run(room, bus, 1)
    bus.emit("slowmo", "R0: LEGEND!", "r0")
    bus.emit("hit", "ouch")
    h = bus.summary(room)["highlights"]
    assert [x["text"] for x in h] == ["Escaped the horde by a whisker!", "R0: LEGEND!"]
    assert h[0]["t"] == 4

import pytest

from zombie_bus_server.plan import block_target, event_for, flatten, generate, load_plans, locate, total


def test_all_plans_load_and_validate():
    plans = load_plans()
    assert len(plans) >= 10
    for p in plans.values():
        assert total(flatten(p["blocks"])) > 0


def test_targets_match_client():
    assert block_target({"type": "steady", "dur": 10, "pct": 90}, "hard", 0) == pytest.approx(0.9)
    assert block_target({"type": "steady", "dur": 10, "pct": 90}, "easy", 0) == pytest.approx(0.72)
    pct = {"hard": 90, "medium": 85, "easy": 70}
    assert block_target({"type": "steady", "dur": 10, "pct": pct}, "medium", 0) == pytest.approx(0.85)
    assert block_target({"type": "ramp", "dur": 100, "pct": [50, 70]}, "hard", 50) == pytest.approx(0.6)
    ou = {"type": "over-under", "dur": 240, "pct": [95, 105], "step": 60}
    assert block_target(ou, "hard", 30) == pytest.approx(0.95)
    assert block_target(ou, "hard", 90) == pytest.approx(1.05)
    assert block_target({"type": "sprint", "dur": 10}, "hard", 0) is None


def test_flatten_and_locate():
    blocks = flatten(load_plans()["ss-2x15"]["blocks"])
    assert total(blocks) == 600 + 2 * 1200 + 300
    assert locate(blocks, 700) == (1, 100)
    assert locate(blocks, 1e6) is None


@pytest.mark.parametrize("minutes", [30, 45, 60, 90])
def test_generator_scales(minutes):
    p = generate(load_plans()["bus-crew-60"], minutes)
    assert abs(total(p["blocks"]) - minutes * 60) < minutes * 60 * 0.12


def test_generator_without_sets():
    assert total(generate(load_plans()["z2-60"], 90)["blocks"]) == pytest.approx(5400, abs=60)


def test_events_mapping():
    blocks = flatten(load_plans()["bus-crew-45"]["blocks"])
    evs = [event_for(blocks, i) for i in range(len(blocks))]
    assert evs[0] == "warmup" and evs[-1] == "cooldown"
    assert {"roadblock", "surge", "servo", "longhaul"} <= set(evs)

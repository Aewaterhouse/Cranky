"""Unit tests for the route pack builder's pure helpers (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import build_routes as br  # noqa: E402


def test_shortest_takes_the_shorter_road() -> None:
    adj = {
        1: [(2, 100.0), (3, 30.0)],
        2: [(1, 100.0), (3, 30.0)],
        3: [(1, 30.0), (2, 30.0)],
    }
    assert br.shortest(adj, 1, 2) == [1, 3, 2]


def test_resample_spacing() -> None:
    line = [(-27.0, 153.0), (-27.0, 153.01), (-27.005, 153.01)]
    pts = br.resample(line, 10)
    gaps = [br.haversine(a, b) for a, b in zip(pts, pts[1:], strict=False)]
    total = br.haversine(line[0], line[1]) + br.haversine(line[1], line[2])
    assert len(pts) == int(total // 10) + 1
    # The corner is cut by at most one step, so every gap is close to 10 m.
    assert all(7 < g < 10.01 for g in gaps)


def test_stats_on_a_steady_climb() -> None:
    ele = [100 + i * 0.5 for i in range(201)]  # 2 km at 5%
    s = br.stats(ele)
    assert s["km"] == 2.0
    assert s["gainM"] == 100
    assert s["avgGrade"] == 5.0
    assert s["maxGrade"] == 5.0
    assert len(s["profile"]) == br.PROFILE_N
    assert s["profile"][0] == 100 and s["profile"][-1] == 200


def test_stats_smooths_noise() -> None:
    flat = [50 + (1 if i % 2 else -1) for i in range(301)]
    assert br.stats(flat)["gainM"] < 30  # 300 m of rises unsmoothed

"""The Python road physics and route geometry against the vectors the client generates and tests too."""

import json

import pytest

from zombie_bus_server import config as C
from zombie_bus_server import road_physics as P
from zombie_bus_server.road_route import Road

V = json.loads((C.CONTENT / "tests" / "road-vectors.json").read_text())
TOL = 1e-6


def near(got: float, want: float) -> bool:
    return got == pytest.approx(want, abs=TOL)


def test_physics_matches_the_client():
    assert all(near(P.total_mass(x["kg"]), x["out"]) for x in V["mass"])
    for x in V["resistance"]:
        assert near(P.resistance(x["v"], x["grade"], x["mass"], x["wind"], x["draft"]), x["out"]), x
    for x in V["step"]:
        got = P.step_speed(
            x["v"], x["power"], x["grade"], x["mass"], x["dt"], x["wind"], x["limit"], x["draft"]
        )
        assert near(got, x["out"]), x
    assert all(near(P.corner_speed(x["curv"]), x["out"]) for x in V["corner"])
    for x in V["limit"]:
        curv = x["curv"]
        # JS Math.round, as the generator indexes the bend list.
        got = P.speed_limit(x["v"], lambda s, c=curv: c[min(len(c) - 1, int(s / 5 + 0.5))])
        assert near(got, x["out"]), x


def test_drafting_and_keep_together_match_the_client():
    assert all(near(P.draft_factor(x["gaps"]), x["out"]) for x in V["draft"])
    assert all(near(P.band_factor(x["gap"]), x["out"]) for x in V["band"])
    assert P.draft_factor([1]) == pytest.approx(1 - C.DRAFT_WHEEL)
    assert min(P.draft_factor([0.1 * k for k in range(1, 60)]), 1) == pytest.approx(1 - C.DRAFT_CAP)
    assert P.band_factor(-1e4) == pytest.approx(1 + C.BAND_MAX)
    assert P.band_factor(1e4) == pytest.approx(1 - C.BAND_MAX)


@pytest.mark.parametrize("route", V["routes"], ids=lambda r: r["id"])
def test_route_geometry_matches_the_client(route):
    road = Road(route["id"], route["laps"])
    assert road.laps == route["laps"]
    assert road.lap.space == route["space"]
    assert near(road.distance, route["distance"])
    for x in route["at"]:
        d = x["d"]
        assert near(road.grade_at(d), x["grade"]), x
        # The client keeps curvature in 32-bit floats.
        assert road.curv_at(d) == pytest.approx(x["curv"], abs=1e-6), x
        assert P.speed_limit(16, lambda s, d=d: road.curv_at(d + s)) == pytest.approx(x["limit"], abs=1e-3), x

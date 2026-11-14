"""Uploads to Strava: the job's steps, duplicates, retries and who may upload what, with Strava mocked."""

import base64
import time

import httpx
import pytest
from test_accounts import auth, client
from test_strava import FakeStrava, connect

from zombie_bus_server import app as app_mod
from zombie_bus_server import config, strava
from zombie_bus_server.strava_text import describe
from zombie_bus_server.strava_uploads import Uploads

U = app_mod.uploads
FIT = base64.b64encode(b"\x0e\x10fitdata").decode()


class FakeUploads(FakeStrava):
    """Strava's upload endpoints: processing for `slow` polls, then an activity (or `error`)."""

    def __init__(self):
        super().__init__()
        self.slow = 1
        self.error = ""
        self.fail_next = 0

    def more(self, req: httpx.Request) -> httpx.Response:
        if self.fail_next:
            self.fail_next -= 1
            return httpx.Response(503, json={})
        if req.method == "POST" and req.url.path == "/api/v3/uploads":
            return httpx.Response(201, json={"id": 77, "status": "Your activity is still being processed."})
        if req.url.path == "/api/v3/uploads/77":
            if self.slow:
                self.slow -= 1
                return httpx.Response(200, json={"id": 77, "error": None, "activity_id": None})
            if self.error:
                return httpx.Response(200, json={"id": 77, "error": self.error, "activity_id": None})
            return httpx.Response(200, json={"id": 77, "error": None, "activity_id": 9001})
        if req.method == "PUT" and req.url.path == "/api/v3/activities/9001":
            return httpx.Response(200, json={"id": 9001, "sport_type": "VirtualRide"})
        return httpx.Response(404, json={})


@pytest.fixture
def fake(monkeypatch):
    f = FakeUploads()
    monkeypatch.setattr(config, "STRAVA_CLIENT_ID", "123")
    monkeypatch.setattr(config, "STRAVA_CLIENT_SECRET", "shh")
    monkeypatch.setattr(strava, "transport", httpx.MockTransport(f))
    monkeypatch.setattr(strava, "paused_until", 0.0)
    with U.lock, U.db:
        U.db.execute("DELETE FROM strava WHERE rider IN ('luke', 'steve')")
        U.db.execute("DELETE FROM strava_uploads")
    return f


def bus_ride(date: str, secs: int = 1800) -> dict:
    return {
        "planName": "Bus Quick 30",
        "np": 231,
        "avgPower": 210,
        "record": {"date": date, "secs": secs},
        "crew": True,
        "group": {
            "distance": 15300,
            "armour": 64,
            "gap": 42,
            "score": 1234,
            "riders": [
                {"id": "luke", "name": "Luke", "inBandSecs": 1500, "kj": 300.0},
                {"id": "steve", "name": "Steve", "inBandSecs": 1200, "kj": 100.0},
            ],
            "awards": [{"award": "Iron Lungs", "id": "luke", "name": "Luke", "why": "92% compliance"}],
        },
    }


def save(h: dict, ride: dict) -> int:
    r = client.post("/api/rides", json={"summary": ride}, headers=h).json()
    assert r["id"]
    return r["id"]


def run(until: str, n: int, rider: str = "luke", steps: int = 10) -> dict:
    for i in range(steps):
        U.step(time.time() + 10**6 + i * 100)
        if U.rides(rider).get(n, {}).get("status") == until:
            break
    return U.rides(rider)[n]


def test_upload_processes_then_becomes_a_virtual_ride(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    n = save(h, bus_ride("2026-11-14T06:00:00.000Z"))
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h).json()["status"] == "queued"
    assert run("done", n) == {"status": "done", "activity": "9001", "error": None}
    up = next(c for c in fake.calls if c[1] == "/api/v3/uploads")
    assert f'name="external_id"\r\n\r\ncranky-luke-{n}'.encode() in up[2]
    assert b'name="data_type"\r\n\r\nfit' in up[2] and b'name="trainer"\r\n\r\n1' in up[2]
    assert "🧟 Zombie Bus · Bus Quick 30 · survived with a 42 m gap".encode() in up[2]
    put = next(c for c in fake.calls if c[0] == "PUT")
    assert b'"sport_type":"VirtualRide"' in put[2]


def test_a_resend_never_uploads_twice_and_a_strava_duplicate_counts_as_done(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    n = save(h, bus_ride("2026-11-14T07:00:00.000Z"))
    client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h)
    run("done", n)
    again = client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h).json()
    assert again["status"] == "done"
    U.step(time.time() + 10**6)
    assert fake.paths().count("/api/v3/uploads") == 1
    m = save(h, bus_ride("2026-11-14T08:00:00.000Z"))
    fake.slow, fake.error = 0, "cranky.fit duplicate of activity 555"
    client.post(f"/api/strava/upload/{m}", json={"fit": FIT}, headers=h)
    assert run("done", m)["activity"] == "555"


def test_failures_back_off_survive_a_restart_and_end_in_retry(fake, monkeypatch):
    _, h = auth("luke", "Luke")
    connect(h)
    n = save(h, bus_ride("2026-11-14T09:00:00.000Z"))
    client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h)
    fake.fail_next = 1
    now = time.time()
    U.step(now)
    job = U._get("luke", n)
    assert job["status"] == "queued" and job["tries"] == 1 and job["next"] == pytest.approx(now + 60)
    assert U.step(now + 30) == 0  # not due yet
    fake.fail_next = 1
    U.step(now + 61)
    assert U._get("luke", n)["next"] == pytest.approx(now + 61 + 120)
    fresh = Uploads(app_mod.strava)  # a restarted server finds the job on disk
    fresh.step(now + 10**6)
    assert fresh.rides("luke")[n]["status"] == "processing"
    fake.fail_next = 10**6
    for i in range(config.STRAVA_TRIES + 2):
        fresh.step(time.time() + 10**7 + i * 10**4)
    assert fresh.rides("luke")[n]["status"] == "failed"
    fake.fail_next = 0
    fake.slow = 0
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h).json()["status"] == "queued"
    assert run("done", n)["status"] == "done"


def test_a_rate_limit_waits_without_using_a_try(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    n = save(h, bus_ride("2026-11-14T10:00:00.000Z"))
    client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h)
    fake.more = lambda req: httpx.Response(429, json={})
    U.step(time.time() + 1)
    job = U._get("luke", n)
    assert job["tries"] == 0 and job["next"] == strava.paused_until and job["next"] % 900 == 0


def test_riders_upload_only_their_own_rides_and_never_see_tokens(fake):
    _, h = auth("luke", "Luke")
    _, hs = auth("steve", "Steve")
    connect(h)
    n = save(h, bus_ride("2026-11-14T11:00:00.000Z"))
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=hs).status_code == 404
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}).status_code == 401
    connect(hs)
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=hs).status_code == 404
    r = client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h).json()
    assert set(r) == {"status", "activity", "error"}
    short = save(h, bus_ride("2026-11-14T12:00:00.000Z", secs=20))
    assert client.post(f"/api/strava/upload/{short}", json={"fit": FIT}, headers=h).status_code == 422
    assert client.post(f"/api/strava/upload/{n}", json={"fit": "%%%"}, headers=h).status_code == 422


def test_not_connected_cannot_upload(fake):
    _, h = auth("luke", "Luke")
    n = save(h, bus_ride("2026-11-14T13:00:00.000Z"))
    assert client.post(f"/api/strava/upload/{n}", json={"fit": FIT}, headers=h).status_code == 409


def test_titles_and_descriptions_by_mode():
    title, about = describe(bus_ride("x"), "luke", "https://www.cranky.life/p/abc")
    assert title == "🧟 Zombie Bus · Bus Quick 30 · survived with a 42 m gap"
    assert "Score 1234 · 15.3 km · armour 64%" in about and "Crew: Luke, Steve" in about
    assert "🏆 Iron Lungs: Luke (92% compliance)" in about
    assert "Me: NP 231 W · on target 25:00 (83%) · 75% of the crew's work" in about
    assert about.endswith("Postcard: https://www.cranky.life/p/abc\nRidden on Cranky · cranky.life")
    caught = bus_ride("x")
    caught["group"]["armour"] = 0
    assert "caught" in describe(caught, "luke")[0]
    caught["group"]["riders"][0]["inBandSecs"] = 4000  # longer than the ride (a sped-up server)
    assert "(100%)" in describe(caught, "luke")[1]
    mad = bus_ride("x")
    mad["group"].update(mode="madness")
    mad["group"]["riders"][0].update(points=812, redSecs=95)
    title, about = describe(mad, "luke")
    assert title.startswith("🔥 VO2 Madness") and "my effort points 812" in about
    free = {
        "planName": "x",
        "route": {"name": "Mount Coot-tha"},
        "distance": 12345,
        "ascent": 280,
        "record": {"secs": 2400},
        "np": 200,
        "avgPower": 180,
        "segments": [{"pr": True}],
    }
    title, about = describe(free, "luke")
    assert title == "Mount Coot-tha · Cranky free ride" and "12.3 km · 280 m climbed · 40:00" in about
    assert "1 segment PR" in about and about.endswith("Ridden on Cranky · cranky.life")
    solo = {
        "planName": "Sweet Spot 3x10",
        "record": {"secs": 3700},
        "np": 240,
        "avgPower": 220,
        "tss": 70,
        "if": 0.86,
        "compliance": 0.93,
    }
    title, about = describe(solo, "luke")
    assert title == "💪 Sweet Spot 3x10 · Cranky workout" and "1:01:40" in about and "93% on plan" in about


def test_postcard_page_is_public_only_once_uploaded_and_previews_as_the_picture(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    n = save(h, bus_ride("2026-11-14T14:00:00.000Z"))
    png = base64.b64encode(b"\x89PNGcard").decode()
    client.post(f"/api/strava/upload/{n}", json={"fit": FIT, "png": png}, headers=h)
    card = U._get("luke", n)["card"]
    assert len(card) >= 20
    assert client.get(f"/p/{card}").status_code == 404  # not on Strava yet
    run("done", n)
    up = next(c for c in fake.calls if c[1] == "/api/v3/uploads")
    assert f"Postcard: {config.PUBLIC_URL}/p/{card}".encode() in up[2]
    page = client.get(f"/p/{card}")  # no login
    assert page.status_code == 200 and "text/html" in page.headers["content-type"]
    assert f'<meta property="og:image" content="{config.PUBLIC_URL}/p/{card}.png">' in page.text
    assert "Zombie Bus" in page.text
    img = client.get(f"/p/{card}.png")
    assert img.content == b"\x89PNGcard" and img.headers["content-type"] == "image/png"
    assert client.get("/p/not-a-card").status_code == 404
    assert client.get("/p/not-a-card.png").status_code == 404
    # A re-send keeps the same page; a ride sent without a postcard gets none.
    assert U.card_for("luke", n) == card
    m = save(h, bus_ride("2026-11-14T15:00:00.000Z"))
    client.post(f"/api/strava/upload/{m}", json={"fit": FIT}, headers=h)
    assert U._get("luke", m)["card"] is None

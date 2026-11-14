"""Strava connect, tokens and disconnect, with Strava's HTTP calls mocked."""

import json
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from test_accounts import auth, client

from zombie_bus_server import app as app_mod
from zombie_bus_server import config, strava

S = app_mod.strava


class FakeStrava:
    """Answers Strava's endpoints and records every call."""

    def __init__(self):
        self.calls: list[tuple[str, str, bytes]] = []
        self.token_n = 0
        self.refuse_refresh = False

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.calls.append((req.method, req.url.path, req.content))
        form = parse_qs(req.content.decode(errors="ignore"))
        if req.url.path == "/oauth/token":
            if form.get("grant_type") == ["refresh_token"] and self.refuse_refresh:
                return httpx.Response(400, json={"message": "Bad Request"})
            if form.get("code") == ["bad"]:
                return httpx.Response(400, json={"message": "Bad Request"})
            self.token_n += 1
            return httpx.Response(
                200,
                json={
                    "access_token": f"acc{self.token_n}",
                    "refresh_token": f"ref{self.token_n}",
                    "expires_at": time.time() + 6 * 3600,
                    "athlete": {"id": 42, "firstname": "Luke", "lastname": "B"},
                },
            )
        if req.url.path == "/oauth/deauthorize":
            return httpx.Response(200, json={})
        return self.more(req)

    def more(self, req: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={})

    def paths(self) -> list[str]:
        return [p for _, p, _ in self.calls]


@pytest.fixture
def fake(monkeypatch):
    f = FakeStrava()
    monkeypatch.setattr(config, "STRAVA_CLIENT_ID", "123")
    monkeypatch.setattr(config, "STRAVA_CLIENT_SECRET", "shh")
    monkeypatch.setattr(strava, "transport", httpx.MockTransport(f))
    monkeypatch.setattr(strava, "paused_until", 0.0)
    for rid in ("luke", "steve"):
        with S.store.lock, S.db:
            S.db.execute("DELETE FROM strava WHERE rider = ?", (rid,))
    return f


def connect(h: dict, code: str = "abc", scope: str = "read,activity:write") -> httpx.Response:
    url = client.post("/api/strava/connect", headers=h).json()["url"]
    q = parse_qs(urlparse(url).query)
    assert q["scope"] == ["activity:write"] and q["redirect_uri"][0].endswith("/api/strava/callback")
    return client.get(
        "/api/strava/callback",
        params={"state": q["state"][0], "code": code, "scope": scope},
        follow_redirects=False,
    )


def test_connect_exchanges_the_code_and_keeps_tokens_on_the_server(fake):
    _, h = auth("luke", "Luke")
    r = connect(h)
    assert r.status_code == 303 and r.headers["location"] == "/?strava=connected#rider"
    st = client.get("/api/strava", headers=h).json()
    assert st == {"configured": True, "connected": True, "name": "Luke B", "auto": True}
    assert "acc1" not in json.dumps(st)
    sent = parse_qs(fake.calls[0][2].decode())
    assert sent["grant_type"] == ["authorization_code"] and sent["client_secret"] == ["shh"]


def test_state_is_single_use_tied_to_the_rider_and_expires(fake, monkeypatch):
    _, h = auth("luke", "Luke")
    url = client.post("/api/strava/connect", headers=h).json()["url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    ok = {"state": state, "code": "abc", "scope": "activity:write"}

    def back(q: dict) -> str:
        return client.get("/api/strava/callback", params=q, follow_redirects=False).headers["location"]

    assert "connected" in back(ok)
    again = back(ok)
    assert "strava=error" in again and "expired" in again
    assert "strava=error" in back({**ok, "state": "made-up"})
    url = S.connect_url("steve", now=time.time() - config.STRAVA_STATE_S - 1)
    assert "expired" in back({**ok, "state": parse_qs(urlparse(url).query)["state"][0]})
    _, hs = auth("steve", "Steve")
    assert client.get("/api/strava", headers=hs).json()["connected"] is False


def test_a_short_scope_or_a_refused_code_does_not_connect(fake):
    _, h = auth("luke", "Luke")
    assert "permission" in connect(h, scope="read").headers["location"]
    assert "strava=error" in connect(h, code="bad").headers["location"]
    assert client.get("/api/strava", headers=h).json()["connected"] is False


def test_tokens_refresh_before_they_expire(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    assert S.token("luke") == "acc1"
    later = time.time() + 6 * 3600 - config.STRAVA_REFRESH_EARLY_S + 60
    assert S.token("luke", now=later) == "acc2"
    sent = parse_qs(fake.calls[-1][2].decode())
    assert sent["grant_type"] == ["refresh_token"] and sent["refresh_token"] == ["ref1"]
    assert S.token("luke") == "acc2"
    fake.refuse_refresh = True
    with pytest.raises(PermissionError):
        S.token("luke", now=time.time() + 7 * 3600)


def test_disconnect_deauthorises_and_deletes_the_tokens(fake):
    _, h = auth("luke", "Luke")
    connect(h)
    assert client.post("/api/strava/disconnect", headers=h).json()["connected"] is False
    assert fake.paths()[-1] == "/oauth/deauthorize"
    assert parse_qs(fake.calls[-1][2].decode())["access_token"] == ["acc1"]
    with S.store.lock:
        assert S.db.execute("SELECT 1 FROM strava WHERE rider = 'luke'").fetchone() is None


def test_auto_upload_switch_and_another_riders_view(fake):
    _, h = auth("luke", "Luke")
    _, hs = auth("steve", "Steve")
    assert client.put("/api/strava/auto", json={"on": False}, headers=h).status_code == 409
    connect(h)
    assert client.put("/api/strava/auto", json={"on": False}, headers=h).json()["auto"] is False
    assert client.get("/api/strava", headers=hs).json() == {
        "configured": True,
        "connected": False,
        "name": None,
        "auto": True,
    }
    assert client.get("/api/strava").status_code == 401


def test_rate_limit_pauses_calls(fake, monkeypatch):
    fake.more = lambda req: httpx.Response(
        200, json={}, headers={"x-ratelimit-limit": "200,2000", "x-ratelimit-usage": "195,300"}
    )
    strava.send("GET", "https://www.strava.com/api/v3/athlete")
    with pytest.raises(strava.Busy):
        strava.send("GET", "https://www.strava.com/api/v3/athlete")
    assert strava.paused_until % 900 == 0


def test_connect_without_keys_says_so(monkeypatch):
    monkeypatch.setattr(config, "STRAVA_CLIENT_ID", "")
    _, h = auth("luke", "Luke")
    assert client.post("/api/strava/connect", headers=h).status_code == 503
    assert client.get("/api/strava", headers=h).json()["configured"] is False

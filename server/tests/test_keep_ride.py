"""Binned rides never arrive; "don't post" rides are kept but never upload by themselves."""

from test_accounts import auth, client
from test_rides import summary
from test_sim_rides import save


def test_a_binned_ride_is_not_stored():
    _, h = auth("jack", "Jack")
    before = len(client.get("/api/rides", headers=h).json())
    r = client.post("/api/rides", json={"summary": summary("2024-07-01T07:00:00Z", discard=True)}, headers=h)
    assert r.status_code == 200 and r.json()["saved"] is False and r.json()["id"] is None
    assert len(client.get("/api/rides", headers=h).json()) == before


def test_a_dont_post_ride_is_kept_and_listed_but_refuses_the_automatic_upload(monkeypatch):
    from zombie_bus_server import app as app_mod

    _, h = auth("jack", "Jack")
    n = save(h, summary("2024-07-02T07:00:00Z", noStrava=True))
    assert next(r for r in client.get("/api/rides", headers=h).json() if r["id"] == n)["noStrava"] is True
    monkeypatch.setattr(app_mod.strava, "status", lambda rid: {"connected": True})
    r = client.post(f"/api/strava/upload/{n}", json={"fit": "AA==", "auto": True}, headers=h)
    assert r.status_code == 409 and "chose not to post" in r.json()["detail"]
    # The rider's own Upload button in History still sends it (past the check, to the .fit).
    r = client.post(f"/api/strava/upload/{n}", json={"fit": "AA=="}, headers=h)
    assert r.status_code != 409
    bad = client.post(
        "/api/rides", json={"summary": summary("2024-07-03T07:00:00Z", noStrava="no")}, headers=h
    )
    assert bad.status_code == 422


def test_a_normal_ride_has_no_flag():
    _, h = auth("jack", "Jack")
    n = save(h, summary("2024-07-04T07:00:00Z"))
    assert "noStrava" not in next(r for r in client.get("/api/rides", headers=h).json() if r["id"] == n)

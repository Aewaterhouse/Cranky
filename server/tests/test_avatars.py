"""Rider bodies: the server's check of look.body, through the profile and the join message."""

import json

from test_accounts import auth, client

from zombie_bus_server import config
from zombie_bus_server.avatars import clean_body, clean_look, table
from zombie_bus_server.protocol import Join

VERSION, MAXES = table()
GOOD = "-".join([str(VERSION), *(str(m // 2) for m in MAXES)])


def test_a_valid_body_passes_and_out_of_range_values_are_clamped():
    assert clean_body(GOOD) == GOOD
    wild = "-".join([str(VERSION), *("9999" for _ in MAXES)])
    assert clean_body(wild) == "-".join([str(VERSION), *(str(m) for m in MAXES)])


def test_anything_else_is_dropped():
    bad = [
        None,
        7,
        "",
        "hat-cap",
        GOOD + "-1",
        GOOD.rsplit("-", 1)[0],
        "99" + GOOD[1:],
        GOOD.replace("-", "--", 1),
        GOOD.rsplit("-", 1)[0] + "-x",
        GOOD.rsplit("-", 1)[0] + "-1.5",
        GOOD.rsplit("-", 1)[0] + "--1",
        GOOD.rsplit("-", 1)[0] + "-٣",
        "-".join([str(VERSION), *("0" * 20 for _ in MAXES)]),
    ]
    for s in bad:
        assert clean_body(s) is None, s
    assert len(bad[-1]) > config.BODY_MAX_CHARS


def test_look_keeps_item_ids_and_only_a_valid_body():
    assert clean_look({"hat": "hat-cap"}) == {"hat": "hat-cap"}
    assert clean_look({"hat": "hat-cap", "body": GOOD}) == {"hat": "hat-cap", "body": GOOD}
    assert clean_look({"hat": "hat-cap", "body": "<script>"}) == {"hat": "hat-cap"}


def test_join_message_carries_a_checked_body_and_old_clients_still_join():
    join = {"t": "join", "name": "Luke", "ftp": 250, "tier": "hard"}
    assert Join(**join).look == {}
    assert Join(**join, look={"hat": "hat-cap"}).look == {"hat": "hat-cap"}
    assert Join(**join, look={"body": GOOD}).look == {"body": GOOD}
    assert Join(**join, look={"body": "nonsense", "outfit": "outfit-gold"}).look == {"outfit": "outfit-gold"}


def test_body_round_trips_through_the_profile_and_a_bad_one_is_not_stored():
    _, h = auth("jack", "Jack")
    p = {"id": "jack", "updated": 5}
    p["look"] = {"hat": "hat-cap", "body": GOOD}
    assert client.put("/api/profile/jack", json=p, headers=h).json()["saved"] is True
    assert client.get("/api/profile/jack", headers=h).json()["look"] == {"hat": "hat-cap", "body": GOOD}
    p = {**p, "updated": 6, "look": {"hat": "hat-cap", "body": "1-" + "9" * 500}}
    client.put("/api/profile/jack", json=p, headers=h)
    assert client.get("/api/profile/jack", headers=h).json()["look"] == {"hat": "hat-cap"}


def test_a_body_reaches_the_other_riders_in_the_lobby():
    _, h = auth("luke", "Luke")
    code = client.post("/api/rooms", headers=h).json()["code"]
    token = h["Authorization"].removeprefix("Bearer ")
    with client.websocket_connect(f"/ws/{code}?token={token}") as ws:
        ws.send_text(
            json.dumps(
                {"t": "join", "name": "Luke", "ftp": 250, "tier": "hard", "look": {"body": GOOD, "hat": "x"}}
            )
        )
        lobby = ws.receive_json()
        while lobby.get("t") != "lobby":
            lobby = ws.receive_json()
        me = next(r for r in lobby["riders"] if r["id"] == "luke")
        assert me["look"] == {"body": GOOD, "hat": "x"}

import asyncio

from test_bots import lobby_with
from test_zombie_bus import STEADY, FakeRoom, run

from zombie_bus_server.modes.watch import Watch

VID, VID2 = "aqz-KE-bpKQ", "dQw4w9WgXcQ"


def party():
    room, w = FakeRoom(STEADY), Watch()
    room.host = "r0"
    return room, w, room.riders["r0"], room.riders["r1"]


def test_the_first_video_starts_and_the_rest_queue():
    room, w, host, guest = party()
    w.on_act(room, guest, "add", VID)
    g = w.game(room, 1, 0)
    assert g["vid"] == VID and g["playing"] and g["pos"] == 0
    w.on_act(room, guest, "add", VID2)
    assert [q["vid"] for q in w.game(room, 1, 0)["queue"]] == [VID2] and w.vid == VID
    w.on_act(room, guest, "add", "not a video id")
    w.on_act(room, guest, "add", "https://youtu.be/x")
    assert len(w.queue) == 1


def test_the_position_runs_with_the_ride_clock_and_only_the_driver_holds_the_remote():
    room, w, host, guest = party()
    w.on_act(room, host, "add", VID)
    run(room, w, 30)
    assert w.where(room.el) == 30
    w.on_act(room, guest, "pause", None)
    assert w.playing
    w.on_act(room, host, "pause", None)
    run(room, w, 10)
    assert not w.playing and w.where(room.el) == 30
    w.on_act(room, host, "seek", "-45")
    assert w.where(room.el) == 0
    w.on_act(room, host, "seek", "90")
    w.on_act(room, host, "play", None)
    run(room, w, 5)
    assert w.where(room.el) == 95


def test_next_plays_the_queue_and_then_stops():
    room, w, host, guest = party()
    for v in (VID, VID2):
        w.on_act(room, guest, "add", v)
    run(room, w, 20)
    w.on_act(room, host, "next", None)
    assert w.vid == VID2 and w.where(room.el) == 0 and not w.queue
    w.on_act(room, host, "next", None)
    assert w.vid is None and not w.playing


def test_a_watch_party_room_rides_its_workout_on_erg_and_sends_the_video():
    async def main():
        room, ws = await lobby_with(1, "WTCH")
        await room.handle("h0", ws, {"t": "game", "game": "watch"})
        await room.handle("h0", ws, {"t": "setup", "plan": "bus-lunch-quickie", "minutes": 0})
        lobby = [m for m in ws.sent if m["t"] == "lobby"][-1]
        assert lobby["game"] == "watch" and lobby["trainers"] != "gears"
        assert lobby["plan"]["id"] == "bus-lunch-quickie"
        room.start()
        await room.handle("h0", ws, {"t": "act", "k": "add", "v": VID})
        return room

    room = asyncio.run(main())
    assert room.mode.vid == VID and room.mode.summary(room)["mode"] == "watch"


def test_a_player_names_the_video_for_everyone():
    room, w, host, guest = party()
    for v in (VID, VID2):
        w.on_act(room, guest, "add", v)
    w.on_act(room, guest, "title", f"{VID}Big Buck Bunny")
    w.on_act(room, guest, "title", f"{VID2}Never Gonna Give You Up")
    assert w.game(room, 1, 0)["title"] == "Big Buck Bunny"
    w.on_act(room, host, "next", None)
    assert w.game(room, 1, 0)["title"] == "Never Gonna Give You Up"

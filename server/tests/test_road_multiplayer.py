"""Headless road ride: four simulated riders up Willunga Hill against a real server.

Three start together; the fourth joins late; one drops and rejoins. Drafting and keep-together are measured on
the same four riders in test_road.py, where the sim can be run twice without a socket.
"""

import asyncio
import json

from fastapi.testclient import TestClient
from test_multiplayer import server  # noqa: F401 - the uvicorn fixture

from zombie_bus_server import app as app_mod
from zombie_bus_server import config as C

RIDERS = [(400, 80), (380, 60), (330, 75), (300, 70)]  # watts, kg: rider 1 has the most W/kg
LATE, DROP = 3, 2
TOKENS: dict[int, str] = {}


async def rider(port: int, code: str, n: int, out: dict) -> None:
    url = f"ws://127.0.0.1:{port}/ws/{code}?token={TOKENS[n]}"
    watts = RIDERS[n][0]
    join = json.dumps({"t": "join", "name": f"Road{n}", "ftp": 250, "tier": "hard"})
    seen = out[n] = {"msgs": [], "first_d": None, "gap": None, "summary": None, "lobbies": []}
    await asyncio.sleep(0.2 * (n > 0) + 1.0 * (n == LATE))
    import websockets

    dropped_at = None
    for attempt in range(2):
        async with websockets.connect(url) as ws:
            await ws.send(join)
            if n == 0:
                await ws.send(json.dumps({"t": "road", "route": "willunga-hill", "laps": 4, "style": "race"}))
                await asyncio.sleep(0.5)
                await ws.send(json.dumps({"t": "start"}))
            while seen["summary"] is None:
                msg = json.loads(await asyncio.wait_for(ws.recv(), 10))
                seen["msgs"].append(msg if msg["t"] != "tick" else {"t": "tick", "keys": sorted(msg)})
                if msg["t"] == "lobby":
                    seen["lobbies"].append(msg)
                elif msg["t"] == "end":
                    seen["summary"] = msg["summary"]
                elif msg["t"] == "tick":
                    assert "tgt" not in json.dumps(msg)  # never an ERG power target on the road
                    me = msg["riders"].get(f"road{n}")
                    if not me:
                        continue
                    if seen["first_d"] is None:
                        seen["first_d"] = (me["d"], msg["el"])
                    if dropped_at is not None and seen["gap"] is None:
                        seen["gap"] = (dropped_at, me["d"])
                    if n == DROP and attempt == 0 and msg["el"] > 120:
                        dropped_at = me["d"]
                        break
                    await ws.send(json.dumps({"t": "data", "p": watts, "w": watts, "cad": 85, "hr": 150}))
        if seen["summary"] is not None:
            break
        await asyncio.sleep(0.1)


def test_four_riders_up_willunga(server, monkeypatch):  # noqa: F811
    monkeypatch.setattr(C, "TIME_SCALE", 120.0)
    client = TestClient(app_mod.app)
    for n, (_, kg) in enumerate(RIDERS):
        app_mod.store.add_user(f"Road{n}", "pw")
        TOKENS[n] = client.post("/api/login", json={"name": f"road{n}", "password": "pw"}).json()["token"]
        auth = {"Authorization": f"Bearer {TOKENS[n]}"}
        assert client.put(
            f"/api/profile/road{n}", json={"weightKg": kg, "updated": 1}, headers=auth
        ).is_success
    auth = {"Authorization": f"Bearer {TOKENS[0]}"}
    code = client.post("/api/rooms", json={"kind": "road"}, headers=auth).json()["code"]
    assert app_mod.rooms[code].kind == "road"
    assert any(r["code"] == code for r in client.get("/api/rooms", headers=auth).json()) is False
    out: dict = {}

    async def main() -> None:
        await asyncio.gather(*(rider(server, code, n, out) for n in range(4)))

    asyncio.run(main())
    s = out[0]["summary"]
    assert all(o["summary"] == s for o in out.values())
    lobby = next(m for m in out[0]["lobbies"] if m["state"] == "running")
    assert lobby["route"] == "willunga-hill" and lobby["laps"] == 1  # not a circuit: laps are clamped
    assert lobby["style"] == "race" and lobby["together"] is False
    assert {r["id"]: r["kg"] for r in lobby["riders"]} == {
        f"road{n}": kg for n, (_, kg) in enumerate(RIDERS[:3])
    }
    rows = {r["id"]: r for r in s["riders"]}
    assert s["kind"] == "road" and s["distance"] == 2860 and len(rows) == 4
    # More W/kg wins uphill; the rider who dropped out for a while still finishes, last of the starters.
    assert [r["id"] for r in s["riders"][:3]] == ["road1", "road0", "road2"]
    assert rows["road1"]["time"] < rows["road0"]["time"] < rows["road2"]["time"]
    assert rows["road1"]["avgPower"] > 350 and rows["road1"]["wkg"] > rows["road0"]["wkg"]
    # Late join: on the road behind the group, not back at the start, and marked late.
    first_d, first_el = out[LATE]["first_d"]
    assert first_el > 20 and first_d > 50 and rows[f"road{LATE}"]["late"]
    assert rows[f"road{LATE}"]["dist"] < s["distance"]
    # Rejoin: the slot and its distance survive the dropped socket.
    before, after = out[DROP]["gap"]
    assert after >= before > 300
    for o in out.values():
        assert {m["t"] for m in o["msgs"]} <= {"lobby", "tick", "end"}
        assert all(
            m["keys"] == ["el", "fx", "game", "kind", "riders", "t"] for m in o["msgs"] if m["t"] == "tick"
        )

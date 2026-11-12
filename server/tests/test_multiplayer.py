"""Headless multiplayer: four simulated riders through a 5 min plan against a real server."""

import asyncio
import json
import random
import socket
import threading
import time

import pytest
import uvicorn
import websockets

from zombie_bus_server import app as app_mod
from zombie_bus_server.plan import generate

PLAN = {
    "id": "test-5",
    "name": "Test 5",
    "blocks": [
        {"type": "ramp", "dur": 60, "pct": [50, 70]},
        {"type": "steady", "dur": 60, "pct": 90},
        {"type": "over-under", "dur": 60, "pct": [105, 90], "step": 15},
        {"type": "sprint", "dur": 10},
        {"type": "steady", "dur": 50, "pct": 50},
        {"type": "ramp", "dur": 60, "pct": [60, 45]},
    ],
}


@pytest.fixture(scope="module")
def server():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    srv = uvicorn.Server(uvicorn.Config(app_mod.app, port=port, log_level="warning"))
    threading.Thread(target=srv.run, daemon=True).start()
    while not srv.started:
        time.sleep(0.05)
    yield port
    srv.should_exit = True


async def rider(port, code, n, results, drop=False):
    url = f"ws://127.0.0.1:{port}/ws/{code}?id=bot{n}"
    ticks, targets, ended = 0, set(), None
    async with websockets.connect(url) as ws:
        await ws.send(json.dumps({"t": "join", "name": f"Bot{n}", "ftp": 200 + n * 20, "tier": "hard"}))
        if n == 0:
            await asyncio.sleep(0.3)
            await ws.send(json.dumps({"t": "start"}))
        sprinted = False
        while ended is None:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 10))
            if msg["t"] == "end":
                ended = msg["summary"]
            if msg["t"] != "tick":
                continue
            ticks += 1
            me = msg["riders"][f"bot{n}"]
            tgt = me["tgt"]
            targets.add(tgt)
            w = (tgt or 600) * random.uniform(0.97, 1.03)
            await ws.send(json.dumps({"t": "data", "p": w, "w": w, "cad": 90 + n, "s": 1.0 if tgt else None}))
            if msg["i"] == 4 and not sprinted:
                sprinted = True
                await ws.send(
                    json.dumps(
                        {
                            "t": "sprint",
                            "blk": 3,
                            "dur": 10,
                            "avg": 700,
                            "pct": 0.97,
                            "grade": "GREAT",
                            "combo": 1,
                        }
                    )
                )
            if drop and msg["el"] > 100:
                break
    if drop:
        async with websockets.connect(url) as ws:
            await ws.send(json.dumps({"t": "join", "name": f"Bot{n}", "ftp": 200 + n * 20, "tier": "hard"}))
            while ended is None:
                msg = json.loads(await asyncio.wait_for(ws.recv(), 10))
                if msg["t"] == "end":
                    ended = msg["summary"]
                elif msg["t"] == "tick":
                    ticks += 1
                    w = msg["riders"][f"bot{n}"]["tgt"] or 500
                    await ws.send(json.dumps({"t": "data", "p": w, "w": w, "cad": 90 + n, "s": 1.0}))
    results[n] = {"ticks": ticks, "targets": targets, "summary": ended}


def test_four_riders_five_minutes(server):
    from fastapi.testclient import TestClient

    code = TestClient(app_mod.app).post("/api/rooms").json()["code"]
    app_mod.rooms[code].plan = generate(PLAN, 0)
    results: dict = {}

    async def main():
        await asyncio.gather(*(rider(server, code, n, results, drop=n == 3) for n in range(4)))

    asyncio.run(main())
    assert len(results) == 4
    for n, r in results.items():
        assert r["ticks"] > 400, f"bot{n} saw {r['ticks']} ticks"
        assert None in r["targets"] and max(t for t in r["targets"] if t) <= (200 + n * 20) * 1.5
    s = results[0]["summary"]
    assert s == results[3]["summary"]
    assert s["distance"] > 0 and s["armour"] == 100
    assert {x["name"] for x in s["riders"]} == {"Bot0", "Bot1", "Bot2", "Bot3"}
    assert all(x["sprints"] == ["GREAT"] for x in s["riders"] if x["name"] != "Bot3")
    assert s["syncPct"] > 0

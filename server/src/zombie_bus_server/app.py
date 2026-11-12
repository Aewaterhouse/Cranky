"""FastAPI app: REST for profiles/rides/rooms, WebSocket sessions, and the static client build."""

import random
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from . import config
from .plan import load_plans, total
from .session import Room
from .store import Store

app = FastAPI(title="Zombie Bus")
store = Store()
rooms: dict[str, Room] = {}
LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/profile/{rid}")
def get_profile(rid: str) -> dict:
    p = store.get_profile(rid)
    if not p:
        raise HTTPException(404)
    return p


@app.put("/api/profile/{rid}")
def put_profile(rid: str, profile: dict) -> dict:
    return {"saved": store.put_profile(rid, profile)}


@app.post("/api/rides")
def post_ride(body: dict) -> dict:
    store.add_ride(str(body.get("id")), body.get("summary") or {})
    return {"ok": True}


@app.get("/api/plans")
def plans() -> list[dict]:
    from .plan import flatten

    return [
        {"id": p["id"], "name": p["name"], "desc": p.get("desc", ""), "secs": total(flatten(p["blocks"]))}
        for p in load_plans().values()
    ]


@app.post("/api/rooms")
def create_room() -> dict:
    now = time.monotonic()
    for code, r in list(rooms.items()):
        if (
            r.state != "running"
            and not any(x.connected for x in r.riders.values())
            and now - r.idle_since > config.ROOM_IDLE_S
        ):
            del rooms[code]
    code = "".join(random.choices(LETTERS, k=4))
    while code in rooms:
        code = "".join(random.choices(LETTERS, k=4))
    rooms[code] = Room(code)
    return {"code": code}


@app.websocket("/ws/{code}")
async def ws_endpoint(ws: WebSocket, code: str, id: str) -> None:
    await ws.accept()
    room = rooms.get(code.upper())
    if not room:
        await ws.send_json({"t": "error", "msg": f"No bus with code {code}"})
        await ws.close()
        return
    await room.connect(id, ws)
    try:
        while True:
            raw = await ws.receive_json()
            try:
                await room.handle(id, ws, raw)
            except ValidationError as e:
                await ws.send_json({"t": "error", "msg": f"Bad message: {e.errors()[0]['msg']}"})
    except WebSocketDisconnect:
        pass
    finally:
        await room.disconnect(id, ws)


if config.CLIENT_DIST.exists():
    app.mount("/", StaticFiles(directory=config.CLIENT_DIST, html=True), name="client")

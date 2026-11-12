"""FastAPI app: accounts, profiles, rides, rooms, WebSocket sessions, and the static client build."""

import random
import time
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from . import config
from .plan import flatten, load_plans, total
from .session import Room
from .store import Store

app = FastAPI(title="Zombie Bus")
store = Store()
for _name in config.SEED_USERS:
    store.add_user(_name, _name)
rooms: dict[str, Room] = {}
LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"


def user(authorization: str = Header(default="")) -> dict:
    """The logged-in rider from `Authorization: Bearer <token>`."""
    me = store.whoami(authorization.removeprefix("Bearer ").strip())
    if not me:
        raise HTTPException(401, "Log in first")
    return me


User = Annotated[dict, Depends(user)]


class Login(BaseModel):
    name: str
    password: str


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/riders")
def riders() -> list[dict]:
    return store.users()


@app.post("/api/login")
def login(body: Login) -> dict:
    res = store.login(body.name, body.password)
    if not res:
        raise HTTPException(401, "Wrong name or password")
    return res


@app.get("/api/me")
def me(u: User) -> dict:
    return u


@app.get("/api/profile/{rid}")
def get_profile(rid: str, u: User) -> dict:
    p = store.get_profile(rid)
    if not p:
        raise HTTPException(404)
    return p


@app.put("/api/profile/{rid}")
def put_profile(rid: str, profile: dict, u: User) -> dict:
    if rid != u["id"]:
        raise HTTPException(403)
    return {"saved": store.put_profile(rid, profile)}


@app.post("/api/rides")
def post_ride(body: dict, u: User) -> dict:
    store.add_ride(u["id"], body.get("summary") or {})
    return {"ok": True}


@app.get("/api/plans")
def plans() -> list[dict]:
    return [
        {"id": p["id"], "name": p["name"], "desc": p.get("desc", ""), "secs": total(flatten(p["blocks"]))}
        for p in load_plans().values()
    ]


@app.post("/api/rooms")
def create_room(u: User) -> dict:
    now = time.monotonic()
    for code, r in list(rooms.items()):
        idle = not any(x.connected for x in r.riders.values()) and now - r.idle_since > config.ROOM_IDLE_S
        if r.state != "running" and idle:
            del rooms[code]
    code = "".join(random.choices(LETTERS, k=4))
    while code in rooms:
        code = "".join(random.choices(LETTERS, k=4))
    rooms[code] = Room(code)
    return {"code": code}


@app.get("/api/rooms")
def list_rooms(u: User) -> list[dict]:
    """Open buses, so friends can join without typing a code."""
    return [
        {
            "code": r.code,
            "state": r.state,
            "plan": r.plan["name"],
            "host": r.riders[r.host].name if r.host else None,
            "riders": [x.name for x in r.riders.values() if x.connected],
        }
        for r in rooms.values()
        if any(x.connected for x in r.riders.values())
    ]


@app.websocket("/ws/{code}")
async def ws_endpoint(ws: WebSocket, code: str, token: str = "") -> None:
    await ws.accept()
    me = store.whoami(token)
    room = rooms.get(code.upper())
    if not me or not room:
        await ws.send_json({"t": "error", "msg": "Log in first" if not me else f"No bus with code {code}"})
        await ws.close()
        return
    rid = me["id"]
    await room.connect(rid, ws)
    try:
        while True:
            raw = await ws.receive_json()
            try:
                await room.handle(rid, ws, raw)
            except ValidationError as e:
                await ws.send_json({"t": "error", "msg": f"Bad message: {e.errors()[0]['msg']}"})
    except WebSocketDisconnect:
        pass
    finally:
        await room.disconnect(rid, ws)


if config.CLIENT_DIST.exists():
    app.mount("/", StaticFiles(directory=config.CLIENT_DIST, html=True), name="client")

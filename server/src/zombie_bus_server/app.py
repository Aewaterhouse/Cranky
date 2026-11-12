"""FastAPI app: accounts, profiles, rides, rooms, WebSocket sessions, and the static client build."""

import asyncio
import random
import re
import time
from contextlib import asynccontextmanager
from datetime import date
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from . import config, ladder
from .plan import flatten, load_plans, total
from .session import Room
from .store import Store

store = Store()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Backs the database up at startup and then daily."""

    async def loop() -> None:
        while True:
            await asyncio.to_thread(store.backup, config.BACKUP_DIR, config.BACKUP_KEEP)
            await asyncio.sleep(config.BACKUP_EVERY_S)

    task = asyncio.create_task(loop())
    yield
    task.cancel()


app = FastAPI(title="Cranky", lifespan=lifespan)
for _name in config.SEED_USERS:
    store.add_user(_name, _name)
rooms: dict[str, Room] = {
    d["code"]: Room.from_dict(d, store) for d in store.load_rooms(config.ROOM_RESUME_MAX_AGE_S)
}
LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"


def user(authorization: str = Header(default="")) -> dict:
    """The logged-in rider from `Authorization: Bearer <token>`."""
    me = store.whoami(authorization.removeprefix("Bearer ").strip())
    if not me:
        raise HTTPException(401, "Log in first")
    return {**me, "admin": me["id"] in config.ADMINS}


User = Annotated[dict, Depends(user)]


class Login(BaseModel):
    name: str
    password: str


class NewRider(BaseModel):
    name: str
    password: str | None = None


class Password(BaseModel):
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


@app.post("/api/riders")
def add_rider(body: NewRider, u: User) -> dict:
    if not u["admin"]:
        raise HTTPException(403, "Admins only")
    name = body.name.strip()
    if not name or len(name) > config.NAME_MAX or not name.isprintable():
        raise HTTPException(400, f"Name must be 1 to {config.NAME_MAX} characters")
    if not store.add_user(name, body.password or name):
        raise HTTPException(409, f"{name} already exists")
    return {"id": name.lower(), "name": name}


@app.post("/api/riders/{rid}/password")
def set_password(rid: str, body: Password, u: User) -> dict:
    if rid != u["id"] and not u["admin"]:
        raise HTTPException(403, "Admins only")
    if not body.password.strip():
        raise HTTPException(400, "Password can't be empty")
    if not store.set_password(rid, body.password):
        raise HTTPException(404)
    return {"ok": True}


@app.delete("/api/riders/{rid}")
def delete_rider(rid: str, u: User) -> dict:
    if not u["admin"]:
        raise HTTPException(403, "Admins only")
    if rid == u["id"]:
        raise HTTPException(400, "You can't remove yourself")
    if not store.delete_user(rid):
        raise HTTPException(404)
    return {"ok": True}


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


@app.get("/api/ladder")
def get_ladder(u: User, season: str | None = None) -> dict:
    """The season ladder for a season id like 2026-Q4 (default: the current one)."""
    season = season or ladder.season_of(date.today())
    if not re.fullmatch(r"\d{4}-Q[1-4]", season):
        raise HTTPException(400, "Season looks like 2026-Q4")
    return ladder.build(season, store.results(*ladder.bounds(season)))


@app.get("/api/rides")
def list_rides(u: User) -> list[dict]:
    """The caller's rides as list rows, newest first."""
    return store.ride_rows(u["id"])


@app.get("/api/rides/{n}")
def get_ride(n: int, u: User) -> dict:
    ride = store.ride(u["id"], n)
    if not ride:
        raise HTTPException(404)
    return ride


@app.delete("/api/rides/{n}")
def delete_ride(n: int, u: User) -> dict:
    if not store.delete_ride(u["id"], n):
        raise HTTPException(404)
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
        idle = not any(x.connected for x in r.humans()) and now - r.idle_since > config.ROOM_IDLE_S
        if (r.state != "running" or r.paused) and idle:
            del rooms[code]
            store.delete_room(code)
    code = "".join(random.choices(LETTERS, k=4))
    while code in rooms:
        code = "".join(random.choices(LETTERS, k=4))
    rooms[code] = Room(code, store)
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
            "riders": [x.name for x in r.humans() if x.connected],
        }
        for r in rooms.values()
        if any(x.connected for x in r.humans())
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

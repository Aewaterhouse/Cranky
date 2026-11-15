"""FastAPI app: accounts, profiles, rides, rooms, WebSocket sessions, and the static client build."""

import asyncio
import random
import re
import time
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from . import config, discord, efforts, files, ladder, strava_api
from .accounts import accounts
from .avatars import clean_look
from .plan import flatten, load_plans, total
from .road_room import RoadRoom
from .session import Room
from .store import Store, restore_pending
from .strava import Strava
from .strava_uploads import Uploads

restore_pending()
store = Store()
strava = Strava(store)
uploads = Uploads(strava)


def backup_wait(now: float, newest: float | None) -> float:
    """Seconds to the next backup: 0 if the newest is over a day old or missing, else to the nightly hour."""
    if newest is None or now - newest >= config.BACKUP_EVERY_S:
        return 0.0
    t = time.localtime(now)
    gone = t.tm_hour * 3600 + t.tm_min * 60 + t.tm_sec
    return (config.BACKUP_HOUR * 3600 - gone) % 86400 or 86400.0


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Backs the database up every night (and at startup if over a day old) and runs the Strava uploads."""

    async def loop() -> None:
        while True:
            copies = sorted(config.BACKUP_DIR.glob("cranky-*.db"))
            newest = copies[-1].stat().st_mtime if copies else None
            await asyncio.sleep(backup_wait(time.time(), newest))
            await asyncio.to_thread(store.backup, config.BACKUP_DIR, config.BACKUP_KEEP)

    async def strava_loop() -> None:
        while True:
            await asyncio.sleep(config.STRAVA_STEP_S)
            try:
                await asyncio.to_thread(uploads.step)
            except Exception as e:  # one bad job must not stop the worker
                print(f"[strava] worker error: {type(e).__name__}: {e}", flush=True)

    tasks = [asyncio.create_task(loop()), asyncio.create_task(strava_loop())]
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(title="Cranky", lifespan=lifespan)
store.backfill_bus_results()
for _name in config.SEED_USERS:
    store.add_user(_name, _name)
KINDS: dict[str, type[Room]] = {"bus": Room, "road": RoadRoom}
rooms: dict[str, Room] = {
    d["code"]: KINDS[d.get("kind", "bus")].from_dict(d, store)
    for d in store.load_rooms(config.ROOM_RESUME_MAX_AGE_S)
}
LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"


accounts_api, User, SignedIn = accounts(store)
app.include_router(accounts_api)
app.include_router(efforts.router(store, User))
app.include_router(files.router(User))
app.include_router(strava_api.router(strava, uploads, User))


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


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
    if isinstance(profile.get("look"), dict):
        profile["look"] = clean_look(profile["look"])
    return {"saved": store.put_profile(rid, profile)}


@app.get("/api/crew/curves")
def crew_curves(u: User) -> list[dict]:
    """All riders' all-time power curves and weights (any logged-in rider may see them)."""
    return store.crew_curves()


@app.post("/api/rides")
def post_ride(body: dict, u: User) -> dict:
    summary = body.get("summary") or {}
    if not isinstance(summary, dict) or not isinstance(summary.get("test", False), bool):
        raise HTTPException(422, "A ride's test flag is true or false")
    group = summary.get("group") if isinstance(summary.get("group"), dict) else {}
    mine = [r for r in group.get("riders") or [] if isinstance(r, dict) and r.get("id") == u["id"]]
    # A ride on the simulated trainer is a test ride; the room's own result says so too.
    if summary.pop("test", False) or any(r.get("test") for r in mine):
        summary["test"] = True
    saved = store.add_ride(u["id"], summary)
    return {
        "ok": True,
        "saved": saved,
        "id": store.ride_id(u["id"], summary.get("record", {}).get("date", "")),
    }


@app.get("/api/ladder")
def get_ladder(u: User, season: str | None = None) -> dict:
    """The season ladder for a season id like 2026-Q4 (default: the current one)."""
    season = season or ladder.season_of(date.today())
    if not re.fullmatch(r"\d{4}-Q[1-4]", season):
        raise HTTPException(400, "Season looks like 2026-Q4")
    return ladder.build(season, store.results(*ladder.bounds(season)))


class PlanRide(BaseModel):
    at: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")  # ISO time, UTC
    game: str = Field(max_length=20)
    note: str = Field(default="", max_length=120)


@app.get("/api/schedule")
def get_schedule(u: User) -> list[dict]:
    """Crew rides on the calendar, soonest first (ones that started under an hour ago stay)."""
    since = time.strftime("%Y-%m-%dT%H:%M", time.gmtime(time.time() - 3600))
    names = {x["id"]: x["name"] for x in store.users()}
    return [
        {**p, "hostName": names.get(p["host"], p["host"]), "names": [names.get(i, i) for i in p["in"]]}
        for p in store.schedule(since)
    ]


@app.post("/api/schedule")
def plan_ride(body: PlanRide, u: User) -> dict:
    """Puts a crew ride on the calendar and tells the Discord channel."""
    n = store.plan_ride(u["id"], body.at, body.game, body.note)
    text = f"🗓️ {u['name']} has planned a ride: {body.game} at {body.at} UTC. {body.note}".strip()
    discord.post(text)  # a no-op without a webhook
    return {"n": n}


@app.post("/api/schedule/{n}/rsvp")
def rsvp(n: int, on: bool, u: User) -> dict:
    if not store.rsvp(n, u["id"], on):
        raise HTTPException(404)
    return {"ok": True}


@app.delete("/api/schedule/{n}")
def unplan(n: int, u: User) -> dict:
    return {"ok": store.unplan(n, u["id"])}


@app.get("/api/feed")
def crew_feed(u: User) -> list[dict]:
    """The crew's latest rides with their kudos."""
    return store.feed(u["id"])


@app.post("/api/kudos/{n}")
def kudos(n: int, u: User) -> dict:
    """Gives a kudos on a mate's ride (once each, never your own)."""
    return {"given": store.give_kudos(u["id"], n)}


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


class NewRoom(BaseModel):
    kind: Literal["bus", "road"] = "bus"


@app.post("/api/rooms")
def create_room(u: User, body: NewRoom | None = None) -> dict:
    now = time.monotonic()
    for code, r in list(rooms.items()):
        idle = not any(x.connected for x in r.humans()) and now - r.idle_since > config.ROOM_IDLE_S
        if (r.state != "running" or r.paused) and idle:
            del rooms[code]
            store.delete_room(code)
    code = "".join(random.choices(LETTERS, k=4))
    while code in rooms:
        code = "".join(random.choices(LETTERS, k=4))
    rooms[code] = KINDS[body.kind if body else "bus"](code, store)
    return {"code": code}


@app.get("/api/rooms/{code}")
def room_exists(code: str, u: User) -> dict:
    """Whether a code is a ride you can join, checked before a rider pairs their trainer."""
    r = rooms.get(code.upper())
    if not r:
        raise HTTPException(404, "No ride with that code")
    return {"code": r.code, "kind": r.kind, "state": r.state}


@app.get("/api/rooms")
def list_rooms(u: User) -> list[dict]:
    """Open buses, so friends can join without typing a code."""
    return [
        {
            "code": r.code,
            "kind": r.kind,
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
            # A rider still on the default password can watch (the TV view) but not ride until they set one.
            if me["mustChange"] and not (isinstance(raw, dict) and raw.get("t") == "watch"):
                await ws.send_json({"t": "error", "msg": "Set your password first"})
                continue
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

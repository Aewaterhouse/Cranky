"""Segment efforts: storage, a rider's bests, crew leaderboards and ghost traces, with their endpoints."""

import json
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import config
from .store import Store

# The ride an effort came from, found by the ride's start time so efforts can arrive before the ride does.
RIDE = "(SELECT n FROM rides r WHERE r.rider = e.rider AND r.date = e.ride_date)"
COLS = f"e.rider, COALESCE(u.name, e.rider), e.secs, e.watts, e.wkg, e.date, {RIDE}"
KEYS = ("id", "name", "secs", "watts", "wkg", "date", "ride")


class Effort(BaseModel):
    """One timed go at a segment, as the client sends it."""

    route: str = Field(min_length=1, max_length=80)
    segment: str = Field(min_length=1, max_length=120)
    secs: float = Field(gt=0, lt=config.EFFORT_MAX_S)
    watts: float = Field(ge=0, lt=3000)
    wkg: float = Field(ge=0, lt=40)
    date: str = Field(min_length=10, max_length=40)
    rideDate: str | None = Field(default=None, max_length=40)
    trace: list[int] | None = Field(default=None, max_length=config.EFFORT_TRACE_MAX)


class Efforts:
    """Efforts table in the shared store. Additive: created if missing, never altered."""

    def __init__(self, store: Store):
        self.store = store
        with store.lock, store.db:
            store.db.executescript("""
                CREATE TABLE IF NOT EXISTS efforts (
                    n INTEGER PRIMARY KEY, rider TEXT, route TEXT, segment TEXT, secs REAL, watts REAL,
                    wkg REAL, date TEXT, ride_date TEXT, trace TEXT, UNIQUE (rider, segment, date));
                CREATE INDEX IF NOT EXISTS efforts_segment ON efforts (segment, secs);
                CREATE INDEX IF NOT EXISTS efforts_route ON efforts (route, rider);
                """)

    def _rows(self, sql: str, args: tuple) -> list[tuple]:
        with self.store.lock:
            return self.store.db.execute(sql, args).fetchall()

    def add(self, rider: str, efforts: list[Effort]) -> int:
        """Stores the efforts, skipping any already held (same rider, segment and finish time)."""
        saved = 0
        with self.store.lock, self.store.db:
            for e in efforts:
                cur = self.store.db.execute(
                    "INSERT OR IGNORE INTO efforts (rider, route, segment, secs, watts, wkg, date, ride_date,"
                    " trace) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (rider, e.route, e.segment, e.secs, e.watts, e.wkg, e.date, e.rideDate, None),
                )
                saved += cur.rowcount
                if not e.trace:
                    continue
                # Only a rider's best go at a segment keeps its trace: that is the only one a ghost rides.
                best = self.store.db.execute(
                    "SELECT MIN(secs) FROM efforts WHERE rider = ? AND segment = ?", (rider, e.segment)
                ).fetchone()[0]
                if e.secs <= best:
                    self.store.db.execute(
                        "UPDATE efforts SET trace = NULL WHERE rider = ? AND segment = ?", (rider, e.segment)
                    )
                    self.store.db.execute(
                        "UPDATE efforts SET trace = ? WHERE rider = ? AND segment = ? AND date = ?",
                        (json.dumps(e.trace), rider, e.segment, e.date),
                    )
        return saved

    def bests(self, rider: str, route: str | None = None) -> list[dict]:
        """The rider's best time on each segment (of one route, or all), with how many goes they have had."""
        rows = self._rows(
            "SELECT segment, route, MIN(secs), watts, wkg, date, trace, COUNT(*),"
            " (SELECT n FROM rides r WHERE r.rider = e.rider AND r.date = e.ride_date)"
            " FROM efforts e WHERE rider = ? AND (? IS NULL OR route = ?) GROUP BY segment ORDER BY segment",
            (rider, route, route),
        )
        keys = ("segment", "route", "secs", "watts", "wkg", "date", "trace", "count", "ride")
        return [{**dict(zip(keys, r, strict=True)), "trace": r[6] and json.loads(r[6])} for r in rows]

    def leaderboard(self, segment: str, by: str = "time", limit: int = config.LEADERBOARD_ROWS) -> list[dict]:
        """Each rider's best effort on a segment: fastest first, or by W/kg (highest first)."""
        pick, order = ("MAX(e.wkg)", "e.wkg DESC") if by == "wkg" else ("MIN(e.secs)", "e.secs")
        rows = self._rows(
            f"SELECT {COLS}, {pick} FROM efforts e LEFT JOIN users u ON u.id = e.rider"
            f" WHERE e.segment = ? GROUP BY e.rider ORDER BY {order}, e.date LIMIT ?",
            (segment, limit),
        )
        return [dict(zip(KEYS, r, strict=False)) for r in rows]

    def route(self, rider: str, route: str) -> dict[str, Any]:
        """What a ride needs before it starts: the rider's bests and the crew's top times on every segment."""
        segments = [
            r[0] for r in self._rows("SELECT DISTINCT segment FROM efforts WHERE route = ?", (route,))
        ]
        return {
            "mine": {b["segment"]: b for b in self.bests(rider, route)},
            "crew": {s: self.leaderboard(s) for s in segments},
        }

    def ghost(self, segment: str, rider: str) -> dict | None:
        """A rider's best effort on a segment with its trace, or None if they have no traced effort."""
        rows = self._rows(
            f"SELECT {COLS}, e.trace FROM efforts e LEFT JOIN users u ON u.id = e.rider"
            " WHERE e.segment = ? AND e.rider = ? AND e.trace IS NOT NULL ORDER BY e.secs LIMIT 1",
            (segment, rider),
        )
        return {**dict(zip(KEYS, rows[0], strict=False)), "trace": json.loads(rows[0][7])} if rows else None


class Batch(BaseModel):
    """Efforts posted together, in the order they were ridden."""

    efforts: list[Effort] = Field(max_length=config.EFFORT_BATCH_MAX)


def router(store: Store, user: Any) -> APIRouter:
    """The effort endpoints; `user` is the app's logged-in-rider dependency."""
    api = APIRouter()
    efforts = Efforts(store)

    @api.post("/api/efforts")
    def post_efforts(body: Batch, u: user) -> dict:
        if any(not e.segment.startswith(f"{e.route}:") for e in body.efforts):
            raise HTTPException(422, "A segment id starts with its route id")
        return {"saved": efforts.add(u["id"], body.efforts)}

    @api.get("/api/efforts")
    def route_efforts(u: user, route: str) -> dict:
        return efforts.route(u["id"], route)

    @api.get("/api/efforts/mine")
    def my_bests(u: user) -> list[dict]:
        return [{k: v for k, v in b.items() if k != "trace"} for b in efforts.bests(u["id"])]

    @api.get("/api/segments/{segment}/leaderboard")
    def leaderboard(segment: str, u: user, by: Literal["time", "wkg"] = "time") -> list[dict]:
        return efforts.leaderboard(segment, by)

    @api.get("/api/segments/{segment}/ghost/{rider}")
    def ghost(segment: str, rider: str, u: user) -> dict:
        found = efforts.ghost(segment, rider)
        if not found:
            raise HTTPException(404, "No effort to ride against")
        return found

    return api

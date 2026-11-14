"""SQLite storage for profiles and ride history."""

import hashlib
import json
import secrets
import sqlite3
import threading
import time
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

from . import config

AU_EAST = (timezone(timedelta(hours=10)), timezone(timedelta(hours=11)))


def restore_pending(path: Path = config.DB_PATH) -> bool:
    """At startup, swaps in `restore.db` from beside the database; the old file becomes `*.before-restore`."""
    pending = path.parent / "restore.db"
    if not pending.exists():
        return False
    if path.exists():
        path.replace(path.with_name(path.name + ".before-restore"))
    pending.replace(path)
    return True


class Store:
    """Tiny JSON-in-SQLite store. One connection shared across threads behind a lock."""

    def __init__(self, path: Path = config.DB_PATH):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.RLock()
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, updated INTEGER, json TEXT);
            CREATE TABLE IF NOT EXISTS rides (n INTEGER PRIMARY KEY, rider TEXT, date TEXT, json TEXT);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, salt TEXT, hash TEXT);
            CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, id TEXT);
            CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, json TEXT, saved_at REAL);
            CREATE TABLE IF NOT EXISTS results (n INTEGER PRIMARY KEY, date TEXT, plan TEXT, json TEXT);
            CREATE TABLE IF NOT EXISTS sashes (id TEXT PRIMARY KEY, until REAL);
            CREATE TABLE IF NOT EXISTS bests (game TEXT PRIMARY KEY, score REAL, date TEXT);
            CREATE TABLE IF NOT EXISTS titles (title TEXT PRIMARY KEY, holder TEXT, name TEXT);
            """)

    def sash_until(self, rid: str) -> float | None:
        """When this rider's Climate Lawsuit GUILTY sash comes off (epoch seconds), or None if they have none.

        Kept apart from the profile, which the rider writes, so nobody can put one on or take one off.
        """
        with self.lock:
            row = self.db.execute("SELECT until FROM sashes WHERE id = ?", (rid,)).fetchone()
        return row[0] if row and row[0] > time.time() else None

    def set_sash(self, rid: str, until: float | None) -> None:
        """Puts the sash on until `until` (epoch seconds), or takes it off with None."""
        with self.lock, self.db:
            if until is None:
                self.db.execute("DELETE FROM sashes WHERE id = ?", (rid,))
            else:
                self.db.execute("INSERT OR REPLACE INTO sashes VALUES (?, ?)", (rid, until))

    def get_profile(self, rid: str) -> dict | None:
        with self.lock:
            row = self.db.execute("SELECT json FROM profiles WHERE id = ?", (rid,)).fetchone()
        return json.loads(row[0]) if row else None

    def put_profile(self, rid: str, profile: dict) -> bool:
        """Saves the profile if it is newer than the stored one. Returns True if saved."""
        with self.lock:
            cur = self.get_profile(rid)
            if cur and cur.get("updated", 0) > profile.get("updated", 0):
                return False
            with self.db:
                self.db.execute(
                    "INSERT OR REPLACE INTO profiles VALUES (?, ?, ?)",
                    (rid, profile.get("updated", 0), json.dumps(profile)),
                )
        return True

    def crew_curves(self) -> list[dict]:
        """Every rider's name, weight and all-time best power by duration, for crew comparisons."""
        with self.lock:
            rows = self.db.execute(
                "SELECT u.id, u.name, p.json FROM users u JOIN profiles p ON p.id = u.id ORDER BY u.name"
            ).fetchall()
        out = []
        for rid, name, raw in rows:
            p = json.loads(raw)
            kg = p.get("weightKg")
            out.append(
                {
                    "id": rid,
                    "name": name,
                    "weightKg": kg if isinstance(kg, (int, float)) and kg > 0 else None,
                    "best": p.get("allTime") or {},
                }
            )
        return out

    def add_ride(self, rid: str, summary: dict) -> bool:
        """Stores a ride. A ride the rider already has (same start time) is left alone, so a retry is safe.

        Returns:
            True if it was stored, False if it was already there.
        """
        date = summary.get("record", {}).get("date", "")
        with self.lock, self.db:
            have = (
                date
                and self.db.execute(
                    "SELECT 1 FROM rides WHERE rider = ? AND date = ?", (rid, date)
                ).fetchone()
            )
            if have:
                return False
            self.db.execute(
                "INSERT INTO rides (rider, date, json) VALUES (?, ?, ?)", (rid, date, json.dumps(summary))
            )
        return True

    def rides(self, rid: str) -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT json FROM rides WHERE rider = ? ORDER BY n", (rid,)).fetchall()
        return [json.loads(r[0]) for r in rows]

    def ride_rows(self, rid: str) -> list[dict]:
        """Lightweight list rows for a rider's rides, newest first (skips the per-second arrays)."""
        with self.lock:
            rows = self.db.execute(
                """SELECT n, date, json_extract(json, '$.planName'), json_extract(json, '$.record.secs'),
                          json_extract(json, '$.avgPower'), json_extract(json, '$.np'),
                          json_extract(json, '$.tss'),
                          json_extract(json, '$.record.kj'), json_extract(json, '$.compliance'),
                          json_extract(json, '$.crew'), json_extract(json, '$.route.id'),
                          json_extract(json, '$.distance')
                   FROM rides WHERE rider = ? ORDER BY date DESC, n DESC""",
                (rid,),
            ).fetchall()
        keys = ("id", "date", "plan", "secs", "avgPower", "np", "tss", "kj", "compliance")
        return [
            {**dict(zip(keys, r, strict=False)), "crew": bool(r[9]), "route": r[10], "distance": r[11]}
            for r in rows
        ]

    def ride_id(self, rid: str, date: str) -> int | None:
        """The number of the rider's ride that started at `date`, or None."""
        with self.lock:
            row = self.db.execute("SELECT n FROM rides WHERE rider = ? AND date = ?", (rid, date)).fetchone()
        return row[0] if row else None

    def ride(self, rid: str, n: int) -> dict | None:
        """The full summary of one of the rider's rides, or None."""
        with self.lock:
            row = self.db.execute("SELECT json FROM rides WHERE n = ? AND rider = ?", (n, rid)).fetchone()
        return json.loads(row[0]) if row else None

    def delete_ride(self, rid: str, n: int) -> bool:
        """Deletes one of the rider's rides. Returns False if it is not theirs or does not exist."""
        with self.lock, self.db:
            cur = self.db.execute("DELETE FROM rides WHERE n = ? AND rider = ?", (n, rid))
        return cur.rowcount > 0

    @staticmethod
    def _hash(password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac("sha256", password.lower().encode(), salt.encode(), 100_000).hex()

    def add_user(self, name: str, password: str) -> bool:
        """Creates the account if it doesn't exist. Ids are lower-case names. Returns True if created."""
        salt = secrets.token_hex(8)
        with self.lock, self.db:
            cur = self.db.execute(
                "INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?)",
                (name.lower(), name, salt, self._hash(password, salt)),
            )
        return cur.rowcount > 0

    def set_password(self, rid: str, password: str) -> bool:
        """Sets a new password (existing tokens stay valid). Returns False if there is no such rider."""
        salt = secrets.token_hex(8)
        with self.lock, self.db:
            cur = self.db.execute(
                "UPDATE users SET salt = ?, hash = ? WHERE id = ?", (salt, self._hash(password, salt), rid)
            )
        return cur.rowcount > 0

    def delete_user(self, rid: str) -> bool:
        """Removes the account and its tokens; the profile and rides stay. Returns False if unknown."""
        with self.lock, self.db:
            self.db.execute("DELETE FROM tokens WHERE id = ?", (rid,))
            cur = self.db.execute("DELETE FROM users WHERE id = ?", (rid,))
        return cur.rowcount > 0

    def users(self) -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT id, name FROM users ORDER BY name").fetchall()
        return [{"id": i, "name": n} for i, n in rows]

    def login(self, name: str, password: str) -> dict | None:
        """Checks the password and returns {token, id, name}, or None."""
        with self.lock:
            row = self.db.execute(
                "SELECT id, name, salt, hash FROM users WHERE id = ?", (name.strip().lower(),)
            ).fetchone()
        if not row or not secrets.compare_digest(self._hash(password, row[2]), row[3]):
            return None
        token = secrets.token_urlsafe(24)
        with self.lock, self.db:
            self.db.execute("INSERT INTO tokens VALUES (?, ?)", (token, row[0]))
        return {"token": token, "id": row[0], "name": row[1]}

    def whoami(self, token: str | None) -> dict | None:
        if not token:
            return None
        with self.lock:
            row = self.db.execute(
                "SELECT u.id, u.name FROM tokens t JOIN users u ON u.id = t.id WHERE t.token = ?", (token,)
            ).fetchone()
        return {"id": row[0], "name": row[1]} if row else None

    def save_room(self, code: str, snapshot: dict) -> None:
        with self.lock, self.db:
            self.db.execute(
                "INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)", (code, json.dumps(snapshot), time.time())
            )

    def delete_room(self, code: str) -> None:
        with self.lock, self.db:
            self.db.execute("DELETE FROM rooms WHERE code = ?", (code,))

    def load_rooms(self, max_age_s: float) -> list[dict]:
        """Snapshots younger than `max_age_s`; older ones are deleted."""
        with self.lock, self.db:
            self.db.execute("DELETE FROM rooms WHERE saved_at < ?", (time.time() - max_age_s,))
            rows = self.db.execute("SELECT json FROM rooms").fetchall()
        return [json.loads(r[0]) for r in rows]

    def backup(self, folder: Path, keep: int) -> Path:
        """Writes a dated copy of the database into `folder` and prunes all but the newest `keep`."""
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / f"cranky-{time.strftime('%Y%m%d-%H%M%S')}.db"
        with self.lock:
            copy = sqlite3.connect(dest)
            self.db.backup(copy)
            copy.close()
        for old in sorted(folder.glob("cranky-*.db"))[:-keep]:
            old.unlink()
        return dest

    def crew_best(self, game: str, score: float) -> float | None:
        """The crew's best score in this game before this one (None the first time), then keeps the higher."""
        with self.lock, self.db:
            row = self.db.execute("SELECT score FROM bests WHERE game = ?", (game,)).fetchone()
            if not row or score > row[0]:
                self.db.execute(
                    "INSERT OR REPLACE INTO bests (game, score, date) VALUES (?, ?, ?)",
                    (game, score, time.strftime("%Y-%m-%d")),
                )
        return row[0] if row else None

    def take_titles(self, awards: list[dict]) -> list[str]:
        """Hands each held title (`config.TITLES`) to whoever won its award; says who took it from whom."""
        said = []
        with self.lock, self.db:
            for a in awards:
                title = config.TITLES.get(a.get("award", ""))
                if not title or not a.get("id"):
                    continue
                row = self.db.execute("SELECT holder, name FROM titles WHERE title = ?", (title,)).fetchone()
                if row and row[0] == a["id"]:
                    said.append(f"{a['name']} keeps {title}")
                else:
                    said.append(f"{a['name']} takes {title}" + (f" from {row[1]}" if row else ""))
                self.db.execute("INSERT OR REPLACE INTO titles VALUES (?, ?, ?)", (title, a["id"], a["name"]))
        return said

    def titles_of(self, rid: str) -> list[str]:
        """The titles this rider holds right now."""
        with self.lock:
            return [t for (t,) in self.db.execute("SELECT title FROM titles WHERE holder = ?", (rid,))]

    def add_result(self, plan: str, summary: dict) -> None:
        """Records a finished bus ride for the season ladder."""
        with self.lock, self.db:
            self.db.execute(
                "INSERT INTO results (date, plan, json) VALUES (?, ?, ?)",
                (time.strftime("%Y-%m-%d"), plan, json.dumps(summary)),
            )

    def results(self, start: str, end: str) -> list[dict]:
        """Bus rides with start <= date < end (ISO dates), each as its summary plus date and plan."""
        with self.lock:
            rows = self.db.execute(
                "SELECT date, plan, json FROM results WHERE date >= ? AND date < ? ORDER BY n", (start, end)
            ).fetchall()
        return [{**json.loads(j), "date": d, "plan": p} for d, p, j in rows]

    def backfill_bus_results(self) -> int:
        """Gives bus rides saved before rides carried their crew result one from the season ladder's results.

        A results row knows its plan, the day the bus finished (server time) and every rider on it, so a
        crew ride by one of those riders, on that plan, finishing that day, is the same ride. Same-day repeats
        pair up in order. Results from before every game reached the ladder are all bus rides.

        Returns:
            How many rides were given a result.
        """
        with self.lock, self.db:
            rides = self.db.execute(
                "SELECT n, rider, json FROM rides WHERE json_extract(json, '$.crew') AND "
                "json_extract(json, '$.group') IS NULL AND json_extract(json, '$.route') IS NULL ORDER BY n"
            ).fetchall()
            results = self.db.execute("SELECT date, plan, json FROM results ORDER BY n").fetchall()
            pool: dict[tuple[str, str, str], list[dict]] = {}
            for day, plan, j in results:
                summary = json.loads(j)
                for r in summary.get("riders", []):
                    pool.setdefault((r.get("id", ""), plan, day), []).append(summary)
            done = 0
            for n, rider, j in rides:
                ride = json.loads(j)
                rec = ride.get("record", {})
                try:
                    start = datetime.fromisoformat(rec.get("date", "").replace("Z", "+00:00"))
                except ValueError:
                    continue
                end = start + timedelta(seconds=rec.get("secs", 0))
                # the server may have moved (PC, then Railway): its own zone, eastern Australia, UTC
                days = [end.astimezone(z).strftime("%Y-%m-%d") for z in (None, *AU_EAST, UTC)]
                match = next((m for d in days if (m := pool.get((rider, ride.get("planName", ""), d)))), None)
                if match:
                    ride["group"] = match.pop(0)
                    self.db.execute("UPDATE rides SET json = ? WHERE n = ?", (json.dumps(ride), n))
                    done += 1
        return done

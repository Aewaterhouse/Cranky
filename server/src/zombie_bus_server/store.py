"""SQLite storage for profiles and ride history."""

import hashlib
import json
import secrets
import sqlite3
import threading
from pathlib import Path

from . import config


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
            """)

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

    def add_ride(self, rid: str, summary: dict) -> None:
        date = summary.get("record", {}).get("date", "")
        with self.lock, self.db:
            self.db.execute(
                "INSERT INTO rides (rider, date, json) VALUES (?, ?, ?)", (rid, date, json.dumps(summary))
            )

    def rides(self, rid: str) -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT json FROM rides WHERE rider = ? ORDER BY n", (rid,)).fetchall()
        return [json.loads(r[0]) for r in rows]

    @staticmethod
    def _hash(password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac("sha256", password.lower().encode(), salt.encode(), 100_000).hex()

    def add_user(self, name: str, password: str) -> None:
        """Creates the account if it doesn't exist. Ids are lower-case names."""
        salt = secrets.token_hex(8)
        with self.lock, self.db:
            self.db.execute(
                "INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?)",
                (name.lower(), name, salt, self._hash(password, salt)),
            )

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

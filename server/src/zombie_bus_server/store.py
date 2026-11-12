"""SQLite storage for profiles and ride history."""

import json
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

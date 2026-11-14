"""The crew's shared records in the store: Climate's sash, crew bests, held titles, LEGEND trophies and the
campaign. Kept apart from profiles, which riders write, so nobody can award themselves any of it."""

import json
import sqlite3
import threading
import time

from . import config


class CrewStore:
    """Mixed into `Store`, which holds the connection and the lock."""

    db: sqlite3.Connection
    lock: threading.RLock

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

    def legends(self) -> int:
        """Every LEGEND sprint ever ridden on the bus: each one bolts a trophy on it."""
        with self.lock:
            rows = self.db.execute("SELECT json FROM results").fetchall()
        return sum(
            r.get("sprints", []).count("LEGEND")
            for (j,) in rows
            if (s := json.loads(j)).get("game", "bus") == "bus"
            for r in s.get("riders", [])
        )

    def campaign(self) -> dict:
        """The crew's journey: the leg they are on (0 first), the armour it starts on, trips finished."""
        with self.lock:
            row = self.db.execute("SELECT json FROM campaign WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else {"leg": 0, "armour": 100, "trips": 0}

    def ride_leg(self, armour: float) -> str:
        """Records a campaign ride that ended on `armour`: the next leg or this one again; says how."""
        c, stops = self.campaign(), config.CAMPAIGN_STOPS
        here, there = stops[c["leg"]], stops[c["leg"] + 1]
        if armour <= 0:
            c["armour"] = config.CAMPAIGN_REPAIR
            text = f"The bus broke down short of {there}. Patched up, the crew rides {here} to {there} again."
        elif c["leg"] + 2 == len(stops):
            c = {"leg": 0, "armour": 100, "trips": c["trips"] + 1}
            text = f"{there}! The whole trip from {stops[0]} done. The bus gets a wash and starts again."
        else:
            c = {**c, "leg": c["leg"] + 1, "armour": min(100, round(armour) + config.CAMPAIGN_REPAIR)}
            text = f"Made it to {there} on {round(armour)} armour. Next: {there} to {stops[c['leg'] + 1]}."
        with self.lock, self.db:
            self.db.execute("INSERT OR REPLACE INTO campaign VALUES (1, ?)", (json.dumps(c),))
        return text

    def feed(self, me: str, n: int = 15) -> list[dict]:
        """The crew's latest rides, newest first: who, what, how long, a crew game's score, and the kudos."""
        with self.lock:
            rows = self.db.execute(
                """SELECT r.n, r.rider, COALESCE(u.name, r.rider), r.date, json_extract(r.json, '$.planName'),
                          json_extract(r.json, '$.record.secs'), json_extract(r.json, '$.group.mode'),
                          json_extract(r.json, '$.group.score'), json_extract(r.json, '$.route.id'),
                          (SELECT COUNT(*) FROM kudos k WHERE k.ride = r.n),
                          (SELECT COUNT(*) FROM kudos k WHERE k.ride = r.n AND k.giver = ?)
                   FROM rides r LEFT JOIN users u ON u.id = r.rider ORDER BY r.date DESC, r.n DESC LIMIT ?""",
                (me, n),
            ).fetchall()
        keys = ("n", "rider", "name", "date", "plan", "secs", "game", "score", "route", "kudos", "mine")
        return [{**dict(zip(keys, r, strict=True)), "mine": bool(r[10])} for r in rows]

    def give_kudos(self, me: str, ride: int) -> bool:
        """A kudos from `me` on someone else's ride, once each. False if it is their own or already given."""
        with self.lock, self.db:
            row = self.db.execute("SELECT rider FROM rides WHERE n = ?", (ride,)).fetchone()
            if not row or row[0] == me:
                return False
            return self.db.execute("INSERT OR IGNORE INTO kudos VALUES (?, ?)", (ride, me)).rowcount == 1

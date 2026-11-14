"""Uploads to Strava as jobs in SQLite, so a ride waiting on a retry survives a server restart.

A job goes queued → processing (Strava has the file) → done (an activity, set to Virtual Ride) or failed
(History shows Retry). Network trouble and Strava's 5xx back off and try again; a rate limit waits for the
next window without using up a try.
"""

import re
import secrets
import time

import httpx

from . import config, strava
from .strava import API, Busy, Strava, log

DUP = re.compile(r"duplicate of\D*(\d+)")


class Retry(Exception):
    """Worth trying again later (Strava's 5xx, or a token it refused)."""


class Uploads:
    def __init__(self, sv: Strava):
        self.sv = sv
        self.db = sv.db
        self.lock = sv.store.lock
        with self.lock, self.db:
            self.db.execute(
                """CREATE TABLE IF NOT EXISTS strava_uploads (rider TEXT, ride INTEGER, status TEXT,
                upload TEXT, activity TEXT, error TEXT, tries INTEGER DEFAULT 0, polls INTEGER DEFAULT 0,
                next REAL DEFAULT 0, name TEXT, about TEXT, fit BLOB, at REAL, card TEXT UNIQUE, png BLOB,
                PRIMARY KEY (rider, ride))"""
            )

    def _get(self, rider: str, ride: int) -> dict | None:
        with self.lock:
            cur = self.db.execute("SELECT * FROM strava_uploads WHERE rider = ? AND ride = ?", (rider, ride))
            row = cur.fetchone()
            return dict(zip([c[0] for c in cur.description], row, strict=True)) if row else None

    def _set(self, rider: str, ride: int, **kw) -> None:
        with self.lock, self.db:
            self.db.execute(
                f"UPDATE strava_uploads SET {', '.join(f'{k} = ?' for k in kw)} WHERE rider = ? AND ride = ?",
                (*kw.values(), rider, ride),
            )

    @staticmethod
    def view(job: dict | None) -> dict:
        """What the rider's app sees of a job: never the file, never a token."""
        if not job:
            return {"status": "none"}
        return {"status": job["status"], "activity": job["activity"], "error": job["error"]}

    def card_for(self, rider: str, ride: int) -> str:
        """The ride's postcard page id: the one it has, or a new unguessable one."""
        job = self._get(rider, ride)
        return job["card"] if job and job["card"] else secrets.token_urlsafe(16)

    def card(self, card: str) -> tuple[str, bytes] | None:
        """(title, PNG) for a postcard page, only once its ride is up on Strava."""
        with self.lock:
            row = self.db.execute(
                "SELECT name, png FROM strava_uploads WHERE card = ? AND status = 'done'", (card,)
            ).fetchone()
        return (row[0], row[1]) if row and row[1] else None

    def queue(
        self,
        rider: str,
        ride: int,
        name: str,
        about: str,
        fit: bytes,
        card: str | None = None,
        png: bytes | None = None,
        now: float | None = None,
    ) -> dict:
        """Starts an upload. A ride already up or on its way is left alone: a re-send never duplicates."""
        now = time.time() if now is None else now
        job = self._get(rider, ride)
        if job and job["status"] != "failed":
            return self.view(job)
        with self.lock, self.db:
            self.db.execute(
                """INSERT OR REPLACE INTO strava_uploads
                   (rider, ride, status, tries, next, name, about, fit, at, card, png)
                   VALUES (?, ?, 'queued', 0, ?, ?, ?, ?, ?, ?, ?)""",
                (rider, ride, now, name, about, fit, now, card, png),
            )
        log(f"{rider} ride {ride} queued")
        return self.view(self._get(rider, ride))

    def rides(self, rider: str) -> dict[int, dict]:
        """Every one of the rider's jobs, by ride number."""
        with self.lock:
            rows = self.db.execute(
                "SELECT ride, status, activity, error FROM strava_uploads WHERE rider = ?", (rider,)
            ).fetchall()
        return {r[0]: {"status": r[1], "activity": r[2], "error": r[3]} for r in rows}

    def step(self, now: float | None = None) -> int:
        """Moves every job that is due one step on. Returns how many it touched."""
        now = time.time() if now is None else now
        if now < strava.paused_until:
            return 0
        with self.lock:
            due = self.db.execute(
                """SELECT rider, ride FROM strava_uploads 
                   WHERE status IN ('queued', 'processing') AND next <= ? ORDER BY next LIMIT 20""",
                (now,),
            ).fetchall()
        for rider, ride in due:
            self.advance(rider, ride, now)
        return len(due)

    def advance(self, rider: str, ride: int, now: float) -> None:
        job = self._get(rider, ride)
        if not job:
            return
        try:
            tok = self.sv.token(rider, now)
            if not tok:
                return self.fail(job, "Strava isn't connected")
            auth = {"Authorization": f"Bearer {tok}"}
            if job["status"] == "queued":
                ext = f"cranky-{rider}-{ride}"
                r = self.check(
                    job,
                    strava.send(
                        "POST",
                        f"{API}/uploads",
                        headers=auth,
                        data={
                            "data_type": "fit",
                            "trainer": "1",
                            "external_id": ext,
                            "name": job["name"],
                            "description": job["about"],
                        },
                        files={"file": (f"{ext}.fit", job["fit"], "application/octet-stream")},
                    ),
                )
                self._set(
                    rider,
                    ride,
                    status="processing",
                    upload=str(r["id"]),
                    polls=0,
                    next=now + config.STRAVA_POLL_S,
                )
                job = {**job, "status": "processing", "upload": str(r["id"])}
                if not (r.get("error") or r.get("activity_id")):
                    return
            else:
                r = {"activity_id": job["activity"]} if job["activity"] else None
            if r is None:
                r = self.check(job, strava.send("GET", f"{API}/uploads/{job['upload']}", headers=auth))
            if r.get("error"):
                dup = DUP.search(r["error"])
                if dup:
                    log(f"{rider} ride {ride} was already on Strava as activity {dup[1]}")
                    return self._set(rider, ride, status="done", activity=dup[1], error=None, fit=None)
                return self.fail(job, f"Strava couldn't read the ride: {r['error'][:120]}")
            if not r.get("activity_id"):
                if job["polls"] + 1 >= config.STRAVA_POLLS:
                    raise Retry("Strava is taking too long")
                return self._set(rider, ride, polls=job["polls"] + 1, next=now + config.STRAVA_POLL_S)
            act = str(r["activity_id"])
            self._set(rider, ride, activity=act)
            self.check(
                job,
                strava.send(
                    "PUT",
                    f"{API}/activities/{act}",
                    headers=auth,
                    json={"sport_type": "VirtualRide", "trainer": True},
                ),
            )
            self._set(rider, ride, status="done", error=None, tries=0, fit=None)
            log(f"{rider} ride {ride} uploaded as Virtual Ride {act}")
        except Busy:
            self._set(rider, ride, next=strava.paused_until)
            log(f"{rider} ride {ride} waiting for Strava's rate limit")
        except PermissionError as e:
            self.fail(job, str(e))
        except (httpx.HTTPError, Retry, ValueError) as e:
            self.later(rider, ride, now, type(e).__name__ if not isinstance(e, Retry) else str(e))

    def check(self, job: dict, r: httpx.Response) -> dict:
        """Strava's reply as JSON, or why not: 5xx and a refused token try again, other 4xx fail."""
        if r.status_code >= 500:
            raise Retry(f"Strava HTTP {r.status_code}")
        if r.status_code == 401:
            with self.lock, self.db:
                self.db.execute("UPDATE strava SET expires = 0 WHERE rider = ?", (job["rider"],))
            raise Retry("Strava refused the token")
        if r.status_code >= 400:
            msg = str(r.json().get("message", "")) if "json" in r.headers.get("content-type", "") else ""
            raise PermissionError(f"Strava said no (HTTP {r.status_code}) {msg}".strip())
        return r.json()

    def later(self, rider: str, ride: int, now: float, why: str) -> None:
        """Backs off: 1, 2, 4… minutes up to an hour; after the last try it shows Retry."""
        job = self._get(rider, ride)
        if not job:
            return
        tries = job["tries"] + 1
        if tries >= config.STRAVA_TRIES:
            return self.fail(job, f"Strava kept failing ({why})")
        wait = min(config.STRAVA_RETRY_MAX_S, config.STRAVA_RETRY_S * 2 ** (tries - 1))
        # With no activity yet it starts again from the upload (a duplicate on Strava counts as done).
        again = "processing" if job["activity"] else "queued"
        self._set(rider, ride, status=again, tries=tries, next=now + wait, error=why)
        log(f"{rider} ride {ride} try {tries} failed ({why}); again in {wait} s")

    def fail(self, job: dict, why: str) -> None:
        self._set(job["rider"], job["ride"], status="failed", error=why)
        log(f"{job['rider']} ride {job['ride']} failed: {why}")

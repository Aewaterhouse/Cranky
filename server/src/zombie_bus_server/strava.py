"""Strava: each rider connects once (OAuth), and the server keeps their tokens, refreshing them as they age.

Tokens never leave the server and are never logged. Every call to Strava goes through `send`, so tests can
swap in a mock `transport`, and so Strava's rate limits are watched in one place.
"""

import secrets
import time
from urllib.parse import urlencode

import httpx

from . import config
from .store import Store

OAUTH = "https://www.strava.com/oauth"
API = "https://www.strava.com/api/v3"
transport: httpx.BaseTransport | None = None  # tests put an httpx.MockTransport here
paused_until = 0.0  # no calls to Strava before this (time.time()), after a 429 or near the limit


def log(msg: str) -> None:
    print(f"[strava] {msg}", flush=True)


def next_window(now: float, daily: bool = False) -> float:
    """The start of Strava's next rate-limit window: the next quarter hour, or UTC midnight (daily)."""
    step = 86400 if daily else 900
    return (now // step + 1) * step


class Busy(Exception):
    """Strava's rate limit is spent; try again after `paused_until`."""


def send(method: str, url: str, **kw) -> httpx.Response:
    """One call to Strava. Watches the rate-limit headers and stops calling before the limit is reached."""
    global paused_until
    now = time.time()
    if now < paused_until:
        raise Busy
    with httpx.Client(transport=transport, timeout=config.STRAVA_TIMEOUT_S) as c:
        r = c.request(method, url, **kw)
    try:
        lim = [int(x) for x in r.headers.get("x-ratelimit-limit", "").split(",")[:2]]
        use = [int(x) for x in r.headers.get("x-ratelimit-usage", "").split(",")[:2]]
        if use[0] >= lim[0] - config.STRAVA_RATE_MARGIN:
            paused_until = next_window(now)
        if use[1] >= lim[1] - config.STRAVA_RATE_MARGIN:
            paused_until = next_window(now, daily=True)
    except (ValueError, IndexError):
        pass
    if r.status_code == 429:
        paused_until = max(paused_until, next_window(now))
        raise Busy
    return r


class Strava:
    """Connections (tokens per rider) and the single-use states that tie a Connect click to its rider."""

    def __init__(self, store: Store):
        self.store = store
        self.db = store.db
        with store.lock, self.db:
            self.db.executescript("""
                CREATE TABLE IF NOT EXISTS strava (rider TEXT PRIMARY KEY, athlete TEXT, name TEXT,
                    access TEXT, refresh TEXT, expires REAL, auto INTEGER DEFAULT 1);
                CREATE TABLE IF NOT EXISTS strava_states (state TEXT PRIMARY KEY, rider TEXT, at REAL);
                """)

    @staticmethod
    def configured() -> bool:
        return bool(config.STRAVA_CLIENT_ID and config.STRAVA_CLIENT_SECRET)

    def connect_url(self, rider: str, now: float | None = None) -> str:
        """Strava's authorise page for this rider, with a fresh single-use state."""
        now = time.time() if now is None else now
        state = secrets.token_urlsafe(24)
        with self.store.lock, self.db:
            self.db.execute("DELETE FROM strava_states WHERE at < ?", (now - config.STRAVA_STATE_S,))
            self.db.execute("INSERT INTO strava_states VALUES (?, ?, ?)", (state, rider, now))
        q = {
            "client_id": config.STRAVA_CLIENT_ID,
            "redirect_uri": f"{config.PUBLIC_URL}/api/strava/callback",
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": "activity:write",
            "state": state,
        }
        return f"{OAUTH}/authorize?{urlencode(q)}"

    def finish(self, state: str, code: str, scope: str, now: float | None = None) -> str:
        """Checks the state (used up either way), swaps the code for tokens and keeps them. Returns the rider.

        Raises:
            ValueError: a message for the rider: a stale link, a short scope or Strava saying no.
        """
        now = time.time() if now is None else now
        with self.store.lock, self.db:
            row = self.db.execute("SELECT rider, at FROM strava_states WHERE state = ?", (state,)).fetchone()
            self.db.execute("DELETE FROM strava_states WHERE state = ?", (state,))
        if not row or now - row[1] > config.STRAVA_STATE_S:
            raise ValueError("That Strava link has expired. Tap Connect with Strava again.")
        if "activity:write" not in scope.split(","):
            raise ValueError("Cranky needs permission to upload activities. Tick it on Strava's page.")
        r = send(
            "POST",
            f"{OAUTH}/token",
            data={
                "client_id": config.STRAVA_CLIENT_ID,
                "client_secret": config.STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            },
        )
        if r.status_code != 200:
            log(f"connect failed for {row[0]}: HTTP {r.status_code}")
            raise ValueError("Strava didn't accept that. Try connecting again.")
        t = r.json()
        a = t.get("athlete") or {}
        name = " ".join(x for x in (a.get("firstname"), a.get("lastname")) if x) or "your Strava account"
        with self.store.lock, self.db:
            self.db.execute(
                """INSERT INTO strava (rider, athlete, name, access, refresh, expires)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(rider) DO UPDATE SET athlete = excluded.athlete, name = excluded.name,
                   access = excluded.access, refresh = excluded.refresh, expires = excluded.expires""",
                (row[0], str(a.get("id", "")), name, t["access_token"], t["refresh_token"], t["expires_at"]),
            )
        log(f"connected {row[0]}")
        return row[0]

    def status(self, rider: str) -> dict:
        """What the rider's own Settings shows: never a token."""
        with self.store.lock:
            row = self.db.execute("SELECT name, auto FROM strava WHERE rider = ?", (rider,)).fetchone()
        return {
            "configured": self.configured(),
            "connected": bool(row),
            "name": row[0] if row else None,
            "auto": bool(row[1]) if row else True,
        }

    def set_auto(self, rider: str, on: bool) -> bool:
        with self.store.lock, self.db:
            cur = self.db.execute("UPDATE strava SET auto = ? WHERE rider = ?", (int(on), rider))
        return cur.rowcount > 0

    def token(self, rider: str, now: float | None = None) -> str | None:
        """The rider's access token, refreshed first when it is close to expiring. None if not connected.

        Raises:
            PermissionError: Strava refused the refresh (Cranky was revoked); connect again.
        """
        now = time.time() if now is None else now
        with self.store.lock:
            row = self.db.execute(
                "SELECT access, refresh, expires FROM strava WHERE rider = ?", (rider,)
            ).fetchone()
        if not row:
            return None
        if row[2] - now > config.STRAVA_REFRESH_EARLY_S:
            return row[0]
        r = send(
            "POST",
            f"{OAUTH}/token",
            data={
                "client_id": config.STRAVA_CLIENT_ID,
                "client_secret": config.STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": row[1],
            },
        )
        if r.status_code in (400, 401):
            raise PermissionError("Reconnect Strava in Rider → Settings")
        r.raise_for_status()
        t = r.json()
        with self.store.lock, self.db:
            self.db.execute(
                "UPDATE strava SET access = ?, refresh = ?, expires = ? WHERE rider = ?",
                (t["access_token"], t["refresh_token"], t["expires_at"], rider),
            )
        log(f"refreshed token for {rider}")
        return t["access_token"]

    def disconnect(self, rider: str) -> bool:
        """Tells Strava to forget Cranky for this rider (best effort), then deletes the stored tokens."""
        with self.store.lock:
            row = self.db.execute("SELECT access FROM strava WHERE rider = ?", (rider,)).fetchone()
        if not row:
            return False
        try:
            send("POST", f"{OAUTH}/deauthorize", data={"access_token": row[0]})
        except (httpx.HTTPError, Busy) as e:
            log(f"deauthorise for {rider} failed ({type(e).__name__}); tokens deleted anyway")
        with self.store.lock, self.db:
            self.db.execute("DELETE FROM strava WHERE rider = ?", (rider,))
        log(f"disconnected {rider}")
        return True

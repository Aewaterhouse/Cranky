"""Cached, polite JSON fetches for the route builder."""

import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).parent / ".cache"
AGENT = "route-pack-builder"
RETRIES = 3


def fetch(url: str, data: dict[str, str] | None = None, pause: float = 1.0, check=None) -> dict:
    """Fetches JSON, caching the reply on disk and pausing after a real request.

    A reply that fails `check` (the public servers send empty answers when busy) is retried.
    """
    body = urllib.parse.urlencode(data).encode() if data else None
    key = hashlib.sha1(url.encode() + (body or b"")).hexdigest()
    hit = CACHE / f"{key}.json"
    if hit.exists():
        return json.loads(hit.read_text())
    req = urllib.request.Request(url, data=body, headers={"User-Agent": AGENT})
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                text = r.read().decode()
            if check and not check(json.loads(text)):
                raise OSError("empty reply")
            break
        except (OSError, ValueError):
            if attempt == RETRIES - 1:
                raise
            time.sleep(20 * (attempt + 1))
    CACHE.mkdir(exist_ok=True)
    hit.write_text(text)
    time.sleep(pause)
    return json.loads(text)

"""Ride downloads served from a real URL, for browsers (Bluefy on iPad) that cannot save blob or data links.

The client builds the file (.fit, JSON, a postcard PNG) for one of the rider's rides and uploads it; the reply
is an unguessable link that serves it as an attachment for a few minutes, so the browser's own Save / Share
takes over. Files live in memory only: they are rebuilt from the saved ride whenever a button is pressed.
"""

import re
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response

from . import config

TYPES = {"fit": "application/octet-stream", "json": "application/json", "png": "image/png"}
NAME = re.compile(r"[A-Za-z0-9._-]{1,80}")


def router(user: Any) -> APIRouter:
    """The download endpoints; `user` is the app's logged-in-rider dependency."""
    api = APIRouter()
    kept: dict[str, tuple[float, str, str, bytes]] = {}  # key -> (saved at, rider, name, bytes)

    @api.put("/api/rides/files/{name}")
    async def put_file(name: str, request: Request, u: user) -> dict:
        """Keeps a file the caller built from one of their rides and returns the link that serves it."""
        if not NAME.fullmatch(name) or name.rsplit(".", 1)[-1] not in TYPES:
            raise HTTPException(422, "Name a .fit, .json or .png file")
        data = await request.body()
        if not data or len(data) > config.FILE_MAX_BYTES:
            raise HTTPException(413, "That file is empty or too big")
        now = time.time()
        for k in [k for k, v in kept.items() if v[0] < now - config.FILE_KEEP_S]:
            del kept[k]
        mine = [k for k, v in kept.items() if v[1] == u["id"]]  # oldest first: dicts keep insertion order
        for k in mine[: max(0, len(mine) - config.FILE_PER_RIDER + 1)]:
            del kept[k]
        key = secrets.token_urlsafe(18)
        kept[key] = (now, u["id"], name, data)
        return {"url": f"/api/rides/files/{key}/{name}"}

    @api.get("/api/rides/files/{key}/{name}")
    def get_file(key: str, name: str, inline: bool = False) -> Response:
        """Serves a kept file. The key is the only credential, so the link opens in any browser or app."""
        f = kept.get(key)
        if not f or f[2] != name or f[0] < time.time() - config.FILE_KEEP_S:
            raise HTTPException(404, "That download has expired. Tap the button again.")
        how = "inline" if inline else "attachment"
        return Response(
            f[3],
            media_type=TYPES[name.rsplit(".", 1)[-1]],
            headers={"content-disposition": f'{how}; filename="{name}"', "cache-control": "private"},
        )

    return api

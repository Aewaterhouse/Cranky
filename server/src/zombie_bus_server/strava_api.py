"""Strava endpoints: connect, the OAuth callback, the auto-upload switch, disconnect and uploads."""

import base64
import binascii
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from . import config
from .strava import Busy, Strava
from .strava_text import describe
from .strava_uploads import Uploads


class Auto(BaseModel):
    on: bool


class Upload(BaseModel):
    fit: str  # base64


def back(**q: str) -> RedirectResponse:
    """Back to Rider → Settings with a message for the app to show."""
    return RedirectResponse(f"/?{urlencode(q)}#rider", status_code=303)


def router(strava: Strava, uploads: Uploads, user: Any) -> APIRouter:
    """The Strava endpoints; `user` is the app's logged-in-rider dependency."""
    api = APIRouter()

    @api.get("/api/strava")
    def status(u: user) -> dict:
        return strava.status(u["id"])

    @api.post("/api/strava/connect")
    def connect(u: user) -> dict:
        if not strava.configured():
            raise HTTPException(503, "Strava isn't set up on this server")
        return {"url": strava.connect_url(u["id"])}

    @api.get("/api/strava/callback")
    def callback(state: str = "", code: str = "", scope: str = "", error: str = "") -> RedirectResponse:
        """Where Strava sends the rider back. No login header here: the single-use state says who it is."""
        if error:
            return back(strava="error", why="Strava wasn't connected.")
        try:
            strava.finish(state, code, scope)
        except ValueError as e:
            return back(strava="error", why=str(e))
        except (httpx.HTTPError, Busy):
            return back(strava="error", why="Couldn't reach Strava. Try again in a few minutes.")
        return back(strava="connected")

    @api.put("/api/strava/auto")
    def auto(body: Auto, u: user) -> dict:
        if not strava.set_auto(u["id"], body.on):
            raise HTTPException(409, "Connect Strava first")
        return strava.status(u["id"])

    @api.post("/api/strava/disconnect")
    def disconnect(u: user) -> dict:
        strava.disconnect(u["id"])
        return strava.status(u["id"])

    @api.post("/api/strava/upload/{n}")
    def upload(n: int, body: Upload, u: user) -> dict:
        """Sends one of the caller's own saved rides (its .fit built on the device) to Strava."""
        ride = strava.store.ride(u["id"], n)
        if not ride:
            raise HTTPException(404)
        if not strava.status(u["id"])["connected"]:
            raise HTTPException(409, "Connect Strava first")
        if (ride.get("record") or {}).get("secs", 0) < config.STRAVA_MIN_SECS:
            raise HTTPException(422, "That ride is too short for Strava")
        try:
            fit = base64.b64decode(body.fit, validate=True)
        except binascii.Error:
            raise HTTPException(422, "That .fit didn't come through") from None
        if not fit or len(fit) > config.FILE_MAX_BYTES:
            raise HTTPException(413, "That .fit is empty or too big")
        name, about = describe(ride, u["id"])
        return uploads.queue(u["id"], n, name, about, fit)

    return api

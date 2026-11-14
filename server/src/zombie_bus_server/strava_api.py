"""Strava endpoints: connect, the OAuth callback, the auto-upload switch and disconnect."""

from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .strava import Busy, Strava


class Auto(BaseModel):
    on: bool


def back(**q: str) -> RedirectResponse:
    """Back to Rider → Settings with a message for the app to show."""
    return RedirectResponse(f"/?{urlencode(q)}#rider", status_code=303)


def router(strava: Strava, user: Any) -> APIRouter:
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

    return api

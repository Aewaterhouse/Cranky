"""Strava endpoints: connect, the OAuth callback, the auto-upload switch, disconnect and uploads."""

import base64
import binascii
import html
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from . import config
from .strava import Busy, Strava
from .strava_text import describe
from .strava_uploads import Uploads


class Auto(BaseModel):
    on: bool


class Upload(BaseModel):
    fit: str  # base64
    png: str | None = None  # the postcard, base64


def unpack(b64: str, what: str) -> bytes:
    """A base64 file from the app, or a 4xx."""
    try:
        data = base64.b64decode(b64, validate=True)
    except binascii.Error:
        raise HTTPException(422, f"That {what} didn't come through") from None
    if not data or len(data) > config.FILE_MAX_BYTES:
        raise HTTPException(413, f"That {what} is empty or too big")
    return data


PAGE = """<!doctype html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="Cranky">
<meta property="og:title" content="{title}"><meta property="og:description" content="Ridden on Cranky">
<meta property="og:image" content="{img}"><meta property="og:image:width" content="1200">
<meta property="og:image:height" content="800"><meta name="twitter:card" content="summary_large_image">
<style>body{{margin:0;background:#15161a;color:#f3f0e6;font:16px system-ui;text-align:center}}
img{{display:block;width:100%;max-width:1200px;margin:0 auto}}a{{color:#f2b705}}p{{padding:12px 16px}}</style>
</head><body><img src="{card}.png" alt="{title}">
<p>{title} · Ridden on <a href="/">Cranky</a></p></body></html>"""


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

    @api.get("/api/strava/rides")
    def rides(u: user) -> dict:
        """The caller's own uploads by ride number, for History."""
        return {"connected": strava.status(u["id"])["connected"], "rides": uploads.rides(u["id"])}

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
        fit = unpack(body.fit, ".fit")
        png = unpack(body.png, "postcard") if body.png else None
        card = uploads.card_for(u["id"], n) if png else None
        name, about = describe(ride, u["id"], f"{config.PUBLIC_URL}/p/{card}" if card else "")
        return uploads.queue(u["id"], n, name, about, fit, card, png)

    @api.get("/p/{card}.png")
    def card_png(card: str) -> Response:
        """A postcard picture: public, the unguessable id is the only key."""
        got = uploads.card(card)
        if not got:
            raise HTTPException(404)
        return Response(got[1], media_type="image/png", headers={"cache-control": "public, max-age=86400"})

    @api.get("/p/{card}", response_class=HTMLResponse)
    def card_page(card: str) -> str:
        """A ride's postcard page, with og:image so a link to it previews as the picture."""
        got = uploads.card(card)
        if not got:
            raise HTTPException(404, "No postcard here")
        return PAGE.format(title=html.escape(got[0]), img=f"{config.PUBLIC_URL}/p/{card}.png", card=card)

    return api

"""Logging in and accounts: passwords, the first-login change, the login limit, the admins' Riders."""

import math
import re
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import AliasChoices, BaseModel, Field

from . import config
from .store import Store


class Login(BaseModel):
    username: str = Field(validation_alias=AliasChoices("username", "name"))  # older clients send `name`
    password: str


class Username(BaseModel):
    username: str


class NewRider(BaseModel):
    name: str
    password: str | None = None


class Password(BaseModel):
    password: str
    current: str | None = None


class Limiter:
    """Wrong passwords per name: after `LOGIN_FAILS` in `LOGIN_WINDOW_S` that name waits out the window."""

    def __init__(self) -> None:
        self.fails: dict[str, list[float]] = {}

    def wait(self, name: str, now: float) -> float:
        """Seconds this name must still wait, 0 when it may try."""
        recent = [t for t in self.fails.get(name, []) if now - t < config.LOGIN_WINDOW_S]
        self.fails[name] = recent
        return recent[0] + config.LOGIN_WINDOW_S - now if len(recent) >= config.LOGIN_FAILS else 0

    def fail(self, name: str, now: float) -> None:
        self.fails.setdefault(name, []).append(now)

    def clear(self, name: str) -> None:
        self.fails.pop(name, None)


def accounts(store: Store):
    """(router, User, SignedIn). `User` is a rider with their own password set, which nearly everything needs;
    `SignedIn` is anyone logged in, including a rider who must still replace the default password."""
    limiter = Limiter()

    def signed_in(authorization: str = Header(default="")) -> dict:
        """The logged-in rider from `Authorization: Bearer <token>`."""
        me = store.whoami(authorization.removeprefix("Bearer ").strip())
        if not me:
            raise HTTPException(401, "Log in first")
        return {**me, "admin": me["id"] in config.ADMINS}

    def user(me: Annotated[dict, Depends(signed_in)]) -> dict:
        if me["mustChange"]:
            raise HTTPException(403, "Set your password first")
        return me

    SignedIn = Annotated[dict, Depends(signed_in)]
    User = Annotated[dict, Depends(user)]
    api = APIRouter()

    @api.get("/api/riders")
    def riders(u: User) -> list[dict]:
        """The crew, for logged-in riders only (the login page lists nobody). Only admins see usernames."""
        return [x if u["admin"] else {"id": x["id"], "name": x["name"]} for x in store.users()]

    @api.post("/api/login")
    def login(body: Login) -> dict:
        name = body.username.strip().lower()
        t = time.time()
        wait = limiter.wait(name, t)
        if wait:
            mins = math.ceil(wait / 60)
            raise HTTPException(
                429,
                f"Too many wrong passwords. Have a breather and try again in {mins} min{'s' * (mins > 1)}.",
            )
        res = store.login(body.username, body.password)
        if not res:
            limiter.fail(name, t)
            raise HTTPException(401, "Wrong username or password")
        limiter.clear(name)
        return res

    @api.get("/api/me")
    def me(u: SignedIn) -> dict:
        return u

    @api.post("/api/riders/{rid}/password")
    def set_password(rid: str, body: Password, u: SignedIn) -> dict:
        """A rider sets their own password: first in place of the default, later with the current one."""
        if rid != u["id"]:
            raise HTTPException(403, "You can only change your own password")
        pw = body.password
        if len(pw) < config.PASSWORD_MIN:
            raise HTTPException(400, f"At least {config.PASSWORD_MIN} characters")
        if pw.strip().lower() in (rid, (store.username(rid) or "").lower()):
            raise HTTPException(400, "Not your name: that's the one everyone knows")
        if not u["mustChange"] and not store.check_password(rid, body.current or ""):
            raise HTTPException(403, "Your current password isn't right")
        store.set_password(rid, pw)
        return {"ok": True}

    def admin(u: dict) -> None:
        if not u["admin"]:
            raise HTTPException(403, "Admins only")

    @api.post("/api/riders/{rid}/username")
    def set_username(rid: str, body: Username, u: User) -> dict:
        """What a rider logs in with, changed by them or an admin. Their id (which everything hangs off) and
        their shown name stay as they are."""
        if rid != u["id"]:
            admin(u)
        name = body.username.strip()
        if not re.fullmatch(config.USERNAME_RE, name):
            raise HTTPException(400, "3 to 24 characters: letters, numbers, spaces, - and _")
        if store.username(rid) is None:
            raise HTTPException(404)
        if not store.set_username(rid, name):
            raise HTTPException(409, "That username is taken")
        return {"ok": True, "username": name}

    @api.post("/api/riders")
    def add_rider(body: NewRider, u: User) -> dict:
        admin(u)
        name = body.name.strip()
        if not name or len(name) > config.NAME_MAX or not name.isprintable():
            raise HTTPException(400, f"Name must be 1 to {config.NAME_MAX} characters")
        if not store.add_user(name, body.password or name):
            raise HTTPException(409, f"{name} already exists")
        return {"id": name.lower(), "name": name}

    @api.post("/api/riders/{rid}/reset")
    def reset_password(rid: str, u: User) -> dict:
        """Back to the default (their username); they set their own when they next log in."""
        admin(u)
        if not store.set_password(rid, store.username(rid) or rid, must_change=True):
            raise HTTPException(404)
        limiter.clear(rid)
        return {"ok": True}

    @api.delete("/api/riders/{rid}")
    def delete_rider(rid: str, u: User) -> dict:
        admin(u)
        if rid == u["id"]:
            raise HTTPException(400, "You can't remove yourself")
        if not store.delete_user(rid):
            raise HTTPException(404)
        return {"ok": True}

    return api, User, SignedIn

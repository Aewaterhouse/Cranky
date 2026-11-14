"""Rider bodies (the character creator): checks the `body` string a look carries. See docs/avatars.md.

A body is `<version>-<value>-<value>…`, one whole number per option in `content/avatar.json`, in table order.
"""

import json
from functools import cache

from . import config


@cache
def table() -> tuple[int, tuple[int, ...]]:
    """(version, each option's highest value) from the shared options table."""
    raw = json.loads((config.CONTENT / "avatar.json").read_text())
    return raw["version"], tuple(f["max"] for f in raw["fields"])


def clean_body(s: object) -> str | None:
    """The body string with every value clamped to its range, or None if it isn't one we understand."""
    version, maxes = table()
    if not isinstance(s, str) or len(s) > config.BODY_MAX_CHARS:
        return None
    parts = s.split("-")
    if len(parts) != len(maxes) + 1 or not all(p.isascii() and p.isdigit() for p in parts):
        return None
    if int(parts[0]) != version:
        return None
    return "-".join([parts[0], *(str(min(m, int(p))) for p, m in zip(parts[1:], maxes, strict=True))])


def clean_look(look: dict) -> dict:
    """The look with its `body` kept (clamped) if it is a body and dropped if not. Item ids pass through.

    A `sash` is never the rider's to set: it is always dropped here and added back by `wear_sash`.
    """
    look = {k: v for k, v in look.items() if k != "sash"}
    if "body" not in look:
        return look
    body = clean_body(look["body"])
    rest = {k: v for k, v in look.items() if k != "body"}
    return {**rest, "body": body} if body else rest


def wear_sash(store: object, rid: str, look: dict) -> dict:
    """The look with Climate Lawsuit's GUILTY sash on if the store says this rider is still wearing one."""
    look = clean_look(look)
    lookup = getattr(store, "sash_until", None)  # test stand-ins for the store may not have one
    until = lookup(rid) if lookup else None
    return {**look, "sash": True} if until else look

"""Workout plans: loading, validation, flattening, targets and the session generator.

Mirrors client/src/core/plan.ts.
"""

import copy
import json
from functools import cache

import jsonschema

from . import config

Block = dict


def pct_for(p: float | dict, tier: str) -> float:
    """Fraction of FTP for a pct value (number = hard tier, scaled) and tier."""
    return (p * config.TIER_FACTOR[tier] if isinstance(p, int | float) else p[tier]) / 100


def flatten(blocks: list[Block]) -> list[Block]:
    """Expands `set` blocks into repeated copies of their inner blocks."""
    out: list[Block] = []
    for b in blocks:
        if b["type"] == "set":
            inner = flatten(b["blocks"])
            for _ in range(b["rep"]):
                out.extend(copy.deepcopy(inner))
        else:
            out.append(b)
    return out


def block_target(b: Block, tier: str, bel: float) -> float | None:
    """Target as a fraction of FTP at `bel` seconds into the block, None when ERG is off."""
    t = b["type"]
    if t == "steady":
        return pct_for(b["pct"], tier)
    if t == "ramp":
        a, z = pct_for(b["pct"][0], tier), pct_for(b["pct"][1], tier)
        return a + (z - a) * min(1.0, bel / b["dur"])
    if t == "over-under":
        return pct_for(b["pct"][int(bel // b["step"]) % 2], tier)
    return None


def is_over(b: Block, bel: float) -> bool:
    return b["type"] == "over-under" and int(bel // b["step"]) % 2 == 0


def total(blocks: list[Block]) -> float:
    return sum(b["dur"] for b in blocks)


def locate(blocks: list[Block], el: float) -> tuple[int, float] | None:
    """Index of the block at `el` and seconds into it, or None past the end."""
    t = 0.0
    for i, b in enumerate(blocks):
        if el < t + b["dur"]:
            return i, el - t
        t += b["dur"]
    return None


def event_for(blocks: list[Block], i: int) -> str:
    """Maps a block to a Zombie Bus event."""
    b = blocks[i]
    if i == 0:
        return "warmup"
    if i == len(blocks) - 1:
        return "cooldown"
    if b["type"] == "sprint":
        return "roadblock"
    if b["type"] == "over-under":
        return "surge"
    if b["type"] == "free" or (b["type"] == "steady" and pct_for(b["pct"], "hard") < 0.6):
        return "servo"
    if b["type"] == "ramp":
        return "rampup"
    return "longhaul"


@cache
def schema() -> dict:
    return json.loads((config.CONTENT / "schema" / "workout.schema.json").read_text())


@cache
def load_plans() -> dict[str, dict]:
    """All workout JSON files, validated against the shared schema."""
    plans = {}
    for f in sorted((config.CONTENT / "workouts").glob("*.json")):
        raw = json.loads(f.read_text())
        jsonschema.validate(raw, schema())
        plans[raw["id"]] = raw
    return plans


def generate(raw: dict, minutes: int) -> dict:
    """Rescales a raw plan to about `minutes` and returns it flattened (mirrors the TS generator)."""
    if not minutes:
        return {**raw, "blocks": flatten(raw["blocks"])}
    target = minutes * 60
    blocks = copy.deepcopy(raw["blocks"])
    size = lambda: total(flatten(blocks))  # noqa: E731
    sets = next((i for i, b in enumerate(blocks) if b["type"] == "set"), None)
    if sets is not None:
        s = blocks[sets]
        per = total(flatten([{**s, "rep": 1}]))
        fixed = size() - per * s["rep"]
        s["rep"] = max(1, round((target - fixed) / per))
    else:
        longest = max(
            (i for i, b in enumerate(blocks) if b["type"] == "steady"),
            key=lambda i: blocks[i]["dur"],
            default=0,
        )
        blocks[longest]["dur"] = max(60, blocks[longest]["dur"] + target - size())
    slack = target - size()
    first, last = blocks[0], blocks[-1]
    step = round(slack / 2 / 30) * 30
    if first["type"] not in ("sprint", "set"):
        first["dur"] = max(60, first["dur"] + step)
    if last is not first and last["type"] not in ("sprint", "set"):
        last["dur"] = max(60, last["dur"] + step)
    return {**raw, "blocks": flatten(blocks)}

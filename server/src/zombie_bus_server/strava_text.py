"""The title and description a ride gets on Strava, from its saved summary and what the server knows besides.

Zwift's way, in Cranky's voice: a title that says what the ride was, then the numbers that matter in short
groups (new power bests with the old ones, KOMs and sprints, segments with the crew placing, the game's
result and awards) and a silly line or two, biggest news first, capped so it never becomes an essay.
"""

from typing import Any

from . import config
from .strava_games import clock, game, km, power

SIGN_OFF = "Ridden on Cranky · cranky.life"
DUR = {1: "1 s", 5: "5 s", 15: "15 s", 30: "30 s", 60: "1 min", 120: "2 min", 300: "5 min", 600: "10 min"}
DUR |= {1200: "20 min", 3600: "60 min"}
MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}


def nth(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def seg_time(secs: float) -> str:
    return f"{secs:.1f} s" if secs < 59.95 else clock(secs)


def power_prs(s: dict[str, Any], prev: dict[int, float]) -> list[str]:
    """'🔥 1 min: 412 W (was 398)' for each familiar duration beaten, the biggest gain first."""
    best = (s.get("record") or {}).get("best") or {}
    gains = []
    for d, label in DUR.items():
        new, old = best.get(str(d), best.get(d)), prev.get(d)
        if new and old and new > old:
            gains.append(((new - old) / old, f"🔥 {label}: {round(new)} W (was {round(old)})"))
    return [t for _, t in sorted(gains, key=lambda x: -x[0])]


def placing(r: dict, places: dict[str, tuple[int, int]]) -> str:
    """', 🥈 2nd of 5 in the crew' (or the crew best), from the server's leaderboard at upload."""
    got = places.get(r.get("segment", ""))
    if not got:
        return ""
    n, of = got
    if of < 2:
        return ", the only one in the crew to ride it (so, technically, the fastest)"
    if n == 1:
        return f", 👑 fastest of {of} in the crew"
    return f", {MEDAL[n] + ' ' if n in MEDAL else ''}{nth(n)} of {of} in the crew"


def segment_lines(s: dict[str, Any], places: dict[str, tuple[int, int]]) -> tuple[list[str], list[str]]:
    """(KOMs and sprints, the other segments) ridden, PRs and crew bests first."""
    efforts = [x for x in s.get("segments") or [] if isinstance(x, dict) and x.get("secs")]
    efforts.sort(key=lambda x: (not x.get("crewBest"), not x.get("pr"), x.get("secs", 0)))
    peaks, rest = [], []
    for r in efforts:
        icon = {"climb": "⛰️", "sprint": "⚡"}.get(r.get("kind", ""), "⏱️")
        pr = ""
        if r.get("pr") and r.get("prevS"):
            pr = f" · PR (was {seg_time(r['prevS'])})"
        elif r.get("first"):
            pr = " · first go"
        lap = f" (lap {r['lap']})" if r.get("lap") else ""
        watts = round(r.get("watts") or 0)
        line = f"{icon} {r.get('name', 'Segment')}{lap}: {seg_time(r['secs'])}, {watts} W"
        (peaks if r.get("kind") in ("climb", "sprint") else rest).append(line + placing(r, places) + pr)
    return peaks, rest


def bus_sprints(s: dict[str, Any]) -> list[str]:
    """The bus or a workout's graded sprints: '⚡ Sprint 2: 812 W for 10 s, MEGA'."""
    done = [x for x in s.get("sprints") or [] if isinstance(x, dict)]
    return [
        f"⚡ Sprint {i + 1}: {round(x.get('avg') or 0)} W for {x.get('dur', 0)} s, {x.get('grade', '?')}"
        for i, x in enumerate(done)
    ]


def silly(s: dict[str, Any], rider: str, prs: list[str], places: dict[str, tuple[int, int]]) -> list[str]:
    """A line or two drawn from the ride: meat pies burned, the horde, falls, the best bit."""
    g = s.get("group") or {}
    me = next((r for r in g.get("riders", []) if isinstance(r, dict) and r.get("id") == rider), {})
    out = []
    pies = ((s.get("record") or {}).get("kj") or 0) / config.STRAVA_PIE_KJ
    if pies >= 0.5:
        out.append(f"🥧 Burned off {pies:.1f} meat pies. Replace as needed.")
    if g and not g.get("mode"):
        if (g.get("armour") or 0) > 0:
            out.append(f"🧟 Kept the horde {round(g.get('gap') or 0)} m back. They'll be fine.")
        else:
            out.append("🧟 Caught by the horde. Eaten, mostly.")
    if me.get("falls"):
        out.append(f"🪦 Fell off {me['falls']}× and got back on, which is the main thing")
    best = next(
        (h.get("text") for h in g.get("highlights") or [] if isinstance(h, dict) and h.get("text")), None
    )
    kings = [
        x
        for x in s.get("segments") or []
        if isinstance(x, dict) and places.get(x.get("segment", ""), (0, 0))[0] == 1 and x.get("secs")
    ]
    if not best and kings:
        k = min(kings, key=lambda x: x["secs"])
        best = f"{k.get('name', 'a segment')} in {seg_time(k['secs'])}, quicker than the whole crew"
    if not best and prs:
        label, rest = prs[0][2:].split(": ", 1)
        best = f"a new {label} best, {rest.split(' (')[0]}"
    if best:
        out.append(f"✨ Best bit: {best}")
    return out


def cap(sections: list[tuple[str, list[str], int]], total: int) -> list[str]:
    """The sections as lines, each list cut to its cap with '+ N more', tighter while it runs past `total`."""
    cut = 0
    while True:
        lines: list[str] = []
        for head, items, most in sections:
            n = max(2, most - cut)
            shown = items if len(items) <= n else [*items[: n - 1], f"+ {len(items) - n + 1} more"]
            lines += (["", head] if head else []) + shown if items else []
        if len("\n".join(lines)) <= total or all(max(2, m - cut) == 2 for _, i, m in sections if i):
            return lines
        cut += 1


def describe(
    s: dict[str, Any], rider: str, link: str = "", ctx: dict[str, Any] | None = None
) -> tuple[str, str]:
    """(title, description) for one of `rider`'s saved rides.

    `link` is the postcard page, when it has one. `ctx` is what the server knows besides the ride: `prev`, the
    rider's best power at each duration before this ride, and `places`, (place, riders) in the crew for each
    segment ridden.
    """
    ctx = ctx or {}
    secs = (s.get("record") or {}).get("secs") or 0
    prs = power_prs(s, ctx.get("prev") or {})
    peaks, rest = segment_lines(s, ctx.get("places") or {})
    sprints = bus_sprints(s)
    played = game(s, rider)
    if played:
        title, heading, top, result = played
    elif s.get("route"):
        kind = "group ride" if s.get("crew") else "free ride"
        title = f"{s['route'].get('name', 'Free ride')} · Cranky {kind}"
        if any(x.startswith("⛰️") and "👑" in x for x in peaks):
            title = f"👑 {title}"
        heading, result = "", []
        top = [f"{km(s.get('distance'))} · {round(s.get('ascent') or 0)} m climbed · {clock(secs)}", power(s)]
    else:
        title = f"💪 {s.get('planName') or 'Ride'} · Cranky workout"
        comp = s.get("compliance") or 0
        heading, result = "", []
        top = [
            f"{clock(secs)} · {power(s)}",
            f"TSS {s.get('tss', 0)} · IF {s.get('if', 0)}" + (f" · {comp:.0%} on plan" if comp else ""),
        ]
    places = ctx.get("places") or {}
    each = config.STRAVA_LIST_MAX
    sections = [
        ("", top, len(top)),
        (heading, result, each * 2),
        ("New power bests", prs, each),
        ("KOMs and sprints", peaks + sprints, each),
        ("Segments", rest, each),
        ("Also", silly(s, rider, prs, places), each),
    ]
    lines = cap(sections, config.STRAVA_TEXT_MAX)
    end = ["", *([f"Postcard: {link}"] if link else []), SIGN_OFF]
    return title, "\n".join([*lines, *end]).lstrip("\n")

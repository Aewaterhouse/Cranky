"""A crew game's part of a ride's Strava post: its title, the result lines and a heading for them."""

from typing import Any

from .discord import GAME_NAMES


def clock(secs: float) -> str:
    s = round(secs or 0)
    return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def km(m: float | None) -> str:
    return f"{(m or 0) / 1000:.1f} km"


def power(s: dict[str, Any]) -> str:
    return f"NP {s.get('np', 0)} W · avg {s.get('avgPower', 0)} W"


def game(s: dict[str, Any], rider: str) -> tuple[str, str, list[str], list[str]] | None:
    """(title, heading, top lines, result lines) for a crew game ride, or None for any other ride.

    The top lines lead the post (the score and the training numbers); the result lines go under the heading.
    """
    g = s.get("group") or {}
    if not g:
        return None
    crew = [r for r in g.get("riders", []) if isinstance(r, dict)]
    me = next((r for r in crew if r.get("id") == rider), {})
    plan = s.get("planName") or "Ride"
    secs = (s.get("record") or {}).get("secs") or 0
    awards = [f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in g.get("awards", [])]
    crew_line = f"Crew: {', '.join(r.get('name', '?') for r in crew)}"
    if g.get("mode") == "madness":
        title = f"🔥 VO2 Madness · {plan}"
        top = [f"Crew score {g.get('score', 0)} · my effort points {round(me.get('points') or 0)}", power(s)]
        red = f"{round(me.get('redSecs') or 0)} s in the red"
        return title, "The madness", top, [red, crew_line, *awards]
    if g.get("mode") == "date":
        wed, div = g.get("married") or {}, g.get("divorced") or {}
        title = f"💘 Speed Dating · {round((me.get('match') or 0) * 100)}% compatible"
        flags = "; ".join(me.get("flags") or []) or "none, suspiciously"
        lines = [
            f"Best match: {me.get('best') or 'nobody'} · worst: {me.get('worst') or 'nobody'}",
            f"Red flags: {flags}",
            *([f"💒 {wed.get('a')} and {wed.get('b')} got married"] if wed else []),
            *([f"⚖️ {div.get('winner')} kept the house"] if div else []),
            crew_line,
            *awards,
        ]
        top = [f"Chemistry {g.get('score', 0)} · {km(g.get('distance'))}", power(s)]
        return title, "The dates", top, lines
    if g.get("mode") == "ambo":
        runs = [r for r in g.get("reviews", []) if isinstance(r, dict)]
        title = f"🚑 Kidney Stone Express · {g.get('delivered', 0)}/{len(runs)} patients delivered"
        lines = [
            *(f"{r.get('icon', '')} {r.get('patient', '?')}: {'★' * int(r.get('stars') or 0)}" for r in runs),
            f"Me: {me.get('spread', 0)}% rough · {me.get('spikes', 0)} spikes · {me.get('fines', 0)} fines",
            crew_line,
            *awards,
        ]
        top = [f"Shift score {g.get('score', 0)} · {km(g.get('distance'))}", power(s)]
        return title, "The shift", top, lines
    if g.get("mode") == "climate":
        verdict = (g.get("verdicts") or {}).get(rider)
        fate = "the town flooded" if g.get("flooded") else "the town survived"
        title = f"🌊 Climate Lawsuit · {fate}" + (f" · {verdict}" if verdict else "")
        lines = [
            f"{me.get('company') or 'My company'}: {me.get('coins', 0)} coins · {me.get('emit', 0)} tonnes"
            + (" · took the envelope" if me.get("bribed") else ""),
            f"Sea reached {g.get('stageName') or 'nothing'}",
            crew_line,
            *awards,
        ]
        return title, "The trial", [f"Town profit {g.get('score', 0)}", power(s)], lines
    if g.get("mode") in GAME_NAMES:
        name, label = GAME_NAMES[g["mode"]]
        mine = me.get("points") if me.get("points") is not None else me.get("reached")
        top = [f"Crew {label} {g.get('score', 0)}" + (f" · mine {mine}" if mine is not None else "")]
        top.append(power(s))
        return f"{name.replace('**', '')} · {plan}", "The game", top, [crew_line, *awards]
    gap = g.get("gap")
    fate = "survived" if (g.get("armour") or 0) > 0 else "caught"
    title = f"🧟 Zombie Bus · {plan} · {fate}" + (f" with a {gap} m gap" if gap is not None else "")
    on = me.get("inBandSecs")
    kj = [r.get("kj") for r in crew]
    share = me.get("kj") / sum(kj) if all(k is not None for k in kj) and sum(kj) else None
    mine = " · ".join(
        x
        for x in (
            f"NP {s.get('np', 0)} W",
            f"on target {clock(on)} ({min(1, on / secs):.0%})" if on is not None and secs else "",
            f"{share:.0%} of the crew's work" if share is not None else "",
        )
        if x
    )
    top = [f"Score {g.get('score', 0)} · {km(g.get('distance'))} · armour {round(g.get('armour') or 0)}%"]
    return title, "The bus", top, [f"Me: {mine}", crew_line, *awards]

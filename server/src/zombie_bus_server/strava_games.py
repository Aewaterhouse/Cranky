"""A crew game's part of a ride's Strava post: its title, the result lines and a heading for them."""

from typing import Any

# Crew games that have gone: old rides in them still get a plain post with the game's name and the numbers.
GONE = {
    "madness": "🤯 VO2 Madness",
    "ambo": "🚑 Kidney Stone Express",
    "date": "💘 Speed Dating",
    "climate": "🌊 Climate Lawsuit",
    "watch": "📺 Watch Party",
    "last": "🏁 Last Rider Standing",
    "ttt": "⏱ Team Time Trial",
    "quiz": "🍺 Pub Quiz",
    "galley": "🛶 Galley Ship",
    "hunt": "🦊 The Hunt",
}


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
    awards = [
        f"🏆 {a.get('award', '?')}: {a.get('name', '?')} ({a.get('why', '')})"
        for a in g.get("awards", [])
        if isinstance(a, dict)
    ]
    crew_line = f"Crew: {', '.join(r.get('name', '?') for r in crew)}"
    if g.get("mode") in GONE:
        score = g.get("score")
        top = [*([f"Crew score {score}"] if score is not None else []), power(s)]
        return f"{GONE[g['mode']]} · {plan}", "The game", top, [crew_line, *awards]
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

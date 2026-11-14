"""The title and description a ride gets on Strava, from its saved summary."""

from typing import Any

SIGN_OFF = "Ridden on Cranky · cranky.life"


def clock(secs: float) -> str:
    s = round(secs or 0)
    return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def km(m: float | None) -> str:
    return f"{(m or 0) / 1000:.1f} km"


def describe(s: dict[str, Any], rider: str, link: str = "") -> tuple[str, str]:
    """(title, description) for one of `rider`'s saved rides. `link` is the postcard page, when it has one."""
    g = s.get("group") or {}
    crew = [r for r in g.get("riders", []) if isinstance(r, dict)]
    me = next((r for r in crew if r.get("id") == rider), {})
    plan = s.get("planName") or "Ride"
    secs = (s.get("record") or {}).get("secs") or 0
    power = f"NP {s.get('np', 0)} W · avg {s.get('avgPower', 0)} W"
    awards = [f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in g.get("awards", [])]
    names = ", ".join(r.get("name", "?") for r in crew)
    if g.get("mode") == "madness":
        title = f"🔥 VO2 Madness · {plan}"
        lines = [
            f"Crew score {g.get('score', 0)} · my effort points {round(me.get('points') or 0)}",
            f"{round(me.get('redSecs') or 0)} s in the red · {power}",
            f"Crew: {names}",
            *awards,
        ]
    elif g.get("mode") == "date":
        wed, div = g.get("married") or {}, g.get("divorced") or {}
        title = f"💘 Speed Dating · {round((me.get('match') or 0) * 100)}% compatible"
        flags = "; ".join(me.get("flags") or []) or "none, suspiciously"
        lines = [
            f"Chemistry {g.get('score', 0)} · {km(g.get('distance'))} · {power}",
            f"Best match: {me.get('best') or 'nobody'} · worst: {me.get('worst') or 'nobody'}",
            f"Red flags: {flags}",
            *([f"💒 {wed.get('a')} and {wed.get('b')} got married"] if wed else []),
            *([f"⚖️ {div.get('winner')} kept the house"] if div else []),
            f"Crew: {names}",
            *awards,
        ]
    elif g.get("mode") == "ambo":
        runs = [r for r in g.get("reviews", []) if isinstance(r, dict)]
        title = f"🚑 Kidney Stone Express · {g.get('delivered', 0)}/{len(runs)} patients delivered"
        lines = [
            f"Shift score {g.get('score', 0)} · {km(g.get('distance'))} · {power}",
            *(f"{r.get('icon', '')} {r.get('patient', '?')}: {'★' * int(r.get('stars') or 0)}" for r in runs),
            f"Me: {me.get('spread', 0)}% rough · {me.get('spikes', 0)} spikes · {me.get('fines', 0)} fines",
            f"Crew: {names}",
            *awards,
        ]
    elif g:
        gap = g.get("gap")
        fate = "survived" if (g.get("armour") or 0) > 0 else "caught"
        title = f"🧟 Zombie Bus · {plan} · {fate}" + (f" with a {gap} m gap" if gap is not None else "")
        on = me.get("inBandSecs")
        kj = [r.get("kj") for r in crew]
        share = me.get("kj") / sum(kj) if all(k is not None for k in kj) and sum(kj) else None
        lines = [
            f"Score {g.get('score', 0)} · {km(g.get('distance'))} · armour {round(g.get('armour') or 0)}%",
            f"Crew: {names}",
            *awards,
            "Me: "
            + " · ".join(
                x
                for x in (
                    f"NP {s.get('np', 0)} W",
                    f"on target {clock(on)} ({min(1, on / secs):.0%})" if on is not None and secs else "",
                    f"{share:.0%} of the crew's work" if share is not None else "",
                )
                if x
            ),
        ]
    elif s.get("route"):
        title = (
            f"{s['route'].get('name', 'Free ride')} · Cranky {'group ride' if s.get('crew') else 'free ride'}"
        )
        prs = sum(1 for x in s.get("segments") or [] if isinstance(x, dict) and x.get("pr"))
        lines = [
            f"{km(s.get('distance'))} · {round(s.get('ascent') or 0)} m climbed · {clock(secs)}",
            power,
            *([f"{prs} segment PR{'s' if prs > 1 else ''}"] if prs else []),
        ]
    else:
        title = f"💪 {plan} · Cranky workout"
        comp = s.get("compliance") or 0
        lines = [
            f"{clock(secs)} · {power}",
            f"TSS {s.get('tss', 0)} · IF {s.get('if', 0)}" + (f" · {comp:.0%} on plan" if comp else ""),
        ]
    return title, "\n".join([*lines, "", *([f"Postcard: {link}"] if link else []), SIGN_OFF])

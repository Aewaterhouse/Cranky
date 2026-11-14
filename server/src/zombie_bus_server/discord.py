"""Posts ride summaries to a Discord channel webhook (set ZB_DISCORD_WEBHOOK)."""

import json
import logging
import urllib.request

from . import config

log = logging.getLogger(__name__)


def format_summary(plan_name: str, s: dict) -> str:
    """Builds the chat message for a finished Zombie Bus ride."""
    if s.get("mode") == "madness":
        crew = ", ".join(f"{r['name']} {r['points']}" for r in s["riders"])
        return "\n".join(
            [
                f"🤯 **VO2 Madness** · {s['score']} effort points",
                *(f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in s["awards"]),
                f"Pack: {crew}",
            ]
        )
    if s.get("mode") == "date":
        wed, div = s.get("married"), s.get("divorced")
        return "\n".join(
            [
                f"💘 **Speed Dating** · chemistry **{s['score']}**",
                *([f"💒 {wed['a']} and {wed['b']} got married"] if wed else []),
                *([f"⚖️ {div['winner']} kept the house; {div['loser']} kept the tandem"] if div else []),
                *(f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in s["awards"]),
                *(f"🚩 {r['name']}: {'; '.join(r['flags'])}" for r in s["riders"] if r.get("flags")),
            ]
        )
    if s.get("mode") == "ambo":
        return "\n".join(
            [
                f"🚑 **Kidney Stone Express** · {s['delivered']}/{len(s['reviews'])} patients"
                f" · score **{s['score']}**",
                *(
                    f"{r['icon']} {'★' * r['stars']}{'☆' * (5 - r['stars'])} {r['text']}"
                    for r in s["reviews"]
                ),
                *(f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in s["awards"]),
            ]
        )
    crew = ", ".join(f"{r['name']} {r['compliance']:.0%}" for r in s["riders"])
    lines = [
        f"🧟 **Zombie Bus** · {plan_name} · score **{s['score']}**",
        f"{s['distance'] / 1000:.1f} km · armour {s['armour']} · sync {s['syncPct']}% · {s['scrap']} scrap",
        *(f"🏆 {a['award']}: {a['name']} ({a['why']})" for a in s["awards"]),
        f"Crew: {crew}",
    ]
    return "\n".join(lines)


def post(text: str) -> None:
    """Sends `text` to the webhook. Never raises: a chat failure must not break a ride."""
    if not config.DISCORD_WEBHOOK:
        return
    req = urllib.request.Request(
        config.DISCORD_WEBHOOK,
        data=json.dumps({"content": text[:1900]}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "cranky"},
    )
    try:
        urllib.request.urlopen(req, timeout=10).close()
    except Exception as e:  # noqa: BLE001
        log.warning("Discord post failed: %s", e)

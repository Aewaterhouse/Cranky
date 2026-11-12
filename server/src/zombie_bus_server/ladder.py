"""Season ladder: the crew's bus rides ranked per calendar quarter."""

from collections import Counter, defaultdict
from datetime import date

TITLES = {
    "Iron Lungs": "Metronome of the Season",
    "Roadblock MVP": "Wrecking Ball",
    "Sync Master": "Human Cadence Sensor",
    "PR Hunter": "Record Botherer",
    "Fell Off King": "Road Rash Royalty",
}


def season_of(d: date) -> str:
    """Season id such as '2026-Q4'."""
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def bounds(season: str) -> tuple[str, str]:
    """ISO start (inclusive) and end (exclusive) dates of a season id."""
    year, q = int(season[:4]), int(season[-1])
    end = (year + 1, 1) if q == 4 else (year, q * 3 + 1)
    return f"{year}-{q * 3 - 2:02d}-01", f"{end[0]}-{end[1]:02d}-01"


def build(season: str, results: list[dict]) -> dict:
    """Top runs, a per-rider table and the season's titles from raw bus results."""
    runs = sorted(results, key=lambda r: -r["score"])[:20]
    riders: dict[str, dict] = defaultdict(lambda: {"rides": 0, "best": 0, "comp": 0.0, "awards": 0})
    awards: dict[str, Counter] = defaultdict(Counter)
    for res in results:
        for r in res["riders"]:
            if r.get("bot"):
                continue
            row = riders[r["name"]]
            row["rides"] += 1
            row["best"] = max(row["best"], res["score"])
            row["comp"] += r["compliance"]
        humans = {r["name"] for r in res["riders"] if not r.get("bot")}
        for a in res["awards"]:
            if a["name"] in humans:
                awards[a["award"]][a["name"]] += 1
                riders[a["name"]]["awards"] += 1
    table = [
        {
            "name": n,
            "rides": r["rides"],
            "best": r["best"],
            "compliance": round(r["comp"] / r["rides"], 3),
            "awards": r["awards"],
        }
        for n, r in riders.items()
    ]
    table.sort(key=lambda r: (-r["best"], -r["rides"]))
    titles = [
        {"title": TITLES[a], "award": a, "name": c.most_common(1)[0][0], "count": c.most_common(1)[0][1]}
        for a, c in awards.items()
        if a in TITLES
    ]
    return {
        "season": season,
        "runs": [
            {
                "date": r["date"],
                "plan": r["plan"],
                "score": r["score"],
                "difficulty": r.get("difficulty", "normal"),
                "distance": r["distance"],
                "crew": [x["name"] for x in r["riders"]],
            }
            for r in runs
        ],
        "riders": table,
        "titles": titles,
    }

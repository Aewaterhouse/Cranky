"""Bot settings, read from environment variables (and bot/.env if present)."""

import os
from pathlib import Path

_env = Path(__file__).with_name(".env")
if _env.exists():
    for line in _env.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
IDEAS_CHANNEL_ID = int(os.getenv("IDEAS_CHANNEL_ID") or 0)
TEAM_ROLE = os.getenv("TEAM_ROLE", "Crew")
GITHUB_REPO = os.getenv("GITHUB_REPO", "Aewaterhouse/Cranky")
VOTES_NEEDED = int(os.getenv("VOTES_NEEDED", "2"))
VOTE_EMOJI = os.getenv("VOTE_EMOJI", "👍")
DONE_EMOJI = os.getenv("DONE_EMOJI", "✅")
LABELS = ("idea", "agent-ready")
TITLE_MAX = 80

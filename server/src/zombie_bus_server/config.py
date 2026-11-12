"""All server tunables in one place. Game numbers are first-pass guesses; see docs/decisions.md."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "content"
CLIENT_DIST = ROOT / "client" / "dist"
DB_PATH = Path(os.environ.get("ZB_DB", ROOT / "server" / "zombie_bus.db"))

TICK_HZ = 2
TIME_SCALE = float(os.environ.get("ZB_TIME_SCALE", "1"))
COUNTDOWN_S = 5
ROOM_IDLE_S = 600
STALE_DATA_S = 3.0  # real seconds without data before a rider reads as zero power

TIER_FACTOR = {"hard": 1.0, "medium": 0.9, "easy": 0.8}
TIERS = ["hard", "medium", "easy"]

# Rider states
FELL_COMPLIANCE = 0.6
FELL_AFTER_S = 30
FELL_COOLDOWN_S = 60
HAUL_S = 20
HAUL_MIN = 0.85
HAUL_SCRAP = 30
SPECTATOR_NO_POWER_S = 60

# Cadence sync
SYNC_RPM = 5
SYNC_HOLD_S = 8
SYNC_MIN_CADENCE = 30
TUNE_MULT = 1.25

# Bus and horde. Gap changes at GAP_K * (group compliance - neutral) m/s; neutral depends on the event.
V_MIN = 6.0
V_MAX = 20.0
LIMP_MULT = 0.6
GAP_K = 15.0
NEUTRAL = {"warmup": 0.5, "cooldown": 0.5, "servo": 0.3, "longhaul": 0.8, "surge": 0.85, "roadblock": None}
LONGHAUL_CREEP = 0.02  # neutral rises per minute into a long haul
LONGHAUL_CREEP_MAX = 0.1
SURGE_UNDER_NEUTRAL = 0.95
SURGE_GRAB = 12
SHAKE_COMPLIANCE = 0.8
SHAKE_GAP = 15
SHAKE_SCRAP = 5
TUNE_GAP_BONUS = 1.0
GAP_START = 50
GAP_MAX = 120
HIT_DAMAGE = 5
HIT_KNOCKBACK = 25
SCRAP_PER_M = 1 / 100

# Roadblock
RB_HP_PER_RIDER = 40
RB_DAMAGE = {"FAIL": 0, "HIT": 40, "GREAT": 80, "MEGA": 100, "LEGEND": 120}
RB_SCRAP = {"FAIL": 0, "HIT": 2, "GREAT": 10, "MEGA": 25, "LEGEND": 50}
RB_FAIL_ARMOUR = 6
RB_FAIL_GAP = 10
RB_SMASH_SCRAP = 20
RB_SMASH_GAP = 20
RB_CRASH_ARMOUR = 10
RB_GRACE_S = 4
COMBO_STEP = 0.25

# Servo Stop session shop (costs in bus scrap)
SHOP = {"plating": 40, "repellent": 60, "sync": 50}
PLATING_ARMOUR = 25
SYNC_WIDEN_RPM = 3

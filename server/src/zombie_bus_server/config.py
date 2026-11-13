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
MAX_RIDERS = 6
ROOM_IDLE_S = 600
DISCORD_WEBHOOK = os.environ.get("ZB_DISCORD_WEBHOOK", "")
BACKUP_DIR = Path(os.environ.get("ZB_BACKUPS", DB_PATH.parent / "backups"))
BACKUP_EVERY_S = 24 * 3600
BACKUP_KEEP = 14
ROOM_RESUME_MAX_AGE_S = 900  # a snapshot older than this is dropped at startup
SNAPSHOT_S = 5  # real seconds between snapshots of a running room
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
NEUTRAL = {
    "warmup": 0.5,
    "cooldown": 0.5,
    "servo": 0.3,
    "longhaul": 0.8,
    "rampup": 0.82,
    "surge": 0.85,
    "roadblock": None,
}
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

# Difficulty: shifts every event's neutral compliance, scales armour damage and the final score.
DIFFICULTY = {
    "easy": {"neutral": -0.08, "damage": 0.6, "score": 0.8},
    "normal": {"neutral": 0.0, "damage": 1.0, "score": 1.0},
    "hard": {"neutral": 0.05, "damage": 1.3, "score": 1.25},
    "nightmare": {"neutral": 0.1, "damage": 1.7, "score": 1.6},
}

# Nitro: near-perfect group riding charges it; when full it fires by itself.
NITRO_MIN = 0.95  # group compliance needed to charge
NITRO_CHARGE_S = 75  # seconds of charging to fill
NITRO_DECAY_S = 150  # seconds to drain when the crew is below NITRO_MIN
NITRO_S = 15  # boost length
NITRO_SPEED = 1.3
NITRO_GAP = 2.5  # extra m/s of gap while boosting
NITRO_SCRAP = 15
NITRO_EVENTS = ("longhaul", "rampup", "surge")

# Streak rewards: unbroken clean group riding earns air support, in order, then the streak starts again.
STREAK_MIN = 0.9  # group compliance that keeps the streak alive
STREAK_GRACE_S = 3  # seconds under STREAK_MIN before the streak resets
STREAK_EVENTS = NITRO_EVENTS  # the streak holds (no gain, no reset) in every other event
STREAKS = [(45, "drop"), (90, "airstrike"), (150, "gunship")]  # streak seconds needed, reward
DROP_SCRAP = 15
AIRSTRIKE_GAP = 15  # metres of gap, at once
GUNSHIP_S = 20
GUNSHIP_GAP = 2.0  # extra m/s of gap while the gunship is up

# VO2 Madness: mystery-box VO2 intervals for the whole pack, scored on heart-rate effort.
MAD_MINUTES = 40  # session length when the host has not picked one
MAD_WARM_S = (300, 600)  # warm-up ramp, about 15% of the session inside these limits
MAD_COOL_S = (180, 420)  # cool-down, about 10% of the session
MAD_REST_PCT = 50
MAD_BOX_S = 10  # the mystery box opens this long before the interval starts
MAD_TWIST_CHANCE = 0.6
# The deck: each card is one VO2 interval with its recovery. Work and recovery are roughly 1:1.
MAD_DECK = [
    {"name": "Three-Minute Monster", "rest": 180, "blocks": [{"type": "steady", "dur": 180, "pct": 110}]},
    {"name": "Two-Minute Terror", "rest": 120, "blocks": [{"type": "steady", "dur": 120, "pct": 115}]},
    {"name": "Rocket Minute", "rest": 90, "blocks": [{"type": "steady", "dur": 60, "pct": 125}]},
    {
        "name": "30/30 Mayhem",
        "rest": 150,
        "blocks": [{"type": "over-under", "dur": 240, "step": 30, "pct": [125, 55]}],
    },
    {
        "name": "40/20 Meltdown",
        "rest": 150,
        "blocks": [
            {"type": "steady", "dur": 40 if k % 2 == 0 else 20, "pct": 120 if k % 2 == 0 else 50}
            for k in range(8)
        ],
    },
    {"name": "Ramp of Doom", "rest": 150, "blocks": [{"type": "ramp", "dur": 150, "pct": [95, 125]}]},
    {
        "name": "Stairway to Hell",
        "rest": 180,
        "blocks": [{"type": "steady", "dur": 60, "pct": p} for p in (105, 112, 120)],
    },
    {"name": "Mystery Sprint", "rest": 75, "weight": 0.6, "blocks": [{"type": "sprint", "dur": 15}]},
]
# Twists: (name, what it does). Dealt with some rounds and applied to that round's scoring.
MAD_TWISTS = {
    "double": ("Double Points", "Everything scores twice."),
    "redline": ("Redline Bonus", "Extra points every second over 90% of max."),
    "sync": ("Hive Mind", "Match cadence as a pack for half as much again."),
    "underdog": ("Underdog", "Last place scores triple."),
    "tax": ("Leader Tax", "First place scores half."),
}
MAD_ZONES = (0.6, 0.7, 0.8, 0.9)  # heart-rate zone edges as fractions of max
MAD_ZONE_PTS = (0, 1, 2, 4, 7)  # points per second in each zone during an interval
MAD_NO_HR_PTS = 3  # riders without a strap or a max heart rate score this flat rate
MAD_REDLINE_PTS = 5
MAD_SPRINT_PTS = {"FAIL": 0, "HIT": 20, "GREAT": 40, "MEGA": 70, "LEGEND": 100}
MAD_CROWN_PTS = 1  # extra points per second for wearing the crown
MAD_CROWN_MIN = 0.75  # nobody is "trying hardest" below this
MAD_CROWN_MARGIN = 0.02  # a challenger must beat the holder by this much...
MAD_CROWN_HOLD_S = 4  # ...for this long
MAD_LEAD_MIN = 50  # points before lead changes are called
MAD_SANDBAG = (0.7, 0.82)  # called out under the first while the rest average over the second
MAD_SANDBAG_S = 20
MAD_SANDBAG_COOL_S = 90
MAD_SPEED = (5.0, 14.0)  # pack speed in m/s at zero and full compliance

# Personal challenges: a quick cadence drill for one human rider during long hauls and ramp-ups.
CHALLENGE_EVERY_S = (150, 240)  # random wait between challenges
CHALLENGE_S = 20
CHALLENGE_PASS = 0.7  # fraction of the window that must be on the cadence target
CHALLENGE_SCRAP = 12
CHALLENGES = {"spin": (105, "spin it up! 105+ rpm"), "grind": (65, "big gear! 65 rpm or lower")}
CHALLENGE_EVENTS = ("longhaul", "rampup")

# Weekly mutator: one twist per ISO week, applied to every bus ride above easy difficulty.
# Keys: damage (x), scrap (x distance scrap), armour (starting armour), nitro (x charge rate), no_shop.
MUTATORS = [
    {
        "id": "hungry",
        "name": "Hungry Horde",
        "desc": "Every hit takes half as much armour again.",
        "damage": 1.5,
    },
    {"id": "closed", "name": "Closed Servos", "desc": "The servo shop stays shut all ride.", "no_shop": True},
    {"id": "rush", "name": "Scrap Rush", "desc": "Double scrap for distance.", "scrap": 2.0},
    {"id": "bolts", "name": "Loose Bolts", "desc": "The bus starts on 70 armour.", "armour": 70},
    {"id": "tailwind", "name": "Tailwind", "desc": "Nitro charges twice as fast.", "nitro": 2.0},
]

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

# Accounts seeded at startup. Password is the name (case-insensitive) — friends-only hobby server.
SEED_USERS = ["Alex", "Luke", "Steve", "Angus", "Ali", "Jack", "Kat"]
ADMINS = ["alex"]  # rider ids who can add, remove and reset riders
NAME_MAX = 20

# Bots: NPC riders that fill empty seats. Seeded per bot from the room code and bot id.
BOT_NAMES = ["Dazza", "Shazza", "Bluey", "Robbo", "Kev"]
BOT_FTP = (200, 260)
BOT_LOOKS = {
    "hat": ["hat-cap", "hat-cone", "hat-viking"],
    "outfit": ["outfit-hivis", "outfit-purple", "outfit-black"],
}
BOT_COMP = (0.85, 1.0)  # compliance wanders slowly inside this band
BOT_COMP_WALK = 0.01  # std dev of the random walk per tick
BOT_BAD_PER_S = 1 / 600  # chance per second of starting a bad patch
BOT_BAD_COMP = (0.4, 0.58)  # compliance in a bad patch (under FELL_COMPLIANCE, so they can fall off)
BOT_BAD_S = (30, 50)  # bad patch length in session seconds
BOT_POWER_JITTER = 0.03  # power is target x (1 +/- this)
BOT_CAD_DEFAULT = 88
BOT_CAD_JITTER = 3  # rpm either side of the human median
BOT_SPRINT_X = (2.5, 3.5)  # sprint power as a multiple of FTP
BOT_HR_MAX = 190  # bots fake a heart rate so the crew's effort read-outs have something to show
BOT_HR_REST = 0.45  # fraction of max at zero power
BOT_HR_AT_FTP = 0.9  # fraction of max at FTP
BOT_HR_LAG_S = 30
BOT_IDLE_X = 0.5  # power as a fraction of FTP when ERG is off outside a sprint
BOT_GRADES = {"FAIL": 10, "HIT": 45, "GREAT": 35, "MEGA": 9, "LEGEND": 1}

# Road rides (free ride together). The physics and route numbers mirror `freeRide` and `road` in
# client/src/config.ts; content/tests/road-vectors.json is run by both test suites and fails if either drifts.
ROAD_TICK_HZ = 4
ROAD_COUNTDOWN_S = 10  # longer than the bus's: the road world takes a few seconds to load
ROAD_MAX_RIDERS = 8
ROAD_DEFAULT_KG = 75
ROAD_BIKE_KG = 9
ROAD_CRR = 0.004
ROAD_CDA = 0.32
ROAD_RHO = 1.225
ROAD_DRIVETRAIN = 0.975
ROAD_MAX_MS = 22
ROAD_MAX_DRIVE_N = 600
ROAD_CORNER_LAT_MS2 = 7
ROAD_CORNER_MIN_MS = 5.5
ROAD_BRAKE_MS2 = 2.5
ROAD_MAX_BRAKE_MS2 = 4
ROAD_CORNER_STEP_M = 5
ROAD_SPACING_M = 10
ROAD_SMOOTH_M = 100
ROAD_MAX_GRADE_PCT = 20
ROAD_MAX_STORED = 4000
ROAD_SMOOTH_PASSES = 2
ROAD_UTURN_SHIFT_M = 3.5
ROAD_UTURN_BULB_M = 12
ROAD_LAPS_MAX = 99
ROAD_LAPS_MAX_M = 300_000
ROAD_DEFAULT_ROUTE = "nundah-crit"
ROAD_DEFAULT_LAPS = 3
# Drafting: the CdA saving on a wheel, full inside DRAFT_FULL_M and fading to nothing at DRAFT_REACH_M. Each
# extra rider ahead within DRAFT_BUNCH_M adds DRAFT_BUNCH_X of it, up to DRAFT_CAP. Nobody drafts a rider
# slower than DRAFT_MIN_MS.
DRAFT_WHEEL = 0.27
DRAFT_FULL_M = 2.0
DRAFT_REACH_M = 10.0
DRAFT_BUNCH_M = 20.0
DRAFT_BUNCH_X = 0.15
DRAFT_CAP = 0.4
DRAFT_MIN_MS = 3.0
# Keep-together: distance covered is scaled by up to BAND_MAX either way, by how far the rider is from the
# middle of the group; nothing inside BAND_DEAD_M, all of it by BAND_FULL_M. The physics speed is untouched.
BAND_MAX = 0.2
BAND_DEAD_M = 15.0
BAND_FULL_M = 150.0
ROAD_LANES = (-2.3, -1.1)  # two abreast, in metres right of the centre line (we ride on the left)
ROAD_LATE_GAP_M = 5.0  # a late joiner starts this far behind the last rider still moving
ROAD_FINISH_GRACE_S = 600  # the ride ends this long after the first rider finishes, whoever is still out
ROAD_ABANDON_S = 600  # or after this many ride seconds with no human connected
ROAD_STOPPED_MS = 0.5  # slower than this reads as stopped
# Road bots: (name, personality, kg, fitness, one-liner). Their FTP is the humans' median W/kg times their own
# weight and fitness, so they ride with the people in the room. ROAD_BOT_X is the fraction of that FTP each
# personality holds (`x`) and what it does instead when its moment comes.
ROAD_BOT_WKG = 3.0  # assumed W/kg when no human has a weight and FTP to copy
ROAD_BOT_JITTER = 0.04
ROAD_BOT_CAD = 88
ROAD_BOTS = [
    ("Diesel Dave", "diesel", 84, 1.0, "Sits on the same watts all day. Has never once looked back."),
    ("Surging Shaz", "surger", 62, 1.02, "Attacks, regrets it, recovers, attacks again."),
    ("Mountain Goat Mick", "climber", 58, 1.05, "Weighs nothing. Waits for the hill, then leaves."),
    ("Sprinter Trev", "sprinter", 88, 0.97, "Does no work until the sign. Then does all of it."),
    ("Wheelsucker Wozza", "sucker", 76, 0.95, "Will do a turn next lap. He promises."),
]
ROAD_BOT_X = {
    "diesel": {"x": 0.8},
    "surger": {"x": 0.7, "surge_x": 1.2, "surge_s": 20, "every_s": 90},
    "climber": {"x": 0.72, "climb_x": 1.0, "climb_pct": 3.0},
    "sprinter": {"x": 0.72, "sprint_x": 2.2, "sprint_m": 300},
    "sucker": {"x": 0.84, "sit_x": 0.66},
}

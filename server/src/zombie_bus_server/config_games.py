"""Numbers for the scripted crew games. Bands are (low, high) as fractions of FTP; times are seconds."""

# --- Kidney Stone Express (`ambo`) ---
AMBO_BASE_S = 360  # base station warm-up
AMBO_RUN_S = 300  # each patient run
AMBO_RAMP_S = 90  # the slot between runs: the whole of it in the queue after a bad run
AMBO_RAMP_GOOD_S = 45  # queue after a good run; the rest of the slot is rolling to the next job
AMBO_COOL_S = 240  # the drive home
AMBO_BASE = (0.55, 0.75)
AMBO_QUEUE = (0.40, 0.55)  # ramping in the hospital queue
AMBO_ROLL = (0.55, 0.70)  # rolling to the next job, or driving on with nobody in the back
AMBO_COOL = (0.40, 0.55)
AMBO_BRAKE = (0.50, 0.65)  # the braking zone before the hospital doors
AMBO_REVERSE = (0.45, 0.55)  # reversing for a patient who fell out
AMBO_KMH_AT_FTP = 80.0  # the ambulance's speed with the whole crew at FTP
AMBO_SMOOTH_S = 3.0  # each rider's power is smoothed over about this long for speed and roughness
AMBO_BRAKE_S = 15  # the braking zone is the distance this long takes at the braking band
AMBO_DOORS_MAX = 0.70  # team average over this at the doors and the patient falls out the back
AMBO_REVERSE_S = 30
AMBO_FALL_COMFORT = 20  # Comfort lost when the patient falls out
AMBO_GRACE_S = 5.0  # after a rider's band moves, their roughness is forgiven this long
AMBO_ROUGH_RATE = 15.0  # Comfort a second per FTP of jerk past the patient's tolerance (crew mean)
AMBO_OUT_RATE = 8.0  # Comfort a second per FTP outside the band, past the dead band
AMBO_OUT_DEAD = 0.03
AMBO_REFILL = 0.4  # Comfort a second back while nobody is rough or out of band
AMBO_SPIKE = 0.12  # jerk over this share of FTP counts as one spike against the rider
AMBO_GOOD_COMFORT = 60  # a run this comfortable, with nobody falling out, is a good one
AMBO_SWEET_S = 20  # seconds of the whole crew spinning easy to sweet-talk triage
AMBO_SWEET_RPM = 90
AMBO_SWEET_MAX = 0.60  # and nobody over this share of FTP while they do it
AMBO_PERK_S = 5.0  # a free spike forgives roughness for this long once it is needed
AMBO_EARLY = (0.004, 0.2)  # time bonus per second early, and the most it can be
AMBO_LATE = (0.01, 0.5)  # time penalty per second late, and the most it can be
AMBO_SCORE_X = 10  # points per point of Comfort x time
AMBO_STARS = (25, 50, 70, 90)  # run score (Comfort x time, out of 100) needed for 2, 3, 4 and 5 stars
AMBO_FELL_STARS = 2  # the most stars a patient who fell out will give
AMBO_LINE_S = 12  # the patient says something new this often

# lead: one stretch before the pattern starts; cycle: repeated until the braking zone. tol: jerk forgiven
# (share of FTP); strict: multiplies every Comfort loss; events: what the road can throw on this run.
AMBO_PATIENTS = {
    "hook": {
        "name": "Fishing Hook in Thumb",
        "icon": "🎣",
        "cycle": [(300, 0.70, 0.82)],
        "tol": 0.15,
        "strict": 0.4,
        "events": ("green", "roadworks", "hump", "siren"),
    },
    "kidney": {
        "name": "Kidney Stone",
        "icon": "🪨",
        "cycle": [(300, 0.83, 0.87)],
        "tol": 0.06,
        "strict": 2.0,
        "events": ("roadworks", "hump", "siren"),
    },
    "magpie": {
        "name": "Magpie Victim",
        "icon": "🐦",
        "lead": (25, 0.70, 0.80),
        "cycle": [(20, 0.95, 1.05), (45, 0.72, 0.82)],
        "tol": 0.10,
        "strict": 1.0,
        "events": ("green", "hump", "siren"),
    },
    "bin": {
        "name": "Wheelie Bin Jump",
        "icon": "🗑️",
        "lead": (15, 0.60, 0.70),
        "cycle": [(30, 1.00, 1.10), (30, 0.50, 0.60)],
        "tol": 0.10,
        "strict": 1.0,
        "events": ("green", "hump", "siren"),
    },
    "trainer": {
        "name": "Man Who Tried to Fix His Own Trainer",
        "icon": "🔧",
        "lead": (25, 0.65, 0.75),
        "cycle": [(60, 1.07, 1.13), (40, 0.55, 0.65)],
        "tol": 0.10,
        "strict": 1.2,
        "events": ("roadworks", "hump", "siren"),
    },
}
AMBO_FIRST = "hook"  # the easiest patient always goes first; the rest are shuffled

# Road events. dur: seconds each lasts (the hump's first half is the 3-2-1).
AMBO_EVENT_S = {"say": 0, "green": 20, "roadworks": 25, "hump": 6, "siren": 10}
AMBO_GREEN = (0.95, 1.10)
AMBO_GREEN_AT = 0.92  # a rider counts as on the wave over this share of FTP
AMBO_GREEN_NEED = 0.7  # share of the wave the crew must be on it
AMBO_GREEN_M = 200  # metres gained catching the wave; half that lost sitting at the red
AMBO_ROADWORKS = (0.45, 0.60)
AMBO_FINE_OVER = 0.64  # over this in the roadworks, once the grace is up, is a speeding fine
AMBO_FINE_COMFORT = 6  # Comfort a fine costs
AMBO_HUMP = (0.0, 0.15)
AMBO_HUMP_MAX = 0.20  # everyone must be under this at the same moment over the hump
AMBO_HUMP_COMFORT = 15  # Comfort lost when the patient bounces
AMBO_SIREN_NEED = 1.2  # the siren rider's mean share of FTP to clear the car
# Bot characters, dealt by the bot's place in BOT_NAMES: smooth rides dead on its target, twitchy spikes
# now and then, lead foot ignores the roadworks.
AMBO_BOTS = ("smooth", "twitchy", "leadfoot")
AMBO_TWITCH_PER_S = 0.04
AMBO_TWITCH_X = 1.3
AMBO_LEADFOOT_X = 0.75
AMBO_SIREN_M = 150  # metres gained when the car pulls over, lost when it does not

# --- Speed Dating (`date`) ---
DATE_BAR_S = 480  # The Bar: warm-up and profiles
DATE_DATE_S = 180
DATE_GAP_S = 60  # walking to the next table
DATE_PROPOSAL_S = 240
DATE_LEG_S = 120  # each wedding leg, and the divorce between them
DATE_COOL_S = 180
DATE_MIN_RIDERS = 4  # bots fill the bar to this many
DATE_BAR = (0.55, 0.75)
DATE_GAP = (0.50, 0.65)
DATE_CHAP = (0.60, 0.75)  # the Chaperone's own riding while the couples date
DATE_COOL = (0.45, 0.60)
# Each theme: its band, and its prompt if it has one. A prompt's `at` are seconds into the date; `every` puts
# one at a random moment in each window that long; `n` scatters that many through the middle of the date.
DATE_THEMES = {
    "coffee": {"name": "Coffee", "icon": "☕", "band": (0.65, 0.75)},
    "dinner": {"name": "Dinner", "icon": "🍝", "band": (0.80, 0.90)},
    "parents": {
        "name": "Meeting the Parents",
        "icon": "👨‍👩‍👧",
        "band": (0.82, 0.88),
        "prompt": {"k": "surge", "band": (1.00, 1.10), "secs": 8, "every": 30},
    },
    "ikea": {
        "name": "Ikea",
        "icon": "📦",
        "band": (0.60, 0.70),
        "prompt": {"k": "effort", "band": (1.05, 1.15), "secs": 30, "at": (20, 80, 140)},
    },
    "moving": {"name": "Moving In", "icon": "🏠", "band": (0.90, 0.95)},
    "ex": {
        "name": "The Ex Shows Up",
        "icon": "😱",
        "band": (0.75, 0.85),
        "prompt": {"k": "sprint", "band": "sprint", "secs": 15, "n": 1},
    },
}
DATE_ORDER = ("coffee", "dinner", "parents", "ikea", "moving", "ex")
DATE_MATCH_FULL = 0.02  # within this share of FTP of each other is a full match
DATE_MATCH_NONE = 0.10  # this far apart is none
DATE_BAND_TOL = 0.01  # a couple scores only with both inside the band, give or take this
DATE_PTS_S = 1.0  # points a second at a full match
DATE_SMOOTH_S = 3.0  # the match shown on screen is smoothed over about this long
DATE_SPARK = (0.9, 20)  # a match over this for this many seconds is "a match" (once a date)
DATE_REACT_PTS = 15  # for reacting to a prompt at the same instant, falling to nothing at the gap below
DATE_REACT_MAX_S = 4.0
DATE_REACT_UNDER = 0.03  # a rider has reacted once within this of the prompt's band
DATE_SPRINT_AT = 1.2  # and to a sprint once over this share of FTP
DATE_EVENT_S = {"say": 0, "card": 15, "confetti": 10}
DATE_MS_AT_FTP = 10.0  # the pack's speed with everyone at FTP

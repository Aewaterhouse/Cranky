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
DATE_DRIFT = (
    15,
    60,
)  # a dater out of band this long while their date holds it is named, at most once this often
DATE_REACT_PTS = 15  # for reacting to a prompt at the same instant, falling to nothing at the gap below
DATE_REACT_MAX_S = 4.0
DATE_REACT_UNDER = 0.03  # a rider has reacted once within this of the prompt's band
DATE_SPRINT_AT = 1.2  # and to a sprint once over this share of FTP
DATE_EVENT_S = {"say": 0, "card": 15, "confetti": 10}
DATE_MS_AT_FTP = 10.0  # the pack's speed with everyone at FTP
DATE_EMOJI = ["😍", "😬", "🔥", "🐢", "🚀", "🙈"]
DATE_EMOJI_N = 5  # emoji a rider may send on each date
DATE_PROFILE_S = 90  # how long into The Bar a rider may pick a profile
# Chaperone cards: the band the target gets. `both`: it lands on the couple, not one of them.
DATE_CARDS = {
    "ex": {"name": "Your ex just texted", "icon": "📱", "band": (1.05, 1.15), "both": False},
    "check": {"name": "Check's here", "icon": "🧾", "band": (0.50, 0.60), "both": False},
    "ring": {"name": "Is that a ring?", "icon": "💍", "band": (0.95, 1.05), "both": True},
}
DATE_CARD_S = 15
DATE_PROPOSAL = (0.88, 0.94)  # the two couples riding off for the ring
DATE_TEMPO = (0.76, 0.86)  # everyone else during the proposal
DATE_TANDEM = 0.95  # the wedding tandem's target: this share of the couple's summed FTP
DATE_TANDEM_BAND = (0.85, 1.05)  # each of them rides in here; the sum is what is judged
DATE_TANDEM_TOL = 0.05  # the tandem is "held" within this of its target
DATE_GUEST = (0.55, 0.70)
DATE_CONFETTI = (0.97, 1.05)  # guests throwing confetti
DATE_WATCH = (0.50, 0.65)  # everyone not in the divorce
DATE_TUG_RATE = 0.06  # rope (0 to 1) a second for each FTP of difference between the exes
DATE_BOTS = ("clingy", "aloof", "chaotic")  # by the bot's place in BOT_NAMES
DATE_CLING = 0.7  # how much of a clingy bot's power is copied from its date
DATE_CHAOS = 0.12  # how far a chaotic bot wanders from its target
DATE_BOT_EMOJI_PER_S = 0.03
DATE_CHAT_MAX = 36  # lines of leaked chat

# --- Climate Lawsuit ---------------------------------------------------------------------------------------
CLIM_EIGHTIES_S = 480  # warm-up: everyone on coal
CLIM_DECADE_S = 420
CLIM_DECADES = ("1990s", "2000s", "2010s", "2020s")
CLIM_TRIAL_S = 300
CLIM_COOL_S = 240
CLIM_CHOOSE_S = 30  # the fuel question opens this long before each decade
CLIM_MIN_RIDERS = 4  # bots fill the town to this many companies
CLIM_MS_AT_FTP = 10.0
# Each fuel: its band (share of FTP), coins a second at FTP while earning, tonnes a second at FTP.
CLIM_FUELS = {
    "coal": {"band": (0.60, 1.00), "rate": 0.12, "emit": 1.0},
    "gas": {"band": (0.70, 0.90), "rate": 0.096, "emit": 0.5},
    "solar": {"band": (0.85, 0.90), "rate": 0.144, "emit": 0.1},
    "wind": {"band": (0.55, 0.65), "rate": 0.0, "emit": 0.0},
}
CLIM_EARN_MIN = 0.3  # coal and gas earn over this share of FTP
CLIM_SOLAR_SLACK = 0.01  # solar still earns this close outside its band
CLIM_COST = {"gas": 20, "solar": 35, "wind": 45}  # coins to leave coal for this fuel in the 1990s
CLIM_COST_FALL = (1.0, 0.8, 0.6, 0.45)  # price by decade: early adopters pay up front
CLIM_GUST = {"every": 75, "secs": 15, "band": (1.05, 1.15), "pay": 14}  # wind: big payout per gust held
CLIM_SURGE = {"every": 120, "secs": 20, "band": (1.00, 1.10), "pay": 8}  # gas: bonus per surge held
CLIM_CUE_HELD = 0.97  # mean share of FTP over a gust or surge that counts as holding it
CLIM_FLOOD_T = 1340  # tonnes per company that put the town under (level 1)
CLIM_STAGES = (0.15, 0.40, 0.65, 1.0)  # sea level at which the beach, surf club, Main Street, everything go
CLIM_STAGE_NAMES = ("", "Beach", "Surf club", "Main Street", "Everything")
CLIM_WALL_STEP = 0.08  # a seawall knocks the sea back this much
CLIM_WALL_COST = (30, 15)  # the first seawall's price and how much dearer each one after is
CLIM_HEAT = {"band": (0.95, 1.05), "need": 0.9}  # heatwave: crew mean under `need` blacks out the town
CLIM_KETTLE = {"band": (1.10, 1.20), "need": 1.05}  # State of Origin half time
CLIM_BLACKOUT = 15  # coins every company loses in a blackout
CLIM_MINER = {"x": 1.05, "pay": 1.25}  # bitcoin miner: targets and profits for the rest of the decade
CLIM_BRIBE = 60  # the lobbyist's envelope
CLIM_BRIBE_S = 45  # how long the envelope sits on the table
CLIM_EVENT_S = {"say": 0, "heat": 120, "kettle": 30, "miner": 0, "lobby": 0}
CLIM_EASY = (0.50, 0.62)  # jury, Trial voting and sentencing spectators
CLIM_VOTE_S = 60  # the jury votes for this long at the start of the Trial
CLIM_DOCK_S = 180  # then the defendants ride the chosen effort this long
CLIM_TARGETS = ("90", "100", "105")  # the jury's options, % FTP
CLIM_DOCK_HALF = 0.04  # the defendant's band is the target ± this share of FTP
CLIM_ACQUIT = 0.8  # share of the dock held for an acquittal on a technicality
CLIM_SERVICE = {"band": (0.97, 1.03), "secs": 120}  # community service at sentencing
CLIM_SASH_DAYS = 30
CLIM_BOTS = ("baron", "greenie", "fence")  # by the bot's place in BOT_NAMES
CLIM_BOT_ASK_S = (3, 12)  # a bot answers a question after this many seconds

# Watch party: queue length, the biggest remote jump, and a pretend speed for the results' distance.
WATCH_QUEUE_MAX = 20
WATCH_SEEK_MAX = 600
WATCH_SPEED = 8.0
WATCH_EMOJI = ("😂", "🔥", "😱", "👏", "🥵", "💀")  # reactions anyone can float over the video

# Scrap a game adds to the bus rate for distance (`common.crew_scrap`) for how it went.
SCRAP_PER_PATIENT = 20
SCRAP_WEDDING = 50
SCRAP_TOWN_SAVED = 100
AMBO_NAG_S = 60  # a rider is told about a spike at most once a minute
AMBO_CREDIT_COMFORT = 60  # a run delivered at this Comfort or more credits its smoothest rider

# Weekly twists for the crew games, one per ISO week like the bus MUTATORS, shown in the lobby. Kidney Stone:
# rough (x Comfort lost to rough riding). Speed Dating: emoji (x emoji each dater gets per date).
GAME_MUTATORS = {
    "ambo": [
        {
            "id": "wet",
            "name": "Wet Roads",
            "desc": "Every bump costs the patient twice as much.",
            "rough": 2.0,
        },
        {"id": "hotmix", "name": "Fresh Hotmix", "desc": "New bitumen: bumps cost half.", "rough": 0.5},
        {"id": "normal", "name": "Council Roads", "desc": "Potholes as usual.", "rough": 1.0},
    ],
    "date": [
        {"id": "silent", "name": "Silent Disco", "desc": "No emoji this week. Ride the room.", "emoji": 0.0},
        {"id": "chatty", "name": "Chatty Night", "desc": "Double emoji for everyone.", "emoji": 2.0},
        {"id": "normal", "name": "Regular Night", "desc": "The usual handful of emoji.", "emoji": 1.0},
    ],
}

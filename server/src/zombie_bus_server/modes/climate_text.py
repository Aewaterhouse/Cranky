"""Climate Lawsuit's words: company names, banter, demand events, the sea, the courtroom."""

COMPANIES = [
    "{n}Corp Resources",
    "{n} Power & Light",
    "Big {n} Energy",
    "{n} & Sons Coal Co.",
    "Sunny {n} Holdings",
    "{n}Volt",
    "Coastal {n} Utilities",
    "{n} Mining & Vibes",
    "Greenish {n} Pty Ltd",
    "{n}'s Discount Electrons",
]

FUEL_SUB = {
    "coal": "Any power earns. Filthy.",
    "gas": "Tempo, plus a bonus for each surge.",
    "solar": "Earns only at 85 to 90%. Clouds otherwise.",
    "wind": "Earns only on gusts: 15 s at 110%.",
}
FUEL_ICON = {"coal": "🏭", "gas": "🔥", "solar": "☀️", "wind": "🌬️"}

EIGHTIES = [
    "Coal is cheap and nobody asks questions.",
    "Somebody's dad says the greenhouse effect is about tomatoes.",
    "Shoulder pads are in. So is the smokestack.",
    "The council approves a power station next to the primary school. Lovely views.",
    "Petrol is 40 cents. The beach is enormous.",
    "A scientist on the telly says something worrying. Channel changed.",
]
DECADE = {
    "1990s": [
        "The internet arrives. Nobody uses it to check the tide charts.",
        "A summit in Rio. Lots of nodding.",
        "The surf club gets a new roof. Optimistic.",
        "Kyoto. We'll get back to you.",
    ],
    "2000s": [
        "Y2K came and went. The sea did not go anywhere. Well, it went up.",
        "An inconvenient documentary. The town watched it on DVD and went back to the pub.",
        "The beach is noticeably skinnier. Must be the diet.",
        "Solar panels on the bowls club. The bowlers are furious about the glare.",
    ],
    "2010s": [
        "A carbon price! And it's gone again.",
        "Someone brings a lump of coal into Parliament. Relatable.",
        "King tides are now just tides.",
        "The surf club's lifesavers are rescuing the surf club.",
    ],
    "2020s": [
        "Net zero by 2050. Or 2060. Ballpark.",
        "The insurance company has stopped returning calls.",
        "The real estate agent describes Main Street as 'water adjacent'.",
        "Every company's ad now has a koala in it.",
    ],
}
TRIAL = [
    "All rise. Or don't. The courtroom is on a hill for a reason.",
    "The judge has asked everyone to stop calling the defendant 'mate'.",
    "Exhibit A: a soggy beach towel.",
    "Counsel for the defence argues the sea was already there.",
]
COOL = [
    "Sentencing. Everyone else spins easy and offers commentary.",
    "The town meeting is held on the roof of the pub.",
    "Somebody has started a GoFundMe for the surf club.",
    "Community service: pedalling the town's last working generator.",
]

EVENTS = {
    "heat": (
        "🥵 Heatwave",
        "Every air conditioner is on. Everyone to 95% for two minutes or the town blacks out.",
    ),
    "kettle": (
        "🫖 State of Origin half time",
        "Every kettle in the state switches on at once. Everyone over 110% for 30 s.",
    ),
    "miner": (
        "⛏️ Bitcoin miner moves to town",
        "Demand stays high all decade: targets up 5%, profits up 25%.",
    ),
}
BLACKOUT = "The lights went out. Every company pays {n} coins in compensation and fridge contents."
HELD = {
    "heat": "The grid held. The air conditioners hummed. Nobody thanked you.",
    "kettle": "Every cuppa boiled. The nation is grateful. Mostly for the cuppa.",
}
MINER_AGAIN = "A second bitcoin miner turned up, looked at the first one and left."
LOBBY = "A man in a very nice suit was seen at the pub, buying rounds."
BRIBE_ASK = "A brown envelope with {n} coins in it. All you have to do is stay on coal next decade."
GUST = "💨 Gust! 15 s at 110% and the turbine pays out."
SURGE = "⚡ Demand surge! 20 s at 105% for a gas bonus."

STAGE = {
    1: "The beach has gone. Towels everywhere.",
    2: "The surf club is underwater. The lifesavers are saving the trophies.",
    3: "Main Street has flooded. The pub has declared itself a marina.",
    4: "Everything is under. The town is now a reef. A very bad one.",
}
WALL = "{name} built a seawall. Sign says not designed by a CPEng."

DEFENDANT = "{name} is the defendant: {t} tonnes, the most in town."
APPEAL = "{name} appeals the old conviction and joins the dock."
APPEAL_ASK = "Stand trial again. Hold the jury's effort and the sash comes off. Fail and it stays on."
TARGET = "The jury has spoken: hold {t}% for three minutes."
JURY = "The jury rides it too. The more of it you hold, the harder it is for the defendant to walk free."
ACQUIT = "{name} is acquitted on a technicality. The paperwork was filled in wrong. Beautifully."
GUILTY = "{name} is guilty. Two minutes of community service at 100%."
GUILTY_SASH = "{name} is guilty, and the town flooded. The GUILTY sash goes on, and stays on."
SURVIVED = "The town survived. Somehow. {name} gets the Greenwashing Award."
FLOODED = "The town flooded. Everybody loses. Some more than others."

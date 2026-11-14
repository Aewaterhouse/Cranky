"""Speed Dating words: themes, profiles, cards, banter and the leaked group chat."""

THEME_TEXT = {
    "coffee": "65 to 75%. Low stakes, awkward.",
    "dinner": "80 to 90%. Proper conversation.",
    "parents": "Steady 85%. Surge every time Dad asks a question.",
    "ikea": "3 x 30 s at 110%. Who's carrying the box?",
    "moving": "90 to 95%. Sweet spot. Commitment.",
    "ex": "75 to 85%, until the ex walks in. Then sprint. Together.",
}
PROMPT_TEXT = {
    "surge": [
        'Dad: "So what do you do for work?" Surge!',
        'Dad: "And where do you see this going?" Surge!',
        "Mum has got the baby photos out. Surge!",
        'Dad: "Is that a real job?" Surge!',
        'Nan: "You\'re not vegan, are you?" Surge!',
        "Dad wants to show you the shed. Surge!",
    ],
    "effort": [
        "Flat pack on three. Lift!",
        "Up the stairs with it. Lift!",
        "One more box. It is the wardrobe.",
    ],
    "sprint": ["THE EX JUST WALKED IN. Sprint! Both of you!"],
}
PROFILES = [
    "Loves long rides, hates hills",
    "Fluent in watts per kilo, nothing else",
    "Here for the snacks",
    "Owns nine bikes, rides one",
    "Looking for someone to hold my wheel",
    "Emotionally unavailable above threshold",
    "Will describe my FTP test in detail",
    "Swipes right on tailwinds",
    "My love language is a clean drivetrain",
    "Just out of a long-term relationship with a turbo trainer",
    "Seeking a domestique. Must like bidons",
    "6'2\" (on the bike, with the saddle up)",
    "Dog person. Magpie survivor",
    "Not here to race. Will race",
    "Bakery stops are a personality",
    "Has opinions about sock height",
    "Still talks about that one KOM in 2019",
    "Carbon everything, commitment issues",
    "Peaks in the car park",
    "Shaves legs, not seconds",
    "Thinks a recovery ride is a rumour",
    "Two-coffee minimum before conversation",
]
BAR = [
    "The bar is open. Easy spin, pick a profile, lie a little.",
    "Somebody has ordered a shandy. Brave.",
    "Aunty Carol is at the corner table. She sees everything.",
    "Six dates tonight. Pace the small talk.",
    "The barman has seen this crew before. He is pouring doubles.",
    "Remember: no talking on dates. Emoji only. Like a normal relationship.",
]
DATE = {
    "coffee": ["One of you ordered a decaf. Awkward.", "Nobody knows who pays for coffee. Keep it level."],
    "dinner": ["The waiter is hovering. Hold it steady.", "Someone ordered for both of you. Bold."],
    "parents": ["Mum likes you. Dad is undecided.", "The dog likes you. That is something."],
    "ikea": [
        "You have been in the lamp section for an hour.",
        "The arrows on the floor mean nothing to them.",
    ],
    "moving": ["Whose couch is staying? Sweet spot, both of you.", "The lease is twelve months. Commit."],
    "ex": ["Nice quiet evening. Nothing can go wrong.", "Is that... no. Probably not."],
}
GAP = [
    "Ding! Next table. Deep breath.",
    "Rotate. Take your drink, leave your dignity.",
    "New date. Try not to mention the last one.",
    "Find your next table. Easy legs.",
]
PROPOSAL = [
    "Two couples, one ring. Sweet spot. Match or go home single.",
    "The jeweller is watching both couples. Hold it together.",
    "Everyone else: tempo, and judge quietly.",
    "Somebody is about to get down on one knee. Mind the cleat.",
]
WEDDING = [
    "Dearly beloved. Tandem power, together, to the number.",
    "The celebrant has done six of these today. Keep it moving.",
    "Uncle Barry is already on the dance floor.",
    "The cake is a fondant chainring. It is hideous. It is perfect.",
]
DIVORCE = [
    "Two people. One house. Tug of war. Go.",
    "The lawyers are billing by the watt.",
    "Somebody is keeping the house. Somebody is keeping the tandem.",
    "Guests: easy legs, and pretend not to watch.",
]
RECEPTION = [
    "No divorce tonight. Reception drinks. Easy legs.",
    "The DJ is playing Horses. Everybody sit up.",
]
COOL = [
    "The group chat has leaked. Easy spin. Read it and weep.",
    "Scroll slowly. It gets worse.",
    "Nobody look at each other.",
]
NUDGE = "{name}, you are the Chaperone and you have {n} card{s} left. Ruin something."
CHAT_OPEN = "📱 The group chat has leaked."
CHAT_EMOJI = "Date {n} · {a} → {b}: {e}"
CHAT_QUIET = "{a} sent nothing all night. Strong, silent, or asleep."
CHAT_MATCH = "Aunty Carol: {a} and {b} on date {n}. I nearly cried."
CARDS = {
    "ex": "surge to 110%! Will your date follow?",
    "check": "easy to 55%. Somebody has to pay.",
    "ring": "both of you to 100%. Now.",
}
AUNTY = "Aunty Carol"
CARD_FX = '{by} plays "{card}"! {who}: {text}'
CHAT_CARD = '{by}: I played "{card}" on {who}. No regrets.'
CARD_ASK = "Play a card"
CARD_SUB = "{n} left this date. You bank whatever the couple drops."
AIM_ASK = '"{card}": who gets it?'
PROFILE_ASK = "Pick your dating profile"
PROFILE_SUB = "Your dates will see it."
CONFETTI = "Confetti! Guests: 100% for ten seconds."
ENGAGED = "{a} and {b} are engaged! {c} and {d} will always have Ikea."
ENGAGED_SOLO = "{a} and {b} are engaged! Nobody else was close."
MARRIED = "{a} and {b} are married. They held the tandem {pct}% of the time."
DIVORCED = "{w} keeps the house. {l} keeps the tandem."
RIDE_OFF = "The Proposal: {a} + {b} against {c} + {d}. Sweet spot. Best match gets the ring."
FLAGS = {
    "ahead": "Always half a wheel ahead",
    "behind": "Sits on and lets their date do the work",
    "out": "Left the band for {n} s",
    "slow": "Slow to react ({n} s)",
    "read": "Left everyone on read",
    "turtle": "Called {n} dates slow",
    "target": "The Chaperone's favourite",
    "cold": "Does not play well with others",
}

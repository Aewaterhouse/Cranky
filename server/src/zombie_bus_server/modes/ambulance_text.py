"""Everything anyone says in Kidney Stone Express: patients, the radio, the hospital and the reviews."""

from __future__ import annotations

# What each patient says when the ride is smooth, and when it is not.
CALM = {
    "hook": [
        "No rush, legends. It's only a thumb.",
        "So I've got the rod in one hand and a stubby in the other, right…",
        "He was THIS big. I'd show you but the hook's in the way.",
        "Reckon they'll let me keep the hook? It's a good hook.",
        "Did I tell you about the fish? I'll tell you about the fish.",
        "Honestly go the long way. I've got more fish stories.",
    ],
    "kidney": [
        "Smooth. Smooooth. That's it. Nobody move.",
        "If we hit one more cat's eye I am walking.",
        "I've passed three of these. This one has a mortgage.",
        "Keep it exactly like that and you're in the will.",
        "Is this a Camry? Drives like a Camry. Lovely.",
        "Tell my wife I said 'ow'.",
    ],
    "magpie": [
        "It's still behind us. IT'S STILL BEHIND US.",
        "I had cable ties on the helmet and everything!",
        "He knows my route. He knows where I work.",
        "Don't slow down, that's what he wants.",
        "Every September. Every single September.",
        "Is the back window shut? Check the back window.",
    ],
    "bin": [
        "Did you get it on video? Tell me somebody got it.",
        "Who are you? Did I clear the bin?",
        "Film this bit. Are you filming? Film this.",
        "It was only six bins. I've done five heaps of times.",
        "Did you get it on video?",
        "Put it on the group chat. Caption it 'sent'.",
    ],
    "trainer": [
        "The YouTube bloke said you just lever the cassette off.",
        "It's still under warranty if nobody mentions the angle grinder.",
        "I'm fine. The flywheel only got me a bit.",
        "Feeling a bit… is it warm in here?",
        "Should've just bought the Kickr, hey.",
        "Tell the bike shop nothing.",
    ],
}
ROUGH = {
    "hook": ["Steady on, you'll spill me stubby.", "Bit bumpy! Anyway, the fish…"],
    "kidney": ["AAARGH! WHO DID THAT?", "EVERY. SPIKE. I FEEL EVERY ONE.", "PICK A WATTAGE AND STAY THERE!"],
    "magpie": ["WAS THAT HIM? DID HE GET IN?", "Smooth it out, he can smell fear!"],
    "bin": ["Whoa. Are we jumping bins again?", "Did you film THAT one?"],
    "trainer": ["Ooh. That's not ideal.", "Easy! I'm held together with electrical tape."],
}

BASE = [
    "Base station. Kettle's on. Somebody's eaten the last sausage roll.",
    "Check the van: tyres, siren, the good stretcher. Not the squeaky one.",
    "Radio check. Dispatch says hello and can you please return the stapler.",
    "Warm the legs up. First job's a bloke with a fishing hook, no dramas.",
    "Whose servo coffee is this on the dash? It's got a skin on it.",
    "Reminder: the siren is not for the Macca's drive-through.",
    "Somebody adjust the driver's seat back. Who drives like a praying mantis?",
]
RAMP = [
    "Ramped. You're ninth in the queue. Settle in.",
    "Triage nurse hasn't looked up yet. Do not make eye contact first.",
    "Bed manager says 'soon'. Bed manager said 'soon' on Tuesday.",
    "The vending machine ate two dollars. Morale is low.",
    "Car 12's been here since breakfast. They've started a book club.",
    "Paperwork time. Whose handwriting is this? Is that a seven or a kookaburra?",
    "Spin the legs easy. The queue isn't going anywhere and neither are you.",
]
COOL = [
    "Siren off. Windows down. Who stalled it at the Ipswich Road lights?",
    "It was not a stall. It was a tactical pause.",
    "Somebody owes the base a box of sausage rolls.",
    "Dispatch: the stapler. We know it's in the van.",
    "Good shift. Mostly. We don't talk about the back door.",
    "Easy spin home. Reviews are in and they are honest.",
]

EVENTS = {
    "green": ("Green light wave", "Everyone over 95% for 20 s to catch every light!"),
    "roadworks": ("M1 roadworks", "60% limit. Anyone over cops a speeding fine."),
    "hump": ("Speed hump", "Everyone off the gas together. Under 20%. NOW."),
    "siren": ("Somebody won't pull over", "{name} is the siren: SPRINT! Everyone else hold steady."),
}
HUMP_WARN = "Speed hump ahead. Everyone ease off together in… 3… 2… 1…"

# Google reviews by how the run went: low is 1 to 2 stars, mid is 3, high is 4 to 5.
REVIEWS = {
    "hook": {
        "low": "Told them there was no rush and they took it as a challenge to be bad at it. Lost the hook.",
        "mid": "Fine. Got there. Nobody asked a single follow-up question about the fish.",
        "high": "Top crew. Smooth as. Listened to the whole fish story twice. He was THIS big.",
    },
    "kidney": {
        "low": "Felt every pedal stroke in my left kidney. Do not recommend. Would rather pass it on the M1.",
        "mid": "Mostly smooth. Screamed four times, two of them their fault.",
        "high": "Like being carried by angels on a waterbed. Passed the stone in the car park out of joy.",
    },
    "magpie": {
        "low": "The bird kept up easily. The BIRD. Kept UP.",
        "mid": "Got there. Magpie waited outside. We have an understanding now.",
        "high": "Lost the magpie at Indooroopilly. These people are heroes. Wearing the cable ties anyway.",
    },
    "bin": {
        "low": "Don't remember the trip but my neck does. Did anyone film it?",
        "mid": "Apparently I asked them to film it nine times. They filmed it zero times.",
        "high": "Great crew. One of them finally showed me the video. I did NOT clear the bin.",
    },
    "trainer": {
        "low": "Rougher than the repair job. And I did the repair job with a butter knife.",
        "mid": "Got me there. Kept asking what I did to the trainer. None of their business.",
        "high": "Fast, smooth, no judgement. Trainer is still on fire in the garage but I feel great.",
    },
}
WALKED = {
    "hook": "Got out at the lights and walked. Caught a flathead on the way. Beat them there.",
    "kidney": "Got out. Walked. With a kidney stone. It was more comfortable. One star.",
    "magpie": "Took my chances with the magpie. The magpie was gentler.",
    "bin": "Walked the rest. Jumped two bins on the way. Still beat the ambulance.",
    "trainer": "Hopped out and limped it. Fixed their siren on the way past. You're welcome.",
}
FELL = "Fell out the back door at the hospital. They REVERSED for me. With the beeper on. Everyone saw."
LATE = " Also I have aged."


def review(pid: str, stars: int, walked: bool, fell: bool, late: bool) -> str:
    """The patient's Google review for a finished run."""
    if walked:
        return WALKED[pid]
    if fell:
        return FELL
    return REVIEWS[pid]["low" if stars <= 2 else "mid" if stars == 3 else "high"] + (LATE if late else "")

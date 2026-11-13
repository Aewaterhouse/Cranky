"""Message schemas (see docs/protocol.md)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter

Tier = Literal["hard", "medium", "easy"]
Grade = Literal["FAIL", "HIT", "GREAT", "MEGA", "LEGEND"]


class Join(BaseModel):
    t: Literal["join"]
    name: str = Field(max_length=24)
    ftp: int = Field(ge=50, le=600)
    tier: Tier
    look: dict[str, str] = Field(default_factory=dict)


class Watch(BaseModel):
    t: Literal["watch"]


class Setup(BaseModel):
    t: Literal["setup"]
    plan: str
    minutes: int = Field(ge=0, le=120)


class Bots(BaseModel):
    t: Literal["bots"]
    n: int = Field(ge=0, le=5)


class Difficulty(BaseModel):
    t: Literal["difficulty"]
    level: Literal["easy", "normal", "hard", "nightmare"]


class Game(BaseModel):
    t: Literal["game"]
    game: Literal["bus", "madness"]


class RoadSetup(BaseModel):
    t: Literal["road"]
    route: str = Field(max_length=60)
    laps: int = Field(default=1, ge=1, le=99)
    style: Literal["social", "race"] = "social"
    together: bool | None = None


class Start(BaseModel):
    t: Literal["start"]


class End(BaseModel):
    t: Literal["end"]


class TierMsg(BaseModel):
    t: Literal["tier"]
    tier: Tier


class Data(BaseModel):
    t: Literal["data"]
    p: float = Field(ge=0, le=3000)
    w: float = Field(ge=0, le=3000)
    cad: float = Field(ge=0, le=250)
    s: float | None = Field(default=None, ge=0, le=1)
    hr: int | None = Field(default=None, ge=0, le=250)
    hrp: float | None = Field(default=None, ge=0, le=1.5)


class Sprint(BaseModel):
    t: Literal["sprint"]
    blk: int
    dur: float
    avg: float
    pct: float
    grade: Grade
    combo: int = 0


class TrainerMode(BaseModel):
    """Host: everyone on ERG, everyone on gears, or each rider chooses (`choose`)."""

    t: Literal["trainers"]
    mode: Literal["erg", "gears", "choose"]


class Erg(BaseModel):
    """The rider's trainer mode: ERG holds the target, off means virtual gears. Shown to the crew."""

    t: Literal["erg"]
    on: bool


class Buy(BaseModel):
    t: Literal["buy"]
    item: Literal["plating", "repellent", "sync"]


ClientMsg = TypeAdapter(
    Annotated[
        Join
        | Watch
        | Setup
        | RoadSetup
        | Bots
        | Difficulty
        | Game
        | Start
        | End
        | TierMsg
        | Data
        | Sprint
        | Erg
        | TrainerMode
        | Buy,
        Field(discriminator="t"),
    ]
)


class RiderTick(BaseModel):
    name: str
    tier: Tier
    tgt: int | None
    w: float
    cad: float
    s: float | None
    st: Literal["riding", "fell", "spectator"]
    hr: int | None = None
    hrp: float | None = None
    erg: bool = True


class Bus(BaseModel):
    speed: float
    dist: float
    armour: float
    gap: float
    scrap: int
    sync: bool
    tune: bool
    rb: float | None
    combo: int
    shop: bool
    repel: int
    syncw: int
    nitro: float = 0
    boost: bool = False
    streak: float = 0
    next: str = "drop"
    gunship: bool = False
    mad: dict | None = None


class Fx(BaseModel):
    k: str
    text: str | None = None
    id: str | None = None


class Tick(BaseModel):
    t: Literal["tick"] = "tick"
    el: float
    i: int
    bel: float
    ev: str
    riders: dict[str, RiderTick]
    bus: Bus
    fx: list[Fx]
    load: float = 1.0  # targets of riders still on the bus are multiplied by this while others have fallen

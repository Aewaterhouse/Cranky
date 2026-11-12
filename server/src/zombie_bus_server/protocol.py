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


class Sprint(BaseModel):
    t: Literal["sprint"]
    blk: int
    dur: float
    avg: float
    pct: float
    grade: Grade
    combo: int = 0


class Buy(BaseModel):
    t: Literal["buy"]
    item: Literal["plating", "repellent", "sync"]


ClientMsg = TypeAdapter(
    Annotated[
        Join | Setup | Bots | Difficulty | Start | End | TierMsg | Data | Sprint | Buy,
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

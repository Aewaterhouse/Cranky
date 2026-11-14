"""A test harness for Climate Lawsuit: a dealt town driven directly, tick by tick, with no room or sockets."""

from zombie_bus_server import config as C
from zombie_bus_server.modes.climate import Climate
from zombie_bus_server.plan import locate
from zombie_bus_server.rider import Rider

DT = 1 / C.TICK_HZ


def deal(scale=1.0):
    """The session, squeezed by `scale` as `ZB_SCRIPT_SCALE` would."""
    old, C.SCRIPT_SCALE = C.SCRIPT_SCALE, scale
    try:
        return Climate.deal(45)
    finally:
        C.SCRIPT_SCALE = old


def mid(b):
    return (b[0] + b[1]) / 2


class Town:
    """A room's worth of state: a dealt plan, `n` riders, no script events unless asked for."""

    code = "TOWN"
    load = 1.0
    store = None

    def __init__(self, n=4, events=False, scale=1.0):
        self.plan = deal(scale)
        self.el = 0.0
        self.riders = {f"r{i}": Rider(f"r{i}", f"R{i}", 200, "hard", connected=True) for i in range(n)}
        self.game = Climate()
        self.game.begin(self)
        if not events:
            self.game.events = []

    def at(self, kind, n=1):
        """Seconds from the start to the `n`th block of `kind`."""
        t = 0.0
        for b in self.plan["blocks"]:
            n -= b["kind"] == kind
            if n == 0:
                return t
            t += b["dur"]
        raise KeyError(kind)

    def ride(self, secs, power=None):
        """Rides `secs` seconds at `power(r, band, el)` (a share of FTP), or at the middle of the band."""
        fx = []
        for _ in range(round(secs / DT)):
            self.el += DT
            i, bel = locate(self.plan["blocks"], self.el)
            for r in self.riders.values():
                band = self.game.band(self, r, i, bel)
                on = 1.5 if band == "sprint" else 1.0 if band == "free" else mid(band)
                r.p = r.w = r.ftp * (power(r, band, self.el) if power else on)
                r.cad, r.s, r.st = 85, 1.0, "riding"
            fx += self.game.tick(self, DT, i, bel, "")
        return fx

    def to(self, kind, n=1, secs=0.0, power=None):
        """Rides up to `secs` into the `n`th block of `kind`."""
        return self.ride(self.at(kind, n) + secs - self.el, power)

    def view(self):
        return self.game.game(self, *locate(self.plan["blocks"], self.el))

    def act(self, rid, k, v):
        self.game.on_act(self, self.riders[rid], k, v)

    def ask(self, rid):
        return self.game.ask(self, self.riders[rid])


def kinds(fx):
    return [f["k"] for f in fx]

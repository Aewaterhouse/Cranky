# Road games

The road layer is the group free ride with the rules taken out. The server owns everyone's position on a route;
a game is a small rule set on top. The races are built (`modes/race.py`); this is how to add another.

## The layers

| Layer | Where | A game changes it? |
| --- | --- | --- |
| Physics and geometry | `server/src/zombie_bus_server/road_physics.py`, `road_route.py` (ports of the client's `core/physics.ts`, `core/route.ts` and the curvature in `scene/route/roadPath.ts`, pinned by `content/tests/road-vectors.json`) | No |
| The road | `modes/road.py`: `RoadSim` steps every `Mover` (distance, speed, power, draft, band, lane) and asks its `Rules` what to do around that | No |
| Transport | `road_room.py`: lobby, sockets, spectators, bots, late join, rejoin, snapshots, the `tick` and `end` messages | No |
| Rules | A subclass of `Rules` in `modes/road.py` (or its own file under `modes/`), listed in `RULES` | Yes |

## What a rule set can override

- `place(sim, m)`: where a rider starts. Handicap start gaps and "team two starts a minute back" go here.
- `tune(sim, live)`: each tick before the physics, set every rider's `draft`, `band` and `lane`. A handicap
  scales `band` by FTP; a chaingang decides who is the front rider; kart lanes pick `lane` from the rider's input.
- `after(sim, dt)`: each tick after the riders have moved. Scoring, eliminations, item boxes. Returns `fx`
  (`{k, id, text}`) for the clients to toast or animate.
- `state(sim)`: anything the clients need each tick, sent as the tick's `game` field (points, who is on the
  front, time gaps between teams).
- `over(sim)`: when the ride ends (fourth rider home, last rider eliminated).
- `results(sim)`: the rows of the results screen, in order.

`Mover.band` scales distance covered without touching the physics speed, and nothing in a rule set can reach
the trainer: the client sets its own gradient from its own position.

## Steps

1. Subclass `Rules`, give it a `name`, add it to `RULES`.
2. Let the host pick it: add a `game` field to the `road` message (`protocol.py`, `docs/protocol.md`,
   `client/src/net/protocol.ts`), keep it on `RoadRoom`, pass it to `RoadSim(route, laps, together, game)`.
3. Game input (a turn on the front, firing an item) is one new client message handled in `RoadRoom.handle`
   and passed to the rule set.
4. Client: read `tick.game` and `fx` in `client/src/modes/freeRide/group.ts` and show them on the HUD. The
   world, minimap and rider list already draw whatever positions the server sends.
5. Tests: drive `RoadSim` directly, as `server/tests/test_road.py` does. No sockets needed for rules.

## What each planned game needs

- **Chaingang:** `tune` (only the front rider is in the wind; a rotation prompt in `state`), `after` (score time on the front).
- **Handicap race:** `place` (start gaps) or `tune` (`band` by FTP), `results` by finish order.
- **Team time trial:** teams on `RoadRoom`, `place` (two groups), `over` and `results` on the fourth rider.
- **Kart racing:** `tune` (lanes from input), `after` (item boxes and hits), one input message.

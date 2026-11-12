# Protocol

Source of truth for client ↔ server messages. Python: `server/src/zombie_bus_server/protocol.py`.
TypeScript: `client/src/net/protocol.ts`. Keep all three in step.

## REST

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/profile/{id}` | Profile JSON, 404 if unknown |
| PUT | `/api/profile/{id}` | Profile JSON (newer `updated` wins) |
| POST | `/api/rides` | `{id, summary}`: ride summary from the client |
| POST | `/api/rooms` | → `{code}`: new 4-letter room code |
| GET | `/api/plans` | → `[{id, name, desc, secs}]` |
| GET | `/api/health` | → `{ok: true}` |

## WebSocket `/ws/{code}?id={riderId}`

All messages are JSON objects with a `t` field. Times are seconds of session time.

### Client → server

| t | Fields | Notes |
| --- | --- | --- |
| `join` | `name, ftp, tier` | First message. Same `id` reconnecting reclaims the slot. |
| `setup` | `plan, minutes` | Host only, lobby only. `minutes` 0 = as written. |
| `start` | | Host only. 5 s countdown (negative `el`). |
| `tier` | `tier` | Rider changes own tier. |
| `data` | `p, w, cad, s` | 2 Hz. Instant power, 3 s power, cadence, compliance (0..1 or null). |
| `sprint` | `blk, dur, avg, pct, grade, combo` | Sent once when a sprint block ends; graded client-side. |
| `end` | | Host only: finish the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `code, host, state ('lobby'/'running'/'done'), plan (expanded Plan), minutes, riders: [{id, name, tier, ftp, connected}]` |
| `tick` | `el, i, bel, ev, riders: {id: {name, tier, tgt, w, cad, s, st}}, bus, fx` |
| `end` | `summary` (GroupSummary, see `client/src/ui/results.ts`) |
| `error` | `msg` |

`tick.i` is -1 during the countdown. `tgt` is the rider's target watts or null (ERG off).
`st` is `riding`, `fell` or `spectator`. `ev` is `warmup`, `longhaul`, `surge`, `roadblock`,
`servo` or `cooldown`.

`bus`: `{speed (m/s), dist (m), armour (0..100), gap (m), scrap, sync (bool), tune (bool), rb (0..1 roadblock progress or null), combo}`.

`fx`: list of `{k, text?, id?}`, one-shot effects since the last tick. `k` is one of
`hit, grab, shake, smash, crash, fell, hauled, sprint, tune, slowmo, scrap`.

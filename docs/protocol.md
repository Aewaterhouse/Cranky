# Protocol

Source of truth for client ↔ server messages. Python: `server/src/zombie_bus_server/protocol.py`.
TypeScript: `client/src/net/protocol.ts`. Keep all three in step.

## REST

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/health` | → `{ok: true}` (no auth) |
| GET | `/api/riders` | → seeded riders `[{id, name}]` for the login tiles (no auth) |
| POST | `/api/login` | `{name, password}` → `{token, id, name}`; 401 if wrong. Password is the name, case-insensitive. |
| GET | `/api/me` | → `{id, name, admin}`; `admin` is true for ids in `config.ADMINS` |
| POST | `/api/riders` | `{name, password?}` → `{id, name}`; admin only. Password defaults to the name. 409 if the name exists. |
| POST | `/api/riders/{id}/password` | `{password}`; admin, or the rider themselves |
| DELETE | `/api/riders/{id}` | Admin only; not yourself. Removes the login and tokens; the profile and rides stay. |
| GET | `/api/profile/{id}` | Profile JSON, 404 if unknown |
| PUT | `/api/profile/{id}` | Profile JSON (newer `updated` wins); 403 unless `id` is your own |
| POST | `/api/rides` | `{summary}`: ride summary from the client, stored for the logged-in rider |
| POST | `/api/rooms` | → `{code}`: new 4-letter room code |
| GET | `/api/rooms` | → open buses `[{code, state, plan, host, riders: [names]}]` |
| GET | `/api/plans` | → `[{id, name, desc, secs}]` |

Every endpoint except health, riders and login needs `Authorization: Bearer <token>` (401 otherwise). Riders are seeded from `config.SEED_USERS`; the rider id is the lower-case name. Security is deliberately light (friends only, Tailscale).

## WebSocket `/ws/{code}?token={token}`

The token identifies the rider. A bad token or unknown code gets an `error` message and the socket closes.

All messages are JSON objects with a `t` field. Times are seconds of session time.

### Client → server

| t | Fields | Notes |
| --- | --- | --- |
| `join` | `name, ftp, tier, look` | First message. `look` is the cosmetics map (e.g. `{hat, outfit, paint, bullbar, spikes}`). Same `id` reconnecting reclaims the slot. |
| `setup` | `plan, minutes` | Host only, lobby only. `minutes` 0 = as written. |
| `bots` | `n` | Host only, lobby only. Sets the number of bot riders (0..5), capped so humans + bots fit the 6 seats. A human joining a full bus takes a bot's seat. |
| `start` | | Host only. 5 s countdown (negative `el`). |
| `tier` | `tier` | Rider changes own tier. |
| `data` | `p, w, cad, s` | 2 Hz. Instant power, 3 s power, cadence, compliance (0..1 or null). |
| `sprint` | `blk, dur, avg, pct, grade, combo` | Sent once when a sprint block ends; graded client-side. |
| `buy` | `item` | `plating`, `repellent` or `sync`. Only at a Servo Stop, paid from the bus scrap tin (40, 60, 50). |
| `end` | | Host only: finish the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `code, host, state ('lobby'/'running'/'done'), plan (expanded Plan), minutes, riders: [{id, name, tier, ftp, connected, look, bot}]`; `bot` is true for NPC riders (always `connected`, never host, hidden from `/api/rooms`) |
| `tick` | `el, i, bel, ev, riders: {id: {name, tier, tgt, w, cad, s, st}}, bus, fx` |
| `end` | `summary` (GroupSummary, see `client/src/ui/results.ts`) |
| `error` | `msg` |

`tick.i` is -1 during the countdown. `tgt` is the rider's target watts or null (ERG off).
`st` is `riding`, `fell` or `spectator`. `ev` is `warmup`, `longhaul`, `surge`, `roadblock`,
`servo` or `cooldown`.

`bus`: `{speed (m/s), dist (m), armour (0..100), gap (m), scrap, sync (bool), tune (bool), rb (0..1 roadblock progress or null), combo, shop (bool, Servo Stop open), repel (repellent charges), syncw (extra sync window, rpm)}`.

`fx`: list of `{k, text?, id?}`, one-shot effects since the last tick. `k` is one of
`hit, grab, shake, smash, crash, fell, hauled, sprint, tune, slowmo, scrap, buy, repel, roadblock, servo, surge, longhaul`. `roadblock`, `servo`, `surge` and `longhaul` mark event starts; `buy` and `repel` carry shop text.

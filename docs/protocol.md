# Protocol

Source of truth for client ↔ server messages. Python: `server/src/zombie_bus_server/protocol.py`.
TypeScript: `client/src/net/protocol.ts`. Keep all three in step.

## REST

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/ladder?season=2026-Q4` | Season ladder: top runs, rider standings and titles. Season defaults to the current quarter |
| GET | `/api/health` | → `{ok: true}` (no auth) |
| GET | `/api/riders` | → seeded riders `[{id, name}]` for the login tiles (no auth) |
| POST | `/api/login` | `{name, password}` → `{token, id, name}`; 401 if wrong. Password is the name, case-insensitive. |
| GET | `/api/me` | → `{id, name, admin}`; `admin` is true for ids in `config.ADMINS` |
| POST | `/api/riders` | `{name, password?}` → `{id, name}`; admin only. Password defaults to the name. 409 if the name exists. |
| POST | `/api/riders/{id}/password` | `{password}`; admin, or the rider themselves |
| DELETE | `/api/riders/{id}` | Admin only; not yourself. Removes the login and tokens; the profile and rides stay. |
| GET | `/api/profile/{id}` | Profile JSON, 404 if unknown |
| PUT | `/api/profile/{id}` | Profile JSON (newer `updated` wins); 403 unless `id` is your own |
| POST | `/api/rides` | `{summary}` → `{ok, saved}`: ride summary from the client, stored for the logged-in rider. The client adds `crew: true` for bus rides. A ride the rider already has with the same start time (`summary.record.date`) is ignored and `saved` is false, so a queued ride can be sent again safely. |
| GET | `/api/rides` | → the caller's rides, newest first: `[{id, date, plan, secs, avgPower, np, tss, kj, compliance, crew, route, distance}]`. Fields missing from older rides are null; `crew` is false. `route` (a route id) and `distance` (m) are set on free and group rides. |
| GET | `/api/rides/{n}` | → the full stored summary (per-second arrays included); 404 unless it is your ride |
| DELETE | `/api/rides/{n}` | Removes one of your rides; 404 unless it is yours. The profile is not touched. |
| POST | `/api/efforts` | `{efforts: [{route, segment, secs, watts, wkg, date, rideDate?, trace?}]}` → `{saved}`: segment efforts for the logged-in rider. `segment` is `<route>:<kind>:<start m>`; `date` is when the effort finished and `rideDate` the start of its ride. Repeats (same rider, segment and `date`) are ignored, so a retried sync is safe. `trace` is metres from the segment's start every 5 s (the effort's pace); only a rider's best per segment keeps it. 422 on a bad value. |
| GET | `/api/efforts?route=ID` | → `{mine: {segment: {segment, route, secs, watts, wkg, date, ride, count, trace}}, crew: {segment: [{id, name, secs, watts, wkg, date, ride}]}}`: the caller's best on each segment of the route and each segment's leaderboard, read before a ride. The first two rows of each leaderboard also carry `trace` |
| GET | `/api/efforts/mine` | → the caller's best on every segment they have ridden: `[{segment, route, secs, watts, wkg, date, ride, count}]` |
| GET | `/api/segments/{segment}/leaderboard?by=time\|wkg` | → each rider's best effort, fastest first (or highest W/kg first), at most 10: `[{id, name, secs, watts, wkg, date, ride}]`. `ride` is the id of the ride it came from, or null |
| GET | `/api/segments/{segment}/ghost/{rider}` | → that rider's best traced effort `{id, name, secs, watts, wkg, date, ride, trace}`; 404 if none |
| POST | `/api/rooms` | Optional `{kind: 'bus' \| 'road'}` (default `bus`) → `{code}`: new 4-letter room code |
| GET | `/api/rooms` | → open rooms `[{code, kind, state, plan, host, riders: [names]}]`; for a road room `plan` is the route's name |
| GET | `/api/plans` | → `[{id, name, desc, secs}]` |

Every endpoint except health, riders and login needs `Authorization: Bearer <token>` (401 otherwise). Riders are seeded from `config.SEED_USERS`; the rider id is the lower-case name. Security is deliberately light (friends only, Tailscale).

## WebSocket `/ws/{code}?token={token}`

The token identifies the rider. A bad token or unknown code gets an `error` message and the socket closes.

All messages are JSON objects with a `t` field. Times are seconds of session time.

### Client → server

| t | Fields | Notes |
| --- | --- | --- |
| `join` | `name, ftp, tier, look` | First message. `look` is the cosmetics map (e.g. `{hat, outfit, paint, bullbar, spikes}`). Same `id` reconnecting reclaims the slot. |
| `watch` | | First message instead of `join`: a TV / second-screen spectator. No seat, not counted in `MAX_RIDERS`, not in `/api/rooms`, never keeps a room alive. Gets the same `lobby`, `tick` and `end` messages (and `end` straight away if the ride is done). Every other message from a spectator socket is ignored. The same account may ride on one socket and watch on another. |
| `setup` | `plan, minutes` | Host only, lobby only. `minutes` 0 = as written. |
| `bots` | `n` | Host only, lobby only. Sets the number of bot riders (0..5), capped so humans + bots fit the 6 seats. A human joining a full bus takes a bot's seat. |
| `difficulty` | `level` | Host only, not while running. `easy`, `normal`, `hard` or `nightmare`. |
| `start` | | Host only. 5 s countdown (negative `el`). |
| `tier` | `tier` | Rider changes own tier. |
| `data` | `p, w, cad, s` | 2 Hz. Instant power, 3 s power, cadence, compliance (0..1 or null). |
| `sprint` | `blk, dur, avg, pct, grade, combo` | Sent once when a sprint block ends; graded client-side. |
| `buy` | `item` | `plating`, `repellent` or `sync`. Only at a Servo Stop, paid from the bus scrap tin (40, 60, 50). |
| `end` | | Host only: finish the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `code, host, difficulty, state ('lobby'/'running'/'done'), plan (expanded Plan), minutes, riders: [{id, name, tier, ftp, connected, look, bot}]`; `bot` is true for NPC riders (always `connected`, never host, hidden from `/api/rooms`) |
| `tick` | `el, i, bel, ev, riders: {id: {name, tier, tgt, w, cad, s, st}}, bus, fx` |
| `end` | `summary` (GroupSummary, see `client/src/ui/results.ts`) |
| `error` | `msg` |

`data` also carries `hr` (bpm or null) and `hrp` (bpm / the rider's max heart rate, or null). Each rider in a tick has the same two fields.

`{t:'game', game:'bus'|'madness'}` (host, not while running) picks the crew game; the lobby carries `game`. In VO2 Madness the plan is dealt by the server and `bus.mad` holds `{pts, red, crown, lead, round, rounds, work, box, next, twist}`; extra fx kinds are `go, rest, box, crown, lead, sandbag`.

`tick.i` is -1 during the countdown. `tgt` is the rider's target watts or null (ERG off).
`st` is `riding`, `fell` or `spectator`. `ev` is `warmup`, `longhaul`, `rampup`, `surge`, `roadblock`,
`servo` or `cooldown`.

`bus`: `{speed (m/s), dist (m), armour (0..100), gap (m), scrap, sync (bool), tune (bool), rb (0..1 roadblock progress or null), combo, shop (bool, Servo Stop open), repel (repellent charges), syncw, nitro (0..1 charge), boost (bool) (extra sync window, rpm), streak (0..1 progress to the next streak reward), next (`drop`, `airstrike` or `gunship`), gunship (bool, gunship up)}`.

`fx`: list of `{k, text?, id?}`, one-shot effects since the last tick. `k` is one of
`drop, airstrike, gunship, nitro, challenge, challenge_won, challenge_lost, hit, grab, shake, smash, crash, fell, hauled, sprint, tune, slowmo, scrap, buy, repel, roadblock, servo, surge, longhaul`. `roadblock`, `servo`, `surge` and `longhaul` mark event starts; `buy` and `repel` carry shop text.

## Road rooms (group free ride)

A room made with `{kind: 'road'}` is a ride on a bundled route. The server owns every rider's position; the
client sends what the trainer measures and draws what the server says. Same socket, same `join`, `watch`,
`bots`, `start`, `end` and `error` messages as a bus room. Every `lobby` message carries `kind` (`bus` or
`road`), so a client that joined the wrong sort of room by code can say so.

### Client → server

| t | Fields | Notes |
| --- | --- | --- |
| `join` | `name, ftp, tier, look` | As the bus (`tier` is ignored). The rider's weight comes from their stored profile (`weightKg`, default 75). Joining a ride that is already running puts the rider on the back of the group; the same id joining again takes its old place on the road back. |
| `road` | `route, laps, style, together?` | Host only, not while running. `route` is a pack id from `content/routes`; `laps` is clamped to 1 unless the route is a circuit; `style` is `social` or `race`; `together` (the keep-together band) defaults to on for social and off for race. |
| `bots` | `n` | Host only, not while running. 0..5 road bots; humans + bots fit the 8 places. |
| `data` | `p, w, cad, hr?` | About 2 Hz. Instant power, 3 s power, cadence, heart rate. No data for 3 s reads as zero power: the rider coasts to a stop and the ride goes on. |
| `start` / `end` | | Host only. `start` begins a 10 s countdown; `end` finishes the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `kind: 'road', code, host, state, route, laps, distance (m, all laps), style, together, riders: [{id, name, ftp, kg, connected, look, bot, line}]`; `line` is a bot's one-line character, null for people |
| `tick` | `kind: 'road', el, riders: {id: {d, v, w, cad, hr, lane, draft, band, st, fin}}, game, fx`; 4 Hz |
| `end` | `summary: {kind: 'road', route, name, laps, distance, secs, style, together, riders: [{id, name, bot, place, time, dist, late, avgPower, wkg, saved}]}` |

`el` is ride seconds, negative during the countdown. Per rider: `d` metres along the whole ride (all laps),
`v` ground speed in m/s (the keep-together band included), `lane` metres right of the centre line, `draft` the
drag multiplier (1 is clean air, 0.73 is a 27% saving), `band` the keep-together scale on distance covered
(1 when off), `st` one of `riding`, `stopped`, `away` (socket gone) or `finished`, `fin` the rider's time in
seconds once finished. `game` is the rule set's own state (null for a plain ride). `fx` is a list of
`{k, id, text}`; the only kind so far is `finish`, with `text` the finishing place.

Results: `time` is null for a rider who did not finish; `dist` is what they rode; `late` marks a late joiner
(ranked after everyone who rode the whole way); `saved` is the average watts drafting saved them.

A road tick never carries a power target (`tgt`): the trainer only ever gets a gradient from the rider's own
position, through `ErgController.setGrade`.

## Downloads
- `PUT /api/rides/files/<name>` (logged in; body is the file, a .fit, .json or .png up to 8 MB) returns `{"url": "/api/rides/files/<key>/<name>"}`.
- `GET /api/rides/files/<key>/<name>` (no login) serves it as an attachment for 10 minutes; `?inline=1` serves it inline.

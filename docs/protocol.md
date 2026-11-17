# Protocol

Source of truth for client ↔ server messages. Python: `server/src/zombie_bus_server/protocol.py`.
TypeScript: `client/src/net/protocol.ts`. Keep all three in step.

## REST

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/ladder?season=2026-Q4` | Season ladder from Zombie Bus results only: top runs, rider standings and titles. Season defaults to the current quarter |
| GET | `/api/health` | → `{ok: true}` (no auth) |
| GET | `/api/riders` | → `[{id, name}]` (admins also get `username`); logged-in riders only, the login page lists nobody |
| POST | `/api/login` | `{username, password}` (`name` still accepted for `username`) → `{token, id, name, mustChange}`; username in any case; 401 "Wrong username or password" if either is wrong, 429 with a wait message after 5 wrong for that name in 10 min. The first password is the name, case-insensitive; `mustChange` is true until the rider sets their own. |
| GET | `/api/me` | → `{id, name, admin, mustChange, username}`; `admin` is true for ids in `config.ADMINS`. While `mustChange`, every other logged-in endpoint answers 403 "Set your password first" and the WebSocket only lets them watch. |
| POST | `/api/riders` | `{name, password?}` → `{id, name}`; admin only. Password defaults to the name. 409 if the name exists. |
| POST | `/api/riders/{id}/password` | `{password, current?}`; the rider themselves only. 8+ characters, not their name; `current` is needed unless they are still on the default. |
| POST | `/api/riders/{id}/username` | `{username}` → `{ok, username}`; the rider themselves or an admin. 3 to 24 letters, numbers, spaces, - and _ (400); 409 if another rider has it in any case. Id and shown name unchanged. |
| POST | `/api/riders/{id}/reset` | Admin only: the password goes back to the username and the rider must set their own at next login. |
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
| `join` | `name, ftp, tier, look` | First message. `look` is `{body}`: the rider's body from the character creator as a string (`1-50-45-…`: a version, then one whole number per option of `content/avatar.json`); the server clamps each value to its range and drops a `body` it does not understand, and a look without one shows the rider's default body. Any other key (an old client's Garage `hat`, `outfit`, `bike`, `horn`, `paint`, `bullbar`, `spikes`) is dropped, so lobbies carry only `body`. Same `id` reconnecting reclaims the slot. |
| `watch` | | First message instead of `join`: a TV / second-screen spectator. No seat, not counted in `MAX_RIDERS`, not in `/api/rooms`, never keeps a room alive. Gets the same `lobby`, `tick` and `end` messages (and `end` straight away if the ride is done). Every other message from a spectator socket is ignored. The same account may ride on one socket and watch on another. |
| `setup` | `plan, minutes` | Host only, lobby only. `minutes` 0 = as written. |
| `bots` | `n` | Host only, lobby only. Sets the number of bot riders (0..5), capped so humans + bots fit the 6 seats. A human joining a full bus takes a bot's seat. |
| `difficulty` | `level` | Host only, not while running. `easy`, `normal`, `hard` or `nightmare`. |
| `start` | | Host only. 5 s countdown (negative `el`). |
| `tier` | `tier` | Rider changes own tier. |
| `data` | `p, w, cad, s` | 2 Hz. Instant power, 3 s power, cadence, compliance (0..1 or null). |
| `sprint` | `blk, dur, avg, pct, grade, combo` | Sent once when a sprint block ends; graded client-side. |
| `ready` | `on` | A guest in the lobby is ready (or not). The lobby carries `ready` per rider (bots always true); every ride starts everyone unready. |
| `end` | | Host only: finish the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `code, host, difficulty, state ('lobby'/'running'/'done'), plan (expanded Plan), minutes, riders: [{id, name, tier, ftp, connected, look, bot, erg, titles, ready}], mutator`; `bot` is true for NPC riders (always `connected`, never host, hidden from `/api/rooms`); `titles` are held titles (`config.TITLES`) such as "🔨 Roadblock MVP"; `mutator` is this week's twist `{id, name, desc, ...}` or null. The crew game's `end` summary carries `titles`: lines like "Kat takes 🔨 Roadblock MVP from Dazza". |
| `tick` | `el, i, bel, ev, riders: {id: {name, tier, tgt, w, cad, s, st}}, bus, fx, load` |
| `end` | `summary` (GroupSummary, see `client/src/ui/results.ts`) |
| `error` | `msg` |

`data` also carries `hr` (bpm or null) and `hrp` (bpm / the rider's max heart rate, or null). Each rider in a tick has the same two fields.

`join` and `data` (bus and road rooms alike) may carry `sim: true`: the rider is on the simulated trainer, a test rider. In the lobby the join's value is the trainer now; once riding it only sticks. Lobby riders carry `sim`, and the `end` summary marks a test rider's row `test: true`. Test riders count for nothing: the ladder, crew best, campaign, titles and Discord see the result without them, and nothing at all when no real rider rode. A saved ride (`POST /api/rides`) carries `test: true` when the simulator was used; it is kept but counted nowhere.

Zombie Bus is the only crew game (the others went on 17/11/2026); the lobby still carries `game: 'bus'`. An old client's `{t:'game', game}` with any other id gets `error` "That game has gone. Zombie Bus is the crew game now." and the room stays a bus; `game: 'bus'` does nothing. A saved room of a game that has gone comes back as an empty bus lobby.

`tick.load` is what the targets of riders still on the bus are multiplied by while others have fallen off (1 when nobody has). `tick.i` is -1 during the countdown. `tgt` is the rider's target watts or null (ERG off).

`tick.stats` (from 2026-11-14; absent on the ticks in between and from older servers, and clients that do not know it ignore it) is each rider's ride so far, sent on the ride's whole seconds only: `{"<id>": {"ftp": 250, "kg": 72.5, "avg": 182, "np": 196, "on": 0.81, "kj": 412.3, "falls": 1}}`. The server works it out from the `p` it receives (average, NP over a rolling 30 s, kJ), the scored time on target (`on`, null before any) and its own fall count; `kg` comes from the rider's stored profile, null when they have not set a weight. Spectators are not sampled.
`st` is `riding`, `fell` or `spectator`. `ev` is `warmup`, `longhaul`, `rampup`, `surge`, `roadblock`,
`servo` or `cooldown`.

`bus`: `{speed (m/s), dist (m), armour (0..100), gap (m), sync (bool), tune (bool), rb (0..1 roadblock progress or null), combo, nitro (0..1 charge), boost (bool), streak (0..1 progress to the next streak reward), next (`drop`, `airstrike` or `gunship`), gunship (bool, gunship up)}`.

`fx`: list of `{k, text?, id?}`, one-shot effects since the last tick. `k` is one of
`drop, airstrike, gunship, nitro, challenge, challenge_won, challenge_lost, hit, grab, shake, smash, crash, fell, hauled, sprint, tune, slowmo, roadblock, servo, surge, longhaul`. `roadblock`, `servo`, `surge` and `longhaul` mark event starts.

## Road rooms (group free ride)

A room made with `{kind: 'road'}` is a ride on a bundled route. The server owns every rider's position; the
client sends what the trainer measures and draws what the server says. Same socket, same `join`, `watch`,
`bots`, `start`, `end` and `error` messages as a bus room. Every `lobby` message carries `kind` (`bus` or
`road`), so a client that joined the wrong sort of room by code can say so.

### Client → server

| t | Fields | Notes |
| --- | --- | --- |
| `join` | `name, ftp, tier, look` | As the bus (`tier` is ignored). The rider's weight comes from their stored profile (`weightKg`, default 75). Joining a ride that is already running puts the rider on the back of the group; the same id joining again takes its old place on the road back. |
| `road` | `route, laps, style, together?, draft?, game?` | Host only, not while running. `route` is a pack id from `content/routes`; `laps` is clamped to 1 unless the route is a circuit; `style` is `social` or `race`; `together` (the keep-together band) defaults to on for social and off for race, and is always off in a race game; `game` is the rule set (`ride`, `race`, `points`, `crit`; left out keeps the room's). |
| `bots` | `n` | Host only, not while running. 0..5 road bots; humans + bots fit the 8 places. |
| `data` | `p, w, cad, hr?` | About 2 Hz. Instant power, 3 s power, cadence, heart rate. No data for 3 s reads as zero power: the rider coasts to a stop and the ride goes on. |
| `start` / `end` | | Host only. `start` begins a 10 s countdown; `end` finishes the ride now. |

### Server → client

| t | Fields |
| --- | --- |
| `lobby` | `kind: 'road', code, host, state, route, laps, distance (m, all laps), style, together, draft, game, riders: [{id, name, ftp, kg, connected, look, bot, line}]`; `line` is a bot's one-line character, null for people |
| `tick` | `kind: 'road', el, riders: {id: {d, v, w, cad, hr, lane, draft, band, st, fin}}, game, fx`; 4 Hz |
| `end` | `summary: {kind: 'road', game, route, name, laps, distance, secs, style, together, podium?, riders: [{id, name, bot, place, time, dist, late, avgPower, wkg, saved, gap?}]}` |

`el` is ride seconds, negative during the countdown. Per rider: `d` metres along the whole ride (all laps),
`v` ground speed in m/s (the keep-together band included), `lane` metres right of the centre line, `draft` the
drag multiplier (1 is clean air, 0.73 is a 27% saving), `band` the keep-together scale on distance covered
(1 when off), `st` one of `riding`, `stopped`, `away` (socket gone) or `finished`, `fin` the rider's time in
seconds once finished. `game` is the rule set's own state (null for a plain ride). `fx` is a list of
`{k, id, text}`: `finish` (`text` the finishing place) and, in races, `bell` (`text` the banner, e.g. `LAST LAP`;
`id` null).

The games are `ride`, `race`, `crit` and `handicap`. A `road` message naming any other game (an old client's
`points` or `chaingang`, both gone) keeps the room's game; a room saved mid-way through one restores as a plain
ride. Races (`game` other than `ride`): the tick's `game` is `{kind, lap, laps}` (`lap` the leader's lap). The
summary adds `podium` (ids of the first three across the line) and each row's `gap` (seconds behind the winner,
null for a rider who did not finish). A crit's tick `game` adds
`prime` (the lap whose line is the prime) and `primeBy` (who took it, null before); its bells are `PRIME NEXT LAP`
as the leader starts the prime lap and `PRIME!` (with `id` the winner) at the line; its rows carry `prime` (true
for the winner) and the summary `award: {kind: 'prime', id}`. A race ends once every human present is home and three riders (or everyone)
have finished, or 3 min after the first rider home.

Results: `time` is null for a rider who did not finish; `dist` is what they rode; `late` marks a late joiner
(ranked after everyone who rode the whole way); `saved` is the average watts drafting saved them.

A road tick never carries a power target (`tgt`): the trainer only ever gets a gradient from the rider's own
position, through `ErgController.setGrade`.

## Drafting (road rooms)
- The host's `road` message can carry `draft: 'off' | 'realistic' | 'strong'` (left out keeps the room's level, strong by default). The road lobby carries `draft`.

## Crew game input (bus rooms)
- Client `{t: 'act', k, v?}`: a rider's input to the bus (an emoji, the servo's route vote). `k` is up to 24 of `a-z0-9_`; `v` is a boolean, a number, a string of up to 300 characters or absent. Dropped outside a running ride, during the countdown and past 8 in 4 s per rider.
- Tick riders carry `ask`: the bus's question to that rider right now, or null. `{k, title, sub?, opts: [{v, label, icon?, sub?, off?}], left?, v?}`: `left` is seconds to answer, `v` their answer so far, `off` an option they cannot pick. The rider answers with `{t: 'act', k, v}` using the question's `k` and an option's `v` (always a string).

## ERG or gears (bus rooms)
- Client `{t: 'erg', on}` at any time: this rider's trainer mode (ERG, or ERG off on virtual gears). Lobby riders and tick riders carry `erg` (default true).
- Host `{t: 'trainers', mode: 'choose' | 'erg' | 'gears'}` before the start: the ride's trainer mode, in the lobby as `trainers`. Unless it is `choose`, every rider's `erg` follows it.

## Downloads
- `PUT /api/rides/files/<name>` (logged in; body is the file, a .fit, .json or .png up to 8 MB) returns `{"url": "/api/rides/files/<key>/<name>"}`.
- `GET /api/rides/files/<key>/<name>` (no login) serves it as an attachment for 10 minutes; `?inline=1` serves it inline.

## Bus rooms, more
- `GET /api/rooms/{code}`: `{code, kind, state}` for a ride that exists (any case), 404 otherwise. The home screen checks a typed code with it before asking for a trainer.
- Crew ride summaries carry `crewBest`: the crew's best score in that game before this ride (null the first time). The server keeps one best per game (`bests` table; rows for games that have gone stay, unread).
- Old saved rides may carry `group.mode` of a game that has gone (`madness`, `ambo`, `date`, `climate`, `watch`, `last`, `ttt`, `quiz`, `galley`, `hunt`). History, results, postcards and the Strava post show the game's name and the plain numbers for them. A `sash` in a look (Climate Lawsuit's, now gone) is dropped on join.

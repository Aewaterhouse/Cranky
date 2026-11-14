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
| `join` | `name, ftp, tier, look` | First message. `look` is the cosmetics map (e.g. `{hat, outfit, paint, bullbar, spikes}`). It may also carry `body`, the rider's body from the character creator as a string (`1-50-45-…`: a version, then one whole number per option of `content/avatar.json`); the server clamps each value to its range and drops a `body` it does not understand, and a look without one shows the rider's default body. Same `id` reconnecting reclaims the slot. |
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
| `tick` | `el, i, bel, ev, riders: {id: {name, tier, tgt, w, cad, s, st}}, bus, fx, load` |
| `end` | `summary` (GroupSummary, see `client/src/ui/results.ts`) |
| `error` | `msg` |

`data` also carries `hr` (bpm or null) and `hrp` (bpm / the rider's max heart rate, or null). Each rider in a tick has the same two fields.

`{t:'game', game:'bus'|'madness'}` (host, not while running) picks the crew game; the lobby carries `game`. In VO2 Madness the plan is dealt by the server and `bus.mad` holds `{pts, red, crown, lead, round, rounds, work, box, next, twist}`; extra fx kinds are `go, rest, box, crown, lead, sandbag`.

`tick.load` is what the targets of riders still on the bus are multiplied by while others have fallen off (1 when nobody has). `tick.i` is -1 during the countdown. `tgt` is the rider's target watts or null (ERG off).

`tick.stats` (from 2026-11-14; absent on the ticks in between and from older servers, and clients that do not know it ignore it) is each rider's ride so far, sent on the ride's whole seconds only: `{"<id>": {"ftp": 250, "kg": 72.5, "avg": 182, "np": 196, "on": 0.81, "kj": 412.3, "falls": 1}}`. The server works it out from the `p` it receives (average, NP over a rolling 30 s, kJ), the scored time on target (`on`, null before any) and its own fall count; `kg` comes from the rider's stored profile, null when they have not set a weight. Spectators are not sampled.
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

## Drafting (road rooms)
- The host's `road` message can carry `draft: 'off' | 'realistic' | 'strong'` (left out keeps the room's level, strong by default). The road lobby carries `draft`.

## Crew game kit (bus rooms, from 2026-11-14)
- Tick riders carry `band`: `[lo, hi]` watts when the game sets this rider's target itself (then `tgt` is the middle of it), `"sprint"` or `"free"` for no target at all (`tgt` null), or null when the target is the plan's. Neither edge is ever over 150% of the rider's FTP.
- `tick.game` is the game's own state (null for Zombie Bus and VO2 Madness, which use `bus`).
- Client `{t: 'act', k, v?}`: a rider's input to the game (an emoji, a card, a choice, a vote). `k` is up to 24 of `a-z0-9_`; `v` is a boolean, a number, a string of up to 64 characters or absent. Dropped outside a running ride and past 8 in 4 s per rider. What `k` means is the game's business.
- Tick riders carry `ask`: the game's question to that rider right now, or null. `{k, title, sub?, opts: [{v, label, icon?, sub?, off?}], left?, v?}`: `left` is seconds to answer, `v` their answer so far, `off` an option they cannot pick. The rider answers with `{t: 'act', k, v}` using the question's `k` and an option's `v` (always a string).
- Speed Dating (`game: 'date'`): `tick.game` is `{g: 'date', phase: 'bar'|'date'|'gap'|'proposal'|'wedding'|'divorce'|'cool', n, of, theme: {id, name, icon, text} | null, pairs: [[a, b, match 0..1, points this date]], chap, card, profiles, emoji, emojiLeft, said, table: [{a, b, pts}], couple, exes, tandem, tug, chat}`; `tick.ev` is the phase. During the walk (`gap`) `n`, `theme` and `pairs` are already the next date's.
- A game can be marked never-ERG on the server. Its lobby then reports `trainers: 'gears'` and every rider's `erg` is false, whatever the host or the rider picked. Such a game deals its own plan of `free` blocks, so no client ever has a block target to send a trainer.

## ERG or gears (bus rooms)
- Client `{t: 'erg', on}` at any time: this rider's trainer mode (ERG, or ERG off on virtual gears). Lobby riders and tick riders carry `erg` (default true).
- Host `{t: 'trainers', mode: 'choose' | 'erg' | 'gears'}` before the start: the ride's trainer mode, in the lobby as `trainers`. Unless it is `choose`, every rider's `erg` follows it.

## Downloads
- `PUT /api/rides/files/<name>` (logged in; body is the file, a .fit, .json or .png up to 8 MB) returns `{"url": "/api/rides/files/<key>/<name>"}`.
- `GET /api/rides/files/<key>/<name>` (no login) serves it as an attachment for 10 minutes; `?inline=1` serves it inline.

## Climate Lawsuit (`game: 'climate'`)
- A bus room, never on ERG. The plan is free blocks with `kind` (`eighties`, `decade`, `trial`, `cool`); decades also carry `decade` ("1990s") and `n` (1 to 4). `tick.ev` is the kind.
- `tick.game`: `{g: 'climate', phase, decade (on a decade, else null), n, level (0..1), stage (0..4), stageName ('' | 'Beach' | 'Surf club' | 'Main Street' | 'Everything'), walls, wallCost, cos: {id: {name, fuel, coins, on}}, event: {k: 'heat' | 'kettle' | 'miner', name, text, left} | null, cue: {id: {k: 'gust' | 'surge', left}}, trial, ledger, flooded}`.
- `trial` (null before the Trial): `{defendants, target (% FTP, null while the jury votes), held (the first defendant's share of the dock held so far), heldBy: {id: share}, verdicts: {id: 'acquitted' | 'guilty'}}`. `ledger` (null before the Trial): `{id: {emit (tonnes), bribed, walls}}`.
- Questions (`ask`, answered with `act` of the same `k`): `fuel` (`coal` | `gas` | `solar` | `wind`, in the last 30 s before each decade), `bribe` (`yes` | `no`, the lobbyist's envelope to one company), `appeal` (`yes` | `no`, to a sashed rider while the jury votes), `verdict_target` (`90` | `100` | `105`, to everyone but the defendants while the jury votes). Plus `act` `wall` (any value): build a seawall.
- fx: `stage` (a new flood stage), `flood`, `blackout`, `wall` (id: who built it), `verdict` (id: the defendant), `say`.
- Summary: `mode: 'climate'`, `score` (all companies' coins, 0 if flooded), `distance`, `flooded`, `level`, `stageName`, `walls`, `verdicts`, `awards`, rider rows with `company`, `coins`, `emit`, `bribed`, `walls`, `fuel`, `verdict`.
- The GUILTY sash: the server adds `look.sash: true` to a rider's look on join (bus and road rooms) while they wear one; a `sash` in a join message or a saved profile is dropped. It is stored apart from the profile (`sashes` table) for 30 days from a guilty verdict in a flooded town, and comes off on an acquittal.

## Kidney Stone Express (`game: 'ambo'`)
- A bus room, never on ERG. The plan is free blocks with `kind` (`base`, `run`, `ramp`, `cool`) and, on runs, `patient` (`hook`, `kidney`, `magpie`, `bin`, `trainer`). `tick.ev` is the phase: `base`, `run`, `ramp`, `reverse` or `cool` (a crew that arrives early is already in `ramp` while the run block finishes).
- `tick.game`: `{g: 'ambo', phase, run, runs, patient: {id, name, icon, line} | null, comfort (0..100), dist (metres left), total, speed (km/h), par (seconds left in the run block), eta (seconds at this speed, or null when stopped), event, brake, perk: null | 'spike' | 'green', sweet (0..1), queue (seconds left in the hospital queue), reviews, score, siren}`. `patient` is null once they are delivered or have walked.
- `reviews` (finished runs, also in the summary): `{id, patient, icon, comfort, delta (seconds early, negative late), walked, fell, pts, stars (1..5), text}`.
- `event` (the road event in progress, or null): `{k: 'green' | 'roadworks' | 'hump' | 'siren', name, text, left (seconds), who (the siren rider's id, else null)}`. `siren` repeats `who`. In the first half of a `hump` the text is the 3-2-1 and no band has changed yet. The siren rider's `band` is `"sprint"`.
- fx kinds: `say` (radio banter, patient lines and how each road event ended; `id` is the siren rider on a siren result), `delivered`, `fellout`, `walked`, `perk`, `fine` (`id` is the rider) and `review` (stars and the review, right after `delivered` or `walked`). All carry `text`.
- Summary: `mode: 'ambo'`, `score`, `distance`, `delivered`, `reviews`, `awards` and rider rows with `spread` (mean roughness, % of FTP), `spikes` and `fines`. Not on the season ladder.
- No `act` keys: the game takes no input but power and cadence.
- `tick.ev` is now read from the game after its tick (it was read before), so it always matches `game.phase`.

## Watch party (`game: "watch"`, from 2026-11-14)
- A crew game on the host's workout, with ERG as in the bus. `tick.game` is `{g: "watch", vid, title, playing, pos, at, queue: [{vid, title, by}]}`: the video is `pos` seconds in at ride time `at`, and runs on from there while `playing`. Each client keeps its player within 2 s of that.
- `act` keys: `add` (an 11-character YouTube video id; anyone; the first one starts playing, the rest queue, at most 20), and for the host only `play`, `pause`, `seek` (seconds, plus or minus, at most 600) and `next`. A watch party takes `act` during the countdown too (`CrewGame.early_acts`).
- `tick.hold` (bool): the game has stopped the room's clock (`CrewGame.holds`). A watch party holds while its driver has the video paused, so the workout waits too; clients freeze their local plan clock while it is set. A watch party sends `tick.game` during the countdown as well.
- Watch party `act` keys, more: `emoji` (one of six; anyone; comes back to everyone as fx `emoji` with the rider's id), and for the host `up` and `drop` with a queued video's id.
- Watch party sources: `add` takes a YouTube id, `tw:<channel>` (a Twitch stream: live, shown but never synced) or `url:https://…` (a .mp4, .webm, .ogv or .mov file, synced like YouTube). `title` is the source, a tab, then the title. `act` values may be up to 300 characters, for links.

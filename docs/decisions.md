# Decisions and invented mechanics

Assumptions made without the owner. Tune freely; numbers live in `client/src/config.ts` and
`server/src/zombie_bus_server/config.py`.

## Plans and tiers
- A block's `pct` is either one number (the Hard tier %) or `{hard, medium, easy}`. A single number is scaled by tier factor: Hard 1.0, Medium 0.9, Easy 0.8.
- `ramp` and `over-under` take `pct: [a, b]`. Over-unders alternate a then b every `step` seconds.
- A `set` block (`rep` + `blocks`) repeats its contents. The generator changes the first set's `rep`, then pads or trims the first and last blocks in 30 s steps. Plans without a set stretch their longest steady block.
- Block to event mapping: first block = warm-up, last block = cool-down, sprint = Roadblock, over-under = Horde Surge, free or steady below 60% = Servo Stop, everything else = Long Haul. Ramp-up is not built yet.
- Free blocks and sprints both turn ERG off. The trainer goes to sim mode at 0% grade.

## ERG
- The 2 s smoothing restarts a linear ramp from the current value whenever the target moves by more than 1 W. On a steady ramp block that gives roughly a 2 s lag, which is fine.
- The server also caps targets at 150% FTP, as belt and braces.
- At the end of every ride the ERG failsafe runs: 50% FTP, then release.
- ERG targets in the crew game are pre-scheduled from a local estimate of the server clock (`net/clockSync.ts`): a 4 Hz timer computes the frame for the estimated session time, so block and over-under changes land on time instead of waiting for the next 2 Hz tick. The estimate runs about one network delay behind the server (latency is not measured). The tick stays authoritative for tier, targets within a block, and the HUD.

## Power curve and sprints
- Default curve points not listed in the plan: 1 s 400%, 2 min 130%, 10 min 110%, 60 min 100% of FTP.
- Sprint durations between curve points are log-time interpolated. If either neighbouring point is a default, the grade caps at GREAT.
- 90-day best is the best real effort from the last 90 days, falling back to the all-time real best, then to the default.
- MEGA means beating the 90-day best but not the all-time best. LEGEND means beating the all-time best.
- Sprints are graded on the client (it holds the curve) and the server trusts the result. Friends only.
- The combo builds per rider on consecutive GREAT-or-better sprints. Each step adds 25% to roadblock damage and scrap.

## Zombie Bus
- The gap changes at `GAP_K × (group compliance − neutral)` m/s. Neutral depends on the event: warm-up/cool-down 0.5, servo 0.3, long haul 0.8 (creeping up 0.02 a minute, max +0.1), surge overs 0.85 and unders 0.95. Bus speed is mostly visual and feeds distance and scrap.
- A rider with null compliance (sprint or free) counts as 1.0 in the group mean.
- When the gap hits 0: −5 armour, horde knocked back to 25 m. At 0 armour the bus limps at 60% speed and takes no more damage.
- Horde Surge: −12 m grab at the start of every under step. An over averaging ≥0.8 compliance shakes them off for +15 m and +5 scrap.
- Roadblock: HP is 40 per active rider. Damage per grade is HIT 40, GREAT 80, MEGA 100, LEGEND 120 (times combo). FAIL = −6 armour and a −10 m grab. It resolves when everyone has reported or 4 s after the block ends. Smash = +20 scrap and +20 m. Not smashed = −10 armour.
- Cadence sync: every active rider pedalling (≥30 rpm) within ±5 rpm of the group median, with 2+ riders. Held 8 s it becomes Engine in tune: ×1.25 speed and +1 m/s gap. The "leader" is the median, so no single rider dictates.
- Fell off: compliance below 0.6 for 30 s. The rider drops a tier and is excluded from the group mean for a 20 s haul. If the others average ≥0.85 compliance over the haul, the team gets +30 scrap. Either way the rider is back on afterwards, and can't fall again for 60 s.
- A disconnected rider becomes a spectator immediately and returns on reconnect. Slots are kept for the life of the room, not just 60 s. No data for 3 s counts as zero power, and 60 s of zero power also makes a spectator.
- End score = distance/10 × (0.5 + armour/200) + scrap.
- Awards go to the top rider in each category, only if that rider's value is above zero.

## Phase 4
- Bus scrap is a shared tin for the ride. At a Servo Stop anyone can spend it on session upgrades: plating +25 armour (40), horde repellent that absorbs the next hit or fail (60), sync window +3 rpm (50).
- At the end of the ride each rider banks whatever is left in the tin, plus 25 per award they won, into their own balance.
- Cosmetics are bought with personal scrap in the garage. The bus shows the host's (driver's) paint and parts. Riders show their own hat and outfit.
- Profile, scrap and owned items live in localStorage and sync to the server; the newer `updated` wins. It isn't cheat-proof, and it doesn't need to be.
- Route vote at Servo Stop is not built.
- Shop items are bought with a `buy` message at a Servo Stop: plating 40, repellent 60, sync 50 scrap.

## Tech
- No asset packs yet. Everything is procedural Three.js primitives and WebAudio synth sounds, which sidesteps licence and style-mismatch issues for now.
- Commits are per phase chunk rather than per checklist item, to keep momentum.

## Accounts, solo and UI
- Accounts are name = password (case-insensitive) for six seeded friends (`SEED_USERS`). Passwords are hashed and tokens are random, but there is no rate limiting or signup. Friends only; the owner plans to host over Tailscale. The profile is still cached in localStorage and synced to the server.
- The FTP suggestion only ever suggests an increase (95% of the 20 min best beats FTP by more than the threshold). A sub-maximal workout must never suggest lowering FTP.
- The plan picker scales every card to the chosen length, so the graphs show what you will actually ride.
- Solo is an ERG workout player with no 3D, and the bus game is crew-only. A crew of one still works as a solo bus.
- Solo controls: pause drops ERG to 40% FTP; auto-pause after 3 s of zero power or cadence, resuming after 1.5 s of pedalling (never during sprints); intensity 50 to 150% in 1% steps scales ERG targets (still capped at 150% FTP). Load is shown as NP (30 s rolling, 4th-power mean), IF and TSS.
- CSS is split per area: `style.css` (tokens), `ui.css` (shell, login, modal), `screens.css` (tabs), `setup.css` (picker, solo setup, lobby, rider stats), `solo.css`, `results.css`, and `hud*.css` (HUD, class prefixes keep it separate).
- Icons are emoji for now (no icon assets to license).

## Product (2026-11-12, owner decisions)
- The app is called **Cranky**. Zombie Bus is the first game inside it. The code and UI still say "Zombie Bus" until the rebrand item in `docs/roadmap.md` is done.
- Six bus seats stays.
- Strava export is parked. Watch party (shared video plus synced ERG workout) is on the roadmap.

## Trainer auto-reconnect (2026-11-12)
- On `gattserverdisconnected` the FTMS driver retries `gatt.connect()` after 1 s, 2 s, 4 s, then every 5 s, forever, until `close()` (picking another trainer). It re-fetches the service and characteristics, re-attaches the notification listeners and clears its control flag, so the next ERG write re-requests control.
- While away, `ErgController` writes nothing and does not count failures. On return it re-requests control and re-sends the target. Live power and cadence read 0 meanwhile, so solo auto-pause behaves. Failsafe now needs 5 consecutive failed writes with the trainer present.
- Untested on real hardware: only the simulated trainer (`dropFor`) exercises this path.
- Rooms survive a server restart: running and lobby rooms are snapshotted to the SQLite `rooms` table every 5 s while running and on each lobby change (JSON via `to_dict`/`from_dict`, no pickle). Snapshots older than 15 min are dropped at startup. A restored running room has all riders disconnected and its clock paused; the first `join` resumes it from the saved `el`. Done rooms delete their snapshot; idle ones are deleted by the room cleanup.
- Bots (host sets 0..5 in the lobby; `server/src/zombie_bus_server/bots.py`, numbers in `config.py`): named Dazza, Shazza, Bluey, Robbo, Kev; FTP 200 to 260, random tier, random hat and outfit. Compliance random-walks inside 0.85 to 1.0 (step sd 0.01 per tick) with a bad patch about once per 10 min per bot (0.4 to 0.58 for 30 to 50 s, so they can fall off). Power is target x 0.97..1.03 (scaled down in a bad patch); cadence is the humans' median +/- 3 rpm, 88 with no humans. Sprint grades at block end: FAIL 10%, HIT 45%, GREAT 35%, MEGA 9%, LEGEND 1%, with a bot-side combo. Bots count in group compliance and the summary, are always connected, never host, never spectate, and give up a seat when a human joins a full bus. Randomness is seeded from room code and bot id.
- Backups: the server copies the SQLite database at startup and every 24 h into `server/backups/`, keeping the newest 14. Restore by stopping the server and copying a backup over `server/zombie_bus.db`.
- Discord: text summary only, sent from the server at ride end when `ZB_DISCORD_WEBHOOK` is set. A failed post is logged and ignored.
- Workout library: 57 plans, each with a `goal` (bus, recovery, endurance, tempo, sweet-spot, threshold, vo2, sprint). The picker filters by goal and opens on the selected plan's goal. Short hard efforts above 30 s use steady blocks at up to 150% FTP, since sprint blocks are capped at 30 s.
- Installable app: web manifest, icon and a small service worker (network first, cache fallback; never caches /api or /ws). Offline, the last logged-in rider on that device can still open the app and ride solo; the ride is saved locally but not uploaded to the server afterwards.
- Ramp-up: a ramp block that is not the warm-up or cool-down is the Ramp-up event (neutral 0.82). The scene shifts to a misty valley mood and the camera drops and looks up the road to sell the climb. "Valley of the Dead" is the bus run built around it.
- Difficulty: easy/normal/hard/nightmare shift every event's neutral compliance by -0.08/0/+0.05/+0.10, scale armour damage by 0.6/1/1.3/1.7 and the final score by 0.8/1/1.25/1.6.

## Heart-rate strap (2026-11-12)
- Client-only for now: HR is recorded in the ride summary (`hr[]`, `avgHr`, `maxHr`, null when no strap) and posted with the solo ride, but it is not sent to the server during a ride and other riders do not see it.
- `trainer/heartRate.ts` holds the BLE driver (service 0x180D, characteristic 0x2A37, uint8 or uint16 by flags bit 0), reconnecting with the same 1, 2, 4, then 5 s backoff as the trainer, plus a module singleton (`currentHr()`). `RideController` reads it once a second for `live.hr` and the recorder.
- Simulated HR (offered in the trainer modal once the simulated trainer is in use): resting 60 bpm plus 115 bpm times power/FTP (so 175 at FTP, capped at 200), approached with a 30 s first-order lag. Numbers live in `CFG.hr`.
- `Profile.maxHr` is optional. With it set, the solo HR tile is coloured by zone: below 60%, 60-70, 70-80, 80-90, 90%+ (blue, teal, amber, orange, red).

## Ride crash recovery (2026-11-12)
- Solo: every 5 s (`CFG.recovery.saveMs`) `localStorage["cranky.solo.<riderId>"]` gets the generated plan, plan time, intensity, tier, the recorder (`RideRecorder.toJSON`), the chart x positions, compliance sums and a wall-clock stamp. The Ride tab offers "Resume your workout?" for a snapshot under 30 min old (`CFG.recovery.maxAgeMs`). Resume restarts with the normal 5 s countdown at the saved plan time; the gap while the page was away is simply not recorded. Ending or finishing a ride clears it. Nothing is saved before the first recorded second.
- Crew: `cranky.bus.<riderId>.<code>` holds the rider's recorder only (plus plan id); the server still owns the clock. `startBusRide` restores it when the code and plan id match and it is under 30 min old. It is cleared on finish or leave.
- The last bus code is also kept in `localStorage["cranky.buscode.<riderId>"]` so a closed tab can find its way back. The Ride tab shows "Rejoin bus ABCD" only when `/api/rooms` lists that code. The server lists a room only while someone is connected, so a rider who was alone on the bus will not get the card after a refresh (the code field is still prefilled from sessionStorage). Listing rooms that are running but empty would fix it; left for a server change.
- Sprint combo is not restored (it restarts at 0).

## ERG pre-scheduling (2026-11-12)
- `ClockSync` keeps (el, arrival time) for each tick, measures the rate over the last 4 s (1 normally, so a time-scaled test server works), clamps it to 0.5-30, eases small errors out at 20% per tick, snaps when more than 1 s out, never runs backwards except on a snap, and goes quiet after 3 s without a tick.
- Nothing is scheduled during the countdown (tick `i < 0`) or after the last tick. The ErgController's 2 s ramp is unchanged. Within the same block the server's own `tgt` still wins; across a block boundary the local frame wins until the server tick catches up.


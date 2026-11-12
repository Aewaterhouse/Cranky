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

- Graphics quality: four levels (potato, low, medium, high) change pixel ratio and shadows. Auto mode starts high, drops a level after two 2-second windows under 40 fps and never climbs back to a level that proved too slow. `?gfx=low` (or potato/medium/high/auto) pins it; a settings screen control is still to come.
- Settings are per device (localStorage), not per account: a TV and a laptop want different sizes and quality. The colour-blind palette is Okabe-Ito.
- Announcer: browser speech synthesis, en-AU voice if installed, else en-GB, else any English. At most one line every 3.5 s; roadblocks, falls and MEGA/LEGEND sprints interrupt. Off switch in Settings.
- Nitro: group compliance of 0.95 or better during long hauls, ramp-ups and surges fills the meter in 75 s; below that it drains over 150 s. Full fires automatically: 15 s at 1.3x speed, +2.5 m/s of gap and 15 scrap. It fires by itself so nobody has to reach for a key mid-effort.
- Personal challenges: every 150 to 240 s during a long haul or ramp-up, one human rider gets a 20 s cadence drill (105+ rpm, or 65 rpm and under). Holding it for 70% of the window pays 12 scrap. Cadence only, because ERG holds the power; a "hold exact watts" challenge would be meaningless in ERG.

## Rider data: deeper profile (2026-11-12)
- The Rider tab has sub-tabs (Overview, Power, Settings, later History and Trends). The chosen sub-tab is remembered until reload.
- `ftpHistory` logs only changes (via `recordFtp`). Rides before this change have no history, so the chart ends with today's FTP as its last point.
- Custom power zone bounds change the zone table and watt ranges only. Recorded time in zone keeps the standard bounds (`CFG.zones`) so rides stay comparable.
- HR zones use the existing 60/70/80/90% of max boundaries. A resting HR switches the bpm to heart-rate reserve (Karvonen).

## Rider data: power curve chart (2026-11-12)
- Hover and tap snap to the ten stored durations (no interpolated durations), so every value shown is a real best or an honest estimate.
- "Last ride" is the newest ride in the profile and shows only real points. The 90-day line falls back to the all-time point when nothing in the window beats it, as `curves()` does.
- W/kg mode needs a weight in Settings; the toggle is disabled without one.

## Rider data: ride history (2026-11-12)
- Rides are private: another rider's ride id gets a 404, not a 403.
- The "crew" flag is added by the client when it posts a bus ride (`finishRide`); older rides read as solo.
- Deleting a ride removes it from the server and from the profile list and lifetime totals (rides, time, kJ, zones). All-time bests and the weekly streak are left alone because they cannot be unwound.
- The list comes from the server (all rides), so it can show more rides than the profile's last 200.

## Rider data: fitness trends (2026-11-12)
- CTL and ATL are exponentially weighted averages with a 42 and 7 day time constant (`1 - exp(-1/n)` per day), started from zero at the first ride. TSB on a day is the previous day's CTL minus ATL (morning form).
- Rides without a recorded TSS are estimated from time in each zone at a typical IF per zone (0.45, 0.65, 0.83, 0.98, 1.12, 1.35, 1.8), or at IF 0.65 with no zones. New rides store `tss` and `np` on the profile record via `rideRecord()` in `results.ts`.
- Days are local calendar days; weeks start on Monday.
- Streaks and the heatmap use the last 200 rides kept on the profile, so a best streak older than that is not counted.
- Heatmap shades: under 40, 80, 130 and over TSS.

## Rider data: badges and PR timeline (2026-11-12)
- "100/500/1000 km-equivalent kJ" was read as lifetime energy: 5,000 kJ (Pie Burner, about a dozen meat pies), 25,000 kJ and 100,000 kJ. Other badges: 1, 10, 50 and 100 rides; 300, 400 and 500 W for a minute; four weeks in a row; 1,000 kJ in one ride; a LEGEND sprint.
- Earned badges are saved on the profile (`badges`, id to date) when the Overview opens, so they stay earned after old rides drop off the 200-ride list. A LEGEND sprint is flagged on the ride record (`legend`) and saved by `applyRide`. Dates come from the kept rides where possible.
- The PR timeline replays the kept rides in date order and adds any all-time best older than them.
- Season ladder: seasons are calendar quarters, named by the Australian season they start in. Every finished bus ride is stored; the ladder shows the top 20 runs by score, riders ranked by their best score, and one title per award type for whoever won it most. Bots never appear.
- Weekly mutator: chosen by ISO week number, shown in the lobby, applied automatically to normal and harder rides. No host toggle; easy difficulty is the opt-out.

## FTP tests (2026-11-12)
- Two plans with goal `test` (and a plan-level `test: "ramp" | "ftp20"` marker): `ftp-ramp-test` and `ftp-20min-test`. They are plain JSON; the ramp steps are 18 one-minute steady blocks (46% to 148%, so under the 150% cap) labelled "Ramp N%". The measured blocks are found by label ("Ramp ..." to "Cool-down", or "20 min test"). The picker has no "test" group and I may not edit it, so the tests live on a "Test your FTP" card on the solo setup screen (and under All).
- Test plans always ride at the hard tier and 100% intensity: the tier and intensity controls are hidden and ignored, or the percentages would be meaningless. The rider's own tier is restored afterwards.
- Ramp ends when the rider presses "I'm done" or has been under 50% of the target for 10 s (real seconds, counted even while auto-paused). Either one jumps the clock to the cool-down. Result = 75% of the best 60 plan seconds inside the ramp (needs at least 54 s and 3 samples).
- 20 minute test: the blow-out and the 20 minutes are `free` blocks (ERG off). Result = 95% of the mean power over the 20 minute block; needs at least 90% of it ridden, else no result is offered.
- The result prompt (Accept / Keep old) appears when the ride ends, before the usual results screen. Accept sets `profile.ftp` and saves it; there is no FTP history helper yet. Ending a ramp early still offers a result if a full minute was ridden.
- The test plans also appear in the bus lobby picker (not mine to hide); a bus ride with a free block works but is pointless.

## Resistance and slope modes (2026-11-12)
- The solo player has a Mode switch: ERG (default), Resistance (0-100%, steps of 5) and Slope (-5% to +15%, steps of 1, starts at +2%). Keys: E, R, G switch; `,` and `.` lower and raise the level. The ErgController owns it (`setResistance`, `setGrade`, `setErg`): while off ERG it writes only `setResistance` or `setSim` (once, and again only when the level changes or the link returns) and never `setPower` or the ERG ramp. The 50% FTP failsafe at the end of a ride still uses `setPower`, as it is the safe release.
- FTMS Target Resistance Level (op 0x04) takes a uint8 in units of 0.1 (unitless). The spec gives the trainer's real range in the Supported Resistance Level Range characteristic (0x2AD6), which I do not read yet. I assume 0-100% maps onto 0 to 10.0 (raw 0 to 100, `CFG.ftms.resMax`) and clamp to 255. UNTESTED ON HARDWARE: some trainers have a different range (a different `resMax`, or the characteristic should be read), and some do not support op 0x04 at all.
- Slope mode reuses the simulation write (op 0x11) with the default rolling resistance and drag, so the trainer's own physics applies. Slope mode at exactly 0% is the same write as the sprint and free-ride "ERG off" state.
- Scoring in non-ERG modes still uses the plan target (the rider aims for it themselves). The target tile reads "Aim for · ERG off" with an amber border. The mode and its level are not saved in crash recovery (a resumed ride starts in ERG).
- Tests and fast checks: SimTrainer gets simple physics. Resistance: watts = level x cadence / 30 (50% at 90 rpm is 150 W). Slope: speed = cadence x 0.075 m/s per rpm (a fixed gear), 80 kg, Crr 0.005, CdA 0.32, so +5% at 85 rpm is about 280 W. At 0% grade the sim keeps using the arrow-key watts (that is the sprint and free-ride behaviour), so physics only applies off 0%.
- FTP tests lock the mode to ERG (the switch is hidden).

## Cadence targets (2026-11-12)
- A block may carry `cad: [lo, hi]` (rpm, 0 < lo <= hi). `parsePlan` rejects anything else and keeps the band through `set` expansion; `frameAt` passes it on. The Python server reads the same JSON and ignores the field (its tests still pass; no server code changed).
- Scoring is separate from power compliance: the player counts, per block, the recorded seconds with cadence inside the band (stopped pedalling counts as out). It is shown under the interval as "Cadence 110-120 rpm · 82% in band" (green from 80%) and is not part of the ride summary or results.
- The cadence tile shows the band in place of "rpm" and is green inside it, amber outside. The chart draws bands (translucent blue, on the 40-140 rpm scale) only while the "Cadence line" toggle is on. Seconds spent paused are not counted. A resumed ride rebuilds the tally from the saved cadence samples.
- Three cadence drills (goal endurance): `cad-spin-ups` (8 x 1 min at 110-120), `cad-low-strength` (5 x 4 min at 80% and 55-65 rpm), `cad-pyramid` (90 up to 120 and back, 3 min each).

## Coach text cues (2026-11-12)
- A block may carry `cues: [{at, text}]` (seconds into the block, text non-empty). The parser checks the shape and keeps the cues through set expansion, so a cue inside a repeated set shows on every rep. The server ignores the field.
- The player shows a cue as a pill over the top of the main chart for 8 s (`CFG.cueS`, real seconds, so `?fast` does not shorten it), with a soft two-note sine chime. It does not block anything and replaces an earlier cue still showing. Each cue shows once per ride; if several fall due in the same tick (a skip, a fast clock) only the newest shows. Cues in a skipped block, and cues before the resume point, stay quiet. Nothing fires while paused.
- Cues added to 8 workouts: both FTP tests, ss-3x20, ss-2x20, thr-2x20, over-under-2x16, vo2-4x4 and z2-90.

## Extend cool-down / add time (2026-11-12)
- In the last block, and on the "workout complete" moment, the player shows "+5 min" and "Finish now". +5 min appends an easy block ("Extra easy", 50% FTP in every tier, ignoring the tier factor); pressing it again grows that same block, so it is repeatable. Steady blocks also get "+1 min" (any steady block, current one only; later blocks shift). Ramps, over-unders, sprints and free blocks cannot be stretched. FTP tests only offer the end buttons, not +1 min, since the steps are the test.
- The player works on a private copy of the plan's blocks (the parsed workouts are shared objects), so extending never changes the library. The chart is rebuilt from the blocks every frame and the interval list adds a row and refreshes durations, so both stay in step. Crash recovery saves the extended plan.
- On reaching the end the clock stops and "WORKOUT COMPLETE" shows with a 20 s countdown (`CFG.extend.graceS`, real seconds) before the ride finishes by itself, as it used to straight away. +5 min cancels the countdown. During it the trainer eases to 40% FTP and nothing is recorded (same as a pause).
- Code split to keep drill.ts under 300 lines: `liveTally.ts` (incremental stats), `overlays.ts` (centre message choice), `keys.ts` (key map), `extend.ts`.

## Free ride physics (2026-11-12)
- Speed comes from a plain power balance: rider (`profile.weightKg`, default 75 kg) plus a 9 kg bike, Crr 0.004, CdA 0.32, air density 1.225, 97.5% drivetrain efficiency (`CFG.freeRide`). 200 W on the flat gives about 33 km/h and 250 W at 8% about 12.5 km/h for 84 kg (the roadmap's rough 10-11 km/h figure did not survive the arithmetic).
- Speed is integrated each tick in 0.1 s sub-steps. Drive force is capped at 600 N and the speed floor for the force is 0.5 m/s so starting from a standstill is stable. Speed never goes negative (no rolling backwards) and is capped at 22 m/s (about 80 km/h; the rider brakes on very steep descents).
- `trainerDifficulty` (default 0.5) multiplies only the gradient sent to the trainer, which is then clamped to -10..+20%. The simulated speed always uses the real road gradient.

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
- Media corner: a floating panel in the solo player that embeds a pasted YouTube video or playlist (via youtube-nocookie) or a Twitch channel. Videos whose owners block embedding will not play; Netflix and similar cannot be embedded at all.
- Ghost: the most recent solo ride of the same workout name longer than 5 minutes, fetched from the server at the start. It is plotted by elapsed second, so a ghost with pauses or skips drifts against the plan.
## TV spectator mode (2026-11-12)
- A spectator is a WebSocket that sends `watch` first. The room keeps them in `Room.watchers`, separate from seats, so the same account can ride on a laptop and watch on a TV. Spectators are never counted as riders or for idle and pause logic, and anything but `watch` from their socket is ignored. The old pre-`join` `connect()` hook was removed because it would have hijacked a seated rider's socket.
- Auth is kept: the TV logs in as any rider. `/?watch=CODE` goes straight to the view after login; no trainer is needed.
- Ticks carry no sprint history, so the TV board builds each rider's sprint grades from `sprint` fx lines since it joined (a late joiner misses earlier grades).
- The TV HUD reuses the header, bus panel and splash pieces, laid out 600 px tall and CSS-zoomed to the screen (`CFG.tv`). The end summary is a plain full-screen group view, never `finishRide`, so nothing touches a profile.
- A full bus on the home screen shows "Bus full · Watch" (the seventh rider spectates).

## Free ride physics (2026-11-12)
- Speed comes from a plain power balance: rider (`profile.weightKg`, default 75 kg) plus a 9 kg bike, Crr 0.004, CdA 0.32, air density 1.225, 97.5% drivetrain efficiency (`CFG.freeRide`). 200 W on the flat gives about 33 km/h and 250 W at 8% about 12.5 km/h for 84 kg (the roadmap's rough 10-11 km/h figure did not survive the arithmetic).
- Speed is integrated each tick in 0.1 s sub-steps. Drive force is capped at 600 N and the speed floor for the force is 0.5 m/s so starting from a standstill is stable. Speed never goes negative (no rolling backwards) and is capped at 22 m/s (about 80 km/h; the rider brakes on very steep descents).
- `trainerDifficulty` (default 0.5) multiplies only the gradient sent to the trainer, which is then clamped to -10..+20%. The simulated speed always uses the real road gradient.

## Free ride: GPX routes and the ride loop (2026-11-12)
- GPX is read with a regex over `<trkpt>` / `<rtept>` (no DOM, so vitest can run it). Distance is cumulative haversine, ignoring elevation. Missing `<ele>` is interpolated between neighbours (flat if none at all). The route is resampled to 10 m, elevation is smoothed with a ±50 m (100 m) symmetric moving average that shrinks at the ends so start and finish heights stay put, gradients are per-sample and clamped to ±20%. Ascent is the sum of rises in the smoothed profile.
- Routes over 40 km get a wider sample spacing (a multiple of 10 m) so no route stores more than 4000 samples. Imported routes live in `localStorage` (`cranky.myRoutes`); if the browser refuses the write the import says so.
- A free ride uses `RideController` for recording with a synthetic `free` frame whose `tgt` is null, so nothing is scored. The trainer is driven by `ErgController.setGrade` in the free-ride range (-10 to +20%, 0.1% steps); no ERG power is ever written. The grade is re-sent whenever it moves by more than 0.2% or once a second.
- The ride recorder gets a one-block `free` plan named after the route, with a duration estimate at 75% FTP. `distance` and `ascent` are additive fields on the summary; the results screen shows Distance and Climbed tiles in place of Compliance when they are present.
- Auto-pause: 3 s of zero power or cadence stops the clock, but only once speed has dropped under 2 m/s, so coasting down a hill does not pause the ride. The ride starts paused ("Start pedalling") until 1.5 s of pedalling. While paused the trainer is sent 0% gradient.
- The ride ends on reaching the end of the route, or with End ride. `?fast=N` speeds the ride clock up N times (physics and distance), as in the solo player; recording stays at 1 Hz real time.
- Trainer difficulty is remembered per browser (`cranky.trainerDifficulty`), default 50%.

## Free ride: elevation profile and map (2026-11-13)
- Two canvas profiles: the whole route (ridden part dimmed) and a strip from 100 m behind to 900 m ahead. Columns are coloured by gradient: green under 2%, yellow under 5%, orange under 8%, red under 12%, then magenta.
- The map is Leaflet 1.9.4 (new dependency, BSD-2-Clause) with standard OpenStreetMap tiles and attribution. It is loaded lazily and only when the route has coordinates and the browser is online; any failure just hides the panel, so offline rides and tests never depend on it.
- The player now also shows climbed / climb to go, ETA at the average speed so far (with a clock time), average power, NP and W/kg.
- This item was finished from uncommitted work left when the PC was switched off mid-session. It passes type-check, lint, unit tests and build but nobody has looked at it in a browser yet.

## Compare with mates (2026-11-13)
- `GET /api/crew/curves` returns every rider's name, weight and all-time bests (from stored profiles). Any logged-in rider may see it; it is a crew of friends, and profiles were already readable by id.
- Overlay shows crewmates' real all-time bests only (no FTP estimates), as coloured chips above the chart. In W/kg mode each mate is divided by their own weight; mates with no weight are hidden there, and left out of the W/kg leaderboard.
- Leaderboard is all-time bests at 5 s, 1 min, 5 min and 20 min (`CFG.crewDurations`), including the viewer, who is highlighted. Mate colours are in `CFG.crewColours`.
- Bests are as last synced to the server, so a mate's newest ride shows once their profile has synced.

## Big chests on every character (2026-11-13)
- A joke change on the `Steven` branch: every rider and every zombie now has two large spheres on the chest. Size is `VIS.bust` in `client/src/scene/params.ts` (0 hides them). It is read once when a figure is built, so it is not a live slider in the debug panel.
- Riders: the spheres are children of the torso and share the jersey material, so they follow the lean, outfit colour and spectator fade. Zombies: merged into the instanced torso geometry, so no extra draw calls.
- Passes type-check, lint and unit tests. Zombies checked in the scene dev page; riders not yet seen from the front.

## Streak rewards: supply drop, air strike, gunship (2026-11-13)
- Killstreak-style air support for clean group riding, with our own names and look. The streak counts seconds of group compliance at 0.9 or better (`STREAK_MIN`) during long hauls, ramp-ups and surges. Rewards come in order, then the streak starts again: 45 s supply drop (+15 scrap), 90 s air strike (+15 m of gap at once), 150 s gunship (20 s at +2 m/s of gap). All numbers are in `config.py`.
- The streak resets after 3 s under 0.9, and at once when anyone falls off (it stays at zero until they are hauled back). In warm-up, cool-down, servo stops and roadblocks it holds: no gain, no reset. It does not count while the gunship is up.
- Gunship view: the camera blends to a seat behind the gunship as it circles the horde, with the riding crew's names on a tag beside it. The chase camera never shows the sky, so a gunship overhead would have been off screen. The world was not built to be seen from above, so its edges can show for those 20 s.
- Checked against the other mechanics:
  - Nitro: independent meters. Nitro needs 0.95, the streak 0.9, so a strong crew can have both at once. At perfect compliance in a long haul that is about 3 + 2.5 + 2 = 7.5 m/s of gap; `GAP_MAX` (120 m) still caps it.
  - Surge: an air strike (+15 m) more than cancels one grab (-12 m). Clean overs still pay as before.
  - Roadblocks: the streak holds through sprints, so a failed sprint does not break it. A gunship that is already up keeps adding gap through a roadblock.
  - Falls and hauls: unchanged. Group compliance already ignores a fallen rider, so the explicit reset on a fall is what stops a crew streaking while a mate runs behind.
  - Score and ladder: scrap adds straight to the score, so supply drops lift it by at most about 15 per 170 s of eligible riding (roughly 3% on a long ride). Distance, armour and difficulty scaling are untouched. Scores from before and after this change are not quite like for like.
  - Weekly mutators and difficulty: no interaction. Mutators do not scale streak rewards.
  - Resume after a restart: the new fields are plain numbers in the bus snapshot; an old snapshot loads with a zero streak.
  - Riders with no compliance reading count as 1.0 in the group average, as they already do for nitro, so they help a streak along.
  - Tracers and bursts share the 300-spark pool with roadblock and engine sparks; the pool recycles its oldest particles, so a smash during a gunship run may look thinner.
- Passes server and client tests, type-check and lint. Each effect was checked in the scene dev page (`gunship=1`, `fx=drop|airstrike`, keys `d`, `a`, `u`). Not yet played through in a real bus ride, and the HUD streak bar and announcer lines have not been seen or heard.

## Heart rate on the bus (2026-11-13)
- Strap pairing already existed (Web Bluetooth heart-rate service, in the trainer modal, with auto-reconnect), but the reading stayed on the rider's own screen. It now goes to the crew.
- Each `data` message carries `hr` (bpm) and `hrp` (bpm / the rider's max heart rate from Rider settings, or null if they have not set one). The server relays both in every rider's tick and clears them when the data goes stale. Nothing in the bus rules reads heart rate: it is display only, so compliance, streaks, nitro and scoring are unchanged.
- Raw numbers: a chip above each rider's name tag in the scene (`♥ 162  88%`), and the same beside the name in the crew roster and on the TV board. Colour follows the usual five zones (under 60, 70, 80, 90% of max, then over). Without a max heart rate the chip shows bpm only, in white.
- Look: skin blends towards red from 70% of max (`VIS.heatFrom`) to 100%, and steam puffs off the head from 85% (`VIS.steamFrom`), thicker towards 100%. Both need `hrp`, so a rider with no max heart rate set shows numbers but never reddens or steams. Spectators show neither.
- Bots fake a heart rate from their power (45% of max at rest, 90% at FTP, 30 s lag, max 190) so the read-outs can be seen without a second person.
- Steam uses the shared 500-particle smoke pool (exhaust, dust, horde dust), which recycles its oldest particles; six riders steaming hard add roughly 150 live particles.
- Name tags are taller to fit the chip, so tags overlap a little more when riders bunch up on screen.
- Passes server and client tests, type-check and lint. Chip, reddening and steam were checked in the scene dev page with made-up heart rates. Not tested with a real chest strap, and the roster and TV board read-outs have not been seen in a real ride.

## Dockerfile without VOLUME (13/11/2026)
- Removed `VOLUME /data` from the Dockerfile because Railway rejects the Dockerfile `VOLUME` instruction. Persistence now comes from a Railway volume attached at `/data` in the dashboard. `ZB_DB=/data/zombie_bus.db` and `mkdir -p /data` stay, so other hosts can still mount a volume there.

## VO2 Madness game mode (2026-11-13)
- A second crew game beside Zombie Bus, picked by the host in the lobby (`game` message, `Room.game`). No bus and no horde: the riders race along the road as a pack, and the whole pack gets the same mystery intervals. Rules are in `modes/vo2_madness.py`, numbers in `config.py` (`MAD_*`).
- Workout shape: a 45 to 80% warm-up ramp (about 15% of the session, 5 to 10 min), then rounds, then a cool-down (about 10%). Each round is a recovery at 50% followed by one card from the deck, so work to recovery stays near 1:1. The deck: Three-Minute Monster (3 min at 110%), Two-Minute Terror (2 min at 115%), Rocket Minute (1 min at 125%), 30/30 Mayhem (4 x 30 s at 125% / 30 s at 55%), 40/20 Meltdown (4 x 40 s at 120% / 20 s at 50%), Ramp of Doom (95 to 125% over 2.5 min), Stairway to Hell (3 x 1 min at 105, 112, 120%) and Mystery Sprint (15 s all out). The same card never comes twice in a row. Tiers scale the targets as usual and the 150% ERG cap still applies.
- Mystery box: the plan is dealt on the server and reshuffled when the ride starts, so the lobby never shows the real order. In the ride the timeline is hidden and the next interval reads as a mystery box until 10 s before it starts, when the box spins and lands on the name. The client still holds the whole plan (it needs it to pre-schedule ERG), so the secrecy is on the honour system.
- Scoring is all about effort. During intervals each rider scores points per second by heart-rate zone (0, 1, 2, 4, 7 for under 60, 70, 80, 90% of max, then over), multiplied by their compliance so soft-pedalling with a high heart rate does not pay. Riders with no strap or no max heart rate score a flat 3 per second times compliance. Nothing scores in recovery. Sprints pay by grade (0, 20, 40, 70, 100).
- The crown: whoever holds the highest share of their max heart rate (at least 75%) wears it, earns 1 extra point a second and leaves a trail of fire. A challenger must beat the holder by 2 points of max for 4 s. Seconds over 90% count as "in the red". A rider under 70% for 20 s while the rest average over 82% gets called out as a sandbagger.
- Twists: 60% of rounds come with one. Double Points, Redline Bonus (+5 a second over 90%), Hive Mind (x1.5 when the pack's cadence is within 10 rpm), Underdog (last place x3) and Leader Tax (first place x0.5).
- On screen: riders spread front to back by points (leader ahead, medal on the leader, crown over the hardest trier), heart-rate chips, reddening and steam as before, a left panel with the box, the twist and the effort leaderboard. The camera sits lower and closer than on the bus.
- End of ride: awards are Maddest (points), Red Liner (time over 90%), Crown Hog and PR Hunter. Madness results are not written to the season ladder, whose scores are bus scores. The Discord summary has its own wording.
- The bus-only messages (shop, difficulty, mutator) do nothing in this mode. The tick's `bus` object keeps its bus fields with neutral values and adds `mad`.
- Checked in a real ride against the simulated trainer and two bots on a 15x server clock (lobby switch, warm-up, recover, box, GO, crown, lead change, leaderboard), and in the scene dev page (`mad=1`). The results screen for this mode, the TV view and a full-length ride at real speed have not been looked at. At 15x the box spin had no time to land before GO.

## Zwift Click v1 and virtual gears (13/11/2026)
- Protocol sources (facts only, no code copied): [jat255/zwift_click_handling](https://github.com/jat255/zwift_click_handling) (MIT) and [OpenBikeControl/bikecontrol](https://github.com/OpenBikeControl/bikecontrol), formerly jonasbark/swiftcontrol. Both trace back to ajchellew/zwiftplay.
- Click v1: service `00000001-19ca-4651-86e5-fa29dcdd09d1`; notifications on Async `…0002` and Sync TX `…0004` (indicate); write the 6 bytes `RideOn` (`52 69 64 65 4f 6e`) to Sync RX `…0003` to start the unencrypted mode. The Click answers `RideOn 01 03` plus a key, which we ignore. Button messages are `0x37` then protobuf fields 1 (plus) and 2 (minus), value 0 pressed and 1 released; a missing field counts as pressed (protobuf default). Battery `0x19` and empty `0x15` messages are ignored. A press is a released-to-pressed change on one button; repeats and releases give nothing.
- Pairing filters on name prefix "Zwift Click" or the Zwift service. The handshake is sent without response if the characteristic allows it (bikecontrol does), else with response (jat255). Reconnect uses the heart-rate strap's backoff. Every raw notification is logged as `[Click]`. The driver never touches the trainer.
- Plus is shift up (harder), minus is shift down.
- Gears: 24 ratios from 0.75 to 5.49 in `CFG.gears`, spaced like Zwift's published spread (from memory of community tables, not checked against Zwift). Start in gear 12 (2.40), which is close to the default physical ratio 34/14 = 2.43, so the middle gear feels like the real bike on the flat.
- Gear model: virtual speed = cadence × gear ratio × 2.1 m; real wheel speed = cadence × chainring / 14 × 2.1 m. Using `core/physics.ts` `resistance`, bisect for the gradient at which the real speed costs the same power as the virtual speed on the road gradient. Below 20 rpm the road gradient is sent unchanged. The result is clamped to the mode's range (free ride −10 to 20%, Slope −5 to 15%). This assumes the trainer's own sim model (mass, Crr, CdA) is close to ours; it will not be exact.
- Free ride: the "road gradient" fed to the gear maths is the difficulty-scaled one, so the difficulty slider still works. Game speed is from power, as before. Gear does not persist between rides.
- Slope mode: the gear-adjusted gradient is resent when it moves by more than 0.2% (the free-ride step), so cadence wobble does not flood the trainer. All writes go through `ergController.setGrade`.
- Keys: `Z` down, `X` up, in free ride and Slope mode. Both were free in every handler (solo keys, free ride, simulated trainer, main, scene dev, spectator).
- Click in solo ERG mode: ±1% intensity; Resistance mode: ±1 level step (5%). Zombie Bus, FTP tests and the spectator view ignore it.
- Chainring (20 to 60 teeth, default 34) is a per-device setting on the Settings screen.
- Not confirmed from the references: whether every Click v1 firmware advertises the Zwift service UUID (we also filter on the name), and whether the trainer feels right with our physics. Needs a real Click and trainer.

## 2026-11-13 Route library client (Phase A)

- Bundled routes load through `core/routeLibrary.ts`: `content/routes/index.json` eagerly, `<id>.json` lazily. Packs go through the same `buildRoute` as GPX imports.
- Card time estimate needs no pack: flat riding for the distance at 75% FTP (`rideSeconds`) plus climb work `gain x mass x 9.81 / power`. Descents are treated as free, so loops come out a little slow. Good enough for a card.
- Difficulty 1 to 5: one level per climb threshold passed (150, 400, 800, 1400 m), plus one for an average gradient of 6% or more. Length filter: short under 25 km, long from 60 km. All in `CFG.freeRide.library`.
- Choosing a card loads the pack and selects it; Start begins the ride as for an imported route. Bundled routes are not copied into localStorage. Load failures show a toast.
- `content/routes/index.json` is `[]` until the generator lands; the Routes section then says "No bundled routes yet."

## Bundled route packs (2026-11-13)
- The owner approved OpenStreetMap data (ODbL) for routes on 2026-11-13. Heights are NASA SRTM (public domain) through the Open Topo Data API. Both are credited on the route screen and in `CREDITS.md`.
- `scripts/routes/build_routes.py` makes the packs: it downloads the public roads around a route's waypoints (`scripts/routes/routes.json`), takes the shortest road path through them, and samples heights every 30 m. One-way streets are ignored, and service roads, tracks and cycleways are left out so the path stays on the road riders use.
- SRTM is noisy on roads cut into hillsides: raw, it overstated the alpine climbs by 20 to 40% and put 185 m of climbing on Beach Road. Heights are averaged over 300 m along the road before the pack is written, widened (up to 800 m) only when the climb is still more than 10% over the published figure. Mount Hotham needed 600 m. This flattens short pinches: expect a real 15% ramp to read a few per cent lower.
- A pack is refused when its length is more than 5% or its climb more than 10% from the published figures. Results: Ben Lomond 17.8 km / 1075 m (published 17.8 / 1083), Mount Buffalo 21.0 / 1069 (20.9 / 1013), Falls Creek 29.9 / 1335 (29.9 / 1253), Mount Hotham 27.5 / 1402 (28.9 / 1279), kunanyi from Fern Tree 11.6 / 820 (11.1 / 822).
- Exceptions, all shipped: Willunga Hill reads 202 m against 225 m (3 km at the Tour Down Under's 7.5%), 10.2% under, written with `--force`. Mount Coot-tha (12.1 km, 303 m, from the Botanic Gardens and round Sir Samuel Griffith Drive) and Akuna Bay and West Head (51.1 km, 856 m) have no published figure for the variant used, and Great Ocean Road (45.1 km, 438 m) and Beach Road (22.7 km, 90 m) have no published climb, so those numbers are unchecked.
- Packs hold the centreline only (lat, lon, height every 10 m). The height grid and map features in the plan arrive with Phases B and C.
- `client/tests/routePacks.test.ts` loads every pack through the real loader and compares it with its card, so a broken pack or path fails the suite.
## 2026-11-13: workout builder
- Builder opens as a full-screen overlay from the My workouts group in the solo picker (+ Build workout, and a pencil on built cards). Saved with the same `my-` ids and localStorage store as imports.
- Plans keep an optional `edit` field (the builder blocks) so they can be edited again; imported workouts have none and are not editable.
- Intervals block = on/off pair repeated, stored as a `set`. Cue and cadence apply to the on part.
- Percentages are clamped to 20-150 (the ERG cap from config); sprints and free blocks carry no target; sprint time clamps to the config range.
- IF is normalised power over FTP (sprint counted as 120
## 2026-11-13: workout builder
- Builder opens as a full-screen overlay from the My workouts group in the solo picker (+ Build workout, and a pencil on built cards). Saved with the same `my-` ids and localStorage store as imports.
- Plans keep an optional `edit` field (the builder blocks) so they can be edited again; imported workouts have none and are not editable.
- Intervals block = on/off pair repeated, stored as a `set`. Cue and cadence apply to the on part.
- Percentages clamp to 20-150 (ERG cap from config); sprint and free blocks carry no target; sprint time clamps to the config range.
- IF is normalised power over FTP (sprint counted as 120 per cent, free as 50); TSS = hours x IF squared x 100.
- Preview uses the existing plan graph, not the player chart. Delete is the existing X on the card.

## Route packs: terrain grid (2026-11-13)
- Each pack now carries a `terrain` block for the 3D world: SRTM heights on a 60 m grid, in whole metres, for every cell within 900 m of the road, stored row by row as runs of known cells. The grid's own corner (`lat0`, `lon0`) is the origin of the local-metre projection the scene uses. See `scripts/routes/terrain.py` for the exact layout.
- Heights come straight from SRTM 1-arc-second tiles (public domain) on the AWS open terrain tile bucket, read with the standard library. Sea and data voids are 0 m.
- The grid is not smoothed: the road's own heights win near the road (the scene cuts the ground to the road), so the two only need to agree roughly. On Mount Coot-tha the nearest grid cell is within 10 m of the road height everywhere and the median difference is 0.
- The ten packs total 1.1 MB and are loaded one at a time.

## 2026-11-13 Free ride 3D road world (Phase B): road and terrain
- New code lives in `client/src/scene/route/`. It reuses the bus scene's sky, moods, riders, bike, quality levels and debug panel, and adds a `route` mood (blue sky, fog out to 1100 m). The world is fed a generic list of riders (`RoadState`), so later road games can use it unchanged.
- Projection is flat local metres around the terrain grid's origin (or the route's first point): east = dlon x 111320 x cos(lat0), north = dlat x 110540. Scene x is east, z is south, y is height in metres.
- Pack coordinates are rounded to about 1 m, which makes the heading jitter, so the centreline gets two 1-2-1 smoothing passes before a Catmull-Rom curve is run through it. Tight hairpins come out a metre or two wider than the data.
- Short out-and-back spurs are cut out of the drawn line (a stretch that returns to within 6 m of itself inside 80 m of road). Mount Coot-tha has one at 1.3 km where the route builder snapped a waypoint onto a side road. The 15 points either side are respaced to absorb the lost distance, so the rider moves about 15% slower on screen for 300 m rather than stalling. The ride's distance and gradient are untouched. The pack itself still has the spur; fixing the builder would be better.
- Banking: curvature x 1.2 radians, clamped to 0.1 rad (about 6 degrees). Riders lean by speed squared x curvature / g on top, clamped to 0.45 rad.
- Road: 6.2 m of tarmac, 1.2 m gravel verges, white edge lines and a white dashed centre line (4 m on, 8 m off), one row of triangles every 4 m. Chunks are 200 m; they are built up to 800 m ahead at medium quality (350, 500, 1000 for potato, low, high) and kept 150 m behind. Any road within 600 m as the crow flies is also built, so the other legs of a switchback are there when you look across. One chunk is built per frame (about 3 to 5 ms each in software rendering).
- The road carries straight on for 200 m before the start and 400 m after the finish so the world does not end at a cliff.
- Ground height: the pack's 60 m grid, sampled bilinearly, trusted fully three cells in from its edge and fading to made-up ground at the edge. Made-up ground (imported GPX, or beyond the grid) is the heights of nearby road spread sideways, weighted towards the nearest, plus value noise up to 70 m scaled down on flat routes.
- Cut and fill: the ground is level with the road for 7.5 m from the centreline and blends back to natural ground over the next 45 m. Each nearby stretch of road gets its own bench; between two stacked legs the nearer one wins, so the bank between them is steep. This is weighted over all centreline segments within range from a spatial hash, not just the nearest one.
- Terrain mesh: rows of vertices running out from the road every 4 m, at 8, 12, 18, 27, 40, 60 and 90 m, then every 40 m (closer round bends) out to 650 m. A row stops where its ground is nearer to some other bit of road, overlaps by 2.5 m and drops a 30 m skirt, so strips from two legs meet instead of crossing. This replaced the planned "fine strip plus square tiles": one mechanism, no seams between tile sizes, and vertices land exactly on the verge. Known flaw: thin cracks and dark skirt lines can show where two strips meet on steep ground, and beyond about 600 m there can be holes where the land belongs to road that is not built.
- Colours: grass, bush and dry grass from noise, rock on faces steeper than about 37 degrees, snow in patches above 1650 m (Hotham's top; Falls Creek gets a little). All in `VIS.route` and the debug panel; ground colours are baked per chunk, so the panel rebuilds the chunks.
- Skyline: a ring 1500 m out, as tall as the land looks from the rider in each direction (sampled at three distances), redrawn every 80 m and eased. Beyond the pack's grid that land is made up.
- Floating origin: everything in route metres hangs off one group that is shifted whenever the rider gets 300 m from the origin; chunk vertices are stored relative to their own anchor.
- Imported routes are saved without terrain (`routeStore.ts` strips it).

## 2026-11-13 Free ride 3D road world (Phase B): rider and camera
- Riders reuse the bus crew figure. `makeBike` and `makeRider` take a `road` flag that leaves the trainer off and lets both wheels turn with distance. Hat and outfit come from the rider's `Look`; with no outfit the jersey is the first crew colour.
- The scene state is `{ me, riders: [{ id, name, d, offset, speed, cadence, look }] }`. Positions may arrive only a few times a second (free ride ticks at 5 Hz), so each rider is moved at their reported speed every frame and the error at each new report is paid off smoothly. A jump of more than 60 m snaps.
- Riders keep left: the default sideways offset is 1.7 m left of the centre line. Other riders show a name tag at about half the bus size; your own has none.
- Camera: 9 m back along the road and 3.7 m up, so it is always over tarmac and never inside a cut bank; it is also held at least 1.3 m above the ground under it. It aims 55% of the way from the rider to a point 20 m up the road, which looks into bends and tilts with the gradient. The more the road doubles back (a hairpin), the less it looks ahead, so the rider stays in shot. Field of view 58 degrees, widening by up to 5 with speed. All in `VIS.route`.
- A genuine U-turn in a route (ride out, turn round, ride back) is drawn as the data says: the road doubles back on itself and the camera swings round. Not pretty, not fixed.

## 2026-11-13 Free ride 3D road world (Phase B): harness
- A sibling page, `/route-dev.html` (`src/routeDev.ts`), rather than more switches on the bus harness. It is dev-server only, like `scene-dev.html`.
- The debug panel gains a Route world folder when the route world opens it. Road, ground and colour settings are baked into chunks, so changing one drops the chunks and they rebuild over the next few frames.

## 2026-11-13 Free ride 3D road world (Phase B): in the real ride
- Free ride opens in the 3D world by default. A per-device setting, Free ride view (3D world or Charts), is on the Settings screen. If the scene cannot start (no WebGL, or its code fails to load) the ride carries on in the flat layout without a message.
- The 3D layout is the same view with a different stylesheet: the scene fills the screen and the header, numbers, next-kilometre elevation strip, stats row and map sit over it as translucent panels. Gear and gradient get their own tiles (trainer gradient under the gradient); the whole-route profile is hidden; the map is a square minimap top right, still Leaflet with online tiles.
- The scene is loaded only when a 3D ride starts. Free ride gives it one rider (you, in your equipped hat and outfit); the list form is there for group rides.
- Quality levels are the bus scene's (`Quality`, same Graphics setting): pixel ratio and shadows as before, plus how far ahead the road is built (350, 500, 800, 1000 m) and, on potato, no terrain beyond 90 m from the road. Fog closes in to match.
- Nothing here writes to the trainer. Free ride still sends gradient only, through `ergController.ts`.

## 2026-11-13 Free ride 3D road world (Phase B): polish
- Sea: the height data reads zero over water, so ground below 0.5 m is drawn flat blue. It is a stand-in until Phase C paints water from the map; low-lying land right at sea level would also turn blue. Tunable (`seaLevel`, `sea`).
- The camera eases to its spot behind the rider but never trails it by more than 4 m, so a fast descent or a slow frame rate cannot leave the rider a dot in the distance.
- Route builder: when a waypoint snaps just off the through road the path made a short out-and-back stub (Mount Coot-tha had one at 1.3 km). Stubs up to 250 m each way are now removed; longer out-and-backs (Akuna Bay's spurs) are kept as intended.

## 2026-11-13 Free ride Phase C: tidying Phase B
- Terrain rows that stop at another stretch of road no longer dive 30 m to a skirt and drag a sheet of triangles with them. The gap to a longer neighbouring row is filled with a fan of triangles at real ground height, skipped where a fan triangle would come within 1 m of a road edge (9 m in the far band), and the open edge gets a two-sided wall 30 m deep. Thin cracks can still show on the inside of the tightest hairpins.
- Far terrain columns are now at 130, 175, 230, 300, 380, 470, 560 and 650 m (were five, up to 200 m apart), which removes the long sliver triangles.
- Gravel verge narrowed from 1.2 m to 0.7 m.
- A long out-and-back (the two legs within 10 m of each other for at least 300 m, as on Akuna Bay) is drawn as two carriageways: each direction is moved 3.5 m to its left, the way home copies the way out's line and heights, and the turn is a loop up to 12 m either side of the old line, held for 25 m and narrowing over the next 40 m. The split tapers out over the last 80 m where the two legs part. Shorter out-and-backs are still cut out as spurs. The ride distance and gradient are untouched.

## 2026-11-13 Free ride Phase C: painted ground and side streets
- Data contract: `terrain.cover` (one letter per grid cell: g grass, f forest, b bush, s scrub, u built-up, p park, a sand, r rock, w water) and a top-level `features` object (`roads`, `buildings`, `pois`) in the grid's local metres. Both are carried pack to route to scene like terrain, every part is optional, and imported routes are stored without them. Features are ignored when there is no height grid, because they share its origin.
- The real map data was not in the packs when this was built. Everything was checked against made-up data from the harness (`fixture=1`: noisy zones of each cover class with lakes, a side street every 250 m with houses, a peak, lookout, towers and cafe) and against the no-data guesses.
- No cover data: ground within 2 m above sea level is sand, below it water; otherwise bush with patches of forest (26% of the area) and grassy clearings (20%) from slow noise; heath above the treeline (1,500 m, 1,200 m when the route's region is TAS, wobbling by up to 80 m) and rock 200 m above that. Mapped grass above the treeline is treated as unmapped and guessed the same way. Ground below 0.5 m is always water.
- Cover boundaries wander by up to 0.35 of a grid cell with 28 m noise. Each face takes two samples with different noise and is a half-way colour where they disagree. Each class has its own colour drifting towards a neighbour; steep faces are still rock and high ground still gets snow.
- Water: the bed is painted dark blue-green and a separate level sheet sits 0.12 m above each wet face's mean height, in a shinier material so it catches the sun. On sloping "water" (a mapped river on a hill) the sheets step.
- The terrain vertices of a chunk are now kept in a `Patch` per side while the chunk is built, so streets and props read the height of the drawn triangles rather than the smooth ground. Away from the patch (another leg's ground) the smooth height is used.
- Side streets: 4.8 m wide pale strips (main roads 6 m and a little darker), cut into pieces of at most 8 m, 0.12 m above the ground with a depth bias so they do not flicker. A street that reaches the route stops at the edge of the tarmac, covering the verge. Streets further than 450 m from the route are dropped.
- Street-name signs: one per named street per junction (same name within 40 m counts once), on the corner 2.5 m up the street. Plates are 2.6 m wide, far bigger than life, white on green, on a 3.2 m post. Each distinct sign text is one small canvas texture, freed when no chunk shows it.
- Buildings within half their width (plus 1 m) of the route's verge, or overlapping a side street, are dropped. Points of interest further than 1,200 m from the route are dropped.

## 2026-11-13 Free ride Phase C: plants and buildings
- Plants are scattered per chunk, cell by cell over the terrain patch, from a seeded generator, so a chunk always grows the same plants and each stands on a drawn triangle that belongs to that stretch of road. One instanced mesh per kind per chunk, thrown away with the chunk; the eight geometries are shared.
- Densities per hectare beside the road (trees / small plants): forest 70 / 30, bush 40 / 40, scrub 8 / 120, grass 3 / 40, park 12 / 6, built-up 14 / 20, sand 0 / 35, rock 0 / 30, water none. Beyond 90 m from the road: 22% of the trees, 1.5 times the size, no small plants (none past 40 m). Multiplied by 0.25, 0.5, 1, 1.5 for potato, low, medium, high, and scattered out to 60, 230, 300, 470 m.
- Kinds: forest is 70% tall eucalypt and 30% scribbly gum, bush half and half, elsewhere 35 / 65. Within 200 m below the treeline every tree is a snow gum; trees fade out over the 150 m above it. Below 25 m with sand or water within 45 m every tree is a tea-tree with banksia cones. Tree ferns are the small plant in "wet" forest (slow noise, about half of it) below 1,100 m. Above the treeline small plants are boulders, tussocks and shrubs.
- Trees keep 3 m off the verge (small plants 0.8 m), 2.5 m off side streets and buildings, off slopes steeper than 0.9, and off the lip where one leg's ground meets another's.
- Buildings: walls and roof are separate instanced meshes so each takes its own colour (seven wall colours, five roof colours, picked by position). The ridge runs along the longer side and the front door faces the route when it is within 120 m. Kind by position hash: 40% gable, 25% gable with a front verandah, 25% hip roof, 10% flat-roofed shop with a red awning. A footprint of 140 m2 or more and 6 m or taller is a two-storey pub with a verandah all round; 230 m2 or more and lower is a servo with a yellow canopy half the time, a shop otherwise. Roof height is 0.32 of the shorter side, at most 3.4 m.
- A building sits half-way between the drawn ground at its centre and at its highest corner, and its walls carry on underground by their own height, so a slope shows wall, not a gap. Buildings on mapped water are skipped.
- New tunables live in `scene/route/placeVis.ts` (`VIS.route.place`) because `params.ts` was at its size limit. The debug panel lists every number and colour in it automatically; colours baked into shared geometry are rebuilt on change.

## 2026-11-13 Free ride Phase C: road furniture
- Worked out once from the route line when the world opens, filed by chunk. Posts, rails and edge posts are triangles in the chunk's own mesh (no extra draw calls); each sign plate is one small textured box and each arch one mesh.
- Kilometre markers: every 1,000 m on the left, white on green, 1.1 m square (oversized so they read from the saddle). None in the last 200 m.
- Gradient signs: a stretch whose gradient over a 100 m window stays at 6% or more for at least 300 m gets a yellow sign 40 m before it, with the average percentage and the length (nearest 50 m, or km to one decimal).
- Hairpins: at least 2.3 radians (about 130 degrees) of bend inside 120 m of road. A route with three or more gets blue numbered signs on the outside of each bend 12 m before the apex, counting down to 1 at the last one, with the height in metres underneath (as on the famous European climbs). Akuna Bay's two turning loops count as hairpins.
- Guard rails: on a side where the drawn ground 18 m out is 2.5 m or more below the road edge. Gaps up to 12 m are closed, runs under 20 m dropped (unless they touch the end of a chunk), and a rail stops for a side street. The cut-and-fill blend makes drops near the road gentle, so rails only appear on properly steep ground.
- Edge posts: white 1 m posts every 12 m on both sides of bends tighter than 125 m radius where there is no rail, red reflector band on the left and a pale blue one on the right (white would not show on a white post).
- Arches: a chunky inflatable arch with a banner. Green START 4 m in, black FINISH 4 m from the end, red SUMMIT with the height at the highest point when it is at least 150 m above the start. If the highest point is within 300 m of the end the finish arch is the summit arch; if within 300 m of the start there is none.

## Route packs: map features and routes from the owner's rides (2026-11-13)
- Packs can carry map features from OpenStreetMap (`scripts/routes/features.py`): land cover rasterised onto the terrain grid as one letter per cell (`terrain.cover`), side roads within 300 m, building footprints within 150 m (centre, size, rotation, height; at most 6000 a route) and named points (peaks, viewpoints, towers, cafes). Sea and bays (0 m in SRTM) count as water; unmapped land defaults to open grass.
- The public Overpass server is often busy and answers with errors or empty replies. Every query carries a sentinel (anything within 60 m of the route) so an empty reply is retried, and when the server still refuses the pack is written without features and the scene falls back to its defaults. Rebuild that route later to fill them in. As of this entry only Mount Coot-tha, Ben Lomond, Falls Creek, Mount Coot-tha Back and the Nundah crit track have features.
- Six routes are cut from the owner's own ride recordings (`scripts/routes/gpx.py`): Mondo (99 Bikes Ashgrove to the top of the Coot-tha front side, 28.8 km), Full Gas Friday (Go Between Bridge to South Bank, 30.0 km), Mount Coot-tha Back (one 9.5 km lap), the Darren Smith (26.3 km lap) and Metros (31.1 km lap) road race circuits and the Nundah crit track (1.2 km lap). Cut points come from the stops in each recording (the meeting point, the coffee stop) or the start/finish line of a lap.
- The recordings themselves start and end at the owner's home, so `/*.gpx` is git-ignored and only the cut sections are in the packs. The builder cannot rebuild these six without the files.
- A recorded ride uses its own line and barometric heights: a three-point average on position, 100 m smoothing on height (not the 300 m SRTM needs), and a constant shift so the heights sit on the SRTM terrain. Laps are closed by spreading the altimeter's drift round the lap. With no road ids, any side road within about 12 m of the line is treated as the route itself.
- Lap routes are marked `loop` in the pack and index. Choosing a number of laps in the app is not built yet.
## 2026-11-13 Free ride Phase C: roadside oddities, funny signs and chalk
- Owner asked for "more stuff: funny comments, weird things on the side of the road". Everything here is invented; all numbers live in `scene/route/funVis.ts` (`VIS.route.place.fun`, in the debug panel) and the words in `src/fun/*.ts`.
- Oddities are worked out a 200 m chunk at a time from a seed made from the route id, so every rider sees the same ones and a 50 km route costs the same as a 5 km one. About one per 480 m of road, one per 240 m where the road is in built-up cover. 31 kinds: couch with a FREE sign, ute on blocks, shopping trolley, honesty-box stall, letterbox row (microwave, milk can, esky, fuel drum), Hills hoist, bin night, caravan, bus shelter, bathtub trough and horse, tinnie on a trailer, bee boxes, wombat sign and wombat, snowman and toboggan, skis, deck chairs and esky, surf van, surfboards, dunny, windmill and tank, hay bales (one smiling), scarecrow in hi-vis, lawn flamingos and gnome, thong fence, roadside fridge, picnic table and barbecue, roadworks, and four made-up big things (Big Thong, Big Meat Pie, Big Esky, Big Snag).
- Each kind lists the land cover it may stand on, how far beyond the verge, and whether it needs snow (above the 1,650 m snowline), the coast (sand or water within 70 m either side) or a view (ground 30 m out at least 5 m lower, or sand). Snowmen and skis only above the snowline; surf van and boards only by the coast; deck chairs only with a view.
- Never on a road, side street, building or water: a spot is dropped if another stretch of road is nearer than its own, if a street or building is within its footprint plus 1 m, if the ground is water or within 0.3 m of sea level, or if the ground across its footprint slopes more than 0.35. Five tries per oddity, then none. None within 60 m of either end.
- Every route gets one big thing somewhere between 30% and 70% of the way along, wherever the first of 15 tries in that chunk finds room (others can turn up by chance at a low weight). Big things stand with their edge 3 to 8 m off the verge, on a plinth sunk 2.4 m so slopes do not show under them.
- Things turn to face a point on the road 16 m before them, so an approaching rider sees the front. Everything is drawn 1.25 times life size so it reads from the saddle. Plants within 1.5 m of an oddity's footprint are left out.
- The packs carry no land cover yet, so nothing is "built-up" and the bins, flamingos and neighbourhood signs would never appear. Until they do, the routes listed in `suburbs` (Beach Road) treat about 80% of their unmapped dry ground as built-up for choosing oddities, signs and animals only; the ground is still painted as bush.
- Quality: each oddity has a fixed rank; Potato draws the lowest 40%, Low 70%, Medium and High all of them, so the set is still the same for everyone at one level.
- Funny signs: 80 or so one-liners in `src/fun/signLines.ts`, each tagged with where it belongs and whether the council printed it or someone painted it on ply. Signs tied to the road come first: 110 m before a sustained ramp (the real gradient sign is at 40 m), 60 m after a hairpin's apex, 50 m past the summit, 60 m into a false flat (1% to 3% for 500 m or more), 220 m into a descent (5% or steeper for 400 m), 1 km to go (routes over 2.5 km), where the road first climbs through the snowline, where it first drops below 6 m, and 150 m from the start. Fillers every 450 to 900 m suit the land cover beside the road (suburb, farm, bush, sea), 30% of them generic. No two within 150 m, none within 35 m of a real sign or 80 m of either end, a quarter on the right.
- Boards are 4 by 2.4 m (far bigger than life, like the kilometre markers), wrapped to three lines of about 12 letters. Council boards are yellow, green or white on two steel posts; hand-painted ones hang crooked on one stake. Lines are dealt from a seeded shuffle, so none repeats on a route until its tag's pool has been used up.
- Chalk: 53 messages in `src/fun/chalkLines.ts`. Up every sustained ramp (the same 6% for 300 m rule as the gradient signs) every 160 to 320 m, "nearly there" words in the last 250 m, "steep" words 60% of the time at 9% or more, "long" words now and then on ramps of 2 km or more, and "ONLY 3 KM OF THIS" with the real kilometres left. A message every 1.5 to 3 km on flat road well away from any ramp. None on bends tighter than 50 m radius. Letters are stretched 3.2 m along the road so they read from the saddle; the top line is furthest away. Each line is a see-through sheet 3 cm above the tarmac, tilted with the gradient and banking, in white, yellow, pink or pale blue.
- Text is drawn to canvas textures, one per distinct line, shared and freed with the chunks that show them. Hand-painted text uses Comic Sans where the device has it (deliberately).

## 2026-11-13 Free ride Phase C: the commentator
- `modes/freeRide/quips.ts` is a pure module: given the ride's state every tick it now and then returns a remark from `src/fun/quipLines.ts` (110 or so lines). Numbers are in `CFG.freeRide.quips`.
- Rate limits: never two remarks within 60 s. Once-a-ride remarks (about 8 s in, halfway on routes of 4 km or more, the summit when it is 100 m or more above the start, the last kilometre on routes of 2.5 km or more) may follow another by 12 s. Above 105% of FTP (average of the last five seconds) the only thing said is a word of encouragement, at most every 90 s.
- Roadside things get a remark three times in four when one is allowed; things passed while the commentator has to keep quiet are let go, not saved up. Remarks about the riding itself (steep, climb, slow, descent, fast, easy, flat, a long ride, anything) come roughly every 150 s. Sitting still for 20 s earns one remark per stop.
- "Nearby" is an animal doing something or within 45 m, else an oddity up to 30 m ahead, else a landmark within 70 m.
- Free ride shows the remark with `view.toast(text)` when the view has one (the new HUD), otherwise the app's ordinary toast, and speaks it when the announcer setting is on. The announcer module only speaks lines by event kind, so the commentator has its own small `speak`. Settings has a new "Free ride remarks" switch (on by default).

## 2026-11-13 Free ride Phase C: wildlife and traffic
- Planned like the oddities: a 200 m chunk at a time from the route's seed (`scene/route/lifePlan.ts`), numbers in `VIS.route.place.fun.life`. Half the chunks get one mob or flock suited to the ground: kangaroos (3 to 6, on grass, bush or scrub, 12 to 38 m off the verge), cows (3 to 6) and sheep (5 to 9) on grass, cockatoos in forest, bush, parks and paddocks, galahs on grass, scrub and in town (4 to 7 each), seagulls only with sand or water within 70 m, and now and then a wombat (forest, bush or scrub, also above the snowline) or a lyrebird (forest) waiting at the verge. 7% of chunks have a magpie and 12% something coming the other way: a ute, a car towing a caravan, or a tourist coach on routes that reach 1,000 m.
- Behaviour (`scene/route/life.ts`): roos sit up and watch, then bolt when the rider is within 38 m, hopping away from the road at 7 m/s for 30 to 55 m and turning to watch again. Cows turn to look at the rider within 45 m; sheep do not care. Flocks peck on the ground (35% start 6 m up, as if in the branches) and burst into the air within 26 m, flying off for 12 s. Gulls wheel overhead all the time. A wombat (1.3 m/s) or lyrebird (2.4 m/s) sets off across the road when the rider is 55 m short of it. The magpie makes three passes low over the helmet in 11 s, then leaves. Traffic appears 280 m ahead in the other lane at 9 m/s and is dropped 90 m behind the rider.
- Kangaroo mobs are 1.6 times bigger in the dawn and dusk moods.
- Cheap by construction: one instanced mesh per animal shape made once per ride (wings are a second mesh so they can flap), herds laid out only for the chunk behind and two ahead, heights re-read once a second, matrices rewritten each frame with no allocation. Potato keeps the lowest-ranked 40% of herds, Low 70%. Birds are drawn about twice life size so a flock reads from the saddle; flocks fly up and across the road ahead of the rider rather than away from it, so they are seen.
- Traffic drives against the rider on the same strip of tarmac even where an out-and-back has been split into two carriageways (Akuna Bay). Known and left.

## 2026-11-13 Free ride Phase C: time of day and weather
- Five more skies beside plain midday (`scene/route/routeMoods.ts`, listed with the other moods in the debug panel): dawn, golden hour, dusk, mist and shower. By default the mood follows the clock on the wall where the rider is: dawn 4:30 to 8:00, midday to 16:00, golden hour to 18:30, dusk from then through the night (a properly dark night would make the scenery pointless).
- Mist: on 60% of days (seeded by route and date, so everyone riding a route that day agrees) the mist mood takes over whenever the rider is above 1,000 m, with fog closing to 170 m. Moods blend over a couple of seconds, so climbing into it is gradual.
- Shower: every 10 minutes of scene time after the first there is a 30% chance of a 150 s shower: grey light, shorter view and 260 rain streaks in a 26 m box that follows the camera.
- The debug panel's Route world folder has a `mood` drop-down (auto or any one mood) and a `weather` folder with every number above; the harness takes `mood=routeDusk` and so on.


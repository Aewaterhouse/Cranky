# Status

**Current state:** Cranky is live on this PC (port 8000). Phases 1 to 4 of the original plan are built, plus accounts, the UI and graphics overhaul, and the roadmap work below. Real hardware so far: pairing and ERG confirmed by the owner; riders have started recording rides on the live server.

## Done from the roadmap (see `docs/roadmap.md` for the ticks)
- Reliability: trainer auto-reconnect, control-reply handling, heart-rate straps, screen wake lock, ride crash recovery, rooms that survive a server restart, ERG pre-scheduling, six-seat limit, bots, admin page, daily backups, automated end-to-end test.
- Trainer features: workout import (.zwo/.erg/.mrc), 57-plan library by goal, FIT download, installable app with offline solo.
- Game: ramp-up hill event, difficulty levels, 20 more cosmetics, announcer, Discord summary (needs a webhook URL).
- Polish: Cranky rebrand and logo, settings screen, automatic graphics quality, first-run welcome.

- Rider data: deeper profile, power curve chart, ride history, fitness trends, PR timeline and badges.
- Solo extras: FTP tests, resistance and slope modes, cadence targets, coach cues, add-time buttons, media corner, ghost of the last attempt.
- Game extras: personal mini-challenges, nitro, weekly mutators, season ladder, TV spectator mode.
- Compare with mates: crew curves overlay on the power curve chart and a W / W/kg leaderboard (not yet looked at in a browser).
- Free ride: ride physics, GPX routes, elevation profiles and an OpenStreetMap map (not yet looked at in a browser).
- Streak rewards: clean group riding earns a supply drop, an air strike and a gunship view (checked in the scene dev page only, not yet in a real ride).
- Heart rate on the bus: the crew sees each rider's bpm and % of max, and riders redden and steam as effort climbs (checked in the scene dev page only; no real strap yet).
- VO2 Madness: a second crew game. Mystery-box VO2 intervals for the whole pack, scored on heart-rate effort, riders racing on the road (checked in a short sped-up ride with bots; results screen and TV view not yet looked at).
- Virtual gears and Zwift Click v1: 24 gears in free ride and solo Slope mode (Z/X keys or the Click), Click also steps ERG intensity and resistance level; Click test panel on `/spike.html` (no real Click tested yet, roadmap item left unticked).
- `Steven` branch only: every rider and zombie has a huge chest (`VIS.bust`), as a joke. Zombies checked in the scene dev page; riders not yet seen from the front.

- Free ride Phase A (`docs/freeride-plan.md`): ten bundled Australian routes and a card picker (not yet seen in a browser).
- Free ride Phase B: the 3D road world (road, terrain, rider, chase camera, slim HUD, `/route-dev.html` harness, 2D fallback setting). Seen only in software-rendered screenshots.
- Workout builder (solo picker, My workouts).
- Training plans: four bundled multi-week plans, a calendar (done, missed, today) and a "Today's workout" card on the Ride tab; the plan is kept on the profile (seen in headless screenshots with a local server; no plan ridden through yet).
- Free ride Phase C so far: land-cover ground, side streets and street signs, gum trees and scrub, houses and shops from real footprints, road furniture, landmarks. Seen in headless screenshots and by the owner on Mount Coot-tha.
- HUD research (`docs/hud-notes.md`).
- Free ride: roadside oddities, funny signs and chalk, wildlife, traffic, location-aware quips, time of day and weather; the HUD redesign from `docs/hud-notes.md`; six routes from the owner's rides; lap rides on loop courses.
- Free ride Phase D: bend speed limits, optional wind, trainer gradient look-ahead, camera extras with a calm setting, rider poses, synthesised ride and place sounds; lap counter, lap times and bell. Audio has never been heard and motion was judged from stills.
- Free ride Phase E: group rides on a shared server road layer (server-run positions, drafting, keep-together, bots with characters, lobby, name tags, TV view, crew results, four-rider headless test). Tried only with headless browsers on one machine.
- Free ride Phase F: segments with live splits, server-side efforts and leaderboard endpoints, ghosts, FIT export with position and laps, route passport and badges, weekly featured route and climbing target, route map and segments in ride history.
- Free ride Phase G: crew leaderboards, the 2D layout caught up, offline rides keep their history, route flyovers and loading cards, summit and finish moments with a postcard, settings (units, camera distance, colour-blind gradients, reduced motion, sound mix), a frame-time monitor with a low-power level, phone and tablet layouts, offline routes, and the owner's checklist in `docs/owner-checks.md`.
- One HUD across all three ride screens: the solo workout player and the Zombie Bus now use the free-ride HUD's power panel, clock, rider list, menu, toasts, clean view and display size. The end-to-end ride test passes.

## In progress
- **Session 2026-11-14 (late):** road races (normal, points, crit with a sprint prime, a podium); two rounds of independent UI review (`docs/ui-review.md`, `docs/ui-review-2.md`, the work queues) with most of their top items fixed: home rebuilt around Free ride, Solo, Training plan and the crew games with a changing Today card and a boarding banner; Back stays in the app; results lead with what you earned, unlocked badges, the game's story, scores against the crew best and your own; a fair scrap economy (solo rides earn too); ERG grace; VO2 Madness without a strap; named blame and credit in Kidney Stone Express; how-to cards; live race place and gap; the power curve smoothed at 23 durations; extra ride metrics; training plans. 3D world work (sea, lighter dusk and a sky setting so far) is under way. All in `scripts/e2e.sh` except Watch Party.
- **Three new crew games** (`docs/games-plan.md`, the current priority), started 2026-11-14. All non-ERG, scripted sessions with their own targets, built on a shared kit (per-rider target bands, `act` input, `ask` questions, seeded events with a 90 s quiet limit, a per-game HUD panel, scene and results view).
  - Kidney Stone Express (`ambo`): done end to end. A sped-up shift with bots runs from lobby to results in `scripts/e2e.sh`. Never ridden by a person; Comfort tolerances against real trainer noise are guesses.
  - Speed Dating (`date`): playable. A sped-up night with three bots runs from The Bar through six dates, the Proposal, Wedding and Divorce to the results (screenshots in `docs/screenshots/games/`). In `scripts/e2e.sh`; never ridden by a person.
  - Climate Lawsuit (`climate`): playable. A sped-up game with three bots runs from the 1980s through four decades, the Trial and Sentencing to the results; the GUILTY sash is stored on the server for 30 days. In `scripts/e2e.sh`. Never ridden by a person; the flood mark is tuned on bots.
  - Watch Party (`watch`): playable and the roadmap section is done. The driver picks a workout (ERG as on the bus); anyone queues a YouTube video, a Twitch channel (live, not synced) or a video file; the driver holds the remote, can reorder the queue, and pausing the video pauses the workout for everyone; emoji reactions float over the video; the video dips its volume before each change of target. Tried for real in headless Chromium. Not in `scripts/e2e.sh` (needs the internet); the volume dip has not been heard and no ads were seen.
- Zwift Click v2: the driver pairs a v2 puck and reads its buttons (from the public bikecontrol source), never run on hardware; the reference's keep-awake logic is not public, so presses may stop after a while. Check in `docs/owner-checks.md`.
- Zombie Bus: Lunch Break Quickie, a 15 min plan, and a 15 min length chip.
- Extra ride metrics: a More numbers card (variability, efficiency, HR drift, W′ low point, cadence bands) on results and history for rides of 10 min or more. W′ is a flat 20 kJ for everyone.
- UI review by independent agents (`docs/games-plan.md` Phase 6): the first reviewer is on the riding screens.
- `docs/ride-notes-plan.md` worked through on 2026-11-14. Three items stay open: gear strength and falling-off tuning are waiting on the owner (`docs/questions.md`), and the shift-strength slider needs an iPad check. Trainer and iPad checks are in `docs/owner-checks.md`.
- Rider bodies, 2026-11-14: a free character creator (Rider → Body) and a rebuilt rider model: 24 options from normal to ridiculous, presets and Randomise, saved in the look, synced through the profile and the join message, validated on the server, shown on the bus, in Madness, free and group rides, the TV views and the Garage pictures. A rider is 10 draw calls where it was 26. Seen in headless rides and on `/avatars-dev.html` only; iPad checks in `docs/owner-checks.md`; design in `docs/avatars.md`; screenshots in `docs/screenshots/avatars/`.
- Strava, 2026-11-14: riders connect once in Rider → Settings; every saved ride of 30 s or more uploads as a Virtual Ride with a title and description by mode and a link to a public postcard page; History shows each ride's state with Retry and Upload. Tested with Strava mocked and in a headless ride (the browser's Strava replies faked); never run against the real Strava yet. Needs on Railway: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (set), the Strava app's callback domain `www.cranky.life`. Checks in `docs/owner-checks.md`.
- Crew cards, 2026-11-14: the crew panel on the bus, Madness, both TV views and group free rides is a narrow column of rider cards that open (tap, or D for all) to every number now and this ride; the server sends each rider's ride so far (average, NP, time on target, kJ, falls, weight) once a second. Seen in headless rides with bots only; iPad checks in `docs/owner-checks.md`.
- Player camera, 2026-11-14 (client only): drag or one finger to orbit and wheel or pinch to zoom on the 3D view, auto-return after 8 s, double click or tap to snap back; C or 🎥 cycles Chase, High, Rear and Side (remembered per device); air strike and supply drop cinematics with a letterbox and title, plus a gunship title (skip with C or a tap, Settings > Cinematics); free-ride photo mode from the pause screen with "Use as postcard"; all in both TV views and the dev pages. Judged from headless stills only: touch on an iPad is untested (checks in `docs/owner-checks.md`).

## Next
- Compare with mates, extra ride metrics, workout builder, training plans, then watch party, the rest of free ride and deeper Zombie Bus mechanics.
- Skipped until the owner can help: iPad layout pass, number tuning, intervals.icu sync (notes beside each in the roadmap).
- The owner's hardware checks are listed in `docs/owner-checks.md`.

## Working on this PC
- The owner wants it kept cool. Run builds and tests as `systemd-run --user --scope -q -p CPUQuota=300% nice -n 19 <command>` and use at most one or two agents at a time.
- After a reboot the server is not running until someone starts `scripts/run.sh`.

## Known issues
- Only `scripts/run.sh` should rebuild `client/dist` while the live server runs: anything else that rebuilds it breaks open pages (free ride went 2D). Tests use `ZB_CLIENT_DIST` and a scratch build.
- Free-ride camera: on Mount Coot-tha, the High view zoomed out or orbited shows slivers (under 1.3%) of blank background at the terrain's edge beyond the hill. `/route-dev.html?route=mount-coot-tha&d=2000&camcheck=1` shows them.
- `scripts/e2e.sh` on macOS leaves its uvicorn running after it passes (the trap kills `uv run`'s shell, not the server); kill whatever holds the port afterwards.
- Imported GPX routes and My workouts live only in the browser's storage on one device; clearing it loses them (ride history, profiles and efforts are on the server).
- Zombie Bus non-ERG mode and the fallen-rider load on everyone else's targets were added on 2026-11-14 without tests or a ride (owner asked for speed). Check both on the next bus ride.
- Shared HUD leftovers: the bus status block, shop, Madness board and TV board keep the older bordered glass; Large display size on a 1024 px tablet and Huge at 720p overlap; the solo menu covers the power panel; the 3-2-1 tone, media corner, ghost and heart-rate display were not looked at after the change.
- Phase G gaps: the group-ride podium is on the results screen, not in the 3D world; imperial units are not applied on History screens, short metre countdowns or chart axes; frame rates are software-renderer numbers only (Auto now settles at Low power: 10 to 16 fps on the three measured routes); the flyover runs well over its 7 s in software.
- Phase F gaps: no crew leaderboard screen yet (the endpoints exist); a ride finished offline queues its segment efforts but still loses its history entry; no mate-ghost picker in the group lobby; the 2D layout has no segment panel. Group-ride splits, mate ghosts, offline sync and scrap payouts are unit-tested only, and no FIT file has been uploaded to Strava.
- The weekly challenge week starts Monday local time, unlike the older streak week (Sunday UTC). `config.ts` (335 lines) and `freeRide.ts` (308) are over the 300-line guide.
- Group rides: the Phase E agent saw a solo free ride (2D layout) stall for about 9 s every 23 s in headless Chromium, after which the server read zero power. It does not reproduce on the 3D harness page on master (no gap over 1.5 s in 60 s); never checked in the 2D layout or a real browser. Watch for it on the first real group ride.
- Group rides: drafting (27% at 2 m, none by 10 m), keep-together (up to 20%) and bot strengths are invented numbers. `freeRide.ts` is a little over 300 lines.
- Eight route packs still have no map features (the public map server kept refusing): Full Gas Friday, Metros, Mount Buffalo, Mount Hotham, kunanyi, Willunga, Akuna Bay, Great Ocean Road, Beach Road. Re-run `scripts/routes/build_routes.py <id> --force` to fill them in.
- Free-ride frame rate swings between 2 and 14 fps in the software renderer depending on the route; never measured on a real GPU.
- Lap rides, quips in the HUD and the new HUD have not been ridden by a person yet.
- Free ride 3D world: no trees or buildings yet (Phase C), thin see-through cracks where terrain strips meet on stacked hairpins, sliver triangles in far terrain, and a true out-and-back U-turn folds the road on itself. Frame rate on a real GPU is unmeasured.
- Most features are tested only against the simulated trainer and headless Chromium.
- Icons are emoji, so they vary by device.
- Scene performance is unmeasured on real GPUs (auto quality should cope).
- The horde is only on screen when the gap is under about 30 m, because the camera sits behind the bus.
- The announcer has never been listened to: it was built on a headless machine.
- Rejoin after a refresh only shows when another rider is still on the bus.

## Hardware log
- 2026-11-12: the owner confirmed Bluetooth pairing and ERG control on a real trainer, in Brave over localhost (SSH port forward). Brave needs `brave://flags/#brave-web-bluetooth-api` enabled.
- 13/11/2026: Zwift Click v1 on firmware 1.1.0 paired and both buttons confirmed in Brave on macOS; gears confirmed shifting in free ride; feel still to be tuned on a real ride.
- See `docs/roadmap.md` for the backlog.

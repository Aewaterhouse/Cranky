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
- Free ride Phase C so far: land-cover ground, side streets and street signs, gum trees and scrub, houses and shops from real footprints, road furniture, landmarks. Seen in headless screenshots and by the owner on Mount Coot-tha.
- HUD research (`docs/hud-notes.md`).
- Free ride: roadside oddities, funny signs and chalk, wildlife, traffic, location-aware quips, time of day and weather; the HUD redesign from `docs/hud-notes.md`; six routes from the owner's rides; lap rides on loop courses.
- Free ride Phase D: bend speed limits, optional wind, trainer gradient look-ahead, camera extras with a calm setting, rider poses, synthesised ride and place sounds; lap counter, lap times and bell. Audio has never been heard and motion was judged from stills.
- Free ride Phase E: group rides on a shared server road layer (server-run positions, drafting, keep-together, bots with characters, lobby, name tags, TV view, crew results, four-rider headless test). Tried only with headless browsers on one machine.
- Free ride Phase F: segments with live splits, server-side efforts and leaderboard endpoints, ghosts, FIT export with position and laps, route passport and badges, weekly featured route and climbing target, route map and segments in ride history.
- Free ride Phase G: crew leaderboards, the 2D layout caught up, offline rides keep their history, route flyovers and loading cards, summit and finish moments with a postcard, settings (units, camera distance, colour-blind gradients, reduced motion, sound mix), a frame-time monitor with a low-power level, phone and tablet layouts, offline routes, and the owner's checklist in `docs/owner-checks.md`.
- One HUD across all three ride screens: the solo workout player and the Zombie Bus now use the free-ride HUD's power panel, clock, rider list, menu, toasts, clean view and display size. The end-to-end ride test passes.

## In progress
- Working through `docs/ride-notes-plan.md` top to bottom (started 2026-11-14). Questions for the owner go in `docs/questions.md`.

## Next
- Compare with mates, extra ride metrics, workout builder, training plans, then watch party, the rest of free ride and deeper Zombie Bus mechanics.
- Skipped until the owner can help: iPad layout pass, number tuning, intervals.icu sync (notes beside each in the roadmap).
- The owner's hardware checks are listed in `docs/owner-checks.md`.

## Working on this PC
- The owner wants it kept cool. Run builds and tests as `systemd-run --user --scope -q -p CPUQuota=300% nice -n 19 <command>` and use at most one or two agents at a time.
- After a reboot the server is not running until someone starts `scripts/run.sh`.

## Known issues
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

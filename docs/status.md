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
- `Steven` branch only: every rider and zombie has a huge chest (`VIS.bust`), as a joke. Zombies checked in the scene dev page; riders not yet seen from the front.

## In progress
- Nothing half-built. The session of 2026-11-12 was cut short when the PC was switched off; everything from it is merged.

## Next
- Compare with mates, extra ride metrics, workout builder, training plans, then watch party, the rest of free ride and deeper Zombie Bus mechanics.
- Skipped until the owner can help: iPad layout pass, number tuning, intervals.icu sync (notes beside each in the roadmap).
- The owner's hardware checks are listed in `docs/owner-checks.md`.

## Working on this PC
- The owner wants it kept cool. Run builds and tests as `systemd-run --user --scope -q -p CPUQuota=300% nice -n 19 <command>` and use at most one or two agents at a time.
- After a reboot the server is not running until someone starts `scripts/run.sh`.

## Known issues
- Most features are tested only against the simulated trainer and headless Chromium.
- Icons are emoji, so they vary by device.
- Scene performance is unmeasured on real GPUs (auto quality should cope).
- The horde is only on screen when the gap is under about 30 m, because the camera sits behind the bus.
- The announcer has never been listened to: it was built on a headless machine.
- Rejoin after a refresh only shows when another rider is still on the bus.

## Hardware log
- 2026-11-12: the owner confirmed Bluetooth pairing and ERG control on a real trainer, in Brave over localhost (SSH port forward). Brave needs `brave://flags/#brave-web-bluetooth-api` enabled.
- See `docs/roadmap.md` for the backlog.

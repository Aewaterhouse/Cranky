# Status

**Current state:** Cranky is live on this PC (port 8000). Phases 1 to 4 of the original plan are built, plus accounts, the UI and graphics overhaul, and the roadmap work below. Real hardware so far: pairing and ERG confirmed by the owner; riders have started recording rides on the live server.

## Done from the roadmap (see `docs/roadmap.md` for the ticks)
- Reliability: trainer auto-reconnect, control-reply handling, heart-rate straps, screen wake lock, ride crash recovery, rooms that survive a server restart, ERG pre-scheduling, six-seat limit, bots, admin page, daily backups, automated end-to-end test.
- Trainer features: workout import (.zwo/.erg/.mrc), 57-plan library by goal, FIT download, installable app with offline solo.
- Game: ramp-up hill event, difficulty levels, 20 more cosmetics, announcer, Discord summary (needs a webhook URL).
- Polish: Cranky rebrand and logo, settings screen, automatic graphics quality, first-run welcome.

## In progress
- Rider data: profile depth, power curve chart, ride history, fitness trends, badges.
- Solo extras: FTP tests, resistance and slope modes, cadence targets, coach cues, add-time buttons.
- TV spectator mode.

## Next
- Watch party, free ride on GPX routes, then deeper Zombie Bus mechanics.
- The owner's hardware checks are listed in `docs/owner-checks.md`.

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

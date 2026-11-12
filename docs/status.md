# Status

**Current phase:** Phases 1 to 4 are built and pass headless tests. None of it has been tested on real trainers yet.

## Last done
- Phase 1: solo drill with ERG, compliance, sprints, power curve, results and JSON export.
- Phase 2: FastAPI rooms with join codes, server clock, reconnect, SQLite profiles and rides.
- Phase 3: horde, armour, events, generator, engine in tune, fell off and haul back, sprint FX, awards, audio and moods.
- Phase 4: Servo Stop shop, scrap banking, garage cosmetics shown on the bus and riders, postcard PNG.

## Next step
- Phase 0 acceptance on real hardware: `/spike.html` on each rider's device (Wahoo, Jet Black, iPad with Bluefy).
- Phase 1 acceptance: a full 2x15 sweet spot on a real trainer.
- Tune the game numbers after the first group ride.

## Known issues
- Untested against real FTMS trainers. Control point responses are not checked, and writes are just serialised.
- Web Bluetooth needs HTTPS (or localhost). See the README.
- Ride view bundle is about 600 kB, since three.js isn't code-split.
- `?fast=N` only affects solo drill. For multiplayer, use `ZB_TIME_SCALE` on the server.
- Rooms live in memory, so restarting the server ends any ride in progress.

# Code map

## Root
- `PLAN.md` design and phases; `AGENTS.md` working rules; `README.md` setup; `Dockerfile`, `.dockerignore` production image (client build + server).
- `scripts/run.sh` build client and start server on :8000; `scripts/selfsigned.sh` self-signed certs for LAN HTTPS.
- `docs/protocol.md` wire protocol; `docs/testing.md` manual test notes; `docs/map.md` this file.

## client/ (Vite, TS, Three.js)
- `index.html` app entry; `spike.html` Phase 0 trainer check page; `vite.config.ts` proxy, `@content` alias, two entry pages.
- `src/main.ts` app bootstrap, wires home actions to drill and crew.
- `src/spike.ts` Phase 0 trainer test UI.
- `src/config.ts` all client tunables (caps, bands, sprint grades, curve defaults).
- `src/types.ts` shared types (Plan, Block, Tier, Trainer, Frame).
- `src/content.ts` loads plans from content/workouts via Vite glob.
- `src/style.css` styles.
- `src/core/compliance.ts` rolling average and band scoring.
- `src/core/curve.ts` profile, power curve, best efforts, sprint grading, FTP suggestion.
- `src/core/effects.ts` resistance modifier bus with caps.
- `src/core/plan.ts` plan parsing, flattening, frame lookup, session generator.
- `src/core/profile.ts` local profile storage and server sync.
- `src/core/ride.ts` per-ride recorder and summary.
- `src/modes/rideController.ts` per-tick ride logic: ERG, compliance, sprints.
- `src/modes/drill/drill.ts` solo drill mode.
- `src/modes/zombieBus/crew.ts` multiplayer lobby and room flow.
- `src/modes/zombieBus/zombieBus.ts` in-ride bus mode (server ticks to scene/HUD).
- `src/net/protocol.ts` message types mirroring docs/protocol.md.
- `src/net/wsClient.ts` WebSocket with auto reconnect.
- `src/scene/world.ts` Three.js world, camera, road, debug panel.
- `src/scene/bus.ts` procedural bus and riders.
- `src/scene/horde.ts` instanced zombie crowd.
- `src/scene/params.ts` tunable visual parameters and moods.
- `src/trainer/ftms.ts` Web Bluetooth FTMS driver.
- `src/trainer/ergController.ts` only module writing to the trainer; cap, smoothing, failsafe.
- `src/trainer/simTrainer.ts` simulated trainer and keyboard bindings.
- `src/ui/dom.ts` tiny DOM helpers; `home.ts` home screen and trainer connect; `hud.ts` ride HUD; `results.ts` end-of-ride summary; `audio.ts` WebAudio beeps.
- `tests/compliance.test.ts`, `curve.test.ts`, `erg.test.ts`, `plan.test.ts` vitest unit tests.
- `public/assets/CREDITS.md` asset credits.

## server/ (FastAPI, uv)
- `src/zombie_bus_server/app.py` FastAPI app: REST, WebSocket, static client.
- `config.py` all server tunables and env vars.
- `protocol.py` message schemas.
- `plan.py` plan loading, validation, targets, generator.
- `session.py` rooms, lobby, server clock and broadcast.
- `store.py` SQLite profiles and rides.
- `modes/zombie_bus.py` bus, horde, events, awards rules.
- `tests/conftest.py` fixtures; `test_plan.py` plans; `test_zombie_bus.py` mode rules; `test_multiplayer.py` 4-bot headless ride.

## content/
- `workouts/*.json` workout plans (sweet spot, threshold, over-under, ramp, Z2, VO2, sprints, bus-crew sessions).
- `schema/workout.schema.json` plan JSON schema.

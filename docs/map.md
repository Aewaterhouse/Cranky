# Code map

## Root
- `PLAN.md` design and phases; `AGENTS.md` working rules; `README.md` setup; `Dockerfile` production image (client build + server).
- `scripts/run.sh` build client and start server on :8000; `scripts/selfsigned.sh` self-signed certs for LAN HTTPS.
- `scripts/routes/build_routes.py` builds bundled route packs from OpenStreetMap and SRTM; `terrain.py` SRTM tile reader and the height grid around a route; `routes.json` route definitions (waypoints, published figures); `test_build_routes.py` its tests (`cd server && uv run pytest ../scripts/routes`).
- `content/routes/index.json` route cards; `content/routes/<id>.json` one pack per bundled route.
- `docs/protocol.md` wire protocol; `docs/testing.md` manual tests; `docs/status.md` state; `docs/decisions.md` invented mechanics; `docs/freeride-plan.md` free ride 3D world plan; `docs/map.md` this file.
- `content/workouts/*.json` plans; `content/schema/workout.schema.json` plan schema; `content/cosmetics.json` shop catalogue.

## client/ (Vite, TS, Three.js)
- `index.html` app entry; `spike.html` trainer check page; `scene-dev.html` scene harness (dev server only); `vite.config.ts` proxy (`ZB_API`), `@content` alias, entry pages.
- `src/main.ts` bootstrap: login, shell, wiring to solo and bus.
- `src/spike.ts` trainer test UI and Zwift Click test panel.
- `src/sceneDev.ts` scene harness params and keys (see README).
- `src/config.ts` client tunables (caps, bands, sprint grades, curve defaults).
- `src/types.ts` shared types (Plan, Block, Tier, Trainer, Frame).
- `src/content.ts` loads plans from content/workouts via Vite glob.
- `src/style.css` design tokens and base; `ui.css` shell, login, modal, toasts; `screens.css` tabs and trainer modal; `setup.css` plan picker, solo setup, lobby, rider stats; `solo.css` workout player; `results.css` results.
- `src/hud.css` HUD base; `hudBus.css` bus status and roster; `hudPanels.css` stats, shop, feed; `hudSplash.css` splashes, responsive.

### core/
- `api.ts` fetch with the login token; token and session storage.
- `compliance.ts` rolling average and band scoring.
- `cosmetics.ts` catalogue and purchase logic.
- `badges.ts` milestone badges, PR timeline.
- `fitness.ts` TSS estimate, CTL/ATL/TSB, weekly TSS, heatmap, streaks; `riderMetrics.ts` zones, HR zones, W/kg, FTP series; `powerCurve.ts` power curve lines and axis maths; `crewCurve.ts` crew leaderboard ranking and mate curve lines.
- `physics.ts` free-ride speed from power, gradient and mass; `gears.ts` virtual gears and the gear-adjusted trainer gradient; `settings.ts` per-device settings (incl. chainring); `route.ts` GPX parsing, resampling, route queries; `routeStore.ts` imported routes in localStorage; `routeLibrary.ts` bundled route index, lazy pack loader, difficulty and time estimate.
- `curve.ts` profile, power curve, best efforts, sprint grading, FTP suggestion (increase only).
- `effects.ts` resistance modifier bus with caps.
- `builder.ts` workout builder logic (block list ops, conversion to plans, clamps, TSS/IF); `plan.ts` plan parsing, flattening, frame lookup, session generator.
- `profile.ts` local profile cache and server sync.
- `ride.ts` per-ride recorder (JSON save and restore), summary, NP/IF/TSS; `snapshot.ts` crash-recovery snapshots in localStorage and the remembered bus code.

### modes/, net/, trainer/
- `modes/rideController.ts` per-tick ride logic: ERG, compliance, sprints.
- `modes/drill/drill.ts` solo ERG workout player (pause, skip, intensity, auto-pause, keys); `modes/drill/ftpTest.ts` FTP test blocks and result maths; `modes/drill/cadence.ts` cadence-in-band tally; `modes/drill/cues.ts` coach cue timing; `modes/drill/extend.ts` +1 / +5 min; `modes/drill/liveTally.ts` incremental ride stats; `modes/drill/overlays.ts` centre message; `modes/drill/keys.ts` key map and Click mapping; `modes/drill/slope.ts` slope mode gradient sender with gears.
- `modes/freeRide/freeRide.ts` free ride player on a route (physics, trainer gradient, auto-pause).
- `modes/zombieBus/crew.ts` bus lobby and room flow; `zombieBus.ts` in-ride bus mode (ticks to scene and HUD).
- `modes/drill/drill.ts` solo ERG workout player (pause, skip, intensity, auto-pause, keys).
- `modes/zombieBus/crew.ts` bus lobby and room flow; `zombieBus.ts` in-ride bus mode (ticks to scene and HUD); `spectate.ts` TV spectator view (`watch`, no trainer).
- `net/protocol.ts` message types mirroring docs/protocol.md; `wsClient.ts` WebSocket with reconnect (token in URL); `clockSync.ts` server session clock estimate for ERG pre-scheduling.
- `trainer/ftms.ts` Web Bluetooth FTMS driver; `heartRate.ts` HR strap driver, simulated HR and the `currentHr()` singleton; `ergController.ts` only module writing to the trainer; `zwiftClick.ts` Zwift Click v1 driver (presses only, never writes to the trainer); `simTrainer.ts` simulated trainer and keys.

### scene/ (no UI, three.js)
- `world.ts` scene owner, render loop, `SceneState`, fx entry; `debug.ts` debug panel; `params.ts` tunable visuals (`VIS`); `util.ts` clamp, lerp, smooth.
- `camRig.ts` chase camera; `moods.ts` mood colour blending; `sky.ts` sky and sun.
- `ground.ts` terrain and road; `props.ts` roadside props loop; `propGeo.ts` prop and vehicle geometry; `landmarks.ts` billboards and Servo station.
- `bus.ts` the bus; `busParts.ts` bus dimensions and seat slots; `bike.ts` bikes; `riders.ts` rider figures; `hats.ts` hats; `crew.ts` crew on the bus.
- `horde.ts` instanced zombie crowd; `roadblock.ts` roadblock barrier; `pack.ts` the VO2 Madness pack on the road (order by points, crown, medal, fire); `strikes.ts` streak air support (supply crate, strike jet, gunship and its camera view).
- `particles.ts` particle pool; `emitters.ts` exhaust, dust, smash bursts; `fxLayer.ts` screen and impact effects.

### ui/
- `dom.ts` DOM helpers; `toast.ts` toasts and modal; `audio.ts` WebAudio sounds.
- `login.ts` login tiles and logo; `shell.ts` app shell and tabs; `home.ts` Ride tab and plan helpers; `garage.ts` Garage tab; `rider.ts` Rider tab; `riderStats.ts` zone bar and recent rides; `riderPower.ts` interactive power curve with crew overlay chips; `riderCrew.ts` crew leaderboard; `riderSettings.ts` FTP, weight, HR and power zones, FTP history; `historyList.ts` History sub-tab list; `historyDetail.ts` one ride in full; `rideExport.ts` .fit and JSON downloads; `riderBadges.ts` badge grid and PR timeline; `riderTrends.ts` Trends sub-tab (fitness/fatigue/form, weekly TSS, heatmap); `svg.ts` SVG helpers.
- `trainer.ts` trainer pill and connect modal; `clickPair.ts` Zwift Click section of the modal; `settings.ts` Settings screen.
- `planGraph.ts` plan graph and zone colours; `planPicker.ts` plan picker with length scaling; `lobby.ts` bus lobby.
- `builder.ts` workout builder screen (`builder.css`); `workoutChart.ts` solo workout chart; `soloSegs.ts` profile segments; `solo.ts` solo setup; `soloView.ts` player view; `soloExtras.ts` context buttons; `soloMode.ts` ERG/resistance/slope switch; `soloPanel.ts` interval list.
- `hud.ts` HUD assembly; `hudHeader.ts` event header and timeline; `hudCockpit.ts` my power cockpit; `hudBus.ts` bus status; `hudRoster.ts` crew roster; `hudStats.ts` my stats; `hudShop.ts` Servo Stop shop; `hudSplash.ts` splashes and feed; `hudKit.ts` event styles and shared bits.
- `workoutChart.ts` solo workout chart; `soloSegs.ts` profile segments; `solo.ts` solo setup; `soloView.ts` player view; `soloPanel.ts` interval list.
- `hud.ts` HUD assembly; `hudHeader.ts` event header and timeline; `hudCockpit.ts` my power cockpit; `hudBus.ts` bus status; `hudMad.ts` VO2 Madness box and effort leaderboard (`hudMad.css`); `hudRoster.ts` crew roster; `hudStats.ts` my stats; `hudShop.ts` Servo Stop shop; `hudSplash.ts` splashes and feed; `hudTvBoard.ts` / `hudTvScreens.ts` TV crew board, lobby and end screens (`tv.css`); `hudKit.ts` event styles and shared bits.
- `freeRideSetup.ts` free ride route picker and GPX import; `routePicker.ts` bundled route cards with filters; `freeRideView.ts` free ride player layout (`freeride.css`); `freeRideChart.ts` gradient-coloured elevation profile canvas; `freeRideMap.ts` Leaflet map with the route and rider dot (lazy-loaded).
- `results.ts` end-of-ride summary; `resultsGroup.ts` crew results and postcard PNG.

### tests/ and assets
- `tests/compliance|cosmetics|curve|erg|load|plan|gears|zwiftClick.test.ts` and others: vitest unit tests.
- `tests/builder.test.ts` builder core; `tests/compliance|cosmetics|curve|erg|load|plan.test.ts` vitest unit tests.
- `public/assets/CREDITS.md` asset credits.

## server/ (FastAPI, uv)
- `src/zombie_bus_server/app.py` REST (login, riders, rooms, profile), WebSocket, static client.
- `config.py` tunables, env vars, `SEED_USERS`; `protocol.py` message schemas; `plan.py` plan loading, targets, generator.
- `session.py` rooms, lobby, server clock, broadcast; `store.py` SQLite users, tokens, profiles, rides (list rows, detail, delete).
- `modes/zombie_bus.py` bus, horde, events, shop, awards rules; `modes/vo2_madness.py` VO2 Madness: dealing the session, effort scoring, crown, mystery box, awards.
- `tests/conftest.py` fixtures; `test_accounts.py` login and auth; `test_plan.py`; `test_zombie_bus.py`; `test_rides.py` ride history endpoints; `test_multiplayer.py` 4-bot headless ride.

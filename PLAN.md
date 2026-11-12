Zombie Bus: Indoor Trainer Game Plan
12 Nov 2026 · @Alex
Overview
A browser-based multiplayer game for smart trainers. Up to six friends ride together in co-op modes where each rider works to their own intensity. The first mode is Zombie Bus. The app also works solo as a structured workout runner.
Players and hardware
• 4 to 6 riders on Wahoo and Jet Black smart trainers (Bluetooth FTMS)
• Devices: Mac, Windows and possibly iPad
• Voice chat runs outside the game (Discord)
Design principles
• Score compliance not watts. Every rider is judged against a target from their own FTP and tier.
• One shared timeline. Everyone hits the same events at the same time with personal intensity.
• ERG drives the trainer. The game sets resistance for every interval.
• Janky hobby project, not a critical system. Fun over polish. Asset packs and procedural motion only.
• Session-only gameplay upgrades. Only cosmetics persist so nobody can grind ahead.
• Every phase ships something playable.
Core concepts
These live in the shared core and every game mode consumes them.
Rider profile
• Name, FTP (W), tier (Hard, Medium, Easy), power curve, ride stats, cosmetics owned and equipped, scrap balance
• Tier can change mid-session (auto-downgrade on blow-up or manual)
Workout plan (timeline)
• An ordered list of blocks. Each block has a duration, a type and a target per tier as % FTP.
• Block types: steady, ramp (start to end %), over-under (alternating % with a period), sprint (max effort, ERG always off, graded against the power curve), free (no target).
• Plans are JSON files in content/workouts/. Include progressions such as 2x15, 2x20 and 3x12 sweet spot, 3x10 threshold, over-unders, ramps and Z2.
• Sessions run from 30 to 90 min. A generator scales event count and block lengths to the chosen duration.
Compliance
• 3 s rolling average power against the target band (default ±5% of target).
• Score each tick from 0 to 1: 1 inside the band, decaying linearly to 0 at ±20%.
• Sprint blocks are not band scored. They use sprint grading (below).
• Compliance is the universal currency. Modes turn it into game outcomes.
ERG control
• The game sets the target watts on each block change and each over-under step.
• Hard cap per rider: never above 150% FTP. Sprints never use ERG. The trainer switches to a fixed low resistance or sim mode at 0% grade so the rider controls power.
• Smooth target changes over 2 s to avoid spikes.
Effects bus
• Temporary resistance modifiers (eg +10% for 30 s) emitted by modes.
• The core enforces caps and stacking rules. Not used by Zombie Bus MVP but built in from the start.
Cadence sync
• Group cadence spread is measured every tick.
• All active riders within ±5 rpm of the leader gives a sync bonus.
Power curve and stats
• After every ride record best average power for 1, 5, 15 and 30 s and 1, 2, 5, 10, 20 and 60 min.
• Keep the all-time best and 90-day best per duration with dates.
• Track ride count, total time, kJ, time in zone and weekly streak.
• New riders start with a default curve from FTP: 5 s 350%, 15 s 250%, 30 s 180%, 1 min 150%, 5 min 115%, 20 min 105%. Any real effort replaces a default point.
• Suggest an FTP update when 95% of the 20 min best differs from FTP by more than 3%.
Sprint grading
Each sprint has a duration (5 to 30 s). Average power over that duration is graded against the rider's 90-day best for the same duration.
Grade
% of 90-day best
Game effect
FAIL
Below 75%
Zombies get a grab and the bus takes armour damage
HIT
75 to 95%
Normal effect
GREAT
95 to 100%
Double effect and bonus scrap
MEGA
New 90-day best
Slow-mo, screen shake, big scrap bonus
LEGEND
New all-time best
MEGA plus a permanent trophy bolted to the bus
• Default curve points cap at GREAT so new riders don't get free MEGAs.
• Consecutive GREAT or better sprints build a combo multiplier for the ride.
• All thresholds live in config. These are first-pass numbers for tuning.
Zombie Bus mode
The crew rides a bus down an endless road with a zombie horde behind. Group compliance drives the bus. Fail and the horde catches up and damages the bus.
Bus state
System
Driven by
Effect
Speed
Mean group compliance x sync multiplier
Distance and scrap earned
Armour (0 to 100)
Damage when horde gap reaches zero
Low armour reduces end score; zero means limp to finish
Horde gap (m)
Bus speed minus horde speed
Visual tension and damage trigger
Engine in tune
Cadence sync
x1.25 speed while active
Scrap
Distance, event wins, awards
Spent in shop
Events (mapped from plan blocks)
Event
Block type
Mechanic
Long Haul
Steady
Horde speeds up. Out-of-zone time lets it close in.
Horde Surge
Over-under
Zombies grab the bus on unders. Each clean over shakes them off.
Roadblock
Sprint
All-out effort with ERG off. Each rider's sprint grade adds damage. MEGA and LEGEND hits get a slow-mo replay.
Servo Stop
Recovery or free
Rest, shop opens and the route vote runs.
Ramp-up (later)
Ramp
Bus climbs a hill out of a valley of zombies.
Rider states
• Riding: normal state.
• Fell off the bus: triggered when compliance is below 0.6 for 30 s. The rider auto-drops one tier and ERG eases. The others hold a 20 s effort to haul them back for bonus scrap.
• Spectator: disconnected or no power for 60 s.
Scene
• Low-poly 3D, chase camera behind and above the bus.
• Procedural road tiles, roadside props and a horde that is an instanced crowd.
• Riders shown as characters on the roof and in windows with name tags.
• Event mood through lighting and fog colour.
End of ride
• Summary: distance, armour, sync %, per-rider compliance and time in zone.
• Awards: Iron Lungs (best compliance), Fell Off King, Roadblock MVP, Sync Master, PR Hunter (most MEGA hits).
• Postcard image for the group chat (later phase).
Shop and cosmetics (Phase 4)
• Persistent: bus paint, decals, bull bar, roof spikes, rider hats and outfits, colour tints.
• Session only: armour plating, horde repellent (one free fail), wider sync window.
Solo
NPC passengers mirror the rider's compliance. Drill mode runs a plan with a minimal road scene and no events.
Tech stack and architecture
A static TypeScript client talks to trainers over Web Bluetooth and to a small Python WebSocket server for multiplayer.
Layer
Choice
Notes
Client
TypeScript, Vite, Three.js
Static build, served by the server or any static host
Trainer
Web Bluetooth, FTMS service
Read Indoor Bike Data (power, cadence). Write Control Point (request control, set target power).
Server
Python 3.12, FastAPI, WebSockets
Host-authoritative session state at 2 Hz
Storage
SQLite
Profiles, scrap, cosmetics, ride history
Assets
CC0 low-poly glTF packs (Kenney, Quaternius, KayKit)
One creator's style where possible. Credits file kept.
Hosting
Small Linux VPS with HTTPS
HTTPS is required for Web Bluetooth
Python tooling
uv, black, ruff, pytest
Google docstrings
TS tooling
pnpm, prettier, eslint, vitest

Data flow
1. Client reads trainer data at about 4 Hz and computes 3 s power locally.
2. Client sends power, cadence and compliance to the server at 2 Hz.
3. Server owns the session clock and current block. It broadcasts tick state (block, targets per rider, bus state, events) at 2 Hz.
4. Client sets ERG from the target in each server tick and renders the scene at 60 fps with interpolation.
Browser support
• Chrome or Edge on Mac and Windows.
• Safari does not support Web Bluetooth. iPad needs a Web Bluetooth browser such as Bluefy, to be tested in Phase 0.
• Fallback: a rider pairs the trainer from a laptop or phone tab and uses the iPad as a display only.
Simulated trainer
A fake trainer driver produces power and cadence from keyboard or a scripted profile. It is required for development and automated tests.
Repo structure
A single monorepo with the client, server and shared content.
zombie-bus/
  AGENTS.md              agent instructions (copy of the section below)
  PLAN.md                this document
  README.md
  client/
    src/
      trainer/           ftms.ts, simTrainer.ts, ergController.ts
      core/              plan.ts, compliance.ts, effects.ts, sync.ts
      net/               wsClient.ts, protocol.ts
      modes/
        zombieBus/       scene.ts, rules.ts, hud.ts
        drill/           scene.ts, hud.ts
      ui/                lobby, profile, results
      main.ts
    public/assets/       glTF models, audio, CREDITS.md
    package.json
  server/
    src/zombie_bus_server/
      app.py             FastAPI app and WebSocket endpoint
      session.py         session clock, block progression, broadcast
      modes/zombie_bus.py
      store.py           SQLite access
      protocol.py        message schemas (pydantic)
    tests/
    pyproject.toml
  content/
    workouts/            *.json plans
    events/              *.json event templates per mode
  docs/
    protocol.md          WebSocket message spec
    status.md            current phase, last done, next step, known issues
    map.md               one line per source file: what it does
    decisions.md         assumptions and invented mechanics log
Shared contracts
• docs/protocol.md is the source of truth for messages. The pydantic models and TS types must match it.
• Workout and event JSON are validated by both client and server against a JSON schema in content/schema/.
Phased build plan
Each phase ends with something playable. Do not start a phase until the previous acceptance criteria pass.
Phase 0: Trainer spike
A single HTML page that proves trainer control on every rider's device.
[ ] Connect to an FTMS trainer via Web Bluetooth
[ ] Show live power and cadence
[ ] Request control and set ERG target from a number input
[ ] Simulated trainer toggle
[ ] Deploy to the VPS over HTTPS
Acceptance: every rider sees power and cadence and feels ERG change on their own device. iPad result recorded.
Phase 1: Solo trainer (Drill mode)
[ ] Rider profile stored locally (name, FTP, tier)
[ ] Workout JSON schema and a starter library of at least 10 plans
[ ] Plan runner with ERG control, block countdown and next-block preview
[ ] Compliance engine and live compliance display
[ ] Power curve tracking with default curve from FTP
[ ] Sprint blocks with ERG off and sprint grading (FAIL to LEGEND)
[ ] Minimal road scene: bus speed from compliance
[ ] Ride summary with time in zone per block and curve updates, exported as JSON
[ ] Unit tests for plan parsing, compliance, ERG caps, sprint ERG-off and grading
Acceptance: a full 2x15 sweet spot session runs start to finish on a real trainer with correct targets.
Phase 2: Multiplayer
[ ] FastAPI server with WebSocket sessions and join codes
[ ] Host picks plan and duration; riders pick their tier
[ ] Server-owned clock and block progression; clients set ERG from server ticks
[ ] Riders shown on the bus with name tags and live compliance
[ ] Reconnect within 60 s keeps the rider's slot
[ ] Profiles, power curves and ride history move to SQLite on the server
Acceptance: four riders on mixed devices complete a 45 min plan together without desync.
Phase 3: Game layer
[ ] Horde, horde gap and armour
[ ] Events: Long Haul, Horde Surge, Roadblock, Servo Stop
[ ] Session generator that maps plan blocks to events and scales to 30 to 90 min
[ ] Engine in tune (cadence sync)
[ ] Fell off the bus with auto tier drop and team haul-back
[ ] Sprint grade feedback with sound, slow-mo and combo multiplier
[ ] End-of-ride summary, awards and new PRs
[ ] Event audio and lighting moods
Acceptance: the group rates a 60 min session as more fun than MyWhoosh.
Phase 4: Shop and cosmetics
[ ] Scrap economy and balances
[ ] Servo Stop shop with session upgrades
[ ] Persistent cosmetics for bus and riders using colour tints and swappable parts
[ ] Postcard image export
Acceptance: each rider has bought and equipped at least one cosmetic.
Later
Galley Ship, Chaingang, Bike Pub Quiz, Mario Kart Handicap and Asymmetric Hunt modes. Season ladder.
Agent instructions
Copy this section into AGENTS.md at the repo root.
Working rules
• Work one phase at a time from PLAN.md. Tick checklist items as they are done.
• Keep each change small and runnable. Commit after each checklist item.
• Every feature must work with the simulated trainer. Never require real hardware to run tests.
• Do not wait for the owner. This is a janky hobby project and the owner will not review most decisions. Make a reasonable assumption, log it in docs/decisions.md and keep going.
• Do not build features from later phases.
• Prefer simple and janky over clever. Fun first. You may invent or tune mechanics and numbers to make it more fun; log them in docs/decisions.md.
Safety rules for ERG
• All ERG writes go through ergController.ts. No other module writes to the trainer.
• Enforce the 150% FTP cap with unit tests. Sprint blocks must never send an ERG target; test this too.
• Ramp target changes over 2 s. On disconnect or error set ERG to 50% FTP then release control.
Code style
• Python: black, ruff, Google docstrings, type hints, pathlib for paths. Comments only on complex blocks.
• TypeScript: strict mode, prettier, eslint. Comments only on complex blocks.
• Australian English in UI text and docs.
• Config values (caps, bands, tick rates, sync window) live in one config file per side, not inline.
Shortest form
• Write code in its shortest readable form. Fewer lines, fewer files, fewer abstractions.
• No speculative interfaces, factories or class hierarchies. Add structure only when a second use exists.
• Prefer the standard library and existing dependencies. A new dependency is fine if it removes a lot of code.
• Delete dead code instead of commenting it out.
Assets
• Use CC0 assets only unless approved. Record every asset in client/public/assets/CREDITS.md with source and licence.
• Visual properties (colours, fog, camera) must be tunable parameters exposed in a debug panel.
Testing
• Unit tests for plan parsing, compliance, ERG caps, session generator and scoring.
• A headless multiplayer test that runs four simulated riders through a 5 min plan.
• Manual test notes per phase in docs/testing.md.
Context management
Agents degrade when their context fills with code. Keep reading minimal and state on disk.
1. Start every session by reading AGENTS.md, docs/status.md and the current phase in PLAN.md. Nothing else until needed.
2. Use docs/map.md to find files. Locate code with grep or ls, then read only the relevant function or line range, not whole files.
3. Keep files under about 300 lines with one job each. Split before they grow past that.
4. Modules talk through docs/protocol.md, the shared types and config. A change should touch few files.
5. Work one checklist item at a time. Commit when it works, then update docs/status.md and docs/map.md.
6. Never read node_modules, build output, lockfiles, binary assets or large JSON. Pipe long command output through head or tail and summarise errors rather than dumping them.
7. Run targeted tests for the change, then the full suite before committing.
8. If stuck after three attempts, stub or simplify, note it under known issues in docs/status.md and move on.
9. If the context is getting long, finish the current item, write status and start a fresh session.
10. Use sub-agents for exploration or broad searches when available and keep only their summary.
Open questions and risks
Item
Risk
Fallback
iPad Web Bluetooth
Safari has none; third-party browser support for FTMS writes is unproven
Pair trainer from another device, iPad as display
FTMS control on Jet Black and Wahoo
Firmware may differ in control point behaviour
Test both in Phase 0; read-only mode with on-screen targets
Trainer already paired to another app
Only one app can control a trainer
Close MyWhoosh and Wahoo apps before connecting
Network latency
Late ERG changes feel bad
Clients pre-schedule block changes from server clock
Asset style mismatch
Mixed packs look cheap
Pick one pack family and recolour in code
Scope creep
Never finishing a phase
Strict phase gates and acceptance criteria
[ ] Confirm zombie and bus asset packs exist in one CC0 style before Phase 1 scene work
[ ] Decide project name and domain
[ ] Confirm each rider's device and browser

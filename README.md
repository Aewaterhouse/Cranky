# Zombie Bus

A browser multiplayer game for smart bike trainers. Up to six friends ride a bus down an endless road with a zombie horde behind. Everyone follows the same workout timeline at their own intensity (from their FTP and tier), and group compliance drives the bus. Also works solo as a TrainerRoad-style ERG workout player (no 3D). Riders log in from name tiles; the server seeds Alex, Luke, Steve, Angus, Ali and Jack, and the password is the name (case-insensitive). Security is deliberately light: friends only. Trainers connect over Web Bluetooth (FTMS); the game sets ERG for each block.

See `PLAN.md` for the design, `docs/protocol.md` for the wire protocol, `docs/map.md` for a file-by-file map and `docs/testing.md` for manual test notes.

## Quick start (dev)

Server (Python 3.12, FastAPI, [uv](https://docs.astral.sh/uv/)):

```sh
cd server && uv sync && uv run uvicorn zombie_bus_server.app:app --host 0.0.0.0 --port 8000
```

Client (TypeScript, Vite, Three.js, pnpm):

```sh
cd client && pnpm install && pnpm dev
```

`pnpm dev` proxies `/api` and `/ws` to `localhost:8000` (override with `ZB_API=http://host:port`), so run the server too.

Production: `cd client && pnpm build`, then the server serves `client/dist` itself at `:8000`. `scripts/run.sh` does both (build, then start the server; extra args go to uvicorn).

## Tests

```sh
cd client && pnpm test      # vitest: plan, compliance, curve, ERG caps, cosmetics, load (NP/IF/TSS)
cd server && uv run pytest  # accounts, plans, bus rules and the 4-bot headless multiplayer test
```

## Server environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZB_DB` | `server/zombie_bus.db` | SQLite file path |
| `ZB_TIME_SCALE` | `1` | Server clock speed multiplier (e.g. `10` to run a 45 min ride in about 4.5 min) |
| `PUBLIC_URL` | `https://www.cranky.life` | The site's own address, for Strava's redirect and links that leave the app |
| `STRAVA_CLIENT_ID` | none | Strava API app id (strava.com/settings/api); without it the Strava section says it isn't set up |
| `STRAVA_CLIENT_SECRET` | none | Strava API app secret; stays on the server |

Docker sets `ZB_DB=/data/zombie_bus.db`; mount a volume at `/data` to keep profiles. On Railway, attach the volume at `/data` in the dashboard, because Railway does not allow `VOLUME` in a Dockerfile. `PORT` sets the listen port in the container (Railway sets it).

## Simulated trainer

On the home screen pick the simulated trainer (no hardware needed). Keys:

| Key | Effect |
| --- | --- |
| Up / Down | manual power +/- 10 W |
| Right / Left | cadence +/- 2 rpm |
| `]` / `[` | effort (how well the sim follows ERG) +/- 0.05 |
| `S` | sprint: 300% FTP |
| `A` | ease: 60% FTP |

## Solo workout player

Pick a plan and length on the Ride tab, then the solo setup screen. Controls (buttons or keys):

| Key | Effect |
| --- | --- |
| Space or `P` | pause or resume (ERG drops to 40% FTP while paused) |
| `N` or Right | skip to the next interval (Right is left to the simulated trainer) |
| `+` / `-` | intensity +/- 1% (50 to 150%, scales every ERG target) |
| `Z` / `X` | virtual gear down / up (Slope mode only) |
| `;` / `'` | shift strength down / up (Slope mode only) |
| Esc | end the ride (asks first) |

Auto-pause: after 3 s of zero power or cadence the clock stops, and resumes after 1.5 s of pedalling. Sprints never auto-pause. The results screen shows NP, IF and TSS.

## Free ride keys

| Key | Effect |
| --- | --- |
| Space or `P` | pause or resume |
| `+` / `-` | trainer difficulty +/- 5% |
| `Z` / `X` | virtual gear down / up |
| `;` / `'` | shift strength down / up |
| `C` | camera view: Chase, High, Rear, Side |
| Esc | end the ride (asks first) |

## Camera

In the Zombie Bus, VO2 Madness, free ride and both TV views (bus and group ride), the 3D camera is yours to move:

| Input | Effect |
| --- | --- |
| `C` or the 🎥 button | next view: Chase (the game's own), High, Rear, Side; remembered on this device |
| Drag (mouse or one finger) on the 3D view | turn the camera round the bus or rider |
| Wheel or pinch | zoom in and out |
| Double click or double tap | straight back to the view |

Photo mode (free ride): pause, then 📷 Photo mode. The HUD goes, drag, zoom and the arrows (or two fingers) frame the shot, "Use as postcard" keeps it for the ride's postcard, and Done carries on.

With no camera input for 8 s the view eases back by itself. HUD panels, buttons, the map and sliders work as before; only drags that start on the 3D view move the camera.

## Crew cards

On the bus, in VO2 Madness, the TV view and group free rides, the crew is a column of cards down the right edge (`R` shows or hides it on the bus).

| Input | Effect |
| --- | --- |
| Click or tap a card | open it for every number (now and this ride), again to close |
| `D` or the button at the top | open or close every card (remembered on this device) |

## Strava

Each rider connects once under Rider → Settings → Connect with Strava, approves "upload activities" on Strava's page and comes back to Settings. The connection is kept on the server, so it works from any browser after that. On an iPad in Bluefy, Strava may open its own app instead of coming back; connect once from Safari or a laptop. The Strava app's Authorization Callback Domain (strava.com/settings/api) must be the host of `PUBLIC_URL` (`www.cranky.life`). Once connected, every ride of 30 s or more goes up by itself when it is saved, as a Virtual Ride with a title and description from the ride (switch "Upload rides automatically" off to stop that). The description ends with a link to the ride's postcard page (`/p/<id>`), which previews as the picture; "Save postcard for Strava" on the results screen saves the picture to add to the activity by hand. Disconnect in the same place removes Cranky from the rider's Strava account and deletes the tokens.

## Zwift Click and virtual gears

Free ride, solo Slope mode and the Zombie Bus with ERG off (pick Gears in the bus lobby, or `E` mid-ride) have 24 virtual gears (ratios 0.75 to 5.49, starting in gear 12). The gear changes the gradient sent to the trainer so that each gear feels like a real one; the game speed in free ride still comes from your power. The gear is shown as a big GEAR tile with the gradient sent to the trainer underneath. Trainer difficulty scales only the road; each gear always adds the same offset, scaled by Shift strength (50 to 300%, default 150%; slider in Settings, in free ride and in Slope mode, `;` and `'` while riding; the gear tile and chip show it, and tapping the chip opens the slider). Set your chainring under Settings (it assumes a 14T Zwift Cog; default 34T). On the bus the gears sit on a flat 2% road: Z X, the arrows or a Zwift Click shift, and the target still scores.

The Click needs firmware 1.1.0 or later: 1.0.0 ignores the RideOn handshake. Update it in Zwift Companion: More > Equipment > Zwift Click > Update Firmware. On 1.1.0 the handshake write with response fails, so the driver writes it without response; keep it that way.

Pair a Zwift Click (the original v1) in the trainer window under "Zwift Click (optional)". Plus shifts up and minus shifts down in free ride and Slope mode. In ERG mode they change intensity by 1%, and in Resistance mode they step the level. Zombie Bus, FTP tests and the TV view ignore the Click. To check a Click without riding, open `/spike.html` and use "Pair Zwift Click"; every raw message is logged to the browser console as `[Click]`.



- `?debug` shows the visual debug panel (colours, fog, camera). The backtick key toggles it too.
- `?fast=N` speeds up the solo clock by N for dev (use `ZB_TIME_SCALE` for multiplayer).
- `?join=CODE` prefills the room code when joining a bus.
- `?diag=1` shows the window and visual-viewport size, page zoom, pixel ratio and safe-area insets in the middle of the screen (to read the real numbers off a phone).

## Scene dev harness

`pnpm dev` only: open `/scene-dev.html` to look at the 3D scene without a server or trainer. Params: `mood=drill|longhaul|surge|roadblock|servo|finish`, `gap=0..120|none`, `armour=0..100|none`, `speed=m/s`, `roadblock=0..1`, `paint=paint-rust`, `bullbar=1`, `spikes=1`, `riders=1..6`, `gunship=1`, `mad=1` (VO2 Madness pack), `debug=1`, `hud=0`, `vis.<name>=n` (any numeric visual tunable, e.g. `vis.camHeight=5`), `fx=hit|shake|slowmo|smash|drop|airstrike` with `fxAt=ms`, `camcheck=1` (poses every camera view at its zoom and orbit extremes and lists any blank background below the horizon, bottom left). Keys: 1-6 mood, `[` `]` gap, `\` horde on/off, `-` `=` armour, `,` `.` speed, `r` roadblock, `h` `j` `k` `m` fx, `d` supply drop, `a` air strike, `u` gunship, `b` bull bar, `n` spikes, `p` paint, `g` debug panel, `c` camera view (Chase, High, Rear, Side; `a`, `d` and `u` also play the air strike, supply drop and gunship cinematics).

`pnpm dev` only: open `/route-dev.html` to look at the free-ride road world on any bundled route. Params: `route=<id>` (default `mount-coot-tha`; `nomap` is a made-up climb with no coordinates), `d=<metres along>`, `speed=<m/s>` (auto-rides), `cadence=rpm`, `offset=<metres right of the centre line>`, `riders=N` (extra riders around you), `terrain=0` (ignore the height grid), `gfx=potato|low|medium|high`, `next=odd|sign|chalk|life` (start just before the next roadside oddity, funny sign, chalk or animal; `kind=couch` or `kind=roos` narrows it, `back=14` sets how far before), `odd=couch` (every oddity a couch; `odd=*` cycles the kinds), `mood=routeDawn|route|routeGolden|routeDusk|routeMist|routeShower`, `debug=1`, `hud=0`, `vis.route.<name>=n` (any numeric tunable, e.g. `vis.route.camHeight=60`), `camcheck=1` (the same camera check as the scene page). Keys: `,` `.` speed, `[` `]` jump 500 m, `n` next oddity, `g` debug panel, `c` camera view, `q` gear clunk sound. The debug panel's Route world folder has the camera, fog, skyline, road, ground and colour settings.

## HTTPS (important)

Web Bluetooth only works in a secure context: `https://` or `http://localhost`. Options:

### a) Tailscale (the plan)

Host the server on a machine on the tailnet, then:

```sh
tailscale serve --bg 8000
```

That gives an HTTPS URL on the tailnet (`https://<machine>.<tailnet>.ts.net`), which satisfies the secure-context requirement. Friends join the tailnet and open that URL. WebSockets pass through.

### b) Reverse proxy or Railway

Point an HTTPS proxy (Caddy: `reverse_proxy localhost:8000`) at port 8000, passing WebSocket upgrades on `/ws`. Or deploy this repo to Railway (uses the `Dockerfile`; add a volume at `/data`).

### c) LAN testing

`scripts/selfsigned.sh` writes `certs/key.pem` and `certs/cert.pem` and prints the uvicorn `--ssl-keyfile/--ssl-certfile` command (port 8443); accept the warning on each device. Or in Chrome set `chrome://flags/#unsafely-treat-insecure-origin-as-secure` for `http://<lan-ip>:8000`.

## Browsers and hardware

- Chrome or Edge on Mac and Windows. Safari and Firefox have no Web Bluetooth.
- iPad: needs the Bluefy browser (untested), or use the iPad as a display only while another device pairs with the trainer.
- Close MyWhoosh, Wahoo and any other app using the trainer before pairing; FTMS allows one connection at a time.

## Optional extras

- `ZB_DISCORD_WEBHOOK`: a Discord channel webhook URL. When set, the server posts each finished Zombie Bus ride summary there.
- `ZB_BACKUPS`: folder for the nightly database backups (default `backups/` beside the database, so `/data/backups` on Railway; newest 14 kept).
- `ZB_BACKUP_HOUR`: the hour (server time) of the nightly backup (default 17, which is 3 or 4 am in Brisbane when the server runs on UTC).

## Backups and restoring

Everything lives in one SQLite file: riders, profiles, ride history, segment efforts and the season ladder. On Railway it is `/data/zombie_bus.db` on the volume.

Two kinds of backup cover it:
- **The server's own.** Every night at `ZB_BACKUP_HOUR` it writes `cranky-YYYYMMDD-HHMMSS.db` into `/data/backups` and keeps the newest 14. It also writes one at startup if the newest is over a day old.
- **Railway volume backups** (daily and weekly, set in the Railway dashboard under the volume's Backups tab). These copy the whole volume, the server's backups included.

To restore from one of the server's backups (Railway):
1. Open a shell on the service: `railway ssh` (or the service's shell in the dashboard).
2. `ls -l /data/backups` and pick a file.
3. `cp /data/backups/cranky-20261114-170000.db /data/restore.db`
4. Restart the service (dashboard, or `railway redeploy`). At startup the server moves the live file to `/data/zombie_bus.db.before-restore` and puts `restore.db` in its place.
5. Check History, then delete `/data/zombie_bus.db.before-restore` once you are happy (or copy it back to `/data/restore.db` and restart to undo).

To restore the whole volume instead, use Restore on a backup in the volume's Backups tab in Railway; it replaces everything on `/data`.

Locally it is the same: copy a backup from `server/backups/` to `server/restore.db` and restart the server.

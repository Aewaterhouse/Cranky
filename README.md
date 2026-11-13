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
| Esc | end the ride (asks first) |

Auto-pause: after 3 s of zero power or cadence the clock stops, and resumes after 1.5 s of pedalling. Sprints never auto-pause. The results screen shows NP, IF and TSS.

## Free ride keys

| Key | Effect |
| --- | --- |
| Space or `P` | pause or resume |
| `+` / `-` | trainer difficulty +/- 5% |
| `Z` / `X` | virtual gear down / up |
| Esc | end the ride (asks first) |

## Zwift Click and virtual gears

Free ride and solo Slope mode have 24 virtual gears (ratios 0.75 to 5.49, starting in gear 12). The gear changes the gradient sent to the trainer so that each gear feels like a real one; the game speed in free ride still comes from your power. Set your chainring under Settings (it assumes a 14T Zwift Cog; default 34T).

Pair a Zwift Click (the original v1) in the trainer window under "Zwift Click (optional)". Plus shifts up and minus shifts down in free ride and Slope mode. In ERG mode they change intensity by 1%, and in Resistance mode they step the level. Zombie Bus, FTP tests and the TV view ignore the Click. To check a Click without riding, open `/spike.html` and use "Pair Zwift Click"; every raw message is logged to the browser console as `[Click]`.



- `?debug` shows the visual debug panel (colours, fog, camera). The backtick key toggles it too.
- `?fast=N` speeds up the solo clock by N for dev (use `ZB_TIME_SCALE` for multiplayer).
- `?join=CODE` prefills the room code when joining a bus.

## Scene dev harness

`pnpm dev` only: open `/scene-dev.html` to look at the 3D scene without a server or trainer. Params: `mood=drill|longhaul|surge|roadblock|servo|finish`, `gap=0..120|none`, `armour=0..100|none`, `speed=m/s`, `roadblock=0..1`, `paint=paint-rust`, `bullbar=1`, `spikes=1`, `riders=1..6`, `gunship=1`, `mad=1` (VO2 Madness pack), `debug=1`, `hud=0`, `vis.<name>=n` (any numeric visual tunable, e.g. `vis.camHeight=5`), `fx=hit|shake|slowmo|smash|drop|airstrike` with `fxAt=ms`. Keys: 1-6 mood, `[` `]` gap, `\` horde on/off, `-` `=` armour, `,` `.` speed, `r` roadblock, `h` `j` `k` `m` fx, `d` supply drop, `a` air strike, `u` gunship, `b` bull bar, `n` spikes, `p` paint, `g` debug panel.

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
- `ZB_BACKUPS`: folder for the daily database backups (default `server/backups/`, newest 14 kept).

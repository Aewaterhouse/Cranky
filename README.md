# Zombie Bus

A browser multiplayer game for smart bike trainers. Up to six friends ride a bus down an endless road with a zombie horde behind. Everyone follows the same workout timeline at their own intensity (from their FTP and tier), and group compliance drives the bus. Also works solo as a structured workout runner (drill mode). Trainers connect over Web Bluetooth (FTMS); the game sets ERG for each block.

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

`pnpm dev` proxies `/api` and `/ws` to `localhost:8000`, so run the server too.

Production: `cd client && pnpm build`, then the server serves `client/dist` itself at `:8000`. `scripts/run.sh` does both (build, then start the server; extra args go to uvicorn).

## Tests

```sh
cd client && pnpm test      # vitest: plan, compliance, curve, ERG caps
cd server && uv run pytest  # includes the 4-bot headless multiplayer test
```

## Server environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZB_DB` | `server/zombie_bus.db` | SQLite file path |
| `ZB_TIME_SCALE` | `1` | Server clock speed multiplier (e.g. `10` to run a 45 min ride in about 4.5 min) |

Docker sets `ZB_DB=/data/zombie_bus.db`; mount a volume at `/data` to keep profiles. `PORT` sets the listen port in the container (Railway sets it).

## Simulated trainer

On the home screen pick the simulated trainer (no hardware needed). Keys:

| Key | Effect |
| --- | --- |
| Up / Down | manual power +/- 10 W |
| Right / Left | cadence +/- 2 rpm |
| `]` / `[` | effort (how well the sim follows ERG) +/- 0.05 |
| `S` | sprint: 300% FTP |
| `A` | ease: 60% FTP |

## URL params

- `?debug` shows the visual debug panel (colours, fog, camera). The backtick key toggles it too.
- `?fast=N` speeds up the drill clock by N for dev (drill mode only; use `ZB_TIME_SCALE` for multiplayer).
- `?join=CODE` prefills the room code on the home screen.

## HTTPS (important)

Web Bluetooth only works in a secure context: `https://` or `http://localhost`. If you open the game from another machine over plain http, the Connect button will not work. Options:

### a) VPS behind an HTTPS reverse proxy

Point the proxy at port 8000. WebSocket upgrade must pass through for `/ws`.

Caddy (handles upgrades automatically):

```
zombie.example.com {
    reverse_proxy localhost:8000
}
```

nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /ws {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}
```

### b) Railway

Deploy from this repo; Railway uses the `Dockerfile` and gives you HTTPS. Add a volume mounted at `/data` if you want profiles to survive redeploys.

### c) LAN testing

Either generate a self-signed cert and serve HTTPS directly:

```sh
scripts/selfsigned.sh   # writes certs/key.pem and certs/cert.pem (localhost + LAN IP), prints the command
cd server && uv run uvicorn zombie_bus_server.app:app --host 0.0.0.0 --port 8443 \
  --ssl-keyfile ../certs/key.pem --ssl-certfile ../certs/cert.pem
```

then accept the certificate warning on each device; or in Chrome open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<lan-ip>:8000`, enable and relaunch.

## Browsers and hardware

- Chrome or Edge on Mac and Windows. Safari and Firefox have no Web Bluetooth.
- iPad: needs the Bluefy browser (untested), or use the iPad as a display only while another device pairs with the trainer.
- Close MyWhoosh, Wahoo and any other app using the trainer before pairing; FTMS allows one connection at a time.

# Status

**Current phase:** Phases 1 to 4 are built, along with accounts and the UI and graphics overhaul. Everything is only headless-tested: no real trainer, no real GPU and no group ride yet.

## Last done
- Phases 1 to 4: ERG, compliance, sprints, power curve, rooms, server clock, the Zombie Bus rules, Servo Stop shop, garage cosmetics, postcard.
- Accounts: seeded rider logins (name = password), bearer token for the API and WebSocket, open-bus listing.
- UI: login tiles, Ride / Garage / Rider tabs, trainer pill and modal, plan picker with workout graphs, solo setup, bus lobby.
- Solo is now a TrainerRoad-style ERG workout player (pause, skip, intensity, auto-pause, NP/IF/TSS). No 3D.
- Scene graphics rewritten into modules under `client/src/scene/`, with `scene-dev.html` for dev.
- Game HUD rewritten (`ui/hud*.ts`, `hud*.css`).

## Next step
- Real-trainer checks: `/spike.html` on each rider's device, then a full 2x15 sweet spot in solo.
- A first group ride on the bus (over Tailscale).
- Tune the numbers afterwards.

## Known issues
- Untested against real FTMS trainers. Control point responses are not checked, and writes are just serialised.
- Web Bluetooth needs HTTPS (or localhost). See the README (Tailscale is the plan).
- Icons are emoji, so they look different per OS.
- Scene performance is unmeasured on real GPUs; it has only run on software GL.
- The horde is only on screen when the gap is under about 30 m, because the camera is behind the bus.
- Ride view bundle is large, since three.js isn't code-split.
- `?fast=N` only affects solo. For multiplayer, use `ZB_TIME_SCALE` on the server.
- Rooms live in memory, so restarting the server ends any ride in progress.
- Auth is name = password with no rate limiting. Fine for friends on a tailnet, not for the open internet.

## Hardware log
- 2026-11-12: the owner confirmed Bluetooth pairing and ERG control on a real trainer, in Brave over localhost (SSH port forward). Brave needs `brave://flags/#brave-web-bluetooth-api` enabled.
- See `docs/roadmap.md` for the backlog.

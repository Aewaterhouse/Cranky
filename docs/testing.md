# Manual testing

Log in first: tap your name tile and type your name as the password (Alex, Luke, Steve, Angus, Ali, Jack; case-insensitive). The app has Ride, Garage and Rider tabs; connect a trainer (or the simulated one) from the trainer pill at the top.

Headless first (no hardware):

```sh
cd client && pnpm test       # plan parsing, compliance, ERG caps, curve, cosmetics, load
cd server && uv run pytest   # plan, accounts, Zombie Bus rules, 4-bot headless multiplayer
cd client && pnpm build      # type check + build
```

Use `?debug` for the visual panel, `/scene-dev.html` (dev server) to inspect the scene, and `?fast=N` (solo) or `ZB_TIME_SCALE` (server) to skip time. Needs https or localhost for Bluetooth; see README.

## Phase 0: trainer spike (`/spike.html`)

Close MyWhoosh/Wahoo apps first.

1. Connect: chooser lists the trainer, status shows connected.
2. Power and cadence update about once a second and match the trainer's own display. Soft-pedal and sprint to check the range.
3. Set ERG (e.g. 150 W): resistance change is felt within a couple of seconds and power settles on target. Try 100 W then 250 W (ramp over about 2 s, no jolt).
4. ERG off: resistance releases and you control power freely.
5. Release/disconnect: trainer returns to normal, no stuck resistance. Reconnect works.

| Rider | Device / OS | Browser | Trainer | Connect | Power/cad | ERG felt | ERG off | Release | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Mac |  |  |  |  |  |  |  |  |
|  | Windows |  |  |  |  |  |  |  |  |
|  | iPad | Bluefy |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |

## Phase 1: solo workout, real trainer

1. Ride tab, Solo: pick `ss-2x15` and a length in the plan picker (every card scales to it), check the setup screen, set your FTP and start.
2. Run start to finish. Each interval's target watts match FTP x tier x block % x intensity (check the HUD against the trainer's display).
3. Targets change smoothly on block boundaries; ERG never exceeds 150% FTP.
4. Controls: Space pauses (ERG eases to 40% FTP), N skips, +/- change intensity, Esc asks to end. Stop pedalling for 3 s and it auto-pauses; resume pedalling and it carries on.
5. Sprint blocks: ERG is off, you control power, and a grade (FAIL/HIT/GREAT/MEGA/LEGEND) shows afterwards. No auto-pause during a sprint.
6. Results screen shows NP, IF, TSS, time in zone and compliance. The FTP suggestion only ever goes up. The Rider tab (curve, ride count) updates.
7. End mid-ride: trainer releases and ERG eases to 50% FTP.

## Phase 2: multiplayer

1. 4 riders logged in as different names, mixed devices (Mac, Windows, simulated, iPad display), one 45 min plan (`bus-crew-45`). Host starts a bus from Ride; the others pick it from the open-bus list in Ride (or use the code or `?join=CODE`). Also check a bus of one rider.
2. Lobby shows everyone, tiers and ready state; countdown starts together; all see the same event at the same time.
3. Reconnect: close a rider's tab mid-ride and reopen it (logging in again if needed). It should rejoin the same seat (and ERG resume). While away the rider is a spectator.
4. Host disconnect and room idle expiry behave sensibly.
5. Note lag, desync or crashes below.

## Phase 3: Zombie Bus rules

- Fell off: hold under 60% compliance for 30 s. Rider drops one tier, ERG eases, others get a 20 s haul-back effort for bonus scrap.
- Roadblock: all riders sprint with ERG off; grades add damage; MEGA/LEGEND give slow-mo. A fail costs armour and gap.
- Horde surge: unders let zombies grab, clean overs shake them off.
- Engine in tune: all riders within 5 rpm of each other for 8 s gives the x1.25 speed bonus and indicator.
- Long haul: staying out of zone lets the horde close in; armour at zero means limp.
- Servo Stop: the shop appears in the HUD; buy plating, repellent and sync with the tin's scrap and check the bus numbers change.
- Awards at the end: Iron Lungs, Fell Off King, Roadblock MVP, Sync Master, PR Hunter.

## Results log

| Date | Phase | Who / devices | Result | Issues |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Headless end-to-end ride

`scripts/e2e.sh` builds the client, starts a 20× server on port 8199 with a throwaway database, and drives a solo workout plus a two-rider Zombie Bus ride in headless Chromium (`client/e2e/ride.cjs`). It takes about two minutes and fails on any page error. Run it before merging anything that touches the ride flow.

## Free ride 3D world (Phase B)

Run `pnpm dev` in `client/` and open `/route-dev.html` (no server or trainer needed). Add `&debug=1` for the panel.

- `?route=mount-coot-tha&d=1500&speed=8`: the road bends and climbs like the real one, lines and verges are clean, the ground meets the verge with no gap, hills roll away either side and blue hills sit on the horizon.
- `?route=ben-lomond&d=14700&speed=6` (Jacob's Ladder): each leg of the switchbacks sits on its own bench with rock between, the legs above and below are visible, nothing covers the road, and the rider stays in shot through the hairpins.
- `?route=mount-hotham&d=26500`: snow patches near the top. `?route=beach-road&d=8000`: flat and open.
- `?route=nomap` (no coordinates) and `&terrain=0` (no height grid): a gently wandering road with made-up hills, still following the real gradient.
- Ride any route for a few kilometres at `speed=15`: the chunk count in the help line stays roughly steady and there are no hitches as chunks arrive.
- Look for: road buried or floating, see-through cracks, flicker where two strips overlap. Note them in the results log with the route and distance.


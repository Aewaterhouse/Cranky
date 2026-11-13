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
- In the app: Ride, Free ride, pick Mount Coot-tha, Start with the simulated trainer. The 3D world should fill the screen behind the numbers, your rider's legs should turn at your cadence and stop when you stop, and the elevation strip and minimap should track you. Pause, End ride and the difficulty slider still work.
- Settings, Free ride view, Charts: the next free ride uses the flat layout. Set it back to 3D world afterwards.
- Settings, Graphics, Potato then High: the view distance and sharpness change on the next ride.
- On a device or browser with WebGL turned off, free ride should fall back to the flat layout by itself.
- Not yet checked on a real graphics card: frame rate. The target is 60 fps at Medium on a mid laptop.


## Free-ride HUD (Phase B2)

In the app: Ride, Free ride, Mount Coot-tha, Start with the simulated trainer. Add `?fast=6` to the address to get to the hills sooner and `&ghosts=4` for made-up mates.

- Default view: power big at top left with a zone-coloured bar and "Z3" beside it, W/kg small, cadence beneath; speed top centre with distance, time and climbed under it; minimap top right; a thin elevation strip along the bottom. Nothing else. The road and rider are never covered.
- Heart rate appears beside cadence only with a strap (or the simulated one) connected; cadence does not move when it comes and goes.
- Pedal harder and easier: the bar under the power goes grey, blue, green, yellow, orange, red at 60, 76, 90, 105 and 119% of FTP.
- On a slope of 2% or more a gradient chip appears above the strip (arrow, number, colour); it goes on the flat.
- On Coot-tha the climb panel appears about 150 m before the first climb ("Climb in 120 m"), then shows the average gradient, distance and metres to the top, an ETA and the next kilometre of profile. It goes at the top and does not flicker on the rolling bits.
- X or Z (or a Zwift Click): the gear chip appears bottom right and stays. It is not there before the first shift unless a Click is paired.
- S or the Stats button: the drawer under the power opens and closes (average and normalised power, to go, climb to go, finish in, arrive, trainer gradient).
- The ☰ button: route name, trainer difficulty slider, Pause, End ride and the Stats, Map, Riders and Clean view toggles. + and - still change the difficulty.
- H: everything goes. H again (or a tap on the scene) brings it back. M hides the minimap, R the rider list.
- With `&ghosts=4`: the rider list sits on the right under the map, you highlighted, riders ahead above you with "+" gaps and behind with "-"; gaps are in metres while you are stopped.
- A toast with the route name shows under the speed for three seconds at the start.
- Settings, In-ride display size: Small, Normal, Large and Huge all keep every panel on screen without overlap.
- Phone in landscape (or a 844 by 390 window): no minimap or rider list until switched on from the menu, buttons big enough to tap, nothing under the notch.
- Settings, Free ride view, Charts: the old flat layout still works, with its tiles, both profiles and the big map.
- Not checked on real hardware: a telly across the room, an iPad, a phone with a notch, a real heart-rate strap.

## Free ride 3D world (Phase C)

Same harness as Phase B (`/route-dev.html`). Add `&vis.route.camHeight=40&vis.route.camBack=40` for a view from above.

- `?route=ben-lomond&d=15000`: no see-through sheets between the legs of Jacob's Ladder; rock walls between benches are fine, thin cracks inside the tightest hairpins are known.
- `?route=akuna-bay&d=9680`: the out-and-back to the water is two carriageways with a turning loop at the end; the rider keeps left out and back.
- `?route=mount-coot-tha&d=2440&fixture=1`: made-up map data. Ground changes colour by zone with soft edges, a pale side street meets the road at the tarmac edge every 250 m with a green name sign on the corner, lakes are flat blue with sand round them.
- `?route=great-ocean-road&d=12000` and `?route=beach-road&d=8000` (no map data): sea is flat blue with a strip of sand, land is bush and grass.
- `?route=mount-hotham&d=26500`: heath and rock above the treeline, snow on top.
- `?route=mount-coot-tha&d=2500`: tall pale gums and white scribbly gums either side, thicker in the dark forest patches, shrubs and tussocks near the verge, tree shadows across the road. Nothing on the tarmac or verge.
- `?route=mount-coot-tha&d=2700&fixture=1`: houses along the side streets with different walls and roofs, doors facing the road, none on a street. Look for a house half-buried or floating on steep ground.
- `?route=mount-hotham&d=20000` then `d=24000`: snow gums, then only boulders, tussocks and shrubs above the treeline.
- Settings, Graphics, Potato: far fewer plants and none beyond 60 m.
- `?route=mount-coot-tha&d=0`: green START arch over the road with a readable banner; the FINISH arch of the loop is just behind it.
- `?route=ben-lomond&d=14200` and on: a green kilometre marker each km on the left, a yellow gradient sign before the ladder, blue numbered hairpin signs counting down, grey guard rail on the drop side, white edge posts round the bends. `d=17700`: red SUMMIT arch at the end.
- Look for: a sign or post standing on the tarmac, a rail floating above or buried in the verge, a sign facing away from the rider.
- Oddities: `?route=mount-coot-tha&next=odd` starts 14 m before the next roadside oddity; press `n` for the one after. `&kind=couch` jumps to the next couch, `&odd=couch` turns every oddity into a couch and `&odd=*&vis.route.place.fun.odd.gap=22` lines up every kind. Each should stand on the ground beside the road facing you, with a readable board where it has one. `?route=mount-hotham&d=27000&next=odd`: snowmen and skis above the snowline. `?route=great-ocean-road&next=odd&kind=kombi`: surf van by the coast. Every route has one big thing (`&next=odd&kind=bigPie`, `bigThong`, `bigEsky` or `bigSnag`; only one of the four finds it).
- Funny signs and chalk: `?route=ben-lomond&d=13000&next=sign` then `n`: big yellow, green or white council boards and crooked hand-painted ones, three short lines each, readable from about 20 m. `&next=chalk`: chalk across the lane on the climbs, top line furthest away, lying flat on the tarmac with no flicker.
- Look for: an oddity or board on the tarmac, on a side street or in water; one floating or half-buried on a slope; a tree growing through one; chalk hanging over the edge of the road.
- Wildlife: `?route=mount-coot-tha&next=life&speed=6` rides up to the next animals; `&kind=roos` (also `cows`, `sheep`, `cockatoos`, `galahs`, `seagulls`, `wombat`, `lyrebird`, `magpie`, `ute`, `caravan`, `coach`) picks a kind, where the route has one. Roos should sit up, then hop away from the road as you arrive and stop to watch; flocks burst into the air; the wombat ambles across in front of you; the magpie makes three passes over your helmet; vehicles come down the other lane and pass on your right. Nothing should float above or sink into the ground, and animals should not stand on the road unless they are crossing it.
- Moods: `&mood=routeDawn`, `routeGolden`, `routeDusk`, `routeMist`, `routeShower` (rain streaks should fall around the camera). Without `mood=` the sky follows your clock; `?route=mount-hotham&d=25000` is in mist on most days. The debug panel (`g`) has the same choice under Route world, mood.
- Remarks: in the app start a free ride on Mount Coot-tha with the simulated trainer. A remark appears about 8 s in, then no more than one a minute; passing an oddity usually gets one. Hold the simulated power above 105% of FTP: only short encouragement, at most every 90 s. Stop for 20 s: one remark. Settings, Free ride remarks, Off: none.

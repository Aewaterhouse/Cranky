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

## HUD conventions in the solo player and the bus (Phase B2)

Simulated trainer throughout. `?fast=20` speeds a solo workout up; `[` and `]` change the simulator's effort so power goes off target.

**Solo workout**

1. Start Sweet Spot 3x20 in ERG. Top left: "Target" with a lock and "ERG", the target big, a tolerance bar, your power beneath it in its zone colour, cadence under that. Top centre: the interval's name and "1 of 8", the time left big, "gone" and "to go" small. Right edge: the interval list with the current one highlighted. Bottom: the whole workout as a strip with a now line and your trace.
2. Press `[` twice: the needle leaves the green band and the words go amber ("▲ push 18 W"). Three more: red. `]` back: "on target", green.
3. In the warm-up and each Recover, "Next: 20:00 at 178 W" sits under the clock the whole time. In a sweet spot block it appears only for the last 10 s.
4. The last 3 s of every interval: 3, 2, 1 under the clock with a tone each, then the block tone.
5. When a sweet spot block ends, a summary shows top right for 5 s: average, off target, in band. Nothing shows after a Recover.
6. The coach's line appears under the clock in the accent colour, goes quiet after 8 s and clears when the interval ends. The panel does not change height.
7. ☰: mode, tier, Pause, Skip interval, End ride, Stats, Intervals, Clean view, Media, Cadence line, Heart rate line, display size all work. Picking Large makes every number bigger at once.
8. S opens the stats drawer under the power panel; I hides the interval list; H hides everything but the chart and H or a tap on the chart brings it back.
9. R (resistance): the big number is your power, "Resistance 40%" is on the second line, the chip says "aim 178 W", a stepper for the level appears bottom right. G (slope) the same with the gradient and gear. E back to ERG.
10. Cadence Spin-ups: in a spin-up the cadence unit reads "110–120 rpm" and the number is amber outside the band, green inside.
11. Sprints 8x10: before a sprint the big 3-2-1 covers the chart; in it the panel says "Sprint · ERG off" and "All out" with no target anywhere; the grade splashes afterwards.
12. Ramp test (Solo workout, Test your FTP): no mode, tier or intensity controls; "I'm done" is in the dock during the ramp; the new FTP question comes at the end.
13. Space pauses: "PAUSED" over the chart with the HUD still readable behind it. Esc asks before ending.
14. Media in the menu opens the video corner bottom right, above the strip; typing in its box does not pause or skip.
15. Ride a workout twice: the second time the dashed blue ghost is on both charts and the stats drawer says what it is.

**Zombie Bus**

16. Two riders, Bus Quick 30. Top left: your power big with zone and W/kg, the tolerance bar, "Target 111 W on target", cadence. Top centre: the event, time left big, "Next: …". Right edge: both riders with watts and compliance, yours highlighted. Bottom centre: bus status in one block. Bottom: the plan strip with elapsed and total.
17. Roadblock (sprint): "SPRINT · all out" chip under the clock, the panel says "Sprint · ERG off" and "All out · best … W", the bar fills as you push. No target power on screen, in the header's "Next" line beforehand either.
18. Servo Stop: the shop opens above the bus status block and buying still works; the feed lines show bottom left, above the bus status block and clear of it.
19. A rider who stops pedalling falls off: their row says "fell · 20 s" counting down in red.
20. ☰: tier, Stats, Crew, Clean view, End ride (Leave the bus for a guest), display size. S or Tab opens my stats under the power panel; R hides the crew; H hides the HUD and the game panels, splashes still show.
21. VO2 Madness: the mystery box and "who's trying hardest" board are in the left column under the power panel; everything else as above.
22. TV (`?watch=CODE`): the board is laid out as before; numbers do not jiggle as they change.

**Everywhere**

23. In-ride display size Large (Settings, or the ☰ menu mid-ride): solo, bus and free ride all grow, the bus status block with them, and nothing overlaps at 1280x720. Huge is for big screens: at 1280x720 the solo clock panel crowds its neighbours (known).
24. Settings, colour-blind colours on: zone colours change in the power panel, the charts, the interval list, the plan strip and heart rates; the tolerance colours become green, yellow and vermilion.
25. Phone landscape (844x390) and tablet (1024x768): both screens fit with no overlap, the list starts hidden on the phone, every button is at least a thumb wide.

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

## Free ride Phase D: the feel

Harness as before (`/route-dev.html`). Nothing here has been heard or felt by its author: the sounds and the trainer feel were only unit-tested, so listen and ride with a critical ear.

- Wombat: `?route=mount-coot-tha&next=life&kind=wombat&back=70&speed=12`: it sets off as you come up, trots, and is off the far side before you reach it. `&back=14`: it sits on the verge and stays there. Same with `kind=lyrebird`. Look for: an animal on the tarmac as you pass.
- Chalk: `?route=ben-lomond&d=13000&next=chalk`: no dashed centre line under or just before and after the words.
- Laps: in the app pick the Nundah crit track with 3 laps and the simulated trainer (`?fast=8` hurries it). "Lap 1 / 3" leads the totals under the speed. Crossing the line: a toast with the lap time and one ring of the bell; into the final lap the toast starts "Last lap" and the bell rings three times. Stats (S): "Last lap" and "Best lap" fill in after the first lap.
- Bends: in the app ride Ben Lomond or Akuna Bay with the simulated trainer and stop pedalling on a descent. Speed should build, ease off before a tight bend (never a jolt, never below about 20 km/h), and build again on the way out. Look for: braking on a road that looks straight.
- Wind: Settings, Free ride wind, Blowy. Stats (S) gains a "Wind" row that swings between Head and Tail as the road turns; the same watts are slower into it. Off again: the row goes and speeds match the old ones.
- Trainer look-ahead (real trainer needed, not checked by anyone yet): on a route with a sharp ramp (Mount Coot-tha), the resistance should build as the front wheel reaches the ramp rather than a couple of seconds after. "Trainer feels" in Stats changes slightly before the HUD gradient does. If it arrives early, lower `CFG.freeRide.lead.s`.
- Camera: `?route=mount-coot-tha&d=7290&speed=15&power=0`: coasting down, the camera should sit lower and closer behind a tucked rider, with a faint shake. Add `&calm=1`: none of that. `?route=ben-lomond&d=14285&speed=9`: through the hairpin the horizon tips a few degrees with the rider. Ride over the start of a ramp: the view should tip up smoothly, not snap. Look for: anything that makes you queasy (turn it down under "feel" in the debug panel, `g`, and say which number).
- Rider: `?route=ben-lomond&d=300&speed=3`: out of the saddle on 12%, bike rocking under them. `&effort=1.5` on a flat spot does the same. `&power=0&speed=6`: cranks stop level. `?route=mount-coot-tha&d=7290&speed=15&power=0`: tucked. `&cheer=1`: sitting up, both arms in the air. In the app the arms go up just past the top of Mount Coot-tha and coming to the finish. Look for: hands that leave the bars when standing, feet off the pedals, flicker between sitting and standing near 8%.
- Sound, harness: add `&sound=1` and click the page once. `&speed=10`: wind and a low tyre hum. `&speed=18&power=0`: louder wind and a fast freehub buzz; `&speed=5&power=0`: separate ticks. Press `c`: a gear clunk. `?route=mount-coot-tha&d=2500&speed=0&sound=1`: birdsong now and then over a cicada rattle. `?route=great-ocean-road&d=1800&speed=0&sound=1`: surf swelling every ten seconds and the odd gull. `?route=mount-hotham&d=26500&speed=0&sound=1`: wind, no cicadas. `?route=beach-road&d=4000&speed=0&sound=1`: a low traffic murmur. `&mood=routeDawn`: more birds, no cicadas.
- Sound, app: free ride with the simulated trainer. Z and X change gear with a clunk. Stop pedalling on a descent: the freehub starts. Pause: bike sounds fade, the place carries on. Settings, Sound slider scales everything; Free ride sounds, Off silences these but not the beeps.
- What to listen for, since nobody has heard any of it: is anything harsh, too loud against the beeps and the announcer, or does it sound like a fault (clicks at the loop point of the noise, a whine, a cicada that sounds like a smoke alarm)? Each kind has its own loudness in `CFG.sound.ride.level`; set one to 0 to rule it out.


## Free ride Phase E: ride together

Two people, two browsers (or two tabs logged in as different riders), simulated trainers are fine. Nobody has tried this on two real devices or real trainers yet.

- Host: Ride tab, Free ride, pick the Nundah crit track, press **Group ride**, choose the simulator. The lobby shows a four-letter ride code. Add two or three bots (their one-liners appear), set 2 laps, leave it on Social.
- Guest: on the Ride tab the room shows under the open rooms as "Alex's group ride"; press Join, or type the code in "Join by code" (the box on the Free ride page works too). Both lobbies list both riders with FTP and W/kg. Only the host can change the route, laps, style, keep-together and bots.
- Host presses Start the ride. Both see a 10 s countdown, then ride. Look for: the others on the road two abreast with name tags, dots for everyone on the minimap, and the rider list top right with gaps.
- Sit behind someone (ease off until you are within a few metres): a blue "Drafting −N W" chip appears bottom right and you hold their wheel on less power. Pull out and pass: the chip goes.
- Stop pedalling: you coast to a stop, the group rides away, a toast says who dropped you. With Keep together on, start again and the chip shows "Tow +N%" while you come back. The trainer resistance should not change with the tow (real trainer needed).
- Guest refreshes the browser mid-ride: the Ride tab offers "Rejoin ride CODE"; after rejoining they are where the server left them, not back at the start.
- A third rider joins after the start: they appear a few metres behind the last rider and the others get a "joined" toast. Their result says "joined late".
- TV: on a third screen open `/?watch=CODE` (any login). It follows the leader; arrow keys change rider, L returns to the leader, F is fullscreen.
- Finish: each rider gets "Finished: 2nd" and waits; when the last human is home (or the host ends the ride) everyone gets the results with the crew table: place, time, average power, W/kg and watts saved drafting. "Back to the lobby" returns to the room for another go.
- Race: in the lobby pick Race. Keep together turns off. Same ride, nobody is towed.
- Look for: a rider jumping backwards or forwards (the correction should be invisible), riders drawn on top of each other, the chip flickering on and off, a rider list that disagrees with what you see, your own speed feeling laggy against the pedals.
- Solo free ride must be unchanged: Start (not Group ride) with the server stopped still rides, pauses and finishes as before.

## Free ride Phase F: reasons to come back

Everything here was built against the simulated trainer and looked at in still screenshots from headless Chromium (software rendering), with the ride sped up by `?fast=`. Nobody has ridden it. Use a throwaway database (`ZB_DB=/tmp/x.db`) when trying it.

**Segments and ghosts**

1. Free ride, Willunga Hill, simulator. On the climb the climb panel gains a column: the segment's name, the time so far, and nothing else on a first go.
2. Finish. The summary has a Segments card: the climb, the sprint and the whole route, each "First go".
3. Ride it again. The start bar now offers "◌ Your PR". On the road a pale see-through rider sets off with you and "◌ Your PR" is in the rider list with a gap.
4. Push harder than last time (arrow up on the simulator). The climb column shows "−0:0x vs PR" in green; ease off and it turns red with a plus.
5. Finishing a segment faster gives a "New PR!" toast with a jingle that stays about 7 s. The summary marks it "PR by ...".
6. Log in as a second rider, ride the same route slower: the splits also show "+0:xx vs <first rider>", and the setup screen offers the first rider's ghost in the list of mates.
7. Lap ride (Nundah crit, 3 laps): every lap is a row in the Segments card; a faster lap gets the PR toast instead of the plain lap toast; the ghost keeps lapping at its best lap.
8. Offline: stop the server mid-ride and finish. The summary still shows the segments. Start the server and log in again: `GET /api/efforts/mine` lists them.
9. Group ride with a bot on a route you have a best on: your ghost is there for you only, and the drafting chip never lights up from the ghost.

**FIT file**

10. From the summary of a free ride (or from History), Download .fit and upload it to Strava or intervals.icu: expect the real map, an elevation profile, distance and speed, and one lap per lap on a lap ride. (Not tried: the file has only been decoded by our own test.)
11. Download .fit for an ERG workout: same file as always, no map.

**Passport**

12. Rider tab, Passport. The map shows Australia with numbered dots; the route just finished is filled in and its row shows rides, best time and metres climbed. The "First Stamp" badge is earned.

**The week**

13. Free ride setup shows "This week": a route of the week (outlined in the grid, "Pick it" selects it) and the weekly climb bar. Finish the route of the week: the summary shows "+30 scrap", the card says "Banked", and the balance in the header goes up. Finish it again: no second payment.
14. Climb past the weekly target (600 m for a new rider): "+50 scrap" once.

**History**

15. Rider tab, History: a free ride's row has a small route line, the route name, distance and "free ride". Open it: route card with the map (the part ridden is brighter), distance, climbing, then the Segments card.
16. A ride from before this phase, or an ERG workout, looks as it did.

## Free ride Phase G: production

Built against the simulated trainer and looked at in still screenshots from headless Chromium (software rendering). Nobody has ridden it, heard it or held it on a phone. Use a throwaway database (`ZB_DB=/tmp/x.db`). Dev aids: `?fast=N` speeds a solo ride up, `?at=7000` starts it that many metres in, `?intro=0` skips the flyover, `?perf=1` shows the frame-time overlay.

**Leaderboards**

1. Free ride setup, pick a route with times on it, press "🏆 Leaderboards". The dialog opens on that route with the whole route (or lap) picked; the other segments are chips. Your row is highlighted, "You are 2nd of 3" sits above the table, and a dry line names the leader.
2. Switch to "By W/kg": the order follows W/kg. Pick another route from the list. Rider tab, Passport, "🏆 Crew leaderboards" opens the same dialog.
3. In a ride, press S (Stats): the drawer ends with "Top three" for the climb or sprint you are on, or the whole route between them. Beat a time and "You" moves up at once.
4. Stop the server and open the dialog: it says the boards are not answering rather than showing an empty table.

**2D layout**

5. Settings, Free ride view: Charts. Ride the Nundah crit for two laps with a best already on it: between the charts and the map a column shows "Lap 2 / 10" with last and best lap, the sprint's panel when it comes up, "This lap −0:03 vs PR", the top three, and "◌ Your PR" with its gap.
6. A first ride on a point-to-point route with nobody else's times: the column is not there at all until there is something to say.

**Offline ride history**

7. Log in, start a free ride, stop the server (or pull the network), finish the ride. The summary shows as usual. Start the server, reload and log in: the ride is in History once. Reload again: still once.
8. `POST /api/rides` twice with the same summary answers `saved: true` then `saved: false`.

**Flyover and loading card**

9. Start a 3D free ride. A dark card shows the route name, distance, climb, a small profile and a line about the place; then the camera sweeps a stretch of the route with the same card as a caption and "The summit", "The hairpins", "The steep bit" or "The road" above it; then it cuts to behind the rider and "Start pedalling" appears. The clock must not start during the sweep, however hard you pedal.
10. Press any key or tap during the sweep: it ends at once and the key does nothing else (Space must not pause).
11. Ben Lomond should show "The hairpins" (Jacob's Ladder); Coot-tha "The summit"; Beach Road "The road".
12. Charts layout: the card alone for about 3.5 s. Group ride: the sweep fits inside the countdown and the camera is behind you for the last 3 s.

**Summit and finish**

13. `?at=7150&intro=0` on the Coot-tha loop: ride 90 m to the top. Confetti and streamers go up, the camera turns once round the rider and comes back in behind, a "Summit" card shows time, average power, W/kg and PRs for 7 s, and the line is spoken if the announcer is on.
14. Ride to the finish (or `?at=11900`): the same at the line, the ride holds for 6 s, then the results. Nothing is added to the ride's time or power during the hold.
15. Results, "Save postcard": a PNG with the still (rider from the front, arms up), route name, date and the numbers. In the Charts layout the picture is the ride's power as a line of hills.
16. Willunga Hill gets one moment (the finish), not two.
17. Group ride with bots: the results show a podium (2nd, 1st, 3rd) above the table.

**Settings**

18. Units, "mi · ft · lb": the HUD shows mph, mi and ft; route cards, the loading card, results, postcard and passport follow; Rider settings asks for weight in lb and W/kg does not change. Back to metric: the weight reads what it did.
19. Free ride camera: Near, Standard, Far visibly change how far back the camera sits. Calm camera still removes the shake and lean.
20. In a ride, ☰ has "Display size": Large makes the HUD bigger at once.
21. Zone and gradient colours, Colour-blind: the swatches change; in a ride the elevation strip, the climb panel and the gradient readout use blue, grey, yellow, orange, vermilion, purple and white. The number is always there.
22. Reduced motion, On: no flyover (card only), no turn of the camera, no confetti, no shake. Auto with the operating system's "reduce motion" on behaves the same.
23. Sound mix: with a ride going, Ride sounds at zero silences freehub, wind and tyres but not the birds; Ambience at zero does the reverse; Voice at zero silences the spoken lines.

**Performance**

24. `/route-dev.html?route=mondo&d=3000`: the overlay at the top shows average fps, 1% low, draw calls, triangles, chunks, level and chunk build times. `?perf=1` on a ride shows the same.
25. Graphics on Auto on a slow machine: the level in the overlay falls to "lowpower" within a few seconds, and the next ride starts there. Settings, Graphics, Low power pins it.
26. Switch to another tab for a minute and back: the ride has carried on and the fan has not.

**Phone and tablet**

27. Phone, landscape: setup, lobby, ride, results, passport and leaderboards fit with no sideways scroll; every button is at least a thumb wide.
28. Phone, portrait: the ride is usable and a "Turn the phone sideways for the full view" hint shows until tapped or the phone is turned; the speed sits low, and the minimap and rider list are hidden.
29. A phone with a notch: nothing sits under the notch or the home bar.

**Offline routes**

30. Production build (`scripts/run.sh`, or the installed app): every route card has "Save for offline"; press it and the card shows "✓ offline" (picking a card does the same). Turn the network off and reload: the app opens, a kept route starts and rides in 3D, the minimap is hidden. After an app update the marks are gone until saved again.
31. The dev server (`pnpm dev`) shows no offline marks and registers no service worker.
- Shift strength mid-ride: free ride (3D HUD) with the simulated trainer. The gear chip reads e.g. `12/24 150%`; tap it and the menu opens on the slider. `;` and `'` step it by 10% with a toast and the slider follows. Solo Slope mode: the gear tile's line reads `trainer x% · shift 150%` and the keys step it.
- Downloads through the server: on a desktop, results screen and History, Download .fit, Export JSON and Save postcard each download straight away (the network tab shows a `PUT /api/rides/files/...` first). With touch emulation on (pointer: coarse), each shows the sheet with Save and Copy link; a postcard shows its picture. The link stops working after 10 minutes.
- History with a ride waiting to upload: stop the server, finish a 1 min solo ride, open History. The ride shows under "Waiting to upload" with Download .fit and Export JSON. Start the server and reopen History: it has gone up and is in the list.
- Postcards in History: open a free ride and a solo workout in History and tap Save postcard. Each gives a PNG on the sky with the ride's power as hills; the free ride shows distance and climbing, the workout NP and TSS.
- Bus postcard in History: ride a short bus ride with bots, then open it in History and tap Save postcard. The Zombie Bus card shows the score, distance, armour, sync, scrap, crew and awards on the sky background.
- Bus countdown: a sped-up bus ride with bots (`ZB_TIME_SCALE`). Before each change of target the top centre shows "Next: 250 W" and a big 5, 4, 3, 2, 1 with a beep each; before a sprint only the SPRINT INCOMING splash shows.
- Servo Shop close: on a bus ride at a servo stop, tap "✕ Close": the shop folds to a bar with the scrap count and "Open shop", which brings the cards back. At the next servo stop it opens in full.
- Rear-view mirror: `/scene-dev.html?riders=3&gap=60` shows a framed strip top centre with the horde in it; `gap=none` hides it; `mad=1` has none. Debug panel (`g`), Rear-view mirror folder, changes its size and place.
- Difficulty: in the bus lobby, each Horde level shows a line saying what it means. A sped-up Normal ride with bots should see the horde catch the bus several times; Easy should rarely see it close.
- Fallen riders: a bus ride with three bots. The crew list shows `212 W 31%` per rider. When a bot falls off, a red banner "X is off the bus: everyone else +5% …" shows under the event header, the top rider gets 💪, and both go when they are hauled back.
- Bus on gears: in the bus lobby pick Gears under Your effort; your seat shows "⚙ Gears". Start with bots and the simulator: the power panel says "⚙ Gears", the GEAR tile sits under it, Z X and the arrows shift, `;` `'` change shift strength, and `E` switches back to ERG (the tile hides).
- VO2 Madness on gears: in the lobby pick VO2 Madness and Gears; in the ride the GEAR tile shows and Z X shift; the effort leaderboard still scores heart rate.
- Trainer mode per ride: as driver pick 🚲 Trainers "All gears"; a second rider's ERG / Gears switch hides and their seat shows "⚙ Gears". In the ride `E` only shows a toast. Back to "Each rider" and their own pick returns.
- Drafting: in a group-ride lobby the host sees Drafting Off / Realistic / Strong; a guest sees the level and what it means. In the ride on Strong behind bots, the HUD's drafting watts climb as more riders are close ahead.
- Route sections: Free ride shows "Real rides" (Mondo, Full Gas Friday, Mount Coot-tha Back, Darren Smith, Metros, Nundah, Howick Street) above "Classic climbs and roads"; the state and length filters still apply to both.

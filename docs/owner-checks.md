# Checks only the owner can do

Everything below was built and tested against the simulated trainer only. Tick these off on real hardware; note anything odd in `docs/status.md`.

## Trainer (Bluetooth)
- [ ] ERG still feels responsive after the reply-handling change: run a workout with a few target changes.
- [ ] Switch the trainer off for 10 s mid-interval. The pill should go amber "Reconnecting…", power should read 0, and a banner should show. Switch it back on: ERG should return to the current target within about 5 s and the ride should carry on.
- [ ] Walk out of Bluetooth range for 30 s and come back. It should reconnect by itself.
- [ ] Open another app that grabs the trainer mid-ride. Cranky should retry, then fail clearly and release after repeated failures.

## Solo modes
- [ ] Resistance mode (the riskiest one): switch to Resistance in the solo player. Does the trainer accept it, and does 0 to 100% feel sensible? If not, the scale in `client/src/config.ts` (`ftms.resMax`) needs changing.
- [ ] Slope mode: change the gradient and check the resistance follows. Switch ERG → Resistance → Slope → ERG and make sure the trainer never gets stuck.
- [ ] Ramp test: does ERG follow the one-minute steps, and do "I'm done" and the automatic stop feel right?
- [ ] 20-minute test: is the free-ride section rideable with ERG off?
- [ ] "+5 min" and "+1 min": do the ERG transitions feel smooth?

## Heart-rate strap
- [ ] Pair a strap from the trainer window ("Heart rate (optional)"). The bpm should show in the pill, the solo player, the game cockpit and the results.
- [ ] Trainer and strap connected together for a whole ride without dropouts.
- [ ] Set Max HR on the Rider tab and check the HR tile's zone colours look sensible.

## Zwift Click and virtual gears
The Click needs firmware 1.1.0 or later (1.0.0 ignores the RideOn handshake). Update in Zwift Companion: More > Equipment > Zwift Click > Update Firmware. On 1.1.0 the handshake write with response fails, so the driver must keep writing without response.

- [x] Open `/spike.html`, press "Pair Zwift Click" and press each button. Each press should show UP or DOWN once (not on release). Copy the `[Click]` console lines into `docs/testing.md` if anything looks off.
- [ ] Pair the Click from the trainer window ("Zwift Click (optional)"); the readout should say connected. Switch the Click off and on: it should reconnect.
- [ ] Free ride on a flat bit: gear 12 should feel about like the real bike in the 34T ring. Shift up and down with the Click and with `Z` / `X`; it should get harder and easier within a couple of seconds, and the GEAR tile should flash and show the new gear and the trainer gradient. Tune Shift strength until a shift feels like a real one.
- [ ] Solo Slope mode: same check. ERG mode: Click changes intensity by 1%. Resistance mode: Click steps the level.
- [ ] Set your real chainring under Settings if it is not 34T.

## Crash recovery
- [ ] Refresh the page mid solo workout. The home screen should offer "Resume your workout?"; resuming should pick up at the same point with the earlier minutes still in the results.
- [ ] Refresh mid bus ride with at least one other rider aboard. "Rejoin bus" should put you back on with your stats intact.

## Group ride
- [ ] First real crew ride: do block changes and over-under steps land on time for everyone?
- [ ] Restart the server mid-ride (`scripts/run.sh`). Riders should reconnect and the ride should resume where it stopped.
- [ ] Tune the game numbers afterwards (horde speed, damage, fell-off threshold, scrap). They live in `server/src/zombie_bus_server/config.py`.

## Devices and extras
- [ ] iPad with Bluefy: does pairing and ERG work at all?
- [ ] Install the app from Chrome's address bar ("Install Cranky") and try a solo ride with the network off.
- [ ] Download a `.fit` from a results screen and upload it to Strava or Garmin by hand.
- [ ] Discord: create a channel webhook, start the server with `ZB_DISCORD_WEBHOOK=<url>`, finish a bus ride and check the message arrives.
- [ ] Import one of your own `.zwo` workouts in the solo picker.

## Free ride, Phases A to G: what only you can check

Everything in free ride was built on a PC with no graphics driver, no speakers, no trainer and no phone: it was judged from still screenshots of a software renderer and from unit tests. This is the list of what that cannot tell us. Use a throwaway database if you do not want test rides in your history (`ZB_DB=/tmp/x.db scripts/run.sh`).

### Looks (a real screen)
- [ ] Ride three different routes (a mountain, the coast, the Nundah crit). Is the low-poly style right? Trees, buildings, signs and the road: anything ugly, floating, buried or see-through?
- [ ] Stacked hairpins (Ben Lomond) and a true out-and-back: cracks between terrain strips, or the road folded on itself?
- [ ] The skies: ride at dawn, midday, dusk and in a shower (`/route-dev.html?mood=...` shows each). Too dark, too pink, fog too close?
- [ ] The jokes: are the signs, chalk and roadside oddities readable at riding speed, and funny more than once?
- [ ] Ghost riders: pale and see-through enough to tell from a real rider, solid enough to see?
- [ ] The HUD at your usual distance from the screen. Try Settings, In-ride display size (also in the ride menu).
- [ ] Colour-blind colours (Settings): are the gradient colours of the strip and climb panel easy to tell apart?
- [ ] The pre-ride flyover: does it show a stretch worth showing on your favourite routes, and is 7 s right?
- [ ] Summit and finish: confetti, the turn of the camera, the stats card. Festive or annoying? Does the card cover the rider for too long?
- [ ] Save a postcard from the results. Would you post it in the group chat?

### Motion comfort
- [ ] A fast descent with the normal camera: shake, lean and the widening view. If it is too much, is Calm camera enough?
- [ ] The turn of the camera at a summit while you are still pedalling: disorienting?
- [ ] Reduced motion (Settings, or your device's own setting): no flyover, no turn, no confetti, no shake.
- [ ] Camera distance Near, Standard and Far: which should be the default?

### Sound (speakers or headphones)
- [ ] Freehub, wind, tyres and the gear clunk: believable, or irritating after ten minutes?
- [ ] Birds, cicadas, surf, gulls, mountain wind, traffic: do they suit the place, and how loud against the bike?
- [ ] The lap bell, the PR jingles and the summit and finish jingles: levels against everything else.
- [ ] The commentator and announcer voice: does the device have a decent Australian voice, and is it too chatty?
- [ ] Set the three Sound mix sliders where you like them and tell me; the defaults (all at full) are a guess.

### Trainer feel (a real trainer)
- [ ] The gradient look-ahead: does the resistance change as the road tips up, not after? Try a sharp ramp and a crest.
- [ ] Trainer difficulty 50% against 100% on a steep climb; virtual gears with the Click and with Z / X.
- [ ] Bends: the speed limit into a hairpin on a descent. Fair, or does it feel like the brakes are on?
- [ ] Wind (Settings, off by default): does a headwind feel like one?
- [ ] Auto-pause: stop pedalling, start again. Does a coasting descent stay un-paused?
- [ ] The 6 s hold at the finish line: does the trainer ease off sensibly while the confetti falls?
- [ ] A long ride (an hour or more): any stalls, a HUD that stops updating, sound that drifts or cuts out?

### Riding together (two devices)
- [ ] A group ride with a mate on a second device and a bot or two: countdown, flyover finishing before the start, positions agreeing on both screens, no rider jumping about.
- [ ] Drafting: sit on a wheel and watch the watts saved; does it feel worth doing? Keep-together: does the tow feel fair?
- [ ] Finish: the finish moment, then the results with the podium on both devices.
- [ ] The 9 s stall an earlier agent saw in a headless solo ride: watch for the ride freezing for several seconds.
- [ ] The TV view (`?watch=CODE`) on a telly while two of you ride.

### Coming back (segments, ghosts, boards)
- [ ] Ride a climb twice: the live split against your PR should agree with the ghost up the road.
- [ ] Leaderboards from the setup screen and the Passport, by time and by W/kg, with two real riders.
- [ ] Download a .fit from a free ride and upload it to Strava: does the map show, and distance, climbing and laps?
- [ ] Passport map: are the dots in the right places, and does Australia look like Australia?
- [ ] The weekly route and climbing target: are 30 and 50 scrap the right size of carrot?

### Frame rate (real devices)
- [ ] Add `?perf=1` to the address on a ride and read the overlay on: the PC you ride on, a laptop, a tablet, a phone. Write down average fps, 1% low and the level Auto settles at for Coot-tha, the Nundah crit and Mondo. (All the numbers in `docs/decisions.md` are from a software renderer.)
- [ ] Does Auto settle within a few seconds, and does the picture at the level it picks look acceptable? Is Low power still a ride worth looking at?
- [ ] Chunk builds: any visible hitch every 200 m?
- [ ] Optional: install the NVIDIA driver on the dev PC (`sudo ubuntu-drivers install`) so screenshots and numbers mean something.

### Phone and tablet
- [ ] A phone held sideways: setup, lobby, ride, results, passport, leaderboards. Anything cut off, under the notch, or too small to tap?
- [ ] A phone held upright during a ride: usable, with the hint to turn it?
- [ ] A tablet (iPad with Bluefy if that is how it pairs): the same screens, and does the ride HUD suit the size?
- [ ] Units set to imperial for a ride, if any of the crew think in miles.

### Offline
- [ ] Install the app, press "Save for offline" on a route, switch to aeroplane mode, ride it. Finish, come back online, log in: the ride should be in History once and its segment times on the boards.

## Ride notes plan (2026-11-14)
- [ ] Trainers: the orange trainer shows under every rider on the bus, in VO2 Madness, on the TV view and in free ride on a real screen. Say if riding outside on a trainer in free ride is wanted or should be a skin only.
- [ ] Gears: ride free ride or Slope mode at the default 150% shift strength and say whether each click feels right (answer in `docs/questions.md`).
- [ ] Shift strength mid-ride: on a real screen and an iPad, the gear chip shows the strength and tapping it opens the menu with the slider; `;` and `'` step it with a keyboard.
- [ ] Servo stop: on a bus ride, the bus pulls into the servo, stays parked for the stop, then drives off; nothing slides along with the bus.
- [ ] Downloads in Bluefy on the iPad: on the results screen and in History, tap Download .fit, Export JSON and Save postcard. A sheet appears; Save should bring up iOS Save / Share (or open the file), the postcard picture can be pressed and held, and Copy link pasted into Safari downloads it. Say which of these works.
- [ ] Old bus rides on Railway: after the next deploy, open a bus ride from before 2026-11-14 in History and tap Save postcard. It should be the Zombie Bus card with that ride's score; a plain card means the ladder had no matching row.
- [ ] Backups on Railway: a day after deploying, `ls /data/backups` in a Railway shell shows a new `cranky-*.db` from about 17:00 UTC. Optionally try the restore steps in the README on a copy.
- [ ] Bus countdown: on a bus ride, the "Next: … W" chip and 5-4-3-2-1 with a beep show before each target change, and 5 s is enough to get onto the new watts in ERG and without.
- [ ] Servo Shop close button: easy to hit mid-ride on the big screen and the iPad.
- [ ] Horde and mirror: on a bus ride in ERG, the horde is in the rear-view mirror all ride and comes into the main view when the crew slips; the mirror does not cover the event header, the Next chip or the countdown on the big screen or the iPad, and the frame rate holds up.
- [ ] Difficulty: ride Normal in ERG and say whether the crew was close to failing by the end; then Hard, and whether the air strikes and gunships felt like the only way through.
- [ ] Fallen riders: on a bus ride, when someone falls off, the red banner shows, everyone else's target goes up 5% (ERG follows), the crew list shows each share % and the 💪 carrier, and the extra feels fair. Answer in `docs/questions.md`.
- [ ] Cables on the bus: visible from the chase camera on a real screen, brighter when riding hard, dark when someone falls off.
- [ ] Bus on gears: pick Gears in the lobby, ride a bus with ERG off on a real trainer. Shifting with the Click (or Z X) should let you hold the target at a normal cadence; say if the 2% base road feels right.
- [ ] VO2 Madness on gears: pick Gears in the lobby and ride a Madness round; the top gears on the 2% base road should be hard enough for a VO2 interval.

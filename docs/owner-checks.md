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

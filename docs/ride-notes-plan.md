# Plan from the first real rides (2026-11-14)

The crew rode Zombie Bus and a free-ride route on real trainers for the first time. These are their notes, turned into a checklist. Work top to bottom within each group; groups are in priority order. Tick items in the same commit as the work, and log invented numbers in `docs/decisions.md`.

Already in the code when the notes were written (built in a hurry, never tested, so each still needs a check on a real ride):
- Zombie Bus can be ridden without ERG (menu or `E`; ↑ ↓ set the gradient).
- When someone falls off the bus, everyone else's target rises 5% per fallen rider, up to 15%.
- A shift-strength slider exists in Settings, the free-ride menu and the solo Slope mode.

## 1. Broken or wrong on the day (do these first)

- [ ] **Trainers back under the bikes, everywhere.** Riders used to sit on a trainer; it has gone missing in at least some scenes. Put it back in every scene that shows a rider: the bus, VO2 Madness, the TV view, the free-ride world, the garage and lobby previews.
- [ ] **Gears about 50% stronger per click.** The default shift strength is now 150% (was 100%) as a first step. Confirm on a trainer, then settle the default.
- [ ] **Shift-strength slider reachable while riding, in every mode with gears.** It is in the free-ride menu and solo Slope mode; check it is easy to find mid-ride on a real screen and on an iPad, show the current value on the gear tile, and add it to the bus once the bus has gears (see group 3).
- [ ] **The servo is dragged along the left side of the road on the bus.** It should sit still beside the road and be driven past (or pulled into), not slide with the bus.
- [ ] **Downloads on iPad (Bluefy).** The download buttons did nothing. Find what Bluefy blocks (blob links, the `download` attribute, new tabs) and use something it allows. Every download (.fit, JSON, the ride postcard and the Zombie Bus postcard) is served from a real server URL for the signed-in rider's own ride (for example `/api/rides/<id>.fit` with a token), opened so iOS shows Save / Share. The results screen and History both use it.
- [ ] **Download after the round has ended.** Every finished ride keeps a download button: on the results screen, and for good in History. Works for bus rides, VO2 Madness, solo workouts, free rides and group rides.
- [ ] **Postcards in History.** Every ride in History gets Save postcard, rebuilt from the saved ride (the free-ride card falls back to the sky background when no screenshot is stored).
- [ ] **Save the bus result with the ride.** Score, distance, armour, sync, scrap, crew and awards are stored in each rider's ride summary so the Zombie Bus postcard can be rebuilt later. Check whether the ladder data can rebuild cards for rides already saved; if so, do it; if not, note it.
- [ ] **Keep history, in a database.** The server runs on Railway with SQLite on a volume at `/data`, and Railway volume backups are on (daily and weekly). Decision: stay on SQLite. Confirm every mode saves its finished rides to the server (bus rides included) and that nothing depends on the browser's storage; add a nightly backup inside the server that keeps the last 14 copies in `/data/backups`; document the restore steps in the README.
- [ ] **A 5 second warning before a target change on the bus.** Show the next target and count down 5-4-3-2-1 before it applies, with the tone, so riders can get up to the new watts. The solo player already has a 3-2-1; share it. Consider also easing the compliance score for the first few seconds of a block.
- [ ] **An exit button on the supply store** (the Servo Stop shop) so riders can close it without buying.

## 2. Zombie Bus: make it a game you can lose

- [ ] **The horde needs to be closer.** In ERG mode nobody ever saw it. Start it nearer, make it gain faster, and keep it in shot more of the time (camera or a rear-view inset).
- [ ] **Game difficulty that means something.** Easy: about what the game is now. Normal: the crew should be close to failing by the end. Hard: doomed unless the crew earns gunships and other streak rewards. Host picks it in the lobby; tune horde speed, damage and fall-off thresholds per level. There is an existing difficulty setting to rework.
- [ ] **Falling off is everyone's problem (built, untested).** Check the 5% per rider / 15% cap on a real ride and tune. Then make the team effort visible: show each rider's share of the crew's work as a percentage, who is carrying whom, and a clear banner while targets are raised. Think of more ways to make it a team effort (for example the fallen rider's missing watts are split across the crew, or the crew can choose who takes the extra).
- [ ] **Cables from each trainer into the bus,** so it looks like the riders are powering it. Cables can glow or pulse with each rider's power.

## 3. Non-ERG versions of the games

- [ ] **Zombie Bus without ERG (built, untested).** Check it on a trainer. Add virtual gears and the gear tile, so non-ERG riders shift instead of setting a gradient by hand, and make the choice visible in the lobby so the crew knows who is on ERG.
- [ ] **VO2 Madness without ERG.**
- [ ] **A lobby option per ride:** ERG, non-ERG, or each rider chooses.

## 4. Free ride feel

- [ ] **Less wind noise at speed and on descents.** Quieter overall, and it should not keep climbing with speed.
- [ ] **More camera shake and lean on descents.**
- [ ] **Drafting settings, and more drafting by default.** Longer reach with an exponential drop-off, a bit stronger on one wheel, and scaling with the size of the group: roughly 30% behind one rider, 50% behind two, up to about 95% deep in a pack of five, at a reference speed. Host settings in the group-ride lobby (off / realistic / strong). **Drafting must make the trainer feel easier,** not only the on-screen speed: reduce the gradient sent to the trainer by the drag saved, through `ergController.setGrade` only.
- [ ] **Sort the routes into two clear sections.** "Real rides" for the routes cut from the crew's own recordings (Mondo, Full Gas Friday, Mount Coot-tha Back, Darren Smith, Metros, Nundah, Howick Street), and a separate section for the routes generated from map data.

## 5. Garage and shop

- [ ] **3D previews in the shop** for every item.
- [ ] **Bike skins.** Custom bikes as a new cosmetic slot. The first aftermarket skin is your bike on its indoor trainer, so you ride around outside on a trainer.
- [ ] **Prices up, and rarer fun items.** Rework the price curve, add rarity tiers, and add a batch of rare, silly items.

## New route

- [x] **Howick Street Crit,** built from the owner's FIT file. See `docs/decisions.md`.

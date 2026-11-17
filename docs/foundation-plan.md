# Foundation plan

Agreed by Luke, Alex and Steve on 17/11/2026. Cranky is scaled back to its foundation: solid trainer
connectivity, gears that feel right with the Zwift Click, clean routes, Zombie Bus and workouts. Nothing new
and fun gets built until this plan is done. This plan overrides PLAN.md, docs/roadmap.md, docs/games-plan.md
and any "invent mechanics, don't wait for the owner" rule in AGENTS.md.

## Rules for every stage
- Work the stages in order, one checklist item at a time. Tick items here as they are done.
- Inventory first: before removing or changing anything, list the code paths, tests, docs and stored data it
  touches. Put the list in the stage's commit message body, not in a new file.
- Small commits, one per checklist item. Type-check, lint and both full test suites green before each commit.
- Never push. Luke reviews each stage's report and pushes.
- No database schema changes and no data scripts. Stored data for removed features is left in place, unread.
- Old rides must still open: History, results, postcards and Strava text for rides recorded in a removed game
  show a plain fallback (the game's name and the ride's numbers) and never crash.
- Delete dead code, config, CSS, assets, tests and docs for removed features. Update docs/map.md, docs/status.md,
  docs/protocol.md and README as you go. Record judgement calls in docs/decisions.md.
- If a decision is needed, add it to docs/questions.md, skip that item and carry on with the rest.
- End each stage with a report of 5 lines max.

## What stays (must keep working exactly as now)
- Login, passwords, usernames, the admins' Riders screen.
- Trainer, heart-rate strap and Zwift Click pairing; the simulator; the trainer check page; Controls.
- Zombie Bus: lobby, workout and difficulty choice, ERG or gears, bots, roadblocks, falling off and haul-back,
  bosses, streak air support and cinematics, camera controls, crew cards, TV spectator view, results.
- Free ride on routes, solo and group (plain ride, race, crit, handicap, the podium), GPX import, segments, sprints and KOMs, ghosts, leaderboards.
- Solo workouts (every file in content/workouts), the workout builder, training plans, FTP and fatigue tests.
- Rider tab: stats, power curve, history, trends, settings, the body creator as it is.
- Strava, FIT and JSON downloads, postcards, backups, test rides not counting, discard ride.
- Badges, passport and weekly goals, with any scrap reward removed.

## Stage 1: cut
- [x] 1.1 AGENTS.md: replace the "do not wait for the owner / invent mechanics" rules with a scope freeze that
      points at this plan. No new games, mechanics, cosmetics or jokes.
- [x] 1.2 Remove every crew game except Zombie Bus: VO2 Madness, Kidney Stone Express, Speed Dating, Climate
      Lawsuit, Watch Party, Last Standing, TTT, Pub Quiz, Galley Ship and Hunt. Server modes, config, protocol,
      HUD panels, scenes (the town, ambulance, date dressing, the pack), dev pages, bots, Strava and Discord
      text, tests. The home screen's "Crew games" picker becomes a single Zombie Bus card.
- [x] 1.3 Group rides on routes keep the plain ride, race, crit and handicap, with the podium. Remove points
      and chaingang only.
- [x] 1.4 Remove scrap everywhere: earning, balances, displays, results rewards, daily and weekly scrap, the
      week's deal.
- [x] 1.5 Remove the Servo Stop shop and its upgrades from Zombie Bus. The bus no longer stops to shop; keep the
      roadside servo as scenery only if it costs nothing to keep.
- [x] 1.6 Remove the Garage tab, the cosmetics catalogue, hats, outfits and trainer skins. Every rider gets the
      same helmet. If jersey colour only came from outfits, add a free jersey colour choice to the body creator.
      Nothing else in the body creator changes.
- [x] 1.7 Ladder tab: keep only what is about Zombie Bus results and ride stats. If nothing is left, remove it.
- [x] 1.8 Sweep: unused config, CSS, assets (update CREDITS.md), docs for removed features (delete the games
      and UI review docs that no longer apply), dead protocol messages. Report lines removed, client and server.

## Stage 2: gears and trainer sync
Background: gears are faked by sending the trainer a gradient. A shift feels late because (a) the gradient is
recalculated from live cadence, which the trainer reports late, (b) writes happen 4 times a second and small
changes are skipped, (c) the trainer eases into a new gradient by itself.
- [x] 2.1 Shifts go out at once: a shift writes to the trainer immediately instead of waiting for the next
      tick, still only through ergController.ts and still serialised with other writes.
- [x] 2.2 Steady gears: the gear's gradient uses a smoothed cadence so it does not wander with every cadence
      report; a shift still applies in full straight away. Smoothing time in config.
- [x] 2.3 A "Gear log" on the trainer check page: time of each press, the gradient sent, the trainer's
      acknowledgement and the time until power moves by a set amount, so lag is measured, not guessed.
- [x] 2.4 Research only, no trainer writes in the app: from public sources (QZ / qdomyos-zwift and similar
      open projects), write docs/zwift-gear-protocol.md describing how apps send a gear ratio straight to
      Zwift-protocol trainers (Zwift Hub, JetBlack Victory): service, characteristics, handshake, message
      bytes, how to return the trainer to normal. State what is confirmed and what is a guess.
- [ ] 2.5 On the trainer check page only: a "Direct gears (experimental)" panel that tries 2.4 on the
      connected trainer and logs every byte both ways. Off unless clicked. Not used by any ride.
- [ ] 2.6 STOP. Luke tests 2.3 and 2.5 on his JetBlack and reports. Direct gears go into rides only after that.
- [ ] 2.7 Zombie Bus in gears mode and free ride share one gear path (same code, same feel).

## Stage 3: workouts on routes
- [ ] 3.1 Solo workout setup gets "Ride it on a route": pick any workout, then any route.
- [ ] 3.2 The ride is the free-ride world with the workout on top: target and tolerance bar, interval clock,
      next-interval chip, the workout chart. Speed and distance come from the rider's power on the route.
- [ ] 3.3 Trainer control is the rider's choice: ERG (the workout sets the watts, the road is scenery) or gears
      (the road sets the feel, the rider shifts to hit the target). Sprints and free blocks never send ERG.
- [ ] 3.4 The workout ends when its last block ends; the route loops if it is shorter. Saves as a workout with
      the route's track, so the FIT file and Strava post carry the map.
- [ ] 3.5 The existing chart-only workout stays as it is.

## Stage 4: routes (Alex leads; not for an unattended run)
- [ ] 4.1 Pick three or four routes to make flawless before touching the rest.
- [ ] 4.2 On those: no overlapping roads, no buildings or signs on the road, roofs joined to walls, clean
      junctions, correct gradients against the real road.
- [ ] 4.3 Hide the other routes behind "More routes (rough)" until they pass the same check.

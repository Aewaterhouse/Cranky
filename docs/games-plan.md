# Crew games plan

Kidney Stone Express, Speed Dating, Climate Lawsuit, Watch Party and the other crew games planned here were removed
on 17/11/2026 (`docs/foundation-plan.md` 1.2); Zombie Bus is the only crew game. What is left is the review rounds,
the road races and the standing items.

## Phase 6: Full UI review by independent agents (owner, 2026-11-14; next after training plans)

*Done 2026-11-14: four reports and the ranked list in `docs/ui-review.md`, which is now the polish work queue.*

The owner wants the whole app judged by reviewers who did not build it. Each reviewer is a fresh agent with no
knowledge of the code, given only the running site, and asked for a verdict, not a code review.

- **Set-up.** Run the app locally (dev or built server, bots on, simulated trainer, `?fast=` and `ZB_TIME_SCALE` to
  reach later screens quickly). Reviewers drive it with headless Chromium and look at their own screenshots at
  1280×720, iPad (1024×768) and phone (390×844) sizes. The dev page `/scene-dev.html` covers
  states that are slow to reach.
- **Reviewers (one or two at a time, to keep the PC cool), each on one area:**
  1. First run and navigation: login, welcome, the home screen, the top menu and how you find each mode. Are the
     menus logical? Could a new rider start a group ride in under a minute?
  2. Riding: the solo player, the shared ride HUD on the bus and the three games, free ride. Can you read what to do
     at a glance while working hard?
  3. Lobbies and results: the crew lobby and game cards, the watch party, results screens, history, training plans.
  4. Rider and Garage: profile, settings, the body creator, cosmetics, leaderboards, Strava.
- **The brief for each:** judge it as a player, against well-designed apps and games they know: Zwift, TrainerRoad,
  MyWhoosh, Strava, Apple Fitness+, Peloton, and game front ends such as Mario Kart, Rocket League, Fortnite and
  Duolingo. Look at menu structure and naming, how many taps things take, consistency, readability during effort,
  touch targets, empty and error states, and what is confusing or missing. Every finding names the screen, shows a
  screenshot, says what a good app does instead and rates it (blocker, annoying, polish).
- **Then:** one consolidating pass merges the reports into `docs/ui-review.md`, ranked, with duplicates folded. The
  top findings become items under the standing UI polish item below and are worked through in order. Re-run the
  review after a big round of fixes.

## Phase 7: Races on the road (owner, 2026-11-14)

Race games on the free-ride road layer (`docs/road-games.md`: a `Rules` subclass on `RoadSim`, positions owned by
the server), with bots, results and history like the other games.

- [x] Normal race: everyone from the line, first across wins; a route and a number of laps picked by the host.
- [x] Points race: laps with a sprint at the end of each (points for the top places, more on the last lap); most
      points wins, whoever crosses first.
- [x] Crit: a short loop, many laps, and a sprint prime rung at a random lap around halfway (a bell and a banner);
      the prime winner is the hero of the results whatever the finish.
- [x] A podium scene at the end: the top three on the steps in the 3D world (champagne, confetti, silly poses with
      the bonkers models), with the prime or points winner standing to the side on their own little box.
- [ ] Each race in the e2e test with bots; owner checks for a real group race.

## Phase 8: Second review round (owner, 2026-11-14; once the races and the current polish are done)

*Done 2026-11-14: four reports and the queue in `docs/ui-review-2.md`, now the work queue.*

A fresh set of independent reviewers, none of whom saw the first round or the code, each given only the running site.
They judge the whole thing (the site, every game mode, the 3D scenes) and answer one question: what would make it a
funner, better, cleaner, more intuitive experience? Same set-up as Phase 6 (headless Chromium, desktop and iPad sizes;
phones are an edge case), one or two reviewers at a time, areas split as: first impressions and navigation; the crew
games and races; free ride and the 3D worlds; the rider, Garage and results. Each report ranks its ideas by how much
fun or clarity they would add for the effort, names a game or app that does it well, and is honest about what is
already good. The reports are merged into `docs/ui-review-2.md` and become the next work queue.

## Always open: 3D worlds (owner, 2026-11-14)

- [ ] More work on the 3D environments, free ride first, then the bus road:
      richer scenery and landmarks, better lighting and sky, more life at the roadside. Keep the models bonkers.

## Always open: UI polish (owner, 2026-11-14)

- [ ] Continuous improvement of the UI once the three games are in. Owner, 2026-11-14: make it fun but slick and polished. Never tick this: there is always more polish
      to do. Lower priority than anything above. Known rough edges to start from: the question sheet can cover riders
      mid-screen.

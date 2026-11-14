# Three new crew games: plan

Kidney Stone Express, Speed Dating and Climate Lawsuit. The owner's brief is the source; this is how we build it.
Work top to bottom, one checklist item per commit. Every invented rule or number also goes in `docs/decisions.md`.

## Decisions that apply to all three

- **They are bus-room games.** Each is a mode object in `session.py`'s `MODES`, beside Zombie Bus and VO2 Madness, so
  the lobby, sockets, bots, rejoin, crew cards, TV view, results, history, Strava and Discord come for free. The road
  layer (`docs/road-games.md`) is not used: it has no power targets.
- **No ERG, ever.** A room in one of these games forces every trainer to non-ERG (virtual gears or resistance, as the
  bus's non-ERG mode does today). A unit test proves `ergController` gets no target for a whole ride. Targets are still
  capped at 150% FTP; sprints have no target at all.
- **The server sets each rider's target.** Today the target comes from the plan block and tier. These games need
  different targets per rider (the siren rider, a Chaperone card, a fuel type), so the mode sends each rider a band
  (`lo`, `hi` % FTP, or "sprint", or "free") in the tick and the client scores compliance against it as now.
- **A session is a script.** Each game is a list of segments (name, seconds, kind) in config, with events scheduled
  inside it by a seeded random. One shared test walks every game's script over many seeds and fails if any gap between
  events is over 90 s. A time-scale setting runs a 40 min game in under a minute for tests.
- **One input message.** `{t:'act', k, v}` goes to `mode.on_act(rider, k, v)`: emoji, Chaperone cards, dating profile,
  fuel choice, seawall, bribe, jury vote. Rate-limited and validated on the server.
- **Bots fill the crew** to four and play every role (including Chaperone, juror and defendant), with a few characters
  per game. A solo rider with three bots is a full game.
- **Scenes are cheap.** Reskin what exists before building anything; boxes and emoji over new art; CC0 only.
- **Awards come from ride data** through one shared helper: smoothest, spikiest, most punished, plus each game's own.
- **Lengths are the brief's** (40, 40, 45 min). A "Quick" half-length option is the last item, not the first.
- **Tone:** patients, dates and companies are invented. Suburbs and roads are real (M1, Ipswich Road); hospitals,
  people and companies get joke names.

## Phase 0: crew game kit (no change to how the two current games play)

Five games through `game === 'madness'` switches will not hold, and four files in the path are already over 300 lines.

- [x] Server: pull the shared pieces of the two modes into `modes/common.py` (compliance tally, `award`, rider result
      rows) and split `session.py` (room vs. message handling) so it is back under 300 lines.
- [x] Server: per-rider target band from the mode in the tick; `act` message and `mode.on_act`; force non-ERG per game;
      ERG tests (no target written, 150% cap).
- [x] Server: script runner (`modes/script.py`): segments, seeded event scheduling, the 90 s gap test, time-scale.
- [x] Server: power-shape stats per rider (`ride_stats.py`): smoothness (spread of 3 s power around the rider's own
      30 s mean, as % FTP), spike count, time punished. Feeds Comfort, dating reports and awards.
- [x] Client: a game registry (`modes/crew/games.ts`): per game its name, blurb, HUD panel, scene set-up, event styles,
      results card and TV panel. Lobby, `hud.ts`, `world.ts`, `spectate.ts` and `resultsGroup.ts` read the registry
      in place of their madness switches. Tick carries a generic `game` object for new modes.
- [x] Client: lobby game picker becomes cards (five games will not fit a segmented control); generic prompt bar
      (countdown, band, "you" vs "everyone") and a choice sheet (pick one of N, used by cards, fuels and votes).
- [ ] (Strava and Discord text done for Kidney Stone Express; history labels still to do) Strava and Discord titles, history labels and the season ladder keyed by a per-game table, not `if` chains.

## Phase 1: Kidney Stone Express

Reuses the bus world: the bus becomes an ambulance (white, stripe, light bar), no horde, SEQ road signs.

**Rules assumed**
- Speed is the team's average % FTP. Each run has a distance that takes exactly 5 min at the patient's prescribed
  power, so riding the workout properly arrives on time. Faster is a time bonus, to a point.
- Comfort is 0 to 100 per patient. It drains when a rider's power is spiky or outside their band (each patient has
  a tolerance: Kidney Stone tiny, Fishing Hook huge) and creeps back when the crew is smooth.
- **Falling out the back:** the last 15 s of a run is a braking zone. Team average must be under 70% at the hospital
  doors or the patient falls out: 30 s reversing at 50% and a shame banner. (Being early is never punished on its own.)
- **Comfort at zero:** the patient gets out and walks. The run scores nothing and a 1-star review is read out.
- **Ramping (the comeback):** 1 min after a good run, 2 min after a bad one. Spinning easy at 90+ rpm together
  "sweet-talks triage" for a perk on the next run (one free spike, or a guaranteed green wave).
- Patients arrive in a shuffled order, easiest first. Two or three road events per run, picked to suit the patient.
- Road events: green wave (all over 95% for 20 s), M1 roadworks (all at or under 60%, each offender costs Comfort),
  speed hump (3-2-1, everyone under 20% for the same 3 s), won't pull over (one random rider sprints 10 s as the
  siren, the rest hold).
- Score: for each delivered patient, Comfort × time bonus, shown as a 1 to 5 star Google review with a line of text.
  Awards: Paramedic of the Week (smoothest), Learner Driver (spikiest), Lead Foot (most fines).

**Checklist**
- [x] K1 Server: `modes/ambulance.py`: script, five patients as interval sets, speed and distance, Comfort, braking
      zone, walk-off, ramping perk. Unit tests for each rule.
- [x] K2 Server: the four road events and scoring, reviews, awards. Tests.
- [x] K3 Client HUD: Comfort meter, patient card with speech bubbles, distance to hospital and ETA, event prompts,
      siren-rider callout, ramping queue screen.
- [x] K4 Scene: ambulance skin and light bar, siren flash on the siren event, hospital arrival, the patient on the
      road behind when they fall out, debug panel values.
- [x] K5 Results, TV view, Strava and Discord text, announcer lines, bot characters (Smooth, Twitchy, Lead Foot).
- [ ] K6 Four-rider headless test through a 5 min script, the e2e ride, manual notes in `docs/testing.md`, tuning pass.

## Phase 2: Speed Dating

Scene: the Madness road pack at dusk, riders side by side in their pairs, a heart between them that grows with the match.

**Rules assumed**
- Pairs rotate round-robin over six dates. Bots fill to at least four riders. With an odd number one rider per date
  is the Chaperone, and the job rotates so nobody sits out twice. With an even number a bot aunty plays the cards.
- Match score each second: full marks when the pair's % FTP is within 2 points, none at 10 apart, and nothing at all
  unless both are inside the date's band (so two people soft-pedalling together score zero). Surges and sprints score
  on how close together the two reacted.
- You see your date's power as a bar with no number. Six emoji, five uses per date, and that is all the talking.
- Chaperone cards (three per date, 15 s each, aimed at a rider or pair): "Your ex just texted" (target surges to
  110%), "Check's here" (target drops to 55%), "Is that a ring?" (both to 100% within 5 s). The Chaperone scores
  what the pair loses. This is the comeback mechanic: the Chaperone is aimed by the players at whoever is winning.
- The Bar: pick one of three random profiles; it shows on your date's intro card.
- Proposal (4 min): the top two pairs ride off at sweet spot for the engagement; the rest hold tempo and heckle
  with emoji.
- Finale (6 min): Wedding leg 1 (2 min tandem on summed power against a summed target), Divorce (2 min tug of war
  on % FTP between the worst pair, winner keeps the house), Wedding leg 2 (2 min). Guests throw confetti by hitting
  100% on prompts. With fewer than four riders there is no Divorce.
- "The house" is a cosmetic that moves to whoever won the last Divorce they were in.
- Cooldown: the leaked group chat (the emoji log and the game's own commentary) and each rider's compatibility
  report: gap by date, who led and who followed, reaction times, best and worst match, red flags.

**Checklist**
- [ ] D1 Server: `modes/dating.py`: pairing schedule, six themes as bands and prompts, match scoring. Tests.
- [ ] D2 Server: Chaperone cards, emoji with limits, profiles, Proposal, Wedding, Divorce, the house. Tests.
- [x] D3 Client HUD: date intro card, your bar against theirs, chemistry meter, emoji tray, Chaperone card hand.
- [ ] D4 (couples, heart and Chaperone done; confetti, tandem and rope still to do) Scene: pairs side by side, heart, confetti, tandem for the Wedding, tug-of-war rope for the Divorce.
- [ ] D5 Compatibility report, leaked chat, results, TV view, Strava and Discord text, announcer, bots
      (Clingy, Aloof, Chaotic).
- [ ] D6 Headless test with four and with five riders (Chaperone), e2e, manual notes, tuning pass.

## Phase 3: Climate Lawsuit

Scene: a new small diorama. A box-built coastal town (beach, surf club, Main Street, hill), one power station per
company that changes with its fuel (stack and smoke, gas flare, panels, turbine), and a water plane that rises.

**Rules assumed**
- Coins are profit. Fuel is chosen in the last 30 s before each decade; no choice means no change. Everyone starts
  on coal.
  - Coal: earns on any power, in proportion to % FTP. Emits 1.0.
  - Gas: earns 0.8 of coal, plus a bonus for each surge prompt hit (20 s at 105%, about every 2 min). Emits 0.5.
  - Solar: earns 1.2, only inside 85 to 90%. Emits 0.1.
  - Wind: earns only on gusts (15 s at 110%, about every 75 s, 60% between), a big payout each. Emits nothing.
  - Leaving coal costs coins, and the price falls each decade (wind dearest). Going back to coal is free.
- Sea level is everyone's emissions divided by the crew size. Tuned so an all-coal crew floods in the 2010s and a
  crew that half-switches by the 2000s just survives. Four stages as the brief has them.
- Seawall: any rider pays; it knocks the water back a fixed step and each one costs more than the last.
- Demand events as the brief: heatwave (all to 95% for 2 min or a blackout fine for everyone), half-time kettles
  (30 s, all over 110%), bitcoin miner (a whole decade at +5% targets and 1.25 profits), lobbyist.
- **Lobbyist (the comeback):** once a game the poorest company is secretly offered a lump of coins to run coal next
  decade. Nobody else is told until the Trial.
- Trial: the highest emitter is the defendant. The jury votes on one of three efforts (3 min at 90, 100 or 105%;
  ties go harsher) while spinning easy. Holding the band for 80% of the time is an acquittal on a technicality.
  The Trial runs whether or not the town flooded, and it reveals everyone's emissions, bribes and seawalls.
- Sentencing: a guilty defendant rides 2 min at 100% in the cooldown; the rest get emoji.
- Town survives: everyone wins, ranked by profit, top earner gets the Greenwashing Award. Town floods: everyone
  loses, and a guilty defendant's avatar wears a "GUILTY" sash in every game until they are acquitted in a later Trial.
- A branded rider may appeal at the Trial of any later Climate Lawsuit and stand as a second defendant, even if they
  are not the highest emitter. The sash expires after 30 days regardless.

**Checklist**
- [ ] C1 Server: `modes/climate.py`: decades, four fuels as per-rider targets, profit, emissions, switching costs. Tests.
- [ ] C2 Server: sea level and stages, seawalls, demand events, the lobbyist. Tests, including the two tuning cases.
- [ ] C3 Server: Trial, jury vote, sentencing, win and lose, the sash saved on the profile. Tests.
- [x] C4 Client HUD: fuel picker, coins and the crew's ledger (profit shown, emissions hidden until the Trial),
      sea-level gauge, gust and surge prompts, seawall button, the secret bribe sheet, the jury vote.
- [x] C5 Scene: the town, stations by fuel, rising water and flood stages, seawall with its sign, courtroom camera.
- [ ] C6 Results, TV view, Strava and Discord text, announcer, bots (Baron, Greenie, Fence-sitter), the sash on avatars.
- [ ] C7 Headless four-rider test, e2e, manual notes, tuning pass.

## Phase 4: after all three

- [ ] Quick (half-length) versions from the same scripts.
- [ ] Synthesised sounds: siren, heart monitor, wedding bells, gavel, waves.
- [ ] Owner checks added to `docs/owner-checks.md`; `docs/protocol.md`, `docs/map.md`, `docs/status.md` kept current
      throughout.

## Always open: UI polish (owner, 2026-11-14)

- [ ] Continuous improvement of the UI once the three games are in. Never tick this: there is always more polish
      to do. Lower priority than anything above. Known rough edges to start from: the lobby still says "Bus lobby"
      and shows the effort tier and ERG switch for games that use neither; game panels are untested on phones and at
      Large display size; the question sheet can cover riders mid-screen; history lists do not name the game.

## Dev pages for these games

`/hud-dev.html?game=ambo|date|climate&state=...` (a game's HUD over its scene, made-up ticks, no server),
`/town-dev.html` (the town), `/scene-dev.html?ambo=1&siren=1` and `?date=1`. Screenshots: `docs/screenshots/games/`.

## Owner's answers (2026-11-14)

The assumptions above stand: bots as dates and jurors, a date's power as a bar with no number, one winner by profit
when the town survives, real suburbs with joke hospitals and companies, early is never bad in the ambulance. The sash
shows in every game, with the appeal and the 30-day expiry.

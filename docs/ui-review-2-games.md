# UI review 2: the games and races

A fresh reviewer played every crew game and the three road races on 14 November 2026: a sped-up server (`ZB_TIME_SCALE=20`, `ZB_SCRIPT_SCALE=0.25`), the simulated trainer, bots, 1280×720 and 1024×768. Screenshots are in the session scratchpad (`…/scratchpad/rev2-games/`) and named below.

Caveat: at 20× speed the "Duration" tiles (0:21–2:01), compliance and the sim's target-holding are not realistic. I have left those out unless the problem would also happen at normal speed.

## Verdicts

**Zombie Bus.** The core idea is easy to read: a horde-gap bar, armour, a servo shop, roadblocks and an over-the-top "SUPPLY DROP" banner. The tension doesn't land, though. The horde caught the bus, armour hit 0 and compliance was 47%, and the results still said **"Made it!"** with a score of 939 and nothing to compare it with (`bus-host-01.png`, `bus-host-results.png`). Without a way to lose, the zombies are scenery. "Fell Off King" is a great award.

**VO2 Madness.** It has the best game structure here: mystery-box rounds, twists ("Underdog: last place scores triple", "Redline Bonus"), a crown and a "Who's trying hardest" board. Its weakness is that a rider without a heart-rate strap scores close to nothing and sits last with "no heart rate" (`vo2-t006.png`). The box panel also named one round while the timer named another (`vo2-t008.png`).

**Kidney Stone Express.** The writing is the strongest in the app. The Google reviews ("Got out. Walked. With a kidney stone…") and the patient quotes are real laugh-out-loud material (`ambo-results.png`). Role events ("Mo is the siren. Sprint! The rest hold steady") give each rider a moment (`dev-ambo-siren.png`). The live HUD is less clear: comfort read 91 while its bar was nearly empty, and "7 s ahead" has no reference point (`ambo-t003.png`). When the patient gets bumped, nobody is named.

**Speed Dating.** The format works: pairs, the Chaperone, Aunty Carol's cards, an engagement, then a tug-of-war divorce, and "the leaked group chat" ending is gold. The match meter is the core mechanic but has two unlabelled triangles. Your own panel read "0% · 0 PTS" while the board showed your couple on 143 (`date-t002.png`, `date-t004.png`). Name tags pile on top of each other in the pack (`date-t005.png`, `dev-date-divorce.png`).

**Climate Lawsuit.** It looks the best: the diorama town floods visibly by decade, and the "Seawall: not designed by a CPEng" sign is a nice touch (`climate-t002.png`, `climate-t005.png`). The decade events (State of Origin kettles, heatwave) are great shared goals. The Trial falls flat because only the defendant has anything to do and everyone else just watches (`dev-climate-trial.png`, `climate-t006.png`). The sash "until acquitted" is the best persistence hook in the app.

**Watch Party.** It works as a utility. Its lobby shows irrelevant Zombie Bus controls ("Horde: Easy/Normal/Hard/Nightmare") (`watch-lobby2.png`). The emoji bar is the only social layer.

**Road races.** The podium is a genuine moment: confetti, steps, the prime winner on a side box with a sign (`race-Crit-03.png`, `race-Race-01.png`). The bot personalities ("Surging Shaz: attacks, regrets it, recovers, attacks again") are charming. The race itself is a plain free ride, though:
- Nothing on screen tells you your place or the gap to the rider ahead.
- Sprint points show as tiny badges.
- Bots post identical times in every race (Dave 4:36, Shaz 4:56, Mick 5:08 in both Crit and Points).
- The results lead with "RIDE DONE" and workout tiles. "You finished 4th" sits below the fold (`race-Crit-results.png`).

## What already works (keep)

- The comedic writing: reviews, group chat, Aunty Carol, decade headlines, awards with jokes in the subtitle.
- Big centre-screen banners for phase changes (SUPPLY DROP, ENGAGED, VERDICT, FINAL SPRINT · DOUBLE POINTS).
- Shared crew goals with a clear threshold: the green-light wave, State of Origin, the heatwave.
- Bots with personalities, so you can play solo.
- The podium scene.

## Ideas, ranked by value for effort

| # | What I saw | Idea | Who does it well | Effort |
|---|---|---|---|---|
| 1 | Race results open with "RIDE DONE" and eight workout tiles. "You finished 4th" is below the fold (`race-Crit-results.png`). | For races, make the headline your place ("4TH", "WINNER!", "DNF – broom wagon"), followed by the race table and podium. Put the training tiles in a collapsed "Ride details" section. | Mario Kart (big placing number), Zwift results | S |
| 2 | The bus was caught, armour 0, crew at 47%, and the headline still said "Made it!" (`bus-host-results.png`, `bus-host-01.png`). | Make the outcome depend on performance, with 1–3 stars or a tier: "Limped home", "Made it!", "Flawless run", "Eaten at km 11". Do the same for Kidney (patients delivered) and Climate (town survived). A real loss state is what makes winning feel good. | Overcooked star ratings | S |
| 3 | The scores (939, 2,868, 759, 780) have no context (`bus-host-results.png`, `ambo-results.png`). | Show "Crew best: 1,120 · last time: 812" and a "NEW CREW RECORD" stamp when you beat it. | Overcooked level scores, Peloton PR badges | S |
| 4 | The race HUD shows speed, lap and a list of riders with tiny `+0:03`s. Nothing says "you are 4th" or how far to the next rider (`race-Race-00.png`, `race-Crit-01.png`). | Add a large place pill ("4th / 4") and a gap line ("Shaz 0:14 up the road · Mick 0:06 behind"). In Points and Crit, add "Sprint in 350 m" and "Prime next lap" countdowns. | Zwift race HUD, Mario Kart place number | M |
| 5 | Points race: sprint points appear only as unreadable badges, and "FINAL SPRINT · DOUBLE POINTS" fired after every bot had already finished (`race-Points-t001.png`). | After each sprint, show a three-line points table for about 4 s ("Shaz 9 · Dave 6 · you 1"). Show running points in the rider list at a readable size. | Zwift green jersey banners, Rocket League goal replay card | S |
| 6 | Kat was a DNF on "1.7 km ridden" when the bots finished the Points race. The race just ended. | Once the winner crosses the line, start a visible broom-wagon countdown ("Finish within 0:45 or the broom wagon gets you") so the cut-off is a chase rather than a surprise. | Mario Kart's finish timer, Fall Guys qualification countdown | S |
| 7 | The bots' finishing times are identical in every race, and all bots wear the same red cap and similar kit on the podium (`race-Crit-03.png`). | Add day-to-day variation (±5% form, random attack timing) and scale the bots near the host's FTP so races are close. Give each bot a signature kit colour. | Mario Kart CPU variety, Zwift pace partners | M |
| 8 | VO2 Madness: a rider without an HR strap sits on "no heart rate" and scores 47 against 807 (`vo2-t006.png`). | Fall back to power as a share of FTP (or of 5 min best) when there is no HR, so strapless mates can compete. Mark it with a small icon. | Peloton output-based leaderboard | S |
| 9 | The VO2 box panel said "Stairway to Hell" while the timer said "Next: Two-Minute Terror" (`vo2-t008.png`). | Fix the mismatch. Turn the reveal into a 2 s slot-machine spin with a sound, landing on the round and twist names. | Jackbox prompt reveal, Mario Party roulette | S |
| 10 | Speed Dating: the match meter has an unlabelled yellow ▼ and pink ▲, and "CHEMISTRY 0% · 0 PTS" contradicts the board's 143 (`date-t002.png`, `date-t004.png`). | Label the arrows "You" and the date's name. Make the bar glow and pulse hearts while you're matched, and fix the points shown. The core mechanic should be the most readable thing on screen. | Guitar Hero sync meter, Just Dance "Perfect" feedback | S |
| 11 | Name tags stack on top of each other in packs (`date-t005.png`, `dev-date-divorce.png`, `vo2-t006.png`). | Shrink and fade tags with distance, offset overlapping ones vertically, and in Speed Dating show only your date's tag in full. | Rocket League nameplates, Zwift | S–M |
| 12 | Kidney: comfort reads 91 over a nearly empty bar, and "ETA 0:03 · 7 s ahead" has no reference point (`ambo-t003.png`). | Make the bar match the number, and write "7 s ahead of the hospital's patience" or similar. | Overcooked order tickets (one bar, one meaning) | S |
| 13 | Kidney: "BANG. The patient left the stretcher" names nobody. Blame only appears in the results ("Learner Driver: Kat") (`ambo-t001.png`). | Name the culprit live and kindly ("Kat found the pothole. Patient −8"), and credit the save too ("Dazza smoothed it out"). Live blame and credit drive the banter. | Overcooked chaos and blame, Rocket League "What a save!" | S |
| 14 | The Climate Trial: only the defendant rides a target and the rest watch (`dev-climate-trial.png`). | Give everyone a role. The jury holds power to vote guilty or not guilty (a power tug-of-war against the defendant), or split the riders into prosecution and defence. The verdict should feel won, not announced. | Jackbox (everyone has a job every round) | M |
| 15 | Every game lobby repeats all six game cards, which pushes the run and the rules below the fold. At 1280 the Start button wraps under the title (`ambo-lobby.png`, `watch-lobby2.png`). | Collapse the game cards into a "Switch game ▾" chip. Replace them with a "How to win" card: three bullets and one picture of the key HUD widget. | Fall Guys round intro card, Jackbox lobby | S–M |
| 16 | The Watch Party lobby shows "Horde: Easy/Normal/Hard/Nightmare" (`watch-lobby2.png`). On the Bus guest view, the run is tagged "Hard" while the horde is set to "Normal" (`bus-lobby-guest-ipad.png`). | Hide controls that don't apply to the chosen game, and call the plan's tag "Effort: hard" so it isn't confused with horde difficulty. | — | S |
| 17 | Games start straight into the ride. The rules sit only in the lobby blurb. | Add a 5 s "How this one works" splash at the start (the goal, what scores, what loses), skippable and shown at most three times per game. | Fall Guys round splash | S |
| 18 | Results put the fun (reviews, awards) first, then a full workout report: power curve, zones, blocks, PRs (`bus-host-results1.png`, `ambo-results.png`). | Keep the fun section, then collapse the training block behind "Training details ▸". Add one "MVP" card with a silly stat for each rider, so everyone gets a line. | Rocket League post-match MVP and per-player cards | S |
| 19 | The race podium shows only bots when you come 4th. You're nowhere in the scene (`race-Race-01.png`). | Put the riders outside the top three by the podium (clapping, or holding a "wooden spoon" for last), so the camera always includes you. | Mario Kart (losers still on screen, sulking) | S |
| 20 | The servo shop opens as a modal over the scene mid-ride, with three small "tap to buy" cards (`bus-host-02.png`). | Let the crew vote with a 10 s timer, the most taps winning. Default to an auto-pick so nobody has to let go of the bars, and make the cards much bigger on iPad. | Jackbox voting, Left 4 Dead safe-room pacing | S–M |
| 21 | Climate's sash "until acquitted" is the only thing that carries over from one ride to the next. | Extend titles to every game, shown in lobbies and on name tags until someone takes them: Fell Off King, Paramedic of the Week, Married, Polluter, crit Prime winner. Add a crew "season" ladder of wins per game. | Fall Guys crowns, Mario Kart Grand Prix cups | M |
| 22 | The horde mirror is a small inset, and when the bus is caught the main camera shows sky and power lines (`bus-host-01.png`, `bus-host-02.png`). | When the gap drops under about 20 m, swing the main camera back so the horde fills the frame, with a heartbeat sound. That's where the tension should be. | Left 4 Dead finale, Mario Kart blue-shell cam | M |
| 23 | Scripted content repeats: the same patients, same dates and same bot race times. "This week: Closed Servos" in the Bus lobby is a lovely modifier. | Give every game a weekly modifier (Speed Dating "Silent disco: no emoji", Kidney "Wet roads: spikes cost double", Races "Headwind finish"). The modifier changes the run, not just the text. | Fall Guys weekly shows, Mario Kart 200cc / mirror | M |

## Top five to do first

1. A race headline that is your place, plus live place and gap in the race HUD (#1, #4).
2. Real outcomes and stars instead of "Made it!" every time (#2), with crew bests for context (#3).
3. Live, named blame and credit in the crew games (#13), and an MVP line for everyone (#18).
4. A VO2 fallback when there's no heart rate, plus the reveal fix (#8, #9).
5. Clean up the lobbies: collapse the game cards into a "How to win" card and hide controls that don't apply (#15, #16, #17).

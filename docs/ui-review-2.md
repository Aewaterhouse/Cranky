# Second review round: the work queue

Four fresh reviewers (none saw the code or the first round) used the running app on desktop and iPad and answered the
owner's question: what would make it funner, better, cleaner and more intuitive? Full reports, each with screenshots,
named examples and effort:

- `docs/ui-review-2-first.md`: first impressions and navigation (23 ideas)
- `docs/ui-review-2-games.md`: the crew games and races (23)
- `docs/ui-review-2-worlds.md`: free ride and the 3D worlds (21)
- `docs/ui-review-2-rider.md`: the rider, Garage and results (20)

**Shared verdict.** Keep: the writing and Aussie voice (Google reviews, the leaked chat, Aunty Carol), the bus lobby,
the Zombie Bus world, the town, the podium, the body creator, the Garage renders. What holds it back: the payoff loop
(rewards silent or broken, nothing to come back for tomorrow), outcomes that are always "Made it!", races that never
say where you are, and free-ride places that don't look like where they are.

## Done already (2026-11-14)

- [x] Home: a card that changes as you ride (first ride, welcome back, today's plan session) (first 1, 6).
- [x] Home: a mate's boarding ride as a loud Join banner at the top (first 2).
- [x] The simulator remembered across reloads (first 3); distinct avatars (first 9); the plan emoji (first 19).
- [x] Results headline says how it went; a race opens with its standings (games 1, 2).
- [x] Watch Party lobby no longer shows the horde (games 16).
- [x] Name tags: your own hidden, bus rows stepped (games 11, worlds 9, partly).

## Queue, highest value for effort first

**Rewards and coming back**
1. [x] Fix the scrap economy: about 60 to 120 per ride, not 1,187 for one bus run (rider 1).
2. [x] Solo workouts and free rides earn scrap too (rider 2).
3. [x] A "what you earned" card at the top of every results screen; one number for scrap, not two (rider 3).
4. [x] Badge unlock moments and progress bars on locked badges (rider 4).
5. [ ] One weekly streak, shown on home and results, with a freeze (rider 5).
6. [ ] Scores with context: crew best and last time (games 3, rider 14).

**Races**
7. [ ] Live place and gap to the next rider in the race HUD; readable sprint points (games 4, 5).
8. [ ] Let the last rider finish instead of a DNF when the winner crosses; vary bot times and kit (games 6, 7).

**Games**
9. [ ] Live, named credit and blame ("Kat bounced the patient"), and an MVP line for everyone in results (games 13, 18).
10. [ ] VO2 Madness falls back to power when there is no heart rate; the box name matches the timer (games 8, 9).
11. [ ] A five-second "how this one works" splash as each game starts (games 17).
12. [ ] Labels on the Speed Dating meter and the Kidney Stone Comfort bar and ETA (games 10, 12).

**Free ride and worlds**
13. [ ] The sea: a water plane at sea level and a sand band (worlds 1).
14. [ ] Map features for the nine routes that have none (worlds 2; the fetch kept failing before, retry).
15. [ ] Lift the dusk look and add a sunny default (worlds 3); break up the ground colour (worlds 4).
16. [ ] Close-up roadside detail for speed; a farm kit for open country; something every 30 to 45 s (worlds 5, 6, 7).

**Bugs found along the way**
17. [ ] ("1 rides" fixed; the missing History ride and the blank postcard need a reproduction: the reviewer did not
    say which screen) A second solo ride missing from History; "1 rides"; the postcard is a blank gradient and
    overflows on iPad (rider 20).

The rest of each report follows after these.

# UI review: the ranked list

Four independent reviewers used the running app on desktop, iPad and phone sizes, judging it against Zwift,
TrainerRoad, Strava, Peloton and game front ends (Mario Kart, Rocket League, Fortnite, Duolingo). Their full reports,
with screenshots named and a fix for each finding, are:

- `docs/ui-review-nav.md`: first run and navigation (27 findings, with a proposed menu tree)
- `docs/ui-review-riding.md`: the riding screens (28)
- `docs/ui-review-lobby.md`: lobbies, results and history (28)
- `docs/ui-review-rider.md`: the rider area and Garage (26)

Shared verdict: the core loop is quick (a group ride in three taps, today's workout at the top) and the games and the
body creator are the fun, but the app hides its best parts (the games, the results story), behaves inconsistently
between modes, and phones and touch were an afterthought.

This list is the work queue for the standing UI polish item in `docs/games-plan.md`. Tick items as they are fixed;
re-run the review after a big round.

## Fixed (2026-11-14)

- [x] Crew games hidden: every game is a card on the home screen (nav 1); "Watch" renamed "TV view" (nav 6).
- [x] Back leaves the app (nav 2). Refresh still drops you from a lobby to home.
- [x] Phone solo HUD collapses (riding 1).
- [x] Callouts dropped or piled up: they now queue (riding 2). The warning bar can still overlap the centre splash.
- [x] Supply drop camera loses the bus (riding 3). The air strike and free ride start are unchecked.
- [x] Target and power swap places between modes (riding 4).
- [x] ERG start-up throws you off the bus; warm-ups graded ✗ (riding 5).
- [x] Pause has no Resume button on touch (riding 9).
- [x] Power curve mixes estimates with real bests (rider 1).
- [x] Double tap buys and takes off (rider 2).
- [x] FTP typos clamped into history (rider 5).
- [x] Body creator loses unsaved work (rider 6).

## Open, most important first

*Owner, 2026-11-14: phones are an edge case. Phone-only findings (3, 12 and the phone halves of 8 and 19) go to the
end of the queue. Owner's own to-dos go first:*

- [x] Power curve: 23 durations instead of 10 and a smooth (monotone cubic) line; other graphs (Trends, FTP history) still straight segments.

- [x] Watch Party: paste a video link in the lobby, so the video is on as the ride starts.
- [x] "Your effort" levels: say what they are (Hard is the workout as written) instead of Hard, Medium, Easy.

**Results and history: the story is the product**
1. [x] A ride's History page drops the game story: Trial, couples, reviews, awards, crew (lobby 1, blocker).
2. [x] Results open with eight generic training tiles; the game outcome is 1.5 screens down on a phone (lobby 2).
3. [ ] (phone) Phone award cards lose the winner's name (fixed: a top-bar rule hid it); the crew table breaks on phones (lobby 3, 4).
4. [x] No scrap reward shown for the non-bus games (lobby 7).
5. [x] Postcard downloads silently, no preview or share, always named `zombie-bus-…` (lobby 8).
6. [ ] ("Ride again with this crew" done: the results button already went back to the same lobby, it now says so) No "ride again with this crew" (lobby 9). History rows don't name the game or outcome (lobby 18).
7. [x] The leaked group chat is a 40-line dump (lobby 5).

**The lobby**
8. [ ] (code, invite link, Start and Leave now in a bar that stays at the top; the settings below are still one long column) Long scroll, host decisions scattered, bus code and Start below the fold, top nav gone, Leave buried
   (nav 3, 4; lobby 10, 11, 16).
9. [ ] (run picker, effort and trainer rows now hidden for scripted games) Run picker and effort rows shown for games that ignore them; game cards are walls of small text (lobby 12, 13).
10. [x] Joining by code asks for a trainer before checking the code (nav 5).
11. [ ] (leaving a lobby now frees the seat and hands over the driver's seat; no ready state yet) Guests have no ready state; a host who leaves leaves a ghost seat (lobby 15, 27).

**Riding**
12. [ ] Phone crew HUD overlaps itself (riding 6); in-ride controls are tiny on touch (nav 10, riding 22).
13. [ ] The ride menu covers the target card; its contents and keys differ between modes (riding 7, 8).
14. [x] Watch Party panel washes out over bright video; its remote is always open and tiny (riding 10, 11).
15. [ ] Rider name tags stack and hide your own (riding 12). Letterbox bars eat the HUD (riding 13).
16. [ ] The servo shop opens over a short interval; Climate Lawsuit's panel grows over the controls (riding 14, 15).
17. [ ] (crew rides now show time to go on the bottom strip) Crew modes show no total time left (riding 17). Zone and W/kg describe power, not the target (riding 18).

**Rider and Garage**
18. [ ] Garage: no try-on preview, paint thumbnails without the bike, a 3,300 px wall without tabs (rider 3, 4, 8).
19. [ ] Phone Settings wider than the screen; clipped "OPTIONAL" placeholders in the display font (rider 9, 10).
20. [ ] (crew line colours fixed) Crew comparison line is the same yellow as yours (rider 7). Recent rides can't be opened from Overview (rider 11).

**Navigation and words**
21. [ ] Settings in two places, leaderboards in three; jargon (Ladder, Rider, scrap, tier, CTL/ATL/TSB) (nav 7, 8, 9;
    rider 15).
22. [ ] Welcome tour: no Back, a wall of text, no simulator button (nav 14, 15).

The polish items in each report (nav 16 to 27, riding 19 to 28, lobby 19 to 28, rider 12 to 26) follow after these.

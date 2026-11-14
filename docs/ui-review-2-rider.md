# UI review 2: the rider's corner and the payoff after riding

Reviewer: fresh eyes, no source read. Tested 14 Nov 2026 on a scratch build with the simulator: two fast solo workouts as Alex, one Zombie Bus with three bots as Luke, a Zombie fit plan started as Steve, a Garage purchase, and a look at every Rider tab both empty and with data. Desktop 1280×720 and iPad 1024×768. Screenshots are in the session scratchpad under `rev2-rider/`.

## Verdict

The bones are good, and much of it is already better than a hobby app needs. The Garage has real 3D thumbnails and buying a hat puts it straight on (`16-garage-hat-ipad`). The badge names are proper Aussie gags ("Pie Burner", "Bottomless Esky"). The Ladder turns awards into titles ("Road Rash Royalty", "Human Cadence Sensor", `13-ladder`). The power curve, best efforts and PR timeline are all there (`14-luke-power-full`). The training-plan calendar is clear (`11-plan-started-ipad`).

What's missing is the *payoff loop*. Rewards arrive silently or below the fold. The economy hands out nearly the whole shop after one ride. Solo rides earn nothing you can spend. Stats are written for TrainingPeaks users rather than mates. Nothing pulls you back tomorrow: no daily goal, no streak at risk, no "next unlock" teaser, no rival nudge. The fixes are mostly small: re-ordering, one celebration overlay and some tuning of numbers.

## Ideas, ranked by value for effort

| # | Idea | Effort |
|---|------|--------|
| 1 | Fix the scrap economy | S |
| 2 | Solo and free rides earn scrap too | S |
| 3 | "What you earned" reveal at the top of results | S–M |
| 4 | Badge unlock moment and progress bars | S |
| 5 | One streak, shown everywhere, with a freeze | S–M |
| 6 | The postcard needs a picture | M |
| 7 | "Next up" teaser on results and home | S |
| 8 | Plain-English stats for non-nerds | S |
| 9 | Results: fold the nerd tables | S |
| 10 | Put the rider's 3D avatar in the Rider header | S–M |
| 11 | Weekly crew league on the Ladder | M |
| 12 | Garage: owned/affordable sorting and a "can afford" hint | S |
| 13 | Daily/weekly drop: a rotating featured item | M |
| 14 | Compare-to-last-time on results | S |
| 15 | Rider level / XP from all riding | M |
| 16 | Plan progress you can feel | S–M |
| 17 | Crew rivalry nudges on Power | S |
| 18 | Fun-stat tiles on Overview | S |
| 19 | Year in Cranky / monthly wrap | M–L |
| 20 | Small bugs and polish seen along the way | S |

### 1. Fix the scrap economy (S)
**Saw:** one 44 min Zombie Bus paid **+1,187 scrap** (`09-results-full`). The whole hat shelf costs 40–450 and the dearest item is 640. After one ride Luke could buy most of the Garage (`13-garage-rich`, every button reads "Buy"). The collection is finished before it starts.
**Idea:** aim for about 60–120 scrap per crew ride plus about 20–40 per award. A legendary should then take two to three weeks of normal riding. Keep the big numbers for rare moments: first ride of the week, a season podium, a new FTP.
**Who does it well:** Zwift's Drops (bikes take weeks), Fortnite V-Bucks pacing.

### 2. Solo and free rides earn scrap too (S)
**Saw:** two solo workouts left Alex on **0 scrap** (`07-after-done`). The Garage says "Earned on crew rides". Riders who train alone mid-week get nothing to spend, so the Garage is dead to them.
**Idea:** a smaller per-minute rate on any ride, with a bonus for compliance on workouts and for finishing a planned session. Crew rides can stay the best earner.
**Who does it well:** Zwift (drops on every ride), Apple Fitness (every workout counts toward rings).

### 3. "What you earned" reveal at the top of results (S–M)
**Saw:** on the bus results the scrap line ("+1187 scrap banked… Spend it in the garage") sits near the **bottom**, below sprints and above the blocks table (`09-results-full`). The SCRAP tile at the top says **1137** while the banner says **1187**, which is confusing. On solo results there's no reward section at all (`06-results-full`). New power bests are shown well (a gold panel).
**Idea:** start every results screen with a two-second animated "haul" card: scrap counting up, badges unlocked, PRs, streak +1, plan session ticked. Then the stats. Give one scrap total that already includes the bonuses, plus a "Spend it →" button that goes to the Garage.
**Who does it well:** Duolingo lesson-complete screens, Fortnite match-end XP bars, Peloton milestone pop-ups.

### 4. Badge unlock moment and progress bars (S)
**Saw:** Luke earned "Fair Dinkum Start" but the results screen never mentioned it. It quietly appears on Overview as "Earned 14 Nov 2026" (`14-luke-overview-full`). Every locked badge looks equally far away. "Getting Cranky: finish 10 rides" gives no "1 of 10".
**Idea:** add a progress bar or "3/10" on each locked badge. Sort the nearest-to-done first, and show "Next badge: Full Tucker, 1,000 kJ in one ride (you did 18)". Pop a toast or modal on unlock. Split the 23 badges into rows (Milestones, Power, Passport) with a count per row.
**Who does it well:** Apple Fitness awards (progress rings on locked awards), Strava trophy case, Xbox achievements.

### 5. One streak, shown everywhere, with a freeze (S–M)
**Saw:** Overview says "1 week streak" (`14-luke-overview-full`), Trends says "1/1 day streak / best" (`12-alex-rider-Trends-full`), and the home card says "Last ride today" (`07-after-done`). There are two kinds of streak, and neither shows on home or results.
**Idea:** pick the **weekly** streak (it suits trainer riders): "ride at least twice a week". Show it as a flame on the header avatar and home card. On results show "streak +1". On Sunday warn: "1 more ride keeps your 6-week streak". Give one free "streak freeze" per month, maybe bought with scrap (this also gives scrap a sink).
**Who does it well:** Duolingo (streak plus freeze), Apple Fitness Move streak.

### 6. The postcard needs a picture (M)
**Saw:** the postcard is a blank dusk gradient with text under it. On iPad it overflows the modal on the right, and the award lines overlap ("damage" collides with the next trophy) (`18-postcard-ipad`). It's also only offered on crew rides, not solo ones (`06-results-full`).
**Idea:** render the bus in the rider's paint and the riders in their hats and bodies. You already have the 3D thumbnails for the Garage, so reuse that renderer. Add one headline stat and one funny award. Make it a square, phone-shareable image. Offer it on every ride type, and fit it to the modal.
**Who does it well:** Strava's shareable activity images, Zwift ride-end photo, Mario Kart highlight reel.

### 7. "Next up" teaser on results and home (S)
**Saw:** solo results end with only "Done" (`06-results-full`). The home welcome-back card reads "G'day Alex. Last ride today. 1 rides · 0 h · 4 kJ" (`07-after-done`): accurate but flat.
**Idea:** every results screen and the home card should name one next goal with a progress bar. The pick order: the plan's next session, the nearest badge, the Garage item you can almost afford ("Viking Helmet: 40 scrap to go"), the week's route or climb target (currently hidden on the Passport tab).
**Who does it well:** Duolingo's "daily quests", Zwift's "next unlock at level X".

### 8. Plain-English stats for non-nerds (S)
**Saw:** Trends leads with "fitness (CTL) / fatigue (ATL) / form (TSB)", all showing 0 (`12-alex-rider-Trends-full`). Results lead with NP, IF and TSS (`06-results-full`). "Compliance 59%" is in red with no explanation.
**Idea:** use friendly labels with the acronym small underneath: "Fitness", "Tiredness", "Freshness: ready to go 🔋". Reword compliance as "On target 59% of the time". On Trends add a one-line verdict: "Fitter than last month by 4 points". Keep the nerd numbers one tap away.
**Who does it well:** Apple Fitness trends (arrows and plain sentences), Garmin "training status".

### 9. Results: fold the nerd tables (S)
**Saw:** the bus results page is about 2,400 px tall: score, awards, crew table, eight stat tiles, PRs, chart, zones, sprints, scrap and an 11-row blocks table (`09-results-full`). The fun parts (awards, PRs) compete with the tables.
**Idea:** the order should be haul (idea 3), then awards, then crew, then PRs, then a "Details ▾" fold for the tiles, chart, zones and blocks. Put "Ride again with this crew" and "Postcard" at the top too.
**Who does it well:** Zwift ride report (summary first, graphs on tap), Peloton post-class.

### 10. Put the rider's 3D avatar in the Rider header (S–M)
**Saw:** the body creator is lovely, with absurd sliders like "Keg" belly and "Giraffe" neck (`04-empty-rider-Body`), and the Garage previews are 3D. But the Rider header, top bar, ladder and leaderboards all show two-letter initials (`14-luke-overview-full`, `13-ladder`). You never see your own character outside the Body tab.
**Idea:** use a rendered bust (head plus current hat) as the avatar image everywhere. Cache it as a PNG when the body or hat changes. Add an "outfit of the day" card on Overview.
**Who does it well:** Fortnite locker, Animal Crossing passport, Zwift profile avatar.

### 11. Weekly crew league on the Ladder (M)
**Saw:** the Ladder covers Zombie Bus only, resets each quarter, and is empty for anyone who hasn't ridden the bus (`03-empty-ladder`). Solo, free ride and the other crew games never appear.
**Idea:** add a Monday-to-Sunday "Crew League" tab. Points come from any ride: minutes, plus bonuses for compliance, PRs and awards. Show a podium, "you're 2nd, 14 pts behind Kat", and a small scrap prize and title for the week's winner. Keep the quarterly bus ladder as the prestige board.
**Who does it well:** Duolingo leagues, Strava club weekly leaderboard.

### 12. Garage: owned/affordable sorting and a "can afford" hint (S)
**Saw:** when broke, every card shows the same dim "Need 60 more" button (`03-empty-garage`). Equipped items do get a green "Equipped" with "Take off" (`16-garage-hat-ipad`), which works well. The page is one long scroll of six shelves.
**Idea:** add a Locker / Shop toggle (owned versus not owned) and shelf tabs. Show a progress bar on items (scrap/price) instead of "Need X more". Pin a "Treat yourself" row of items you can afford now. Add a try-on preview on your own rider before buying.
**Who does it well:** Fortnite locker versus item shop, Zwift Drop Shop (try-on preview).

### 13. Daily/weekly drop: a rotating featured item (M)
**Saw:** the whole catalogue is always for sale, and nothing is time-limited.
**Idea:** add a "This week at the servo" shelf of three items, with one rare item discounted or exclusive. That gives a reason to open the app on Monday. Seasonal joke items (Melbourne Cup fascinator, Christmas thongs) could rotate in.
**Who does it well:** Fortnite item shop, Animal Crossing Nook's Cranny.

### 14. Compare-to-last-time on results (S)
**Saw:** PR chips say "first time" (good). For a repeat workout nothing compares it to the last go.
**Idea:** add one line: "Sweet Spot 2×15: 4 W higher average than last time, on target 12% more". Add a ghost line on the power-versus-target chart.
**Who does it well:** TrainerRoad (workout history per workout), Strava's "2nd best time".

### 15. Rider level / XP from all riding (M)
**Saw:** progression is FTP plus scattered badges. There's no single number that always goes up.
**Idea:** levels from kJ or minutes (any ride type). Each level unlocks one Garage item or a body "Fun" option for free, with the level shown next to the name in lobbies. Scrap stays for buying, levels for status.
**Who does it well:** Zwift levels, TrainerRoad Progression Levels (per zone, which could be a later step).

### 16. Plan progress you can feel (S–M)
**Saw:** the plan page shows "Week 1 of 4. 0 done, 0 missed, 12 to go." and a clear calendar (`11-plan-started-ipad`). The home card is good: today's workout plus Start (`11-home-with-plan-ipad`). But the eight "Rest" tiles per fortnight dominate, and there's no finish reward.
**Idea:** shrink rest days to slim dashes and show a ring per week (3/3 ✓). Give a plan-complete badge, an exclusive cosmetic (e.g. "Zombie fit graduate" kit) and a before/after FTP card at the end.
**Who does it well:** TrainerRoad plan calendar, Apple Fitness+ programme completion.

### 17. Crew rivalry nudges on Power (S)
**Saw:** the crew leaderboard exists (Luke 247 W ahead of Alex at 5 s, `14-luke-power-full`). It's tucked under the curve, and the duration pills wrap oddly ("20 min" on a second line). The "Alex" chip that overlays a mate's curve is great but easy to miss.
**Idea:** add one sentence at the top of Power: "You hold the crew's 5 s crown 👑, and Alex is 67 W behind". Notify when someone takes your crown. Crowns could show on the ladder as titles too.
**Who does it well:** Strava KOM/QOM and the "you lost your crown" email.

### 18. Fun-stat tiles on Overview (S)
**Saw:** Overview totals are "1 ride · 0 hours · 18 kJ" (`14-luke-overview-full`). "0 hours" after a ride feels like a slap.
**Idea:** use minutes under an hour, and translate kJ into silly units ("≈ 4 sausage rolls", "kettle boiled 30×"), as the Pie Burner badge already does. Add zombies outrun, km of bus driven and times fallen off.
**Who does it well:** Strava Year in Sport, Peloton milestones.

### 19. Year in Cranky / monthly wrap (M–L)
**Saw:** history is a plain table (`14-luke-history`).
**Idea:** on the 1st of each month (and in December for the year), show a swipeable wrap: top ride, biggest PR, most-worn hat, crew member you rode with most, funniest award won. It's also very shareable.
**Who does it well:** Strava Year in Sport, Spotify Wrapped.

### 20. Small bugs and polish seen along the way (S)
- The home card says "**1 rides**" (`07-after-done`).
- Alex's **second solo ride never showed in History**: only the first (0:30) appears, though both reached the results screen. It may be a dedupe or save issue. Worth checking.
- The bus results crew table shows Luke's "Time in zone" as 14:23 while the bots show 1–2 min on a 2:17 compressed ride. This is probably sim time scaling, but check the units.
- "ARMOUR 0" sits next to "MADE IT!". If armour 0 is fine, say "Bus wrecked but home" for the laugh.
- Sprint grades "FAIL FAIL" in a shouty table are harsh for mates. Try "Missed / Hit / Great / LEGEND", keeping FAIL for the joke awards.
- The route of the week and weekly climb (with scrap bonuses) hide under Rider → Passport (`04-empty-rider-Passport`). Surface them on home.
- The power curve legend runs into its explanation: "Last ride Solid is a real effort…" (`14-luke-power-full`).
- "POWER BEST TIMELINE" lists 13 "first effort" rows after one ride. Collapse first-ride entries into one line.

## What already works (keep it)
- Garage 3D thumbnails, rarity tags, a two-tap confirm and instant equip with "Take off".
- Badge copy and Australian humour throughout; the Ladder's award titles.
- The gold "New power bests" panel and PR chips on results.
- The body creator's absurd ranges, undo and 🎲 random.
- The plan calendar and the home "Today's workout · Start" card.
- "Ride again with this crew" on bus results.
- Welcome onboarding explains FTP and ERG in plain words.

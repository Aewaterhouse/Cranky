# UI review: lobbies, results and history

Reviewer: independent agent, 14 Nov 2026. I played the app as a rider and did not read the code. Server on port 8203 with `ZB_TIME_SCALE=20`, client with `?fast=60`, simulated trainers. Viewports: 1280×720, iPad 1024×768 and phone 390×844. I hosted as Alex with three bots, and Luke joined by code on a phone. I rode three games to the end: Zombie Bus (Lunch Break Quickie), Speed Dating and Climate Lawsuit. I also looked at the VO2 Madness and free-ride group lobbies, ride history and a ride's detail page, and the training plan picker and calendar. Screenshots are in `/tmp/claude-1000/-home-alex-projects-cranky/b534b2ab-7915-448b-aa5d-39e265fcc440/scratchpad/review-lobby/`.

Caveat: sped-up rides squash wall-clock time, so durations (0:39, 2:15), TSS and some time-in-zone figures are artefacts of `?fast`. The findings below about numbers are about *inconsistency between two places on the same screen*, not about the absolute values.

## Verdict

The lobbies are good. A guest can join a bus from the Open buses card or by typing a code (lower case works). The yellow bus with seats, bots and a driver badge reads instantly, and the run card with its coloured profile beats most cycling apps. The free-ride group lobby is the tidiest screen in this area. The bus lobby's main problem is the host's decisions. The game is chosen inside the bus, the horde and trainer rules sit under the game cards, the run picker is a full-width panel below the fold, and the bus code and Start are below the fold on a laptop or iPad. Each game card also shows a paragraph of tiny text. Guests get a phone page about five screens tall, with the "Waiting for Alex to start…" status at the very bottom.

The results screens have the best writing in the app. Fell Off King, the leaked group chat, Greenwashing Award and "Wears the sash until acquitted" are genuinely funny. But the layout hides them. Every game opens with the same eight training tiles (duration, NP, IF, TSS…), and the game's outcome comes second, a full phone screen and a half down. The climax of Climate Lawsuit is a single grey sentence. On phones the award cards lose the winners' names, and the crew table falls apart. Once you leave the page, the game story is gone: the ride's detail page in History keeps only the power data. The postcard downloads with no preview or share sheet, and the file is always called `zombie-bus-…png`. The two non-bus games showed no scrap reward. Fixing the order of the results page (outcome first, training stats folded below) and keeping the game card in history would give the biggest gain.

## Findings (most severe first)

### 1. Ride detail page loses the whole game story
- **Screen:** Rider › History › a ride
- **Saw:** Climate Lawsuit's detail page shows only the training tiles, the power chart, the zones and the blocks. The Trial, awards, crew table, town status and profit are gone. The same goes for Speed Dating's couples and group chat (`53b-ride-detail-full.png` compared with `20b-cl-results-host-full.png`).
- **Better:** Strava's activity page keeps segments, achievements and kudos forever, and the Zwift Companion keeps event results and placings.
- **Severity:** blocker (the best content in the app can never be seen again)
- **Fix:** Store the game summary with the ride and render the same game card at the top of the detail page as on the results screen. Show the training stats below it.

### 2. Results lead with generic training stats; the game outcome is buried
- **Screen:** Results, all games
- **Saw:** "Made it!" and then eight identical tiles (duration, avg power, NP, IF, TSS, energy, cadence, compliance) and a PR strip. Only then come Bus score, Married / Kept the house, or Town survived / The Trial. On a phone the outcome starts about 1.5 screens down (`20-cl-results-host.png`, `22-sd-guest-phone-scroll0.png`, `21b-zb-results-guest-phone.png`).
- **Better:** Mario Kart, Fall Guys and Rocket League open on the podium or the winner. Zwift's event results lead with your placing, and Peloton's leads with your output against the class.
- **Severity:** annoying (the most important finding for fun)
- **Fix:** Add a per-game hero banner: "💒 Dazza + Shazza got married. Dazza kept the house", "🌊 The town survived. ⚖️ Luke: GUILTY", "🧟 Bus made it: 1,229". Put your own line under it ("You: 2nd couple with Dazza, 165 pts"). Move the eight training tiles into a "Your ride" section below the game card, collapsed to four on phones.

### 3. Phone award cards drop the winner's name
- **Screen:** Results, phone
- **Saw:** On desktop each award shows the title, the name and the reason. On a 390 px phone it shows only "BEST MATCH · 175 points a date" and "RED FLAG · 3% average match", with no name (`22-sd-guest-phone-scroll3.png`, and the Zombie Bus awards in `21-zb-results-guest-phone-full.png`).
- **Better:** Overwatch's end-of-match cards and Apex's champion screen always lead with the player.
- **Severity:** annoying
- **Fix:** Don't hide the name line at narrow widths. Put the avatar in place of the trophy icon, so the name and face read first.

### 4. Crew table is unreadable on phones
- **Screen:** Results › Crew, phone
- **Saw:** The Speed Dating "Match · best date · red flags" column wraps one word per line, so a row is 600 px tall, and the Sprints column is cut off at "Spri" (`22-sd-guest-phone-scroll4.png`, `22-sd-guest-phone-scroll5.png`). The Zombie Bus table squeezes "Time in zone" onto three lines.
- **Better:** Strava's group activity view and the Fall Guys round summary use one card per player on mobile.
- **Severity:** annoying
- **Fix:** Below about 600 px, render each rider as a card: name, the headline game stat, then red flags as small chips. Drop columns that are empty for this game, such as Sprints ("–") in non-bus games.

### 5. The leaked group chat is a 40-line text dump
- **Screen:** Results › Speed Dating
- **Saw:** About 40 plain lines ("Date 1 · Bluey → Shazza: 🔥") with the funny lines (Aunty Carol, "Your ex just texted", the wedding) mixed in. It is about two phone screens of scrolling (`20b-sd-results-host-full.png`, `22-sd-guest-phone-scroll2.png`).
- **Better:** iMessage or WhatsApp bubbles. Overwatch's "Play of the Game" shows the highlight, not the log.
- **Severity:** annoying
- **Fix:** Show the 4 or 5 story lines as chat bubbles (Aunty Carol, the cards played, engaged, married, "sent nothing all night"). Put the emoji traffic behind a "Read the whole chat" disclosure, grouped by date.

### 6. The same stat disagrees with itself on one screen
- **Screen:** Results and lobby
- **Saw:**
  - The Compliance tile says 37%, but Alex's row in the crew table says 50%.
  - Duration is 0:39, but Alex's time in zone is 2:50. In Climate Lawsuit, humans show 32:00 time in zone while bots show 2:06 and the ride lasted 2:21.
  - The Scrap tile says 458, but the banner says "+483 scrap banked".
  - The Speed Dating card says "40 min" while the run card says "44 min", and the run card carries a "servo stop" tag.
  - The free-ride lobby says Mount Buffalo 21.0 km, then "20.9 km in all".

  Screenshots: `20b-zb-results-host-full.png`, `20b-cl-results-host-full.png`, `10b-sd-host-ready-full.png`, `81-freeride-group-lobby.png`.
- **Better:** TrainerRoad and Strava compute a stat once and show it the same way everywhere.
- **Severity:** annoying (makes every number feel untrustworthy)
- **Fix:** Use one source of truth for each stat. Label any second variant ("compliance on ERG blocks", "game time"). Drop the Zombie Bus tags from other games' run cards. Make the game blurb read its duration from the plan.

### 7. No rewards shown for non-bus games
- **Screen:** Results › Speed Dating and Climate Lawsuit
- **Saw:** Zombie Bus shows "+483 scrap banked … Spend it in the garage." Speed Dating and Climate Lawsuit show no scrap line at all, and the header balance stayed at 483 after both (`20b-sd-results-host-full.png`, `52-history.png`).
- **Better:** Rocket League, Fortnite and Apex show an XP and currency tally after every match, whatever the mode.
- **Severity:** annoying
- **Fix:** Award and show scrap for every game, or show a line that explains why a mode pays nothing.

### 8. The postcard downloads silently: no preview, no share, wrong name
- **Screen:** Results › Postcard; ride detail › Save postcard
- **Saw:** Clicking Postcard immediately downloads `zombie-bus-2026-11-14.png`, even after Climate Lawsuit. Nothing appears on screen, and the label changes to "Save postcard" on the detail page (`23-cl-postcard.png`).
- **Better:** Strava and Peloton open a share sheet with a preview image and stickers, and Fall Guys and Mario Kart offer a screenshot share.
- **Severity:** annoying (sharing is the hook for a friends' app)
- **Fix:** Open a modal with the postcard image and buttons for Share (Web Share API on mobile), Copy image and Download. Name the file after the game and date. Use the same label everywhere.

### 9. No "ride again with this crew"
- **Screen:** Results › Back to the bus
- **Saw:** "Back to the bus" opens a lobby with a new code (BGGB became CAGE, `24-sd-after-back.png`), so the crew has to be sent a new code.
- **Better:** Rocket League, Fall Guys and Mario Kart online keep the party together with "Play again", and Zwift's meetups let you re-invite the last group.
- **Severity:** annoying
- **Fix:** Rename the button "Same crew, new ride". Keep the bus code and seats, and move everyone who is still on the results screen back into the lobby.

### 10. The host's decisions are scattered and out of order
- **Screen:** Bus lobby, host
- **Saw:** The host has to look in five places. The game is chosen inside the bus. The horde, trainer mode and "This week" settings sit under the game cards. Effort, ERG/Gears and Trainer are in the right column. The run picker is a full-width panel below everything. The bus code is bottom-left (`10b-zb-host-ready-full.png`). It isn't clear which choices belong to the host and which to each rider.
- **Better:** Zwift's event setup and Overwatch or Rocket League custom games use one ordered column: mode, map/run, rules, invite, start. Personal settings (effort, ERG) go in a separate "You" panel.
- **Severity:** annoying
- **Fix:** In the left column, show the seats and then "Bus settings (driver)" in order: game, run (with an inline "Change run" that opens the picker as a drawer), horde, trainers. In the right column, show "You" (effort, ERG, trainer) and then the code and Start. Hide the 6-card game grid behind a "Change game" button once a game is picked.

### 11. Bus code and Start are below the fold on laptop and iPad
- **Screen:** Bus lobby at 1280×720 and 1024×768
- **Saw:** At 1280×720 the code sits at about y = 1300. On iPad, neither the code nor Start is visible without scrolling (`05-zb-lobby-host.png`, `70-lobby-ipad.png`).
- **Better:** Jackbox, Among Us and Kahoot put the room code at the top in huge type, because sharing it is the host's first job.
- **Severity:** annoying
- **Fix:** Put the code and "Copy invite link" in the lobby header next to the title. On narrow screens, make Start a sticky footer.

### 12. Run picker shown for games that ignore it
- **Screen:** VO2 Madness lobby (also Speed Dating and Climate Lawsuit, which use a fixed plan)
- **Saw:** The "Choose the run" panel shows nine endurance workouts with the "Endurance" goal selected, while the run card says the VO2 Madness deck is reshuffled at the start (`04b-full.png`).
- **Better:** Mario Kart greys out options that don't apply to the mode, and Rocket League hides them.
- **Severity:** annoying
- **Fix:** Hide the picker when the game brings its own plan, or show a single line: "This game sets its own workout."

### 13. Game cards in the lobby are walls of tiny, low-contrast text
- **Screen:** Bus lobby
- **Saw:** Six cards each carry a paragraph of about 11 px text. The unselected cards are olive on yellow with dim text, which is hard to read. The grid takes most of a screen (`10b-zb-host-ready-full.png`, `07-guest-lobby-phone.png`).
- **Better:** Mario Kart's cup select and the Fall Guys show selector use an icon and a name, and show the description for the focused item only.
- **Severity:** annoying
- **Fix:** Show only the emoji, the name and a 3-word tag on each card. Show the full blurb once, in the run card. Give unselected cards a solid dark fill with full-contrast text.

### 14. Horde row: illegible helper text, broken control on phone
- **Screen:** Zombie Bus lobby
- **Saw:** "The horde keeps coming. A good crew limps home." and "The servo shop stays shut all ride." are pale yellow on yellow. On a phone the Easy/Normal/Hard/Nightmare control wraps, so "Norm|Hard" overlaps and "Nightmar" is cut off. The guest also sees a duplicate read-only "Normal" beside it (`10b-zb-host-ready-full.png`, `07-guest-lobby-phone.png`, `11-zb-guest-ready-full.png`).
- **Better:** Overwatch's custom game settings use one row per setting, with readable text.
- **Severity:** annoying
- **Fix:** Use dark text, or a dark panel, for helper text on yellow. Stack the label, a full-width 2×2 control and the helper on separate lines below 500 px. For guests, show a read-only chip ("Horde: Normal") instead of the control.

### 15. Guests have no ready state, and the host can start regardless
- **Screen:** Bus lobby
- **Saw:** Each seat shows only a small green dot, with no "trainer connected / ready" state. The host's Start button is always live (`10-zb-host-ready.png`).
- **Better:** Overwatch, Valorant and Fall Guys party ready checks, and Zwift's "riders in pen".
- **Severity:** annoying
- **Fix:** Add a "Ready" toggle per seat that turns on automatically when the trainer is connected, and show "3 / 4 ready" on Start. Let the host still start, with a confirmation if anyone isn't ready.

### 16. Guest phone lobby is five screens tall, and the status is at the bottom
- **Screen:** Bus lobby, guest at 390 px
- **Saw:** The order is the seat grid, the game card, horde, trainers, code, run, effort, trainer, and finally "Waiting for Alex to start…" at the end. Your own seat has a green border but no "You" label (`07b-guest-lobby-phone-full.png`, `11-zb-guest-ready-full.png`).
- **Better:** Fall Guys and Apex lobbies on Switch: your character, a short summary of the match, and a status bar pinned at the bottom.
- **Severity:** annoying
- **Fix:** Add a sticky footer for guests ("Waiting for Alex · Hard · ERG · trainer ✓"). Collapse the seat grid to one row of avatars on phones. Put the "You" settings first, then the run summary. Add a "You" badge on your seat.

### 17. A game silently changed my saved effort tier
- **Screen:** Lobby, then Rider profile
- **Saw:** After riding Speed Dating, where my seat showed EASY, my profile header reads "FTP 200 W · easy tier" instead of the earlier hard tier (`52-history.png` compared with `31-rider-empty.png` for an untouched rider).
- **Better:** TrainerRoad and Zwift keep per-workout intensity separate from profile settings.
- **Severity:** annoying
- **Fix:** Treat effort set in a lobby as for this ride only, or say "Saved as your default" when it changes.

### 18. History list shows no game or outcome
- **Screen:** Rider › History
- **Saw:** Each row has the date, name, a green "Crew" chip, time, average W, NP, TSS, kJ and compliance. There is no game icon, no result and no crew, so three crew rides look the same (`52-history.png`).
- **Better:** A Strava feed entry shows the title, map, who you rode with and achievements, and Zwift lists event placing.
- **Severity:** annoying
- **Fix:** Add the game emoji and a one-line outcome ("💒 2nd couple", "⚖️ Luke guilty", "🧟 1,229"), plus small avatars of the crew. Group rows by week and keep the power columns for wide screens.

### 19. Rides have no shareable URL
- **Screen:** Ride detail
- **Saw:** Opening a ride leaves the URL at `/#rider`. A ride can't be linked, bookmarked or reopened after a refresh (`53-ride-detail.png`).
- **Better:** Every Strava and TrainerRoad activity has its own URL.
- **Severity:** annoying
- **Fix:** Use `#ride/<id>` and open the detail view from it.

### 20. Results headline and labels don't explain themselves
- **Screen:** Results
- **Saw:** The headline is always "Made it!", even when Luke was found guilty. Tiles such as "Kept the house: Dazza", "Sea level: Main Street" and "Armour 0" assume you know the rules (`20-cl-results-host.png`, `20b-sd-results-host-full.png`).
- **Better:** Mario Kart and Fall Guys write a verdict for you ("You qualified!", "Eliminated").
- **Severity:** polish
- **Fix:** Write a per-game headline ("The town survived", "Wedding bells", "Bus made it home"). Add a sub-label to cryptic tiles ("Kept the house: won the divorce", "Sea reached Main Street").

### 21. Blocks table has dead columns for non-ERG games
- **Screen:** Results and ride detail › Blocks
- **Saw:** Speed Dating and Climate Lawsuit show "–" for Compliance on every row, In zone is 0:00 for most rows, and "The Wedding" appears twice (`23-sd-postcard.png`, `53b-ride-detail-full.png`).
- **Better:** TrainerRoad's interval table shows only meaningful columns for the workout type.
- **Severity:** polish
- **Fix:** Hide columns that are all "–" or 0:00, rename the second Wedding (for example "The Reception"), and collapse the table by default.

### 22. Training plan picker commits you without a preview
- **Screen:** Ride › Training plan (no plan yet)
- **Saw:** Four plan cards with a blurb, day chips and a native date input. The date input shows US `11/14/2026` in this browser. There is no weekly hours or TSS, no sample week and no end date before "Start plan" (`30b-plan-picker-full.png`).
- **Better:** TrainerRoad's Plan Builder shows weekly hours and TSS and a calendar preview before you commit.
- **Severity:** annoying
- **Fix:** When a plan is selected, show "~2 h/week · ends 11 Dec" and a mini preview of week 1. Format the chosen date in en-AU beside the input ("Sat 14 Nov").

### 23. Plan calendar: odd week shape, no totals, no crew link
- **Screen:** Training plan calendar
- **Saw:** Weeks run Sat–Fri because they follow the start date. Rest days take full tiles. There are no weekly totals. The bus workouts (Bus Quick 30, Bus Crew 45) offer no "ride with the crew" option, and the Ride tab's Today card has only Start (`61-plan-calendar.png`, `62-ride-tab-with-plan-full.png`, `63-plan-calendar-phone-full.png`). The phone layout, which drops rest days, is good.
- **Better:** TrainerRoad's calendar uses Mon–Sun with weekly TSS and hours. Zwift's training plans let you swap a workout for a group event.
- **Severity:** polish
- **Fix:** Use Mon–Sun rows with weekly totals and slim rest cells on desktop. On Today's card for bus workouts, add "Start a bus with this" next to "Start".

### 24. Free-ride group lobby speaks a different language from the bus lobby
- **Screen:** Free ride › Group ride lobby
- **Saw:** It says "Ride code" and "HOST" where the bus lobby says "Bus code" and "DRIVER". It uses plain cards instead of the bus, and the route is chosen from a native select without the elevation profile the picker just showed. The Drafting helper floats in a narrow column on the right (`81-freeride-group-lobby.png`). It is otherwise the tidiest lobby, with Start above the fold.
- **Better:** Zwift's event and meetup lobbies share one layout across modes.
- **Severity:** polish
- **Fix:** Use the same terms (one code word and one host word) and the same header, code and Start placement as the bus lobby. Show the selected route's profile under the select.

### 25. Free-ride picker: join-by-code buried, misleading averages, wrapping filters
- **Screen:** Free ride route picker (iPad)
- **Saw:** "Have a ride code?" is at the very bottom of a long page. Routes with 400+ m of climbing show "avg 0%" (Great Ocean Road, Akuna Bay, Mount Coot-tha loop). The state and length filters wrap 3 + 3 and 3 + 1, leaving "Long" orphaned (`40-freeride-picker-ipad.png`, `40b-freeride-picker-ipad-full.png`).
- **Better:** Zwift's route list puts filters in one compact row, and Strava shows the max gradient or the climb category for loops.
- **Severity:** polish
- **Fix:** Put a "Join a ride" code box in the page header. Show "max x%" or "climbs n m" instead of "avg 0%" for loops. Use horizontally scrolling chips for the filters.

### 26. A toast covers controls
- **Screen:** Lobbies
- **Saw:** "Simulated trainer ready" sits over the Trainer "Change" button on desktop and over the horde control on phone for several seconds (`04-after-vo2-card.png`, `07-guest-lobby-phone.png`).
- **Better:** Material and iOS place toasts in a safe area, above any sticky footer and away from controls.
- **Severity:** polish
- **Fix:** Anchor toasts to the top centre on lobby screens, or shorten them to 1.5 s and let them pass clicks through.

### 27. A host who leaves leaves a ghost seat
- **Screen:** Bus lobby, guest view after the host leaves
- **Saw:** Steve's seat stays, greyed out with a red dot, and the DRIVER badge moves to Kat with no message (`72-guest-after-host-leaves.png`).
- **Better:** Rocket League and Overwatch say "X left the party. You are now party leader."
- **Severity:** polish
- **Fix:** Show a toast ("Steve hopped off. You're driving now"). Free the seat after a short grace period, with a "reconnecting…" label until then.

### 28. Delete sits next to the export buttons
- **Screen:** Ride detail
- **Saw:** The red "Delete" button is the fourth button in a row with Download .fit, Export JSON and Save postcard (`53b-ride-detail-full.png`).
- **Better:** Strava puts delete in an overflow menu, behind a confirmation.
- **Severity:** polish
- **Fix:** Move Delete into a "…" menu, or separate it to the far left, and confirm it with the ride's name.

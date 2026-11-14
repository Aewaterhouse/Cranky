# UI review: first run and navigation

Reviewer: independent agent, new-player eyes. Build reviewed on 14 Nov 2026 with a fresh database, simulated trainer, at 1280×720, iPad 1024×768 and phone 390×844. Screenshots are in the session scratchpad under `review-nav/` (file names cited below).

## Overall verdict

Cranky gets more of the hard things right than most hobby apps. The "Who's riding?" login is warm and quick (Netflix-style profile pick, last rider remembered with the password field focused), the three-step welcome sets FTP, explains ERG and compliance, and ends on "Connect trainer", and the trainer picker blocks before a ride rather than failing mid-ride, which is how Zwift and TrainerRoad do it. The Ride tab has a clear primary action (the big yellow "Start a new bus"), Today's workout lands at the very top once a plan is running, and the common tasks are short: start a group ride in 3 taps plus sharing the code, join a friend's open bus in 2 taps, and find your last ride in 3. The look is consistent and strong: hazard-tape stripes, chunky display type, yellow for primary.

The weak spots are structural. The app's best content, five extra crew games and the Watch Party, is hidden inside the Zombie Bus lobby, while the home screen headlines a single "Crew game: Zombie Bus" and lists "Watch party" and "More games" as COMING SOON. A new rider would never know those games exist. Navigation has no URLs below the top tabs: the bus lobby, Solo workout, Training plan, Free ride and every Rider sub-tab all sit on `/` or `#rider`, so the browser or Android back button exits the app and a refresh drops you out of the lobby. The bus lobby itself is a 2,400 px scroll with the start button, bus code and game choice spread across it and the top nav removed. Several labels are insider jargon (Ladder, scrap, tier, TSS, roadblocks, servo), Settings exists in two places, and leaderboards are split across Ladder, Passport and Free ride. None of this blocks the core loop, but it makes the app feel smaller and more confusing than it is.

## Proposed menu structure

```
Top bar: Cranky logo (home) · Ride · Crew · Garage · Me      [trainer pill] [avatar ▾]
Ride (home)
├─ Today's workout card (if on a plan) / "Pick a training plan" nudge
├─ Ride with the crew  → open buses list, Start a bus, Join by code, Spectate by code
├─ Solo workout        → FTP tests, workout library
├─ Free ride           → routes, route of the week
└─ Training plan       → calendar
Crew            (was Ladder + scattered leaderboards)
├─ Season ladder
├─ Route leaderboards
└─ Who's online / recent crew rides
Garage          (category tabs: Bus · Rider · Bike, live 3D preview, "Equipped")
Me              (was Rider)
├─ Overview · History · Power & trends · Passport · Avatar
└─ Settings (FTP, zones, HR, Strava, trainer)   ← the only Settings
Bus lobby (own URL /bus/ABCD, sticky header: ← Leave · code · Invite · Start)
├─ Step 1 Game (all six cards, Watch Party included)
├─ Step 2 Run
└─ Step 3 Your effort
```

## Findings (most severe first)

### 1. Crew games and Watch Party are hidden; the home screen says they don't exist
- **Screen:** Ride tab, bus lobby.
- **Saw:** Home says "CREW GAME: Zombie Bus" and lists "Watch party: COMING SOON" and "More games: COMING SOON" (`10-home-full-1280.png`). Inside the lobby there are six games: Zombie Bus, VO2 Madness, Kidney Stone Express, Speed Dating, Climate Lawsuit and Watch Party (`21-newbus-after-sim.png`).
- **Well-designed apps:** Mario Kart and Rocket League show the mode list as the first choice; Zwift's home shows every event type. Nothing playable is ever labelled "coming soon".
- **Severity:** blocker for discovery.
- **Fix:** Rename the home section to "Ride with the crew" and show the six game tiles (or a carousel) on the Ride tab. Tapping one starts a bus with that game preselected. Remove the Watch party COMING SOON card, and keep "More games" only if there is something truly unreleased.

### 2. Browser and Android back leave the app, and refresh loses your place
- **Screen:** bus lobby, Solo workout, Training plan, Free ride, Rider sub-tabs.
- **Saw:** These all stay on `/` (or `#rider`). In Kat's lobby, back went to `about:blank` (`26-kat-after-back.png`). Sub-tab changes on Rider don't touch the URL either.
- **Well-designed apps:** Strava, TrainerRoad's web app and every SPA game launcher push a history entry per screen, and Zwift Companion deep-links to a meetup.
- **Severity:** blocker on phone and iPad, where back is a reflex.
- **Fix:** Use hash routes for every screen: `#solo`, `#plan`, `#free`, `#bus/ABCD`, `#rider/history`. Make the invite link `#bus/ABCD` so it also rejoins after a refresh. When back is pressed in the lobby, ask "Leave the bus?".

### 3. The bus lobby is a long scroll with the key actions scattered
- **Screen:** bus lobby.
- **Saw:** At 1280 the page is about 2,400 px tall. Seats, bots and the game grid sit in the yellow card. The bus code and "Copy invite link" sit under it, "Start the bus" is in the right column, and "Choose the run" comes after all of it (`21-newbus-after-sim.png`). On phone the driver scrolls past six empty seats and six game cards before reaching the code or Start (`44-phone-lobby.png`).
- **Well-designed apps:** Fortnite and Apex lobbies keep a fixed bar with party code, Ready/Start and Leave. Mario Kart steps through Mode → Course → Ready.
- **Severity:** annoying.
- **Fix:** Add a sticky lobby header: "← Leave", the code "BBMR" with a copy button, rider count, and "Start the bus". Put game, run and effort in three collapsible steps showing the current choice ("Game: Zombie Bus ▸ change"). Collapse empty seats into "4 seats free".

### 4. The top nav vanishes in the lobby, and Leave is buried
- **Screen:** bus lobby.
- **Saw:** No header, no logo, no "← Back" (`25-kat-lobby.png`). The only exit is "Leave the bus", below Start in the right column. The other sub-screens use "← Back" top-left (`30-solo.png`).
- **Well-designed apps:** Peloton and Zwift always keep an X or back control top-left in pre-ride screens.
- **Severity:** annoying.
- **Fix:** Use the same "← Leave bus" position top-left as the other screens, in the sticky header from finding 3.

### 5. Joining by code asks for a trainer before checking the code
- **Screen:** Ride tab, "Got a code?".
- **Saw:** "ZZZZ" + Join opened the full trainer picker. Only after choosing the simulator did a toast say "No bus with code ZZZZ" and clear the field (`50-join-bad-code.png`).
- **Well-designed apps:** Kahoot and Jackbox validate the room code first, inline under the field.
- **Severity:** annoying.
- **Fix:** Check the code first and show an inline error under the field. Keep what was typed. Open the trainer picker only for a valid bus.

### 6. "Watch" and "Watch party" mean different things
- **Screen:** Ride tab.
- **Saw:** "📺 Watch" next to Join (spectate a bus) and the "📺 Watch party" card (sync a YouTube video) use the same icon and almost the same word (`10-home-full-1280.png`).
- **Well-designed apps:** Twitch and Rocket League say "Spectate".
- **Severity:** annoying.
- **Fix:** Rename the button to "Spectate" (👀) and keep 📺 for Watch Party.

### 7. Settings is in two places, and FTP is a few taps deep
- **Screen:** avatar menu, Rider tab.
- **Saw:** The avatar menu has "Rider profile", "Settings", "Change my password" and "Log out". The Rider tab has its own "Settings" sub-tab (`13-avatar-menu.png`). Changing FTP takes avatar → Settings → field, or Rider → Settings → field. The header shows "FTP 200 W" but it can't be tapped.
- **Well-designed apps:** TrainerRoad and Zwift show FTP in the profile header and let you tap it to edit.
- **Severity:** annoying.
- **Fix:** Make "FTP 200 W" in the Rider header (and in the lobby seat) a link to the FTP field. Keep one Settings and have both entries open the same screen. Move "Change my password" into Settings.

### 8. Tab names are insider words: Ladder, Rider, scrap, tier
- **Screen:** top nav, header, Rider header.
- **Saw:** "Ladder" (a season leaderboard for Zombie Bus only), "Rider" (your profile), "⚙ 0 scrap" in the header, and "hard tier" under your name (`12-tab-Ladder.png`, `14-rider-Settings.png`).
- **Well-designed apps:** Duolingo uses "Leaderboards"; Strava uses "You"; most games call cosmetics currency "Coins" with a tooltip.
- **Severity:** annoying.
- **Fix:** Rename to "Crew" (or "Leaderboards") and "Me". Make the scrap chip open a one-line tooltip ("Earn scrap on crew rides, spend it in the Garage"). Show "Effort: Hard" instead of "hard tier".

### 9. Leaderboards are in three places
- **Screen:** Ladder, Rider → Passport, Free ride.
- **Saw:** Season ladder on Ladder, "🏆 Crew leaderboards" by route under Rider → Passport, and "🏆 Leaderboards" again in Free ride (`14-rider-Passport.png`, `32-free.png`).
- **Well-designed apps:** Strava gathers segments and clubs under one leaderboard entry point.
- **Severity:** annoying.
- **Fix:** Make the Ladder/Crew tab hold all leaderboards (Season · Routes · Weekly climb). Passport and Free ride link into it.

### 10. In-ride controls are tiny on touch screens
- **Screen:** ride HUD.
- **Saw:** The only menu is a "☰" button 36×29 px bottom-left. "Stats" is 58×29 and the intensity −/+ are 35×30 (`53-solo-riding.png`). The iPad on the bars is the main use case.
- **Well-designed apps:** Apple's guideline and Peloton's ride screen use targets of at least 44 px; Zwift's in-ride menu buttons are large.
- **Severity:** annoying.
- **Fix:** Make all HUD buttons at least 44×44 and label the menu "☰ Menu". Add a visible "End" (or ⏸) button so ending a ride doesn't depend on the Esc key or the hamburger.

### 11. The simulator's keyboard help shows on phone and touch
- **Screen:** trainer picker on phone and iPad.
- **Saw:** "↑↓ free-ride watts, ←→ cadence, [ ] ERG effort, S sprint, A easy" on a 390 px phone with no keyboard (`43-phone-trainer-modal.png`).
- **Well-designed apps:** Games swap the prompts to match the input device (Rocket League, Fortnite).
- **Severity:** annoying (for testing friends on phones).
- **Fix:** On touch devices hide the key list and show "On-screen controls appear in the ride". Add on-screen sim buttons if they don't exist.

### 12. The trainer connection doesn't survive a reload, and the pill doesn't say what to do
- **Screen:** header pill.
- **Saw:** After a reload the pill goes back to red "No trainer" (`11-returning-home.png`). The picker reappears at every ride start. That is reasonable for Bluetooth, but the simulator choice could be remembered.
- **Well-designed apps:** Zwift remembers paired devices and reconnects in one tap ("Last used: KICKR").
- **Severity:** polish.
- **Fix:** Remember the last trainer type. Show the pill as "Reconnect KICKR" or "Use simulator again" so it's a one-tap reconnect.

### 13. Placeholder text is clipped in the display font
- **Screen:** Rider → Settings.
- **Saw:** The Weight, Max HR and Resting HR inputs show "OPTI(" because the word "OPTIONAL" in the chunky display font is cut off by the field width (`14-rider-Settings.png`).
- **Well-designed apps:** Placeholders use body font at a muted weight.
- **Severity:** polish (looks broken).
- **Fix:** Use the body font for placeholders, or use "—" with "Optional" in the helper text.

### 14. The welcome tour is a one-shot with no Back, and step 2 is a wall of text
- **Screen:** welcome dialog.
- **Saw:** Three steps with dots but no Back button. Step 2 is three dense paragraphs on ERG, compliance and tiers (`06-onboard-2.png`). Reloading mid-tour skips the rest for good, and nothing in the app replays it.
- **Well-designed apps:** Duolingo's onboarding uses one idea per screen with a picture. Apple Fitness+ lets you revisit tips from settings.
- **Severity:** polish.
- **Fix:** Add Back. Split step 2 into short cards with an icon each ("The trainer holds the watts", "You're scored on hitting *your* target", "Pick Hard / Medium / Easy"). Add "Show the welcome again" to Settings or Help.

### 15. The welcome tour says to pick the simulator but has no button for it
- **Screen:** welcome step 3.
- **Saw:** "No trainer handy? Pick the simulated one", but the only button is "Connect trainer" (`07-onboard-3.png`).
- **Well-designed apps:** Offer both buttons where the choice is described.
- **Severity:** polish.
- **Fix:** Add a secondary "Use simulator" button beside "Connect trainer".

### 16. The login form gives no hint when nobody is picked
- **Screen:** login.
- **Saw:** The password field and "Get on the bus" are shown before a rider is picked. Pressing the button does nothing, with no message (`02-login-empty-submit.png`). The wrong-password error sits below the fold at 720 px high (`04-login-wrong.png`).
- **Well-designed apps:** Netflix and Disney+ profile pickers show a PIN entry only after a profile is chosen.
- **Severity:** polish.
- **Fix:** Hide or disable the form until a rider is picked. Then show it in place (or in a small sheet) with the error next to the field.

### 17. Two riders share an avatar, and two share a colour
- **Screen:** login, seats.
- **Saw:** Alex and Ali both show "AL". Kat and Steve are both green (`01-login-1280.png`).
- **Well-designed apps:** Avatars are told apart by colour and initials (Slack uses distinct colours and two-letter initials).
- **Severity:** polish.
- **Fix:** Use first and last letter or a custom tag ("AX" and "AI"). Give everyone a unique colour, or show the Body-tab avatar head.

### 18. The returning rider's home looks exactly like day one
- **Screen:** Ride tab after rides.
- **Saw:** After a ride, home shows the same empty "No buses on the road yet" panel. There's no last ride, no streak, no crew activity and nothing about who's online (`34-home-with-plan.png`).
- **Well-designed apps:** Strava's feed and Zwift's home ("Your friends are riding") make coming back feel alive; Duolingo shows your streak up front.
- **Severity:** polish.
- **Fix:** Add a slim strip under Today's workout: "Last ride: Sweet Spot 2×15, 98 %" (links to it) · "🔥 1-week streak" · "Kat was on 2 h ago". In the empty buses state, add a "Ping the crew" share button.

### 19. Today's workout has no "do something else" path
- **Screen:** Today's workout card.
- **Saw:** The card offers "Calendar" and "Start" (`34-home-with-plan.png`). There's no "Ride it with the crew" even though the Zombie fit plan prescribes bus rides. TSS is unexplained.
- **Well-designed apps:** TrainerRoad offers "Ride now / Alternates / Move". Zwift lets you take a plan workout into a group.
- **Severity:** polish.
- **Fix:** Add a secondary "Start as a bus" that opens a lobby with that workout chosen. Replace "15 TSS" with "Easy · 15 load", or give it a tooltip.

### 20. Empty states have no action button
- **Screen:** Ladder, Rider overview, History.
- **Saw:** "No bus runs this season yet. Finish a Zombie Bus ride and it lands here." and "No rides yet." give no button (`12-tab-Ladder.png`, `12-tab-Rider.png`).
- **Well-designed apps:** Duolingo and Strava empty states always carry a CTA ("Start a lesson", "Record an activity").
- **Severity:** polish.
- **Fix:** Add "Start a bus" or "Ride now" buttons to each empty state.

### 21. On phone the Rider sub-tabs scroll sideways and hide Settings
- **Screen:** Rider on phone.
- **Saw:** Seven sub-tabs. "Passport", "Body" and "Settings" are off-screen with no scroll hint (`42-phone-rider.png`).
- **Well-designed apps:** Strava's "You" uses two or three tabs plus a settings cog in the header.
- **Severity:** polish.
- **Fix:** Cut to four tabs (Overview, History, Stats [Power + Trends], Avatar). Move Passport to Crew/Free ride and Settings to a cog in the header. Add an edge fade where tabs overflow.

### 22. Phone navigation sits at the top
- **Screen:** phone layout.
- **Saw:** The four main tabs are a second row under the header (`41-phone-home.png`). Thumbs reach the top of the screen least easily.
- **Well-designed apps:** Strava, Zwift Companion, Duolingo and Peloton use a bottom tab bar on phones.
- **Severity:** polish.
- **Fix:** Below about 600 px wide, move the four tabs to a fixed bottom bar with icons.

### 23. Lobby settings are hard to read and look tappable for passengers
- **Screen:** bus lobby (passenger view).
- **Saw:** The descriptions beside Horde and Trainers ("The horde keeps coming…") are pale yellow-grey on yellow and nearly unreadable. Passengers see the same segmented controls, plus a ghost label repeating the value ("Normal", "Each rider") (`25-kat-lobby.png`).
- **Well-designed apps:** Game lobbies show non-host settings as plain read-only text ("Host is choosing…").
- **Severity:** polish.
- **Fix:** Use dark text on yellow. For passengers, replace the controls with "Horde: Normal · Trainers: each rider (Steve picks)".

### 24. Game cards are paragraphs
- **Screen:** bus lobby game grid.
- **Saw:** Each game tile carries 40–60 words in about 11 px type ("Kidney Stone Express: Crew an ambulance across South East Queensland. Five patients…") (`21-newbus-after-sim.png`).
- **Well-designed apps:** Mario Kart and Fortnite mode tiles show a name, art and a one-line hook, with details on select.
- **Severity:** polish.
- **Fix:** Keep one line per tile ("Ambulance run, smooth power wins"). Show the full rules in a panel when the tile is selected.

### 25. The Garage is one long wall, with no preview and no tabs
- **Screen:** Garage.
- **Saw:** Over 60 items in one 3,000 px scroll. Hats and outfits are flat colour swatches, and every locked item has a yellow "Need 60 more" bar that looks like a button. Nothing shows what you're wearing now, and there's no 3D preview (`12-tab-Garage.png`).
- **Well-designed apps:** Fortnite's Locker and Rocket League's Garage use category tabs on the left, a live model preview and an "Equipped" mark.
- **Severity:** polish.
- **Fix:** Add category tabs (Bus · Rider · Bike), a sticky 3D preview of your rider and bus (the Body tab already has one), and an "Equipped" badge. Make locked prices plain grey text, not button-shaped.

### 26. A very short ride says "will be saved" and then isn't
- **Screen:** End ride dialog, History.
- **Saw:** A 0:19 solo ride ended with "Your ride so far will be saved." and showed a full summary, but it never appeared in History. A 1:22 ride did (`58-history.png`).
- **Well-designed apps:** Zwift says "This ride is too short to save" before you confirm.
- **Severity:** polish.
- **Fix:** If there's a minimum length, say so in the dialog ("Rides under a minute aren't saved") and on the summary.

### 27. Small naming inconsistencies
- **Screen:** various.
- **Saw:** "Sweet Spot 2×15" on the summary but "2x15" in History. The ride menu's tier dropdown is lower case ("hard") while everywhere else uses "Hard". It is called "tier" in places and "effort" in others (`55-ride-menu.png`).
- **Severity:** polish.
- **Fix:** Use one word ("Effort") with consistent capitals, and normalise workout names.

## Task tap counts (from the Ride tab, trainer not yet paired)

| Task | Taps | Notes |
|---|---|---|
| Start a group ride with friends | 3 (Start a new bus → Use simulator → Copy invite) + Start | Fast. The game choice isn't advertised (finding 1). |
| Join Kat's bus (listed) | 2 (Join → trainer) | Good. Joining by code: type + 2 taps, but an invalid code still makes you pair first (finding 5). |
| Do today's workout | 2–3 (Start → trainer → Start) | Excellent placement at the top. |
| Change my FTP | 3 (avatar → Settings → field) | Fine, but FTP isn't tappable where it's shown (finding 7). |
| Find my last ride | 3 (Rider → History → row) | No "last ride" on home (finding 18). |
| Connect my trainer | 2 (pill → Connect/Use simulator) | Good, but forgotten after a reload (finding 12). |

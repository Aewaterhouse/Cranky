# UI review: the rider's own area

Reviewer: an independent agent who had not seen the app before. Build reviewed on 14 Nov 2026 with a fresh database and the simulated trainer. Viewports: 1280×720, iPad 1024×768 and phone 390×844. Covered: Rider (Overview, Power, Trends, History, Passport, Body, Settings), Garage, Season Ladder, crew power leaderboard, route leaderboards, Strava card. I checked the empty states first, then did two sped-up solo rides as Alex and one as Luke. Scrap was set to 500 directly in the test database so I could test buying. Screenshots are in the session scratchpad under `review-rider/` and are cited by file name below (`e-` = empty state, `d-` = after rides, `g`/`g2-` = Garage, `b-` = body creator, `s-` = settings, `i-` = iPad, `p-` = phone).

## Verdict

The rider's area has a lot in it, and most of it is good. Settings puts FTP, weight, the default tier, heart rate and editable zone bounds on one screen, with W/kg and the watts for each zone updating as you type. That makes changing FTP a two-tap job, quicker than in TrainerRoad or Zwift. The body creator is the best part. The Body/Skin/Hair/Face/Fun tabs, joke slider ends ("T-rex ↔ Orangutan", "Flat ↔ Keg"), one-tap presets like "The Dazza" and "Nan", the dice, Undo, and a camera that zooms in on the head for the Hair tab all feel like the Sims or Mii Maker. Trends (CTL/ATL/TSB, weekly TSS, a ride-day heatmap), the power best timeline and the Passport map show real ambition. The Australian badge names ("Barbie Banisher", "Croc Snap") give it personality. Empty states are friendly and say what to do next.

Trust and feedback are the main problems. The power curve mixes real bests with FTP estimates, so it climbs from 192 W at 30 s to 345 W at 1 min, which is impossible and makes the most important chart look broken. Several actions cost something but give no confirmation or undo. Buy is instant and equips straight away, so a double tap buys an item and then takes it off. FTP saves on blur, so a typo (2000) is quietly clamped to 600 W and written to FTP history. Unsaved body changes are dropped without a prompt when you switch tabs. The Garage is one long wall of 45 cards with no category tabs, no large preview and no try-on. Bike paints show the rider's head and shoulders, not the bike. Elsewhere it is a list of smaller issues: estimated values that look like real ones, a crew comparison line drawn in the same yellow as your own, a phone Settings page that is wider than the screen, small slider thumbs, and jargon (tier, CTL/ATL/TSB, scrap). None of it blocks riding, but it decides whether a rider trusts the numbers and enjoys the shop.

## Findings (most severe first)

### 1. Power curve and Best efforts mix real bests with FTP estimates, so the curve goes uphill
- **Screen:** Rider › Power.
- **Saw:** After two short rides, real bests run 211 W (1 s) down to 192 W (30 s). Then a dashed estimate jumps to 345 W at 1 min and falls to 230 W at 1 h (`d-power.png`, `p-power.png`). In the Best efforts table the estimated rows are just greyer text, so "1 min 345 W 4.4" reads as a real record. On a fresh account the table shows "1 s 800 W" for a rider who has never ridden (`e-rider-power.png`).
- **Better:** Intervals.icu and WKO plot only real data and put a modelled curve on a separate, labelled toggle. Strava's power curve never invents points.
- **Severity:** blocker (it breaks trust in the main stats chart).
- **Fix:** Make the estimate never higher than any real best at a shorter duration. Simpler still, hide the estimate once any real data exists. In the table, show estimates as "~345 W (est.)" in italics, or "–". Add an "Estimated from FTP" toggle that is off by default.

### 2. A double tap on Buy buys the item and then takes it off; there is no confirmation
- **Screen:** Garage.
- **Saw:** Clicking Buy on Servo Cap spent 40 scrap and equipped it at once, and the button turned into "Take off" in the same spot (`g2-after-buy-click.png`). A second click took it straight off (`g2-after-2nd-click.png`). The same happened with the Fairy Floss bike paint, so I paid for both and ended up wearing neither (`g2-body-with-hat.png`). The only feedback is a small "Bought Servo Cap" toast.
- **Better:** In the Fortnite Item Shop and Rocket League you buy from a detail sheet with a "Purchase for X?" confirmation, then get a reveal and an "Equip now" option.
- **Severity:** blocker for a currency that is slow to earn.
- **Fix:** Open a detail sheet when a card is tapped: a big preview, the price and "Buy for ⚙ 40". After buying, show a short celebration with "Wear it" / "Later". Never put the opposite action under the button the player just pressed, or ignore clicks on it for about a second.

### 3. The Garage has no real preview and no try-on
- **Screen:** Garage.
- **Saw:** Tapping a card does nothing (`g-preview-click.png`). Thumbnails are about 175×95 px. You can't see an item on your own rider or bus, turn it, or compare it with what you're wearing. The Body tab preview doesn't show Garage items either.
- **Better:** The Fortnite locker and Rocket League garage show a big turntable preview of your own character or car with the item on before you buy. Zwift's Drop Shop shows the item on your avatar.
- **Severity:** annoying (the shop is the reason to earn scrap).
- **Fix:** Add a sticky 3D preview panel on the left of the Garage, reusing the body-creator viewer, and show the item on hover or tap. On phone, use a bottom sheet with the preview.

### 4. Bike paint thumbnails don't show the bike
- **Screen:** Garage › Bike.
- **Saw:** Fairy Floss, Murdered Out, Chrome Dome and Indoor Escapee all show the rider's head and blue jersey on a coloured background. The bike itself is out of frame (`g-preview-bike.png`). Outfits do the same, with only a sliver of jersey visible. On phone the bus thumbnails are cut off at the bottom (`p-garage.png`).
- **Better:** Mario Kart's kart builder frames each part on its own. Rocket League frames each item type in its own camera view.
- **Severity:** annoying.
- **Fix:** Set a camera for each slot: bike = side view of the bike, outfit = torso, hat = head, bus parts = three-quarter view of the bus. Use object-fit or a matching aspect ratio so phone thumbnails aren't cropped.

### 5. FTP saves on blur with no confirmation; typos are silently clamped and recorded in FTP history
- **Screen:** Rider › Settings.
- **Saw:** Typing 2000 and tabbing away set FTP to 600 W with no message. The header changed to "FTP 600 W · 7.69 W/kg" (`s-ftp-2000.png`). That 600 W stayed in FTP history (230 → 600 → 230 within four seconds). Any ERG ride started then would target 600 W-based watts. There is no "Saved" tick on any field.
- **Better:** In TrainerRoad and Zwift, an FTP change is an explicit "Update FTP" step with old → new shown. Garmin Connect asks before changing thresholds.
- **Severity:** annoying (it affects safety and the data).
- **Fix:** Check the value as it's typed (for example 50–600 W). Show an inline error instead of clamping. Show "Saved ✓" beside the field. Only record a history point if the value stays for a minute or more, or when the rider presses Enter or a "Set FTP" button. Changes over ±15% should ask to confirm.

### 6. Leaving the Body tab discards unsaved changes without warning
- **Screen:** Rider › Body.
- **Saw:** I picked Mohawk (`p-body-hair.png`), switched to Overview and came back, and the hair was Short again ("hair after leave: Short"). The same happened with an unsaved dice roll when the page closed (`b-dice2.png` showed "Save" lit up). Settings saves automatically, but Body needs an explicit Save, so the two tabs side by side behave differently.
- **Better:** The Sims and Animal Crossing either save automatically or ask "Leave without saving?". Most apps choose one pattern and use it everywhere.
- **Severity:** annoying.
- **Fix:** Save body changes automatically after a short pause, as Settings does, and keep Undo. Or at least ask before switching tabs with unsaved changes.

### 7. The crew comparison line is the same yellow as your own All-time line
- **Screen:** Rider › Power, "Luke" chip.
- **Saw:** Turning on Luke draws his curve in the same yellow as "All time" (`x-power-luke.png`). The legend doesn't name Luke, and nothing explains what the lone "Luke" chip is for (`d-power.png`).
- **Better:** Strava and Intervals.icu comparisons give each athlete their own colour and a legend entry with their name or avatar.
- **Severity:** annoying.
- **Fix:** Label the chips row "Compare with:", add a chip for every crew mate, give each a distinct colour that isn't yellow, green or blue, and add each one to the legend.

### 8. The Garage is a single 3,300 px wall with no categories, filters or sort
- **Screen:** Garage (`e-garage.png`; on phone, one card per row in `p-garage.png`, roughly 40 screens long).
- **Saw:** Six categories stacked in one list. You can't jump to Hats, show only what you can afford or what you own, or sort by price. Owned items look almost the same as unowned ones until equipped.
- **Better:** The Fortnite locker has a slot row (Outfit, Back bling, Pickaxe…). Rocket League's garage has category tabs and an "owned" filter.
- **Severity:** annoying.
- **Fix:** Add sticky category tabs (Bus · Rider · Bike, or the six slots) and filter chips (Can afford · Owned). Use two columns on phone.

### 9. Phone Settings is wider than the screen
- **Screen:** Rider › Settings at 390 px.
- **Saw:** The FTP, Weight and Default tier cards run past the right edge, and the Hard/Medium/Easy control is cut off (`p-settings.png`).
- **Better:** Apple Fitness and Garmin Connect settings are single-column lists that fit the screen width.
- **Severity:** annoying.
- **Fix:** Find the element that won't shrink (probably the input plus unit row, or the zones table in the second column) and give the grid `min-width: 0` and the inputs `max-width: 100%`. Test at 360 px.

### 10. Placeholder text "OPTIONAL" is cut off and drawn in the display font
- **Screen:** Rider › Settings, Weight and Heart rate fields.
- **Saw:** Empty fields show "OPTI(" in the chunky display face (`e-rider-settings.png`). It looks like a rendering bug.
- **Better:** Garmin Connect uses a neutral "Add weight" or "–" placeholder in body text.
- **Severity:** annoying (it looks broken on first visit).
- **Fix:** Use the body font for placeholders and a short placeholder such as "–" or "kg". Keep "Optional" in the help text underneath, where it already appears.

### 11. Recent rides can't be opened from Overview, and the rows don't name the ride
- **Screen:** Rider › Overview.
- **Saw:** The Recent rides table shows Date/Time/kJ/5 s/1 min/20 min with no workout name, and clicking a row does nothing (`d-overview.png`). History works and opens a detail view (`d-history-entry.png`), but the detail view has no URL of its own (still `#rider`).
- **Better:** Strava's profile feed and Garmin's "Recent activities" are tappable cards with the activity name.
- **Severity:** annoying.
- **Fix:** Show the workout name as the first column, make each row open the ride detail, and give the detail a hash such as `#rider/ride/3`.

### 12. Hair choices are hidden under the helmet, which is on by default
- **Screen:** Rider › Body › Hair.
- **Saw:** With "Helmet on" ticked, most hairstyles (Short, Afro, Man bun…) are hidden or only poke out at the edges (`b-hair.png`, `p-body-hair.png`). You can't see what you're picking.
- **Better:** Fortnite and Mii Maker hide headgear while you edit hair, then put it back.
- **Severity:** annoying.
- **Fix:** Take the helmet off automatically while the Hair or Face tab is open, and put it back when you leave.

### 13. Locked badges give no progress
- **Screen:** Rider › Overview and Passport, Badges.
- **Saw:** "Badges (1 of 23)". Every locked badge is the same grey coin with its description, with no "3 of 10 rides" or progress bar (`d-overview.png`). Ten Passport badges also appear twice, on Overview and on Passport.
- **Better:** Apple Fitness awards show progress rings toward each award. Zwift and TrainerRoad show "x/y" toward each achievement.
- **Severity:** polish.
- **Fix:** Add a small progress bar or "2/10" to each counter badge. Sort nearly-earned badges first. Show Passport badges only on Passport, with an "All badges" link from Overview.

### 14. The profile header uses an initials circle when the app has a 3D rider
- **Screen:** Rider header and top-bar avatar.
- **Saw:** "AL" in a blue circle everywhere (`d-overview.png`), even though the rider has a fully built 3D body with a Garage cap.
- **Better:** In Zwift, Fortnite and Rocket League your own avatar is your identity across menus.
- **Severity:** polish (a missed chance for a game with this much character work).
- **Fix:** Render a head-and-shoulders portrait from the body viewer, cache it as a PNG, and use it for the profile and top-bar avatar.

### 15. Jargon: "hard tier", "scrap", CTL/ATL/TSB, NP, IF, TSS
- **Screen:** Rider header ("FTP 230 W · hard tier"), Trends (`d-trends.png`), History.
- **Saw:** "hard tier" in the header means nothing until you find "Default tier" in Settings. Trends opens with "0 fitness (CTL) · 0 fatigue (ATL) · 0 form (TSB)". History columns are NP/TSS/Compl.
- **Better:** TrainerRoad and Apple Fitness lead with plain words ("Fitness", "Freshness") and keep the acronyms in an info popover. Garmin explains each metric with an ⓘ.
- **Severity:** polish.
- **Fix:** Rename "tier" to "Effort: Hard", which matches the Solo screen's "EFFORT" label. Lead with "Fitness / Fatigue / Form" and keep the acronyms in a tooltip. Add ⓘ popovers for NP, TSS and compliance.

### 16. Trends looks empty after a few rides, and the 0 values don't say why
- **Screen:** Rider › Trends.
- **Saw:** After two rides: three big zeros, a 90-day chart with one flat line along the axis and a tiny pink tick, and a weekly TSS chart of flat stubs (`d-trends.png`). Overview says "0 hours" for two rides.
- **Better:** Strava shows "Not enough data yet: ride 3 more times" until a chart means something. Apple Fitness rounds small totals to minutes.
- **Severity:** polish.
- **Fix:** Show the CTL chart after about 7 days of data, with a progress message until then. Show one decimal for small values. Show "1 min" instead of "0 hours" when the total is under an hour.

### 17. The crew power leaderboard looks unfinished
- **Screen:** Rider › Power › Crew leaderboard.
- **Saw:** The duration chips wrap ("5 s · 1 min · 5 min" on one line, "20 min" on the next) (`e-rider-power.png`). Columns are spread across the card, with the name in the middle and W/kg far right in tiny text. Luke has no W/kg and no hint why (`d-power.png`).
- **Better:** Zwift's power leaderboards and Strava segment boards are tight rows: rank, avatar, name, value, with the rider's own row highlighted.
- **Severity:** polish.
- **Fix:** Keep the duration chips on one line and drop the box around them. Use a three-column grid (rank · name · value) with W/kg under the watts in small text. Show "add weight" in grey for riders without one.

### 18. Strava card only says "isn't set up on this server yet"
- **Screen:** Rider › Settings › Strava (`e-rider-settings.png`).
- **Saw:** Reads like admin text. The rider can't do anything about it and doesn't know who can.
- **Better:** Apps hide an integration that isn't available, or show a disabled "Connect with Strava" button with "Ask Alex (admin) to switch this on".
- **Severity:** polish.
- **Fix:** For non-admins, hide the card or say "Strava upload is coming once the admin adds the key". For admins, link to the admin page.

### 19. Body sliders and colour swatches are small for touch
- **Screen:** Rider › Body on iPad and phone.
- **Saw:** Slider thumbs are about 16 px and the track is thin (`i-body.png`). The hair colour swatches are about 36 px.
- **Better:** Apple's guidance is 44 pt touch targets. Mii Maker and Animal Crossing use big chunky sliders and swatches.
- **Severity:** polish.
- **Fix:** Use a 28 px thumb with a 44 px hit area on `pointer: coarse` devices, and swatches of 44 px or more.

### 20. On phone, the body preview scrolls away while you edit
- **Screen:** Rider › Body at 390 px.
- **Saw:** The preview takes the whole first screen. The controls start below it, so you can't see the rider while moving a slider (`p-body-hair.png`).
- **Better:** Mobile character creators (Bitmoji, Mii) keep the character in the top half and scroll only the controls in the bottom half.
- **Severity:** polish.
- **Fix:** On narrow screens, make the preview sticky at about 40vh and scroll only the controls under it.

### 21. Two dice buttons in the creator
- **Screen:** Rider › Body › Fun.
- **Saw:** "🎲 Randomise" in the Fun tab and a 🎲 icon in the footer next to Save do the same thing (`b-fun.png`).
- **Severity:** polish.
- **Fix:** Keep the footer dice on every tab and drop the one in the Fun tab, or the other way round.

### 22. FTP history chart is mostly empty and can't be used to undo a change
- **Screen:** Rider › Settings › FTP history.
- **Saw:** One flat line with axis labels 190/200/210, then spikes from accidental edits (finding 5). You can't remove a point or revert to an earlier value.
- **Better:** TrainerRoad's career page lists FTP changes with date and source (test, manual, AI) and lets you delete them.
- **Severity:** polish.
- **Fix:** Show a short list under the chart ("14 Nov · 230 W · manual") with a ✕ to delete each entry.

### 23. The weekly climb progress bar is invisible at 0
- **Screen:** Rider › Passport › This week.
- **Saw:** "0 of 600 m" sits over a bar track that is almost the same colour as the card (`e-rider-passport.png`, `p-passport.png`).
- **Better:** Apple's activity rings show a faint full ring even at 0.
- **Severity:** polish.
- **Fix:** Make the track lighter and give the bar a 2–4% minimum width so its shape is visible.

### 24. Brisbane route pins overlap on the Passport map
- **Screen:** Rider › Passport map.
- **Saw:** Routes 11–16 sit on top of each other near Brisbane and can't be told apart or tapped (`e-rider-passport.png`).
- **Better:** Strava and Komoot cluster nearby pins into a count bubble and zoom in on tap.
- **Severity:** polish.
- **Fix:** Put a "6" cluster pin on Brisbane that expands into a small inset map or a list when tapped.

### 25. Rarity is easy to miss and price doesn't always follow rarity
- **Screen:** Garage.
- **Saw:** Rarity is a tiny pill plus a faint card border (`e-garage.png`). Some Rare items cost more than Epic ones in the same slot, for example the Shark Fin hat (Rare, 240) against the Stolen Traffic Cone (Epic, 320) and the Akubra (Rare, 100).
- **Better:** Fortnite and Rocket League colour the whole card background by rarity, so you can tell rarity at a glance.
- **Severity:** polish.
- **Fix:** Tint the card background or the bottom strip by rarity, and sort each slot by rarity, then price.

### 26. "Earned on crew rides" is the only explanation of scrap; solo rides earn none
- **Screen:** Garage header (`e-garage.png`), every "Need 60 more" button.
- **Saw:** At 0 scrap every card has a disabled "Need N more" button. Nothing says how much a typical ride earns or links to start one. My solo rides earned 0 scrap and nothing said so.
- **Better:** Zwift shows Drops earned per ride in the results and a "how to earn" link in the Drop Shop.
- **Severity:** polish.
- **Fix:** Add a line like "A typical bus ride earns about 40–80 scrap" and a "Start a bus" button to the scrap card. Say "Solo rides don't earn scrap" on the solo results.

# UI review: the riding screens

Reviewer: independent agent, playing the app as a rider (simulated trainer, bots, `?fast=20`, server `ZB_TIME_SCALE=10`). Screenshots are in `/tmp/claude-1000/-home-alex-projects-cranky/b534b2ab-7915-448b-aa5d-39e265fcc440/scratchpad/review-riding/` (scratch, not committed). Dev-page shots (`dev-*.png`) were taken on a shared vite server and use fallback fonts, so judge their layout, not their type.

## Overall verdict

On a laptop or TV at 1280×720 the core of every riding screen works. Each mode has a clear top-left power card with a coloured band bar and a plain "push 23 W / ease 22 W / on target" cue. A top-centre card gives the interval name, a big countdown and a "Next: Servo stop · 80 W in 4:34" line. That is close to the TrainerRoad/Zwift workout pattern and you can read it at threshold. The solo player is the cleanest screen in the app: a big interval timer, a ±60 s chart, the interval list with ✓/✗ results, a whole-ride profile and a proper "End ride?" confirmation. The game modes have lots of character, and the "Next: …" line is something many apps get wrong.

Problems start when anything else happens on screen. The game layers (splash words, challenge banners, toasts, the servo shop, cinematic letterboxing, camera cuts) have no priority system. They stack on top of each other and on top of the workout, sometimes three at once, and the camera sometimes points at the sky or loses the bus. The four modes also disagree on the basics: which number is big (target or power), where toasts go, what the menu holds, what Escape does and whether there is a profile at the bottom. iPad needs care and phone portrait is broken for structured workouts. Pick one HUD grammar, give game events a queue and a quiet zone, and make the workout card immune to overlays. That would move the app from "fun prototype" to something that feels like MyWhoosh or Zwift with jokes.

## Findings (most severe first)

### 1. Solo workout on a phone: the HUD collapses into itself
- **Screen:** solo workout, 390×844.
- **What I saw:** the interval timer card sits on top of the target card, so the target watts are hidden behind "13:00" and only the "1" of 180 shows. The chart shrinks to a 1 px vertical line. The "Intensity − 100 +" control runs off the right edge (`phone-solo-mid.png`).
- **Better:** TrainerRoad's phone layout stacks target, power and time in a single column and drops the chart to a thin strip. Free ride already shows "Turn the phone sideways" (`phone-free-climb.png`).
- **Severity:** blocker (on phones).
- **Fix:** below about 600 px wide, stack the target card and the timer card vertically, hide the ±60 s chart and keep only the bottom profile. Show the same "turn sideways" hint that free ride uses. Wrap or shrink the intensity control.

### 2. Game event banners, splash words and toasts pile up over the workout
- **Screen:** Zombie Bus crew ride.
- **What I saw:**
  - On iPad, "BLUEY FELL OFF!", the red "⚠ Bluey is off the bus" bar, "HOLD IT!" and "SUPPLY DROP" all render on top of each other in the centre. None of them can be read (`dipad-t30.png`).
  - At 1280, "YOUR CHALLENGE!" and "AIR STRIKE" overlap, and the challenge instruction ("spin it up! 105+ rpm for 20 s") is struck through by the second splash (`k-stats.png`).
  - "YOUR CHALLENGE!" also covers the top third of the screen (`d-t20.png`).
- **Better:** Mario Kart and Rocket League queue their announcements. Only one centre-screen callout shows at a time. Lower-priority events go to a feed and never overlap the callout.
- **Severity:** blocker. This is the instruction you are meant to act on, and you can't read it.
- **Fix:** put a single queue in front of the centre banner area. Show "you" events (fell off, your challenge) first, team events (air strike, supply drop) second, with a minimum hold of about 1.5 s each. Use a feed for the rest. Keep the challenge instruction in a fixed slot under the workout card so it never shares space with splash words.

### 3. The camera points at the sky or loses the bus
- **Screen:** Zombie Bus.
- **What I saw:**
  - During a challenge or supply drop the camera points at a pink sky with a floating crate, and neither the bus nor the riders are visible (`d-t20.png`, `dipad-t30.png`).
  - Later views show an empty road with a black box and no bus (`k-menu.png`, `k-stats.png`).
  - At the start of free ride the camera sits inside dark geometry with a giant "FINISH" banner overhead (`i-free-t8.png`).
- **Better:** Zwift's cinematic cuts always frame your avatar. Forza's photo-style cuts last under 3 s and return to the chase cam.
- **Severity:** blocker. It looks broken and removes the feedback that you are part of the crew.
- **Fix:** cap cinematic cuts at about 3 s, always keep the bus in the frustum (aim at it, then offset), and fall back to the chase cam when the target object is off-route. In free ride, start the camera behind the rider rather than inside the start arch.

### 4. Target and power swap places between solo and crew modes
- **Screen:** solo workout and all crew modes.
- **What I saw:**
  - Solo shows **TARGET 180 W** huge with "Power 179" small underneath (`a-solo-t20.png`).
  - Every crew game shows **POWER · 3 S 141 W** huge with "Target 141" small (`d-t45.png`, `e-t8.png`).
  - A rider moving from a solo session to a bus ride has to relearn where to look.
- **Better:** TrainerRoad always puts target and current power side by side at the same size, with the same position in every workout. Zwift keeps power in the same top-left spot in every mode.
- **Severity:** annoying.
- **Fix:** use one card layout everywhere. Either put target and power side by side at equal size (TrainerRoad), or make power big in every mode, with target in the band bar and as a label. Keep the existing push/ease cue.

### 5. ERG start-up lag throws you off the bus and marks the warm-up as failed
- **Screen:** Zombie Bus start, and the solo interval list.
- **What I saw:**
  - In ERG, with the simulator, the rider "fell off the bus! Dropped to easy" within about 6 s of the start, before the trainer had ramped. Everyone else got +5% (dump at t6, `d-t6.png`).
  - In solo, the warm-up row ends red "109 W ✗" and the recovery row "106 W ✗" even though ERG was in control the whole time (`a-solo-t62.png`, `a-solo-t75.png`).
  - The bus lobby showed "Kat HARD" but the ride then ran at easy.
- **Better:** Zwift and TrainerRoad give a grace window after each target change, and TrainerRoad doesn't grade warm-ups or recoveries at all.
- **Severity:** annoying (it feels unfair on the first minute of every ride).
- **Fix:** use no fall-off or compliance scoring for the first 20–30 s of a ride and for about 10 s after each target step. Don't show ✗ on warm-up, recovery or cool-down rows. Grade them with a neutral tick or nothing.

### 6. The phone crew HUD overlaps itself
- **Screen:** Zombie Bus, 390×844.
- **What I saw:**
  - The timer card covers the power card, so only the target is visible.
  - The game panel runs off the right edge ("DIST 6.6" is cut).
  - The ☰/Stats/🎥 buttons sit on top of the game panel.
  - The toast overlaps the armour row (`dphone-t30.png`).
- **Better:** MyWhoosh's mobile layout keeps a fixed top bar and a single bottom sheet.
- **Severity:** annoying (phones are unlikely on the bike but likely for joiners and spectators).
- **Fix:** in portrait, put power/target and the timer into one top strip, collapse the game panel to a single row (armour, gap, scrap) that taps to expand, and hide the minimap.

### 7. The ride menu covers the target card
- **Screen:** solo workout and Zombie Bus, ☰ menu.
- **What I saw:**
  - Opening ☰ slides a panel over the top-left card, so target and power disappear while you change mode or tier (`b-solo-menu.png`, `ipad-solo-menu.png`, `k-menu.png`).
  - In the bus, Escape doesn't close the menu, and opening Stats then layers under it (`k-stats.png`).
- **Better:** Zwift's action bar and TrainerRoad's settings drawer open from the bottom or side and never cover current power and target.
- **Severity:** annoying.
- **Fix:** anchor the menu above the ☰ button, starting below the power card, or as a bottom sheet. Make Escape and a tap outside close it in every mode, and close any open menu before opening Stats.

### 8. ☰ menu contents and keyboard behaviour differ between modes
- **Screen:** all riding modes.
- **What I saw:**
  - Solo menu: Mode (ERG/Resistance/Slope), Tier, Pause, Skip interval, End ride (Esc), Stats, Intervals, Clean view, Media, Cadence line, HR line, Display size (`b-solo-menu.png`).
  - Bus menu: Tier, Stats, Crew, Clean view, "ERG: on", End ride (no Esc hint), Display size (`k-menu.png`).
  - Free ride menu: Trainer difficulty, Shift strength, Pause, End ride, Stats, Map, Riders, Clean view (`ipad-free-menu.png`).
  - Escape opens "End ride?" in solo but does nothing in the bus.
  - The Intensity ± control exists only in solo.
- **Better:** Apple Fitness+ and Peloton keep one in-workout control sheet with the same order everywhere, and hide items that don't apply instead of reshuffling.
- **Severity:** annoying.
- **Fix:** use one menu template: a top row of Pause, Skip, End; then a Trainer section (mode, intensity or difficulty); then a View section (stats, intervals or crew, clean view, size). Grey out what doesn't apply, and keep the same keyboard shortcuts in every mode.

### 9. Pause on a touch device says "Press Space to resume" and has no button
- **Screen:** solo workout paused (`j-paused.png`).
- **What I saw:** a big "PAUSED", the text "Press Space to resume. ERG is easing off." and no resume control on screen. On an iPad there is no Space key.
- **Better:** TrainerRoad and Zwift show a big Resume button plus End.
- **Severity:** annoying.
- **Fix:** add Resume and End buttons (at least 56 px tall) under "PAUSED". Change the hint to "Space or tap Resume", or drop it on touch devices.

### 10. Watch Party panels wash out over bright video
- **Screen:** Watch Party (`dev-watch-run-1280.png`).
- **What I saw:**
  - Over a light, pink and white video frame the translucent grey cards lose contrast.
  - "Run 1: Kidney Stone", "Next: Hospital ramping in 2:54" and the tiny W/kg and rpm labels are grey-on-pink.
  - The ✓ band bar goes pastel.
- **Better:** Netflix subtitles and Apple Fitness+ metrics both use a solid dark plate or a strong text shadow over video.
- **Severity:** annoying.
- **Fix:** in Watch Party, raise card opacity to about 85%, add a 1–2 px dark text shadow to all HUD text, and add a subtle top and bottom gradient scrim over the video.

### 11. The Watch Party remote is permanently open and its buttons are tiny
- **Screen:** Watch Party in a ride at 1280 (`h-ride-start.png`, `h-t30.png`).
- **What I saw:**
  - The panel (⏪ 30 s / Play / 30 s ⏩ / Next) has 67×22 px buttons, the reaction emoji are 34×27 px, and "Open all" is 101×25 px.
  - "Added." confirms the paste in about 7 px text under the input.
  - The remote, the paste box and the reactions stay open the whole ride, covering the left third of the video.
  - When YouTube failed ("could not play that video (error 5)", possibly a headless codec issue), the error appeared only in the dump, not visibly near the panel.
- **Better:** YouTube and Plex remotes auto-hide after a few seconds. Discord Watch Together collapses to a small pill.
- **Severity:** annoying.
- **Fix:** collapse the panel to a single "📺 Big Buck Bunny ▸" pill after 5 s idle and expand it on tap. Make all controls at least 44 px tall. Show errors and "Added" as a visible inline status line or toast.

### 12. Rider name tags stack on top of each other, hiding your own name
- **Screen:** all crew modes with avatars.
- **What I saw:**
  - "Kat" sits behind the Shazza and Bluey tags in every bus and ambulance shot (`d-t6.png`, `e-t8.png`).
  - In Speed Dating, "Alex / Mo / Kat" are three overlapped tags (`dev-date-wedding-1280.png`).
  - The heart-rate pills overlap the name tags.
- **Better:** Zwift de-clutters nameplates by distance, fades the rear ones and never covers your own rider.
- **Severity:** annoying.
- **Fix:** hide your own nameplate (you know who you are) or pin it below your avatar. Offset overlapping tags vertically, or show names only for the nearest two riders, with the others in the crew list.

### 13. Cinematic letterbox bars eat the HUD's space
- **Screen:** Zombie Bus during events (`d-t20.png`, `d-t45.png`, `k-menu.png`).
- **What I saw:**
  - Black bars appear top and bottom for long stretches.
  - The minimap is cut off by the top bar.
  - The timer card floats half on black.
  - The workout area shrinks while the HUD stays put.
- **Better:** Forza and Rocket League use letterboxing only in non-interactive replays, never while you drive.
- **Severity:** annoying.
- **Fix:** drop letterboxing during the ride, or limit it to about 2 s.

### 14. The servo shop modal opens over the workout during a short interval
- **Screen:** Zombie Bus servo stop on iPad (`dipad-t12.png`).
- **What I saw:**
  - "SERVO SHOP" covers the centre of the screen and half the game panel.
  - Its buttons say "tap to buy", which works on iPad but there's no keyboard hint at 1280.
  - The toast column on the left is cut off behind it ("Kat fell off the bus! Drop…").
- **Better:** Mario Kart item and Rocket League quick-chat menus are small radial or corner widgets that don't block the road.
- **Severity:** annoying.
- **Fix:** dock the shop as a strip above the game panel, using three chips with prices. Add number-key shortcuts (1/2/3), and auto-dismiss it when the interval ends.

### 15. Climate Lawsuit's panel grows over the ride controls
- **Screen:** Climate Lawsuit with a Heatwave event (`g-t100.png`).
- **What I saw:**
  - With the heatwave card and the seawall button the left panel grows past the bottom.
  - The ☰, Stats and 🎥 buttons now sit on top of the company list ("Coastal Shazza Utilities" is cut through).
  - A second toast fades out under the seawall sign.
- **Better:** Zwift's side panels scroll internally and have a fixed maximum height.
- **Severity:** annoying.
- **Fix:** cap the game panel at the space above the control row (`max-height` plus internal scroll). Show only the top 3 companies, with your own row always visible.

### 16. Toasts move around between modes
- **Screen:** all crew modes.
- **What I saw:**
  - The toasts sit bottom-left in Zombie Bus (`d-t6.png`), bottom-right in Kidney Stone, Speed Dating and Climate (`e-t70.png`, `f-t90.png`), and as a centre bar for "off the bus" warnings.
  - In Zombie Bus the bottom-left feed grows to four cards and covers the left of the road (`dipad-t30.png`).
- **Better:** Rocket League and Fortnite keep one feed location in every mode.
- **Severity:** polish.
- **Fix:** use one feed location (bottom-right, above the profile) with a maximum of two visible and the oldest fading. Use the centre slot only for queued callouts (see finding 2).

### 17. Crew modes show no total time remaining
- **Screen:** all crew modes.
- **What I saw:**
  - The timer card shows only the interval countdown. The bottom bar shows elapsed time "4:32" and the total "20:15", but not time left.
  - Solo shows "5:00 gone · 17:00 to go" (`a-solo-t20.png`).
  - Kidney Stone, Speed Dating and Climate have a plain grey progress bar with no workout profile at all (`e-t8.png`, `f-t10.png`), so you can't see the next hard bit coming.
- **Better:** Zwift and MyWhoosh always show the full workout profile with a playhead plus "time remaining".
- **Severity:** annoying.
- **Fix:** add "· 15:43 to go" to the timer card in every mode, and draw the interval profile in the bottom bar for the non-ERG games too (the Zombie Bus bar already does).

### 18. The zone and W/kg next to the target describe your power, not the target
- **Screen:** solo workout (`a-solo-t8.png`).
- **What I saw:** in the TARGET card, with "180 W" target, the right column reads "Z1 1.5 W/kg", which is current power (109 W), not the 180 W target. It reads as "target is zone 1".
- **Better:** TrainerRoad labels the target with "% FTP" and puts W/kg next to the number it belongs to.
- **Severity:** annoying.
- **Fix:** move zone and W/kg next to the "Power" line, or show the target's own "%FTP · Z3" beside the target.

### 19. Two target figures in the non-ERG games
- **Screen:** Kidney Stone, Speed Dating, Climate (`e-t70.png`, `f-t90.png`).
- **What I saw:** the card shows a yellow band "80–110 W" in the corner and "Target 95 W" below it. With a big "▼ ease 97 W" it's unclear whether you are aiming for the band or the number.
- **Better:** Zwift's free-ride workouts show a single target (with a tolerance bar).
- **Severity:** polish.
- **Fix:** when there is a band, show it as "Target 80–110 W" in the target slot, put the midpoint only on the band bar, and drop the corner label.

### 20. The free ride "START PEDALLING" splash runs off screen and fires while you are pedalling
- **Screen:** free ride start (`i-free-t25.png`).
- **What I saw:**
  - "ART PEDALLI" is cropped at both edges at 1280.
  - It shows while the power card reads 150 W at 90 rpm.
  - The speed card meanwhile reads "0.0 km/h · 0.00 km · 0:00 · +-0 m" (the "+-0 m" is a formatting bug).
- **Better:** Zwift's "Ride on" start uses a short countdown sized to the screen.
- **Severity:** annoying.
- **Fix:** size the splash with `clamp()` to fit the viewport and hide it once power is above about 30 W. Format zero elevation as "+0 m".

### 21. The route intro card blocks the first seconds of free ride
- **Screen:** free ride intro (`i-free-t8.png`).
- **What I saw:** a full-screen route card with "Any key or tap to skip" in about 11 px grey text. With a sim at 150 W you are already pedalling underneath it.
- **Better:** Rouvy and Zwift show the route title while the ride is already live, in a corner, and fade it away.
- **Severity:** polish.
- **Fix:** auto-dismiss after 4 s, or as soon as speed is above zero, and make the skip hint larger.

### 22. Touch targets on the ride control row are below 44 px on a touch laptop and desktop
- **Screen:** all modes at 1280.
- **What I saw:**
  - ☰ is 36×29 px, Stats 58×29, 🎥 41×29, "+1 min" 71×29 and Intensity −/+ 35×30.
  - The rider list "Open all" is 101×25.
  - The menu shortcuts are 132×31.
  - With touch enabled at iPad size they grow to 44 px, but a touchscreen laptop or a TV with a remote still gets the small ones.
  - The camera button is an unlabelled 🎥.
- **Better:** Apple HIG and Peloton use 44 pt minimum, with labels on in-ride controls.
- **Severity:** polish.
- **Fix:** set a 44 px minimum height regardless of pointer type, or use `@media (pointer: coarse)` as well as the width check. Add a "View" label or tooltip to 🎥.

### 23. Keyboard hints clutter the iPad menu
- **Screen:** ☰ menu on iPad (`ipad-solo-menu.png`, `ipad-free-menu.png`).
- **What I saw:** Space, Esc, N, S, I, H and M key-cap badges on every button on a device with no keyboard.
- **Better:** iPadOS apps show shortcuts only when a hardware keyboard is attached (holding ⌘).
- **Severity:** polish.
- **Fix:** hide the key-cap badges under `@media (hover: none)`.

### 24. The interval list overlaps the solo chart
- **Screen:** solo workout at 1280 and iPad (`a-solo-t20.png`, `ipad-solo-mid.png`).
- **What I saw:**
  - The interval list starts at x≈826 but the chart runs to x≈885, so the list covers the chart's last 10 s and the "FTP 200 W" label is pinched.
  - On iPad the target and timer cards touch with no gap.
  - The big area to the right under the list is empty.
- **Better:** TrainerRoad gives its chart the full width and puts the interval list in a fixed side column or under it.
- **Severity:** polish.
- **Fix:** end the chart where the list begins (or move the list into the empty space below it) and add a gutter between the top cards.

### 25. The solo start countdown is dim and stacks with the "Next" pill
- **Screen:** solo start and interval changes (`03-solo-ride-early.png`, `a-solo-t8.png`).
- **What I saw:**
  - The first "2" is a huge, low-contrast mustard number sitting inside the chart.
  - The 3-2-1 before each interval change appears directly under "Next: 15:00 at 180 W", so the two touch.
  - During the countdown the card already shows red "▼ ease 49 W" before the ride has started.
- **Better:** Zwift's interval warning is a single "Next: 180 W in 3…2…1" chip, and TrainerRoad beeps.
- **Severity:** polish.
- **Fix:** merge the countdown into the Next pill ("180 W in 3"), add an audio tick, and suppress push/ease cues until the first interval begins.

### 26. The Speed Dating panel is empty in the bar, and the chemistry meter has no legend
- **Screen:** Speed Dating (`f-t10.png`, `f-t90.png`).
- **What I saw:**
  - In "The Bar" phase the game panel is just a "SPEED DATING" header in an empty box.
  - During a date, the chemistry meter has a green window, a pink ▲ and a yellow ▼ with no label for which is you and which is your date.
  - The emoji row is about 30 px.
  - The timer card reads "Next: Next table in 0:20".
- **Better:** Mario Party mini-games show a one-line goal and "YOU / RIVAL" markers.
- **Severity:** polish.
- **Fix:** in the bar, show tonight's six dates or the pairing. Label the markers "you" and the date's name, enlarge the emoji to 44 px, and reword the line to "Next: change tables in 0:20".

### 27. The coloured game-panel tint hurts its own text
- **Screen:** Zombie Bus game panel during danger (`d-t20.png`, `d-t80.png`).
- **What I saw:** when the horde is close the whole bottom panel turns salmon-red. The white "SPEED / DIST / SCRAP" labels and the green "NEXT: AIR STRIKE" lose contrast, and the panel stays red for a long time.
- **Better:** Forza and Rocket League signal danger with a pulsing border or edge vignette, keeping the panel background constant.
- **Severity:** polish.
- **Fix:** keep the panel background dark and show danger as a red pulsing outline on the horde-gap meter plus a screen-edge vignette.

### 28. Text in the crew list and gear card is unreadable at riding distance
- **Screen:** all crew modes.
- **What I saw:**
  - The crew list puts tier letters, the ERG/⚙ badge and the %FTP in about 7–8 px text ("Kat · E · ERG · 22%") (`d-t6.png`).
  - The gear card's "trainer 2.0% · shift 150%" is about 7 px (`e-t8.png`).
  - Free ride's Leaflet attribution is about 7 px (`i-free-t25.png`).
- **Better:** Zwift's rider list uses about 14 px minimum on a 1080p screen.
- **Severity:** polish.
- **Fix:** set a 12 px minimum for any HUD text. Drop the tier letter and %FTP from the collapsed list (show them on "Open all"), and move the gear sub-line into the menu.

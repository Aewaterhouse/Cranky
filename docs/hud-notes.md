# In-ride HUD conventions: Zwift, TrainerRoad, MyWhoosh

Research notes for the Cranky HUD. Conventions only; we design our own look.
Confidence markers: **(confirmed)** = stated in a cited source; **(unconfirmed)** = inferred, remembered or not found. No pixel values are given for the commercial apps because none were published.

Research limits: web search only, no screenshots viewed. Zwift detail is good (official support page, Zwift Insider). TrainerRoad's indoor workout display is documented; its layout positions are thin. MyWhoosh coverage is the weakest: one review of the v4 HUD and release notes.

## 1. Zwift

### Layout (cycling, support article plus Zwift Insider HUD refresh, v1.73, Sept 2024)

| Region | Content | Notes |
|---|---|---|
| Left (upper left) | Power in watts, large, coloured by zone; a small stack of configurable fields (speed, avg power, W/kg, cadence, HR; later: kJ, normalised/weighted power, L/R balance, etc.) | Power tile has five fields; the bottom four are configurable (confirmed). Cadence and HR only if sensors paired. |
| Left, near power | PowerUp icon, gear indicator (when virtual shifting is on), connection alerts | Alerts clear when resolved or after 60 s (confirmed). |
| Top centre | Elapsed/moving time, distance, elevation gained, calories/kJ (post-refresh); earlier: speed, distance, elevation, time | Refresh swapped speed for elapsed time and calories (confirmed). Level/XP bar and route progress bar were removed or hidden in the refresh (confirmed, with a hedge on climb mode). |
| Top right | Minimap: your position, route name, current gradient %, remaining distance/time/laps; profile strip along its bottom edge with lead-in, progress and segment markers | Refresh enlarged the profile strip to show the whole route, your position and distance remaining (confirmed). |
| Right edge | "Zwifters nearby" list: W/kg, ahead/behind gap, activity time, plus badge icons (event category, ride leader, pro, followed, etc.) | 13 rows before the refresh, about 9 after (confirmed, with hedge: screenshot may have had few riders). |
| Right/left panel | Segment leaderboards or Ride Stats and Splits, toggled from the Action Bar | Hidden by default (confirmed). |
| Bottom | Action Bar, hidden until swiped/arrow-up; contains camera, emotes, U-turn, watt lock, HUD toggle, graph toggle | Confirmed. |
| Bottom (workout) | Power graph/zone bar; the zone bar grows each zone's width with time spent in it | Borrowed from the run UI (confirmed). |

### Modes
- Free ride and group ride: same HUD; the group ride adds ride-leader/sweeper icons in the rider list and a ride name/progress (confirmed from icon list).
- Race: same HUD, minimap shows remaining laps/distance; rider list is the key tool (category icon, W/kg). A "groups" view is a fan wish, not a feature (confirmed as wish).
- Climb: a "Climb Mode" elevation profile appears only on climb segments, coloured with the Climb Portal scheme and showing roughly the next kilometre (confirmed). The Portal's road colours also shift by gradient (confirmed). The gradient ramp's actual colours: (unconfirmed).
- Workout: the old fixed metrics were replaced (May 2026) by four configurable centre fields from 13 data points; a ride-stats side panel is available; workout HUD settings are separate from free-ride settings (confirmed, forum thread). Users complained the target-power text is too small (confirmed, forum). The interval bar and next-interval preview layout: (unconfirmed, not found).

### Hierarchy
- Power is the largest number and the only one coloured by zone (confirmed). Everything else is small and secondary.
- Hidden until relevant: climb profile, segment timing, Action Bar, side panels, alerts, PowerUps.

### Zone colours (Zwift support and Zwift Insider agree)
| Zone | Colour | % FTP |
|---|---|---|
| 1 Recovery | grey | below 60 |
| 2 Endurance | blue | 60-75 |
| 3 Tempo | green | 76-89 |
| 4 Threshold | yellow | 90-104 |
| 5 VO2 max | orange | 105-118 |
| 6 Anaerobic | red | above 118 |

Zwift's own page leaves 1% gaps (75 to 76); treat boundaries as 60/76/90/105/119 (assumption). A purple zone 7 appears in some third-party descriptions (unconfirmed for the HUD).

### Customisation
Power-tile fields, workout fields, HUD toggle on the Action Bar (confirmed). Companion app acts as a remote Action Bar and second screen (confirmed for controls; full metric screen: unconfirmed). Users want a global font-size scale (confirmed, forum).

## 2. TrainerRoad (indoor app, official "Live Workout Display Explained")

Confirmed content:
- Current power and target power are the core pair. A target power bar stays green while you are near target. A white dot shows the interval's average power; on steady intervals you align it with a vertical white line.
- Timers: interval time remaining, and total time elapsed.
- Heart rate, and cadence only if a sensor is connected.
- After each interval a summary prompt appears upper right: duration and zone, average power, watts off target, precision, cadence.
- The workout profile chart is blue (time on x, watts on y). A yellow vertical line is "now". Green horizontal line is target, red is HR, yellow is your power; white cadence appears only post-workout.
- Text instructions appear within workouts (coach cues). Exact placement: (unconfirmed).
- Users have asked for next-interval target and duration to be visible, which implies the app shows it weakly or not at all (inference from a forum feature request; unconfirmed).
- TrainerRoad has no 3D world, so there is no free-ride, group or climb HUD. Outdoor/head-unit screens recommend 3 s power, lap power, %FTP, cadence, HR, lap time (confirmed, TR blog), and users find lap-power targets misleading after a stop (confirmed, forum).

Hierarchy: the chart is the hero; power and target numbers are large; everything else is incidental. Positions on screen: (unconfirmed). Customisation: limited; reordering fields in the phone app is a forum request (unconfirmed it is supported).

## 3. MyWhoosh (thin evidence)

- v4 HUD redesign across free ride, workouts and events (the5krunner review, confirmed): the transparent map moved from bottom left to top right; power, HR and cadence sit across the top centre; ride totals along the bottom; virtual gear indicator bottom right (reviewer says it is too large and should hide in ERG); rider list on the right in a compressed layout that shows more riders.
- Workout mode: segment details on the left are colour-coded to match the intensity bars along the bottom; a ghost finish line appears on the circuit at the end of each step (confirmed, same review).
- Map doubles as a look-ahead elevation view; a reviewer wanted ClimbPro-style dynamic gradient (so it is a fixed look-ahead today; confirmed as reviewer opinion).
- Groups of elements can be hidden for a clean view (confirmed, v3.5 notes and a review). Gradient colour ramp, rider list columns, zone colours: (unconfirmed).
- Mobile/tablet differences: (unconfirmed) for all three apps. Zwift's Companion is the known second screen; MyWhoosh has a companion/remote (unconfirmed).

## 4. Recurring themes (shared by at least two apps)

1. Power is the largest number; heart rate and cadence are smaller and conditional on a paired sensor (Zwift, TR, MyWhoosh).
2. Power sits upper left (Zwift) or top centre (MyWhoosh); both keep it in the top third, away from the road centre.
3. Power is colour-coded by zone: Zwift on the number; TR via a green "on target" bar; MyWhoosh colours intensity bars (Zwift, TR, MyWhoosh).
4. Elapsed time, distance and elevation gained are small, quiet totals: top centre (Zwift) or bottom (MyWhoosh).
5. Minimap with a profile strip lives top right (Zwift, MyWhoosh v4); it shows gradient %, remaining distance and your position.
6. Rider list on the right edge, compact, sorted by proximity (Zwift, MyWhoosh).
7. Workout view = current vs target power, interval time left, total time, a profile chart with a "now" marker (TR, Zwift, MyWhoosh).
8. Context panels appear only when relevant (climb profile, segment timing, alerts) and optional ones hide behind a toggle (Zwift, MyWhoosh).
9. Translucent dark panels over the scene, white sans text with tabular numbers (all three; unconfirmed in the sources, common knowledge from screenshots).
10. Gear indicator bottom or lower-left/right, shown only with virtual shifting (Zwift, MyWhoosh); reviewers want it hidden in ERG.

## 5. Best of each

- Zwift: climb-only elevation profile, gradient-coloured, about 1 km ahead, appearing only when it matters; plus configurable fields.
- TrainerRoad: the chart-led workout view with a target-line that stays green when you are close, and the interval-average dot for steady efforts.
- MyWhoosh: workout step colours on the side match the intensity bars below, so the whole screen speaks one colour language; also a one-gesture clean view.

## 6. Recommended Cranky free-ride HUD

Principle: the scenery is the star. Default view shows four things; everything else appears on need or on tap. All sizes are relative to viewport height (vh).

### Desktop / TV (landscape, 16:9)

| Element | Position | Relative size | Shows / hides | Colour rules |
|---|---|---|---|---|
| Power | top left, anchored 3 vh in | numeral about 7 vh, label "W" about 2 vh | always | numeral white; thin 0.6 vh underline bar in zone colour; avoid colouring the entire number so it stays legible |
| HR and cadence | beneath power, same column, in that order | about 3 vh, 40% of power | each hides if no sensor | white; HR dot turns red above 90% max (optional) |
| W/kg | beside power, 2.5 vh | small | on by default in game mode, hidden in free ride | white |
| Speed | top centre | about 4 vh | always; km/h unit small after number | white |
| Distance, elapsed, climb | top centre, row under speed, 2.2 vh | small | always (compact "12.4 km, 31:05, +240 m") | 70% white |
| Minimap | top right, circle or rounded square about 18 vh | medium | toggle; auto-fades to 35% when stationary scenery is more useful (optional) | dark glass, route line in accent, rider dot in orange |
| Elevation strip | along the bottom edge, full-width minus 8 vh margin, 5 vh tall | thin | toggle; whole route, you as a pin; coloured fill by gradient | gradient colours below |
| Gradient readout | bottom centre above strip, "6.5%" about 4 vh | medium | appears when abs(grade) 2% or more; fades out on flats | text coloured by gradient band |
| Climb pop-up | replaces the minimap's lower half or sits above the strip | medium | appears on climbs of 500 m or longer, shows next 1 km zoomed, remaining ascent and distance, ETA | gradient ramp |
| Rider list | right edge, vertically centred, 7-9 rows | small | auto-hides on solo free ride unless riders are near | self row highlighted |
| Gear | bottom right, above the strip, small chip, "34x21" or "7/12" | small | only with virtual shifting; hides in ERG | white on glass |
| Toasts | top centre, below metrics | medium | short (3 s): "Ride on", "Close the gap" | accent |

Panels: 40-55% black glass with 8 px blur and a 1 vh corner radius; no borders; text-shadow for contrast. Numbers use tabular-lining digits, weight 600-700; units are 40% size, lower weight, baseline-aligned to the right of the number.

### Phone landscape
- Power stays top left but 5 vh; HR and cadence on one line beneath it.
- Speed, distance, time collapse into one tap-to-expand line at top centre (distance and time only by default).
- Minimap off by default; tapping the top right opens it as an overlay; rider list off by default (swipe from right).
- Elevation strip stays at the bottom (3 vh), the climb pop-up becomes a bottom strip instead of a panel.
- Minimum touch target 44 px; respect safe areas (notch) with 4 vh side margins; minimum body text 12 pt equivalent.

### Gradient and zone colours (recommended)
- Gradient ramp: below -3% blue; -3 to 2% neutral grey-green (flat); 2 to 5% green; 5 to 8% yellow; 8 to 11% orange; 11% and above red; 15%+ dark red/purple. Zwift's actual ramp is (unconfirmed); this is ours. Always add the numeral so colour is not the only cue.
- Power zones: use the Zwift mapping above (grey, blue, green, yellow, orange, red) since riders already know it. Boundaries 60/76/90/105/119% FTP.

### Rider list (free ride and group)
Columns, 6-9 rows sorted by distance ahead then behind: [flag or avatar dot] name (truncated to 10 chars) | W/kg | gap. Gap is time in seconds ("+0:12"), falling back to metres when stationary. You are the centre row, with brighter background and accent bar; riders ahead have a "+" and rows tinted slightly cooler, riders behind "-". Max one badge per row.

## 7. Workout-player HUD (deltas)

- Centre of screen top: giant target power ("250 W") with actual power beneath it in zone colour; a horizontal tolerance bar (green within 5%, amber 5-10%, red beyond) in the style of TrainerRoad's on-target bar. ERG shows a small lock icon.
- Interval time remaining is the second-biggest number, top centre; a thin strip along the bottom shows the whole workout as bars (height = target %FTP, fill by zone colour), a "now" line, and a ghost of the target line over your power trace. Next interval preview: a small chip, "Next: 5:00 at 320 W", appearing in the last 10 s of each interval and during rests.
- Hide: speed, distance, minimap, rider list by default; keep elapsed total and HR and cadence small. Gear hidden.
- Coach text instruction line, one sentence, under the interval timer.
- Interval summary pop-up after each effort (average power, off-target watts, precision), top right, 5 s (copy TrainerRoad).
- Last 3 s of an interval: 3-2-1 countdown and tone.

## 8. Group / game HUD (deltas)

- Rider list always on, with W/kg column on by default; add team or rank badge; self row pinned even when far from the pack.
- Race position and gap-to-leader chip top centre ("3rd / 12, +0:08").
- Show W/kg next to power; show power-ups as a slot beneath power (icon plus timer).
- Round-timer, sync window and event messages in top centre toasts; sprint blocks show a sprint banner, never a target power.
- Optional "groups" view: collapse the list to bunches (nobody does this yet; Zwift fans have requested it).

## 9. Avoid (documented complaints and reviewer wishes)

- Tiny numbers: Zwift forum users reported new-HUD digits too small to see changing; target power in the workout HUD was called too small; Hammerhead users made the same complaint. Provide a global scale setting.
- Central HUD in the way on climbs; users ask for a hide hotkey. Offer one-key clean view.
- Gear indicator too big and shown in ERG, where it is meaningless (MyWhoosh review).
- Wasted prime top-right real estate on data riders do not need (MyWhoosh review).
- Fields that jump position when optional ones are empty (Zwift workout HUD forum). Keep slots fixed.
- Climb pop-up misfiring on rolling terrain (Zwift forum). Require sustained gradient (for example 3%+ over 300 m) before showing.
- Misleading target after a stop when targets use lap power (TrainerRoad forum). Our target must be time-based, not lap-based.
- Colour as the only signal; very long rider lists; more than about 9 rows.

## Sources

- https://support.zwift.com/en_us/using-the-heads-up-display-when-cycling-rJepA4beS.md
- https://zwiftinsider.com/?p=105892 (HUD refresh closer look)
- https://zwiftinsider.com/power-zone-colors
- https://zwiftinsider.com/climb-portal (surfaced by search; not fetched)
- https://forums.zwift.com/t/customizable-workout-hud-may-2026/668331.md
- https://forums.zwift.com/t/hotkey-support-to-declutter-hud/536999.md (search snippet only)
- https://forums.zwift.com/t/game-update-v1-73-september-2024/633662 (search snippet only)
- https://support.trainerroad.com/hc/en-us/articles/201974500-Live-Workout-Display-Explained
- https://www.trainerroad.com/forum/t/feature-request-show-target-power-duration-of-next-interval/9653 (search snippet only)
- https://www.trainerroad.com/blog/outside-workouts-wahoo-setup/ and https://www.trainerroad.com/blog/garmin-edge-the-best-head-unit-setup/ (search snippets)
- https://the5krunner.com/2025/03/12/mywhoosh-4-major-upgrade/
- https://cyclingweekly.com/news/mywhoosh-4-0-is-here-with-virtual-gear-shifting-and-dynamic-road-creation (search snippet only)
- https://mywhoosh.com/?p=52997 (v3.5.0 notes, search snippet only)
- https://support.rouvy.com/hc/en-us/articles/34303641851921 (ROUVY gradient banding, for context only)

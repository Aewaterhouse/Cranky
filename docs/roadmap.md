# Cranky roadmap

**Cranky** is the app. **Zombie Bus** is its first game; solo workouts, watch parties and later games sit alongside it.

A backlog of what to build next, grouped by theme. Sizes are rough: **S** = an evening, **M** = a weekend, **L** = a week or more. Items the owner asked for are marked ★.

## What separates this from an AA game

Today it is a working prototype: one game mode, one solo mode, procedural art, synth beeps, and no real ride on it yet. Compared with Zwift-class products, the gaps are:

1. **Trust on hardware.** Dropouts, reconnects and odd trainers have to be handled without anyone thinking about it.
2. **Your data lives somewhere useful.** Serious riders expect Strava, FIT files, a power curve and fitness trends.
3. **Reasons to come back.** Progression that spans rides: a campaign, seasons, goals, streaks.
4. **Content depth.** More events, enemies, routes and workouts, so ride ten is not ride one.
5. **Production values.** Real models and animation, sound design, music, onboarding, settings.

The suggested order below attacks them in that order: reliable first, then serious, then deep, then pretty.

## Decided

- The product is called **Cranky**. Zombie Bus is one game inside it.
- Six seats on the bus is enough for now. A seventh rider waits for the next bus.
- Strava export waits. FIT file export comes first, which also covers manual Strava uploads.

## Suggested milestones

| Milestone | Goal | Main items |
| --- | --- | --- |
| 1. First group ride | Six people finish a ride with no faff | Rebrand to Cranky, reliability list, bots, admin page, tuning |
| 2. Serious trainer | Solo mode you would choose over TrainerRoad for a session | FIT export, graphs, ride history, workout import, FTP test, watch party |
| 3. Free ride | Real routes without ERG | GPX routes, gradient sim, map, group ride |
| 4. Deeper game | Zombie Bus stays fun for a season | Route map, roles, zombie types, bosses, campaign |
| 5. AA polish | Looks and sounds like a product | Art, audio, onboarding, settings, performance |

## 1. Reliability and ride-day basics

| Item | What | Size |
| --- | --- | --- |
| ✅ Trainer auto-reconnect | If Bluetooth drops mid-ride, reconnect and resume ERG without leaving the ride | M |
| ✅ FTMS response handling | Read control-point replies, retry rejected writes, show a clear error | S |
| ✅ Heart-rate monitor | Pair a BLE HR strap; record and show HR everywhere | M |
| ✅ Screen wake lock | Stop the laptop sleeping mid-ride | S |
| ✅ Ride crash recovery | Save the ride every few seconds so a refresh or crash loses nothing | M |
| ✅ Server restart survival | Persist room state so a restart resumes the ride | M |
| ✅ ERG pre-scheduling | Schedule block changes off the server clock so targets are never late | S |
| ✅ Rebrand to Cranky | Rename the app, logo and tab title; the home screen becomes a mode picker (Zombie Bus, Watch Party, Solo, later games) | S |
| ✅ Full-bus handling | Six seats stays; a full bus says so and turns the seventh rider away. Spectating comes with TV mode below | S |
| ✅ Bots to fill the bus | NPC riders so a crew of two still has a full, lively bus | M |
| ✅ Admin page | Add riders and reset passwords in the browser instead of editing config | S |
| ✅ TV / second-screen mode | Pair on the laptop, watch on a TV or iPad (spectator view by code, `/?watch=CODE`) | M |
| iPad and phone layout pass | Test Bluefy on iPad; fix HUD and solo layouts for touch | M |
| Number tuning | Tune horde, damage, fell-off and scrap after the first real ride | S |
| ✅ Automated end-to-end test | Put the Playwright ride test in the repo so regressions are caught | S |

## 2. Data, graphs and export

| Item | What | Size |
| --- | --- | --- |
| ✅ FIT file export (download button on the results screen; past rides get it with the ride history item) | Download any ride as a .fit file for Garmin, intervals.icu, TrainingPeaks, or a manual Strava upload | M |
| ✅ ★ Power curve chart | Interactive curve: this ride vs 90-day vs all-time, with W/kg | S |
| Compare with mates | Overlay crew power curves; leaderboards per duration in W and W/kg | M |
| ✅ Ride history and detail | Every past ride with its full chart, laps, zones and PRs; rename and delete | M |
| ✅ ★ Deeper profile | Weight, W/kg, HR zones, max HR, custom power zones, FTP history chart | M |
| ✅ Fitness trends | Weekly TSS, fitness / fatigue / form (CTL, ATL, TSB), calendar heatmap, streaks | M |
| ✅ PR timeline and badges | When each best was set; badges for milestones (first 300 W minute, 100 rides) | S |
| Extra ride metrics | HR drift, efficiency factor, variability index, cadence histogram, W′ balance | M |
| intervals.icu sync | Push rides and pull planned workouts | M |
| ✅ Discord post | The server posts each finished bus ride's summary to a channel webhook. **Needs the owner:** set `ZB_DISCORD_WEBHOOK` to the channel's webhook URL and restart; not yet tried against a real Discord channel. The postcard image is not attached (it is drawn in the browser) | S |
| ★ Strava export (later) | Connect Strava once, then every ride uploads automatically. Parked for now; needs a free Strava API app | M |

## 3. Solo trainer mode

| Item | What | Size |
| --- | --- | --- |
| ✅ Workout import | Load .zwo, .erg and .mrc files | S |
| Workout builder | Drag-and-drop editor for your own sessions | L |
| ✅ FTP tests | Ramp test and 20-minute test that set FTP automatically | S |
| ✅ Bigger library | 50+ workouts, sorted by goal (endurance, sweet spot, threshold, VO2, sprint) and length | M |
| Training plans | Multi-week plans with a calendar and "today's workout" | L |
| ✅ Coach text cues | Timed on-screen messages inside workouts | S |
| ✅ Resistance and slope modes | Ride without ERG at a fixed resistance or gradient | S |
| ✅ Cadence targets | Optional cadence band per interval, scored like power | S |
| ✅ Ghost of last attempt | Your previous solo attempt at the same workout is drawn as a dashed line behind the live trace. Built and type-checked, but not yet seen with a real earlier ride | M |
| ✅ Extend cool-down / add time | One-tap "+5 min" at the end | S |
| ✅ Media corner | Space for a video or music player beside the chart | S |

## 4. Free ride on real routes

| Item | What | Size |
| --- | --- | --- |
| ★ GPX routes | Import any GPX (or a Strava route) and ride it; the trainer follows the gradient | L |
| Ride physics | Speed from power, weight, gradient, drag and rolling resistance; trainer difficulty slider | M |
| Route library | Famous climbs (Alpe d'Huez, Ventoux, Stelvio) and your local loops, with length and elevation | M |
| Elevation profile and map | Live position on an elevation chart and an OpenStreetMap map | M |
| Group free ride | Ride a route together with drafting and an optional keep-together rubber band | L |
| Segments | Timed climbs and sprints on each route with personal and crew leaderboards | M |
| 3D route view | Low-poly road that follows the real bends and gradient, reusing the scene engine | L |
| Virtual gears | Shift from the keyboard or a Bluetooth remote for trainers without gears | M |

## 5. Zombie Bus: more game

| Item | What | Size |
| --- | --- | --- |
| Route vote and map | At each Servo Stop the crew votes on a branching map: short and brutal, long and easy, risky shortcut | M |
| Pick-one upgrades | Roguelike choice of three random upgrades at each stop instead of a fixed shop | M |
| Zombie types | Runners punish slow cadence, brutes need sustained power, spitters need a sprint; each maps to a workout demand | L |
| Boss fights | A final event per ride: a giant, a chasing road train, a collapsing bridge | L |
| ✅ Ramp-up hill | The planned ramp event: the bus climbs out of a valley | S |
| Crew roles | Driver, gunner, mechanic, lookout: small abilities on a cooldown, fired by a cadence or power cue | L |
| ✅ Personal mini-challenges | "Spin 110 rpm for 20 s", "hold exactly 200 W": quick prompts for bonus scrap | M |
| Team moves | Synchronised sprint fires the harpoon; rolling turns on the front like a chaingang | M |
| ✅ Streak power-ups | Near-perfect group riding charges a nitro meter; when full it fires a 15 s boost by itself (no button to press mid-effort) | S |
| Weather and night | Rain, dust storms, night driving with headlights; visibility as a mechanic | M |
| Campaign | A multi-ride journey across a map with a persistent bus, damage carried over and unlocks | L |
| ✅ Difficulty and mutators | Easy to nightmare, picked by the host, plus a mutator that changes every week (Hungry Horde, Closed Servos, Scrap Rush, Loose Bolts, Tailwind) on everything above easy | S |
| Daily and weekly challenges | Rotating goals with scrap rewards | M |
| Trophies and bus history | LEGEND sprints bolt a permanent trophy on the bus; a plaque lists past runs | S |
| Horn, emotes and heckles | Quick reactions; spectators and fallen riders can cheer or heckle | S |
| Highlights and replay | Auto-clip the best moments (MEGA sprint, last-second escape) for the results page | L |
| ✅ Season ladder | Crew score table per season with resets and titles | M |

## 6. Watch party ★

A shared room where the crew does the same ERG workout while watching the same video, everything in sync.

| Item | What | Size |
| --- | --- | --- |
| Watch party room | Join by code like a bus. The host picks a workout and a YouTube video or playlist; everyone's ERG follows the shared workout clock at their own FTP and tier | M |
| Synced playback | Play, pause, seek and next-video stay in step for everyone, driven by the server clock; late joiners land at the right spot | M |
| Layout | Video takes most of the screen; a slim workout strip shows target, power, the band gauge, interval clock and the workout graph | M |
| Shared queue | Anyone can add videos to the playlist; the host can reorder and skip | S |
| Crew strip | Small row of everyone's watts, compliance and heart rate, plus emoji reactions over the video | S |
| Pause rules | Workout pause and video pause are linked: if the host pauses, both stop for everyone | S |
| Workout-aware video | Optional: dip the video volume and flash the strip a few seconds before each interval change | S |
| Other sources | Twitch streams and direct video links, where they can be embedded | M |

Notes: YouTube's embedded player supports synced control and is the safe starting point. Netflix and other paid services block embedding, so they are out. Each rider needs a device that can show video and pair the trainer, or use the second-screen mode.

## 7. Other games

| Item | What | Size |
| --- | --- | --- |
| Handicap race | Everyone races a route, speed scaled by FTP so it is always close | M |
| Chaingang | Take turns on the front; smooth rotations keep the speed up | M |
| Last rider standing | A shared ramp test as an elimination game | S |
| Team time trial | Two crews, same workout, compliance decides | M |
| Galley Ship, Pub Quiz, Asymmetric Hunt | The remaining ideas from the original plan | L each |

## 8. Polish and production

| Item | What | Size |
| --- | --- | --- |
| Art pass | Replace procedural models with one cohesive CC0 or commissioned low-poly set; animated zombies | L |
| Sound design | Real engine, horde, impact and UI sounds in place of synth beeps | M |
| Adaptive music | A soundtrack that shifts with the event and intensity | L |
| ✅ Announcer | A dry voice calling events and sprint grades, using the browser's built-in speech (Australian voice where the device has one). Untested by ear: built on a headless machine | M |
| ✅ Onboarding | First-run tutorial: pair the trainer, set FTP, what compliance means | M |
| ✅ Settings | Volume, graphics quality, in-ride display size and colour-blind zone colours, under the rider menu. Units (miles, pounds) are not done: everything is metric | M |
| ✅ Graphics presets | Low / medium / high, auto-picked from measured frame rate | S |
| Proper icons | SVG icon set in place of emoji so every device looks the same | S |
| Rider avatars | Body, face and bike customisation beyond hats and kit | M |
| More cosmetics | Done: 20 more items (6 paints, zombie plough, pirate flags, roof esky and surfboard, 6 hats, 5 kits). Still to do: paint patterns, decals, horns, exhaust flames, rider celebrations | M |
| ✅ Installable app | Add-to-home-screen with offline solo mode | S |
| Logo and domain | Done: a chainring-and-crank logo, favicon and app icon. Still to do, **needs the owner:** pick and register a domain; a share image for link previews | S |

## 9. Social and scheduling

| Item | What | Size |
| --- | --- | --- |
| Scheduled rides | Put a ride in the calendar; everyone gets a link and a reminder | M |
| Crew feed | Who rode what, new PRs, kudos | M |
| Achievements | Long-term badges shown on the profile and the bus | M |
| Proper accounts | Real passwords and invite links if it ever leaves the friend group | M |
| ✅ Backups | A dated copy of the database at server start and every 24 h, newest 14 kept, in `server/backups/` (`ZB_BACKUPS` to move it) | S |

# Free ride plan: real routes in a 3D world

Owner priority as of 2026-11-13. Free ride becomes a place you want to ride: iconic Australian roads, drawn as a stylised low-poly world built from the real map, ridden alone or together. It is also the base for later road games (chaingang, handicap race, team time trial, kart racing), so the road, the world and the multiplayer are built once and shared.

"AAA in our styling" means: chunky, colourful and a bit silly like Zombie Bus, but complete. Nothing placeholder, nothing that breaks the spell, and every route recognisably its own place.

## Where we start

Already built: GPX import, ride physics, trainer gradient with a difficulty slider, 24 virtual gears (keys and Zwift Click), elevation charts, a flat Leaflet map, and a results screen with distance and climb. It is solo only, runs entirely in the browser, and is 2D. The 3D scene engine exists but only draws a straight endless road for the bus.

## Six pillars

1. **The place.** Real bends, real gradients, real hills on the horizon, real street layout underfoot.
2. **The feel.** Speed, gears, momentum, drafting, sound and camera make it feel like riding, not watching numbers.
3. **Together.** Ride with mates, bots and ghosts on the same road.
4. **Reasons to come back.** Segments, PRs, badges, a passport of routes, featured rides.
5. **Production.** Intro flyovers, summit moments, audio, settings, performance, no rough edges.
6. **A platform.** Any game that is "riders on a road" plugs in with rules only.

## Design decisions

- **Route packs.** Each bundled route is one generated file, `content/routes/<id>.json`: name, region, blurb, distance, ascent, difficulty; the centreline every 10 m (distance, lat, lon, elevation); a coarse height grid for the land either side; map features near the road (forest, water, built-up areas, buildings, side streets, street names); segments; points of interest; credits. Packs are lazy-loaded one at a time and cached for offline use.
- **Built from open data, once.** `scripts/routes/` makes the packs from OpenStreetMap (road shape and map features) and SRTM (heights). Riders never call those services. Each pack is checked against the climb's published length and gain and fails the build if it is more than 5% out on distance or 10% on gain.
- **The map is drawn, not downloaded.** The ground is painted in our own style from the pack's map features (parks green, water blue, streets as pale lines, suburbs as blocks of low-poly houses). This replaces the earlier idea of draping OpenStreetMap image tiles: it works offline, matches the art style, avoids the tile server's usage limits, and lets buildings stand up.
- **World in chunks.** The road is a smooth curve through the centreline with gentle banking. Terrain, props and buildings are built about 200 m at a time ahead of the rider and thrown away behind, so a 40 km route costs the same as a 4 km one. The terrain is cut and filled so the road always sits on it.
- **One road state for every game.** The scene is fed a list of riders, each with distance along the route, sideways offset, speed and look. Free ride, group ride and every later game produce that same list.
- **Server-run group rides.** For multiplayer the server works out everyone's position from their reported power, using the same physics as the browser (shared test vectors keep the two in step). Solo stays in the browser and works offline.
- **Trainer safety is unchanged.** Free ride never sends an ERG power target. Gradient goes through `ergController.ts` only, in the existing -10% to +20% range.
- **2D stays as a fallback.** The current chart-and-map view remains for weak devices and as a rider setting.

## Phases

Each phase ends in something rideable. Sizes: S = an evening, M = a weekend, L = a week or more.

### Phase A: route packs and library (M) — built 2026-11-13, not yet seen in a browser
- [x] Route builder script: OpenStreetMap road plus SRTM heights to a pack, with the length and gain check.
- [x] Pack loader, schema and unit tests; imported GPX files become packs with no map features.
- [x] First ten routes: Mount Coot-tha loop, Ben Lomond (Jacob's Ladder), Mount Buffalo, Falls Creek, Mount Hotham, Mount Wellington (kunanyi), Willunga Hill, Akuna Bay / West Head, Great Ocean Road (Lorne to Apollo Bay), Beach Road (Melbourne).
- [x] Route picker: cards with a mini profile, distance, climb, difficulty, and an estimated time at your FTP; filter by state and length.
- [x] Credits on the route screen and in `CREDITS.md`.
- [x] Six routes from the owner's ride recordings: Mondo, Full Gas Friday, Mount Coot-tha Back, Darren Smith and Metros road race laps, Nundah crit track.
- [x] Lap routes: a lap stepper on the setup screen for the loop courses (short circuits default to about 12 km; end the ride whenever you like). Unit-tested, not yet ridden in a browser.
- [ ] Backfill map features for the routes the map server refused (see `docs/decisions.md`).

### Phase B: 3D road world (L) — built 2026-11-13, seen only in software-rendered screenshots
- [x] Road curve, banking and chunk streaming from a pack.
- [x] Terrain from the height grid, cut to the road, with distant hills as a simple skyline.
- [x] Your rider on a bike, legs turning at your cadence, in your garage kit.
- [x] Chase camera that looks into corners and up climbs.
- [x] Slim free-ride HUD over the scene: speed, power, cadence, heart rate, gear, gradient; elevation strip along the bottom; minimap in the corner.
- [x] Scene harness page for routes and visual settings in the debug panel.
- [x] Automatic quality levels and the 2D fallback.

### Phase B2: HUD pass (M) — owner request, 2026-11-13
The fun is in the riding, but the information has to be as good as the established apps. Look closely at how Zwift, TrainerRoad and MyWhoosh lay out and style their ride screens, take the best of each, and follow the themes they share.
- [x] Study the three HUDs (screenshots, reviews, their own help pages) and write up the recurring themes in `docs/hud-notes.md`: what sits where, what is big, what is hidden until needed, colour and type conventions, how climbs, gradient, riders nearby and intervals are shown.
- [x] Redesign the free-ride HUD from those notes: placement, hierarchy, sizes, zone colours, the gradient and climb displays, the rider list and the minimap. Our own look, their conventions.
- [ ] Carry the same conventions to the solo workout player and the bus HUD where they fit, so every mode reads the same way.
- [ ] Owner look check on a real screen and on a phone or iPad.

### Phase C: the place (L)
- [x] Painted map ground: land use, water, side streets, street-name signs at junctions. (Built against made-up fixture data; real map data is not in the packs yet.)
- [x] Trees and scrub where the map says bush; low-poly houses and shops from building outlines. (Buildings seen only with made-up fixture data.)
- [x] Road furniture: kilometre markers, gradient signs, numbered hairpins, guard rails on the drop side, edge posts on bends, start, summit and finish arches.
- [x] Landmarks from map points (trig points and cairns on peaks, lookout platforms, lattice TV towers, kiosks) and inferred ski villages and bathing boxes. Hand-placed specials per route are still to do.
- [x] More stuff (owner, 2026-11-13: "funny comments, weird things on the side of the road, it's all great"): roadside oddities (big things, a couch on the nature strip, a ute on blocks, a lost shopping trolley, honesty-box fruit stalls, letterboxes made of microwaves), hand-painted and council signs with dry one-liners, chalk messages on the climbs, and announcer or toast quips tied to where you are and how you are riding.
- [x] Life: kangaroos, cockatoos, a swooping magpie in spring, the odd ute and caravan on the other side of the road.
- [x] Time of day and weather moods per ride (dawn, midday, golden hour, mist on the high routes).

### Phase D: the feel (M)
- [x] Physics: momentum through dips, corner speed limits and braking on descents, optional headwind.
- [x] Trainer gradient looks slightly ahead so resistance arrives as the road tilts, not after.
- [x] Camera: wider view with speed, a little shake on rough descents, tuck when coasting fast.
- [x] Sound (synthesised, no files): freehub tick when coasting, wind by speed, tyre hum, gear clunk, birds and cicadas by place. Not yet heard by a person.
- [x] Rider animation: out of the saddle on steep ramps and sprints, coasting, celebrating at the top.

### Phase E: ride together (L)
- [x] Server road mode: rooms by code, lobby with route choice, server-run positions, late join, rejoin after a refresh.
- [x] Drafting: a real power saving on a wheel, shown on the HUD.
- [x] Optional keep-together rubber band, set by the host.
- [x] Bots that ride at a percentage of their FTP with a bit of personality.
- [x] Name tags, minimap dots, and a gap list ("Luke +0:12").
- [x] TV spectator view and crew results for road rides.
- [x] Headless test: four simulated riders finish a short route together.

Built against simulated trainers and one PC only: not yet ridden by two people on two devices, on real trainers or over a slow network. How to add a road game on top: `docs/road-games.md`.

### Phase F: reasons to come back (M)
- [x] Segments: climbs found automatically plus named ones, with a live split against your best and the crew's best.
- [x] Ghosts: your PR and a chosen mate's best as see-through riders.
- [x] FIT export with position, altitude, distance and speed, so an upload to Strava shows the real map.
- [x] Route passport: a map of Australia that fills in as you finish routes; badges for repeats and vertical metres.
- [ ] Weekly featured route and a vertical-metre challenge, paying scrap for the garage.
- [ ] Ride history shows the route map and segment results.

### Phase G: production (M)
- [ ] Pre-ride flyover of the route and a loading card with a fact about the place.
- [ ] Summit moment: arch, confetti, announcer line, and a postcard photo at the lookout.
- [ ] Settings: units, camera distance, HUD size, colour-blind gradient colours.
- [ ] Performance pass with frame-rate numbers on real devices; iPad and phone layout.
- [ ] Offline packs through the service worker.
- [ ] Manual test notes in `docs/testing.md` and owner checks in `docs/owner-checks.md`.

### Later: games on the road (not in this plan)
Each of these becomes a rule set on top of Phases B and E:
- **Chaingang:** needs drafting, a "front rider" rule and a rotation prompt.
- **Handicap race:** needs speed scaled by FTP and a finish order.
- **Team time trial:** needs two groups and a fourth-rider-counts finish.
- **Kart racing:** needs lanes (the sideways offset), item boxes and an input layer for phone buttons, keys and the Click.

## Order and size

A, then B, then C are the spine: routes, a world, then the place. D and E can follow in either order; E is the one the later games wait on. F and G come last. In total this is several weeks of agent time at the current two-agent heat limit, not a weekend. Stopping after any phase still leaves a better free ride than today.

## Needs the owner

1. **Approve OpenStreetMap data (ODbL, not CC0).** Phase A cannot start without it. The cost is a credit line. SRTM heights are public domain.
2. **The route list.** The ten above are a guess; swap in the ones the crew care about.
3. **Look checks.** This PC renders without a graphics card driver, so the agent cannot judge how the world looks. A look from the owner at the end of Phases B and C decides whether the style is right.
4. **Optional: the NVIDIA driver** (`sudo ubuntu-drivers install`), for truer screenshots and frame-rate numbers.

## Risks

- **Coarse heights.** SRTM has one sample every 30 m, so short pinches flatten and stacked hairpins (Jacob's Ladder) can come out wrong. The length-and-gain check catches the bad ones; the fallback is an owner-supplied GPX for that route.
- **Performance.** Buildings and trees are the expensive part. Chunks, instancing and the quality levels are the answer; the 2D view is the floor.
- **Scope.** "AAA" is the direction, not a promise per phase. Each checklist item is small enough to ship alone and be judged.
- **Untested on hardware.** Like the rest of free ride, everything is built against the simulated trainer until the owner rides it.

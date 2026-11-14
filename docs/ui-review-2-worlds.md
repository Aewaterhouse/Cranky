# UI review 2: free ride and the 3D worlds

Fresh-eyes review, 14 Nov 2026. I looked at the worlds through `route-dev`, `scene-dev` and `town-dev`, and rode one real Great Ocean Road free ride in a scratch build with the simulated trainer. The screenshots came from SwiftShader, so this review judges content and composition, not frame rate. Screenshot files are in `/tmp/claude-1000/-home-alex-projects-cranky/b534b2ab-7915-448b-aa5d-39e265fcc440/scratchpad/rev2-worlds/`, and the review names each one where it is relevant.

## Verdicts

**Free ride: good bones, but the places don't look like where they are.** In daylight the look is clean and cheerful, in the same family as Mini Motorways and Alto's Odyssey: pale-trunked gums, red-capped guide posts, chalk on the road ("PIES AT TOP"), funny signs ("YOUR FTP IS NOT A PERSONALITY"), cockatoos on Hotham, and the Coot-tha lookout with its summit arch (`coot-3000-day`, `odd-next`, `hotham-8000`). The mist mood on kunanyi is the best shot in the set, with real depth layering (`wellington-6000-mist`). The problems come down to place:
- The coastal routes have no sea. The GOR intro card says "Ocean on one side, hills on the other" over grassy hills, while the minimap shows the coast right there (`fr-gor-a`, `fr-gor-b`).
- Beach Road is gum bush (`beach-10000-day`).
- Howick Street Crit is paddocks, not Bathurst (`howick-1200-day`).
- Mondo and Metros are empty green carpet (`mondo-12000-day`, `metros-4000-day`).
- 9 of the 17 route files have no `features` and no land `cover` at all: akuna-bay, beach-road, full-gas-friday, great-ocean-road, howick-street-crit, mount-buffalo, mount-hotham, mount-wellington and willunga-hill. Mondo and Metros do have features and are still empty.
- The clock-based mood put every ride at review time in purple dusk. Under it the road is near-black and the grass is murk (`gor-5000`, `mondo-1000`, `fr-gor-b`).

**Zombie Bus: the best world by a distance.** It is dense, coherent and funny: the ruined houses, the "LAST PIE FOR 300 km" billboard, power lines, wrecks, the hazy ghost skyline, the letterboxed AIR STRIKE beat and the horde picture-in-picture (`bus`, `ambo`, `bus-airstrike`, `bus-roadblock`). The "finish" mood is gorgeous (`date-mood6`). Three weak spots:
- Name and HP pills pile up over the bus.
- The horde, which is the whole point, only appears in the inset.
- The conifers read as North America, not Australia.

**Climate Lawsuit town: a charming diorama, close to Tiny Glade in spirit.** The gag signs land ("SEAWALL NOT DESIGNED BY A CPEng", "The Drowned Rat Hotel"), and the flooded state reads instantly, with shops underwater and the SLSC roof poking out (`town`, `town-flood-ipad`). Weak spots:
- The sea is a flat slab with no shoreline foam, waves or bobbing debris.
- The sky is a flat grey-blue.
- The riders on their generators are tiny.
- At iPad width the right edge of the town is cut off.

**Speed Dating road: this is the zombie road with hearts added.** It has burnt trees, ruined houses and the LAST PIE billboard, and by default it is midday, not dusk (`date`, `date-mood5`). The tone is wrong for a date. It needs its own dressing (see idea 12).

## Ideas, ranked by value for effort

| # | Idea | What I saw | Who does it well | Effort |
|---|------|------------|------------------|--------|
| 1 | **Add the sea.** Put a flat water plane at sea level under the terrain, with a sand band where the terrain sits 0–3 m above it. This one change gives an ocean to GOR, Beach Road, Akuna Bay and Moreton Bay in the distance from Coot-tha. Add a slow normal wobble and a white foam line where the water meets the land. | `fr-gor-a`: an intro card promising ocean over grass. `gor-30000-day` and `beach-10000-day` show no water. | Zwift Watopia seafront, Rouvy coast roads | S |
| 2 | **Run the existing OSM feature and land-cover fetch on the nine routes that lack it**, so Howick St gets Bathurst houses and Beach Road gets suburbs and the bay. The pipeline already works for Coot-tha, Mondo and Nundah. | `howick-1200-day`: a crit in a paddock | Biketerra (real OSM towns) | S |
| 3 | **Fix the dusk palette and the default.** Lift ambient and hemisphere light at dusk, warm the asphalt to a blue-grey rather than black-purple, and add a visible low sun disc and glow. Keep the time from the clock, but let after-work rides land on golden hour more often than gloom, and add an "always sunny" choice. | `gor-5000`, `mondo-1000`, `fr-gor-b`: everything sinks into purple | Alto's Odyssey sunsets; your own bus "finish" mood (`date-mood6`) | S |
| 4 | **Break up the ground.** The terrain is big flat-shaded triangles in two greens. Add vertex-colour noise, colour by slope and height (rock on steep faces, dry gold grass on ridges, darker gullies) and a mown verge strip. | `metros-4000-day`, `fr-gor-cam2` (the overhead view shows it worst) | Lonely Mountains: Downhill, Tiny Glade | S–M |
| 5 | **Near-road detail for a sense of speed.** At the moment only guide posts pass close to the camera. Add grass tufts and gravel specks on the verge, chevron boards and painted gradient numbers on bends, and tree shadows across the road. Speed comes from things near the camera, not from far scenery. | `coot-3000-day`, `mondo-12000-day` | MyWhoosh verges, Alto's speed streaks | S |
| 6 | **A farm kit for open country (Mondo, Metros, Willunga, Full Gas):** fence lines along the road, paddock colour patches, round hay bales, a mob of sheep, a Southern Cross windmill, a silo, a 44-gallon drum letterbox, and vine rows for Willunga. Five instanced props would carry 40 km of road. | `mondo-12000-day`, `metros-4000-day`, `willunga-2500-dawn` | Zwift France and Yorkshire farmland | M |
| 7 | **A road-life "director."** Make sure something happens every 30–45 s at riding speed: an oddity, an animal, a sign, chalk, a passing ute, a bunch of riders going the other way. The kit already exists (cockatoos, chalk, signs, couch oddities). What's missing is guaranteed spacing, so minute 40 never goes empty. | `life-next` and `metros-4000-day`: long empty stretches | Zwift's busy Watopia; Indieville's NPC traffic | M |
| 8 | **Distant landmarks.** Reuse the bus scene's ghost-skyline trick for the Brisbane CBD seen from Coot-tha, Melbourne from Beach Road, and Hobart and the Derwent from kunanyi. A far silhouette gives a goal and a sense of place for free. | `coot-ipad-descent`: flat blue haze where the city should be | Zwift Makuri's tower, Watopia's volcano | S–M |
| 9 | **Declutter rider tags.** Shrink and fade them with distance, never show your own, merge the name and HP pills into one chip, and stack or offset pills that overlap. | `howick-500` (the huge "Mo" tag), `bus` (four pills over the bus) | Zwift's small floating names | S |
| 10 | **A start that feels like a place.** Add a town gateway sign ("Lorne", "Bathurst"), a bakery, parked cars and a start banner. The first ten seconds currently show an empty hill. | `fr-gor-b`: the start of GOR | Rouvy start villages, Zwift pens | S–M |
| 11 | **Alpine biome above about 1,200 m:** snow gums with twisty white trunks, orange snow poles, patches of old snow, granite tors and a ski-lodge sign. Hotham currently looks like Brisbane bush. | `hotham-8000` | Lonely Mountains snow levels | M |
| 12 | **Give Speed Dating its own world.** Default to dusk, string fairy lights along the fences, add a neon servo or milk bar, heart-shaped clouds, a drive-in screen and couples on picnic rugs, and remove the ruins, burnt trees and LAST PIE. Keep the hearts. | `date`, `date-mood5` | A Short Hike's cosy dressing | M |
| 13 | **Show the horde in the main view.** When the gap gets small, swing the camera to look back for two seconds, or add a rear-view mirror strip. Dread works best on the big screen. | `bus`: the horde exists only in the inset | Zombies, Run!; Mario Kart rear view | S |
| 14 | **Camera feel.** Lead into corners, widen the FOV slightly with speed, drop low and wide on descents, and add short letterboxed flybys at summits and KOMs, reusing the AIR STRIKE treatment. | `coot-ipad-cam`, `bus-airstrike` (already proves the letterbox works) | Zwift's auto camera; Alto's Odyssey | S–M |
| 15 | **Merge overlapping road ribbons on out-and-back sections.** Two roads z-fight and leave a ragged grass strip between them. | `akuna-2000-shower` | (just a bug) | M |
| 16 | **Make the bus scene more Australian.** Swap some pines for gums, add a servo, a Big Thing (zombified Big Banana or Big Prawn) and roo and wombat signs. | `bus`, `mad` | Your own free-ride gums | S |
| 17 | **Bring the town's water to life:** a shoreline foam ring, slow swell, bobbing debris (wheelie bins, an esky, a surfboard), gulls, a sky gradient and a sun. Make the riders 1.5× bigger with a bob, and fit the camera to iPad width. | `town`, `town-flood-ipad` | Tiny Glade water; Townscaper | S–M |
| 18 | **Regional wildlife moments:** swooping magpies in spring (cable-tie helmets), roos at dusk, wombats in Tasmania, a lyrebird on kunanyi. The cockatoos prove the idea works. | `hotham-8000` (cockatoos look great) | — (nobody else does Australia) | S each |
| 19 | **Better weather.** In showers, darken and gloss the road, add puddles and spray off wheels, and put cloud shadows sweeping over the hills on sunny days. | `akuna-2000-shower` (rain streaks only) | Zwift rain on Makuri | M |
| 20 | **Cluster trees and vary them.** Group gums in stands with open clearings instead of an even sprinkle, and add some dead stags and grass trees. | `beach-10000-day`, `gor-30000-day` | Lonely Mountains forests | S |
| 21 | **Painted road furniture:** km-to-go numbers on the road, KOM dots on the climb, sprint lines, and riders' names chalked on the road by the crew (Tour-style). It is cheap, personal and funny. | `odd-next` (the chalk already works) | Zwift KOM banners; real Tour chalk | S |

## What already works (keep it)

- Daytime palette and the low-poly gums.
- Mist mood.
- Funny signs and chalk.
- The Coot-tha lookout and summit arch.
- Cockatoos.
- The route intro card with its profile.
- The bus scene's density and the letterboxed set pieces.
- The bus "finish" golden-hour mood.
- The town's gag signage and the readable flood state.
- The bonkers rider models. Don't touch them.

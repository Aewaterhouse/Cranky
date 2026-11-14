# Rider bodies (character creator): design note

Free, body only. Hats, outfits and bikes stay Garage cosmetics and must fit every body.

## What is there now (inventory, 2026-11-14)
- `scene/riders.ts` `makeRider(colour, seed, road)` builds a figure from about 20 separate meshes (box limbs stretched between joints each frame by `span`, a cylinder torso, an icosahedron head with two eye boxes and a nose box) plus the bike (`bike.ts`), a helmet or a hat (`hats.ts`, a child of the head) and a canvas name tag (`riderTag.ts`). Skin tone is one of six, picked by join order.
- Animation is all in `pose(mode, phase, side, roadPose)`: two-bone IK in the forward/up plane for legs (hip to pedal) and arms (shoulder to bars), modes `ride`, `run` (fell off the bus) and `slump` (spectator), and on the road `riderPose.ts` adds standing, tucking and cheering. `heat()` reddens the skin with heart rate and puffs steam off the head; `fade()` ghosts a spectator.
- Drawn by: `scene/crew.ts` (bus roof, and running behind it), `scene/pack.ts` (VO2 Madness), `scene/route/roadRiders.ts` (free ride solo, ghosts, group rides), the TV views (the same worlds), `ui/shopPreview.ts` (Garage item pictures), the dev pages (`scene-dev.html`, `route-dev.html`) and postcards (a still of the scene).
- A rider's look is `core/cosmetics.ts` `Look` (item id per slot), kept in `profile.look` (synced whole with the profile), sent in the join message's `look` (`dict[str, str]` on the server, not checked) and handed back in every lobby message.
- Cost today: one rider is 26 draw calls and about 1,240 triangles, bike included (scene dev page).

## Model
- One parametric builder, in the game's flat-shaded low-poly style, in three files: body (torso, belly, hips, neck, limbs with a calf, hands, shoes), face (eyes, brows, nose, mouth and teeth, ears) and hair (head hair and facial hair).
- The whole figure below the neck is **one mesh**: each part is a template in its own space, and every frame the pose writes the parts' vertices into one position buffer (a few hundred vertices per rider, on the CPU, as cheap as today's per-limb matrices). The head is **one more mesh** inside the head group, so hats and the helmet still hang off the head and scale with it.
- Colours are vertex colours from a small palette per rider (skin, tan, pale, jersey, shorts, shoes, hair, fixed face colours). Changing outfit or heating up rewrites the colour buffer; no per-part materials. One material per rider, so fading a spectator still works.
- The skeleton keeps today's joints and IK, with the body's numbers in place of constants: limb lengths, shoulder and hip width, neck length, head scale. Feet always meet the pedals and hands the bars (the lower limb stretches the last few centimetres if a short limb cannot reach). Height scales the whole rider and bike together, so every pose and the bike fit keep working.
- Headwear: a helmet (no hat equipped) or a hat sits on the head group and scales with head size. Hair is built knowing what is on the head: under a hat only the hair below the hat line shows (mullet, ponytail, rat tail, sides of an afro or perm, facial hair); under the helmet tall styles (mohawk, spikes, man bun) poke through it. The creator can take the helmet off to see the hair.

## Options
Sliders are 0 to 100, pickers are an index. All in one table, `content/avatar.json`, read by the client (the creator screen is generated from it) and the server (validation).
- Body: height, build, belly, shoulders, arm length, leg length, calves, head size, neck.
- Skin: tone (realistic range plus zombie green, sunburnt lobster, Smurf blue, chrome), cyclist's tan line.
- Hair: style (bald, buzz, short, mullet, mohawk, afro, man bun, ponytail, rat tail, curtains, comb-over, spikes, big perm, bowl cut), colour (natural and silly), facial hair (none, moustache, handlebar, horseshoe, beard, goatee, mutton chops).
- Face: eye shape, size, colour and spacing, googly eyes, eyebrows (incl. bushy and unibrow), nose size and shape, ear size, mouth and teeth (smile, grin, gap, buck teeth, frown, open).
- Fun: presets and Randomise.

## Data
- A body is a map of option key to whole number. It travels as a short string, `1-50-40-…` (a version, then each option's value in table order), in `look.body`, beside the equipped item ids. So it already goes wherever a look goes: the profile, the join message, lobbies, group rides and the TV views. Old clients ignore the extra key; a look without one gets the default.
- Default: made from the rider's id (a seeded pick from the normal end of each range), so everyone has a stable body and nobody changes until they save one.
- Server: `look.body` is checked on join and when a profile is saved: right version and count, every value clamped to its range, at most 200 characters; anything else is dropped (the rider shows their default).

## Budget
- At most 3,000 triangles for the figure (target about 2,000 for the busiest face and hair), and 3 draw calls (body, head, headwear) where today's figure is about 20. Bike and name tag unchanged.
- Checked by a unit test (triangle count over random and extreme bodies) and on the scene dev page against the numbers above.

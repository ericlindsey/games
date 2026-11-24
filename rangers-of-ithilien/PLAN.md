# Rangers of Ithilien: Plan

Status: **v0.8: camps broken up by hand, scouts between the camps, the Marshal made plain.** (Before that,
v0.7a: the story by province, and the first settlers.) The land, the enemy, fighting, gear, tasks and trade are built and
have had several rounds of playtest; v0.3 reworked how all of it looks (section 4); v0.4 laid
eight provinces over the land (section 11); v0.5 shrank the land to 1.5 by 3 km with a hundred
camps. v0.7 rebuilds the tasks round the provinces (Faramir frees them and ends on the Marshal;
Éowyn maps them and the ranger brings their settlers home) and adds the settlements, which grow
as their people are helped ("v0.7" in section 10). Next: playtest a province from freeing to a
grown village, then the rest of M6 (section 11.7) and the gaps listed at the end of section 10.

---

## 1. The game in one paragraph

The War of the Ring has ended, but orcs and evil men who fled the King's army at
the Black Gate have gone to ground across Ithilien. Before Gondor can resettle the
land, Faramir's rangers must find and clear their camps, hideouts, and traps. You
play one ranger. Home is Henneth Annûn, where Faramir and Éowyn wait in the cave
behind the falls with tasks. Near the falls the woods are safe; the farther you
range, the more numerous and dangerous the enemy. Gear comes from fallen enemies,
from stashes in their camps, and from trade at the falls as reward for tasks.

## 2. Scope of the first prototype

The first playable build (**Milestone 1**) is exploration only:

**In**

- The whole play area as walkable terrain, with river, streams, mountains, roads.
- Henneth Annûn: the falls, the pool, the cave behind the water, with Faramir and
  Éowyn standing inside. Talking to them shows a short greeting (no quests yet).
- Forest that changes character from region to region.
- A handful of small ruins and named landmarks to discover.
- Sky, sun, fog, water.
- Desktop controls (keyboard and mouse) and mobile controls (touch).
- Compass, "location discovered" notices, a simple map of discovered places.
- Save and resume (position, discoveries, settings).

**Out (later milestones)**

- Enemies, combat, health, skills.
- Quests, inventory, loot, trading.
- Sound and music, day/night cycle, weather.
- Character creation, animation beyond a simple walk.

## 3. The world

### 3.1 Size

Tolkien's North Ithilien is on the order of 40 by 100 miles. The game compresses
this to **1.5 km east-west by 3 km north-south**. It began at 3.2 x 6.4 km; playtest
showed that was too much wilderness once the forest thickened and walls and ruins
were added, so v0.1 made it 2 x 4 km. In v0.5 the pace still felt slow, so it was
shrunk again by a quarter each way, with everything in it in proportion (half the
camps, ruins and farms, a hundred camps exactly). At a run of 7.5 m/s it is about
2.6 minutes river to mountains and 6.5 minutes north to south in a straight line,
and a good deal longer through woods.

### 3.2 Layout

North is up. Not to scale. (x, z) in metres from the north-west corner; the land
is 1500 by 3000.

```
            thinning forest, heath (z = 0)
   +--------------------------------------------------+
   |~~ fens     . heath .   village     ‖^^^^ /\/\/\  |
   |~~                                  ‖^^^^ /\/\/\  |
   |(CA)  Cormallen <~~~cut~~[HENNETH]~~‖~~~~ /\/\/\  |   Henneth Annûn (752, 894)
   |~~        farms, walls, lanes       ‖^^^^ EPHEL   |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ DÚATH   |   ^^^^ tall heather
   |~~   the home woods: woods + glades ‖^^^^ /\/\/\  |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ /\/\/\  |
   |~~   the deep woods: closed canopy  ‖^^^^ /\/\/\  |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ /\/\/\  |
   |[OSGILIATH]====== road ======= CROSS-ROADS ==> Morgul Vale (barred)
   +--------------------------------------------------+
   ~~ Anduin   (CA) Cair Andros   ‖ Harad Road (x ~1150)   /\ mountains
```

### 3.3 Boundaries

| Edge  | What it is | How it stops the player |
|-------|------------|-------------------------|
| West  | The Anduin | Wide deep water; the ranger will not swim it. |
| East  | Ephel Dúath | Slopes steepen until unclimbable. |
| South | Osgiliath–Minas Ithil road | The road itself is walkable; beyond it a soft turn-back ("Your charge lies north of the road."). The bridge at Osgiliath is broken; the Morgul Vale is barred. |
| North | The forest thins to heath | Soft turn-back as the land empties toward the Black Gate. |

Soft boundaries fade the player back with a line of text instead of an invisible wall.

### 3.4 Landmarks for Milestone 1

| Landmark | Where | Notes |
|----------|-------|-------|
| **Henneth Annûn** | Northern third, midway river to mountains | Start point and home. West-facing cliff, waterfall into a pool, cave behind the water reached by a hidden path. The view west through the falls is the showpiece. |
| Field of Cormallen | West, where the Henneth Annûn stream meets the Anduin | Broad green lawns among beeches. Safe. |
| Cair Andros | Island in the Anduin, north-west | Seen from the bank; not reachable in M1. |
| Harad Road | North–south, near the foot of the mountains | Old straight paved road, overgrown. |
| The Cross-roads | South-east corner | Ring of huge old trees; the seated stone king. |
| Osgiliath (eastern edge) | South-west corner | Broken walls and the ruined bridge-head; scenery in M1. |
| Morgul Vale mouth | East of the Cross-roads | Barred. A sickly glimpse, nothing more. |
| Northern fens | North-west by the river | Reeds and standing water. |
| 5–6 small ruins | Scattered | Old Gondorian works: a watch-tower stump, a fallen colonnade, a bridge pier, a roofless shrine, a stair to nowhere, a dry fountain court. Each a quiet place worth finding. |

### 3.5 Regions and vegetation

Ithilien is a garden gone wild, "a dishevelled dryad loveliness".

- **The great trees** (25-38 m): cedar, fir, oak/ilex, beech, larch, cypress,
  stone pine. Their canopies stand alone in glades and close into a roof in woods.
- **Understory**: bay, olive, hazel, juniper, tamarisk, young firs.
- **Underfoot**: thyme, sage (blue, red, pale), asphodel, ferns, flowers, heather,
  broom, reeds, mossy stones.
- **Anduin shore:** willows, beeches, reeds; the lawns of Cormallen.
- **Northern heath:** stone pines over heather and broom; open.
- **Home woods (centre):** small woods with wide glades among them.
- **Deep woods (south):** old forest. Fewer great trees than in the home woods,
  but giants (up to about a third taller and broader in the trunk), oak and
  beech most, their canopy closed high overhead; little grows under them but a
  few young firs and hazels, fallen trunks, stumps, mossy stones and ferns, so
  you can see a long way between the trunks.
- **Heather slopes (east of the Harad Road):** heather and gorse above head
  height, with winding ways between. Almost no trees.

Under a closed canopy the light turns dim and green-gold, the haze draws in, and
motes drift in the air.

### 3.5a Old habitation

26 farmsteads and 4 hamlets (46 and 6 before v0.5), generated from the world seed
(`world/oldworks.js`). Each farm has a roofless house, two to four walled fields
(walls standing, tumbled, or gone, in runs), an old olive orchard and a cypress
avenue to the door. Hamlets have a ring of houses, a well, a broken market cross
and two long lanes under great beeches. Standing walls block; you can jump them
or find a gap. Old fields grow fewer trees and paler grass, so they still show.

### 3.6 Danger (for later milestones, designed now)

Danger tier is computed from distance to Henneth Annûn, raised near the mountains,
the southern road, and the northern heath.

| Tier | Roughly | Expect |
|------|---------|--------|
| 0 Refuge | within 180 m of the falls (`REFUGE`) | Nothing hostile. |
| 1 Home woods | the north, to 190 m south of the falls | Stragglers in small camps. |
| 2 The middle land | to z 1650 | Bands, a stockade or two. |
| 3 The marches | to z 2250 | Stockades, Southrons. |
| 4 The shadowed edges | the far south and the Morgul road; the heather is a step worse than the woods beside it | War-camps, the worst of what fled the Gate. |

(Danger was first meant to grow with distance from the falls; since v0.1 it runs
north to south instead, as `dangerTier` in regions.js says.)

There are exactly 100 camps (`world/campSites.js`, `CAMP_COUNT`), none within
200 m of home. Size 1 is a fire and a shelter; size 3 is a stockade. Each blights
55 to 140 m around it, by size.

## 4. Look and feel

Target mood: a late-90s forest MMO zone and an early-2000s open-world RPG, with
small serene ruins, drawn with what a modern phone GPU can do. Stylised, not
photo-real: shapes are still simple and made in code, but they carry texture,
light and movement. Concretely (v0.3):

- **Grain on everything.** Each surface has a kind (bark, leaves, rock, masonry,
  timber, cloth, skin, metal, turf) and gets a matching grain from small
  textures generated at load, projected from three sides so no model needs
  texture coordinates. The grain also raises the surface (bump), so stone and
  bark catch the low sun. Moss gathers on the tops of rock and old stone.
- **Leafy trees.** Canopies are soft masses wrapped in cut-out cards of leaves or
  needles, which make the outline ragged; firs are drooping skirts of boughs.
  Leaves glow a little, more with the sun behind them. Trees sway in the wind.
  Near trees are drawn in full, far ones in a lighter form.
- **Grass that moves**, thick in glades and old fields, thin under the trees, gone
  from roads and paths, shrinking away at the edge of the field. Ferns have
  fronds, flowers have petals.
- **Stone that looks like stone.** Rocks are split along fracture planes, with
  flat broken faces and darker hollows. The walls of the pool and the cut at
  Henneth Annûn are skinned with layered, blocky rock; outcrops break the turf on
  the shelf above. Ruins are ashlar in courses with broken tops and ivy, fluted
  columns with bases and capitals, arches of wedge-shaped stones, chipped rubble.
- **Fog is the art director**, as before: warm distance haze; golden in the
  central woods, grey-green in the south, pale on the heath.
- **Low sun**, fixed late afternoon, in the west. Filmic tone mapping (ACES) keeps
  the sunlit greens from blowing out and the shade readable. Shadows on medium and
  high; phones start on medium.
- **Water** catches the light: small moving waves, a glint of the sun, the sky's
  colour where it is seen at a slant.
- **Characters** are rounded and tapering rather than boxes: knees that bend, a
  real hood, a cloak that swings, a bow slung across the back. Faramir, Éowyn
  and the enemy kinds stay distinguishable by colour and silhouette.
- **UI**: parchment-and-ink panels, a serif typeface, sparse HUD.

Everything is generated in code. No downloaded models, textures, or audio.

## 5. Controls

One abstract input state feeds the game; two front-ends fill it.

| Action | Desktop | Touch |
|--------|---------|-------|
| Move | WASD / arrows | Left thumb virtual stick |
| Look | Mouse (pointer lock; click canvas to capture) | Drag on right half of screen |
| Run / walk | Shift toggles | Push the stick to its edge |
| Jump | Space | Button |
| Interact / talk | E | Context button that appears when near something |
| Map | M | Button |
| Menu / release mouse | Esc | Button |

Camera: **third-person, over the shoulder, with a collision-aware boom (default)**;
scroll wheel / pinch zooms, all the way in to first person.

Touch devices are detected by capability, not user agent; a device with both gets both.

## 6. Technical approach

### 6.1 Stack

- Three.js, vendored at a pinned version in `vendor/`, loaded by import map.
- Vanilla ES modules, **no build step (default)**. Runs from any static server and
  from GitHub Pages as-is.
- HTML/CSS for all UI over a full-window canvas.

### 6.2 Terrain

- One pure function `heightAt(x, z)` defines the ground everywhere. It combines:
  a west-to-east rise, seeded noise at several scales, a steep mountain wall in the
  east, carved river and stream valleys, flattened roads, and hand-placed "stamps"
  for landmarks (the Henneth Annûn cliff and pool, the Cormallen lawns, ruin sites).
- Rendered as a grid of chunks (about 160 m square) built on demand around the
  player and dropped behind, with a coarser ring for the distance. Fog hides the edge.
- Ground colour comes from height, slope, and region, written to vertex colours.
- Collision with the ground is just `heightAt`. Steep slopes cannot be climbed.

### 6.3 Henneth Annûn (the one hard piece)

- `terrain.js` raises a level shelf of rock and cuts into it a basin (the pool,
  walled on all sides) and a gorge leading west whose floor falls gently until
  the surrounding land has dropped to meet it.
- The cave is a set of boxes under the terrain east of the basin: room, window
  behind the fall, and an L-shaped passage to a door in the cliff. A "hollow"
  in `collision.js` tells the game to ignore the ground overhead when inside.
- The terrain mesh leaves a slot where the cliff face is built by hand, and a
  hole (`HA.hatch`, on the mesh's 4 m grid) where the hidden stair comes up.
  Over the slot lies a strip of turf on the same grid, heights and colours as
  the ground beside it (`cliffCap` in terrainMesh.js), with a lip of earth over
  the rock's edge, so no seam shows on the forest floor.
- The pool is an oval (`HA.pool`, `poolQ`) reaching east right under the
  cliff, so the fall drops into deep water.
- A narrow stair of worn stone (`HA.stair`, `stairTop`) runs along the foot of
  the south wall of the basin, from the floor beside the pool up to the cave
  door. The wall comes in to meet it (`southWallEdge` in terrain.js): its face
  rises from the stair's outer edge just above each tread, all the way up, and
  its rock skin stands proud only above head height there. Inside, the hall runs
  on east as a second, narrower stair in the rock (2.6 m wide, roofed), which
  climbs 12 m to a stone-lipped hole in the forest floor above the cave, crowded
  by bushes. No old path leads there.
- From the window behind the fall a ledge steps out through a notch in the pier,
  on to a shelf with a low parapet beside the fall, over the pool.
- So there are two ways home: down the hole in the forest floor, or up the cut
  from where the stream runs out of it, about 350 m downstream.
- Inside the cave the sun and sky light are dimmed, so torchlight carries it.
  All six torches light what is near them at once. Rather than six real lights,
  which every material in the open world would pay for, the torchlight is a
  term in the shared surface shader (`surface.js`), switched on by a uniform
  only near the cave.

### 6.4 Vegetation and props

- `InstancedMesh` per species per chunk. Placement is deterministic from the world
  seed and chunk coordinates, thinned by slope, water, roads, and region density.
- Trees collide as circles. Grass and herbs do not collide.
- Density scales with a quality setting (auto-lowered on phones).

### 6.5 Water

- The Anduin: a broad flat plane with a slow scrolling surface.
- Streams: follow carved channels in the terrain; simple ribbon meshes.
- Wading is allowed in shallows; deep water turns the player back.

### 6.6 Player and NPCs

- Capsule-style character: ground-following, slope limit, circle collisions with
  trees and props, wall segments for ruins and the cave.
- Simple procedural walk animation (limb swing), no skeletal assets.
- NPCs in M1 stand in place, turn to face the player, and show a dialogue panel.

### 6.7 Saving

- `localStorage` rather than a cookie: larger, not sent over the network, simpler.
- One key holding versioned JSON:
  `{ version, savedAt, player: {x, z, heading}, discovered: [...], settings: {...} }`
  with room for `quests`, `inventory`, `cleared` (camps), and `stats` later.
- Autosave every 30 s and when the page is hidden or closed. "New game" in the menu.
- Corrupt or missing save falls back to a fresh start at Henneth Annûn.
- Saves are per browser. A later milestone can add export/import as a text code
  for moving between devices.

### 6.8 Performance

- Targets: 60 fps laptop, 30 fps mid-range phone.
- Device pixel ratio capped (2 on desktop, 1.5 on phones).
- Three quality levels controlling view distance, vegetation density, and shadows
  (shadows off on low). Chosen automatically, changeable in the menu.
- Draw calls matter as much as triangles in a phone's browser: plants are drawn
  one mesh per species and form for the whole land, culled plant by plant.
- `?bench` times seven fixed views on any device, then two runs through new land
  for the slow frames; `tools/chrome.mjs` runs it (or anything else) in this
  machine's Chrome on its real GPU, `--cpu 5` slowing its main thread like a phone's.
- New land is built a little each frame as the ranger moves (a row of ground or
  of plants at a time), never a whole chunk in one frame.
- A debug overlay (toggle with a key) showing fps, draw calls, triangles, position,
  region, and danger tier.

### 6.9 Testing

- Node unit tests for pure logic: `heightAt` determinism, region/danger functions,
  save round-trip and migration.
- A Playwright smoke test: page loads with no console errors, the canvas draws,
  holding "forward" moves the player, a reload restores the position. Run once
  with a desktop viewport and once with a touch phone viewport.

## 7. Milestones

Each ends with something you can open and play.

**M0. Skeleton.** Folder, vendored Three.js, page, render loop, resize handling,
debug overlay, a flat test ground with a walking player on desktop and touch.

**M1. The land. (built)** Everything in section 2 "In".
Suggested build order, each step viewable:
1. Terrain function and chunked rendering; fog and sky.
2. Player controller and camera on real terrain; both control schemes.
3. Anduin, streams, mountains, roads, boundaries.
4. Vegetation by region.
5. Henneth Annûn set piece; Faramir and Éowyn with greeting dialogue.
6. Ruins, the Cross-roads, Osgiliath edge, empty camp sites.
7. Compass, discovery notices, map, save/load, menu.
8. Performance pass on a phone-sized profile; smoke tests.

**M2. Tasks and things. (built)** Dialogue trees, a quest log, a first handful of tasks
from Faramir and Éowyn (scout a place, find a stash, light a beacon), inventory,
stashes to open, items to carry home. Still playable on mobile.

**M3. The enemy. (built)** Health, melee and bow combat (keyboard and mouse), a few enemy
types with simple AI (idle at camp, notice, pursue, attack, give up), camps that
can be cleared and stay cleared, loot drops, traps, death and return to the falls.

**M4. Gear and trade. (core built)** Weapons and armour with stats, equipment screen, trading
at Henneth Annûn using renown earned from tasks, enemy tiers matched to danger.

**M5. Atmosphere.** Sound and music, day/night, weather, more ruins and secrets,
more animation, tuning.

**M6. Provinces, captains and settlement. (designed, see section 11)** The land is
split into eight provinces, each held by a captain. Freeing a province brings
settlers from Gondor. The tasks are rebuilt around the provinces, and Faramir's
story is expanded into three acts.

## 8. Risks

- **The cave.** Getting collision and the see-through waterfall to feel right may
  take a couple of passes. It is the home base, so it is worth it.
- **Phone performance.** Forest density is the main cost. Fog distance and
  instancing are the levers; I will measure early (M1 step 4).
- **Emptiness.** A 15 km² map with six ruins could feel thin. If so, shrink the
  map or add points of interest; both are cheap by design.
- **Headless testing.** Automated screenshots use software rendering, so they
  confirm correctness, not frame rate. Real-device feel needs you.

## 9. Decisions

| Question | Decision |
|----------|----------|
| Camera | Third person, zoom in to first person. |
| Visual style | v0.1-0.2: clean low-poly, flat shaded. From v0.3: stylised but rich: generated grain and bump on every surface, leaf cards, grass, filmic light, rounded figures. |
| World size | 1.5 × 3 km (v0.5; it was 3.2 × 6.4, then 2 × 4 after the first playtest). |
| Forest | Dense and tall, closing overhead; a once-farmed land going back to woods. |
| Camps | A hundred, exactly (v0.5; there were about 190 on the 2 × 4 km land). |
| Tooling | No build step. Three.js r170 vendored. |
| Hosting | GitHub Pages from the repo root, with a landing page linking each game. |
| Combat | Aimed, real-time, especially the bow. On touch, one Attack button picks target and weapon. |
| Death | The ranger wakes at home and loses nothing. |
| Camps | Cleared by defeating everyone in them, not by a key press. Many small ones north of home; larger to the south. |
| Archery | Aim mode on all devices; head kills, heart wounds deeply; great trees stop arrows. |
| Quick travel | Home from the menu when not in a fight. Starting over only from the cave. |
| Player | A fixed, unnamed ranger for now. |
| Tone | Upbeat: the war is won. Occupied land is grey and sour; cleared land turns bright and healthy again. |
| Sharing | Personal project, not for publication. |
| Provinces (M6) | Eight, laid over the terrain regions (which stay, for plants and look). The far north stays one province: it is open, and smoke is seen a long way off. |
| Freeing a province | Its captain dead **and** 75% of its camps broken. The rest are remnants. |
| Retaken camps | While a province's captain lives, broken camps near the hold are sometimes retaken. Never after. |
| Settlements | Rest (full health), save, quick travel, trade. Villagers give tasks, seed tasks among them. |
| Healing | No self-healing (removed in v0.4.1). Health comes from food and draughts, and from resting on the mats at Henneth Annûn (and later in settlements). |
| Province names | Tolkienesque: Sindarin where the books would have one, English where they would translate (section 11.1). |
| The Marshal | Yes: an Uruk war-chief over the captains, met at the mouth of the Morgul Vale. |
| Companions | A few rangers fight beside you at the Cross-roads, at the Vale, and holding Osgiliath. Archers who keep their distance while the ranger wades in. |
| Osgiliath | A settlement of its own (the ninth). The bridge is rebuilt in stages; the last span is laid only when every camp is cleared. |
| Finale | Every province freed and settled. Every camp is an extra last goal after it. |
| Plants | One or two found only in each province, plus shared ones. Every plant grows back: one picked means one grows somewhere else in the same province. |

## 10. What is built

### The land (M1, with playtest changes)

- Terrain, the Anduin, five streams, the Ephel Dúath, both roads, soft boundaries.
- Henneth Annûn: hidden pool, the cut, the stair to the door, the hidden stair
  in the rock up to the forest, the ledge beside the fall, the cave.
- Forest of great trees with understory, herbs and litter; fens; Cormallen;
  heather slopes where the camera rides above the bushes.
- 30 old farms and hamlets; seven named ruins; 27 lesser ruins of ten kinds; the
  Cross-roads, the edge of Osgiliath, the barred Morgul Vale, Cair Andros.
- 16 km of half-seen old paths (`world/paths.js`) joining all of the above and
  the two ways out of Henneth Annûn. They thin the trees, show on the ground
  and the map, and carry worn slabs and small cairns.

### The enemy and the fighting (M3)

- 100 camps hold about 450 enemies (`data/enemies.js`): orcs, orc archers (in a
  pale cowl, to be picked out), Uruks, Southrons, and a captain in each stockade.
- **Where they are** (`world/campSites.js`): danger runs north to south. The
  woods north of Henneth Annûn are a hunting ground of many small camps (two or
  three orcs, no archers). Southward the camps grow: bands, stockades, and a few
  war-camps of a dozen. Camps lie in knots with pickets, not at even spacing.
  East of the road they lair in old diggings with a fire out front. Fewer than
  half of all camps have archers.
- Each lit camp has a flame and a column of smoke standing above the trees, pale
  hide shelters and (from size 2) a red standard, so it can be found by looking.
- A camp's company appears when the ranger comes within 120 m and is forgotten
  beyond 190 m. They notice at 27 m (13 m if you walk), rouse the whole camp,
  chase, strike with a visible wind-up, and shoot. They give up 80 m from camp
  and will not come within about 200 m of the falls.
- **Bands on the Harad Road**: while the ranger is near the road, a band comes
  marching down it every minute or so (since v0.8 always southward, set down ahead
  of the ranger so it is met). Usually two to four; about one in eight
  is a host of ten or more with a captain, announced so the ranger can get clear.
  Beating a band is loot and practice (and what they carry: v0.8); it clears no camp.
- **Scouts** (v0.8): parties of one to three going between the camps of a province
  not yet free, round Henneth Annûn; some are couriers between two holds, whose map
  marks the hold they were bound for.
- When the last of a camp's company falls, the camp is cleared for good. Since v0.8
  the ranger then breaks it up (the prompt, near it): only then are its stores taken,
  its shelters fold away, its fire goes out, and the blight (55 to 140 m by size) lifts.
- Sword: click or F. Bow: hold to draw, release to loose; over-shoulder camera
  and an aiming mark; arrows fly in an arc and are spent. Q or 1/2 to change.
- **Aim mode** (hold right mouse, or R; the Aim button on touch): the view closes
  in and steadies. On touch the left thumb pad (or a drag) aims, the bow bends
  by itself and Attack looses. A chosen shot to the head kills outright (a
  captain's helm turns it: triple damage instead), to the heart of the body does
  1.6 times, to a limb 0.8. The one-button touch attack never gets these.
- The trunks of great trees stop arrows, both sides'. Saplings and bushes do not.
- Touch: one Attack button. It picks the nearest enemy, shoots if they are far
  and there are arrows, and strikes if they are near.
- Health mends slowly out of combat; waybread and draughts mend it faster (H).
  At no health the ranger falls and wakes in the cave, losing nothing.
- **Quick travel**: away from home the menu offers "Return to Henneth Annûn"
  (not while any enemy has seen you). "Begin anew" is offered only in the cave.

### Things, tasks and trade (M2, M4, rebuilt for v0.2)

- **Gear** (`data/items.js`): 17 swords (damage 14 to 50), 11 bows (16 to 50),
  and armour in three slots that add up (body to 32%, helm to 10%, greaves to 8%;
  50% at most). Several pieces share each damage level, with different looks:
  curved, broad, long or short blades; horn bows with pale tips; black mail,
  bronze scale, blue brigandine; caps, nasal helms, a winged helm; greaves. What
  is worn shows on the ranger (`rangerLook` in `entities/figure.js`).
- **Where gear comes from**: Mablung sells most of it, gated on renown from 0
  to 48 (`SHOP`). Some only falls from the enemy, rarely (orc, Uruk, Southron
  and captains' gear). The best pieces are gifts for the told tasks, and the
  last of them (the King's gift, the King's mail, the Galadhrim bow) come only
  at the end. A few gifts come every fifth errand.
- **Wear**: a sword dulls by each blow that lands, a bowstring by each shot,
  over about 300 uses; a worn weapon does about 60%. The HUD says "dull",
  "slack" or "worn". Mablung mends at his bench for silver; at renown 6 he
  teaches field repair (45 silver), after which he sells whetstones and spare
  strings to use from the pack.
- **Honing**: Mablung hones a sword or restrings a bow, +1 damage a step, up to
  +3, at renown 4, 14 and 28 (30, 90 and 220 silver).
- **Renown** (`systems/renown.js`): deeds earn points, and points make a level
  from 0 to 50 (`25n + 1.2n²` points for level n). Kills 2 to 9, camps 4 to 48,
  road bands 6 (a host 40), old places 3, farms and villages 2, told tasks 15 to
  300, errands 14 rising to 60 (since v0.5, with half the camps, each camp, kill
  and place is worth about 1.6 times what it was). The camps come to about 2,050,
  the told tasks 1,750 and the places 160, of the 4,250 for fifty: the rest is
  errands and the road. The pack shows renown with a bar toward the next level.
- **The enemy grows with renown**: health +1.2% and damage +0.9% a level; from
  renown 15 each camp of size 2 or more holds one more for each 15, small camps
  one more from 25, and road bands one more for each 20.
- **Told tasks** (`QUESTS`): since v0.7, two threads by province (see "v0.7" below
  for the whole order). Faramir's runs to 13: the nearest fire, the hold of the
  Window Woods found, each province freed in `CAMPAIGN` order (with the road and the
  road bands between the north and the middle), the Marshal last, and then every
  camp. Éowyn's runs to 15: kingsfoil, then for each of the six provinces of the
  woods its map (old places there and its settlement's site) and its settlers led
  home, then every old place, and every settlement grown.
- **Errands** (`ERRANDS`, built in `systems/quests.js`): lesser work that never
  runs out, one in hand from each giver at a time, each a little bigger than the
  last, and (since v0.7) only when the giver has no told task to offer. Faramir: trophies for the count (orc blades, trinkets, Red Eye badges,
  blackened arrowheads that only road archers carry, coins, captains' tokens,
  gold), camps broken in a named region, bands on the road, a scout's report of
  one camp, another captain. Éowyn: seed of a kind, more kingsfoil, a ruin of a
  named kind, old places in a region, another village or farm. A kind that
  cannot be done is skipped.
- **Hints**: ask about a task in hand and they remind you; ask again and they
  give a direction from the falls ("to the south-east of here, a long walk");
  a third time and they mark it on your map, and the tracker follows the mark.
- **Faramir's map**: after the first task he will show his map, which always
  has camps you have not found (three, one more for every 25 broken), the nearest
  to home first. They are copied onto yours as dashed red rings. Toward the end
  this is how the last camps are found.
- **Plants**: kingsfoil (about 200) and four seeds for Éowyn: wild thyme in the
  northern glades, bay in the woods, poppies about the old farms, wild olive in
  the south (26 to 41 of each). Walk over them; seed has a gold glimmer.
- Saves are version 4. Older saves start a new ranger and keep their settings.

### Streams

Streams are traced, not drawn (`world/terrain.js`): each starts at a spring under
the mountains and is walked downhill over the base terrain, joining any stream it
meets. Its bed is a running minimum along the course, so it never rises, and the
ground is cut down to it in a small valley. Where a trace comes round in a loop
it has found a hollow: the loop is cut out and a pool (6 to 13 m) lies there
instead, 16 in all. Streams that come within 28 m of another join it; nothing
joins the home stream above its fall, and others are steered away from it. Water is a ribbon a fixed depth above
the bed. The home stream keeps a fixed course across the shelf, over the fall and
through the cut, then is traced from the cut's mouth to the river. Ruin sites are
levelled to the ground as it stands and streams are traced round them.

### The testing page

`debug.html` (or `index.html?dev`) runs the real game with its own save and a
panel of shortcuts (`src/dev.js`): click the map to travel, jump to any named
place, set renown, hand out items or the best kit, take or finish any task,
toggle haste and taking no hurt, go to the nearest camp, slay or clear, and call
up a band or a host on the road.

### v0.1 changes after the third playtest

- Enemies that make no progress for a second jump (clearing a low wall); after
  four seconds they are set down a step or two aside on open ground.
- The hit word ("Head!", "Heart") is faded by the game loop, not a CSS
  animation, which some browsers did not redraw until something else did.
- Every task in hand is listed under the health bar with its count.
- Stream loops became pools; near-parallel streams join; the cut below
  Henneth Annûn is about 210 m long (was 320), 13 m wide at the top (was 20),
  and winds (`gorgeZ` in layout.js).
- Leaner economy: less silver and fewer arrows from the fallen and from
  stores; quest silver cut by about 40 per cent; prices raised a little.
  Mablung's stock runs to renown 15 with seven new pieces of gear and a great
  healing salve. Gear already owned is greyed out. Breaking a stockade or
  war-camp is worth 1 renown.
- The old places are laid out on a grid first (4 across, 10 down) so none of the
  land is more than about 300 m from one. Any old place found, and Henneth
  Annûn, can be travelled to by clicking it on the map (not in a fight).

### Toward v0.2: fixes after the fourth playtest

- Only an enemy chasing the ranger jumps when stuck, and not while crowding
  the ranger (within 3 m). Enemies idling in camp never jump; those walking
  home or marching are only set aside after four seconds stuck.
- Kingsfoil is about twice as common (370 plants, was 196); it now also grows
  in the deeper southern woods (forest density up to 0.93, was 0.8). The six
  plants beside Henneth Annûn are unchanged.
- More archers: small camps from tier 2 have one 60% of the time (was 35%),
  middling camps 80% (was 60%) and a second in tier 3, large camps a second 75%
  (was 50%). The smallest tier-1 camps still have none. 123 archers in all (was 93).
- On an upright phone the HUD stacks: health and buttons on the first row, then
  the compass, the place name, and the task list.
- Phone browser bars: overlays are sized to the visible screen (`dvh`), so the
  map's Close button is not hidden under Safari's toolbar. On Begin, a touch
  device that allows it (Android, iPad) goes full screen, and the menu has a
  Full screen button. An iPhone cannot hide Safari's bars from a page, so the
  game has a web manifest and home-screen tags: added to the home screen, it
  opens with no bars, and the menu says how. (A home-screen copy keeps its own
  save, apart from Safari's.)

### v0.2: second round

- The home stream no longer has another stream join it: others are kept 75 m
  off. Where a stream entered a pool, its water dropped into the pool's bowl
  and ran on underground below the bed; now the water ignores pool bowls, and
  no stream sample has water below the ground (it was 10%).
- The hidden stair, the ledge, the gear, renown, errands, hints and Faramir's
  map, as above.
- Fight call-outs: a short line below the middle of the screen says when a camp
  or road band first sees the ranger (or is roused by a blow), and names each
  enemy felled ("Orc archer felled"). Up to three lines; each fades in about
  three seconds.

- Loading on Safari (iOS) stalled at "Gathering the land" after the v0.2
  release. Most likely a mix of fresh and cached files: modules now carry the
  release in their URLs, and a load failure is shown on the title. Also, a
  change of weapon asked for mid-stroke now happens when the stroke ends,
  instead of being lost.

### v0.2a

- Enemies no longer mend when they give up a chase and go back to their fire.
  A camp's wounded and dead are remembered when the ranger walks off (the
  company is forgotten past 190 m and rebuilt on return): the camp mends only
  once the ranger is more than 1 km from it, or back at Henneth Annûn (within
  150 m, or by falling or going home from the menu or map). So a company can
  be picked off from afar, a few arrows at a time. Road bands are not
  remembered: once out of sight they have marched on.
- Loot picked up (trophies for an errand, kingsfoil-like goods) updates the task
  tracker at once; before, the count waited for something else to refresh it.

### v0.3: visual polish

- **Materials** (`world/surface.js`): one Lambert material family with a patch:
  triplanar grain from a generated RGBA texture (rock, leaf/turf, bark, masonry
  channels), bump from the grain, moss on upward faces, wind sway for plants,
  a glow on leaves against the sun, and shrinking with distance for small
  things. `GeoBuilder` writes a surface kind per vertex and real normals, so a
  part can be smooth (canopies, figures, columns) or faceted (cut stone).
- **Terrain**: 2 m grid near the ranger on medium and high (was 4 m), turf grain
  on the flat and rock grain on the steep.
- **Vegetation** (`world/vegetation.js`): every species rebuilt with a near and
  a far form; new: young broadleaf saplings, bramble with roses, a second
  boulder, scree. Understory is denser (up to about half again as many) and
  ground cover is on a 3.2 m grid (was 4 m). Rocks and boulders are fractured
  stone (`world/rocks.js`).
- **Grass** (`world/grass.js`): 24 m tiles of instanced clumps within 22 / 38 / 50 m
  (low / medium / high), density from forest, fields, lawns, paths, roads, camps.
- **Henneth Annûn**: the cave rock is finer and layered; rock skins over the
  walls of the pool and the whole cut; fractured boulders on the rim, scree in
  the cut, outcrops on the shelf. The stair and door keep their exact shape.
- **Ruins and farms**: ashlar walls with broken tops, fallen blocks and ivy;
  fluted columns with torus bases, echinus and abacus; arches of wedge stones;
  weathered standing stones; chipped rubble. Footprints and colliders are
  unchanged.
- **Figures** (`entities/figure.js`): rounded bodies with knees, hood, swinging
  cloak; head height unchanged, so aimed shots work as before.
- **Light**: ACES filmic tone mapping (exposure 1.35; `?exposure=` to try
  others); phones now start on medium, which has shadows (1024 map). Low quality
  uses a lighter shader (one grain sample, no bump) for older devices.
- **Sky**: soft fair-weather cloud drifting east, thinner under the blight.
- **Water**: waves, sun glint and sky reflection on the river, streams and pools.
- **Never stuck**: a trunk's push can no longer shove the ranger or an enemy
  into a wall (it could, and then every step counted as blocked). If the ranger
  is ever inside a solid, they are freed at once to where they last stood clear,
  or the nearest open spot. Enemies are set down clear of walls, rocks and
  trunks when a camp's company appears.

### v0.3, second round (after playing it on a phone)

- **Frame rate**: the menu has "Show frame rate", off at first and remembered
  (saves are version 5; v4 saves carry over whole). The counter sits bottom left.
- **Plants change form tree by tree**, not a chunk at a time: in full near the
  ranger, then a middle form (the same tree with fewer, larger leaf cards and no
  twigs) out to 330 m on high (240 medium, 160 low), then the far form. Great
  trees are in full to 115 m on high. Herbs show within 56 m and shrink away.
- **Grass reaches 80 m on high** (60 medium, 34 low): thick fine blades near
  the ranger, fading into fewer, broader clumps beyond about 34 m, which fade
  out at the edge. No grass over the hidden stair's mouth or the cliff's slot.
- **Conifers** are whorls of drooping boughs, each at its own angle and length,
  with sprays of needles (fir, larch, young fir); cedars spread great level
  plates; cypresses are a flame of many small masses; junipers ragged clumps.
- **People**: elbows that bend, fuller knees and shoulders; one smooth head with
  a brow, nose, cheekbones and real eyes (white and iris) under brows, and a
  soft mouth; the cloak streams behind when running.
- **Weapons**: the bow is in the hand only while drawing (and a moment after
  loosing), otherwise slung across the back; it is a curved bow facing the mark
  with its string to the archer, drawn back to the cheek with an arrow on it.
  The sword is drawn in a fight and sheathed at the left hip otherwise (back in
  the scabbard four seconds after the fight). Blades are shaped and bevelled
  (the scimitar one smooth curve), with guards, bound grips and pommels. The
  quiver shows every arrow when there are fewer than ten, and looks full
  otherwise. Enemy blades come out when they are roused; their archers take the
  bow off the back to shoot.
- **Helmets** have straight sides down over the ears and the back of the neck,
  open at the face, a crown (conical for a nasal helm), a brow band, and crests,
  horns or wings as before.
- **Henneth Annûn**: the top of the rock follows the forest floor, so there is
  no see-through gap beside the fall; the rock grain is laid at two scales so
  its repeat does not show, with less banding, damp moss patches on the walls,
  ferns on the ledges and ivy down the faces; boulders round the pool and blocks
  fallen into the cut; the stream's channel runs out of the pool with no lip;
  rings spread across the pool from the fall, with foam at its foot; the stair,
  treads and ledge are bare cut rock; the cave is lit from its torches (their
  glow laid into the rock, and one real light at the torch nearest the ranger;
  in v0.3a every torch lights the cave);
  the hall and the hidden stair are taller, with a finer-stepped roof, so the
  camera does not jump about.

### v0.3a: fixes after a look round Henneth Annûn

- **Torches**: every torch in the cave lights its part of the cave at once,
  each flickering on its own (the torchlight term in `surface.js`); the one
  moving real light is gone.
- **Moss stays put**: grain and moss are laid on by where a point rests on its
  object, before it sways or shrinks with distance, so they no longer slide over
  small stones; boulders and rocks keep their full shape in the middle distance
  instead of changing to a coarser one, which moved their moss about (a few
  per cent more triangles in the woods).
- **The cliff top**: turf laid over the slot left for the cliff, matching the
  ground beside it, with grass on it; no strip of other green, no gap.
- **Boulders round the pool**: about a hundred stones of the woods' grey, mossy
  kind, big ones with smaller fallen beside them, some in the shallows, clear of
  where the fall strikes, the foot of the stair and the way out. A local helper
  named `addRock` in hennethAnnun.js had hidden the boulder builder of the same
  name, so since v0.3 none of the rim boulders, blocks in the cut, scree or
  shelf outcrops had been drawn, though their colliders were there. They are now.
- **The stair** lies against the south wall all the way up (see 6.3).
- **The pool** reaches the cliff, so the fall drops into it.
- **Streams and pools meet edge to edge**: a stream's ribbon now ends (or
  begins) exactly on the edge of the pool's water, its corners slid onto the
  curve, instead of a metre or two inside it; at Henneth Annûn too. Running
  water moves at under half its old speed.
- **Faramir** looks the Prince of Ithilien: a knee-length green coat edged with
  silver at hem, collar and cuffs, a white tree on a dark field at his breast,
  a silver circlet with a white stone, a long dark cloak with a jewelled brooch,
  a silver-hilted sword at his hip, hair to the collar, and a little more height.
- **The quiver and the slung bow ride over the cloak**, laid along it; the cloak
  streams out mostly from the hips down (bent row by row, `bendCloak`), so it
  stays under them even at a run. The smoke test measures the clearance.

### v0.3a, second round (after playing it on a phone)

- **Nothing floats on the cliffs**: the ferns and tufts on the ledges of the
  basin and the cut used the swaying plant material, whose sway grows with
  height above the mesh's origin; built where they grow, that was the whole
  cliff, so they swung metres through the air. They are still now (the smoke
  test looks for any such mesh). No grass on the steep walls of the basin and
  the cut either.
- **Trees fade from one form to the next** instead of jumping: across a band
  about 12 m wide at each change, a plant is drawn in both forms, each keeping
  its share of a fine screen dither that shifts across the band (the `lod`
  attribute and the uniforms in `surface.js`; `assignVegetation`). Stone keeps
  one shape near and middle; plants planted by hand (`plantTrees`) never fade.
- **Medium is lighter**: full trees to 62 m (was 80), shrubs to 40 (was 50), the
  middle form to 210 / 140 (was 240 / 160), grass to 44 m (was 60), herbs to 42;
  and only the near form casts shadows (the middle form too on high). In the
  deep woods that is a few per cent fewer triangles drawn, a fifth of the plant
  geometry drawn into the shadow map, and about 40 % less grass.
- **The picture follows the frame rate**: below about 40 fps for two seconds it
  is drawn a quarter step coarser, down to `minPixelRatio` (1.5 on medium and
  high, 1 on low); after ten seconds above 57 fps a step finer again. The debug
  overlay shows the resolution in use. (Headless Chromium has no GPU, so this
  was checked for behaviour, not for the frame rate gained.)
- The title screen shows v0.3a (a unit test now holds it to `VERSION`).

### v0.3b (after another phone playtest)

- **The deep woods are old forest**: about 40 % fewer great trees, but giants
  (drawn up to a third taller, a sixth broader in the trunk; the far forest
  roof over them stands higher to match), and about a quarter of the understory,
  mostly fallen trunks, stumps and stones; grass thinned to ferns and leaf
  litter. You can see far between the trunks. In the deep woods on medium that
  is about a fifth fewer triangles drawn, and far fewer overlapping leaf cards.
  The home woods keep their riot of younger growth. (The smoke test counts both.)
- **Shadows come in gently**: the middle form of the trees casts shadows again
  on every quality (v0.3a's second round had dropped it on medium, which made
  shadows appear suddenly about 70 m off, for little gain), and all shadows fade
  out toward the edge of the sun's shadow map instead of ending at a line.
- **Small plants and grass are not seen growing**: herbs, flowers and small
  bushes show within 60 m on medium (was 42; 40 low, 72 high) and grow in over
  the last third of that; the fine grass blades reach 32 m (was 20) and the
  broader clumps 62 m (was 44), each fading over twice the distance it did.

### v0.4.0: provinces (M6, step 1)

- **Eight provinces** (`world/provinces.js`, pure), bordered by the streams that
  cross the whole land, the Harad Road, and a strip along the southern road
  (section 11.1). `provinceAt(x, z)` reads a table of each border stream, so it
  is cheap enough for every frame.
- **Each has a hold**: its strongest camp. A province is **freed** when its hold
  is broken and three in four of its camps (`systems/provinces.js`, worked out
  from `state.cleared` like the tasks; nothing new is saved).
- **The place line** names the province instead of the terrain region (the
  terrain names stay in `regions.js` for plants and look). Crossing a border, after
  a second on the far side, a notice gives its name, a line about it, and how it
  stands.
- **Breaking camps tells you** when a hold falls ("N more camps and X is free"),
  when only the hold is left, and when a province is freed.
- **The map** draws the borders (a red dash-dot), the provinces' names with how
  many camps of the needed number are broken, a green wash over freed ones, and
  each hold as a square once found (red standing, green broken).
- **The pack** has a section, The land, with each province's state and a bar
  toward freeing it.
- `PLACES` (every old place, now with its province) moved from `systems/quests.js`
  to `systems/provinces.js`; quests.js re-exports it.
- Testing page: pick a province to go to its hold or free it.
- Removed nothing yet: self-healing stays until settlements give a place to rest
  (step 5).

### v0.4.1: after the first province playtest

- **No self-healing.** Wounds stay until mended: by food (orc bread 10, waybread
  22), Éowyn's draughts (60), salves, or **resting on the mats** along the south
  wall of the cave (walk onto one: "Rest a while" brings full health).
- **Orc bread**: orcs, archers and Uruks carry it (about one in five), and a
  broken camp's stores often hold some. Worth 1 silver.
- **A harder start**: orcs have 40 health (was 30), archers 30 (was 24). Even
  the smallest camps near home keep an archer about half the time, and every
  band of size 2 has one (sometimes two). Road bands are a little more often
  archers. An arrow that finds neither head nor heart does 0.75 of its damage
  (a limb, aimed low, 0.6); a head shot still kills, a heart shot still does 1.6.
  The ranger's bow now takes four body shots, or two to the heart, to fell an orc.
- **Faramir keeps to the provinces**: after the five camps (f2) he asks for the
  Window Woods to be freed (f14, a new `freed` objective), then Forlad (f15),
  and only then the Harad Road (f3) and the stockade (f4). (The rest of the told
  chain is rebuilt in step 4.)
- **Errands keep to the working province**: the first in Faramir's order
  (`CAMPAIGN` in world/provinces.js) that is not yet free. Faramir's camps,
  scout's reports and captains are there; trophies are only asked for if those
  in the province carry them (no captain's tokens or Harad gold in the north).
  Éowyn's ruins, villages, farms and old places are there, and her seed errands
  ask for a seed that grows there. Province names replace the old terrain names
  ("Fires in Eryn Henneth", not "Fires in the Deep Woods"). A `where` or `set`
  ending `@<province>` counts only that province; `region:` is still read for
  errands taken before.
- **Steeping**: Éowyn steeps all your kingsfoil at once, two plants to a draught,
  keeping an odd one back.

### v0.5: a smaller world

The pace was too slow: too long walking between things worth doing. The land is
now **1.5 km by 3 km** (was 2 by 4), and everything in it is scaled to match.

- **The layout** keeps its shape at three quarters the size: the Anduin, the
  Harad Road (x about 1150), the southern road (z about 2906), the mountain wall
  (from x about 1270), the named places, and Henneth Annûn at (752, 894), still in
  the northern third, halfway from river to mountains. Henneth Annûn itself, the
  pool, the cut, the cave and every ruin, farm and camp keep their own sizes;
  only where they stand has changed. Everything about the falls is now laid out
  from `HA.x` and `HA.z` in layout.js (on the terrain's 4 m grid). The land rises
  as high over the shorter run, so the hills are a little steeper.
- **Exactly 100 camps** (`CAMP_COUNT`): the land is scattered with camps at the
  same spacing as before, which makes about 115, and the stragglers that lie
  nearest another are thinned out until there are a hundred. 50 small camps, 30
  bands, 17 stockades, 3 war-camps (Faramir's "three war-camps" is true again;
  there were five). About 450 enemies.
- **The rest in proportion**: 26 farms and 4 villages (were 46 and 6), 27 lesser
  ruins on a grid of 3 by 8 (were 48 on 4 by 10), 16 km of old paths (26), about
  200 kingsfoil (370) and 26 to 41 of each seed plant, 21 streams and 16 pools.
  The springs were placed so that five streams still cross the whole land where
  the province borders want them (z about 755, 1324, 1704, 2297 and 2694 at the
  middle); the fens end a little further north (z 500) so the northern border
  stream runs along their edge instead of being drawn into them.
- **The refuge** is 180 m (was 220), camps keep 200 m off (was 250), the enemy
  will not come within 170 m (was 210), and a camp's wounds are kept until the
  ranger is 750 m away (was 1 km). Directions in hints scale too ("not far" under
  270 m, "a fair walk" under 680, "a long walk" under 1280).
- **Renown and silver**: with half the camps, each camp, kill and old place is
  worth about 1.6 times as much renown (kills 2 to 9, camps 4 to 48, places 3,
  farms 2) and the fallen and their stores carry about 1.6 times the silver, so
  the totals over the game are what they were (camps about 2,050 renown and
  3,000 silver) and the best gear still comes near renown 50.
- **Tasks**: Faramir's count of fires is 15, 30 and 50 ("half the fires", was 30,
  60 and 100); Éowyn's old places are 10 and 20 (were 15 and 30). Faramir's map
  shows one more unfound camp for every 25 broken (was 40).
- **The map** is drawn at 0.4 pixels a metre (was 0.3), so it is the same size
  on screen as before. A landmark's name is moved down (or up) a line if it would
  be written over one already there (the Morgul Vale used to cover the Cross-roads).
- **The same world everywhere**: Chromium used to make 190 camps where Node made
  194. The old farms shuffled their fields with `sort(() => rand() - 0.5)`, and
  each engine calls such a comparator a different number of times, so the random
  sequence drifted apart. They now use a seeded shuffle; the smoke test checks
  that the browser makes the same hundred camps as Node.
- **Saves are version 6.** A save from before 0.5 keeps its settings only: its
  places, camps and plants were in another land, so the ranger begins again.
- Province holds and stockades: Forlad and Eryn Henneth still have none (their
  holds are bands); the Bridgelands and the Gorse Fells have one each. (Since
  v0.6 their holds are drawn inside stakes all the same.)
- **An enemy shut in a house gets out** however it lies: an enemy is now judged
  stuck by how far it has got *toward* where it is going in a second, not how far
  it has moved. One trapped against the inside of a wall used to slide from
  corner to corner, always moving, so it never jumped or was set aside. (The
  smoke test's house in the new land showed it.)

### v0.6: after the v0.5 playtest

- **Talk**: Faramir and Éowyn no longer have buttons for telling about the land
  ("What would you have me do?", "Tell me of the land", "What grows here?",
  "What of the camps?"). What they said there now opens their first tasks
  (f1, f2, f14, e1, e2), which say more about the work and why. Faramir keeps
  "How goes the clearing?".
- **Faramir's errands** follow the story: no errands until the nearest fire is
  out; the old "break 1 camp in Eryn Henneth" (`region`), which read oddly just
  after five camps and beside his call to free the whole province, is gone. In
  its place a **bounty**: a purse for every 5 more camps broken anywhere (rising
  to 10 as errands go on), worth half as much again as other errands. Trophies,
  scout's reports and captains are worded as the hunt for whoever is holding the
  remnants together (the Marshal, still unnamed). Road bands are asked for only
  once he has sent you to the road (f3).
- **Éowyn's first village (e3)** is the village of the Window Woods, where the
  settlers who land at Cair Andros are to live (`seek villages@henneth`). The
  scatter had put none in Eryn Henneth, so one is now added after it
  (`oldworks.js`, `hamlet4`, about 200 m south-west of the falls) with its own
  generator, joined to the old paths last, so nothing else in the world moved:
  the same 100 camps and 27 ruins. Eryn Henneth now has 14 old places.
- **The map** names the provinces without the count of camps broken ("free"
  still shows on a freed one); the count is in the pack.
- **The chase**: a roused company follows the ranger wherever they go, however far
  from its camp, until the ranger is 100 m off or inside the refuge at Henneth
  Annûn (`CHASE` in data/enemies.js). The old leash of 80 m from the camp made
  them turn back and forth at its edge. A camp is not forgotten while any of its
  company is on the chase. **Chasers rouse anyone at rest within 35 m** of them
  ("Another camp takes up the chase!"). No two camps' companies stand within
  35 m of each other at rest (the nearest are 41 m apart), so a camp roused at
  home never draws in its neighbour by itself; a unit test keeps it so.
- **Every hold has a stockade**, Forlad's and Eryn Henneth's too, though they are
  only bands (stakes at 10.5 m).
- **The lesser ruins stand on level ground** (`levelGround` in terrain.js, called
  by relicSites.js; `RELIC_FLAT` per kind): they were built on the height at their
  middle, so on a slope the far end of a long one hung in the air (the Gateway to
  Nothing south of the falls). Levelled after the streams cut the land, but not in
  a stream's own bed, and short of every camp. The aqueduct still strides over
  the ground on piers.
- **A farmhouse's gable** rests on a whole, tall end wall (it used to be set at
  2.6 m whatever stood under it: the floating wall 100 m south of the falls), and
  a house stands on the lowest ground under it.
- **The sunken court is sunken**: the ground is dug 1.5 m down (`DIGS`); a paved
  walk runs round it at the old level, a stair goes down at the south end, a kerbed
  pool in the middle is heaped with leaves, with leaf drifts in the corners, ivy
  over the walls, niches, a spout and its stain, and a fallen column. Nothing grows
  in it (`inCourt`).
- **More in every old place**, drawn only within 150 m (each ruin is a `THREE.LOD`
  of the ruin and its small things): leaf litter, moss, ivy, lichen, loose stones,
  and per kind a lintel on the standing stones and an altar hollow; the statue's
  stepped plinth, name-panel, sceptre and crown of flowers; the aqueduct's footings,
  dry channel, stains and cistern; the barrow's lined way, kerb, capstone and
  flowers at the door; the rotunda's steps, pedestal and urn, cornice and fallen
  beams; the chapel's floor, window mullion, buttresses, altar step, benches and
  bell; the waystone's letters, bench and trough; the gateway's threshold, paving,
  imposts and the footing of its vanished wall; the tower's batter, slits, broken
  stair and nests.
- **Field walls are rough stone**: mostly low lines of tumbled field stone, and in
  runs a taller broken dry-stone wall (1 to 1.7 m) with a new surface,
  `SURF.drystone` (its own texture, `uStones`: rough stones in uneven courses with
  dark gaps), cope-stones, and stones fallen at its foot. On a slope it is built in
  steps; none stands in a stream. Houses keep their laid stone.
- **Drawing a bow** looks like it: the archer turns side-on to the mark (body and
  cloak), the bow arm held out at it with the bow upright, and the string hand
  draws back along the arrow to an anchor under the jaw, its elbow up and out to
  the side (`drawBow` in figure.js: both arms solved as two-bone IK, the bow turned
  in the hand so its string runs to the anchor). The same for enemy archers.
- Saves are still version 6: nothing saved changed shape. (Kingsfoil and seed
  plants near the new village may have moved, so a few picked plants may stand
  again.)

### v0.6a: after the v0.6 playtest

- **Resting** on the mats fades the screen to black and back (`#sleep`).
- **A blow spoils the aim**: struck while aiming or drawing, the ranger drops out
  of aim mode and lets the arrow down unloosed ("Struck! Your aim is lost."), and
  cannot aim or draw again until the controls have been let go.
- **Old places**: no more wholly green blocks (the moss colour is gone from
  blocks, arch stones, rubble and field stones: `AGED` grey instead; the surface
  lays moss on top where it would grow). The **barrow** is a bell-shaped mound
  that rises out of the ground (a lathe of a Gaussian), its door set into it. The
  **chapel's** window mullion stands on the sill instead of floating above it.
- **Weapons wear faster** (120 strokes or shots from sound to worn out; was 300),
  and a weapon does damage **in proportion to how sound it is** (70% sound, 70% of
  its damage; never under a tenth). It used to keep 60% at worst. The ranger is
  told at every tenth ("Your blade is dulling: 80% sound, and it cuts at only 80%
  of its strength"), and the pack and Mablung's bench say the same.
- **Trophies are for errands only**: the orc blades, red Eye badges, blackened
  arrowheads and captain's tokens drop only while an errand asks for them, and
  only as many as it still wants (`wantedTrophies`). Faramir's trophy errands ask
  for these alone; trinkets, coin of Mordor and gold of Harad are plain loot, to
  sell. The pack keeps trophies, plants and seed apart ("Gathered for tasks"), and
  **Mablung buys none of them** (`sellable`).
- **Seed plants are about twice as many** (thyme 92, bay 89, poppy 78, olive 53;
  kingsfoil 200 as before). Their ids are unchanged. Each now has a small bright gold
  dot just above it (it was a faint halo, and over bay and olive bushes it hung
  inside them, unseen); kingsfoil keeps its pale halo.
- **Notices stack**: each comes in below the last, a third of a second apart, and
  fades after five seconds or so; at most five are shown at once, the oldest
  going first. They used to wait their turn one at a time.
- **Faramir's story follows the provinces**: after the road (f3) he asks for the
  Gorse Fells (f16), the road bands' orders (f9), the Old Bridge (f17), the
  Cross-roads (f5) and Osgiliath (f6), the Moonwood (f18), the Southwood (f19),
  the war-camps (f11), the Ash Fells (f20), the Morgul Marches (f21), and last every
  camp (f8). Gone: "The stockade" (every hold is one now), "Five captains" and the
  counts of fifteen, thirty and fifty fires (the bounty errand covers counting).
  Their gear rewards moved onto the provinces at about the same renown. A save with
  a removed task in hand drops it. Éowyn's chain (old places, villages, seed) is
  unchanged: it is her map, not a count.

### v0.7: the story by province, and the settlers

After the v0.6 playtest: three provinces freed, and nothing to show for it on the
ground. The tasks were an audit's worth of leftovers from v0.2 (counts of places,
sights to visit) beside a province story that did not lead anywhere. Now every
told task feeds one of two threads, and freeing a province leads to people
living in it.

- **Removed**: Faramir's "The Cross-roads" and "The broken city" (sights to visit,
  no part of the story; the set-piece fights there are still to come, 11.6) and
  "The war-camps" (two of the three lie in the Southwood, whose freeing now covers
  them as the Marshal's lieutenants); Éowyn's "The old places" (four anywhere),
  "Ten" and "Twenty old places", "Every village" and "Seed for the gardens" (two of
  each of four seeds, which sent a new ranger to the far south for olives). Their
  gear moved: the Helm of Gondor to Forlad, the Sword of Anórien to the Southwood,
  the Riddermark sword and the Lebennin bow to the settlers of Heathwick and Moonhallow.
  A save holding a removed task drops it; new tasks read the progress already made,
  so a ranger with provinces freed is offered their maps and settlers at once.
- **Faramir** (`f1, f2, f14, f15, f3, f9, f16, f17, f18, f19, f20, f21, f8`): the
  nearest fire; "Who leads them" (find the hold of the Window Woods and break five
  camps there; it was "five camps anywhere"); then each province freed. The Marshal
  grows through the done-texts: an unknown mark on the first captain's ring
  (Window Woods), the same on the second (Forlad), orders under the mark sending
  the bands to the Old Bridge (road bands), his name (Gorse Fells), orders falling
  back to the Moonwood (Bridgelands), his lieutenants in the war-camps (Southwood),
  his flank (Ash Fells), and **the Marshal** himself, a new enemy (`marshal`: 360
  health, 27 damage, the Morgul hold's captain, `MARSHAL_CAMP`), in "The Marshal"
  (free the Morgul Marches). "The last fires" (every camp) follows.
- **Éowyn**: kingsfoil; then for each province of the woods, in Faramir's order,
  **the map** (`m-<province>`: four of its old places, two in the Marches, and the
  village or farmstead its settlers will have) and **the settlers** (`s-<province>`,
  offered once the province is free and its map handed in): their boat is drawn up
  on the Anduin bank (across from Cair Andros for the Window Woods; elsewhere west
  of the site); the settlers wait there until the ranger comes, then follow the
  ranger's trail, each a little further behind; more than 45 m ahead and they stop
  and wait ("Go back for them"); in a fight they stand still. Within 24 m of home
  they are settled. Then "The whole of it" (every old place) and "The garden of
  Gondor" (every settlement grown). Her first map's offer and "How goes the
  settling?" (new) spell out the pattern: Faramir frees, she maps, you bring them in,
  then they grow it. Faramir's "How goes the clearing?" now speaks of provinces, the
  working one's state, the Marshal, and sends you to her when one is free.
- **The settlements** (`world/settlements.js`): Beechwell (Window Woods), Heathwick
  (Forlad), Bridgefold (Bridgelands), Moonhallow (Eryn Ithil), and two farmsteads,
  Olivegarth (Southwood) and Marchstead (Morgul Marches), each with a reeve or
  goodwife who speaks for them, two crops, and two plots of 34 x 26 m (the corner of
  an old field near the houses, or new ground beside them). Placed after everything
  else; nothing in the world moved. Its people ask four things in turn (an errand
  run of their own, `ERRANDS.village`): seed of their first crop, the nearest camp
  still standing in their province (or, with none left, an old place nearby), seed
  of their second crop, and kingsfoil for their healer (it is never a crop). Each
  done is a **stage** (`systems/settlement.js`): arrived (three houses roofed,
  smoke, the well roofed, their cart and bundles, people on the green); the first
  plot cleared, fenced and sown in rows of their crop (drawn like the wild plant,
  larger; not gatherable), and its seed on sale from the reeve (2 for 4 silver);
  six houses mended; the second plot sown, its seed sold too; every house mended,
  the market cross set up again, flowers before the doors. Crops are chosen so a
  southern farm needs northern seed (Olivegarth thyme, Marchstead bay), which the
  northern villages sell. A sown plot clears its woods and grass (`inPlot`; the
  chunks and grass tiles over it are rebuilt at once).
- **Homesteads**: Éowyn's farmstead errand ("A farm for a family") names an
  unfound farm, in a free province if one has any, else where Faramir works. Handed
  in, the farm is promised (`state.homesteads`); once its province is free a family
  lives there: the house roofed, a plot sown with the province's first crop, smoke,
  two people who greet the ranger.
- **Errands are fewer and follow the story**: offered only when the giver has no
  told task to offer. Faramir's kinds are a scout's report (a camp in the working
  province), the bounty, trophies (now one kind in five, worded as tracing the
  Marshal), the road and a captain. Éowyn's are a farm for a family, kingsfoil, and
  a ruin of a kind in the province she is mapping; no seed (the settlers ask).
- **Notices** are all one size, close together, up to ten; a few words lead in
  colour, by kind (gold for news, green-gold for the great news, blue for a task,
  orange for a warning). The fight's call-outs ("They have seen you!", "Orc
  felled") go up the same stack in their own colours, instead of a second list lower down.
- **The barrow** is a field of heights that is also its floor: the ranger walks up
  and over it (it used to be drawn only, and they sank into its sides), and the earth
  is cut away down to the door (there was turf heaped in front of it).
- **Mines in the fells** are a cut into the hill, walled with rock on either side,
  ending at a timbered adit (two frames going into the dark, lagging, a heavy
  lintel, a brow of rock over it), with a tramway on sleepers, a tipped cart and the
  spoil heap; their fire, shelters and stores lie out in front of the cut.
- **Resting** fades out and back in about a second (was about three).
- **Aiming upright on a phone**: the over-the-shoulder camera moves only as far
  aside as keeps the bow just inside the left edge (`side` in `CameraRig.update`;
  0.75 m on a wide screen, as before).
- **Cost**: Beechwell grown in full, seen from above on medium, adds about 86k
  triangles (50k of them its two fields, a third of the plants beyond 70 m) and 70 draw
  calls (mostly its people), on about 1.2 million; people and fields are drawn only
  within 260 m. (Counted in headless Chromium; not a frame rate.)
- Saves are version 7 (`settled`, `homesteads`, `escort`); a v6 save carries over whole.

**How the tasks come, in order** (the review asked for after the rebuild):

| When | Faramir | Éowyn | Settlers |
|---|---|---|---|
| Start | The nearest fire | Kingsfoil; the map of the Window Woods | |
| First fire out | Who leads them (the hold, five camps) | | |
| Hold seen | The Window Woods freed | the map of Forlad (after the first map) | |
| Window Woods free | Smoke on the heath (Forlad) | The landing at Cair Andros | Beechwell's four tasks |
| Forlad free | The road; then the bands and the Gorse Fells | The folk of Heathwick; map of the Bridgelands | Heathwick's |
| Fells free, bands broken | The Old Bridge | | |
| Bridgelands free | The Moonwood | Bridgefold; map of the Moonwood | Bridgefold's |
| Moonwood free | The Southwood (the lieutenants) | Moonhallow; map of the Southwood | Moonhallow's |
| Southwood free | The Ash Fells | Olivegarth; map of the Marches | Olivegarth's |
| Ash Fells free | The Marshal (the Morgul Marches) | | |
| Marches free | The last fires | Marchstead; the whole of it | Marchstead's |
| All home | | The garden of Gondor | |

It hangs together: each province's freeing opens its settlers, so the reward
for Faramir's work is seen on the ground, and the settlers' remnant task sends
the ranger back after the last quarter of camps. The two map tasks a ranger may
hold at once (the one just freed, the next ahead) send them ahead of Faramir into
occupied land to find ruins, which suits exploration first. The fells have no
settlement, so the Gorse and Ash Fells are Faramir's alone; that is deliberate (no
one would live there), and they come between settlements so there is always
something to go back to. Things to watch in the playtest: the walk from Cair
Andros to Beechwell (640 m) and Heathwick's (880 m over the heath) may be long
for a first escort; renown from told tasks is about what it was (Faramir about
1,300, Éowyn about 600, the settlers' errands up to about 400 more).

### v0.7.1: drawing faster, and further

Measured for the first time on a real GPU (an M3 Pro laptop, through the
machine's own Chrome: `tools/chrome.mjs`), with a frame-rate test that can be run
on any device (`?bench`). Before: about 480 draw calls in view on high and as
many again into the shadow map, at 5.2 ms a frame; medium 390 calls and 4.1 ms.

- **Plants are drawn one mesh per species and form for the whole land**
  (`VegetationField` in vegetation.js), not one per species, form and chunk:
  a few dozen draw calls instead of several hundred. Which plants go in is
  settled plant by plant when the ranger has walked 2.5 m or the camera has
  turned or moved out of what was filled: those in a wedge round where the camera
  looks (half again wider than the picture), in the form their distance calls
  for. A refill takes under a millisecond on the laptop.
- **Only what the shadow map covers is drawn into it**: plants that cast shadows
  go besides into meshes drawn only into the shadow map (shown just while it is
  drawn), and only if they stand inside the sun's square (`SHADOW_HALF`, 110 m),
  wherever the camera looks. Before, every near and middle tree out to 330 m was
  drawn into it: about 550 draw calls; now about 55, and half the triangles.
- Camps beyond 700 m are not drawn (their smoke still shows); the streams are one
  mesh, not forty.
- The shader keeps its fading dither only for instanced plants (nothing else can
  discard, which the GPU of a phone or a Mac needs to skip hidden surfaces); it
  dithers first, and lays on the grain after the alpha test (nothing spent on the
  clear part of a leaf card); the triplanar grain skips a face's lookups when it
  barely faces that way.
- **Everything reaches further.** High: full trees to 160 m (was 115), the middle
  form to 460 (330), shrubs to 100 / 300 (70 / 220), herbs and flowers to 100 (72),
  grass to 120 m with the fine blades to 60 (82 / 42), and chunks loaded to 500 m
  (360). Medium: trees to 85 / 290 (62 / 210), shrubs 55 / 190 (40 / 140), herbs
  75 (60), grass 80 / 40 (62 / 32), chunks to 340 (280).
- After: high 208 calls in view and about 55 in the shadow map, 5.5 ms a frame
  (about 2.1 million triangles); medium 178 and 4.2 ms, about what medium cost
  before for a third further, with well under half the draw calls (which cost a
  phone's browser most). At 5120x2880 (a full 5K screen) high takes 14.6 ms.
  Not yet measured on a phone.
- `?bench` (or `roi.bench()`) runs the frame-rate test: seven views, each timed
  as played and drawn flat out, with draw calls and triangles; `?tune=grass:100,...`
  overrides any quality setting for trying distances out.

### v0.7.2: no hitches as new land comes into range

On a phone (in portrait, 804x1428 at 2x) v0.7.1 ran medium and high alike at about
18 ms a frame: the phone is now bound by its pixels, not by what is drawn, so
high costs no more than medium. What was left was a hitch now and then while
moving.

- **New land is built a little each frame.** A chunk's ground (heights, then
  colours), its plants, and each grass tile are now generators that yield after
  every row (util/slice.js); the game loop gives them about 2 ms a frame (grass
  1.5), three times that when the nearest gap is well inside the range drawn. While
  loading and after a teleport everything is still built at once. Before, a chunk
  took 10-15 ms in one frame on the laptop (ground 6, plants 5) and a grass tile up
  to 2 ms, two a frame. `?tune=buildMs:0` brings back the old way, to compare.
- Running at full speed with Chrome's main thread slowed five times
  (`tools/chrome.mjs --cpu 5`, roughly a phone), frames over 33 ms on high fell from
  8 to 1 in the deep woods and from 5 to 0 in the old fields; on medium from 5 to 1
  and 3 to 0. The building keeps up: no chunk went missing nearer than 497 m (of
  500) and no fine grass nearer than 58.6 m (of 60).
- **A camp's company is made ahead.** Each figure took 2-3 ms to make (an eight-
  strong camp about 20 ms in one frame, the one long frame left in the runs). Now
  the figures for the camps between 120 and 200 m (and for the next band on the
  road, chosen five seconds before it comes) are made a part a frame, under a
  millisecond, and the company takes them when it is met (`plan`, `prepare` and
  `figureFor` in entities/enemies.js; `figureSteps` in figure.js). After a teleport,
  a company in reach is still made at once.
- With the CPU slowed five times, no frame in either run now passes 33 ms; the
  slowest were 30 and 19 ms (high).
- `?bench` ends with two 15 s runs (deep woods and old fields) and reports the
  slowest frames and how many passed 25 and 33 ms.
- A web worker was considered and left: the placement code reads state that
  changes in play (cleared and sown fields, walls for the grass) and the modules
  import three.js through the import map, which workers cannot use.

### v0.7.3: fixes from a playtest on the phone

- **Moonhallow's settlers** waited on the shore due west of the village, which is
  the Southwood's shore: nobody looking along the Moonwood's would find them. A
  boat now puts in on the nearest shore inside the settlement's own province
  (`landingZ` in settlements.js); Moonhallow's 56 m north, Bridgefold's 8 m. A save
  whose settlers still wait at the old spot sends them to the new one. The other
  settlements were not affected.
- **The Southwood's stockade c15** stood across the stream from Moonhallow, which
  is settled once the Moonwood alone is free. It is moved 150 m south-east into
  the Southwood's own woods (`MOVED` in campSites.js; every camp keeps its id and
  every other its place).
- **Mines**: the ridge of rock behind the cut and its shoulders could be walked
  into; a row of circles now fills the ridge and one each the shoulders. A mine
  within 45 m of the Harad Road stood with its hill toward the road, overhanging
  it in the gorse fells (c40); now any such mine is set back to 34 m and turned
  to face the road (c40, c77, c85, c89).
- **Healing out of a fight** eats the cheapest food first (by price per point of
  health: orc bread, then waybread), as much as the wound needs, and keeps the
  draughts and salves for fights unless there is nothing else (`calmHeal`). In a
  fight (or within three seconds of a blow) it reaches for one remedy as before.
- **Travel to settlements**: every settlement lived in is a travel place on the
  map, arriving on its green.
- A camp roused from afar (an arrow) no longer says "They have not seen you yet"
  when the ranger comes near it.
- **Mablung's mending** costs at most a silver less than the kit that would do
  the same (8 for a whetstone or a string), however fine the weapon (a worn-out
  yew bow was 45).
- **Mablung's stores** show what the ranger wears at the top (each piece's damage
  or protection, and the armour's in all), and the stats of what he would buy
  from the ranger.
- **High slowing on the phone after running.** On the phone, high starts at about
  50 fps and falls to 10-20 after running through the woods for 5-10 s, staying
  there when still, until the browser is put away and brought back. Not seen on
  the laptop, even with Chrome's main thread slowed five times and the phone's
  shape and resolution: there no draw calls, plant buffers, geometries, shader
  programs or heap grow (heap about 250 MB on medium and 270 on high; farms hold
  62 MB of vertices on either). The `?debug` overlay now shows the time between
  frames and the time this thread spends on each (the game's work and handing
  the frame to the GPU), so the phone can show whether the time goes in the
  game's code or waiting on the GPU; `?tune=minPixelRatio:2` (no lowering of the
  resolution) and `?tune=shadowMap:1024` are the first things to try.

### v0.7.4: a frame-rate cap

The phone's readings settled what slows high: the `?debug` overlay showed the
game's own work at 5-8 ms a frame throughout, while the time between frames went
from 20-30 ms to 60. It slows even standing still, after about ten seconds,
whatever the resolution (held at x2 or let fall to x1.5) or the shadow map, and
is quick again at once when the browser is put away and brought back: the phone
itself holding the GPU (or the browser) back after being worked flat out, not
anything the game does.

- **The menu has a frame-rate setting**: as fast as it can (as before), or a
  steady 30, which leaves the GPU rest in every frame, so it may never be held
  back. Saved with the game; `?tune=fpsCap:30` tries it from the address bar. The
  frames between are let go by in the loop (a display frame comes sooner than
  4 ms short of the 33 ms due).
- With a cap the sharpness of the picture is judged against it (slow under two
  thirds of it, quick over 95%), so a steady 30 does not lower the resolution.

### v0.7.5: the settlers again

These were made as "v0.7a" right after v0.7, but missed its merge; they
land here, on top of v0.7.1 to v0.7.4.

- **A dozen settlers** come off a village's boat (seven to a farmstead), as Éowyn
  says: most with a sack on their back, the children with nothing, and one
  pushing a two-wheeled handcart piled with bundles and a chest. They wait in a
  loose crowd on the shore, a step apart; following, they walk two abreast,
  each pair further behind, the cart last, and never on top of one another (they
  used to all make for the same point of the ranger's trail and stand in a heap).
- **They build the village themselves.** On arriving they run from where they
  stand to the first house to be mended: some at its walls swinging hammers, the
  rest carrying planks from their goods to it and going back for more. Scaffolding
  goes up round it and its walls rise for 5 to 10 s, then the next house; the
  same after each task of theirs that mends more. (Loading a save shows what
  stands at once: none of this is saved.) Each mended house is its own mesh now.
- **Level ground**: the ground under every house that may be lived in again
  (each settlement's and every farmstead's) is levelled a little (`levelGround`,
  called from world/settlements.js after the camps and lesser ruins are placed, so
  neither moves). A house near a stream, where the land is not levelled, stands on
  a stone footing under its low side (`houseFloor`) rather than sunk in the slope.
- **Houses in streams** are left ruins: one at Beechwell (over the head of a
  stream), one at Bridgefold, one at Moonhallow.
- **Boats float**: each was set a few metres up the bank, in the sand. Now it lies
  where the water is deep under the whole hull (`mooring`), with a gangplank to
  the shore and a mooring stake; the settlers wait on the dry ground beside it.
- **Travel** to a settlement arrives before a farmstead's door as well as on a village's green (`arrivalAt`).

### v0.7.6: settling in, and a bed and a shop in every settlement

- **Settling in is one smooth thing.** The settlers who walked home are the
  people who live there: their figures are handed over as they stand (the
  village made its own before, in other clothes and places, so everyone seemed to
  jump), sacks put down. Whoever speaks for them and the storekeeper walk with
  them from the boat (first in line) and then go to their places; they talk once
  they are there. Whoever pushed the cart pushes it on to where their goods are
  kept, and it stays there for good: it is their goods, and the carriers fetch
  from it. The well goes up by hand like the houses (it used to appear at once),
  4 s with them round it, and at the last the market cross too. The heap of
  goods that used to pop in and out is gone.
- **A storekeeper in every settlement** (`trader` in world/settlements.js: Mirel,
  Sefa, Odo, Lisbet; at the farms Imrith's son Garan and Dorvan's daughter Nell),
  by the cart. Bread, draughts, arrows, and whetstones and bowstrings once Mablung
  has taught their use; they buy plain things (trinkets, coin, food), never gear
  (`villageShop`, `villageBuys`; the trade panel's village mode hides the bench).
- **A bed**: a village's second house is its inn, with a sign and a lantern by the
  door (the Well and Bucket, the Heath Hen, the Broken Span, the Lantern); at a farm,
  a bed in the farmhouse. "Rest" at the door, once it is built, mends the ranger as
  the mats in the cave do, free.
- **The reeve explains**: "What is there here for a ranger?" tells of the
  storekeeper, the inn, their seed, and their tasks.
- **The heal button out of a fight eats one thing a touch** (still the cheapest
  first): orc bread takes a good deal of chewing, which is the point. It used to eat
  as many as the wound needed at once (v0.7.3).
- The HUD keeps the last two hundred notices (`hud.recent`) so the tests can find a fight's
  call-out after it has faded: the game now runs fast enough in the smoke test that
  the 3 s call-outs were gone before it looked.

### v0.7.7: steps to the doors, trodden yards; dry camps that green

- **Doors above the ground get steps.** A house on a slope stands on a footing
  (v0.7a), and its door could be two metres up in the air (Beechwell's inn): now
  a stone landing at the threshold and steps of about 0.2 m down to the ground,
  each one a floor to walk on (`doorSteps` in villages.js).
- **A mended house is solid**, door and all, from when its building starts (a box
  over its footprint; the ruin's own walls had a gap for the door and others broken
  away, so the ranger could walk in).
- **Trodden yards**: once a place is lived in, the ground for 5 m round every house
  it keeps, a village's green and where the cart stands are trodden earth (`yardsOf`
  in world/settlements.js; `trodden` colours the ground); no bush, shrub or grass
  grows there, so nothing stands in a doorway. The old planted trees (the oak on the
  green, the avenues) are left. The fallen stone about a ruin that will be mended now
  lies inside its walls, under the new house, not on the doorstep.
- **Dry camps**: the ground and grass of an enemy camp are dry and brown while it is
  held (the camp's size sets how far: 12 to 25 m), and green again over about six
  seconds once it is broken, as the blight lifts (`uCamps` in surface.js, set by
  camps.js from each camp's `strength`, for the nearest ten).
- **A broken stockade** has about half its stakes knocked flat, lying where they fell;
  they stop no one (`removeCircles`).
- **Flowers in the cold fire ring** of every camp broken.
- **Gear stretched for the late stockades**, which had grown very hard: the best
  sword and bow now do 50 (they did 34 and 32), and the best armour adds up to 50%
  (body 32%, helm 10%, greaves 8%; it was 42%). The starting gear is unchanged and
  every step between is stretched evenly (swords 14 + 1.8 a step, bows 16 + 2.1 a
  step, armour by about a fifth), so mid-game gear is a little better and the top
  much better. Prices and renown gates are as they were. A guess until the south is
  played with good gear.
- **The full smoke test is for major releases now** (CLAUDE.md): on this machine
  software rendering has grown slow enough that the whole run takes three hours or
  more. Point releases run the unit tests and the suites the change touches.

### v0.8: camps broken up by hand, scouts, the Marshal made plain

From a playtest of v0.7.7.
- **Breaking up a camp is its own act.** Killing the last of a company still clears
  the camp (`state.cleared`: tasks, provinces, renown count from it, as before), but
  the camp stands, blighted and burning, until the ranger breaks it up: near a camp
  taken the prompt offers "Break up the camp" (the stockade, the war-camp, their lair).
  Then its shelters fold down into the ground one after another, the fire goes out
  with a last breath of smoke, half the stakes are knocked flat, the ranger's marker
  goes up, the blight lifts and the dry ground greens, and its stores are taken
  ("From their stores", which used to come at the kill). Saved as `state.broken`
  (save version 8; a camp cleared before is broken up already). The map rings a
  camp taken but standing in gold. Not while any enemy has seen the ranger.
- **Camps in more detail** (camps.js): ridge tents of hide sagging between their
  poles, a door tied back on the dark inside, patches, guy ropes and pegs; round tents
  on eight crossed poles (the captain's, and some in the larger camps). Every shelter
  stops the ranger and the enemy (circles, `tent:<camp>`). Round the fire: logs to sit
  on, a spit, embers; firewood, sacks and barrels by the stores, a rack of drying
  hides, a rack of spears in a stockade.
- **War-camps look like war-camps**: two rows of stakes (the inner set between the
  outer), a great fire (a pyre of logs, a ring of stones half as wide again, four
  flames and a wider smoke), and a dozen shelters (a stockade has five).
- **The Marshal** is a giant (1.85 times a man; a captain is 1.28), hunched, with a
  great lopsided hump, spiked shoulder plates, a club of a right arm, all in black:
  no captain's red to mistake him by. Finding his hold, being seen by him and his
  fall are each called out.
- **Bands on the road**: all now march south, from the Black Gate toward the Morgul
  Vale (a quarter used to march north, which looked like a mistake), and each is set
  down ahead of the ranger: coming to meet them if they go north or stand, ahead to
  be overtaken if they go south (before, one going south was never seen). One comes
  every 45 to 100 s near the road (it was 50 to 120), about two or three on a walk
  from one end of the road to the other. A band beaten gives what they carried between
  them (`bandLoot`: some silver, arrows, food; a host more, and often gear), and
  those on the road carry a little more silver each.
- **Scouts**: while the ranger is in a province not yet free, every minute or two
  a party of one to three goes from one of its camps to another, on a way chosen to
  pass within 90 m of the ranger and set down about 160 m off, out of sight. Their
  ways bend round Henneth Annûn (`scoutRoute`, outside `SCOUT_BERTH`). About a third,
  where the province's hold stands, are couriers between it and the hold of another
  province: killed, a courier gives up his map, and the hold he was bound for is
  marked on the ranger's map (`state.told`; a broken square; the place line says
  so). Faramir speaks of them in "Who leads them".
- **Kingsfoil** grows about twice as thick (396 plants; every one that stood before
  still does).
- **Every old farmstead found is told of** (before, only the first was; the rest
  were found without a word).
- **The testing page folds on a phone** (a CSS rule for touch kept it open).

### v0.8.1: the Marshal by the Cross-roads

- **The Marshal's hold moved** to the camp just west of the Cross-roads (c9, about
  160 m from it): it was c63, nearly 400 m back to the north-west. The two changed
  ranks, not ground (`RESIZED` in campSites.js): c9 is the Morgul war-camp and the
  hold now, set 5 m east to keep its company clear of the stockade c8's at rest;
  c63 is a small camp. Save version 9 swaps the two in an older save (cleared, broken
  up, found, told of), so a hold already broken stays broken and the Marshal dead,
  and one not yet broken still has to be fought. An errand in hand keeps its camp.
- **The smoke test** waits out an arrow that misses (its five seconds of flight are a
  minute or more of the clock in software rendering: the full v0.8 run failed there),
  and a wait that times out now says what it was waiting for and who was about.
  Every check and suite is timed; the times of each suite, and where each spends
  them, are in CLAUDE.md ("Verifying a change"): about an hour and a half in all,
  the desktop suite alone 65 minutes and the settlers 15.

### v0.8.2: the map zoomed in; homestead families come by boat

From a playtest of v0.8.1 on a phone.
- **The map opens zoomed in on the ranger.** It drew the whole land into whatever
  height there was, so on a phone held on its side it was a strip a few fingers wide.
  Now it is a window as large as the screen allows (`#map-view`; on a short landscape
  screen the hint sits beside the buttons to give it the height), opening at 0.62
  screen pixels to the metre (or the whole land, if that is nearer), centred on the
  ranger, or for Faramir's map on the camps his scouts have seen. **+ and −** under it
  zoom by half again (up to 2.1 px a metre, where the land, sampled every 10 m, begins to blur; out to the whole land), as do the + and −
  keys, the mouse wheel (about the pointer) and two fingers; one finger or the mouse
  drags it, and a drag is never taken for a click. The zoom last chosen is kept while
  the game runs. Only what is in view is drawn, at the screen's own sharpness: the
  marks and names keep their size at any zoom (the old 600 by 1200 canvas was scaled
  down by the page, and its words with it). `MapPanel.centre`, `screenAt` and
  `worldAt` are for the tests; `roi.map` is the panel.
- **A homestead's family is led in from their boat.** Éowyn's "A farm for a family"
  used to put two people on the farm the moment its province was free. Now, once it
  is promised and its province free, her next errand (before any other of hers,
  though still after her told tasks) is `family`: "<name>'s family" (each farmstead
  has a family named for whoever heads it, `family` in world/settlements.js), five of
  them (`FAMILY_SIZE`: two grown, two children, a grown son with the handcart), waiting
  by their own boat on the shore of the farm's province (never within 22 m of another
  boat; a province with no shore of its own lands them due west). It is the settlers'
  escort over again (`objective: settled`, `state.escort`, `escortSite()` in main.js
  now takes the first task in hand that leads anyone home). Home, the five are the
  family who live there (it was two, made on the spot), the farmer speaks by name, and
  the farm can be travelled to. `state.settled` holds a homestead's site once its family
  are home, and `homesteadsLived` reads that (it read the province's freedom).
- Save version 10: a family already living on their farm in a v9 save (promised, and
  the province free) stays there, as if led home.

### Known gaps to pick up

- **Balance is still a guess**, now with one playtest behind it (three in a camp
  was comfortable, five was too many at starting gear). The north should now be
  gentle; nobody has yet tried the south with good gear.
- Enemies steer simply: straight at the ranger, side-stepping what blocks them.
  They pass through their own stockade stakes (which stop the ranger); since v0.8
  the shelters stop them. Scouts walk straight between camps, and may be held up by
  a steep bank or a thicket until they are set aside.
- A mine (since v0.7 a timbered adit at the end of a rock cut, with rails and a
  cart) is still not a cave you can enter.
- Streams bend at 9 m joints and have no falls of their own. Paths and roads
  ford them; there are no bridges but the broken one.
- No blocking or dodging move. No stealth beyond walking. No sound.
- Loot bags and a camp's dead are forgotten if you leave and return.
- The blight changes sky, fog and light but not the colour of ground and plants.
- Trees appear at the edge of the loaded radius without a fade.
- Before v0.7.1, high ran at about 40 fps on an iPhone with dips into the 20s and
  medium steady at about 50. v0.7.1 runs both at about 18 ms a frame there (bound
  by pixels: `minPixelRatio` is the lever if it is ever slow).
- Leaf cards are alpha-tested, so the GPU shades every layer of them; on a large
  screen that overdraw is the biggest cost left. MSAA costs about a quarter of the
  frame at 5K (high draws at twice the pixels with 4x MSAA).
- Arms bend only forward (no twist) except in a bow's draw, which sets them freely.
- Field walls and houses are axis-aligned. Osgiliath is plain blocks.
- **The old farms are the costliest thing drawn** in many places: 52 meshes, one
  per farmstead or hamlet, each 100-400 m across with its fields' walls (so they
  are seldom culled), 14k-30k triangles each, about 700k in all, with no lighter
  distant form; about 500k of them were in view from the pool at Henneth Annûn
  on medium (`tools/perf.mjs`). A far form, or splitting them by terrain chunk,
  would be the next big saving.
- Nothing yet happens when every camp is cleared beyond Faramir's last words.
- Settlers walk through walls and trees on their way home (they follow the
  ranger's own trail, two abreast, so seldom do) and the people of a settlement
  walk through each other and the scaffolding while they work. Enemies ignore
  them; in a fight they stand still.
- Mended houses are built over the ruins, which stay inside them; a house's old
  rubble still lies about it.
- The settlements have no trader beyond their seed and no rest (11.3's stages 2
  and 3 are partly built; travel to them came in v0.7.3), and the fells have no
  one to settle.
- Homestead families say only a greeting; they ask nothing (since v0.8.2 they are led in from a boat).

## 11. M6: provinces, captains and settlement (design)

Agreed in principle; the details below are a first draft to refine as each step
is built. The decisions are in section 9.

### 11.1 Why provinces

The five terrain regions (`world/regions.js`) are kinds of country, not places to
free: on the 2 x 4 km land the Home Woods held 89 of 194 camps and two stockades, the Heather Slopes
has no ruins or plants, and every stockade and war-camp lies south of the falls.
Provinces are a new layer (`world/provinces.js`), drawn over the regions.

**Borders follow the land.** West of the Harad Road, the five streams that run the
whole way from the mountains to the Anduin (crossing the middle of the land at
about z 755, 1324, 1704, 2297 and 2694 since v0.5) cut the woods into bands. East of the
road the heather is two fells, split where the third of those streams comes down.
A strip 150 m deep along the southern road belongs to the Morgul Marches, so the
Cross-roads, Osgiliath's shore and the mouth of the Vale lie together. Each
province's **hold** is its strongest camp, nearest the middle of its camps.

| Province | Landmarks | Camps | Stockades + war-camps | Old places |
|---|---|---|---|---|
| **Forlad**, the North Plain | the Northern Fens, the Broken Watch | 26 | 0 | 12 |
| **Eryn Henneth**, the Window Woods | Henneth Annûn, Cair Andros, the Field of Cormallen, the Mossy Arch | 20 | 0 | 14 |
| **The Bridgelands** | the Old Bridge, the Fallen Colonnade | 10 | 1 | 10 |
| **The Gorse Fells** | (heather, east of the road) | 10 | 1 | 0 |
| **Eryn Ithil**, the Moonwood | the Roofless Shrine, the Stair to Nowhere | 13 | 4 | 13 |
| **The Southwood** | the Dry Fountain | 8 | 4 + 2 | 9 |
| **The Ash Fells** | (heather, east of the road) | 7 | 4 | 1 |
| **The Morgul Marches** | the Cross-roads, Osgiliath, the Morgul Vale | 6 | 3 + 1 | 6 |

(Counts for the v0.5 world of 100 camps. Node and the browser now make the same
world; before v0.5 Chromium made 190 camps where Node made 194, fixed in v0.5.
The Broken Watch now stands just north of the border, in Forlad.)

Two changes from the first sketch, now the borders follow streams: the Field of
Cormallen lies by the falls, so it is part of Eryn Henneth and there is no
"Cormallen Woods"; and the Old Bridge is in the middle of the land, not the
south. The fifth band is the Southwood instead.

Names: Sindarin where Gondor would keep an old name, English where the books
would translate one (as with Henneth Annûn and the Window of the Sunset). Forlad
(*forod* north + *lad* plain) is our own coinage on the pattern of Dagorlad;
Eryn as in Eryn Lasgalen; Ithil, the moon, as in Ithilien. Not checked by anyone
who knows Sindarin well; change any that grate.

To fix in later steps: Forlad and Eryn Henneth have no stockade, so their holds are
only their biggest camps until step 2 makes them real holds; the two fells need a
few old places and plants of their own.

### 11.2 Captains

- Every province has a **hold** (a stockade) and a named **captain**. Where there
  are several stockades and war-camps, the strongest is the hold and the others
  are lieutenants.
- **Outlying camps feed the hold**: each camp still standing in the province adds
  a guard to it. The captain can be rushed, but clearing the province first
  makes the fight fair.
- A captain is a boss, not a big orc: a few readable moves (a charge, a horn that
  calls the nearest band, falling back behind the stakes at half health). It
  drops its company's token and one piece of gear.
- **Retaking**: while a captain lives, a broken camp near the hold is sometimes
  retaken (Faramir warns of it). Once the captain falls, never again.

### 11.3 Freeing and settling

Freed = captain dead and 75% of the province's camps broken. Then:

| Stage | When | What changes |
|---|---|---|
| 0 Occupied | at the start | as now |
| 1 Outpost | province freed | Gondor banner on the old hold; two guards; no more retaking or road bands there |
| 2 First settlers | Éowyn's province tasks done | the chosen farm or village re-roofed, smoke, settlers, a tilled field; rest, save, travel |
| 3 Settled | settlers' first wants met | fields sown with the seed brought, a trader, the well in use |

Each province settles one site, chosen in Éowyn's tasks: a village where there is
one, otherwise a farmstead. With self-healing gone, Henneth Annûn is the rest
point until the first settlement; Eryn Henneth may take a few trips home.

**Osgiliath** is a ninth settlement: the eastern landing, held for the King's
masons (story step 12). The bridge is rebuilt span by span as the land is won:
scaffolding and a crane first, a span more for each province freed, and the last
span laid only when every camp in Ithilien is cleared. It is the picture of the
whole game's progress, seen from the shore.

### 11.4 Plants

Kingsfoil grows everywhere. Each province has one or two plants of its own and
shares others with its neighbours. A first list (real plants, our own choice):

| Province | Only here | Shared |
|---|---|---|
| Forlad | bog myrtle, cotton-grass | thyme |
| Eryn Henneth | meadowsweet | thyme, bay |
| The Bridgelands | wood sorrel | bay, poppy |
| Eryn Ithil | wild garlic | bay, poppy |
| The Southwood | wild vine | poppy, olive |
| The Morgul Marches | rosemary | olive |
| The Gorse Fells | gorse | juniper |
| The Ash Fells | wild sage | juniper |

**Regrowth**: a picked plant grows again somewhere else in the same province
after a while. Deterministic: herbSites makes a pool of candidate spots several
times larger than what stands, and the save keeps which spots are picked and
when. A province always has about the same number of each plant standing.

### 11.5 Tasks

- **Faramir's story** (11.6) is the spine, gated by provinces freed rather than
  by camp counts (no more 30, 60, 100).
- **Faramir's arc in each province** (about four steps): find the hold, break
  *k* camps there, bring *k* of the captain's company tokens (they drop only in
  that province), break the hold.
- **Éowyn's arc in each province** (about four steps): find *k* old places there,
  find the site for the settlers, bring *k* of the province's own plant, then the
  settlers' first wants.
- **Settlers** in a settled province give tasks of their own: seed, herbs, a
  remnant camp near the village.
- **Errands** stay, scoped to a province: the one being worked on before it is
  freed, settlers' requests after. Their sizes scale with the province's danger,
  not with how many errands have been done.
- Text: an opening and closing written by hand for each province and captain;
  the steps between from templates, as errands are now.
- Code: per-province tallies of what was picked up and where
  (`state.stats.got[province][item]`), and new objectives `clearIn`, `gatherIn`,
  `seekIn`, `captain`, `freed`, `settled`. Save version 5.

### 11.6 Faramir's story (agreed outline; text still to write)

The war is won but the remnants in Ithilien are being drawn together. A new hand
is gathering them from the Morgul Vale: an Uruk war-chief the others call **the
Marshal** (working title; our own invention, not from the books). Each captain
answers to him, so each hold broken tells a little more. Three acts, gated by
the number of provinces freed.

**Act I: the home country** (from the start)
1. *The nearest fire*: kept as the first lesson.
2. *The Window Woods*: free Eryn Henneth; its captain is the first boss.
3. *A mark on the captain*: the captain carried a token no one knows. Faramir
   asks Éowyn and Mablung; it is the first word of the Marshal.
4. *The landing at Cair Andros*: settlers are crossing the river. Clear the shore
   so they can land; they settle in Eryn Henneth.
5. *Smoke on the heath*: free Forlad. Open country, smoke seen far off; a quick
   province, a pause before the harder woods.

**Act II: the middle country** (two provinces freed)
6. *The road under the mountains*: find the Harad Road. The bands on it carry
   arms south.
7. *What the bands carry*: break bands until one carries orders.
8. *The gorse*: free the Gorse Fells.
9. *The Old Bridge*: the bands' orders name a gathering at the bridge. Break it,
   so the King's builders can cross, and free the Bridgelands. What is found on
   them points south, to the Cross-roads.

**Act III: the south** (four provinces freed)
10. *The Moonwood* and *the Southwood*: freed by their own arcs.
11. *The Cross-roads*: not a visit but a fight. The remnants gather round the
    old king; a few rangers come with you, and you break the host together and set
    his crown of flowers right. The orders found there name the Marshal.
12. *The broken city*: hold the eastern landing at Osgiliath for the masons,
    with rangers beside you, against a company sent to stop the work. Faramir's
    own beat: he was born to defend it. Osgiliath becomes a settlement and the
    bridge-building begins.
13. *The Marshal's lieutenants*: the war-camps.
14. *The Ash Fells*.
15. *The mouth of the Vale*: with his lieutenants gone the Marshal comes out to
    meet you where the Vale opens, and the rangers come with you. The Vale itself
    stays shut; it is not ours to enter.
16. *The garden of Gondor*: every province freed and settled. A gathering at
    Cormallen, Faramir and Éowyn both there.

**After**: *The last fires*, every camp, with Faramir's map. When the last is
broken, the last span of the bridge at Osgiliath is laid; the King's gift.

**Companions** (for steps 11, 12 and 15): three or four rangers, archers only.
They keep a ring 15 to 25 m behind and to the sides of the ranger, shoot at
whatever the ranger is fighting or whatever comes for them, and fall back if an
enemy closes. They are struck down but never killed (they rise when the fight
ends), so the player never has to babysit them. Few figures, so the cost on a
phone is small; their arrows use the ranger's arrow code.

### 11.7 Build order

Each step ends playable.
1. **(built, v0.4.0)** Provinces as data; borders and status on the map; progress in the pack.
2. Captains: a hold in every province, the captain enemy, outer camps feeding the hold, retaking.
3. Plants: the new plants, regrowth by province.
4. Tasks: province arcs, new objectives, Faramir's story. **(mostly built, v0.6a and v0.7)**: Faramir's
   chain is one task per province with the Marshal's story in its words; Éowyn's maps each province
   and brings its settlers home (save version 7). Not built: per-province captain's tokens and plants.
5. Settlement: rebuilt farms and villages, settlers, rest, travel, trade. **(first part built, v0.7)**:
   one settlement per province of the woods, led home from the river and grown in four stages by
   its people's tasks; homesteads; seed sold; travel to a settlement lived in (v0.7.3). Still to
   come: rest at a settlement, a fuller trader. (Self-healing already removed in v0.4.1.)
6. Errands scoped to provinces; settlers' tasks. **(built, v0.6 and v0.7)**
7. Companions and the three set-piece fights; the Marshal. (The Marshal stands in his hold since
   v0.7, a plain fight; the set pieces at the Cross-roads and Osgiliath, whose sightseeing tasks
   were removed, are still to come.)
8. Osgiliath: the landing settlement and the bridge rebuilt in stages.

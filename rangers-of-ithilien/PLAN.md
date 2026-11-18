# Rangers of Ithilien: Plan

Status: **v0.3: visual polish.** The land, the enemy, fighting, gear, tasks and trade are built and
have had three rounds of playtest; v0.3 reworks how all of it looks (section 4, and
"v0.3" in section 10). Next: playtest the new look on a phone, then Milestone 5
(sound, day and night) and the gaps listed at the end of section 10.

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
this to **2 km east-west by 4 km north-south**. It began at 3.2 x 6.4 km; playtest
showed that was too much wilderness once the forest thickened and walls and ruins
were added. At a run of 7.5 m/s it is about 4 minutes river to mountains and 9
minutes north to south in a straight line, and a good deal longer through woods.

### 3.2 Layout

North is up. Not to scale. (x, z) in metres from the north-west corner.

```
            thinning forest, heath (z = 0)
   +--------------------------------------------------+
   |~~ fens     . heath .   village     ‖^^^^ /\/\/\  |
   |~~                                  ‖^^^^ /\/\/\  |
   |(CA)  Cormallen <~~~cut~~[HENNETH]~~‖~~~~ /\/\/\  |   Henneth Annûn (1000, 1190)
   |~~        farms, walls, lanes       ‖^^^^ EPHEL   |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ DÚATH   |   ^^^^ tall heather
   |~~   the home woods: woods + glades ‖^^^^ /\/\/\  |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ /\/\/\  |
   |~~   the deep woods: closed canopy  ‖^^^^ /\/\/\  |
   |~~    <~~~~~~~~ stream ~~~~~~~~~~~~~‖^^^^ /\/\/\  |
   |[OSGILIATH]====== road ======= CROSS-ROADS ==> Morgul Vale (barred)
   +--------------------------------------------------+
   ~~ Anduin   (CA) Cair Andros   ‖ Harad Road (x ~1530)   /\ mountains
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
- **Deep woods (south):** oak and beech, canopy nearly closed, ferns below.
- **Heather slopes (east of the Harad Road):** heather and gorse above head
  height, with winding ways between. Almost no trees.

Under a closed canopy the light turns dim and green-gold, the haze draws in, and
motes drift in the air.

### 3.5a Old habitation

About 46 farmsteads and 6 hamlets, generated from the world seed
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
| 0 Refuge | within ~220 m of the falls | Nothing hostile. |
| 1 Home woods | to ~560 m | Wolves, a lone starving orc. |
| 2 The middle land | to ~1.1 km | Small orc camps, snares and pit traps. |
| 3 The marches | beyond | War-bands, Southron and Easterling holdouts, large fortified camps. |
| 4 The shadowed edges | Morgul road, heather slopes, far north | The worst of what fled the Gate. |

There are 129 camps (`world/campSites.js`), none within 250 m of home, thickening
with tier. Size 1 is a fire and a shelter; size 3 is a stockade. Each blights
about 95 m around it.

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
- A narrow stair of worn stone runs along the south wall of the basin, from the
  floor beside the pool up to the cave door. Inside, the hall runs on east as a
  second, narrower stair in the rock (2.6 m wide, roofed), which climbs 12 m to
  a stone-lipped hole in the forest floor above the cave, crowded by bushes. No
  old path leads there. The south wall of the basin stands back 2 m for the stair.
- From the window behind the fall a ledge steps out through a notch in the pier,
  on to a shelf with a low parapet beside the fall, over the pool.
- So there are two ways home: down the hole in the forest floor, or up the cut
  from where the stream runs out of it, about 350 m downstream.
- Inside the cave the sun and sky light are dimmed, so torchlight carries it.

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
| World size | 2 × 4 km (reduced from 3.2 × 6.4 after playtest). |
| Forest | Dense and tall, closing overhead; a once-farmed land going back to woods. |
| Camps | A hundred or more. |
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

## 10. What is built

### The land (M1, with playtest changes)

- Terrain, the Anduin, five streams, the Ephel Dúath, both roads, soft boundaries.
- Henneth Annûn: hidden pool, the cut, the stair to the door, the hidden stair
  in the rock up to the forest, the ledge beside the fall, the cave.
- Forest of great trees with understory, herbs and litter; fens; Cormallen;
  heather slopes where the camera rides above the bushes.
- 52 old farms and hamlets; seven named ruins; 44 lesser ruins of ten kinds; the
  Cross-roads, the edge of Osgiliath, the barred Morgul Vale, Cair Andros.
- 26 km of half-seen old paths (`world/paths.js`) joining all of the above and
  the two ways out of Henneth Annûn. They thin the trees, show on the ground
  and the map, and carry worn slabs and small cairns.

### The enemy and the fighting (M3)

- 188 camps hold about 680 enemies (`data/enemies.js`): orcs, orc archers (in a
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
  marching down it every minute or two. Usually two to four; about one in eight
  is a host of ten or more with a captain, announced so the ranger can get clear.
  Beating a band is loot and practice; it clears no camp.
- When the last of a camp's company falls, the camp is cleared for good, its
  stores are taken, and the blight (55 to 140 m by size) lifts.
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

- **Gear** (`data/items.js`): 17 swords (damage 14 to 34), 11 bows (16 to 32),
  and armour in three slots that add up (body to 27%, helm to 8%, greaves to 7%;
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
  from 0 to 50 (`25n + 1.2n²` points for level n). Kills 1 to 6, camps 3 to 30,
  road bands 6 (a host 40), old places 2, farms and villages 1, told tasks 15 to
  300, errands 14 rising to 60. Every camp and told task together come to about
  3,500 of the 4,250 for fifty: the rest is errands and the road. The pack shows
  renown with a bar toward the next level.
- **The enemy grows with renown**: health +1.2% and damage +0.9% a level; from
  renown 15 each camp of size 2 or more holds one more for each 15, small camps
  one more from 25, and road bands one more for each 20.
- **Told tasks** (`QUESTS`): Faramir's chain runs to 13 (the nearest fire, the
  home woods, the heather, the stockade, the road bands, the Cross-roads,
  Osgiliath, thirty fires, five captains, sixty fires, the war-camps, a hundred
  fires, every camp). Éowyn's runs to 8 (kingsfoil, the old places, a village,
  seed for the gardens, fifteen places, every village, thirty places, every
  place).
- **Errands** (`ERRANDS`, built in `systems/quests.js`): lesser work that never
  runs out, one in hand from each giver at a time, each a little bigger than the
  last. Faramir: trophies for the count (orc blades, trinkets, Red Eye badges,
  blackened arrowheads that only road archers carry, coins, captains' tokens,
  gold), camps broken in a named region, bands on the road, a scout's report of
  one camp, another captain. Éowyn: seed of a kind, more kingsfoil, a ruin of a
  named kind, old places in a region, another village or farm. A kind that
  cannot be done is skipped.
- **Hints**: ask about a task in hand and they remind you; ask again and they
  give a direction from the falls ("to the south-east of here, a long walk");
  a third time and they mark it on your map, and the tracker follows the mark.
- **Faramir's map**: after the first task he will show his map, which always
  has camps you have not found (three, rising to seven late on), the nearest
  to home first. They are copied onto yours as dashed red rings. Toward the end
  this is how the last camps are found.
- **Plants**: kingsfoil (about 370) and four seeds for Éowyn: wild thyme in the
  northern glades, bay in the woods, poppies about the old farms, wild olive in
  the south (60 to 80 of each). Walk over them; seed has a gold glimmer.
- Saves are version 4. Older saves start a new ranger and keep their settings.

### Streams

Streams are traced, not drawn (`world/terrain.js`): each starts at a spring under
the mountains and is walked downhill over the base terrain, joining any stream it
meets. Its bed is a running minimum along the course, so it never rises, and the
ground is cut down to it in a small valley. Where a trace comes round in a loop
it has found a hollow: the loop is cut out and a pool (6 to 13 m) lies there
instead, 37 in all. Streams that come within 28 m of another join it; nothing
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

### Known gaps to pick up

- **Balance is still a guess**, now with one playtest behind it (three in a camp
  was comfortable, five was too many at starting gear). The north should now be
  gentle; nobody has yet tried the south with good gear.
- Enemies steer simply: straight at the ranger, side-stepping what blocks them.
  They pass through their own stockade stakes (which stop the ranger).
- A mine is a rock heap with a black mouth, not a cave you can enter.
- Streams bend at 9 m joints and have no falls of their own. Paths and roads
  ford them; there are no bridges but the broken one.
- No blocking or dodging move. No stealth beyond walking. No sound.
- Loot bags and a camp's dead are forgotten if you leave and return.
- The blight changes sky, fog and light but not the colour of ground and plants.
- Trees appear at the edge of the loaded radius without a fade. The near/far
  swap of plants happens a chunk (160 m) at a time and may show as a change of
  detail at about 80 m; worth watching on a phone.
- The v0.3 look has not yet been tried on a real phone: frame rate on medium is
  a guess. If it is slow, lower `grass`, `lodNear` and `terrainSegments` for
  medium in config.js first.
- Field walls and houses are axis-aligned. Osgiliath is plain blocks.
- Nothing yet happens when every camp is cleared beyond Faramir's last words.

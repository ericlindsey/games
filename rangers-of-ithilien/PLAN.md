# Rangers of Ithilien: Plan

Status: **Milestones 1 to 3 are built, with the core of 4** (gear and trade). The game is
playable from first task to last camp. Next: Milestone 5 (atmosphere: sound, day and night)
and the tuning listed in section 10.

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
small serene ruins. Concretely:

- **Low-poly, stylised, procedural (default).** Flat-shaded geometry with vertex
  colours. Trees are simple trunks and layered canopies; rocks are faceted.
- **Fog is the art director.** Warm distance haze that hides the far clip and
  makes landmarks emerge gradually. Colour shifts by region (golden in the central
  woods, grey-green in the south, pale on the heath).
- **Low sun.** Fixed late-afternoon light in M1, with the sun in the west so that
  it shines through the falls into the cave.
- **Muted natural palette**: moss, bark, lichen stone, pale gold light. Ruins in
  weathered white stone, half-swallowed by ivy and roots.
- **Characters** are simple low-poly figures (hooded green-and-brown ranger;
  Faramir and Éowyn distinguishable by colour and silhouette).
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
- The terrain mesh leaves a slot where the cliff face is built by hand.
- A stair of worn stone runs along the south wall of the basin. Its lower flight
  climbs from the floor beside the pool to the cave door. At the door it forks:
  an upper flight doubles back west above the lower one and comes out on the rim,
  in the forest. The south wall of the basin stands back 2 m to make room.
- So there are two ways home: down the upper flight from the rim, or up the cut
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
| Visual style | Modern clean low-poly, flat shaded, vertex colours. |
| World size | 2 × 4 km (reduced from 3.2 × 6.4 after playtest). |
| Forest | Dense and tall, closing overhead; a once-farmed land going back to woods. |
| Camps | A hundred or more. |
| Tooling | No build step. Three.js r170 vendored. |
| Hosting | GitHub Pages from the repo root, with a landing page linking each game. |
| Combat | Aimed, real-time, especially the bow. On touch, one Attack button picks target and weapon. |
| Death | The ranger wakes at home and loses nothing. |
| Camps | Cleared by defeating everyone in them, not by a key press. |
| Player | A fixed, unnamed ranger for now. |
| Tone | Upbeat: the war is won. Occupied land is grey and sour; cleared land turns bright and healthy again. |
| Sharing | Personal project, not for publication. |

## 10. What is built

### The land (M1, with playtest changes)

- Terrain, the Anduin, five streams, the Ephel Dúath, both roads, soft boundaries.
- Henneth Annûn: hidden pool, the cut, the forked stair, the cave.
- Forest of great trees with understory, herbs and litter; fens; Cormallen;
  heather slopes where the camera rides above the bushes.
- 52 old farms and hamlets; seven named ruins; 44 lesser ruins of ten kinds; the
  Cross-roads, the edge of Osgiliath, the barred Morgul Vale, Cair Andros.
- 26 km of half-seen old paths (`world/paths.js`) joining all of the above and
  the two ways out of Henneth Annûn. They thin the trees, show on the ground
  and the map, and carry worn slabs and small cairns.

### The enemy and the fighting (M3)

- 125 camps hold 500-odd enemies (`data/enemies.js`): orcs, orc archers, Uruks,
  Southrons, and a captain in each stockade. Tougher with danger tier.
- A camp's company appears when the ranger comes within 120 m and is forgotten
  beyond 190 m. They notice at 27 m (13 m if you walk), rouse the whole camp,
  chase, strike with a visible wind-up, and shoot. They give up 80 m from camp
  and will not come within about 200 m of the falls.
- When the last of a company falls, the camp is cleared for good, its stores are
  taken, and the blight lifts.
- Sword: click or F. Bow: hold to draw, release to loose; over-shoulder camera
  and an aiming mark; arrows fly in an arc and are spent. Q or 1/2 to change.
- Touch: one Attack button. It picks the nearest enemy, shoots if they are far
  and there are arrows, and strikes if they are near.
- Health mends slowly out of combat; waybread and draughts mend it faster (H).
  At no health the ranger falls and wakes in the cave, losing nothing.

### Things, tasks and trade (M2, M4)

- Items in `data/items.js`: four swords, four bows, three armours, food,
  draughts, kingsfoil, and loot to sell.
- Loot drops from the fallen in bags you walk over; more from each camp's stores.
- The pack panel (I) shows tasks, gear and goods; wield, wear and use from there.
- Mablung, in the cave, buys and sells. Better goods need renown, which comes
  from finishing tasks.
- Twelve tasks in `data/quests.js`: eight from Faramir (clearing camps, the long
  roads south, ending with every camp), four from Éowyn (kingsfoil, the old
  places, a village). Offered and handed in through dialogue; the first active
  task shows on the HUD, as a marker on the compass and a ring on the map.
- Kingsfoil grows at glade edges (221 plants) and is gathered by walking over
  it. After her first task Éowyn steeps two plants into a draught.
- Saves are version 3 and carry all of this.

### Known gaps to pick up

- **Balance is untested by a person.** Numbers were set by reasoning and by
  automated fights, not by play. Expect the first camps to be easy and far
  stockades to be deadly; both may be too much so.
- **Performance is unmeasured on real hardware** beyond one report that High ran
  smoothly on a phone. Each living enemy adds about a dozen draw calls.
- Enemies steer simply: straight at the ranger, side-stepping what blocks them.
  They pass through their own stockade stakes (which stop the ranger), and can
  be led round trees. Arrows ignore tree trunks.
- No blocking or dodging move; you avoid a blow by stepping away during the
  wind-up. No stealth beyond walking. No hit sounds, because there is no sound.
- Loot bags and a camp's dead are forgotten if you leave and return.
- The blight changes sky, fog and light but not the colour of ground and plants.
- Trees appear at the edge of the loaded radius without a fade.
- Field walls and houses are axis-aligned. Osgiliath is plain blocks.
- Nothing yet happens when every camp is cleared beyond Faramir's last words.

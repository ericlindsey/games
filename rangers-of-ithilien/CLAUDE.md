# Rangers of Ithilien

An open-world exploration and adventure game in Three.js. The War of the Ring is
over; the player is one of Faramir's rangers, based at Henneth Annûn, clearing
Ithilien of the orcs and evil men who fled the battle at the Black Gate.

**Read `PLAN.md` first.** It holds the roadmap, the current milestone, the world
layout, and the open design questions. This file holds the rules that stay true
across milestones.

> Status: the land, enemies, combat, gear, tasks and trade are built. See PLAN.md
> section 10 for exactly what exists and what is known to be rough.

## Design pillars

When a decision is unclear, choose the option that serves these, in this order:

1. **Exploration first.** Walking through the land should be rewarding by itself:
   long sightlines, landmarks that pull you onward, small ruins worth the detour.
2. **Faithful geography.** The world layout follows Tolkien's descriptions of
   Ithilien (see "World and lore rules"). Scale is compressed; relationships are not.
3. **A mood, not a spectacle.** Old-RPG atmosphere: fog, low sun, quiet, small
   serene ruins. Since v0.3 the look is stylised but rich: textured stone and bark,
   leafy canopies, grass that moves, soft filmic light (see PLAN.md section 4).
   Not photo-real. We take inspiration from a feeling; we never copy another
   game's assets, models, layouts, or UI.
4. **Small and working beats large and broken.** Every milestone ends playable.

## Tech rules

- **Three.js, vanilla ES modules, no build step.** Three.js is vendored in
  `vendor/` at a pinned version and loaded through an import map in `index.html`.
- **No runtime dependencies besides Three.js.** No frameworks, no physics engine,
  no asset pipeline. Ask before adding any dependency.
- **All assets are procedural**: geometry built in code, colours from vertex
  colours, grain from small textures generated in code at load (`world/surface.js`).
  No downloaded models or images.
- **Deterministic world.** Everything placed in the world derives from the world
  seed and position (seeded RNG, never `Math.random()` in world generation), so the
  same world appears on every device and saves stay small. Never shuffle with
  `sort(() => rand() - 0.5)`: engines call the comparator a different number of
  times, so the random sequence (and the world after it) differs between browsers.
- **Mobile is a first-class target for exploration.** Anything in the exploration
  loop (moving, looking, talking, map, saving) must work with touch. Combat and
  skills may require keyboard and mouse.
- **Performance budget**: 60 fps on a laptop, 30 fps on a recent phone. Use
  fog to bound view distance, `InstancedMesh` for vegetation, chunked terrain, and a
  capped device pixel ratio (lowered by steps while the frame rate sags). Plants
  have a near, a middle and a far form, chosen tree by tree by distance
  (`assignVegetation`), fading from one to the next in a dither; ground cover and
  grass draw only near and shrink away with distance. Anything with a swaying
  material must be built about its own base, not where it stands in the world. Check draw
  calls and triangle count (the `?debug` overlay) when adding content; `high` runs
  about 2 to 2.5 million triangles in the woods.

## Code layout

```
index.html            canvas, import map, HUD and panel markup
manifest.json, icon.svg   lets a phone add the game to its home screen (no browser bars)
css/style.css
vendor/               three.module.min.js (pinned; see vendor/VERSION)
src/
  main.js             boot, wiring, the game loop
  dev.js              the testing panel (loaded only by debug.html / ?dev)
  config.js           world size, seed, player and quality tunables
  data/               dialogue.js, quests.js, items.js, enemies.js (types and camp rosters): all pure data
  world/
    layout.js         WHERE THINGS ARE: Henneth Annûn, landmarks, roads, streams (pure)
    regions.js        region weights, danger tier (pure)
    terrain.js        heightAt(x, z); traces the streams; the basin and cut at Henneth Annûn (pure)
    oldworks.js       old farms and hamlets: houses, fields, lanes, planted rows (pure)
    relicSites.js     27 lesser ruins (pure)
    paths.js          the old paths joining everything (pure)
    campSites.js      the enemy camps (exactly CAMP_COUNT, 100), blight (pure)
    provinces.js      the eight provinces: borders along streams, provinceAt(x, z), each one's camps and hold (pure)
    herbSites.js      where kingsfoil and the seed plants grow (pure)
    forest.js         forest density, heather thicket density (pure)
    groundColor.js    ground colour by place, height, slope (pure)
    collision.js      solids (boxes: wall + floor), circles (trunks), hollows (cave) (pure)
    terrainMesh.js    near chunks, far backdrop, far forest roof
    vegetation.js     all plant species, per-chunk instancing
    water.js          the Anduin and stream ribbons
    atmosphere.js     sky, sun, fog; blight, under-canopy shade, cave dimming
    motes.js          drifting motes of light under the trees
    hennethAnnun.js   the cave rock, the stair, the fall and pool
    ruins.js          named ruins and large landmarks
    farms.js          builds the old farms and hamlets from oldworks.js
    camps.js          builds the camps from campSites.js
    relics.js         builds the lesser ruins (each a LOD: the small things only near) and the waymarks on paths
    herbs.js          draws kingsfoil and the seed plants; gathering
    build.js          GeoBuilder (parts with a surface kind, smooth or faceted, leaf cards) and the shared materials
    surface.js        generated detail textures and leaf atlas; the material patch (triplanar grain, bump, moss, wind, leaf glow, the cave's torchlight)
    rocks.js          fractured rock geometry (boulders, outcrops, rubble, standing stones)
    grass.js          the field of grass blades around the ranger, built in tiles
  entities/           player.js (ranger + camera rig), enemies.js (spawning and AI),
                      figure.js (people, their weapons in hand, sheathed or slung, the quiver's arrows;
                      what is carried on the back rides over the cloak, which bends from the hips)
  input/input.js      keyboard, mouse and touch -> one input state
  ui/                 hud.js (compass, vitals, tracker, notices), panels.js (dialogue, map, pack, trade, menu)
  systems/
    save.js           the only code that touches localStorage
    inventory.js      pack, gear, wear and honing, healing, buying, selling, loot tables (pure)
    provinces.js      how each province stands (freed = hold + 3 in 4 camps); every old place, by province (pure)
    quests.js         reads data/quests.js against the saved state; builds errands, hints (pure)
    renown.js         renown points and levels; what deeds are worth; how the enemy grows (pure)
    combat.js         the ranger's sword and bow, arrows in flight, health, loot bags
  util/noise.js       hashing, value noise, seeded RNG
tests/
  unit.test.js        pure logic (node --test)
  smoke.mjs           drives the real game in headless Chromium, desktop + phone
tools/                for looking at changes: shoot.mjs (screenshots from views, before and
                      after), perf.mjs (what is drawn where); views/*.json; common.mjs
```

Files marked (pure) must not import Three.js or touch the DOM, so they run in Node tests.
Their import order is fixed, to avoid cycles:
layout -> regions -> terrain -> oldworks -> relicSites -> paths -> campSites -> provinces -> forest -> groundColor.
In systems/, provinces comes before quests (quests may ask after provinces, never the reverse).

Rules of thumb:

- `world/terrain.js` exposes one pure function, `heightAt(x, z)`, that is the single
  source of truth for the ground. Rendering, collision, and object placement all call it.
- Input modules never touch the player directly. They write an input state
  (`move`, `look`, `run`, `interact`, ...) that game code reads.
- UI is HTML/CSS layered over the canvas, not drawn in WebGL.
- Game state that must survive a reload lives in one plain serialisable object
  owned by `systems/save.js`. Nothing else writes to `localStorage`.

## Coordinates and units

- 1 world unit = 1 metre. Y is up.
- **+X is east, +Z is south** (so north is −Z, matching a north-up map viewed from above).
- The Anduin is the west edge (low X); the Ephel Dúath is the east edge (high X).
- World dimensions and all positions are defined once in `src/config.js` and
  `src/world/layout.js`. Never hard-code a position elsewhere.
- Yaw: forward = (sin yaw, 0, cos yaw), so north is yaw = PI. Figures face +Z at yaw 0.

## World and lore rules

- Play area: bounded by the Anduin (west), the Ephel Dúath (east), the
  Osgiliath–Minas Ithil road (south), and the thinning of the forest (north).
- The world is 1.5 km east-west by 3 km north-south (since v0.5; it was 2 by 4),
  with exactly 100 enemy camps.
- Henneth Annûn sits in the northern third, about halfway between river and
  mountains. The fall faces **west** (it is the Window of the Sunset). The pool is
  walled in by cliffs and cannot be seen until you stand over it. The stream leaves
  by a deep narrow cut running west, which runs out to ground level about 350 m
  downstream. One stair runs along the south wall: up from the pool to the cave door.
  From the cave a hidden stair climbs through the rock to a hole in the forest floor
  above, half behind bushes; no path leads to it. There must always be a walkable way
  out of the basin; tests/smoke.mjs walks both.
- Ithilien was the garden of Gondor: farmland and villages, now long abandoned and
  half taken back by forest. Great trees "planted long ago" stand 25-38 m tall over
  a riot of younger growth; old field walls, roofless houses and rows of planted
  trees show through. Woods with wide glades in the north, closing to deep forest
  in the south: old forest, giants taller still over clear, fern-grown ground, so
  you see far between the trunks. Herbs and flowers everywhere.
- East of the Harad Road the country is tall heather and gorse, over head height,
  with winding ways between.
- The land rises from the river in the west to the mountains in the east. Streams
  run east to west.
- Danger grows with distance from Henneth Annûn, and is worst toward the mountains,
  the Morgul road in the south, and the northern heath.
- Occupied enemy camps lay a blight on the land around them (grey-green haze, dim
  light). Clearing a camp heals it. The healthy land is bright and a little joyful:
  the war is won. Keep that contrast as features are added.
- The setting is the months after the fall of Sauron. Faramir and Éowyn are at
  Henneth Annûn as quest-givers (a deliberate liberty with the timeline).
- Names of places and people follow the books. **All in-game text is our own
  writing** in a fitting voice. Do not quote or closely paraphrase the books, and
  do not imitate the look of the films.
- When unsure about a geographic or lore detail, say so and check rather than guess.

## Game rules worth knowing before changing things

- All the ranger's progress lives in the saved state object (`systems/save.js`
  `newState()`): position, discoveries, cleared camps, health, gear, pack,
  silver, renown, tasks, gathered herbs. Enemies, arrows and loot bags are
  never saved; they are rebuilt from the camps as the ranger moves.
- A camp is cleared only by `Enemies.damage` reducing its last defender to no
  health, which calls `onCampCleared` in main.js. Do not add other routes.
- Provinces (`world/provinces.js`) are places to win; the terrain regions
  (`world/regions.js`) are kinds of country. Do not mix them up: the place line
  and the tasks speak of provinces, plants and looks follow regions. How a
  province stands is worked out from the saved state, never stored.
- A roused company chases until the ranger is `CHASE.lost` (100 m) off or in
  the refuge, never for being far from its camp, and rouses any company at rest
  within `CHASE.rouse` (35 m) of it (data/enemies.js). Keep camps' companies
  further apart than that at rest (a unit test checks).
- Trophies (`kind: 'trophy'`) drop only while an errand asks for them
  (`wantedTrophies`); ordinary loot is coin, things to sell, food and gear.
  Mablung buys no trophies, plants or seed (`sellable`).
- A weapon does damage in proportion to how sound it is (`wearFactor`); the
  ranger is told at every tenth it loses.
- Wounds never mend by themselves. Health comes back only from healing items,
  resting on the mats in the cave (`refuge.beds`), and waking at home after a fall.
- Errands keep to the working province (`workingProvince()` in
  systems/provinces.js: the first in `CAMPAIGN` not yet free). New errand kinds
  should too; only trophies, plants and the road are taken from anywhere.
- Tasks are data (`data/quests.js`). Progress is computed from the saved state
  each time it is asked for, so there are no counters to keep in step. A new
  kind of objective needs a case in `systems/quests.js` `progress()` (and in
  `hintTarget()` if it has a place). Errands are built from templates when
  offered and saved whole while in hand, with any starting count (`base`).
- Renown is a level worked out from points (`state.honour`); only
  `addHonour()` changes them. Gear, prices and renown gates are balanced to
  stretch over the whole game: the best gear should come near renown 50.
- The economy is deliberately lean (loot tables in `systems/inventory.js`, prices
  in `data/items.js`, quest rewards in `data/quests.js`). After playtest, 23 camps
  gave 126 arrows and 767 silver, which was too much; keep that in mind when adding loot.
  (Since v0.5 there are half as many camps, each giving about 1.6 times the silver
  and renown it did, so the totals over the game are unchanged.)
- Water runs downhill. Stream beds come from `STREAMS` in terrain.js and never
  rise along a stream; draw water from those beds, never from a formula of your own.
- Anything built on the ground is levelled to the ground as it stands there
  (`FLATS` in terrain.js for landmarks; `levelGround()` for things placed after
  terrain.js loads, as the lesser ruins are, which may also dig a court down).
  tests/unit.test.js checks no ruin sits in a bowl and the lesser ones are level.
  Anything long built on unlevelled ground (field walls, houses) stands on the
  lowest ground under it or steps with the slope, so no end hangs in the air.
- The world placed before v0.6 must not move (saves name camps by number): a new
  site is added after the scatter with its own generator (see the Window Woods
  village in oldworks.js), and checked to leave the camps and ruins as they were.
- What you see must match what stops you. Rock skins and bulges stand proud of
  a wall only above head height near where people walk; colliders of rocks and
  trunks are as wide as what is drawn at body height. If anyone ever ends up
  inside a solid, `Player.escape` sets them free (to where they last stood
  clear, else the nearest open spot); enemies are set down clear of walls,
  rocks and trunks (`Enemies.clearSpot`), and a trunk's push never shoves anyone
  into a wall.
- Everything a person can do must work by touch: on a phone there is no aiming,
  so anything aimed needs an automatic form (see `Combat.update`).
- All in-game text is ours (dialogue, tasks, item notes, notices). Keep the
  voice: plain, a little formal, warm; hopeful rather than grim.

## Saving

- `localStorage`, one key, versioned JSON (`version` field plus a migration step
  for old saves). Autosave on a timer and on `visibilitychange`/`pagehide`.
- A missing or corrupt save must never break the game: fall back to a new game.
- Any change to the save shape needs a version bump and a migration.

## Releasing

- `index.html`'s import map lists every module with the release in its URL
  (`?v=0.6a`), and the stylesheet carries it too. Safari in particular will
  otherwise mix freshly fetched files with cached ones from the last release,
  and a module asking an old file for a new export stalls loading silently.
  **Bump `v` (everywhere in index.html) whenever a change is published**, and add
  any new module to the map; `tests/unit.test.js` fails if one is missing.
- If the code fails to load, a small script in index.html puts the error on the
  title screen; if loading stalls for 30 s it suggests a reload.

## Running

```
cd rangers-of-ithilien
python3 -m http.server 8000     # open http://localhost:8000
```

## Verifying a change

1. `node --test tests/unit.test.js`
2. `node tests/smoke.mjs [dir-for-screenshots]` (starts its own server; needs the
   pre-installed Playwright). It fails on any console error or failed request.
   It plays through at `?quality=low` (software rendering cannot click through
   medium or high in time) and then only loads medium and high to see they draw.
   A full run takes 20 to 40 minutes; `SMOKE_ONLY=phone` (any part of a suite's
   name) runs only the matching suites.
3. For hands-on checking, open `debug.html`: it has its own save and shortcuts
   for travel, gear, tasks and enemies.
4. Look at screenshots of what you changed. Useful URL flags: `?autostart` skips
   the title, `?debug` shows the overlay, `?quality=low|medium|high`.
   In the console, `roi.teleport(x, z, yaw)` moves the ranger (`roi.HA` and `roi.WORLD`
   give Henneth Annûn's layout and the world's size), `roi.lookFrom(x, y, z,
   ax, ay, az)` holds the camera at a point looking at another and `roi.follow(dx, dy,
   dz)` at an offset behind the ranger (`null` gives it back), and `roi.state`,
   `roi.enemies`, `roi.combat`, `roi.quests` and `roi.inv` expose the rest; backtick toggles
   the overlay; `G` toggles a fast debug run.
5. For anything visual, shoot it: `node tools/shoot.mjs tools/views/henneth.json`
   (or `woods.json`, `people.json`, or a views file of your own; the format is at
   the top of shoot.mjs) saves a screenshot of each view; add `--ref origin/main`
   to shoot the same views on that version too and set each pair side by side.
   `--only name,name` picks views; `--quality` picks the quality (medium by default).
   Use `origin/main`, not a local `main`, which may be far behind. (The views
   name places in the world as it is now: against a version before v0.5, whose
   land was larger, they show other places.)
6. For anything that may cost frame rate, count it: `node tools/perf.mjs
   [--ref origin/main]` reports triangles and draw calls at a few places, and what
   they are spent on (plants by form, grass, ground, farms, ruins, ...), in view
   and in the shadow map (which the renderer's own count leaves out).
7. Headless Chromium renders in software (single-digit fps; on `high` a single
   screenshot can take a minute), so it proves behaviour, not performance. Say so
   rather than claiming a frame rate.

Add a check to `tests/smoke.mjs` for each new player-facing behaviour.
Report what was checked and what was not.

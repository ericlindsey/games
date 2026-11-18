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
3. **A mood, not a spectacle.** Old-RPG atmosphere: fog, low sun, quiet, stylised
   low-detail geometry. Think the forest zones of late-90s MMOs and the haze of
   early-2000s open-world RPGs, with small serene ruins. We take inspiration from a
   feeling; we never copy another game's assets, models, layouts, or UI.
4. **Small and working beats large and broken.** Every milestone ends playable.

## Tech rules

- **Three.js, vanilla ES modules, no build step.** Three.js is vendored in
  `vendor/` at a pinned version and loaded through an import map in `index.html`.
- **No runtime dependencies besides Three.js.** No frameworks, no physics engine,
  no asset pipeline. Ask before adding any dependency.
- **All assets are procedural**: geometry built in code, colours from vertex
  colours or small canvas-generated textures. No downloaded models or images.
- **Deterministic world.** Everything placed in the world derives from the world
  seed and position (seeded RNG, never `Math.random()` in world generation), so the
  same world appears on every device and saves stay small.
- **Mobile is a first-class target for exploration.** Anything in the exploration
  loop (moving, looking, talking, map, saving) must work with touch. Combat and
  skills may require keyboard and mouse.
- **Performance budget**: 60 fps on a laptop, 30 fps on a mid-range phone. Use
  fog to bound view distance, `InstancedMesh` for vegetation, chunked terrain, and a
  capped device pixel ratio. Check draw calls and triangle count when adding content.

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
    relicSites.js     44 lesser ruins (pure)
    paths.js          the old paths joining everything (pure)
    campSites.js      the enemy camps, blight (pure)
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
    relics.js         builds the lesser ruins and the waymarks on paths
    herbs.js          draws kingsfoil and the seed plants; gathering
    build.js          GeoBuilder and other geometry helpers
  entities/           player.js (ranger + camera rig), enemies.js (spawning and AI), figure.js
  input/input.js      keyboard, mouse and touch -> one input state
  ui/                 hud.js (compass, vitals, tracker, notices), panels.js (dialogue, map, pack, trade, menu)
  systems/
    save.js           the only code that touches localStorage
    inventory.js      pack, gear, wear and honing, healing, buying, selling, loot tables (pure)
    quests.js         reads data/quests.js against the saved state; builds errands, hints (pure)
    renown.js         renown points and levels; what deeds are worth; how the enemy grows (pure)
    combat.js         the ranger's sword and bow, arrows in flight, health, loot bags
  util/noise.js       hashing, value noise, seeded RNG
tests/
  unit.test.js        pure logic (node --test)
  smoke.mjs           drives the real game in headless Chromium, desktop + phone
```

Files marked (pure) must not import Three.js or touch the DOM, so they run in Node tests.
Their import order is fixed, to avoid cycles:
layout -> regions -> terrain -> oldworks -> relicSites -> paths -> campSites -> forest -> groundColor.

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
- The world is 2 km east-west by 4 km north-south.
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
  in the south. Herbs and flowers everywhere.
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
- Water runs downhill. Stream beds come from `STREAMS` in terrain.js and never
  rise along a stream; draw water from those beds, never from a formula of your own.
- Anything built on the ground is levelled to the ground as it stands there
  (`FLATS` in terrain.js). tests/unit.test.js checks no ruin sits in a bowl.
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
  (`?v=0.2.2`), and the stylesheet carries it too. Safari in particular will
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
3. For hands-on checking, open `debug.html`: it has its own save and shortcuts
   for travel, gear, tasks and enemies.
4. Look at screenshots of what you changed. Useful URL flags: `?autostart` skips
   the title, `?debug` shows the overlay, `?quality=low|medium|high`.
   In the console, `roi.teleport(x, z, yaw)` moves the ranger, and `roi.state`,
   `roi.enemies`, `roi.combat`, `roi.quests` and `roi.inv` expose the rest; backtick toggles
   the overlay; `G` toggles a fast debug run.
5. Headless Chromium renders in software (single-digit fps), so it proves
   behaviour, not performance. Say so rather than claiming a frame rate.

Add a check to `tests/smoke.mjs` for each new player-facing behaviour.
Report what was checked and what was not.

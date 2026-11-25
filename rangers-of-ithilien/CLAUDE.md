# Rangers of Ithilien

An open-world exploration and adventure game in Three.js. The War of the Ring is
over; the player is one of Faramir's rangers, based at Henneth Annûn, clearing
Ithilien of the orcs and evil men who fled the battle at the Black Gate.

**Read `PLAN.md` first.** It holds the roadmap, the current milestone, the world
layout, and the open design questions. This file holds the rules that stay true
across milestones.

> Status: the land, enemies, combat, gear, tasks, trade and the first settlements
> are built. See PLAN.md section 10 for exactly what exists and what is known to be rough.

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
  have a near, a middle and a far form, chosen tree by tree by distance, fading
  from one to the next in a dither; ground cover and grass draw only near and
  shrink away with distance. Every plant is drawn through one mesh per species
  and form for the whole land (`VegetationField`), culled plant by plant to the
  camera's view; those that cast shadows are drawn into the shadow map from
  their own meshes, only where it reaches. Draw calls cost a phone's browser as
  much as triangles: do not add one mesh per thing where one per kind will do.
  Nothing slow may run whole in one frame while the ranger moves: land coming
  into range (a chunk's ground and plants, a grass tile) is built by generators
  that yield every row (`util/slice.js`), a couple of milliseconds a frame
  (`buildMs`), and all at once only while loading or after a teleport. Enemy
  figures for the companies about to be met are made ahead the same way.
  Anything with a swaying material must be built about its own base, not where it
  stands in the world. Check draw calls and triangle count (the `?debug` overlay,
  `?bench`, whose running stretches count the slow frames) when adding content;
  `high` runs about 1.2 to 3 million triangles and about 200 draw calls.

## Code layout

```
index.html            canvas, import map, HUD and panel markup
manifest.json, icon.svg   lets a phone add the game to its home screen (no browser bars)
css/style.css
vendor/               three.module.min.js (pinned; see vendor/VERSION)
src/
  main.js             boot, wiring, the game loop
  dev.js              the testing panel (loaded only by debug.html / ?dev)
  bench.js            the frame-rate test (loaded only by ?bench / roi.bench())
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
    settlements.js    each province's settlement: its site, the settlers' landing, crops, plots; homesteads;
                      which plots are cleared now (setClearedPlots / inPlot) (pure)
    forest.js         forest density, heather thicket density (pure)
    groundColor.js    ground colour by place, height, slope (pure)
    collision.js      solids (boxes: wall + floor), circles (trunks), hollows (cave) (pure)
    terrainMesh.js    near chunks, far backdrop (the Ephel Dúath on a finer grid of their own), far forest roof
    vegetation.js     all plant species, placed chunk by chunk; VegetationField draws them all (one mesh per species and form)
    water.js          the Anduin and stream ribbons
    atmosphere.js     sky, sun, fog; blight, under-canopy shade, cave dimming
    whiteMountains.js the White Mountains far over the Anduin, Mindolluin and the white city with its
                      glint: drawn past the fog, hazed in their own shader (layout.js WHITE_MOUNTAINS)
    motes.js          drifting motes of light under the trees
    hennethAnnun.js   the cave rock, the stair, the fall and pool
    ruins.js          named ruins and large landmarks
    farms.js          builds the old farms and hamlets from oldworks.js
    villages.js       the settlements as they come back to life: mended houses, sown plots, smoke,
                      the boat, the people, and the settlers following the ranger home
    camps.js          builds the camps from campSites.js
    relics.js         builds the lesser ruins (each a LOD: the small things only near) and the waymarks on paths
    herbs.js          draws kingsfoil and the seed plants; gathering
    build.js          GeoBuilder (parts with a surface kind, smooth or faceted, leaf cards) and the shared materials
    surface.js        generated detail textures, crag texture and leaf atlas; the material patch (triplanar grain, bump, moss, wind, leaf glow,
                      the mountains' crags, the cave's torchlight)
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
    settlement.js     how far each settlement has come (stage 0-4), what is sown and sold; homesteads lived in (pure)
    quests.js         reads data/quests.js against the saved state; builds errands, hints (pure)
    renown.js         renown points and levels; what deeds are worth; how the enemy grows (pure)
    combat.js         the ranger's sword and bow, arrows in flight, health, loot bags
  util/noise.js       hashing, value noise, seeded RNG
  util/slice.js       finish(): runs a yielding builder to the end at once
tests/
  unit.test.js        pure logic (node --test)
  smoke.mjs           drives the real game in headless Chromium, desktop + phone
tools/                for looking at changes: shoot.mjs (screenshots from views, before and
                      after), perf.mjs (what is drawn where); views/*.json; common.mjs;
                      chrome.mjs (the game in this machine's Chrome, on its real GPU: --bench, --eval,
                      --eval-file calls.js or costs.js, --shot, --cpu 5 to slow it like a phone)
```

Files marked (pure) must not import Three.js or touch the DOM, so they run in Node tests.
Their import order is fixed, to avoid cycles:
layout -> regions -> terrain -> oldworks -> relicSites -> paths -> campSites -> provinces -> forest -> groundColor.
In systems/, provinces comes before settlement, and both before quests (quests may ask
after them, never the reverse). world/settlements.js comes after provinces.js.

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
  `newState()`): position, discoveries, camps cleared and broken up, health,
  gear, pack, silver, renown, tasks, gathered herbs. Enemies, arrows and loot bags are
  never saved; they are rebuilt from the camps as the ranger moves.
- A camp is cleared only by `Enemies.damage` reducing its last defender to no
  health, which calls `onCampCleared` in main.js. Do not add other routes.
  Since v0.8 a cleared camp still stands until the ranger breaks it up (`breakUp`
  in main.js, from the prompt near it; `state.broken`): only that takes its stores,
  folds its shelters, puts out its fire and lifts its blight. Tasks, provinces and
  renown count cleared camps, never broken ones.
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
- **The story runs province by province** (since v0.7): Faramir's chain frees
  each province in `CAMPAIGN` order and ends on the Marshal (the Morgul hold's
  captain, `MARSHAL_CAMP`); Éowyn's maps each province of the woods (`m-<province>`:
  old places there and its settlement's site), and once it is free and mapped
  the ranger leads its settlers home from their boat (`s-<province>`, `whenFreed`).
  A farmstead she is shown for a family (a homestead) is fetched the same way, by her
  errand `family`, once its province is free (since v0.8.2).
  New told tasks should feed one of those threads, not stand alone (no counts of
  fires or places for their own sake). Faramir and Éowyn offer errands only when
  they have no told task to offer.
- **Settlements** (`world/settlements.js`, `systems/settlement.js`): the only stored
  facts are `state.settled` (settlers led home, and homestead families since v0.8.2),
  `state.homesteads` (farms promised to a family) and `state.escort` (settlers on the
  way, where they wait). `placeBySite` finds a settlement or a homestead by its site. A
  settlement's stage is the count of its people's errands done (`quests.count[site]`);
  what stands, what is sown and what is sold all follow from it. Call `settle()` in
  main.js after anything that may change them: it rebuilds what changed and clears
  the woods and grass off new-sown plots (`ground.refresh`, `grass.refresh`).
  Settlement content never moves the world placed before it. Settlers led home
  are handed to their place as they stand (`Villages.arrive`), and whatever is
  new in a place (the well, a house, the cross) is built by its people over a few
  seconds (`p.queue`, `work`), never popped in; only loading a save shows it whole.
  Each has a reeve (tasks, seed), a storekeeper (`villageShop`) and a bed (`innNear`).
  A lived-in place keeps its yards bare (`yardsOf`, part of `clearedGround`); a
  mended house is solid, and a door above the ground has steps.
- Notices (`hud.toast(big, small, kind)`) are all one size; `kind` only colours
  them ('great', 'task', 'warn', and the fight's 'seen', 'felled', 'hurt', which
  `hud.callout` uses). Up to ten stack, the newest at the bottom.
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
- Since v0.8.3 the ground where two streams' valleys meet is blended, not stepped, but
  only from the end of world/settlements.js on (`smoothStreamMeetings`): everything
  placed by reading the ground (camps, ruins, farms, paths, settlements, the plants'
  sites) is placed before that, on the shape it always had. Anything new placed that way
  must be too, or it will not stand where it did. The ranger and enemies judge a slope
  over a stride (`PLAYER.slopeRun`), not one frame's step; tests/smoke.mjs `footing`
  runs him over the land and fails if he sticks on unseen rough ground.
- What you see must match what stops you. Rock skins and bulges stand proud of
  a wall only above head height near where people walk; colliders of rocks and
  trunks are as wide as what is drawn at body height. If anyone ever ends up
  inside a solid, `Player.escape` sets them free (to where they last stood
  clear, else the nearest open spot); enemies are set down clear of walls,
  rocks and trunks (`Enemies.clearSpot`), and a trunk's push never shoves anyone
  into a wall.
- Anything placed against the top of the screen uses `var(--safe-top)`, not
  `env(safe-area-inset-top)`, and anything filling the screen `var(--app-h)` under
  `html.app`: a home-screen app on an upright iPhone reports neither rightly (since v0.8.3;
  index.html's head sets them).
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
  (`?v=0.8.5`), and the stylesheet carries it too. Safari in particular will
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
   `SMOKE_ONLY=settlers` (any part of a suite's name: desktop, phone, phone upright,
   settlers, footing, camps, testing, quality) runs only the matching suites. **Run the whole suite
   only for a major release (0.8, 0.9, ...)**: in software rendering it takes about an
   hour and a half (times below), and a run cut short by a time limit or sharing the
   machine with another fails on timing, not on the game. Start a long run detached
   (`setsid nohup ...`) so a tool's time limit does not stop it. For a point release
   (0.8.x) run the unit tests and the suites the change touches, say which, and run each
   suite alone (one at a time: two at once slow each other into timeouts). On a machine
   with a GPU it is much quicker. Each check line shows how far into its suite it came
   (`[m:ss]`), each suite its time, and the run ends with a table of them.

   Times measured for v0.8.1 in a cloud container, headless Chromium in software
   rendering, each suite run alone (unit tests: 52 in 0.8 s; the slowest 40 ms):

   | suite | time | where it goes |
   |---|---|---|
   | desktop | 64:44 | after aiming: tree arrow, road band, house escape, chase, travel, falling, handing in (11:30); Faramir's map, errands, asking thrice, Éowyn, a farm (10:00); provinces (6:30); the walks out by the cut and the hidden stair (4:00 each); the first fight (5:40); trade and pack (3:30, 3:00) |
   | phone (touch) | 2:39 | |
   | phone upright (touch) | 1:46 | |
   | settlers | 14:43 | the family carrying their bags home (5:53); their first field sown (2:11); the storekeeper (1:44), the reeve (1:39) |
   | camps and scouts | 3:33 | waiting for a scouting party (1:46); the shelters folding (0:46) |
   | testing page on a phone | 0:28 | |
   | testing page | 2:53 | |
   | quality medium, high | 1:17, 2:01 | |
   | all | about 1:35 | |

   Most of it is game time crawling: the frame step is capped at 0.05 s and software
   rendering draws 1 to 3 frames a second, so a wait of a few seconds of game time (an
   arrow's flight, a walk, a timer) takes a minute or more of the clock.
3. For hands-on checking, open `debug.html`: it has its own save and shortcuts
   for travel, gear, tasks and enemies.
4. Look at screenshots of what you changed. Useful URL flags: `?autostart` skips
   the title, `?debug` shows the overlay, `?quality=low|medium|high`,
   `?tune=treeNear:150,grass:100` overrides quality settings (`buildMs:0` builds
   new land whole, as before v0.7.2; `fpsCap:30` holds the frame rate to 30, as the
   menu's setting does), `?bench` runs the frame-rate test.
   In the console, `roi.teleport(x, z, yaw)` moves the ranger (`roi.HA` and `roi.WORLD`
   give Henneth Annûn's layout and the world's size), `roi.lookFrom(x, y, z,
   ax, ay, az)` holds the camera at a point looking at another and `roi.follow(dx, dy,
   dz)` at an offset behind the ranger (`null` gives it back), and `roi.state`,
   `roi.enemies`, `roi.combat`, `roi.quests` and `roi.inv` expose the rest; backtick toggles
   the overlay (which shows, besides, the time between frames and the time the game's own
   work takes of it, for telling a slow GPU from slow code on a phone); `G` toggles a fast
   debug run.
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
7. Headless Chromium under Playwright renders in software (single-digit fps; on
   `high` a single screenshot can take a minute), so it proves behaviour, not
   performance. Say so rather than claiming a frame rate. On a machine with Google
   Chrome and a GPU, `node tools/chrome.mjs --quality high --bench` runs the game
   in that Chrome (headless, but on the real GPU, needing no packages) and times
   it; `--size 2560x1440` for a big screen, `--url-extra "&tune=grass:100"` to try
   a setting, `--eval-file tools/calls.js` for draw calls by kind, `tools/costs.js`
   for time by kind. It needs a server on port 8765 (or `--serve`). On a laptop
   high took 5.5 ms a frame at 2048x1536 in v0.7.1; a phone took about five times
   as long as the laptop before it. `?bench` runs the same test on a phone. The
   bench ends with two 15 s runs and counts the frames over 25 and 33 ms; `--cpu 5`
   slows Chrome's main thread five times, roughly a phone's, to see hitches that a
   fast laptop hides.

Add a check to `tests/smoke.mjs` for each new player-facing behaviour.
Report what was checked and what was not.

# Rangers of Ithilien

An open-world exploration and adventure game in Three.js. The War of the Ring is
over; the player is one of Faramir's rangers, based at Henneth Annûn, clearing
Ithilien of the orcs and evil men who fled the battle at the Black Gate.

**Read `PLAN.md` first.** It holds the roadmap, the current milestone, the world
layout, and the open design questions. This file holds the rules that stay true
across milestones.

> Status: planning. No code yet. Sections below marked *(planned)* describe the
> intended structure; update them to match reality as the code lands.

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

## Code layout *(planned)*

```
index.html            canvas, import map, HUD and touch-control markup
css/style.css
vendor/               three.module.js (pinned)
src/
  main.js             boot, game loop, wiring
  config.js           world size, seed, tunables (one place for magic numbers)
  world/              terrain height function, chunks, water, vegetation,
                      landmarks, ruins, Henneth Annûn, sky and fog, regions/danger
  entities/           player, NPCs (later: enemies)
  input/              keyboard+mouse, touch; both feed one abstract input state
  ui/                 HUD, compass, dialogue, map, menus (HTML/CSS over the canvas)
  systems/            save/load (later: quests, inventory, combat, loot)
  util/               seeded RNG, noise, math helpers
tests/                node unit tests for pure logic; Playwright smoke test
```

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
- World dimensions and all landmark positions are defined once in `src/config.js`
  and `src/world/landmarks.js`. Never hard-code a position elsewhere.

## World and lore rules

- Play area: bounded by the Anduin (west), the Ephel Dúath (east), the
  Osgiliath–Minas Ithil road (south), and the thinning of the forest (north).
- Henneth Annûn sits in the northern third, about halfway between river and
  mountains. The fall faces **west** (it is the Window of the Sunset); its stream
  runs west to the Anduin.
- The land rises from the river in the west to the mountains in the east. Streams
  run east to west.
- Danger grows with distance from Henneth Annûn, and is worst toward the mountains,
  the Morgul road in the south, and the northern heath.
- The setting is the months after the fall of Sauron. Faramir and Éowyn are at
  Henneth Annûn as quest-givers (a deliberate liberty with the timeline).
- Names of places and people follow the books. **All in-game text is our own
  writing** in a fitting voice. Do not quote or closely paraphrase the books, and
  do not imitate the look of the films.
- When unsure about a geographic or lore detail, say so and check rather than guess.

## Saving

- `localStorage`, one key, versioned JSON (`version` field plus a migration step
  for old saves). Autosave on a timer and on `visibilitychange`/`pagehide`.
- A missing or corrupt save must never break the game: fall back to a new game.
- Any change to the save shape needs a version bump and a migration.

## Running

```
cd rangers-of-ithilien
python3 -m http.server 8000     # open http://localhost:8000
```

## Verifying a change

1. Serve the folder and load it in headless Chromium (Playwright is pre-installed
   in the cloud environment; launch with no options).
2. Confirm there are no console errors or failed requests.
3. Take a screenshot and look at it. For world changes, take one at Henneth Annûn
   and one at a location the change affects.
4. For anything touching controls or UI, repeat with a phone-sized touch viewport.
5. Run the tests in `tests/` *(planned)*.

Report what was checked and what was not.

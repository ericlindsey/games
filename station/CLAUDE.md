# Ring Station

A first-person simulator of a spinning ring station in a low orbit round the
Moon, for choosing the station's dimensions by standing inside it. Sliders set
the ring's diameter, axial width, floor gravity and deck height, the window
glazing, the spin axis's orientation, the position in orbit and the Moon's
angular size; the view, the sunlight through the windows and the numbers
(rpm, rim speed, Coriolis, gradient, orbit) follow.

**Read `PLAN.md` first** for what exists, what is rough, and the open questions.

## The physics it keeps true

- **Spin** is set by floor gravity and radius: ω = √(g/R). Nothing else changes it.
- **Orbit**: the Moon's angular diameter α fixes the orbital radius
  d = R_moon / sin(α/2) (90° gives about 720 km up, a 3 h 02 min orbit).
- **Sun–Moon–Earth geometry**: the orbit lies in the plane perpendicular to the
  Sun, and the Earth lies along that plane too, so from anywhere in the orbit the
  Moon is seen exactly half lit, the Earth is half lit, and the station is never
  eclipsed. The orbit slider moves the station round that circle (and so moves
  the Earth relative to the Moon in the sky; near 270° the Earth is behind the Moon).
- **Attitude** is fixed in inertial space (a spinning station is a gyroscope).
  "Tilt" is the angle between the spin axis and the Sun; "roll" swings the axis
  round the Sun line. As the station orbits, the Moon moves across its sky.
- **Time rate** scales spin and orbit together, so they stay consistent. At high
  rates the spin strobes; pause (0) to study a moment.
- The camera is in the rotating frame. Walking is kinematic: there is no
  simulated Coriolis push on the walker (the readout reports its size instead).

## Rendering

- Two scenes. The station (metres, its own frame: spin axis +Z, floor is the
  cylinder r = R, ceiling r = R − deck, walls z = ±width/2) is drawn first and
  marks the stencil. The sky (kilometres, inertial frame rotated into the station
  frame) is drawn after, only where the stencil is clear: windows and open space.
- **Quality** (a slider; phones start at Medium): High and Medium draw both
  scenes into a half-float HDR target (High multisampled), then `post.js` adds
  bloom and tone-maps to the screen. Low draws straight to the screen, and
  materials tone-map themselves. Quality also sets the pixel-ratio cap, the
  Moon's finest crater octaves, moonlight visibility, the lamp pools and the
  foliage mesh detail (`QUALITY` define in the shaders).
- **Sunlight is ray-traced analytically in the station's fragment shader**
  (`src/stationShader.js`, `occl()`): each point tests a ray toward the Sun
  against the floor shell, ceiling (with its window grid), side walls (with
  theirs), hub, spokes, the ribs, and the nearest tree crowns (ellipsoids read
  from a float data texture, two texels per tree). No shadow maps, so window
  light is exact at any ring size. The same `ceilGlass()` / `sideGlass()`
  functions cut the window holes (by `discard`), so what you see through and
  what light comes through always agree. If you add structure that should cast
  shadows, add it to `occl()`; if you change the window pattern, change only
  those functions and `computeLayout()`. Small things (benches, lamps, shrubs,
  trunks) cast no ray-traced shadow; they get analytic ambient occlusion on the
  floor instead.
- **Textures** are generated at load by `src/textures.js` (about a second):
  512² tileable albedo+roughness and normal maps for grass, pavers, deck plate,
  wall and ceiling panels, hull, bark, wood, leaves and soil. Shells are sampled
  by arc length (`arcM`, which rounds to a whole number of tiles round the ring,
  so there is no seam) with explicit gradients (`textureGrad`); everything else
  is triplanar. Each station material binds up to four texture pairs (A–D);
  what each kind binds is listed at the top of `src/station.js`.
- Lighting: GGX specular and Lambert diffuse from the sun; wrapped moonlight;
  cabin light from above (a slider), light strips, lamp pools along the path,
  and a rough bounce term from sun on nearby glass; analytic AO in corners,
  under canopies, benches and lamps.
- The Moon and Earth are procedural (noise, cellular craters with analytic
  slopes). No map or image of the real Moon or Earth is used. Moon craters:
  bowls when small; flat floors, terraced walls and central peaks when large;
  each casts its own shadow near the terminator (`craterShadow`); eight young
  craters throw rays; octaves too small to see at the current zoom fade out.
  The Moon uses a Lommel-Seeliger/Lambert mix so it looks flat-lit like the real one.
- Brightness is physical in ratio: sunlight 3.0 (shader units), moonlight from
  albedo × the Moon's projected solid angle × the half-phase factor.
  ACES tone mapping and an exposure slider.

## Code layout

```
index.html          canvas, import map (every module versioned ?v=), HUD and panel markup
css/style.css
vendor/             three.module.min.js 0.170.0 (see vendor/VERSION)
src/
  main.js           boot, wiring, frame loop, window.station console handle
  params.js         slider definitions, ranges, defaults, URL-hash save/load (pure)
  physics.js        spin, orbit, moonlight, readout numbers (pure)
  layout.js         computeLayout(): windows, ribs, spokes, lamps, trees (pure, seeded)
  station.js        meshes and materials: shells, ribs, hub, lamps, benches, trees, shrubs
  stationShader.js  station GLSL: window patterns, occl(), texturing, lighting, AO
  textures.js       procedural tileable textures (albedo+roughness, normal maps)
  post.js           HDR target, bloom, tone mapping to screen
  sky.js            Moon, Earth, Sun, stars (own scene and camera)
  controls.js       thumb joystick, drag-to-look, WASD
  ui.js             settings panel built from PARAMS, readout text
tests/unit.test.mjs node --test tests/unit.test.mjs
tools/shoot.mjs     screenshots of named views + console/shader error check
```

When adding a module, add it to the import map in `index.html` and bump `v`
on every module there when releasing, so a cached old file never mixes in.

## Conventions

- Static and build-free; Three.js is the only dependency. Ask before adding one.
- Parameters live in `PARAMS` only; the panel, the URL hash and the defaults all
  come from it. A parameter that changes geometry has `rebuild: true`; one that
  changes only layout uniforms (the glass sliders: window sizes) has
  `relayout: true`, which recomputes the layout without rebuilding meshes.
  Any other parameter is read every frame.
- Defaults are a 1 rpm, 1 g station (1,790 m across, 100 m wide, 20 m deck):
  the comfortable end of the spin range, with room for two rows of trees a side. Keep the unit test that checks this if you change them.
- Mobile is first class: every control must work by touch (left thumb walks,
  right thumb looks, panel slides in from the right). Keep geometry budgets:
  at most ~600 trees and ~1200 shrubs however big the ring (`layout.js`,
  `station.js`); bigger rings space them out.
- Walking: right = forward × up, with up = −r̂ (toward the axis). In tangent
  (t̂) and axial (ẑ) parts that is right = cos(yaw)·ẑ − sin(yaw)·t̂.

## How to verify a change

1. `node --test tests/unit.test.mjs` (physics and parameter round-trips).
2. `node tools/shoot.mjs --out <dir>` and look at every picture. It fails on any
   console error or shader compile error. Views: default (sun streaming in),
   moon, earth (zoomed), outside, big-ring, small-ring. In this container's
   software WebGL a Moon-filled frame takes tens of seconds, so the whole run
   takes several minutes; that is the CPU renderer, not the game.
3. For input or layout changes, also check a phone viewport (Playwright
   `devices['iPhone 13']`) with the panel open and closed.

Console handle (`window.station`): `set(key, value)`, `aim('moon'|'earth'|'sun')`,
`spin` (get/set), `spinForHighest(target)`, `setMode('inside'|'outside')`,
`params`, `player`, `layout`, `frameMs`.

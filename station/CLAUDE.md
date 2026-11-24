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

- Two passes. The station (metres, its own frame: spin axis +Z, floor is the
  cylinder r = R, ceiling r = R − deck, walls z = ±width/2) is drawn first and
  marks the stencil. The sky (kilometres, inertial frame rotated into the station
  frame) is drawn after, only where the stencil is clear: windows and open space.
- **Sunlight is ray-traced analytically in the station's fragment shader**
  (`src/stationShader.js`, `occl()`): each point tests a ray toward the Sun
  against the floor shell, ceiling (with its window grid), side walls (with
  theirs), hub, spokes and the nearest tree crowns. No shadow maps, so window
  light is exact at any ring size. The same `ceilGlass()` / `sideGlass()`
  functions cut the window holes (by `discard`), so what you see through and
  what light comes through always agree. If you add structure that should cast
  shadows, add it to `occl()`; if you change the window pattern, change only
  those functions and `computeLayout()`.
- The Moon and Earth are procedural (noise, cellular craters with analytic
  slopes). No map or image of the real Moon or Earth is used. The Moon uses a
  Lommel-Seeliger/Lambert mix so it looks flat-lit the way the real one does.
- Brightness is physical in ratio: sunlight 3.0 (shader units), moonlight from
  albedo × the Moon's projected solid angle × the half-phase factor, cabin light
  a slider, plus a rough bounce term from sun coming through nearby glass.
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
  station.js        computeLayout() (windows, spokes, trees; pure) and mesh building
  stationShader.js  station GLSL: window patterns, occl(), surface patterns, lighting
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
  come from it. A parameter that changes geometry has `rebuild: true`.
- Mobile is first class: every control must work by touch (left thumb walks,
  right thumb looks, panel slides in from the right).

## How to verify a change

1. `node --test tests/unit.test.mjs` (physics and parameter round-trips).
2. `node tools/shoot.mjs --out <dir>` and look at every picture. It fails on any
   console error or shader compile error. Views: default (sun streaming in),
   moon, earth (zoomed), outside, big-ring, small-ring.
3. For input or layout changes, also check a phone viewport (Playwright
   `devices['iPhone 13']`) with the panel open and closed.

Console handle (`window.station`): `set(key, value)`, `aim('moon'|'earth'|'sun')`,
`spin` (get/set), `spinForHighest(target)`, `setMode('inside'|'outside')`,
`params`, `player`, `layout`.

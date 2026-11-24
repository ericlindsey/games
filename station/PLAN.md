# Ring Station: plan

## Goal

Help decide a ring station's dimensions by standing inside it: what the
curvature, the spin, the windows and the light feel like at a given size and
gravity, in orbit low over the Moon (default: the Moon 90° across, half lit,
with the Earth half lit too).

## v0.1 (this version)

- Sliders: diameter (20 m – 4 km, log), width along the axis, floor gravity
  (0.05 – 1.5 g), deck height; ceiling and side-wall glass share; spin-axis tilt
  from the Sun and roll about the Sun line; position in orbit; Moon angular size;
  time rate (pause to 1000×), cabin lights, exposure, field of view.
- Design saved in the URL hash; "Copy link" shares it.
- Inside view at eye height (1.7 m), walking on the curved floor; outside view
  orbiting the station in its non-spinning frame, with a marker where you stand.
- Windows: a skylight running all the way round the middle of the ceiling (its
  width set by the glass slider) and a band of windows along both side walls.
- Exact, analytic sunlight and moonlight through the windows, including shadows
  of glazing bars, spokes, hub and tree crowns. The far side of the ring, the
  hub and the spokes are visible overhead through the skylight.
- Procedural Moon (seas biased to the Earth-facing side, five crater scales),
  procedural Earth, the Sun with glare, a random star field.
- Readouts: rpm and period with a rule-of-thumb comfort band, rim speed,
  eye-level gravity and the head-to-foot gradient, Coriolis while walking,
  floor area, orbit altitude/period/speed, where the Sun and Moon stand
  relative to your floor right now.
- "Look at Moon / Earth / Sun" buttons (point once; the ring keeps turning).

## Known rough edges

- Tree trunks, the "you are here" marker and the walker cast no shadows.
- No light bounces except a single rough term from sunlight through nearby glass.
- The Moon is a broad light source but its light uses a single direction
  (the Moon's centre) for visibility, so moonlit patches have sharp edges.
- Inside, the spokes meet the ceiling as plain solid ceiling (no lift shaft).
- At time rates above ~10× the spin strobes (it is drawn at the frame rate).
- The Moon's craters are all fresh-looking round bowls; no rays, no terraces.
- On very small rings (under ~30 m) the hub and the ceiling crowd each other.

## Open questions / ideas

- A torus (round cross-section) as an alternative to the flat-floored band?
- Mirrors and external sunshades, as on classic designs, to aim sunlight in?
- A Coriolis "feel" option: deflect dropped objects or the walker's path.
- Solar arrays and radiators on the hub, docking at the axis.
- Moon-surface self-shadowing at the terminator (crater shadows).
- Day/night cycle presets (orbit position that eclipses Earth, etc.).

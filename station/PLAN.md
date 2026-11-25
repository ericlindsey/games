# Ring Station: plan

## Goal

Help decide a ring station's dimensions by standing inside it: what the
curvature, the spin, the windows and the light feel like at a given size and
gravity, in orbit low over the Moon (default: the Moon 90° across, half lit,
with the Earth half lit too).

## v0.3 (this version)

- The Moon is real: NASA's CGI Moon Kit colour (LROC) and elevation (LOLA),
  3.4 MB in all (4k colour only at High quality). Shadows are marched over the
  real terrain, so the terminator shows real craters and ranges; procedural
  craters fill in below the data's resolution when zoomed in.
- The orbit is polar (the orbit plane contains the Moon's axis): the default
  position, 330°, is over the north and far side; 90° is between Moon and
  Earth, over the near side.

## v0.2.1

- Default station spins at 1 rpm for 1 g: 1,790 m across, a 5.6 km ring,
  100 m wide with a 20 m deck (56 ha of floor, two rows of trees a side).
- The glass sliders take effect as you drag them (they used to wait for the
  next rebuild).

## v0.2

- Walking fixed (strafe was mirrored) and much faster: a walking-speed slider
  (1–200 m/s, default 10), Shift for 4×.
- Render quality slider (Low / Medium / High). Medium and High render in HDR
  with bloom; High adds MSAA, lamp light pools and finer foliage.
- Procedural textures with normal maps on every surface: pavers, lawn,
  deck plate, wall and ceiling panels, hull plating, bark, wood, leaves, soil.
- Station detail: steel ribs at every ceiling frame (they cast shadows), lamp
  posts with pools of light, benches, flower beds, a hedge of mixed shrubs.
- Trees in six species, each its own green (oak, poplar, pine, willow, lime, maple), varied in size
  and placed off-grid, crowns built from leafy clumps; up to three rows a side
  on wide decks. Their crowns cast ray-traced shadows.
- The Moon: rolling terrain, wrinkle ridges in the seas, up to seven crater
  octaves faded by zoom, flat floors, terraces and central peaks on big craters,
  crater shadows near the terminator, eight rayed young craters. Sun glint on
  the Earth's oceans.
- "← All games" link in the settings panel.

## v0.1

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

- Trunks, benches, lamps, shrubs and the walker cast no ray-traced shadows
  (benches, lamps and trunks darken the floor with ambient occlusion only).
- No light bounces except a single rough term from sunlight through nearby glass.
- The Moon is a broad light source but its light uses a single direction
  (the Moon's centre) for visibility, so moonlit patches have sharp edges.
- Inside, the spokes meet the ceiling as plain solid ceiling (no lift shaft).
- At time rates above ~10× the spin strobes (it is drawn at the frame rate).
- The Moon's limb is a smooth sphere: mountains don't break its outline.
- Elevation is 5.3 km per texel: small craters' shadows come from procedural
  detail, not data.
- Leaves are solid clumps, not alpha-tested leaf cards, so crown edges are smooth.
- On very small rings (under ~30 m) the hub and the ceiling crowd each other.

## Open questions / ideas

- A torus (round cross-section) as an alternative to the flat-floored band?
- Mirrors and external sunshades, as on classic designs, to aim sunlight in?
- A Coriolis "feel" option: deflect dropped objects or the walker's path.
- Solar arrays and radiators on the hub, docking at the axis.
- Displace the Moon's limb by the elevation map.
- Day/night cycle presets (orbit position that eclipses Earth, etc.).

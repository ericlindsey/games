// Where things are. Pure data and functions; the single source of truth for
// every position in the world. +X east, +Z south. The world is 1.5 km by 3 km.

import { smoothstep } from '../util/noise.js';

// Where Henneth Annûn stands: the cliff face behind the fall. Everything about
// it is laid out from here. Both lie on the terrain mesh's 4 m grid (the hole
// for the hidden stair and the slot for the cliff are cut on it), so keep
// HA_X a multiple of 4 and HA_Z two more than one.
const HA_X = 752, HA_Z = 894;

/**
 * Henneth Annûn. The stream crosses a shelf of rock, drops into a pool walled
 * in by cliffs, and leaves westward through a deep narrow cut. The cave lies
 * behind the fall. `x` is the cliff face behind the fall.
 */
export const HA = {
  x: HA_X, z: HA_Z,
  plateau: 56,      // level of the rock shelf
  floor: 31,        // floor of the basin and the head of the cut
  caveFloor: 40,
  basin: { minX: HA_X - 32, halfZ: 14, wall: 4 }, // floor: x in [minX, x], |z - HA.z| < halfZ (the south wall comes to the stair: southWallEdge in terrain.js)
  // The stair: a ramp of worn steps along the foot of the south wall, from the
  // floor beside the pool (x0) up to a landing (x1) at the cave door. z0..z1 is
  // across it, from HA.z; the wall rises from its outer edge, z1.
  stair: { x0: HA_X - 29, x1: HA_X - 2, z0: 11.3, z1: 14.2 },
  // The cut: a narrow slot, gently winding, that fades into an open valley at
  // `endX` (fully gone by endX - 40). The stream keeps to its north side.
  gorge: { endX: HA_X - 240, halfFloor: 3.6, halfTop: 6.5, fall: 0.022, channelOffset: -1.4, wind: 3.2 },
  // An oval, reaching east right under the cliff, so the fall drops into deep water.
  pool: { x: HA_X - 12.5, z: HA_Z - 2, rx: 14, rz: 12 },
  rock: { minX: HA_X, maxX: HA_X + 36, minZ: HA_Z - 22, maxZ: HA_Z + 22 }, // the mass that holds the cave
  // The hidden way up: a narrow stair in the rock from the cave's hall, coming
  // out through a hole in the forest floor above the cave. The hole is cut on
  // the terrain mesh's 4 m grid; `exitX` is where the stair meets the ground.
  hatch: { x0: HA_X + 24, x1: HA_X + 32, z0: HA_Z + 10, z1: HA_Z + 14, exitX: HA_X + 32 },
  spawn: { x: HA_X + 22, z: HA_Z + 2, heading: -Math.PI / 2 },
};

/** Height of the stair's treads at x: the basin floor below its foot, the cave floor on the landing. */
export function stairTop(x) {
  const s = HA.stair;
  return HA.floor + (HA.caveFloor - HA.floor) * Math.min(1, Math.max(0, (x - s.x0) / (s.x1 - s.x0)));
}

/** How far out across the pool at Henneth Annûn a point lies: 0 at its middle, 1 at its edge. */
export function poolQ(x, z) {
  return Math.hypot((x - HA.pool.x) / HA.pool.rx, (z - HA.pool.z) / HA.pool.rz);
}

/** Z of the middle of the cut below the pool at a given x: it winds a little. */
export function gorgeZ(x) {
  const run = HA.basin.minX - x; // metres down the cut
  if (run <= 0) return HA.z;
  const ease = run < 30 ? run / 30 : 1;
  return HA.z + HA.gorge.wind * ease * (Math.sin(run / 26) + 0.45 * Math.sin(run / 11 + 1.3));
}

/** X of the Anduin's east bank at a given z. */
export function bankX(z) {
  return 98 + 22 * Math.sin(z / 375) + 14 * Math.sin(z / 146 + 1.3);
}
export const ANDUIN_WIDTH = 300;

/** The Harad Road runs north-south under the mountains. */
export function haradRoadX(z) {
  return 1148 + 21 * Math.sin(z / 330);
}
/** The Osgiliath - Minas Ithil road runs east-west near the southern edge. */
export function southRoadZ(x) {
  return 2906 + 11 * Math.sin(x / 232);
}
export const ROAD_HALF_WIDTH = 4;

/**
 * The Ephel Dúath. Their foot wanders about `footX`; from `cragFrom` to
 * `cragFull` (well past where anyone may walk, and anything is placed) they
 * break into sharp crests and gullies (terrain.js), drawn finer than the rest of
 * the far land and with the crag texture (terrainMesh.js, surface.js).
 */
export const EPHEL = { footX: 1268, cragFrom: 1400, cragFull: 1500, valeHead: 1700 };

/**
 * (since v0.8.5) 0..1: how deep in the Morgul Vale a point lies, between its walls
 * and toward its head. Past where anyone walks the vale narrows between cliffs and
 * ends under the mountains at `EPHEL.valeHead` (terrain.js); its rock is dark
 * (groundColor.js) and nothing grows on its floor (`valeBarren`).
 */
export function valeDepth(x, z) {
  return (1 - smoothstep(60, 200, Math.abs(z - southRoadZ(x)))) * smoothstep(EPHEL.footX - 40, EPHEL.valeHead - 100, x);
}
export const valeBarren = (x, z) => x > EPHEL.cragFrom - 10 && valeDepth(x, z) > 0.2;

/** Distance from a point to the nearest road centre line. */
export function roadDistance(x, z) {
  const dH = Math.abs(x - haradRoadX(z));
  const dS = x > bankX(z) - 30 ? Math.abs(z - southRoadZ(x)) : Infinity;
  return Math.min(dH, dS);
}

/**
 * (since v0.8.5) Far off over the Anduin, never reached: the eastern end of the
 * White Mountains, with Mindolluin at its head and the white city on its knee
 * (world/whiteMountains.js). They are not to the land's scale, which would set
 * the city almost on the far bank, but placed to stand where they should against
 * the sky: south-west from Henneth Annûn, more to the west from the south of the
 * land, with the range running away westward under the low sun.
 * `ridge`: the crest from east to west, [x, z, height]. `city`: its middle, the
 * radius of its outer wall, the height of its foot, of its topmost circle, and of
 * the tower's top; it faces east (`face`, a unit x, z).
 */
export const WHITE_MOUNTAINS = {
  ridge: [
    [-2250, 4120, 150], [-2600, 4230, 230], [-2850, 4270, 420], [-3100, 4330, 600], [-3400, 4400, 470], [-3700, 4420, 520], [-4350, 4360, 480],
    [-5150, 4520, 400], [-6050, 4440, 500], [-7050, 4620, 430], [-8150, 4500, 520], [-9350, 4690, 440],
    [-10600, 4600, 470],
  ],
  city: { x: -2560, z: 3960, r: 72, foot: 40, top: 132, tower: 178, face: [0.9, -0.44] },
};

export const CAIR_ANDROS = { x: bankX(705) - ANDUIN_WIDTH / 2, z: 705, rx: 45, rz: 170 };

const crossZ = 2896;
export const CROSSROADS = { x: haradRoadX(crossZ), z: southRoadZ(haradRoadX(crossZ)) };

/**
 * Named places. `r` is the discovery radius, `flat` flattens the ground,
 * `clear` keeps trees away. `kind` selects what gets built there.
 */
export const LANDMARKS = [
  { id: 'henneth', name: 'Henneth Annûn', x: HA.x - 14, z: HA.z, r: 60,
    blurb: 'The Window of the Sunset. Home.' },
  { id: 'cormallen', name: 'The Field of Cormallen', x: bankX(HA_Z) + 140, z: HA_Z + 4, r: 120,
    blurb: 'Green lawns by the river, where the host made merry.' },
  { id: 'cairandros', name: 'Cair Andros', x: bankX(705) + 30, z: 705, r: 110,
    blurb: 'The ship-island in the Great River, seen from the eastern shore.' },
  { id: 'fens', name: 'The Northern Fens', x: 210, z: 280, r: 140,
    blurb: 'Reeds and standing water where the land sinks toward the river.' },
  { id: 'haradroad', name: 'The Harad Road', x: haradRoadX(HA_Z + 30), z: HA_Z + 30, r: 80,
    blurb: 'The old straight road, running south under the mountains.' },
  { id: 'crossroads', name: 'The Cross-roads', kind: 'crossroads', x: CROSSROADS.x, z: CROSSROADS.z,
    r: 90, flat: 45, clear: 30, blurb: 'Four ways meet in a ring of ancient trees.' },
  { id: 'osgiliath', name: 'Osgiliath, the eastern shore', kind: 'osgiliath', x: bankX(2906) + 85, z: 2902,
    r: 130, flat: 80, clear: 90, blurb: 'The broken city on the river.' },
  { id: 'morgul', name: 'The Morgul Vale', kind: 'morgul', x: 1309, z: southRoadZ(1309), r: 90, clear: 40,
    blurb: 'The road runs on into shadow. It is barred.' },

  { id: 'arch', name: 'The Mossy Arch', kind: 'arch', x: 645, z: 998, r: 45, flat: 14, clear: 12,
    blurb: 'A lone arch, older than the rangers’ memory.' },
  { id: 'watch', name: 'The Broken Watch', kind: 'tower', x: 919, z: 581, r: 55, flat: 18, clear: 16,
    blurb: 'The stump of a watch-tower that once looked east.' },
  { id: 'colonnade', name: 'The Fallen Colonnade', kind: 'colonnade', x: 520, z: 1520, r: 60, flat: 26, clear: 22,
    blurb: 'A walk of pillars, most of them long since laid down.' },
  // (terrain.js moves the bridge onto the nearest stream once the streams are traced)
  { id: 'pier', name: 'The Old Bridge', kind: 'bridge', x: 705, z: 1500, r: 60, clear: 20,
    blurb: 'Stone piers stand in the stream. The span is gone.' },
  { id: 'shrine', name: 'The Roofless Shrine', kind: 'shrine', x: 338, z: 1868, r: 55, flat: 20, clear: 16,
    blurb: 'Open to the sky, and the better for it.' },
  { id: 'stair', name: 'The Stair to Nowhere', kind: 'stair', x: 1005, z: 1819, r: 55, flat: 18, clear: 14,
    blurb: 'Steps climb to a landing with nothing beyond it but the view.' },
  { id: 'fountain', name: 'The Dry Fountain', kind: 'fountain', x: 604, z: 2479, r: 55, flat: 22, clear: 18,
    blurb: 'A court of pale stone around a basin full of leaves.' },
];

/** True where trees and undergrowth must keep clear of something built. */
export function inClearing(x, z) {
  // the basin and the cut at Henneth Annûn (the woods crowd right up to the rim)
  const dz = Math.abs(z - HA.z);
  if (dz < 25 && x > HA.basin.minX - 6 && x < HA.x + 3) return true;
  const ht = HA.hatch; // and round the hole where the hidden stair comes out
  if (x > ht.x0 - 2 && x < ht.x1 + 3 && z > ht.z0 - 2 && z < ht.z1 + 2) return true;
  if (x > HA.gorge.endX - 40 && x < HA.basin.minX && Math.abs(z - gorgeZ(x)) < HA.gorge.halfTop + 1.5) return true;
  for (const l of LANDMARKS) {
    if (l.clear && Math.abs(x - l.x) < l.clear && Math.abs(z - l.z) < l.clear &&
        Math.hypot(x - l.x, z - l.z) < l.clear) return true;
  }
  return false;
}

// Where things are. Pure data and functions; the single source of truth for
// every position in the world. +X east, +Z south. The world is 2 km by 4 km.

import { smoothstep } from '../util/noise.js';

/**
 * Henneth Annûn. The stream crosses a shelf of rock, drops into a pool walled
 * in by cliffs, and leaves westward through a deep narrow cut. The cave lies
 * behind the fall. `x` is the cliff face behind the fall.
 */
export const HA = {
  x: 1000, z: 1190,
  plateau: 56,      // level of the rock shelf
  floor: 31,        // floor of the basin and the head of the cut
  caveFloor: 40,
  basin: { minX: 968, halfZ: 14, wall: 4, southSetBack: 2 }, // the south wall stands back to make room for the stair            // floor: x in [minX, x], |z - HA.z| < halfZ
  // The cut: a narrow slot, gently winding, that fades into an open valley at
  // `endX` (fully gone by endX - 40). The stream keeps to its north side.
  gorge: { endX: 760, halfFloor: 3.6, halfTop: 6.5, fall: 0.022, channelOffset: -1.4, wind: 3.2 },
  pool: { x: 985, z: 1187, r: 12 },
  rock: { minX: 1000, maxX: 1036, minZ: 1168, maxZ: 1212 }, // the mass that holds the cave
  spawn: { x: 1022, z: 1192, heading: -Math.PI / 2 },
};

/** Z of the middle of the cut below the pool at a given x: it winds a little. */
export function gorgeZ(x) {
  const run = HA.basin.minX - x; // metres down the cut
  if (run <= 0) return HA.z;
  const ease = run < 30 ? run / 30 : 1;
  return HA.z + HA.gorge.wind * ease * (Math.sin(run / 26) + 0.45 * Math.sin(run / 11 + 1.3));
}

/** X of the Anduin's east bank at a given z. */
export function bankX(z) {
  return 130 + 30 * Math.sin(z / 500) + 18 * Math.sin(z / 195 + 1.3);
}
export const ANDUIN_WIDTH = 300;

/** The Harad Road runs north-south under the mountains. */
export function haradRoadX(z) {
  return 1530 + 28 * Math.sin(z / 440);
}
/** The Osgiliath - Minas Ithil road runs east-west near the southern edge. */
export function southRoadZ(x) {
  return 3875 + 15 * Math.sin(x / 310);
}
export const ROAD_HALF_WIDTH = 4;

/** Distance from a point to the nearest road centre line. */
export function roadDistance(x, z) {
  const dH = Math.abs(x - haradRoadX(z));
  const dS = x > bankX(z) - 30 ? Math.abs(z - southRoadZ(x)) : Infinity;
  return Math.min(dH, dS);
}

export const CAIR_ANDROS = { x: bankX(940) - ANDUIN_WIDTH / 2, z: 940, rx: 45, rz: 220 };

const crossZ = 3862;
export const CROSSROADS = { x: haradRoadX(crossZ), z: southRoadZ(haradRoadX(crossZ)) };

/**
 * Named places. `r` is the discovery radius, `flat` flattens the ground,
 * `clear` keeps trees away. `kind` selects what gets built there.
 */
export const LANDMARKS = [
  { id: 'henneth', name: 'Henneth Annûn', x: HA.x - 14, z: HA.z, r: 60,
    blurb: 'The Window of the Sunset. Home.' },
  { id: 'cormallen', name: 'The Field of Cormallen', x: bankX(1190) + 170, z: 1195, r: 130,
    blurb: 'Green lawns by the river, where the host made merry.' },
  { id: 'cairandros', name: 'Cair Andros', x: bankX(940) + 30, z: 940, r: 120,
    blurb: 'The ship-island in the Great River, seen from the eastern shore.' },
  { id: 'fens', name: 'The Northern Fens', x: 270, z: 350, r: 170,
    blurb: 'Reeds and standing water where the land sinks toward the river.' },
  { id: 'haradroad', name: 'The Harad Road', x: haradRoadX(1230), z: 1230, r: 80,
    blurb: 'The old straight road, running south under the mountains.' },
  { id: 'crossroads', name: 'The Cross-roads', kind: 'crossroads', x: CROSSROADS.x, z: CROSSROADS.z,
    r: 90, flat: 45, clear: 30, blurb: 'Four ways meet in a ring of ancient trees.' },
  { id: 'osgiliath', name: 'Osgiliath, the eastern shore', kind: 'osgiliath', x: bankX(3875) + 85, z: 3870,
    r: 130, flat: 80, clear: 90, blurb: 'The broken city on the river.' },
  { id: 'morgul', name: 'The Morgul Vale', kind: 'morgul', x: 1745, z: southRoadZ(1745), r: 90, clear: 40,
    blurb: 'The road runs on into shadow. It is barred.' },

  { id: 'arch', name: 'The Mossy Arch', kind: 'arch', x: 860, z: 1330, r: 45, flat: 14, clear: 12,
    blurb: 'A lone arch, older than the rangers’ memory.' },
  { id: 'watch', name: 'The Broken Watch', kind: 'tower', x: 1225, z: 775, r: 55, flat: 18, clear: 16,
    blurb: 'The stump of a watch-tower that once looked east.' },
  { id: 'colonnade', name: 'The Fallen Colonnade', kind: 'colonnade', x: 650, z: 1700, r: 60, flat: 26, clear: 22,
    blurb: 'A walk of pillars, most of them long since laid down.' },
  // (terrain.js moves the bridge onto the nearest stream once the streams are traced)
  { id: 'pier', name: 'The Old Bridge', kind: 'bridge', x: 940, z: 2000, r: 60, clear: 20,
    blurb: 'Stone piers stand in the stream. The span is gone.' },
  { id: 'shrine', name: 'The Roofless Shrine', kind: 'shrine', x: 450, z: 2490, r: 55, flat: 20, clear: 16,
    blurb: 'Open to the sky, and the better for it.' },
  { id: 'stair', name: 'The Stair to Nowhere', kind: 'stair', x: 1340, z: 2425, r: 55, flat: 18, clear: 14,
    blurb: 'Steps climb to a landing with nothing beyond it but the view.' },
  { id: 'fountain', name: 'The Dry Fountain', kind: 'fountain', x: 805, z: 3305, r: 55, flat: 22, clear: 18,
    blurb: 'A court of pale stone around a basin full of leaves.' },
];

/** True where trees and undergrowth must keep clear of something built. */
export function inClearing(x, z) {
  // the basin and the cut at Henneth Annûn (the woods crowd right up to the rim)
  const dz = Math.abs(z - HA.z);
  if (dz < 25 && x > HA.basin.minX - 6 && x < HA.x + 3) return true;
  if (x > HA.gorge.endX - 40 && x < HA.basin.minX && Math.abs(z - gorgeZ(x)) < HA.gorge.halfTop + 1.5) return true;
  for (const l of LANDMARKS) {
    if (l.clear && Math.abs(x - l.x) < l.clear && Math.abs(z - l.z) < l.clear &&
        Math.hypot(x - l.x, z - l.z) < l.clear) return true;
  }
  return false;
}

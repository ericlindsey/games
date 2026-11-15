// Where things are. Pure data and functions; the single source of truth for
// every position in the world. +X east, +Z south.

import { smoothstep } from '../util/noise.js';

/** Henneth Annûn: the fall faces west, the stream runs west to the Anduin. */
export const HA = {
  x: 1600, z: 1900,
  // The rock mass that holds the cave (see world/hennethAnnun.js).
  outcrop: { minX: 1570, maxX: 1612, minZ: 1878, maxZ: 1922 },
  pool: { x: 1548, z: 1900, r: 18 },
  cliffHeight: 18,
  lowLevel: 46,
  spawn: { x: 1595, z: 1902, heading: -Math.PI / 2 },
};

/** X of the Anduin's east bank at a given z. */
export function bankX(z) {
  return 210 + 50 * Math.sin(z / 800) + 30 * Math.sin(z / 310 + 1.3);
}
export const ANDUIN_WIDTH = 380;

/** The Harad Road runs north-south under the mountains. */
export function haradRoadX(z) {
  return 2450 + 45 * Math.sin(z / 700);
}
/** The Osgiliath - Minas Ithil road runs east-west near the southern edge. */
export function southRoadZ(x) {
  return 6200 + 25 * Math.sin(x / 500);
}
export const ROAD_HALF_WIDTH = 4;

/** Distance from a point to the nearest road centre line. */
export function roadDistance(x, z) {
  const dH = Math.abs(x - haradRoadX(z));
  const dS = x > bankX(z) - 30 ? Math.abs(z - southRoadZ(x)) : Infinity;
  return Math.min(dH, dS);
}

// Streams run from the mountains west to the Anduin.
const STREAMS = [
  { z0: 820, a: 55, b: 14, p1: 0.4, p2: 2.1 },
  { z0: HA.z, a: 45, b: 12, p1: 1.7, p2: 0.3, straightNear: HA.x },
  { z0: 3200, a: 60, b: 15, p1: 3.1, p2: 1.2 },
  { z0: 4400, a: 50, b: 12, p1: 5.2, p2: 4.0 },
  { z0: 5450, a: 40, b: 10, p1: 0.9, p2: 5.5 },
];
export const STREAM_COUNT = STREAMS.length;
export const STREAM_END_X = 2960;

/** Z of stream i's centre line at a given x. */
export function streamZ(i, x) {
  const s = STREAMS[i];
  let m = s.a * Math.sin(x / 260 + s.p1) + s.b * Math.sin(x / 97 + s.p2);
  if (s.straightNear !== undefined) m *= smoothstep(120, 420, Math.abs(x - s.straightNear));
  return s.z0 + m;
}

/** Distance to the nearest stream centre line (measured north-south). */
export function streamDistance(x, z) {
  let d = Infinity;
  for (let i = 0; i < STREAMS.length; i++) d = Math.min(d, Math.abs(z - streamZ(i, x)));
  return d;
}

export const CAIR_ANDROS = { x: bankX(1500) - ANDUIN_WIDTH / 2, z: 1500, rx: 60, rz: 320 };

const crossZ = 6176;
export const CROSSROADS = { x: haradRoadX(crossZ), z: southRoadZ(haradRoadX(crossZ)) };

/**
 * Named places. `r` is the discovery radius, `flat` flattens the ground,
 * `clear` keeps trees away. `kind` selects what gets built there.
 */
export const LANDMARKS = [
  { id: 'henneth', name: 'Henneth Annûn', x: HA.x - 14, z: HA.z, r: 90, clear: 0,
    blurb: 'The Window of the Sunset. Home.' },
  { id: 'cormallen', name: 'The Field of Cormallen', x: bankX(1900) + 270, z: 1905, r: 190,
    blurb: 'Green lawns by the river, where the host made merry.' },
  { id: 'cairandros', name: 'Cair Andros', x: bankX(1500) + 40, z: 1500, r: 170,
    blurb: 'The ship-island in the Great River, seen from the eastern shore.' },
  { id: 'fens', name: 'The Northern Fens', x: 430, z: 560, r: 260,
    blurb: 'Reeds and standing water where the land sinks toward the river.' },
  { id: 'haradroad', name: 'The Harad Road', x: haradRoadX(1960), z: 1960, r: 110,
    blurb: 'The old straight road, running south under the mountains.' },
  { id: 'crossroads', name: 'The Cross-roads', kind: 'crossroads', x: CROSSROADS.x, z: CROSSROADS.z,
    r: 90, flat: 45, clear: 30, blurb: 'Four ways meet in a ring of ancient trees.' },
  { id: 'osgiliath', name: 'Osgiliath, the eastern shore', kind: 'osgiliath', x: bankX(6200) + 110, z: 6195,
    r: 170, flat: 110, clear: 120, blurb: 'The broken city on the river.' },
  { id: 'morgul', name: 'The Morgul Vale', kind: 'morgul', x: 2800, z: southRoadZ(2800), r: 110, clear: 40,
    blurb: 'The road runs on into shadow. It is barred.' },

  { id: 'arch', name: 'The Mossy Arch', kind: 'arch', x: 1385, z: 2105, r: 45, flat: 14, clear: 16,
    blurb: 'A lone arch, older than the rangers’ memory.' },
  { id: 'watch', name: 'The Broken Watch', kind: 'tower', x: 1960, z: 1240, r: 55, flat: 18, clear: 22,
    blurb: 'The stump of a watch-tower that once looked east.' },
  { id: 'colonnade', name: 'The Fallen Colonnade', kind: 'colonnade', x: 1040, z: 2720, r: 60, flat: 26, clear: 30,
    blurb: 'A walk of pillars, most of them long since laid down.' },
  { id: 'pier', name: 'The Old Bridge', kind: 'bridge', x: 1500, z: streamZ(2, 1500), r: 60, clear: 26,
    blurb: 'Stone piers stand in the stream. The span is gone.' },
  { id: 'shrine', name: 'The Roofless Shrine', kind: 'shrine', x: 720, z: 3980, r: 55, flat: 20, clear: 24,
    blurb: 'Open to the sky, and the better for it.' },
  { id: 'stair', name: 'The Stair to Nowhere', kind: 'stair', x: 2140, z: 3880, r: 55, flat: 18, clear: 22,
    blurb: 'Steps climb to a landing with nothing beyond it but the view.' },
  { id: 'fountain', name: 'The Dry Fountain', kind: 'fountain', x: 1290, z: 5290, r: 55, flat: 22, clear: 26,
    blurb: 'A court of pale stone around a basin full of leaves.' },
];

/** Enemy camp sites (cold, for now). Hand-placed in the outer tiers. */
export const CAMPS = [
  { id: 'c1', x: 2260, z: 1560 }, { id: 'c2', x: 1120, z: 780 },
  { id: 'c3', x: 2050, z: 2780 }, { id: 'c4', x: 640, z: 3080 },
  { id: 'c5', x: 1700, z: 3620 }, { id: 'c6', x: 2330, z: 4380 },
  { id: 'c7', x: 980, z: 4640 }, { id: 'c8', x: 1880, z: 5080 },
  { id: 'c9', x: 2240, z: 5760 }, { id: 'c10', x: 760, z: 5700 },
  { id: 'c11', x: 2300, z: 520 }, { id: 'c12', x: 1420, z: 6020 },
];
export const CAMP_BLIGHT_RADIUS = 300;

/** True where trees and undergrowth must keep clear of something built. */
export function inClearing(x, z) {
  const o = HA.outcrop;
  if (x > o.minX - 26 && x < o.maxX + 8 && z > o.minZ - 8 && z < o.maxZ + 12) return true;
  if (Math.hypot(x - HA.pool.x, z - HA.pool.z) < HA.pool.r + 6) return true;
  for (const l of LANDMARKS) {
    if (l.clear && Math.abs(x - l.x) < l.clear && Math.abs(z - l.z) < l.clear &&
        Math.hypot(x - l.x, z - l.z) < l.clear) return true;
  }
  for (const c of CAMPS) {
    if (Math.abs(x - c.x) < 14 && Math.abs(z - c.z) < 14 && Math.hypot(x - c.x, z - c.z) < 14) return true;
  }
  return false;
}

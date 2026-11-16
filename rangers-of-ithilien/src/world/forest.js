// How thickly the woods grow. Pure.
// Ithilien is small woods with wide glades in the north, closing to deep
// forest in the south; old fields are only half reclaimed.

import { fbm, smoothstep } from '../util/noise.js';
import { WORLD } from '../config.js';
import { regionWeights } from './regions.js';
import { roadDistance } from './layout.js';
import { inField } from './oldworks.js';
import { pathDistance } from './paths.js';

const S = WORLD.seed;
const w = {};

/** 0..1: share of ground under the canopy of great trees. 1 is a closed roof. */
export function forestDensity(x, z) {
  regionWeights(x, z, w);
  const base = w.river * 0.4 + w.heath * 0.14 + w.central * 0.8 + w.south * 1.0;
  // Woods and glades: a sharp-edged pattern, with fewer glades in the deep south.
  const n = fbm(x / 150, z / 150, 3, S + 300);
  const wood = smoothstep(-0.22 - w.south * 0.25, 0.02 - w.south * 0.2, n);
  let d = base * (0.05 + 0.95 * wood);
  d *= (1 - w.lawn * 0.9) * (1 - w.fen * 0.8);
  if (inField(x, z)) d *= 0.3;
  if (roadDistance(x, z) < 7) d = 0;
  else if (pathDistance(x, z) < 3.5) d *= 0.25; // the old ways are still a little open
  return d;
}

/** 0..1: how thick the tall heather and gorse stand, east of the Harad Road. */
export function thicketDensity(x, z) {
  regionWeights(x, z, w);
  if (w.foothill < 0.05 || roadDistance(x, z) < 7 || pathDistance(x, z) < 2.6) return 0;
  // Winding ways between the bushes: gaps follow the zero line of a noise field.
  const lane = Math.abs(fbm(x / 34, z / 34, 2, S + 310));
  return w.foothill * smoothstep(0.035, 0.11, lane);
}

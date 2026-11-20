// Regions and danger as smooth functions of position.
// Pure: depends only on layout and noise.

import { noise2, smoothstep } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, bankX, LANDMARKS, southRoadZ, haradRoadX } from './layout.js';

const S = WORLD.seed;
const cormallen = LANDMARKS.find((l) => l.id === 'cormallen');

export function fenWeight(x, z) {
  const dx = x - bankX(z);
  if (dx < -10 || dx > 300 || z > 500) return 0;
  return (1 - smoothstep(120, 300, dx)) * (1 - smoothstep(240, 500, z));
}

export function lawnWeight(x, z) {
  const d = Math.hypot(x - cormallen.x, z - cormallen.z);
  return 1 - smoothstep(60, 150, d);
}

/**
 * Blend weights of the five regions (they sum to 1), plus fen and lawn overlays.
 * `foothill` is the country east of the Harad Road: tall heather and gorse.
 */
export function regionWeights(x, z, out = {}) {
  const dx = x - bankX(z);
  const n = noise2(x / 220, z / 220, S + 200) * 140;
  const rx = haradRoadX(z);
  const foothill = smoothstep(rx - 20, rx + 60, x + n * 0.12);
  const river = 1 - smoothstep(30, 160, dx);
  const north = 1 - smoothstep(285, 640, z + n);
  const south = smoothstep(1650, 2100, z + n);
  let rest = 1 - foothill;
  out.foothill = foothill;
  out.river = river * rest;
  rest *= 1 - river;
  out.heath = north * rest;
  out.south = south * rest;
  out.central = (1 - north - south) * rest;
  out.fen = fenWeight(x, z);
  out.lawn = lawnWeight(x, z);
  return out;
}

const NAMES = {
  river: 'The Anduin Shore',
  heath: 'The Northern Heath',
  central: 'The Home Woods',
  south: 'The Deep Woods',
  foothill: 'The Heather Slopes',
};
const tmp = {};
export function regionName(x, z) {
  const w = regionWeights(x, z, tmp);
  if (w.fen > 0.5) return 'The Northern Fens';
  if (w.lawn > 0.5) return 'The Field of Cormallen';
  let best = 'central';
  for (const k of ['river', 'heath', 'south', 'foothill']) if (w[k] > w[best]) best = k;
  return NAMES[best];
}

/** Within this distance of the falls nothing hostile comes. */
export const REFUGE = 180;

/**
 * 0 (refuge) to 4. Danger now runs north to south: the woods north of Henneth
 * Annûn are the hunting ground of a new ranger, and the companies grow as the
 * land runs down toward the Morgul road. The heather is a step worse than the
 * woods beside it.
 */
export function dangerTier(x, z) {
  if (Math.hypot(x - HA.x, z - HA.z) < REFUGE) return 0;
  let t = z < HA.z + 190 ? 1 : z < 1650 ? 2 : z < 2250 ? 3 : 4;
  if (x > haradRoadX(z) - 40) t++;
  return Math.min(4, t);
}

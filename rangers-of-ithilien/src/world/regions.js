// Regions, forest density, danger and blight as smooth functions of position.
// Pure: depends only on layout and noise.

import { noise2, fbm, smoothstep } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, bankX, roadDistance, LANDMARKS, CAMPS, CAMP_BLIGHT_RADIUS, southRoadZ } from './layout.js';

const S = WORLD.seed;
const cormallen = LANDMARKS.find((l) => l.id === 'cormallen');

export function fenWeight(x, z) {
  const dx = x - bankX(z);
  if (dx < -10 || dx > 620 || z > 1250) return 0;
  return (1 - smoothstep(250, 620, dx)) * (1 - smoothstep(650, 1250, z));
}

export function lawnWeight(x, z) {
  const d = Math.hypot(x - cormallen.x, z - cormallen.z);
  return 1 - smoothstep(110, 300, d);
}

/** Blend weights of the five regions (they sum to 1), plus fen and lawn overlays. */
export function regionWeights(x, z, out = {}) {
  const dx = x - bankX(z);
  const n = noise2(x / 350, z / 350, S + 200) * 220;
  const foothill = smoothstep(2380, 2700, x + n * 0.4);
  const river = 1 - smoothstep(50, 260, dx);
  const north = 1 - smoothstep(600, 1350, z + n);
  const south = smoothstep(3500, 4500, z + n);
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
  south: 'The Ilex Woods',
  foothill: 'Under the Mountains of Shadow',
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

/** 0..1: how thickly trees grow here (before slope, water and clearings). */
export function forestDensity(x, z) {
  const w = regionWeights(x, z, tmp);
  let d = w.river * 0.25 + w.heath * 0.12 + w.central * 0.6 + w.south * 0.8 + w.foothill * 0.2;
  const clump = smoothstep(-0.3, 0.2, fbm(x / 170, z / 170, 3, S + 300));
  d *= 0.15 + 0.85 * clump;
  d *= (1 - w.lawn * 0.92) * (1 - w.fen * 0.85);
  if (roadDistance(x, z) < 8) d = 0;
  return d;
}

/** 0 (refuge) to 4 (the shadowed edges). */
export function dangerTier(x, z) {
  const d = Math.hypot(x - HA.x, z - HA.z);
  if (d < 350) return 0;
  let t = d < 900 ? 1 : d < 1800 ? 2 : 3;
  if (x > 2380 || z < 450 || z > southRoadZ(x) - 400) t++;
  return Math.min(4, t);
}

/**
 * 0..1: how heavily the shadow of an uncleared camp lies on this spot.
 * `strength(campId)` returns 1 for an occupied camp, 0 for a cleared one
 * (values between are used while the land heals).
 */
export function blightAt(x, z, strength) {
  let b = 0;
  for (const c of CAMPS) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) > CAMP_BLIGHT_RADIUS || Math.abs(dz) > CAMP_BLIGHT_RADIUS) continue;
    const s = strength ? strength(c.id) : 1;
    if (s <= 0) continue;
    b = Math.max(b, s * (1 - smoothstep(40, CAMP_BLIGHT_RADIUS, Math.hypot(dx, dz))));
  }
  return b;
}

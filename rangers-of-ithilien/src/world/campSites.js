// Where the enemy has gone to ground: more than a hundred camps, thicker and
// larger the farther they lie from Henneth Annûn. Pure.

import { rng, smoothstep } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, LANDMARKS, bankX, haradRoadX, southRoadZ, roadDistance, inClearing } from './layout.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { dangerTier } from './regions.js';
import { houseDistance } from './oldworks.js';
import { pathDistance } from './paths.js';
import { relicDistance } from './relicSites.js';

export const CAMP_BLIGHT_RADIUS = 95;
const SPACING = [0, 230, 185, 160, 150]; // by danger tier

function generate() {
  const rand = rng(WORLD.seed + 202);
  const camps = [];
  for (let tries = 0; tries < 9000; tries++) {
    const x = 150 + rand() * 1560, z = 90 + rand() * 3790;
    if (x < bankX(z) + 40 || x > haradRoadX(z) + 150 || z > southRoadZ(x) - 30) continue;
    const tier = dangerTier(x, z);
    if (tier === 0 || Math.hypot(x - HA.x, z - HA.z) < 250) continue;
    if (Math.abs(z - HA.z) < 40 && x > 600 && x < HA.x + 60) continue;
    if (inClearing(x, z) || streamDistance(x, z) < 12 || roadDistance(x, z) < 14 || houseDistance(x, z) < 11) continue;
    if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * 0.5 + 25)) continue;
    if (pathDistance(x, z) < 9 || relicDistance(x, z) < 26) continue;
    if (heightAt(x, z) < 2 || slopeAt(x, z) > 0.28) continue;
    const gap = SPACING[tier];
    if (camps.some((c) => Math.abs(c.x - x) < gap && Math.abs(c.z - z) < gap && Math.hypot(c.x - x, c.z - z) < gap)) continue;
    // size 1 (a few stragglers) to 3 (a stockaded war-camp)
    const size = Math.max(1, Math.min(3, Math.floor(tier / 2 + rand() * 1.6)));
    camps.push({ id: 'c' + (camps.length + 1), x: Math.round(x), z: Math.round(z), tier, size });
  }
  return camps;
}

/** @type {{id:string, x:number, z:number, tier:number, size:number}[]} */
export const CAMPS = generate();

const CELL = 100;
const grid = new Map();
for (const c of CAMPS) {
  const k = Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(c);
}
function each(x, z, fn) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let j = cz - 1; j <= cz + 1; j++) {
    for (let i = cx - 1; i <= cx + 1; i++) {
      const list = grid.get(i + ',' + j);
      if (list) for (const c of list) fn(c);
    }
  }
}

/** The camp within r of a point, if any. */
export function campNear(x, z, r) {
  let found = null;
  each(x, z, (c) => { if (!found && Math.hypot(c.x - x, c.z - z) < r) found = c; });
  return found;
}

/**
 * 0..1: how heavily the shadow of an uncleared camp lies on this spot.
 * `strength(campId)` returns 1 for an occupied camp, 0 for a cleared one
 * (values between are used while the land heals).
 */
export function blightAt(x, z, strength) {
  let b = 0;
  each(x, z, (c) => {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d >= CAMP_BLIGHT_RADIUS) return;
    const s = strength ? strength(c.id) : 1;
    if (s > 0) b = Math.max(b, s * (1 - smoothstep(25, CAMP_BLIGHT_RADIUS, d)));
  });
  return b;
}

// Where the enemy has gone to ground. Many small camps in the woods north of
// Henneth Annûn; fewer and larger ones to the south; old diggings in the heather. Pure.

import { rng, smoothstep, noise2 } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, LANDMARKS, bankX, haradRoadX, southRoadZ, roadDistance, inClearing } from './layout.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { dangerTier } from './regions.js';
import { houseDistance } from './oldworks.js';
import { pathDistance } from './paths.js';
import { relicDistance } from './relicSites.js';

/** How far a camp's shadow lies on the land, by its size. */
export const BLIGHT_RADIUS = [0, 55, 80, 110, 140];
const MAX_BLIGHT = 140;
const SPACING = [0, 140, 180, 205, 220]; // typical gap between camps, by danger tier

/**
 * Camps are scattered unevenly: each keeps its own distance from the others
 * (some huddle, some stand apart), and whole tracts are left empty.
 * size: 1 a few stragglers, 2 a band, 3 a stockade with a captain, 4 a war-camp.
 * kind: 'mine' in the heather, where they lair in old diggings; else 'camp'.
 */
function generate() {
  const rand = rng(WORLD.seed + 202);
  const camps = [];
  const usable = (x, z) => {
    if (x < bankX(z) + 40 || x > haradRoadX(z) + 150 || z < 90 || z > southRoadZ(x) - 30) return false;
    if (dangerTier(x, z) === 0 || Math.hypot(x - HA.x, z - HA.z) < 250) return false;
    if (Math.abs(z - HA.z) < 40 && x > 600 && x < HA.x + 60) return false;
    if (inClearing(x, z) || streamDistance(x, z) < 12 || roadDistance(x, z) < 22 || houseDistance(x, z) < 11) return false;
    if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * 0.5 + 25)) return false;
    if (pathDistance(x, z) < 9 || relicDistance(x, z) < 26) return false;
    return heightAt(x, z) >= 2 && slopeAt(x, z) <= 0.28;
  };
  const clearOf = (x, z, gap) => !camps.some((c) => Math.abs(c.x - x) < gap && Math.abs(c.z - z) < gap && Math.hypot(c.x - x, c.z - z) < gap);
  const add = (x, z, size) => {
    const kind = x > haradRoadX(z) + 15 ? 'mine' : 'camp';
    camps.push({ id: 'c' + (camps.length + 1), x: Math.round(x), z: Math.round(z), tier: dangerTier(x, z), size: kind === 'mine' ? Math.min(size, 3) : size, kind });
  };
  for (let tries = 0; tries < 14000; tries++) {
    const x = 150 + rand() * 1560, z = 90 + rand() * 3790;
    if (!usable(x, z)) continue;
    if (noise2(x / 240, z / 240, WORLD.seed + 205) < -0.28) continue; // quiet country
    const tier = dangerTier(x, z);
    if (!clearOf(x, z, SPACING[tier] * (0.75 + 0.9 * rand()))) continue;
    const r = rand();
    add(x, z, tier === 1 ? (r < 0.88 ? 1 : 2) : tier === 2 ? (r < 0.45 ? 1 : 2) : tier === 3 ? (r < 0.12 ? 1 : r < 0.65 ? 2 : 3) : (r < 0.25 ? 2 : r < 0.75 ? 3 : 4));
    // Often a camp has a picket or two lying close by, so they come in knots
    // with empty woods between, not at even intervals.
    const pickets = rand() < 0.5 ? (rand() < 0.35 ? 2 : 1) : 0;
    for (let k = 0; k < pickets; k++) {
      const a = rand() * 6.283, d = 42 + rand() * 45;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (usable(px, pz) && clearOf(px, pz, 38)) add(px, pz, 1);
    }
  }
  return camps;
}

/** @type {{id:string, x:number, z:number, tier:number, size:number, kind:string}[]} */
export const CAMPS = generate();

const CELL = 150; // must exceed the largest blight radius: lookups search the 3 x 3 cells around a point
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
    const d = Math.hypot(c.x - x, c.z - z), R = BLIGHT_RADIUS[c.size];
    if (d >= R) return;
    const s = strength ? strength(c.id) : 1;
    if (s > 0) b = Math.max(b, s * (1 - smoothstep(R * 0.3, R, d)));
  });
  return b;
}

// What the player can stand on and what stops them.
// Solids are axis-aligned boxes that act as walls from the side and floors from
// above; circles are trunks and pillars. Hollows are places under the terrain
// (the cave) where the ground overhead must be ignored. Pure: no rendering code.

import { heightAt } from './terrain.js';
import { PLAYER, CHUNK } from '../config.js';

const CELL = 32;
const solidGrid = new Map();
const circleGrid = new Map();
const chunkCircles = new Map();
const hollows = [];

function cellsOf(minX, maxX, minZ, maxZ, fn) {
  for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) fn(cx + ',' + cz);
  }
}
function insert(grid, item, minX, maxX, minZ, maxZ) {
  cellsOf(minX, maxX, minZ, maxZ, (k) => {
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(item);
  });
}

/** @param s {{minX,maxX,minZ,maxZ,bottom,top:number|((x:number,z:number)=>number)}} */
export function addSolid(s) {
  insert(solidGrid, s, s.minX - 1, s.maxX + 1, s.minZ - 1, s.maxZ + 1);
  return s;
}
/**
 * @param tag optional label; resolveCircles can be told to ignore circles with a given tag
 * @param group optional name for a set of circles that may later be taken away together (removeCircles)
 */
export function addCircle(x, z, r, tag, group) {
  insert(circleGrid, { x, z, r, tag, group }, x - r - 1, x + r + 1, z - r - 1, z + r + 1);
}
/** Take away every circle added with this group (stakes knocked down when a stockade falls). */
export function removeCircles(group) {
  for (const [k, list] of circleGrid) {
    const keep = list.filter((c) => c.group !== group);
    if (keep.length !== list.length) circleGrid.set(k, keep);
  }
}
export function setChunkCircles(key, list) { chunkCircles.set(key, list); }
export function removeChunkCircles(key) { chunkCircles.delete(key); }
/** A box under the terrain: below `ceiling`, the ground overhead does not count. */
export function addHollow(h) { hollows.push(h); }

const topOf = (s, x, z) => (typeof s.top === 'function' ? s.top(x, z) : s.top);
const clampTo = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const near = (x, z) => solidGrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));

/** Terrain height as it matters to a body at height y: -Infinity inside a hollow. */
export function terrainAt(x, z, y) {
  for (const h of hollows) {
    if (y < h.ceiling && x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) return -Infinity;
  }
  return heightAt(x, z);
}

/** Height of the highest surface the player could be standing on at (x, z). */
export function groundAt(x, z, feetY) {
  let g = terrainAt(x, z, feetY);
  const list = near(x, z);
  if (list) {
    for (const s of list) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      const t = topOf(s, x, z);
      if (t <= feetY + PLAYER.stepHeight && t > g) g = t;
    }
  }
  return g === -Infinity ? heightAt(x, z) : g;
}

/** True if a solid stops a body of radius r standing with its feet at feetY. */
export function blockedBySolid(x, z, feetY, r) {
  const list = near(x, z);
  if (!list) return false;
  for (const s of list) {
    if (x < s.minX - r || x > s.maxX + r || z < s.minZ - r || z > s.maxZ + r) continue;
    const t = topOf(s, clampTo(x, s.minX, s.maxX), clampTo(z, s.minZ, s.maxZ));
    if (t <= feetY + PLAYER.stepHeight) continue;      // low enough to step onto
    if (s.bottom >= feetY + PLAYER.height) continue;   // overhead
    return true;
  }
  return false;
}

/** True if the point lies inside a solid or under the terrain (for the camera). */
export function pointBlocked(x, y, z) {
  const t = terrainAt(x, z, y);
  if (y < t + 0.25) return true;
  const list = near(x, z);
  if (!list) return false;
  for (const s of list) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    if (y > s.bottom - 0.2 && y < topOf(s, x, z) + 0.2) return true;
  }
  return false;
}

function pushOut(list, p, r, skip) {
  for (const c of list) {
    if (skip && c.tag === skip) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    const min = r + c.r;
    if (Math.abs(dx) >= min || Math.abs(dz) >= min) continue;
    const d = Math.hypot(dx, dz);
    if (d >= min) continue;
    if (d < 1e-4) { p.x += min; continue; }
    p.x = c.x + (dx / d) * min;
    p.z = c.z + (dz / d) * min;
  }
}

/** Push a point {x, z} out of any trunk or pillar it overlaps (except those tagged `skip`). */
export function resolveCircles(p, r, skip) {
  const fixed = circleGrid.get(Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL));
  if (fixed) pushOut(fixed, p, r, skip);
  const cx0 = Math.floor((p.x - 4) / CHUNK.size), cx1 = Math.floor((p.x + 4) / CHUNK.size);
  const cz0 = Math.floor((p.z - 4) / CHUNK.size), cz1 = Math.floor((p.z + 4) / CHUNK.size);
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const list = chunkCircles.get(cx + ',' + cz);
      if (list) pushOut(list, p, r);
    }
  }
}

/** True if (x, z) is inside the trunk of a great tree (small trees and bushes do not count). */
export function trunkAt(x, z) {
  const list = chunkCircles.get(Math.floor(x / CHUNK.size) + ',' + Math.floor(z / CHUNK.size));
  if (!list) return false;
  for (const c of list) {
    if (!c.big) continue;
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

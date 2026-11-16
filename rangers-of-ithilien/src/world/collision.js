// What the player can stand on and what stops them.
// Solids are axis-aligned boxes that act as walls from the side and floors from
// above; circles are trunks and pillars. Pure: no rendering code.

import { heightAt } from './terrain.js';
import { PLAYER, CHUNK } from '../config.js';

/** @type {{minX:number,maxX:number,minZ:number,maxZ:number,bottom:number,top:number|((x:number,z:number)=>number)}[]} */
export const solids = [];
const staticCircles = [];
const chunkCircles = new Map();

export function addSolid(s) { solids.push(s); return s; }
export function addCircle(x, z, r) { staticCircles.push({ x, z, r }); }
export function setChunkCircles(key, list) { chunkCircles.set(key, list); }
export function removeChunkCircles(key) { chunkCircles.delete(key); }

const topOf = (s, x, z) => (typeof s.top === 'function' ? s.top(x, z) : s.top);
const clampTo = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Height of the highest surface the player could be standing on at (x, z). */
export function groundAt(x, z, feetY) {
  let g = heightAt(x, z);
  for (const s of solids) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    const t = topOf(s, x, z);
    if (t <= feetY + PLAYER.stepHeight && t > g) g = t;
  }
  return g;
}

/** True if a solid stops a body of radius r standing with its feet at feetY. */
export function blockedBySolid(x, z, feetY, r) {
  for (const s of solids) {
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
  if (y < heightAt(x, z) + 0.25) return true;
  for (const s of solids) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    if (y > s.bottom - 0.2 && y < topOf(s, x, z) + 0.2) return true;
  }
  return false;
}

function pushOut(list, p, r) {
  for (const c of list) {
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

/** Push a point {x, z} out of any trunk or pillar it overlaps. */
export function resolveCircles(p, r) {
  pushOut(staticCircles, p, r);
  const cx0 = Math.floor((p.x - 3) / CHUNK.size), cx1 = Math.floor((p.x + 3) / CHUNK.size);
  const cz0 = Math.floor((p.z - 3) / CHUNK.size), cz1 = Math.floor((p.z + 3) / CHUNK.size);
  for (let cz = cz0; cz <= cz1; cz++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const list = chunkCircles.get(cx + ',' + cz);
      if (list) pushOut(list, p, r);
    }
  }
}

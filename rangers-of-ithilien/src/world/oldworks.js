// What is left of the people who farmed Ithilien: farmsteads and hamlets with
// their fields, orchards and tree-lined lanes. Pure: this decides where things
// were; world/farms.js builds what still stands.

import { rng } from '../util/noise.js';
import { WORLD, CHUNK } from '../config.js';
import { HA, LANDMARKS, bankX, haradRoadX, southRoadZ, roadDistance, inClearing } from './layout.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';

const rand = rng(WORLD.seed + 101);
const between = (a, b) => a + (b - a) * rand();

function buildable(x, z, margin = 0) {
  if (x < bankX(z) + 70 || x > haradRoadX(z) - 50 || z < 140 || z > southRoadZ(x) - 90) return false;
  if (Math.abs(z - HA.z) < 90 + margin && x > 600 && x < HA.x + 120) return false;
  if (streamDistance(x, z) < 24 || roadDistance(x, z) < 22) return false;
  for (const l of LANDMARKS) if (Math.hypot(x - l.x, z - l.z) < l.r * 0.5 + 45 + margin) return false;
  return heightAt(x, z) > 3 && slopeAt(x, z) < 0.2;
}

/** Sites: { id, kind, x, z, houses: [{x, z, w, d}], fields: [{minX, maxX, minZ, maxZ}], lanes: [{x0, z0, x1, z1}] } */
export const SITES = [];
const planted = []; // { x, z, species, scale }

function plantOK(x, z) {
  if (x < bankX(z) + 12 || x > WORLD.width || z < 40 || z > WORLD.length - 40) return false;
  if (inClearing(x, z) || streamDistance(x, z) < 5 || roadDistance(x, z) < 6) return false;
  const h = heightAt(x, z);
  return h > 1.5 && h < 150 && slopeAt(x, z) < 0.55;
}
function plant(x, z, species, scale) {
  if (plantOK(x, z)) planted.push({ x, z, species, scale });
}
/** A double row of trees along a line: the ghost of a lane. */
function avenue(x0, z0, x1, z1, species, spacing, width, scale) {
  const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  for (let d = 0; d <= len; d += spacing) {
    for (const side of [-1, 1]) {
      if (rand() < 0.16) continue; // some have fallen
      plant(x0 + ux * d - uz * side * width / 2, z0 + uz * d + ux * side * width / 2, species, scale * between(0.85, 1.15));
    }
  }
}
function field(site, minX, minZ, w, d) {
  site.fields.push({ minX, maxX: minX + w, minZ, maxZ: minZ + d });
}

function farm(x, z, i) {
  const site = { id: 'farm' + i, kind: 'farm', x, z, houses: [], fields: [], lanes: [] };
  const w = between(8, 11), d = between(5.5, 7.5);
  site.houses.push({ x, z, w, d });
  if (rand() < 0.5) site.houses.push({ x: x + between(9, 13) * (rand() < 0.5 ? -1 : 1), z: z + between(-4, 4), w: between(4, 6), d: between(4, 5.5) }); // a byre
  const quads = [[1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 3));
  for (const [sx, sz] of quads) {
    const fw = between(34, 62), fd = between(30, 54);
    field(site, sx > 0 ? x + 8 : x - 8 - fw, sz > 0 ? z + 7 : z - 7 - fd, fw, fd);
  }
  // an old orchard in the first field
  const f = site.fields[0];
  for (let ox = f.minX + 6; ox < f.maxX - 5 && ox < f.minX + 46; ox += 8) {
    for (let oz = f.minZ + 6; oz < f.maxZ - 5 && oz < f.minZ + 46; oz += 8) {
      if (rand() < 0.68) plant(ox + between(-0.6, 0.6), oz + between(-0.6, 0.6), 'olive', between(1.2, 1.8));
    }
  }
  // the lane to the door, lined with cypress
  const [ax, az] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)];
  const len = between(70, 180);
  const lane = { x0: x + ax * 9, z0: z + az * 9, x1: x + ax * (9 + len), z1: z + az * (9 + len) };
  site.lanes.push(lane);
  avenue(lane.x0, lane.z0, lane.x1, lane.z1, 'cypress', 9, 7, 1.05);
  return site;
}

function hamlet(x, z, i) {
  const site = { id: 'hamlet' + i, kind: 'hamlet', x, z, houses: [], fields: [], lanes: [] };
  const n = 7 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + between(-0.2, 0.2), r = between(20, 38);
    site.houses.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, w: between(6, 11), d: between(5, 8) });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (rand() < 0.2) continue;
    const fw = between(50, 85), fd = between(45, 75);
    field(site, sx > 0 ? x + 46 : x - 46 - fw, sz > 0 ? z + 44 : z - 44 - fd, fw, fd);
  }
  // two old ways out of the village, under great trees
  const a0 = between(0, Math.PI);
  for (const a of [a0, a0 + between(1.9, 2.8)]) {
    const len = between(240, 440);
    const lane = { x0: x + Math.cos(a) * 44, z0: z + Math.sin(a) * 44, x1: x + Math.cos(a) * (44 + len), z1: z + Math.sin(a) * (44 + len) };
    site.lanes.push(lane);
    avenue(lane.x0, lane.z0, lane.x1, lane.z1, 'greatBeech', 15, 9, 0.9);
  }
  // one great tree on the green
  plant(x + 5, z - 4, 'greatOak', 1.25);
  return site;
}

function scatter(count, spacing, make, margin) {
  let made = 0;
  for (let tries = 0; tries < count * 80 && made < count; tries++) {
    const x = between(180, 1500), z = between(140, 3800);
    if (!buildable(x, z, margin)) continue;
    if (SITES.some((s) => Math.hypot(s.x - x, s.z - z) < (s.kind === 'hamlet' ? Math.max(spacing, 210) : spacing))) continue;
    SITES.push(make(x, z, made++));
  }
}
scatter(6, 520, hamlet, 30);
scatter(46, 175, farm, 0);

// ---- lookups ----
const CELL = 64;
const fieldGrid = new Map();
for (const s of SITES) {
  for (const f of s.fields) {
    for (let cz = Math.floor(f.minZ / CELL); cz <= Math.floor(f.maxZ / CELL); cz++) {
      for (let cx = Math.floor(f.minX / CELL); cx <= Math.floor(f.maxX / CELL); cx++) {
        const k = cx + ',' + cz;
        if (!fieldGrid.has(k)) fieldGrid.set(k, []);
        fieldGrid.get(k).push(f);
      }
    }
  }
}
/** True inside what was once a walled field. */
export function inField(x, z) {
  const list = fieldGrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
  if (!list) return false;
  for (const f of list) if (x > f.minX && x < f.maxX && z > f.minZ && z < f.maxZ) return true;
  return false;
}

const HOUSES = SITES.flatMap((s) => s.houses);
/** Distance to the nearest house centre (large if none is near). */
export function houseDistance(x, z) {
  let d = Infinity;
  for (const h of HOUSES) {
    const dx = Math.abs(x - h.x), dz = Math.abs(z - h.z);
    if (dx < 40 && dz < 40) d = Math.min(d, Math.hypot(dx, dz));
  }
  return d;
}

const plantedByChunk = new Map();
for (const p of planted) {
  const k = Math.floor(p.x / CHUNK.size) + ',' + Math.floor(p.z / CHUNK.size);
  if (!plantedByChunk.has(k)) plantedByChunk.set(k, []);
  plantedByChunk.get(k).push(p);
}
/** Trees that were planted by hand long ago, for one terrain chunk. */
export function plantedIn(cx, cz) {
  return plantedByChunk.get(cx + ',' + cz) ?? [];
}
export const PLANTED_COUNT = planted.length;

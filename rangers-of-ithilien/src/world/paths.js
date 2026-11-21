// The old ways: paths that once joined farm to village to shrine, now half
// lost under the turf. They link nearly everything worth finding, so a ranger
// who follows one will come somewhere. Pure.

import { noise2, smoothstep } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, LANDMARKS, haradRoadX, southRoadZ, bankX, gorgeZ } from './layout.js';
import { STREAMS } from './terrain.js';
import { SITES } from './oldworks.js';
import { RELICS } from './relicSites.js';

const S = WORLD.seed;

// ---- places the paths join ----
const nodes = [];
const node = (x, z, road = false) => nodes.push({ x, z, road });
// (No path leads to the hidden stair: the old ways start where the stream leaves the cut.)
const outOfCut = STREAMS.find((s) => s.home === 'lower').points[3];
node(outOfCut.x, outOfCut.z + 5); // where the stream runs out of the cut
for (const s of SITES) if (!s.added) node(s.x, s.z + (s.kind === 'hamlet' ? 0 : 9));
for (const l of LANDMARKS) if (l.kind && l.kind !== 'morgul' && l.kind !== 'osgiliath' && l.kind !== 'crossroads') node(l.x, l.z + (l.flat ?? 10) * 0.6);
node(LANDMARKS.find((l) => l.id === 'cormallen').x, HA.z + 30);
for (const r of RELICS) node(r.x, r.z + 7);
for (let z = 195; z < 2850; z += 320) node(haradRoadX(z), z, true);        // joining points on the roads
for (let x = 315; x < 1125; x += 300) node(x, southRoadZ(x), true);

/** True if the straight line a-b crosses the pool or the cut (no path may lead over the edge). */
function crossesCut(a, b) {
  for (let t = 0; t <= 1; t += 0.05) {
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (x > HA.basin.minX - 8 && x < HA.x + 40 && Math.abs(z - HA.z) < 22) return true;
    if (x > HA.gorge.endX - 25 && x <= HA.basin.minX - 8 && Math.abs(z - gorgeZ(x)) < 16) return true;
  }
  return false;
}
const cost = (a, b) => (a.road && b.road ? 0 : crossesCut(a, b) ? Infinity : Math.hypot(a.x - b.x, a.z - b.z));

// ---- which pairs are joined: a spanning tree, plus some short loops ----
const links = [];
{
  const inTree = new Array(nodes.length).fill(false), best = new Array(nodes.length).fill(Infinity), from = new Array(nodes.length).fill(-1);
  best[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (from[u] >= 0) links.push([from[u], u]);
    for (let v = 0; v < nodes.length; v++) {
      if (inTree[v]) continue;
      const c = cost(nodes[u], nodes[v]);
      if (c < best[v]) { best[v] = c; from[v] = u; }
    }
  }
  const joined = new Set(links.map(([a, b]) => Math.min(a, b) + ':' + Math.max(a, b)));
  for (let i = 0; i < nodes.length; i++) {
    // a second way out of most places, if something lies near
    let pick = -1, d = 230;
    for (let j = 0; j < nodes.length; j++) {
      const key = Math.min(i, j) + ':' + Math.max(i, j);
      if (j === i || joined.has(key)) continue;
      const c = cost(nodes[i], nodes[j]);
      if (c > 0 && c < d) { d = c; pick = j; }
    }
    if (pick >= 0 && noise2(i * 7.3, 1.7, S + 500) > -0.3) { links.push([i, pick]); joined.add(Math.min(i, pick) + ':' + Math.max(i, pick)); }
  }
}

// A site added after the scatter (oldworks.js: the Window Woods village) is
// joined last, to the two nearest places, so no other link changes; these
// late links are marked so that camps, placed as before, ignore them.
const late = new Set();
for (const s of SITES) {
  if (!s.added) continue;
  const i = nodes.length;
  node(s.x, s.z);
  const near = nodes.map((n, j) => [j, j === i || n.road ? Infinity : cost(nodes[i], n)]).sort((a, b) => a[1] - b[1]).slice(0, 2);
  for (const [j, c] of near) if (c < Infinity) { links.push([j, i]); late.add(links.length - 1); }
}

/** The paths as polylines: arrays of [x, z]. Each wanders a little between its ends. */
export const PATHS = [];
const LATE = new Set(); // the polylines of late links
for (const [k, [ia, ib]] of links.entries()) {
  const a = nodes[ia], b = nodes[ib];
  if (a.road && b.road) continue; // that stretch is the road itself
  const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.round(len / 9));
  const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len, sway = Math.min(16, len * 0.09);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, env = Math.sin(t * Math.PI);
    const off = (noise2(ia * 3.1 + t * len / 70, ib * 1.9, S + 510) * sway + noise2(t * len / 22, ia + ib, S + 511) * 2.5) * env;
    const x = a.x + (b.x - a.x) * t + nx * off, z = a.z + (b.z - a.z) * t + nz * off;
    if (x > bankX(z) + 8) pts.push([x, z]);
  }
  if (pts.length > 1) { PATHS.push(pts); if (late.has(k)) LATE.add(pts); }
}

// ---- lookup: distance to the nearest path ----
const CELL = 32, REACH = 12;
const grid = new Map();
for (const pts of PATHS) {
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], LATE.has(pts)];
    const x0 = Math.floor((Math.min(seg[0], seg[2]) - REACH) / CELL), x1 = Math.floor((Math.max(seg[0], seg[2]) + REACH) / CELL);
    const z0 = Math.floor((Math.min(seg[1], seg[3]) - REACH) / CELL), z1 = Math.floor((Math.max(seg[1], seg[3]) + REACH) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const k = cx + ',' + cz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(seg);
    }
  }
}

/** Distance to the nearest path centre line, or Infinity if none within about 12 m.
 * `early`: leave out the paths to sites added after the scatter (for campSites). */
export function pathDistance(x, z, early = false) {
  const list = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
  if (!list) return Infinity;
  let best = REACH * REACH;
  for (const s of list) {
    if (early && s[4]) continue;
    const dx = s[2] - s[0], dz = s[3] - s[1];
    let t = ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s[0] + dx * t - x, pz = s[1] + dz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) best = d2;
  }
  return best < REACH * REACH ? Math.sqrt(best) : Infinity;
}

/**
 * 0..1: how plainly the old path shows on the ground here. It comes and goes:
 * clear for a stretch, then lost in the grass, then picked up again.
 */
export function pathWear(x, z) {
  const d = pathDistance(x, z);
  if (d > 6) return 0;
  const seen = 0.35 + 0.65 * smoothstep(-0.35, 0.2, noise2(x / 45, z / 45, S + 520));
  // Wide and soft: the ground is coloured at 4 m intervals, so a narrow line would vanish.
  return (1 - smoothstep(1.5, 6, d)) * seen;
}

export const PATH_NODES = nodes;

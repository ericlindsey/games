// Where Ithilien is settled again (since v0.7). Every province of woods has one
// settlement: its village, or where it has none a farmstead. Here is which site
// that is, where the settlers' boat puts in on the Anduin, what they will sow,
// the plots they clear for it, and in what order the houses are mended. Any
// other farmstead Éowyn is shown may take a family too (a homestead), with one
// plot of its own. Pure: how far each has come is worked out from the saved
// state (systems/settlement.js); world/villages.js builds what stands.
//
// The one thing here that changes is which plots are cleared (setClearedPlots):
// the woods (world/vegetation.js) and the grass (world/grass.js) keep off them.

import { SITES } from './oldworks.js';
import { bankX, roadDistance, LANDMARKS, inClearing } from './layout.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { provinceAt } from './provinces.js';

/**
 * The settlements, in the order Éowyn means to settle them (the woods in
 * Faramir's order; the fells have no one to settle). `crops` are the two seed
 * kinds its people sow, the first field and then the second. `landing`, if
 * given, is a landmark the boat puts in by; otherwise the bank opposite the site.
 * Names: the settlers' own, plain words of Gondor in our tongue.
 */
const PLAN = [
  { province: 'henneth', site: 'hamlet4', name: 'Beechwell', landing: 'cairandros', crops: ['thymeSeed', 'baySeed'],
    reeve: { name: 'Ardan', title: 'Reeve of Beechwell' } },
  { province: 'forlad', site: 'hamlet2', name: 'Heathwick', crops: ['thymeSeed', 'poppySeed'],
    reeve: { name: 'Brannoc', title: 'Reeve of Heathwick' } },
  { province: 'bridgelands', site: 'hamlet0', name: 'Bridgefold', crops: ['baySeed', 'poppySeed'],
    reeve: { name: 'Hirwen', title: 'Reeve of Bridgefold' } },
  { province: 'ithil', site: 'hamlet3', name: 'Moonhallow', crops: ['oliveStone', 'poppySeed'],
    reeve: { name: 'Talven', title: 'Reeve of Moonhallow' } },
  // (south of the Moonwood there are no villages: a farmstead each, and seed the south lacks)
  { province: 'southwood', site: 'farm3', name: 'Olivegarth', crops: ['oliveStone', 'thymeSeed'],
    reeve: { name: 'Imrith', title: 'Goodwife of Olivegarth' } },
  { province: 'morgul', site: 'farm25', name: 'Marchstead', crops: ['poppySeed', 'baySeed'],
    reeve: { name: 'Dorvan', title: 'Goodman of Marchstead' } },
];

const siteById = Object.fromEntries(SITES.map((s) => [s.id, s]));

// ---- plots: new-cleared ground for a crop, in an old field where there is one ----

const PLOT = { w: 34, d: 26 };
const overlaps = (a, b, gap = 4) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
const taken = []; // every plot laid out so far, so no two meet
/** True if a plot here would lie on sound, open, level ground, clear of everything built. */
function plotOK(r, site) {
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const x = r.minX + ((r.maxX - r.minX) * i) / 4, z = r.minZ + ((r.maxZ - r.minZ) * j) / 4;
      if (heightAt(x, z) < 2 || slopeAt(x, z) > 0.22 || streamDistance(x, z) < 7 || roadDistance(x, z) < 9 || inClearing(x, z)) return false;
      for (const h of site.houses) if (Math.abs(x - h.x) < h.w / 2 + 5 && Math.abs(z - h.z) < h.d / 2 + 5) return false;
    }
  }
  for (const l of LANDMARKS) if (l.kind && Math.hypot((r.minX + r.maxX) / 2 - l.x, (r.minZ + r.maxZ) / 2 - l.z) < (l.flat ?? 20) + 30) return false;
  return !taken.some((t) => overlaps(t, r)) && !SITES.some((s) => s !== site && s.houses.some((h) => Math.abs((r.minX + r.maxX) / 2 - h.x) < PLOT.w && Math.abs((r.minZ + r.maxZ) / 2 - h.z) < PLOT.d));
}
/**
 * `n` plots for a site: first the corner of each old field nearest the houses
 * (a farm's first field is its orchard, so it is passed over), then, if the
 * site has too few fields, new ground cleared beside it.
 */
function plotsFor(site, n) {
  const out = [];
  const fields = site.fields.slice(site.kind === 'farm' ? 1 : 0)
    .sort((a, b) => Math.hypot((a.minX + a.maxX) / 2 - site.x, (a.minZ + a.maxZ) / 2 - site.z) - Math.hypot((b.minX + b.maxX) / 2 - site.x, (b.minZ + b.maxZ) / 2 - site.z));
  for (const f of fields) {
    if (out.length >= n) break;
    const w = Math.min(PLOT.w, f.maxX - f.minX - 6), d = Math.min(PLOT.d, f.maxZ - f.minZ - 6);
    if (w < 16 || d < 12) continue;
    const east = (f.minX + f.maxX) / 2 < site.x, south = (f.minZ + f.maxZ) / 2 < site.z; // the corner toward the houses
    const minX = east ? f.maxX - 3 - w : f.minX + 3, minZ = south ? f.maxZ - 3 - d : f.minZ + 3;
    const r = { minX, maxX: minX + w, minZ, maxZ: minZ + d };
    if (plotOK(r, site)) { out.push(r); taken.push(r); }
  }
  const reach = site.kind === 'hamlet' ? 58 : 30;
  for (let k = 0; out.length < n && k < 48; k++) {
    const a = k * 0.785 + (k >> 3) * 0.39, rr = reach + (k >> 3) * 8;
    const cx = site.x + Math.cos(a) * rr, cz = site.z + Math.sin(a) * rr;
    const r = { minX: cx - PLOT.w / 2, maxX: cx + PLOT.w / 2, minZ: cz - PLOT.d / 2, maxZ: cz + PLOT.d / 2 };
    if (plotOK(r, site)) { out.push(r); taken.push(r); }
  }
  return out;
}

/** The houses of a site, nearest the middle first: the order they are mended in. */
const byNearness = (site) => site.houses.map((h, i) => ({ i, d: Math.hypot(h.x - site.x, h.z - site.z) })).sort((a, b) => a.d - b.d).map((h) => h.i);

/**
 * { province, site, name, crops, reeve, x, z, kind, landing: {x, z}, plots: [rect, rect], houses: [index, ...] }
 * `reeve` is who speaks for them, and stands on their green.
 */
export const SETTLEMENTS = PLAN.map((p) => {
  const s = siteById[p.site];
  const lm = p.landing && LANDMARKS.find((l) => l.id === p.landing);
  const lz = lm ? lm.z : s.z;
  return {
    ...p, x: s.x, z: s.z, kind: s.kind,
    landing: { x: bankX(lz) + 7, z: lz },
    plots: plotsFor(s, 2),
    houses: byNearness(s),
  };
});
export const settlementBySite = Object.fromEntries(SETTLEMENTS.map((s) => [s.site, s]));
export const settlementIn = Object.fromEntries(SETTLEMENTS.map((s) => [s.province, s]));

/** Every other farmstead may become a homestead: { site, province, x, z, plot, crop }. */
export const HOMESTEADS = SITES.filter((s) => s.kind === 'farm' && !settlementBySite[s.id]).map((s) => {
  const pid = provinceAt(s.x, s.z);
  const crop = settlementIn[pid]?.crops[0] ?? 'poppySeed'; // they sow what their neighbours sow
  return { site: s.id, province: pid, x: s.x, z: s.z, plot: plotsFor(s, 1)[0] ?? null, crop };
});
export const homesteadBySite = Object.fromEntries(HOMESTEADS.map((h) => [h.site, h]));

/** The place a site is known by on the ground: { x, z, kind, houses } from oldworks.js. */
export const siteOf = (id) => siteById[id];

// ---- which plots are cleared now ----

let cleared = [];
/** Set the plots now cleared (from systems/settlement.js clearedPlots), for the woods and grass to keep off. */
export function setClearedPlots(list) { cleared = list.map((p) => p.rect ?? p); }
/** True inside a cleared plot (or within `margin` of one). */
export function inPlot(x, z, margin = 0) {
  for (const r of cleared) if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) return true;
  return false;
}

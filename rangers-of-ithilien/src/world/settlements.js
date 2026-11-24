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
import { heightAt, slopeAt, streamDistance, levelGround } from './terrain.js';
import { provinceAt } from './provinces.js';

/**
 * The settlements, in the order Éowyn means to settle them (the woods in
 * Faramir's order; the fells have no one to settle). `crops` are the two seed
 * kinds its people sow, the first field and then the second. `landing`, if
 * given, is a landmark the boat puts in by; otherwise the bank opposite the site.
 * Names: the settlers' own, plain words of Gondor in our tongue. Each has a
 * storekeeper (`trader`, since v0.7.6) and somewhere a ranger may sleep (`inn`):
 * an inn with a sign in a village, a bed at a farm.
 */
const PLAN = [
  { province: 'henneth', site: 'hamlet4', name: 'Beechwell', landing: 'cairandros', crops: ['thymeSeed', 'baySeed'],
    reeve: { name: 'Ardan', title: 'Reeve of Beechwell' }, trader: { name: 'Mirel', title: 'Keeps the stores at Beechwell' }, inn: 'the Well and Bucket' },
  { province: 'forlad', site: 'hamlet2', name: 'Heathwick', crops: ['thymeSeed', 'poppySeed'],
    reeve: { name: 'Brannoc', title: 'Reeve of Heathwick' }, trader: { name: 'Sefa', title: 'Keeps the stores at Heathwick' }, inn: 'the Heath Hen' },
  { province: 'bridgelands', site: 'hamlet0', name: 'Bridgefold', crops: ['baySeed', 'poppySeed'],
    reeve: { name: 'Hirwen', title: 'Reeve of Bridgefold' }, trader: { name: 'Odo', title: 'Keeps the stores at Bridgefold' }, inn: 'the Broken Span' },
  { province: 'ithil', site: 'hamlet3', name: 'Moonhallow', crops: ['oliveStone', 'poppySeed'],
    reeve: { name: 'Talven', title: 'Reeve of Moonhallow' }, trader: { name: 'Lisbet', title: 'Keeps the stores at Moonhallow' }, inn: 'the Lantern' },
  // (south of the Moonwood there are no villages: a farmstead each, and seed the south lacks)
  { province: 'southwood', site: 'farm3', name: 'Olivegarth', crops: ['oliveStone', 'thymeSeed'],
    reeve: { name: 'Imrith', title: 'Goodwife of Olivegarth' }, trader: { name: 'Garan', title: 'Imrith\u2019s son, who keeps their stores' }, inn: 'a bed in the loft' },
  { province: 'morgul', site: 'farm25', name: 'Marchstead', crops: ['poppySeed', 'baySeed'],
    reeve: { name: 'Dorvan', title: 'Goodman of Marchstead' }, trader: { name: 'Nell', title: 'Dorvan\u2019s daughter, who keeps their stores' }, inn: 'a bed by the hearth' },
];

const siteById = Object.fromEntries(SITES.map((s) => [s.id, s]));

/**
 * True if any part of a house stands in or over a stream (the ruins were laid
 * out before the streams were traced, and a few are): its people leave it a ruin.
 */
function wet(h) {
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (streamDistance(h.x + (a * h.w) / 2, h.z + (b * h.d) / 2) < 3) return true;
  }
  return false;
}
/** The houses of a site that will be lived in again (the dry ones), nearest the middle first: the order they are mended in. */
const keptHouses = (site) => site.houses.map((h, i) => ({ i, h, d: Math.hypot(h.x - site.x, h.z - site.z) }))
  .filter((e) => !wet(e.h)).sort((a, b) => a.d - b.d).map((e) => e.i);

// The ground under every house that may be lived in again (each settlement's,
// and every farmstead, which a family may take) is levelled a little, as the
// people who built them levelled it; before (v0.7) the lowest corner set the
// floor and the uphill side was sunk in the hillside. Levelled here, after the
// camps and the lesser ruins are placed, so neither moves; the ruins themselves
// are built later, on the levelled ground.
for (const site of SITES) {
  const settled = PLAN.some((p) => p.site === site.id);
  if (!settled && site.kind !== 'farm') continue;
  levelGround(keptHouses(site).map((i) => site.houses[i]).map((h) => {
    const r = Math.max(h.w, h.d) / 2;
    return { x: h.x, z: h.z, r0: r + 1.2, r1: r + 5.5 };
  }));
}

/**
 * Where a boat can lie afloat off the bank at z (the hull clear of the bottom
 * all along), and the dry ground beside it where its people wait.
 */
function mooring(z) {
  const bx = bankX(z);
  let x = bx - 30;
  for (let t = bx + 10; t > bx - 40; t -= 0.5) {
    let deep = true;
    for (const dx of [-1.4, 0, 1.4]) for (const dz of [-4, -2, 0, 2, 4]) if (heightAt(t + dx, z + dz) > -0.6) deep = false;
    if (deep) { x = t - 0.5; break; }
  }
  let lx = x + 3;
  while (lx < bx + 30 && heightAt(lx, z) < 0.7) lx += 0.5;
  return { boat: { x, z }, landing: { x: lx + 3, z } };
}

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


/**
 * { province, site, name, crops, reeve, x, z, kind, landing: {x, z}, boat: {x, z}, plots: [rect, rect], houses: [index, ...] }
 * `reeve` is who speaks for them, and stands on their green. `houses` are the
 * ones they will mend, in order (a house in a stream is left a ruin).
 */
/**
 * Where on the shore the boat puts in: by its landmark if it has one, else the
 * bank nearest due west of the site that is still in the settlement's own
 * province (due west of Moonhallow is the Southwood's shore, where nobody
 * looking in the Moonwood would find them).
 */
function landingZ(p, s, used = []) {
  const lm = p.landing && LANDMARKS.find((l) => l.id === p.landing);
  if (lm) return lm.z;
  const clear = (z) => used.every((u) => Math.abs(u - z) > 22); // (since v0.8.2: no two boats side by side)
  for (let d = 0; d < 800; d += 4) {
    for (const z of d ? [s.z - d, s.z + d] : [s.z]) {
      // a few metres inside the border, so they are not standing on it
      if (clear(z) && [z - 12, z, z + 12].every((q) => provinceAt(bankX(q) + 7, q) === p.province) && heightAt(bankX(z) + 7, z) > 0.8) return z;
    }
  }
  for (let d = 0; d < 800; d += 4) for (const z of [s.z - d, s.z + d]) if (clear(z) && heightAt(bankX(z) + 7, z) > 0.8) return z; // (a province with no shore of its own: the bank due west)
  return s.z;
}

export const SETTLEMENTS = PLAN.map((p) => {
  const s = siteById[p.site];
  const { boat, landing } = mooring(landingZ(p, s));
  return {
    ...p, x: s.x, z: s.z, kind: s.kind,
    landing, boat,
    plots: plotsFor(s, 2),
    houses: keptHouses(s),
  };
});
export const settlementBySite = Object.fromEntries(SETTLEMENTS.map((s) => [s.site, s]));
export const settlementIn = Object.fromEntries(SETTLEMENTS.map((s) => [s.province, s]));

/**
 * The families who take a homestead, by the name of whoever heads them (our own
 * names, in the plain way of Gondor's country folk), one for every farmstead.
 */
const FAMILIES = ['Haldor', 'Berel', 'Corlan', 'Dervin', 'Ethrin', 'Falmar', 'Gwindel', 'Harnel', 'Ostrel', 'Joren', 'Brenor', 'Lorran',
  'Marec', 'Nimrel', 'Orleth', 'Perrin', 'Radan', 'Sorel', 'Tamar', 'Valdin', 'Wenna', 'Aldreth', 'Caradan', 'Elwen', 'Fendril', 'Gerreth'];
/** How many come over the River to a homestead (since v0.8.2: they used to be there already, two of them). */
export const FAMILY_SIZE = 5;

/**
 * Every other farmstead may become a homestead: { site, province, x, z, plot, crop,
 * houses, family, name, kind, landing, boat }. Since v0.8.2 its family comes over
 * the River like the settlers, with a boat of their own on the shore of its
 * province (never beside another), and the ranger leads them in.
 */
const usedLandings = SETTLEMENTS.map((s) => s.landing.z);
export const HOMESTEADS = SITES.filter((s) => s.kind === 'farm' && !settlementBySite[s.id]).map((s, i) => {
  const pid = provinceAt(s.x, s.z);
  const crop = settlementIn[pid]?.crops[0] ?? 'poppySeed'; // they sow what their neighbours sow
  const z = landingZ({ province: pid }, s, usedLandings);
  usedLandings.push(z);
  const family = FAMILIES[i % FAMILIES.length];
  return { site: s.id, province: pid, x: s.x, z: s.z, plot: plotsFor(s, 1)[0] ?? null, crop, houses: keptHouses(s),
    family, name: `${family}\u2019s farm`, kind: 'farm', homestead: true, ...mooring(z) };
});
export const homesteadBySite = Object.fromEntries(HOMESTEADS.map((h) => [h.site, h]));
/** A settlement or a homestead, by its site: whichever people live (or will live) there. */
export const placeBySite = (site) => settlementBySite[site] ?? homesteadBySite[site] ?? null;

/** The place a site is known by on the ground: { x, z, kind, houses } from oldworks.js. */
export const siteOf = (id) => siteById[id];

// ---- the ground the settlers have cleared: their fields, and (since v0.7.7) their yards ----

/**
 * The ground a settled place keeps bare, trodden to earth: round every house
 * they mend (a rect, `margin` out from its walls), and a village's green. The
 * woods and grass keep off it, and it is drawn as earth (`trodden`), so no bush
 * stands in a doorway. Each { minX, maxX, minZ, maxZ, yard: true } or { x, z, r, yard: true }.
 */
export function yardsOf(site) {
  const s = siteById[site], houses = settlementBySite[site]?.houses ?? homesteadBySite[site]?.houses ?? [];
  const m = 5;
  const out = houses.map((i) => { const h = s.houses[i]; return { minX: h.x - h.w / 2 - m, maxX: h.x + h.w / 2 + m, minZ: h.z - h.d / 2 - m, maxZ: h.z + h.d / 2 + m, yard: true }; });
  if (s.kind === 'hamlet') out.push({ x: s.x - 1, z: s.z + 2, r: 16, yard: true }, { x: s.x + 2, z: s.z - 9, r: 5, yard: true }); // the green, and where their goods stand
  else out.push({ x: s.x + s.houses[0].w / 2 + 4, z: s.z - 2, r: 4.5, yard: true });
  return out;
}
/** The rectangle round any cleared shape. */
export const boundsOf = (a) => (a.r !== undefined ? { minX: a.x - a.r, maxX: a.x + a.r, minZ: a.z - a.r, maxZ: a.z + a.r } : a);

let cleared = [];
/** Set the ground now cleared (from systems/settlement.js clearedGround): fields and yards, for the woods and grass to keep off. */
export function setClearedPlots(list) { cleared = list.map((p) => p.rect ?? p); }
/**
 * True inside cleared ground (or within `margin` of it). `yards` false asks only
 * after the sown fields (the old planted trees, an avenue or the oak on the green,
 * are left standing in a yard).
 */
export function inPlot(x, z, margin = 0, yards = true) {
  for (const r of cleared) {
    if (r.yard && !yards) continue;
    if (r.r !== undefined) { if (Math.hypot(x - r.x, z - r.z) < r.r + margin) return true; }
    else if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) return true;
  }
  return false;
}
/** How far (0..1) the ground at a point is trodden to earth by the settlers: 1 in a yard, easing off over two metres. */
export function trodden(x, z) {
  let t = 0;
  for (const r of cleared) {
    if (!r.yard) continue;
    const out = r.r !== undefined ? Math.hypot(x - r.x, z - r.z) - r.r : Math.max(r.minX - x, x - r.maxX, r.minZ - z, z - r.maxZ);
    if (out < 2) t = Math.max(t, Math.min(1, 1 - out / 2));
    if (t >= 1) break;
  }
  return t;
}

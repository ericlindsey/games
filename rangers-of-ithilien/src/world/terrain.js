// The ground. heightAt(x, z) is the single source of truth for terrain:
// rendering, collision and placement all call it. Pure and deterministic.

import { fbm, noise2, smoothstep, lerp } from '../util/noise.js';
import { WORLD } from '../config.js';
import {
  HA, bankX, ANDUIN_WIDTH, haradRoadX, southRoadZ, CAIR_ANDROS, LANDMARKS, gorgeZ,
} from './layout.js';
import { fenWeight } from './regions.js';

const S = WORLD.seed;
export const WATER_LEVEL = 0; // the Anduin's surface

/** Land east of the river before any stamps. `x` must be >= the bank. */
function eastLand(x, z, bx) {
  const dx = x - bx;
  const e = dx / 1500;
  const base = 2.5 + 95 * Math.pow(e, 1.25);
  const amp = Math.min(1, base / 28) * (0.75 + 0.5 * Math.min(e, 1.2));
  let h = base + fbm(x / 270, z / 270, 4, S) * 24 * amp + fbm(x / 80, z / 80, 2, S + 50) * 4 * amp;

  // The Ephel Dúath: a wall along the east, with a gap where the Morgul road enters.
  const m = Math.min(x - (1690 + 45 * noise2(z / 310, 7.3, S + 9)), 760);
  if (m > 0) {
    const gap = 1 - smoothstep(40, 150, Math.abs(z - southRoadZ(x)));
    const ridge = 0.8 + 0.45 * fbm(x / 200, z / 200, 3, S + 90);
    h += Math.pow(m / 520, 1.7) * 520 * ridge * (1 - 0.94 * gap);
  }

  const fen = fenWeight(x, z);
  if (fen > 0) h = lerp(h, 0.3 + noise2(x / 22, z / 22, S + 5) * 0.75, fen * 0.93);
  return Math.max(h, 1.2 - fen * 2);
}

/** The lie of the land with the Anduin cut into it. No stamps, roads or streams. */
function natural(x, z) {
  const bx = bankX(z);
  const t = bx - x; // > 0 means west of the east bank
  let land;
  if (t < ANDUIN_WIDTH / 2) {
    land = eastLand(Math.max(x, bx), z, bx);
  } else {
    const w = Math.max(0, t - ANDUIN_WIDTH);
    land = 2.5 + w * 0.05 + fbm(x / 300, z / 300, 3, S + 70) * 18 * smoothstep(0, 300, w);
  }
  const inRiver = smoothstep(-5, 40, t) * (1 - smoothstep(ANDUIN_WIDTH - 40, ANDUIN_WIDTH + 5, t));
  let h = lerp(land, -7, inRiver);

  const ex = (x - CAIR_ANDROS.x) / CAIR_ANDROS.rx, ez = (z - CAIR_ANDROS.z) / CAIR_ANDROS.rz;
  const q = ex * ex + ez * ez;
  if (q < 1.3) h = lerp(h, 5 + fbm(x / 60, z / 60, 2, S + 3) * 2.5, 1 - smoothstep(0.5, 1.2, q));
  return h;
}

// Sites that level the ground around them. Heights are filled in on first use.
const FLATS = LANDMARKS.filter((l) => l.flat).map((l) => ({ x: l.x, z: l.z, r0: l.flat, r1: l.flat * 1.8, h: null }));

/** The land with the rock shelf of Henneth Annûn raised on it. */
function shelved(x, z) {
  let h = natural(x, z);
  // The shelf falls away sooner to the west, so the cut below the pool is not
  // too long before the land comes down to meet it.
  const ox = x - (HA.x - 70);
  const r = Math.hypot(ox < 0 ? ox * 1.6 : ox, z - HA.z);
  if (r < 310) h = lerp(h, HA.plateau, 1 - smoothstep(130, 310, r));
  return h;
}

function withStamps(x, z) {
  let h = shelved(x, z);
  for (const s of FLATS) {
    const dx = x - s.x, dz = z - s.z;
    if (Math.abs(dx) > s.r1 || Math.abs(dz) > s.r1) continue;
    // Level to the ground as it stands there (shelf included), so nothing sits in a bowl or on a mound.
    if (s.h === null) s.h = Math.max(shelved(s.x, s.z), 1.5);
    h = lerp(h, s.h, 1 - smoothstep(s.r0, s.r1, Math.hypot(dx, dz)));
  }
  return h;
}

/** The ground before any water has cut into it: land, shelf, levelled sites and roads. */
function baseHeight(x, z) {
  let h = withStamps(x, z);
  const xr = haradRoadX(z);
  const d1 = Math.abs(x - xr);
  if (d1 < 14) h = lerp(h, withStamps(xr, z), 1 - smoothstep(4.5, 14, d1));
  if (x > bankX(z) - 30) {
    const zr = southRoadZ(x);
    const d2 = Math.abs(z - zr);
    if (d2 < 14) h = lerp(h, withStamps(x, zr), 1 - smoothstep(4.5, 14, d2));
  }
  return h;
}

// ---------------------------------------------------------------------------
// Streams. Each is traced downhill over the base terrain from a spring under
// the mountains, so it winds round the hills and joins others where they meet.
// Its bed is then made to fall the whole way (a running minimum), and the
// terrain is cut down to it in a small valley. Water can therefore never run
// uphill: the ribbon drawn in water.js sits a fixed depth above this bed.
// ---------------------------------------------------------------------------

const GULLY = 2.2;      // how far the bed lies below the untouched ground, at least
const VALLEY_REACH = 46; // beyond this distance a stream does not shape the ground
const HOME_BED = HA.plateau - 7.4; // the home stream's bed on the shelf, above the fall

/** Height of the valley side above the bed, d metres from the stream. */
function valleyProfile(d) {
  if (d < 3.5) return 0;
  if (d < 6) return 1.2 * smoothstep(3.5, 6, d);
  return 1.2 + 0.28 * (d - 6);
}

/** For tracing only: the base ground with rises over built places, so streams go round them. */
function tracingHeight(x, z) {
  let h = baseHeight(x, z);
  for (const l of LANDMARKS) {
    if (!l.flat) continue;
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.flat + 60) h += 9 * (1 - smoothstep(l.flat, l.flat + 60, d));
  }
  return h;
}
const nearHenneth = (x, z) => x > 600 && x < HA.x + 90 && Math.abs(z - HA.z) < 70;

/**
 * Streams: { points: [{x, z, bed, cut}], joins } where `bed` is the level of
 * the stream bed the water lies on and `cut` the level the valley is cut to
 * (the same except along the cut at Henneth Annûn, which terrain shapes itself).
 */
export const STREAMS = [];

/**
 * Pools: where a stream, walking downhill, comes round in a loop it has found a
 * hollow. The loop is cut out of its course and a pool lies there instead, like
 * the one at Henneth Annûn on a smaller scale. { x, z, r, stream, index, bed }.
 */
export const POOLS = [];

/** @param home true for the home stream below the cut, which may pass near the refuge and its own upper course */
function trace(x, z, dirX, dirZ, firm = 0, home = false) {
  const pts = [{ x, z }];
  const pools = [];
  const STEP = 9, e = 7;
  let best = x, stalled = 0, escape = 0;
  for (let n = 0; n < 420; n++) {
    let gx = tracingHeight(x - e, z) - tracingHeight(x + e, z), gz = tracingHeight(x, z - e) - tracingHeight(x, z + e);
    const g = Math.hypot(gx, gz) || 1;
    const sure = Math.min(1, (g / (2 * e)) * 12); // on flat ground the slope says little: trust it less
    gx /= g; gz /= g;
    if (x < best - 1) { best = x; stalled = 0; } else stalled++;
    const west = 0.2 + (1 - sure) * 0.5 + Math.min(2, stalled * 0.06) + (escape > 0 ? 1.4 : 0); // and when going nowhere, make for the river
    escape--;
    const keep = n < firm ? 3 : 0.55; // `firm` steps hold the starting course
    dirX = dirX * keep + gx * 0.6 * sure - west + noise2(n * 0.21, pts[0].z * 0.01, S + 700) * 0.18;
    dirZ = dirZ * keep + gz * 0.6 * sure + noise2(n * 0.17, pts[0].z * 0.013, S + 701) * 0.3;
    // Streams that may not be joined (the home stream above its fall) push others away.
    for (const st of STREAMS) {
      if (!st.noJoin || home) continue;
      for (const p of st.points) {
        const ax = x - p.x, az = z - p.z, d2 = ax * ax + az * az;
        if (d2 < 1600 && d2 > 1) { const k = (40 - Math.sqrt(d2)) / 40 * 1.5 / Math.sqrt(d2); dirX += ax * k; dirZ += az * k; }
      }
    }
    const d = Math.hypot(dirX, dirZ) || 1;
    dirX /= d; dirZ /= d;
    x += dirX * STEP; z += dirZ * STEP;
    if (z < 50 || z > WORLD.length - 50 || (!home && n >= firm && nearHenneth(x, z))) { return null; } // lost, or blundering into the refuge
    // Come round in a loop? Then this hollow holds a pool: cut the loop out,
    // set the pool in it, and go on from where the loop began, west.
    let looped = -1;
    for (let k = pts.length - 5; k >= 0; k--) {
      if (Math.abs(pts[k].x - x) < 14 && Math.abs(pts[k].z - z) < 14 && Math.hypot(pts[k].x - x, pts[k].z - z) < 14) { looped = k; break; }
    }
    if (looped >= 0) {
      const loop = pts.slice(looped).concat([{ x, z }]);
      let cx = 0, cz = 0;
      for (const p of loop) { cx += p.x; cz += p.z; }
      cx /= loop.length; cz /= loop.length;
      let r = 0;
      for (const p of loop) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
      r = Math.max(6, Math.min(13, r * 0.75));
      const k = pts[looped], toK = Math.hypot(k.x - cx, k.z - cz);
      if (toK > r - 2) { const t = (toK - (r - 2)) / toK; cx += (k.x - cx) * t; cz += (k.z - cz) * t; } // the stream must run through it
      for (let q = pools.length - 1; q >= 0; q--) if (Math.hypot(pools[q].x - cx, pools[q].z - cz) < pools[q].r + r) pools.splice(q, 1); // one pool to a hollow
      pools.push({ x: cx, z: cz, r, index: looped });
      pts.length = looped + 1;
      for (let q = pools.length - 1; q >= 0; q--) if (pools[q].index > looped) pools.splice(q, 1); // they lay on the course just cut away
      x = k.x; z = k.z; dirX = -1; dirZ = 0; escape = 6;
      continue;
    }
    pts.push({ x, z });
    if (x < bankX(z) - 8) return { points: pts, joins: null, pools };   // reached the Great River
    if (n > 2) {
      for (let si = 0; si < STREAMS.length; si++) {                 // or another stream, near enough to run together
        if (STREAMS[si].noJoin) continue;
        const other = STREAMS[si].points;
        for (let i = 0; i < other.length; i++) {
          const ax = other[i].x - x, az = other[i].z - z;
          if (Math.abs(ax) < 28 && Math.abs(az) < 28 && ax * ax + az * az < 28 * 28 && !other[i].fixed) {
            pts.push({ x: other[i].x, z: other[i].z });
            return { points: pts, joins: { stream: si, index: i }, pools };
          }
        }
      }
    }
  }
  return null;
}

function buildStreams() {
  // The home stream. Above the fall it keeps the course it always had: down
  // from the mountains, then dead straight across the shelf to the lip.
  const upper = [];
  for (let x = 1840; x > HA.x + 50; x -= 9) {
    const m = (30 * Math.sin(x / 165 + 1.7) + 8 * Math.sin(x / 61 + 0.3)) * smoothstep(HA.x + 50, HA.x + 260, x);
    upper.push({ x, z: HA.z + m });
  }
  for (const x of [HA.x + 48, HA.x + 36, HA.x + 24, HA.x + 12, HA.x + 4]) upper.push({ x, z: HA.z, fixed: true });
  STREAMS.push({ points: upper, joins: null, home: 'upper', noJoin: true }); // its bed is held up to the lip: nothing may join it

  // Through the pool and the cut the terrain is shaped by cutHenneth(); this
  // entry gives the water its line, and cuts the broad upper valley above the slot.
  const g = HA.gorge, cutEnd = g.endX - 20;
  const cut = [];
  for (let x = HA.basin.minX + 2; x >= cutEnd; x -= 5) {
    const bed = HA.floor - g.fall * Math.max(0, HA.basin.minX - x) - 0.6;
    // Along the slot the valley above it is cut only to the shelf's stream level;
    // where the slot ends, the valley comes down to the water and opens out.
    cut.push({ x, z: gorgeZ(x) + g.channelOffset, bed, cut: x < g.endX + 12 ? bed : HOME_BED, fixed: true });
  }
  STREAMS.push({ points: cut, joins: null, home: 'cut', noJoin: true });

  // Below the cut it finds its own way to the river.
  const lower = trace(cutEnd, cut[cut.length - 1].z, -1, 0, 6, true);
  lower.points[0].bed = cut[cut.length - 1].bed;
  STREAMS.push({ ...lower, home: 'lower' });

  // The others: springs along the foot of the mountains, and a few in the lowlands.
  const springs = [];
  for (const z of [250, 470, 700, 930, 1480, 1760, 2040, 2320, 2600, 2880, 3160, 3440, 3700]) springs.push([1835 + noise2(z / 100, 3.3, S + 710) * 20, z]);
  springs.push([1250, 620], [1180, 2460], [1300, 3280], [820, 2900], [760, 1620]);
  for (const [x, z] of springs) {
    const s = trace(x, z, -1, 0);
    if (s && s.points.length > 6) STREAMS.push(s);
  }
  for (let si = 0; si < STREAMS.length; si++) {
    for (const p of STREAMS[si].pools ?? []) POOLS.push({ ...p, stream: si });
  }

  // Beds: below the untouched ground, and never rising on the way down.
  for (const s of STREAMS) {
    let bed = Infinity;
    for (const p of s.points) {
      if (p.bed === undefined) {
        const raw = Math.max(baseHeight(p.x, p.z) - GULLY, 0.15);
        bed = Math.min(bed - 0.012, raw);
        if (s.home === 'upper') bed = p.fixed ? HOME_BED : Math.max(bed, HOME_BED + 0.2);
        p.bed = Math.max(bed, 0.15);
      }
      bed = p.bed;
      if (p.cut === undefined) p.cut = p.bed;
    }
  }
  // Where one stream joins another, the one it joins must not be higher: lower
  // it from the meeting point down. Later streams join earlier ones, so go backwards.
  for (let si = STREAMS.length - 1; si >= 0; si--) {
    const s = STREAMS[si];
    if (!s.joins) continue;
    const main = STREAMS[s.joins.stream].points;
    let bed = Math.min(main[s.joins.index].bed, s.points[s.points.length - 1].bed);
    s.points[s.points.length - 1].bed = s.points[s.points.length - 1].cut = bed;
    for (let i = s.joins.index; i < main.length; i++) {
      if (main[i].fixed) break;
      bed = Math.min(bed, main[i].bed);
      main[i].bed = main[i].cut = bed;
      bed -= 0.012;
    }
  }
  // A pool's floor is the bed where its stream enters it.
  for (const p of POOLS) p.bed = STREAMS[p.stream].points[p.index].bed;
}
buildStreams();

const _pool = { p: null, d: 0 };
/** The pool nearest a point, if within reach of its banks. */
function nearestPool(x, z) {
  _pool.p = null;
  let best = Infinity;
  for (const p of POOLS) {
    const dx = x - p.x, dz = z - p.z, reach = p.r + VALLEY_REACH;
    if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
    const d = Math.hypot(dx, dz) - p.r;
    if (d < VALLEY_REACH && d < best) { best = d; _pool.p = p; _pool.d = d; }
  }
  return _pool.p;
}
/** Ground shape of a pool: a shallow bowl below the bed, then a bank. d is distance from its edge. */
function poolProfile(p, d) {
  if (d < 0) return p.bed - 1.1 * (1 - smoothstep(-p.r * 0.6, 0, d));
  if (d < 3) return p.bed + 0.9 * smoothstep(0, 3, d);
  return p.bed + 0.9 + 0.28 * (d - 3);
}
/** True inside the water of a pool (used to keep the stream ribbon out of it). */
export function inPool(x, z) {
  for (const p of POOLS) if (Math.hypot(x - p.x, z - p.z) < p.r + 0.8) return true;
  return false;
}

// Segments of every stream, in a grid, for finding the nearest stream to a point.
const SCELL = 32;
const segGrid = new Map();
for (const s of STREAMS) {
  for (let i = 0; i < s.points.length - 1; i++) {
    const a = s.points[i], b = s.points[i + 1];
    const seg = [a.x, a.z, b.x, b.z, a.cut, b.cut];
    const x0 = Math.floor((Math.min(a.x, b.x) - VALLEY_REACH) / SCELL), x1 = Math.floor((Math.max(a.x, b.x) + VALLEY_REACH) / SCELL);
    const z0 = Math.floor((Math.min(a.z, b.z) - VALLEY_REACH) / SCELL), z1 = Math.floor((Math.max(a.z, b.z) + VALLEY_REACH) / SCELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const k = cx * 4096 + cz;
      if (!segGrid.has(k)) segGrid.set(k, []);
      segGrid.get(k).push(seg);
    }
  }
}
const _near = { d: 0, cut: 0 };
/** Nearest stream to a point: sets _near.d (distance) and _near.cut (level there). False if none in reach. */
function nearestStream(x, z) {
  const list = segGrid.get(Math.floor(x / SCELL) * 4096 + Math.floor(z / SCELL));
  if (!list) return false;
  let best = VALLEY_REACH * VALLEY_REACH, cut = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const dx = s[2] - s[0], dz = s[3] - s[1];
    let t = ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s[0] + dx * t - x, pz = s[1] + dz * t - z, d2 = px * px + pz * pz;
    if (d2 < best) { best = d2; cut = s[4] + (s[5] - s[4]) * t; }
  }
  if (best >= VALLEY_REACH * VALLEY_REACH) return false;
  _near.d = Math.sqrt(best); _near.cut = cut;
  return true;
}

/** Distance to the nearest stream's centre line (Infinity beyond about 46 m). */
export function streamDistance(x, z) {
  return nearestStream(x, z) ? _near.d : Infinity;
}

// The Old Bridge stands where a stream runs nearly east-west, as near its old place as may be.
{
  const pier = LANDMARKS.find((l) => l.id === 'pier');
  let best = null, score = Infinity;
  for (const s of STREAMS) {
    if (s.home) continue;
    for (let i = 2; i < s.points.length - 2; i++) {
      const p = s.points[i], q = s.points[i + 2], o = s.points[i - 2];
      const along = Math.abs(q.z - o.z) / (Math.hypot(q.x - o.x, q.z - o.z) || 1); // 0 = east-west
      const sc = Math.hypot(p.x - pier.x, p.z - pier.z) + along * 600;
      if (p.x > bankX(p.z) + 150 && sc < score) { score = sc; best = p; }
    }
  }
  if (best) { pier.x = Math.round(best.x); pier.z = Math.round(best.z); }
}

/**
 * The hidden pool and the cut at Henneth Annûn: a basin walled by cliffs just
 * west of the fall, drained by a deep narrow gorge. The gorge floor falls
 * gently to x = 650, where the traced stream takes over with the same bed, so
 * the floor runs on without a step into the open valley: that is the way out.
 */
function cutHenneth(x, z, h) {
  if (x > HA.x || x < HA.gorge.endX - 40 || Math.abs(z - HA.z) > 30) return h;
  const dz = Math.abs(z - (x < HA.basin.minX ? gorgeZ(x) : HA.z));
  const b = HA.basin, g = HA.gorge;
  if (x > b.minX - b.wall) {
    const edge = b.halfZ + (z > HA.z ? b.southSetBack : 0);
    const w = (1 - smoothstep(edge, edge + b.wall, dz)) * smoothstep(b.minX - b.wall, b.minX, x);
    const rp = Math.hypot(x - HA.pool.x, z - HA.pool.z);
    h = lerp(h, HA.floor - 1.2 * (1 - smoothstep(HA.pool.r * 0.6, HA.pool.r, rp)), w);
  }
  if (x < b.minX + 4) {
    let floor = HA.floor - g.fall * Math.max(0, b.minX - x);
    floor -= 0.6 * (1 - smoothstep(1.6, 2.6, Math.abs(z - (gorgeZ(x) + g.channelOffset)))); // the stream's bed
    // the slot fades out over the last stretch, where the open valley begins
    if (floor < h) h = lerp(h, floor, (1 - smoothstep(g.halfFloor, g.halfTop, dz)) * smoothstep(g.endX - 40, g.endX, x));
  }
  return h;
}

/** Height of the ground at (x, z), in metres. */
export function heightAt(x, z) {
  let h = baseHeight(x, z);
  if (nearestStream(x, z)) {
    const target = _near.cut + valleyProfile(_near.d);
    if (target < h) h = lerp(target, h, smoothstep(VALLEY_REACH * 0.62, VALLEY_REACH, _near.d));
  }
  const pool = nearestPool(x, z);
  if (pool) {
    const target = poolProfile(pool, _pool.d);
    if (target < h) h = lerp(target, h, smoothstep(VALLEY_REACH * 0.62, VALLEY_REACH, _pool.d));
  }
  return cutHenneth(x, z, h);
}

/** Steepness (rise over run) at a point. */
export function slopeAt(x, z) {
  const e = 2;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

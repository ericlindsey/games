// The ground. heightAt(x, z) is the single source of truth for terrain:
// rendering, collision and placement all call it. Pure and deterministic.

import { fbm, noise2, smoothstep, lerp } from '../util/noise.js';
import { WORLD } from '../config.js';
import {
  HA, bankX, ANDUIN_WIDTH, haradRoadX, southRoadZ, streamZ, STREAM_COUNT, STREAM_END_X,
  CAIR_ANDROS, LANDMARKS, CAMPS,
} from './layout.js';
import { fenWeight } from './regions.js';

const S = WORLD.seed;
export const WATER_LEVEL = 0; // the Anduin's surface

/** Land east of the river before any stamps. `x` must be >= the bank. */
function eastLand(x, z, bx) {
  const dx = x - bx;
  const e = dx / 2400;
  const base = 2.5 + 95 * Math.pow(e, 1.25);
  const amp = Math.min(1, base / 28) * (0.75 + 0.5 * Math.min(e, 1.2));
  let h = base + fbm(x / 420, z / 420, 4, S) * 30 * amp + fbm(x / 120, z / 120, 2, S + 50) * 5 * amp;

  // The Ephel Dúath: a wall along the east, with a gap where the Morgul road enters.
  const m = Math.min(x - (2680 + 70 * noise2(z / 500, 7.3, S + 9)), 760);
  if (m > 0) {
    const gap = 1 - smoothstep(60, 220, Math.abs(z - southRoadZ(x)));
    const ridge = 0.8 + 0.45 * fbm(x / 260, z / 260, 3, S + 90);
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
  const inRiver = smoothstep(-5, 45, t) * (1 - smoothstep(ANDUIN_WIDTH - 45, ANDUIN_WIDTH + 5, t));
  let h = lerp(land, -7, inRiver);

  const ex = (x - CAIR_ANDROS.x) / CAIR_ANDROS.rx, ez = (z - CAIR_ANDROS.z) / CAIR_ANDROS.rz;
  const q = ex * ex + ez * ez;
  if (q < 1.3) h = lerp(h, 5 + fbm(x / 60, z / 60, 2, S + 3) * 2.5, 1 - smoothstep(0.5, 1.2, q));
  return h;
}

// Sites that level the ground around them. Heights are filled in on first use.
const FLATS = [
  ...LANDMARKS.filter((l) => l.flat).map((l) => ({ x: l.x, z: l.z, r0: l.flat, r1: l.flat * 1.8, h: null })),
  ...CAMPS.map((c) => ({ x: c.x, z: c.z, r0: 9, r1: 20, h: null })),
];

function withStamps(x, z) {
  let h = natural(x, z);

  // Henneth Annûn: a west-facing cliff with a pool at its foot.
  const r = Math.hypot(x - HA.x, z - HA.z);
  if (r < 240) {
    const target = HA.lowLevel + HA.cliffHeight * smoothstep(HA.x, HA.x + 12, x);
    h = lerp(h, target, 1 - smoothstep(60, 240, r));
    const rp = Math.hypot(x - HA.pool.x, z - HA.pool.z);
    if (rp < HA.pool.r) h -= 0.9 * (1 - smoothstep(HA.pool.r * 0.55, HA.pool.r, rp));
  }

  for (const s of FLATS) {
    const dx = x - s.x, dz = z - s.z;
    if (Math.abs(dx) > s.r1 || Math.abs(dz) > s.r1) continue;
    if (s.h === null) s.h = Math.max(natural(s.x, s.z), 1.5);
    h = lerp(h, s.h, 1 - smoothstep(s.r0, s.r1, Math.hypot(dx, dz)));
  }
  return h;
}

/** Height of the ground at (x, z), in metres. */
export function heightAt(x, z) {
  let h = withStamps(x, z);
  const bx = bankX(z);

  // Roads are levelled across their width.
  const xr = haradRoadX(z);
  const d1 = Math.abs(x - xr);
  if (d1 < 14) h = lerp(h, withStamps(xr, z), 1 - smoothstep(4.5, 14, d1));
  if (x > bx - 30) {
    const zr = southRoadZ(x);
    const d2 = Math.abs(z - zr);
    if (d2 < 14) h = lerp(h, withStamps(x, zr), 1 - smoothstep(4.5, 14, d2));
  }

  // Streams cut a gully inside a broader valley.
  if (x > bx - 20 && x < STREAM_END_X) {
    let carve = 0;
    for (let i = 0; i < STREAM_COUNT; i++) {
      const d = Math.abs(z - streamZ(i, x));
      if (d < 80) carve = Math.max(carve, 2.4 * (1 - smoothstep(4, 11, d)) + 5 * (1 - smoothstep(8, 80, d)));
    }
    if (carve > 0) {
      const reach = 0.25 + 0.75 * smoothstep(bx, bx + 500, x);
      h -= carve * reach * (1 - smoothstep(2820, STREAM_END_X, x));
    }
  }
  return h;
}

/** Steepness (rise over run) at a point. */
export function slopeAt(x, z) {
  const e = 2;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

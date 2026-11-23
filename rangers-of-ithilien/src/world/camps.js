// Enemy camps: the fires, shelters and stockades. Who holds them is in
// entities/enemies.js. When the last of a camp's company falls the camp is
// cleared (main.js); since v0.8 the ranger then breaks it up: the shelters fold
// down into the ground, the fire goes out, the stakes are knocked flat, the
// blight lifts and the dry ground greens.

import * as THREE from 'three';
import { CAMPS } from './campSites.js';
import { HOLDS } from './provinces.js';
import { heightAt } from './terrain.js';
import { addCircle, removeCircles } from './collision.js';
import { surfaceUniforms, CAMP_TINTS } from './surface.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { addRock } from './rocks.js';
import { rng } from '../util/noise.js';

const HIDES = [0xb08a5a, 0x9a4a32, 0xc2a070, 0x8a6a4a, 0x7a5a3e], CHAR = 0x26221f, RAG = 0xb3261e, BONE = 0xd8d2c0, STAKE = 0x4d3d2c, ROCK = 0x7d776c;
const POLE = 0x5a4530, ROPE = 0x8a7a5a, DARK = 0x16110d, LOG = 0x5a4632, SACK = 0x8f7f5c, EMBER = 0xc8501c;
const HOLD_IDS = new Set(Object.values(HOLDS).map((h) => h.id));
const SMOKE_PER_CAMP = 14, SMOKE_CAMPS = 14, SMOKE_RANGE = 520;
// Camps further off than this are not drawn (they are specks in the haze by then; their smoke still shows).
const CAMP_SEEN = 700;
const FOLD = 1.5, FOLD_GAP = 0.22; // seconds a shelter takes to fold down; and between one shelter and the next
/** How far from a camp's fire the ranger may stand to break it up. */
export const BREAK_REACH = 16;
/** The ring of stakes round a camp, if it has one (stockades, war-camps, every hold): its radius. */
export const stockadeRadius = (c) => ((c.size >= 3 || HOLD_IDS.has(c.id)) && c.kind !== 'mine' ? (c.size === 4 ? 17 : c.size === 3 ? 11.5 : 10.5) : 0);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
/** A rod from one point to another (a pole, a rope, a log), thinning to r1 at the far end. */
function rod(b, x0, y0, z0, x1, y1, z1, r, color, seg = 5, r1 = r) {
  _d.set(x1 - x0, y1 - y0, z1 - z0);
  const len = _d.length();
  if (len < 1e-4) return;
  _q.setFromUnitVectors(UP, _d.divideScalar(len));
  _m.compose(_p.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), _q, ONE);
  b.add(new THREE.CylinderGeometry(r1, r, len, seg), color, _m.clone());
}
/** A sheet of hide seen from both sides: the quad a-b-c-d. */
function sheet(b, a, bb, c, d, color) {
  b.tri(...a, ...bb, ...c, color); b.tri(...a, ...c, ...d, color);
  b.tri(...a, ...c, ...bb, color); b.tri(...a, ...d, ...c, color);
}
function flap(b, a, bb, c, color) { b.tri(...a, ...bb, ...c, color); b.tri(...a, ...c, ...bb, color); }
/** A peg driven in at a slant, and a rope from (x0, y0, z0) to it. */
function guy(b, x0, y0, z0, x1, z1) {
  const y1 = heightAt(x1, z1);
  rod(b, x0, y0, z0, x1, y1 + 0.12, z1, 0.012, ROPE, 3);
  b.cyl(0.035, 0.012, 0.32, x1, y1 - 0.12, z1, 0x6e5a40, 4);
}

/**
 * (since v0.8) A ridge tent of hides: two panels sagging between a ridge pole
 * on two uprights, a closed back, a door at the front with one flap tied back
 * and the dark inside showing, a patch or two, guy ropes. (cx, cz) is its
 * middle; `ang` the way the ridge, and the door, point. Returns its footprint.
 */
function ridgeTent(b, cx, cz, ang, L, W, H, hide, rand) {
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux, gy = heightAt(cx, cz);
  const X = (u, v) => cx + ux * u + vx * v, Z = (u, v) => cz + uz * u + vz * v;
  const NU = 6, NV = 3, sag = 0.08 + rand() * 0.1;
  const ridge = (t) => gy + H - sag * Math.sin(Math.PI * t);
  const hemY = {};
  for (const side of [-1, 1]) for (let i = 0; i <= NU; i++) {
    const u = -L / 2 + (L * i) / NU, v = side * W * 1.05;
    hemY[side + ':' + i] = heightAt(X(u, v), Z(u, v)) - 0.07 + 0.04 * Math.sin(i * 2.3 + side);
  }
  const pt = (side, i, j) => {
    const t = i / NU, s = j / NV, u = -L / 2 + L * t;
    const belly = (0.07 + 0.05 * (i % 2)) * Math.sin(Math.PI * t) * Math.sin(Math.PI * s); // the hide slack between the poles
    const v = side * (W * s * (j === NV ? 1.05 : 1) - belly * 0.5);
    const top = ridge(t);
    return [X(u, v), top + (hemY[side + ':' + i] - top) * s - belly, Z(u, v)];
  };
  const other = HIDES[Math.floor(rand() * HIDES.length)];
  for (const side of [-1, 1]) {
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      sheet(b, pt(side, i, j), pt(side, i + 1, j), pt(side, i + 1, j + 1), pt(side, i, j + 1), rand() < 0.12 ? other : hide);
    }
  }
  // the back, closed; the front: one half closed, the other tied back, the dark inside showing
  const foot = (u) => [X(u, 0), heightAt(X(u, 0), Z(u, 0)) - 0.05, Z(u, 0)];
  for (let j = 0; j < NV; j++) for (const side of [-1, 1]) flap(b, foot(-L / 2), pt(side, 0, j), pt(side, 0, j + 1), hide);
  for (let j = 0; j < NV; j++) flap(b, foot(L / 2), pt(-1, NU, j), pt(-1, NU, j + 1), hide);
  const apex = pt(1, NU, 0), hem = pt(1, NU, NV);
  flap(b, apex, hem, [X(L / 2 + 0.2, W * 0.75), gy + H * 0.28, Z(L / 2 + 0.2, W * 0.75)], hide);
  const inU = L / 2 - 0.3;
  flap(b, [X(inU, 0), gy + H * 0.86, Z(inU, 0)], [X(inU, 0), gy - 0.05, Z(inU, 0)], [X(inU, W * 0.82), gy - 0.05, Z(inU, W * 0.82)], DARK);
  flap(b, [X(inU, 0), gy + H * 0.86, Z(inU, 0)], [X(inU, W * 0.82), gy - 0.05, Z(inU, W * 0.82)], [X(inU, W * 0.3), gy + H * 0.6, Z(inU, W * 0.3)], DARK);
  // the poles: two uprights, and the ridge pole standing out at either end
  for (const e of [-1, 1]) rod(b, X(e * L / 2, 0), gy - 0.1, Z(e * L / 2, 0), X(e * L / 2, 0), ridge(e > 0 ? 1 : 0) + 0.22, Z(e * L / 2, 0), 0.045, POLE, 5, 0.035);
  rod(b, X(-L / 2 - 0.3, 0), ridge(0) + 0.05, Z(-L / 2 - 0.3, 0), X(L / 2 + 0.3, 0), ridge(1) + 0.05, Z(L / 2 + 0.3, 0), 0.04, POLE, 5);
  for (const e of [-1, 1]) guy(b, X(e * (L / 2 + 0.25), 0), ridge(0) + 0.08, Z(e * (L / 2 + 0.25), 0), X(e * (L / 2 + 1.4), 0), Z(e * (L / 2 + 1.4), 0));
  for (const side of [-1, 1]) { const m = pt(side, NU / 2, NV - 1); guy(b, ...m, X(0, side * (W + 0.9)), Z(0, side * (W + 0.9))); }
  const r = Math.max(W * 0.95, L * 0.3);
  return { x: cx, z: cz, gy, circles: [[X(-L * 0.24, 0), Z(-L * 0.24, 0), r], [X(L * 0.24, 0), Z(L * 0.24, 0), r]] };
}

/**
 * A round tent of hides on eight poles, crossed and standing out at the top
 * (the smoke-hole open between them), the hide sagging between the poles, a
 * door toward `door` with its flap thrown back. Returns its footprint.
 */
function roundTent(b, cx, cz, door, R, H, hide, rand) {
  const gy = heightAt(cx, cz), N = 8, NJ = 3, top = gy + H, cover = 0.8;
  const a0 = door + Math.PI / N; // the door lies between the last pole and the first
  const pole = (k) => a0 + (k / N) * Math.PI * 2;
  const base = [];
  for (let k = 0; k <= N; k++) { const a = pole(k), x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; base.push(heightAt(x, z) - 0.07); }
  for (let k = 0; k < N; k++) { // the poles, through the crossing and out
    const a = pole(k), bx = cx + Math.cos(a) * R * 1.02, bz = cz + Math.sin(a) * R * 1.02;
    rod(b, bx, base[k], bz, cx - Math.cos(a) * R * 0.14, top + H * 0.14, cz - Math.sin(a) * R * 0.14, 0.04, POLE, 4, 0.03);
  }
  const P = (k, f, j) => { // sector k, f across it (0..1), j up (0..NJ)
    const h = (j / NJ) * cover, a = pole(k) + (f / N) * Math.PI * 2;
    const belly = 1 - 0.08 * Math.sin(Math.PI * f) * (1 - h);
    const r = R * (1 - h) * belly;
    const y = j === 0 ? base[k] + (base[k + 1] - base[k]) * f : gy + H * h;
    return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  };
  const other = HIDES[Math.floor(rand() * HIDES.length)];
  for (let k = 0; k < N - 1; k++) {
    for (let j = 0; j < NJ; j++) for (const [f0, f1] of [[0, 0.5], [0.5, 1]]) sheet(b, P(k, f0, j), P(k, f1, j), P(k, f1, j + 1), P(k, f0, j + 1), rand() < 0.1 ? other : hide);
  }
  // the door: the flap thrown back over the last sector's edge, the dark inside
  const d0 = P(N - 1, 0, 0), dTop = P(N - 1, 0, NJ), out = pole(N - 1) - 0.5;
  flap(b, d0, dTop, [cx + Math.cos(out) * R * 1.15, gy + H * 0.25, cz + Math.sin(out) * R * 1.15], hide);
  for (let j = 0; j < NJ; j++) sheet(b, P(N - 1, 0.5, j), P(N - 1, 1, j), P(N - 1, 1, j + 1), P(N - 1, 0.5, j + 1), hide);
  const ia = door, ix = cx + Math.cos(ia) * R * 0.25, iz = cz + Math.sin(ia) * R * 0.25, sx = -Math.sin(ia) * R * 0.5, sz = Math.cos(ia) * R * 0.5;
  flap(b, [ix - sx, gy - 0.05, iz - sz], [ix + sx, gy - 0.05, iz + sz], [ix, gy + H * 0.7, iz], DARK);
  return { x: cx, z: cz, gy, circles: [[cx, cz, R * 0.92]] };
}

export class Camps {
  /** @param isCleared (id) => true once the camp's company is all dead; @param isBroken (id) => true once the ranger has broken it up */
  constructor(scene, isCleared, isBroken = isCleared) {
    const flameGeo = new THREE.ConeGeometry(0.42, 1.1, 5);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, fog: false });
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false });
    this.sites = CAMPS.map((c) => {
      const rand = rng(Math.round(c.x + c.z * 3));
      const at = (x, z) => heightAt(x, z);
      const occupied = new GeoBuilder(Math.round(c.x), 0.1);
      const always = new GeoBuilder(Math.round(c.z), 0.1);
      const tents = occupied; // (the shelters are part of the camp as it stands: one mesh, whose shelters fold when it is broken up)
      occupied.kind = always.kind = SURF.wood;
      const wasBroken = isBroken(c.id);
      let fx = c.x, fz = c.z; // where the fire is
      let ox = c.x, oz = c.z, facing = null; // where their gear lies about (a mine's, in front of the cut, the way it faces)

      if (c.kind === 'mine') {
        // An old mine in the hillside (since v0.7): a cut into the hill, walled
        // with rock on either hand, runs up to a timbered adit, its frames going
        // back into the dark; a tramway of rails comes out of it, with a tipped
        // cart, and the spoil lies heaped at the mouth of the cut. They lair
        // inside and keep their fire in the cut.
        const turn = rand() * 6.28, a = c.face ?? turn, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux; // u: into the hill; v: across (face: set by hand, campSites.js)
        const P = (du, dv) => [c.x + ux * du + vx * dv, c.z + uz * du + vz * dv];
        const along = -a, across = -(a + Math.PI / 2); // turn a rock's long side along u, or across it
        { // the hill: a long ridge of rock across the end of the cut, and its shoulders
          const [hx, hz] = P(12.5, 0);
          addRock(always, hx, at(hx, hz) - 1.4, hz, 18, ROCK, Math.round(c.x), { detail: 3, sx: 1.35, sy: 0.6, sz: 0.85, cuts: 8, strata: 0.7 }, across);
          for (const s of [-1, 1]) {
            const [sx, sz] = P(8.5, s * 8.5);
            addRock(always, sx, at(sx, sz) - 0.9, sz, 11, s > 0 ? 0x8a8478 : 0x7f8270, Math.round(c.z) + (s > 0 ? 1 : 0), { detail: 2, sy: 0.6, cuts: 7, strata: 0.5 });
          }
          // the ridge runs some 24 m across the end of the cut and 15 m deep: a row of circles fills it
          for (const [dv, du, r] of [[0, 12, 6.8], [4.4, 12.3, 6.5], [-4.4, 12.3, 6.5], [8.4, 13, 5.2], [-8.4, 13, 5.2]]) { const [rx, rz] = P(du, dv); addCircle(rx, rz, r); }
          for (const s of [-1, 1]) { const [sx, sz] = P(8.5, s * 8.5); addCircle(sx, sz, 4.6); } // and its shoulders
        }
        for (const s of [-1, 1]) { // the sides of the cut, high by the adit and lower toward the mouth of the cut
          [[4.2, 5.6, 0.95], [0.6, 4.2, 0.8], [-2.6, 3.2, 0.66], [-4.8, 2.2, 0.55]].forEach(([du, size, sy], k) => {
            const [wx, wz] = P(du, s * (1.55 + size * 0.42));
            addRock(always, wx, at(wx, wz) - 0.35, wz, size, ROCK, Math.round(c.x) + k * 7 + (s > 0 ? 3 : 0), { detail: 2, sx: 1.5, sy, sz: 0.85, cuts: 7, strata: 0.6 }, along);
            addCircle(wx, wz, size * 0.36);
          });
        }
        // the adit: frames of timber going back into the dark, roofed with lagging, under a brow of rock
        const [mx, mz] = P(3.4, 0), my = at(mx, mz);
        const [kx, kz] = P(4.6, 0);
        always.box(2.4, 2.6, 2.0, kx, my - 0.3, kz, 0x0b0a09, -a + Math.PI / 2);
        for (let k = 0; k < 2; k++) {
          const [fx0, fz0] = P(3.4 + k * 1.1, 0), sh = k ? 0.3 : 0;
          for (const s of [-1, 1]) always.box(0.34, 2.9 - sh, 0.34, fx0 + vx * s * 1.3, my - 0.25, fz0 + vz * s * 1.3, k ? 0x2e2418 : 0x5a4530, -a);
          always.box(0.4, 0.4, 3.3, fx0, my + 2.6 - sh, fz0, k ? 0x2e2418 : 0x5a4530, -a);
        }
        for (let i = -2; i <= 2; i++) { const [lx, lz] = P(4.0, i * 0.6); always.box(1.6, 0.08, 0.5, lx, my + 3.0, lz, 0x4a3828, -a); } // lagging over the frames
        { const [tx, tz] = P(3.2, 0); always.box(0.5, 0.3, 3.9, tx, my + 3.0, tz, 0x5a4530, -a); } // the heavy lintel
        { const [bx, bz] = P(5.4, 0); addRock(always, bx, my + 2.6, bz, 6.5, ROCK, Math.round(c.x) + 77, { detail: 2, sx: 1.3, sy: 0.7, sz: 0.9, cuts: 7, strata: 0.6 }, across); } // the brow of the hill over it
        addCircle(...P(4.6, 0), 1.6);
        // the tramway: two rails on sleepers, out of the dark and down the cut, in short lengths that keep to the ground
        for (let d0 = 4.2; d0 > -5; d0 -= 0.8) {
          const [sx, sz] = P(d0, 0);
          always.box(0.25, 0.1, 1.5, sx, at(sx, sz) - 0.02, sz, 0x4a3a2a, -a);
        }
        for (const s of [-1, 1]) {
          for (let d0 = 4.2; d0 > -5; d0 -= 1.6) {
            const [x0, z0] = P(d0, s * 0.5), [x1, z1] = P(d0 - 1.6, s * 0.5), [rx, rz] = P(d0 - 0.8, s * 0.5);
            const y0 = at(x0, z0), y1 = at(x1, z1);
            always.box(1.62, 0.08, 0.07, rx, (y0 + y1) / 2 + 0.06, rz, 0x5a5a5e, -a, 0, Math.atan2(y0 - y1, 1.6));
          }
        }
        { // a cart, tipped off the rails
          const [cx2, cz2] = P(-2.6, 1.2), cy2 = at(cx2, cz2);
          always.box(1.1, 0.75, 1.6, cx2, cy2 + 0.2, cz2, 0x5a4530, -a + 0.3, 0, 0.35);
          for (const s of [-1, 1]) always.cyl(0.24, 0.24, 0.1, cx2 + vx * s * 0.6, cy2 + 0.1, cz2 + vz * s * 0.6, 0x3a3a3e, 8, 0, Math.PI / 2);
        }
        for (let k = 0; k < 9; k++) { // the spoil heap, at the mouth of the cut
          const sx = c.x - ux * 6 + vx * (3.5 + rand() * 3) * (k % 2 ? 1 : -1) + (rand() - 0.5) * 2, sz = c.z - uz * 6 + vz * (3.5 + rand() * 3) * (k % 2 ? 1 : -1) + (rand() - 0.5) * 2;
          addRock(always, sx, at(sx, sz) - 0.15, sz, 0.5 + rand() * 0.9, 0x8a8070, k + Math.round(c.x), { detail: 1, sy: 0.6, cuts: 5 });
        }
        fx = c.x - ux * 8.5; fz = c.z - uz * 8.5; // their fire, out in front of the cut
        ox = fx - ux * 1.5; oz = fz - uz * 1.5; facing = a + Math.PI;
      }
      const y = at(fx, fz);
      // The fire: a ring of stones, the logs, and (from v0.8) a great one for a war-camp,
      // with seats of logs round it, and a spit over it where there are more than a few.
      const big = c.size >= 4 ? 1.6 : c.size === 3 ? 1.25 : 1, fr = 1.15 * big;
      const stones = Math.round(9 * big);
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2, sx = fx + Math.cos(a) * fr, sz = fz + Math.sin(a) * fr;
        addRock(always, sx, at(sx, sz) - 0.08, sz, 0.55 * Math.sqrt(big), 0x77726a, i + 7, { detail: 0, sy: 0.6, cuts: 4 });
      }
      always.box(1.5 * big, 0.2, 0.25, fx, y, fz, CHAR, 0.6);
      always.box(1.5 * big, 0.2, 0.25, fx, y + 0.1, fz, CHAR, 2.2);
      always.blob(0.5 * big, fx, y - 0.1, fz, 0x2e2a26, 1, 0.25, 1); // ash
      if (big > 1) { // a pyre of logs leaning together over the embers
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9 + 0.3, r0 = fr * 0.62;
          rod(occupied, fx + Math.cos(a) * r0, y, fz + Math.sin(a) * r0, fx - Math.cos(a) * 0.1, y + 0.9 * big, fz - Math.sin(a) * 0.1, 0.09, k % 2 ? 0x3a2c20 : CHAR, 5, 0.06);
        }
      }
      for (let k = 0; k < 4 + c.size; k++) { const a = rand() * 6.28, r0 = rand() * fr * 0.55; occupied.blob(0.1 + rand() * 0.08, fx + Math.cos(a) * r0, y + 0.05, fz + Math.sin(a) * r0, EMBER, 1, 0.5, 1); }
      const seats = facing !== null ? 1 : c.size >= 3 ? 4 : 2;
      for (let k = 0; k < seats; k++) { // logs to sit on (they stay when the camp is broken)
        const a = (facing ?? 0) + (facing !== null ? Math.PI / 2 : (k / seats) * Math.PI * 2 + rand() * 0.6), r0 = fr + 1.5;
        const sx = fx + Math.cos(a) * r0, sz = fz + Math.sin(a) * r0, tx = -Math.sin(a) * 0.85, tz = Math.cos(a) * 0.85, sy = at(sx, sz) + 0.13;
        rod(always, sx - tx, sy, sz - tz, sx + tx, sy + 0.02, sz + tz, 0.17, LOG, 7);
      }
      if (c.size >= 2) { // a spit across the fire, on two forked sticks
        const a = rand() * 6.28, kx = Math.cos(a) * (fr + 0.15), kz = Math.sin(a) * (fr + 0.15), h = 1.0 + 0.15 * big;
        for (const s of [-1, 1]) {
          const sx = fx + kx * s, sz = fz + kz * s;
          rod(occupied, sx, at(sx, sz) - 0.1, sz, sx, y + h, sz, 0.035, POLE, 4);
          for (const t of [-1, 1]) rod(occupied, sx, y + h - 0.1, sz, sx + t * kz * 0.1, y + h + 0.12, sz - t * kx * 0.1, 0.02, POLE, 3);
        }
        rod(occupied, fx - kx * 1.15, y + h, fz - kz * 1.15, fx + kx * 1.15, y + h, fz + kz * 1.15, 0.025, 0x3a2c20, 4);
        occupied.blob(0.22, fx, y + h - 0.05, fz, 0x6a3a26, 1.5, 0.8, 0.9);
      }

      // What else is about, kept clear of one another: the places taken so far, and a way to find another
      const R = stockadeRadius(c), gate = rand() * 6.28;
      const taken = [[fx, fz, fr + 2.4]];
      const free = (x, z, r) => taken.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) > tr + r);
      const nearGate = (x, z) => { // (keep the three gates open)
        if (!R) return false;
        const a = Math.atan2(z - c.z, x - c.x);
        for (let k = 0; k < 3; k++) { const g = gate + k * 2.094; if (Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.36) return true; }
        return false;
      };
      const spot = (r, lo, hi) => {
        for (let t = 0; t < 40; t++) {
          const a = facing === null ? rand() * 6.28 : facing + (rand() - 0.5) * 2.4, d = lo + rand() * (hi - lo);
          const x = ox + Math.cos(a) * d, z = oz + Math.sin(a) * d;
          if (R && Math.hypot(x - c.x, z - c.z) > R - 1.6 - r) continue;
          if (free(x, z, r) && !(R && Math.hypot(x - c.x, z - c.z) > R - 5 - r && nearGate(x, z))) { taken.push([x, z, r]); return [x, z]; }
        }
        return null;
      };
      const px = ox + 3, pz = oz - 3.5, py = at(px, pz);
      taken.push([px, pz, 1.2]);
      if (c.size > 1) { // a standard, red on a tall pole
        occupied.box(0.16, 6, 0.16, px, py - 0.2, pz, 0x3a3028, 0, 0.05);
        occupied.box(0.06, 2, 1.5, px, py + 3.8, pz + 0.85, RAG);
        occupied.box(0.07, 0.7, 0.6, px, py + 4.4, pz + 0.9, CHAR);
      }
      // their stores: crates, sacks and a barrel or two
      const stx = ox - 3.6, stz = oz + 3.1;
      taken.push([stx, stz, 2.2]);
      for (let i = 0; i < Math.min(3, c.size); i++) {
        const sx = ox - 3.2 - i * 1.1, sz = oz + 2.6 + i * 0.8;
        occupied.box(1.1 - i * 0.15, 0.8 - i * 0.15, 0.8, sx, at(sx, sz) - 0.05, sz, 0x6a5236, 0.5 + i);
      }
      for (let i = 0; i < 1 + c.size; i++) {
        const sx = stx - 0.6 + rand() * 1.6, sz = stz + 0.7 + rand() * 0.9;
        occupied.lump(0.32, sx, at(sx, sz) + 0.22, sz, SACK, 1, 0.75 + rand() * 0.3, 1.2, 1, 0.12, [0, rand() * 3, 0]);
      }
      for (let i = 0; i < (c.size >= 2 ? 2 : 1); i++) {
        const sx = stx + 1.2 + i * 0.75, sz = stz - 0.4, sy = at(sx, sz) - 0.03;
        occupied.cyl(0.3, 0.27, 0.8, sx, sy, sz, 0x6a4a2c, 10);
        for (const hh of [0.15, 0.62]) occupied.cyl(0.31, 0.31, 0.05, sx, sy + hh, sz, 0x2e2a26, 10);
      }
      for (let i = 0; i < 3 + c.size * 2; i++) {
        const bx = ox + (rand() - 0.5) * 7, bz = oz + (rand() - 0.5) * 7;
        occupied.box(0.5, 0.07, 0.08, bx, at(bx, bz) + 0.02, bz, BONE, rand() * 3);
      }
      if (c.size === 4) taken.push([c.x + 6, c.z + 6, 2.4]); // (the watch-platform, below)
      { // firewood, stacked
        const w = spot(1.1, fr + 3, fr + 5.5);
        if (w) for (let k = 0; k < 6; k++) { const a = rand() * 0.3, sy = at(w[0], w[1]) + 0.12 + Math.floor(k / 3) * 0.2, o = (k % 3 - 1) * 0.22; rod(occupied, w[0] - Math.cos(a) * 0.7 - Math.sin(a) * o, sy, w[1] - Math.sin(a) * 0.7 + Math.cos(a) * o, w[0] + Math.cos(a) * 0.7 - Math.sin(a) * o, sy, w[1] + Math.sin(a) * 0.7 + Math.cos(a) * o, 0.1, k % 2 ? LOG : 0x6a5238, 5); }
      }
      if (c.size >= 2) { // a rack of hides drying
        const w = spot(1.4, 4.5, 8 + c.size);
        if (w) {
          const a = rand() * 6.28, kx = Math.cos(a) * 1.1, kz = Math.sin(a) * 1.1, gy = at(w[0], w[1]);
          for (const s of [-1, 1]) rod(occupied, w[0] + kx * s, gy - 0.1, w[1] + kz * s, w[0] + kx * s, gy + 1.7, w[1] + kz * s, 0.04, POLE, 4);
          rod(occupied, w[0] - kx * 1.1, gy + 1.65, w[1] - kz * 1.1, w[0] + kx * 1.1, gy + 1.65, w[1] + kz * 1.1, 0.03, POLE, 4);
          for (const s of [-0.45, 0.45]) occupied.box(0.04, 1.1, 0.8, w[0] + kx * s, gy + 0.5, w[1] + kz * s, HIDES[Math.floor(rand() * HIDES.length)], Math.PI / 2 - a, 0.08);
        }
      }
      if (c.size >= 3) { // a rack of spears
        const w = spot(1.2, 4.5, 9 + c.size);
        if (w) {
          const a = rand() * 6.28, kx = Math.cos(a) * 0.9, kz = Math.sin(a) * 0.9, gy = at(w[0], w[1]);
          for (const s of [-1, 1]) rod(occupied, w[0] + kx * s, gy - 0.1, w[1] + kz * s, w[0] + kx * s, gy + 1.1, w[1] + kz * s, 0.045, POLE, 4);
          rod(occupied, w[0] - kx, gy + 1.05, w[1] - kz, w[0] + kx, gy + 1.05, w[1] + kz, 0.035, POLE, 4);
          for (let k = 0; k < 4; k++) {
            const t = -0.75 + k * 0.5, bx = w[0] + kx * t + Math.sin(a) * 0.35, bz = w[1] + kz * t - Math.cos(a) * 0.35;
            rod(occupied, bx, gy, bz, w[0] + kx * t, gy + 2.2, w[1] + kz * t, 0.022, 0x4a3a2a, 3);
            rod(occupied, w[0] + kx * t, gy + 2.2, w[1] + kz * t, w[0] + kx * t - Math.sin(a) * 0.04, gy + 2.45, w[1] + kz * t + Math.cos(a) * 0.04, 0.035, 0x5a5a5e, 4, 0.002);
          }
        }
      }

      // Shelters of hide (since v0.8, ridge tents and round ones, with a door toward the fire),
      // more of them the larger the camp; solid to all, and folding into the ground when it is broken.
      const shelters = c.kind === 'mine' ? c.size - 1 : [2, 3, 5, 12][c.size - 1] + (R && c.size < 3 ? 1 : 0);
      const lo = facing === null ? fr + 4 : 3.5, hi = facing === null ? (R ? R - 2.4 : 6.5 + c.size * 1.6) : 6;
      const pitched = []; // { start, end, gy, circles }: each shelter's run of vertices in the mesh
      tents.kind = SURF.cloth;
      for (let i = 0; i < shelters; i++) {
        const round = c.size >= 3 && (i === 0 || rand() < 0.22);
        const L = 3.2 + rand() * 1.3, W = 1.25 + rand() * 0.45, H = 1.8 + rand() * 0.5, RR = 1.7 + rand() * 0.5 + (i === 0 && c.size >= 3 ? 0.4 : 0);
        const w = spot(round ? RR + 0.4 : L / 2 + 0.5, lo, Math.max(lo + 1, hi));
        if (!w) continue;
        const toFire = Math.atan2(fz - w[1], fx - w[0]), hide = HIDES[Math.floor(rand() * HIDES.length)];
        const start = tents.p.length / 3;
        const t = round ? roundTent(tents, w[0], w[1], toFire, RR, 2.6 + rand() * 0.6, hide, rand) : ridgeTent(tents, w[0], w[1], toFire + (rand() - 0.5) * 0.4, L, W, H, hide, rand);
        pitched.push({ start, end: tents.p.length / 3, gy: t.gy, circles: t.circles });
        if (!wasBroken) for (const [x, z, r] of t.circles) addCircle(x, z, r, 'tent', 'tent:' + c.id);
      }
      tents.kind = SURF.wood;

      const knocked = []; // stakes that lie on the ground once the stockade is broken
      // A stockade of sharpened stakes, round every stockade and war-camp, and
      // (since v0.6) round every province's hold, even where the hold is only a band;
      // (since v0.8) two rows of them, the inner set between the outer, round a war-camp.
      if (R) {
        const downRand = rng(Math.round(c.x * 3 + c.z));
        for (const [ring, shift] of c.size === 4 ? [[R, 0], [R - 1.3, 0.5]] : [[R, 0]]) {
          for (let a = (shift * 0.98) / ring; a < 6.28; a += 0.98 / ring) {
            // three gates, so the company inside can come out at whoever troubles them
            let off = (((a - gate) % 2.094) + 2.094) % 2.094; off = Math.min(off, 2.094 - off);
            if (off < 2.2 / R || rand() < 0.06) continue;
            const sx = c.x + Math.cos(a) * ring, sz = c.z + Math.sin(a) * ring, sy = at(sx, sz);
            const h = (ring < R ? 2.1 : 2.5) + rand() * 0.6, lx = (rand() - 0.5) * 0.2, lz = (rand() - 0.5) * 0.2;
            // (since v0.7.7) about half of them are knocked flat when the stockade falls
            const down = downRand() < 0.5;
            (down ? occupied : always).cyl(0, 0.17, h, sx, sy - 0.2, sz, STAKE, 6, lx, lz);
            if (down) {
              const fall = downRand() < 0.5 ? 1 : -1, across = downRand() < 0.5;
              knocked.push({ h, x: sx + (across ? 0 : fall * h * 0.45), z: sz + (across ? fall * h * 0.45 : 0), y: at(sx, sz), rx: across ? fall * Math.PI / 2 : 0, rz: across ? 0 : -fall * Math.PI / 2 });
              if (!wasBroken) addCircle(sx, sz, 0.42, 'stake', 'down:' + c.id);
            } else addCircle(sx, sz, 0.42, 'stake'); // stops the ranger; the camp's own company slips between
          }
        }
        if (c.size === 4) { // and a watch-platform over a war-camp
          const tx = c.x + 6, tz = c.z + 6, ty = at(tx, tz);
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) occupied.box(0.22, 6, 0.22, tx + dx * 1.2, ty - 0.2, tz + dz * 1.2, STAKE);
          occupied.box(3, 0.2, 3, tx, ty + 5.6, tz, 0x5a4530);
          occupied.box(0.1, 2.4, 0.1, tx, ty + 5.8, tz, 0x3a3028);
          occupied.box(0.06, 1.2, 1.6, tx, ty + 7, tz + 0.85, RAG);
        }
      }

      const cleared = new GeoBuilder(Math.round(c.x) + 1, 0.06); // a ranger's marker
      cleared.box(0.1, 3, 0.1, px, py - 0.2, pz, 0x6e5236);
      cleared.box(0.04, 0.7, 1.2, px, py + 2, pz + 0.65, 0xf2f0e6);
      cleared.box(0.05, 0.35, 0.35, px, py + 2.2, pz + 0.6, 0x3f6b3a);
      for (const k of knocked) cleared.cyl(0, 0.17, k.h, k.x, k.y - k.h / 2 + 0.12, k.z, STAKE, 6, k.rx, k.rz); // (lying where they fell)
      { // and in the cold fire ring, beside the dead logs, flowers come up already (since v0.7.7)
        cleared.kind = SURF.leaf;
        const ox = fx + 0.48, oz = fz - 0.3;
        for (const [dx, dz, hh, col] of [[0, 0, 0.55, 0xf4f0e2], [0.18, 0.12, 0.42, 0xf2d24a], [-0.14, 0.16, 0.48, 0xf4f0e2], [0.06, -0.17, 0.36, 0xe8a0c8]]) {
          cleared.cyl(0.016, 0.022, hh, ox + dx, y - 0.02, oz + dz, 0x5f8a42, 4);
          cleared.kind = SURF.plain;
          for (let p = 0; p < 6; p++) { const a = p * 1.047; cleared.blob(0.055, ox + dx + Math.cos(a) * 0.07, y + hh + 0.01, oz + dz + Math.sin(a) * 0.07, col, 1.2, 0.4, 1.2); }
          cleared.blob(0.045, ox + dx, y + hh + 0.03, oz + dz, 0xe0a020, 1, 0.7, 1);
          cleared.kind = SURF.leaf;
        }
        for (let l = 0; l < 5; l++) { const a = l * 1.256 + 0.4; cleared.tri(ox, y + 0.02, oz, ox + Math.cos(a) * 0.32 - Math.sin(a) * 0.08, y + 0.12, oz + Math.sin(a) * 0.32 + Math.cos(a) * 0.08, ox + Math.cos(a) * 0.32 + Math.sin(a) * 0.08, y + 0.12, oz + Math.sin(a) * 0.32 - Math.cos(a) * 0.08, 0x5f8a42); }
        cleared.kind = SURF.wood;
      }

      const site = {
        ...c, y, fire: { x: fx, y, z: fz }, big,
        occupied: occupied.mesh(materials.wood), cleared: cleared.mesh(materials.wood),
        pitched,
        strength: wasBroken ? 0 : 1, // 1 = blighted, eases to 0 once broken up
        isCleared: isCleared(c.id), isBroken: wasBroken, fold: null, puff: 0,
      };
      // the flames: one, or for a great fire a tall one and a few about it
      site.flames = new THREE.Group();
      for (const [dx, dz, s] of c.size >= 4 ? [[0, 0, big * 1.25], [0.45, 0.2, big * 0.7], [-0.35, 0.35, big * 0.6], [-0.1, -0.45, big * 0.65]] : [[0, 0, big * (big > 1 ? 1.25 : 1)]]) {
        const f = new THREE.Mesh(flameGeo, flameMat);
        f.position.set(fx + dx, y + 0.55 * s + 0.15, fz + dz);
        f.scale.setScalar(s);
        f.userData.s = s;
        site.flames.add(f);
        if (big > 1 && s === big * 1.25) { // (a white-hot heart to the great fires)
          const inner = new THREE.Mesh(flameGeo, innerMat);
          inner.position.copy(f.position).y -= 0.15 * s;
          inner.scale.setScalar(s * 0.55);
          inner.userData.s = s * 0.55;
          site.flames.add(inner);
        }
      }
      site.flame = site.flames.children[0];
      site.always = always.mesh(materials.wood);
      site.near = true;
      scene.add(site.always, site.occupied, site.cleared, site.flames);
      this.show(site);
      return site;
    });
    this.byId = Object.fromEntries(this.sites.map((s) => [s.id, s]));
    this.strength = (id) => this.byId[id].strength;

    // Smoke: a thin column over each lit fire nearby, standing above the trees,
    // so a camp can be found by looking for it.
    const n = SMOKE_PER_CAMP * SMOKE_CAMPS;
    this.smokePos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(cv), size: 15, color: 0xd9d4cc, transparent: true, opacity: 0.6, depthWrite: false, fog: false,
    }));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 7;
    scene.add(this.smoke);
    this.smokeTick = 0;
    this.smoking = [];
  }

  /** The last of its company has fallen. (It stands until the ranger breaks it up.) */
  clear(id) {
    this.byId[id].isCleared = true;
  }

  /**
   * (since v0.8) The ranger breaks the camp up: the shelters fold down into the
   * ground one after another, the fire is put out (a last breath of smoke), half
   * the stakes are knocked flat, and the land begins to heal.
   */
  breakUp(id) {
    const s = this.byId[id];
    if (s.isBroken) return;
    s.isCleared = s.isBroken = true;
    removeCircles('down:' + id); // the stakes knocked flat stop no one
    removeCircles('tent:' + id);
    if (s.pitched.length) s.fold = { t: 0, rest: Float32Array.from(s.occupied.geometry.attributes.position.array) };
    s.puff = 4;
    s.flames.visible = false;
    if (!s.fold) this.show(s);
  }

  /** The camp nearest (x, z) whose company is dead but which still stands, if the ranger is near enough to break it up. */
  standingNear(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.sites) {
      if (!s.isCleared || s.isBroken) continue;
      const d = Math.min(Math.hypot(s.fire.x - x, s.fire.z - z), Math.hypot(s.x - x, s.z - z));
      if (d < Math.max(BREAK_REACH, stockadeRadius(s) + 3) && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  show(s) {
    const standing = !s.isBroken || !!s.fold; // (while they fold, the camp is still standing about them)
    s.always.visible = s.near;
    s.occupied.visible = s.near && standing;
    s.flames.visible = s.near && !s.isBroken;
    s.cleared.visible = s.near && !standing;
  }

  /** The shelters of a camp being broken up fold down, one after another, and sink. */
  folding(s, dt) {
    const f = s.fold;
    f.t += dt;
    const pos = s.occupied.geometry.attributes.position, a = pos.array, rest = f.rest;
    let done = true;
    s.pitched.forEach((t, i) => {
      const k = Math.min(1, Math.max(0, (f.t - i * FOLD_GAP) / FOLD));
      if (k < 1) done = false;
      const e = k * k * (3 - 2 * k), squash = Math.max(0.02, 1 - e), sink = e * 0.35;
      for (let v = t.start; v < t.end; v++) {
        const o = v * 3;
        a[o + 1] = t.gy + (rest[o + 1] - t.gy) * squash - sink;
      }
    });
    pos.needsUpdate = true;
    if (done) { s.fold = null; this.show(s); }
  }

  /** Let the land heal after a camp is broken up; keep the fires burning and smoking at the others. */
  update(dt, time = 0, px = 0, pz = 0) {
    for (const s of this.sites) {
      if (s.isBroken && s.strength > 0) s.strength = Math.max(0, s.strength - dt / 6);
      if (s.fold) this.folding(s, dt);
      if (s.puff > 0) s.puff = Math.max(0, s.puff - dt);
    }
    // the dry, trodden ground of the nearest camps (since v0.7.7), greening as each heals (strength 1 -> 0 over 6 s)
    this.tintTick = (this.tintTick ?? 0) - dt;
    const moved = !this.tintAt || Math.abs(px - this.tintAt.x) + Math.abs(pz - this.tintAt.z) > 30; // (a teleport, or a long run)
    if (!(this.tintTick > 0) || !this.tinted || moved) { // (also on the first call, and after a strange dt)
      this.tintTick = 0.5;
      if (moved) this.smokeTick = 0; // (and which camps are near enough to draw: at once after a teleport)
      this.tintAt = { x: px, z: pz };
      this.tinted = this.sites.filter((s) => s.strength > 0 && Math.abs(s.x - px) < 250 && Math.abs(s.z - pz) < 250)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, CAMP_TINTS);
    }
    const tints = surfaceUniforms.uCamps.value;
    for (let k = 0; k < CAMP_TINTS; k++) {
      const s = this.tinted[k];
      if (s) tints[k].set(s.x, s.z, [0, 12, 15, 19, 25][s.size] ?? 14, s.strength); else tints[k].set(0, 0, 0, 0);
    }
    surfaceUniforms.uCampN.value = this.tinted.length;
    this.smokeTick -= dt;
    if (this.smokeTick <= 0) { // now and then, choose the nearest lit fires, and draw only the camps near enough to see
      this.smokeTick = 1.5;
      for (const s of this.sites) {
        const d = Math.hypot(s.x - px, s.z - pz), near = s.near ? d < CAMP_SEEN + 30 : d < CAMP_SEEN;
        if (near !== s.near) { s.near = near; this.show(s); }
      }
      this.smoking = this.sites.filter((s) => (!s.isBroken || s.puff > 0) && Math.abs(s.x - px) < SMOKE_RANGE && Math.abs(s.z - pz) < SMOKE_RANGE)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, SMOKE_CAMPS);
    }
    const p = this.smokePos;
    for (let k = 0; k < SMOKE_CAMPS; k++) {
      const s = this.smoking[k];
      for (let i = 0; i < SMOKE_PER_CAMP; i++) {
        const o = (k * SMOKE_PER_CAMP + i) * 3;
        if (!s) { p[o + 1] = -1000; continue; }
        const life = (time * 0.06 + i / SMOKE_PER_CAMP + (s.x % 7) * 0.1) % 1; // 0 at the fire, 1 at the top
        // a fire put out gives a last breath of smoke, which thins away from the bottom up
        if (s.isBroken && (s.puff <= 0 || life < 1 - s.puff / 4)) { p[o + 1] = -1000; continue; }
        const wide = s.big ?? 1;
        p[o] = s.fire.x + life * life * 9 + Math.sin(time * 0.4 + i) * life * 2 * wide;      // leaning down the wind
        p[o + 1] = s.fire.y + 1.5 + life * 58; // well above the tallest trees
        p[o + 2] = s.fire.z + Math.cos(time * 0.3 + i * 2) * life * 2 * wide;
      }
      if (s && !s.isBroken) for (const f of s.flames.children) f.scale.setScalar(f.userData.s * (0.85 + 0.25 * Math.sin(time * 11 + s.x + f.position.x * 7)));
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
  }
}

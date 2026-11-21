// The old works of Gondor scattered through Ithilien, and the larger landmarks.
// Everything is weathered pale stone built from simple blocks.

import * as THREE from 'three';
import { LANDMARKS, CAIR_ANDROS, bankX, southRoadZ } from './layout.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { ATLAS } from './surface.js';
import { addRock } from './rocks.js';
import { plantTrees } from './vegetation.js';
import { rng } from '../util/noise.js';

export const STONE = 0xc9c1aa, WORN = 0xa8a08c, MOSS = 0x7f8f5a, DARK = 0x4b484c;
/** Old stone gone grey with weather (not green: the moss is laid on by the surface, on top). */
export const AGED = 0x9d9a86;
const IVY = 0x4f7a34;

const _M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

/** A fluted shaft with a slight swell (entasis), standing on its base at y. */
function shaft(b, r, h, x, y, z, color, broken = 0) {
  const g = new THREE.CylinderGeometry(r * 0.88, r, h, 24, Math.max(2, Math.round(h / 0.6)), false);
  const pos = g.attributes.position, seed = b.rand() * 10;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), rad = Math.hypot(px, pz);
    if (rad < 1e-4) { // the cap's centre: a broken shaft has a jagged top
      if (broken && py > 0) pos.setY(i, py - broken * 0.5);
      continue;
    }
    const a = Math.atan2(pz, px), t = py / h + 0.5;
    let k = 1 - 0.07 * Math.pow(Math.abs(Math.sin(a * 10)), 0.6);          // twenty flutes
    k *= 1 + 0.035 * Math.sin(Math.min(1, t) * Math.PI * 0.9);              // entasis
    k *= 1 - 0.04 * Math.max(0, Math.sin(a * 3 + seed) * Math.sin(t * 7 + seed)); // weathering
    let yy = py;
    if (broken && py > h / 2 - 1e-4) yy -= broken * (0.5 + 0.5 * Math.sin(a * 2 + seed)) * (0.6 + 0.4 * Math.sin(a * 5));
    pos.setXYZ(i, px * k, yy, pz * k);
  }
  g.computeVertexNormals();
  b.add(g, color, _M(x, y + h / 2, z), true);
}

/** A standing or broken column; returns nothing, registers its collider. */
export function column(b, x, z, y, h, r = 0.55, capital = true) {
  const k = b.kind;
  b.kind = SURF.masonry;
  b.box(r * 2.7, 0.22, r * 2.7, x, y, z, WORN);                                       // plinth
  b.add(new THREE.TorusGeometry(r * 1.04, r * 0.16, 6, 20), WORN, _M(x, y + 0.3, z, Math.PI / 2, 0, 0), true); // torus moulding
  b.cyl(r * 1.05, r * 1.18, 0.14, x, y + 0.22, z, WORN, 20);
  b.kind = SURF.plain;
  shaft(b, r, h, x, y + 0.36, z, STONE, capital ? 0 : 0.35 + b.rand() * 0.4);
  b.kind = SURF.masonry;
  if (capital) {
    b.add(new THREE.LatheGeometry([[r * 0.88, 0], [r * 1.0, 0.06], [r * 1.25, 0.2], [r * 1.32, 0.28]].map(([a, c]) => new THREE.Vector2(a, c)), 20), STONE, _M(x, y + 0.36 + h, z), true); // echinus
    b.box(r * 2.8, 0.26, r * 2.8, x, y + 0.36 + h + 0.28, z, STONE);                  // abacus
  }
  b.kind = k;
  addCircle(x, z, r * 1.3);
}
export function fallenColumn(b, x, z, y, len, ry, r = 0.5) {
  // lying in two or three drums, knocked a little askew as they fell
  const n = 2 + Math.floor(b.rand() * 2), dl = len / n;
  const k = b.kind;
  b.kind = SURF.plain;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * dl, wob = (b.rand() - 0.5) * 0.25;
    const g = new THREE.CylinderGeometry(r * 0.9, r, dl - 0.06, 20, 1);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const px = pos.getX(v), pz = pos.getZ(v), rad = Math.hypot(px, pz);
      if (rad < 1e-4) continue;
      const a = Math.atan2(pz, px), kk = 1 - 0.07 * Math.pow(Math.abs(Math.sin(a * 10)), 0.6);
      pos.setX(v, px * kk); pos.setZ(v, pz * kk);
    }
    g.computeVertexNormals();
    const m = new THREE.Matrix4().makeRotationY(ry + wob).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2 + wob * 0.3));
    m.setPosition(x + Math.cos(ry) * off, y + r * 0.8, z - Math.sin(ry) * off);
    b.add(g, WORN, m, true);
  }
  b.kind = k;
  addCircle(x, z, r * 1.2);
}

/**
 * Ashlar masonry, w x h x d, standing on y (blocks the player). The top is not
 * a straight line: the courses have fallen away unevenly. Ivy may climb it.
 */
export function wall(b, x, z, y, w, h, d, color = STONE, collide = true) {
  const long = w >= d, len = long ? w : d, thick = long ? d : w;
  const k = b.kind;
  b.kind = SURF.masonry;
  // the core, then a broken top in runs of a metre or so
  const core = Math.max(0.3, h - 0.45);
  b.box(w, core + 0.5, d, x, y - 0.8, z, color); // buried a little, for sloping ground
  const runs = Math.max(1, Math.round(len / (0.8 + b.rand() * 0.5)));
  for (let i = 0; i < runs; i++) {
    const seg = len / runs, o = -len / 2 + seg * (i + 0.5);
    const top = h - (b.rand() < 0.35 ? b.rand() * 0.45 : 0) - core;
    if (top <= 0.05) continue;
    const sw = seg + (b.rand() - 0.5) * 0.1, inset = (b.rand() - 0.5) * 0.06;
    const c = b.rand() < 0.2 ? WORN : color;
    if (long) b.box(sw, top, thick + inset, x + o, y - 0.3 + core - 0.001, z, c, (b.rand() - 0.5) * 0.03);
    else b.box(thick + inset, top, sw, x, y - 0.3 + core - 0.001, z + o, c, (b.rand() - 0.5) * 0.03);
  }
  // a block or two fallen at the foot
  if (b.rand() < 0.5) {
    const side = b.rand() < 0.5 ? -1 : 1, o = (b.rand() - 0.5) * len * 0.8;
    const bx = long ? x + o : x + side * (thick / 2 + 0.5), bz = long ? z + side * (thick / 2 + 0.5) : z + o;
    b.box(0.6, 0.35, 0.4, bx, heightAt(bx, bz) - 0.05, bz, WORN, b.rand() * 3, (b.rand() - 0.5) * 0.3, (b.rand() - 0.5) * 0.3);
  }
  // ivy, from the ground up one face
  if (h > 1.2 && b.rand() < 0.55) {
    const side = b.rand() < 0.5 ? -1 : 1, o = (b.rand() - 0.5) * len * 0.6, iw = 0.9 + b.rand() * 1.4, ih = Math.min(h, 0.8 + b.rand() * h);
    const nx = long ? 0 : side, nz = long ? side : 0;
    const cx = long ? x + o : x + side * (thick / 2 + 0.03), cz = long ? z + side * (thick / 2 + 0.03) : z + o;
    for (let j = 0; j < 3; j++) {
      const jx = long ? (b.rand() - 0.5) * iw * 0.6 : 0, jz = long ? 0 : (b.rand() - 0.5) * iw * 0.6;
      b.card(cx + jx + nx * j * 0.01, y + ih * (0.3 + j * 0.25), cz + jz + nz * j * 0.01, iw, ih * 0.7, nx, 0, nz, j % 2 ? IVY : 0x5a8a3c, ATLAS.ivy, b.rand() * 6.28, [nx, 0.4, nz]);
    }
  }
  b.kind = k;
  if (collide) addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y - 2, top: y - 0.3 + h });
}

/** An arch of wedge-shaped stones over a span, rising `rise` above the springing at y. */
export function archStones(b, cx, y, cz, span, rise, depth, thick, n, ry = 0, color = STONE) {
  const R = span / 2;
  for (let i = 0; i < n; i++) {
    if (b.missing && b.missing(i)) continue;
    const a0 = Math.PI - (i / n) * Math.PI, a1 = Math.PI - ((i + 1) / n) * Math.PI;
    // a wedge: inner and outer arcs between the two angles, extruded through the depth
    const pts = [];
    for (const a of [a0, a1]) {
      pts.push([Math.cos(a) * R, Math.sin(a) * rise]);
      pts.push([Math.cos(a) * (R + thick), Math.sin(a) * (rise + thick)]);
    }
    const shape = new THREE.Shape([new THREE.Vector2(...pts[0]), new THREE.Vector2(...pts[1]), new THREE.Vector2(...pts[3]), new THREE.Vector2(...pts[2])]);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, y, cz).multiply(new THREE.Matrix4().makeTranslation(0, 0, -depth / 2));
    b.add(g, i % 4 === 1 ? AGED : (i === Math.floor(n / 2) ? WORN : color), m, false);
  }
}

export function rubble(b, rand, x, z, n, spread) {
  for (let i = 0; i < n; i++) {
    const rx = x + (rand() - 0.5) * spread, rz = z + (rand() - 0.5) * spread;
    const s = 0.35 + rand() * 0.65;
    // fallen ashlar, chipped at the edges
    addRock(b, rx, heightAt(rx, rz) - 0.12, rz, s * 1.4, rand() < 0.3 ? AGED : WORN, Math.floor(rand() * 1e5), { detail: 1, sx: 1.25, sy: 0.6, sz: 0.85, cuts: 9, rough: 0.08, tilt: 0.4 });
  }
}

const KINDS = {
  arch(b, l, y, rand) {
    for (const s of [-1, 1]) {
      wall(b, l.x + s * 2.4, l.z, y, 1.3, 4.0, 1.3, STONE, false);
      b.box(1.5, 0.25, 1.45, l.x + s * 2.4, y + 3.55, l.z, WORN); // the impost
      addCircle(l.x + s * 2.4, l.z, 0.85);
    }
    b.kind = SURF.masonry;
    archStones(b, l.x, y + 3.6, l.z, 3.5, 1.9, 1.2, 0.8, 9);
    b.kind = 0;
    rubble(b, rand, l.x, l.z + 3, 7, 9);
  },

  tower(b, l, y, rand) {
    const R = 5.2, N = 12;
    for (let i = 0; i < N; i++) {
      if (i === 3) continue; // the doorway
      const a = (i / N) * Math.PI * 2;
      const h = 2 + Math.max(0, Math.sin(a * 1.1 + 1)) * 6.5 + rand() * 1.2;
      const x = l.x + Math.cos(a) * R, z = l.z + Math.sin(a) * R;
      b.box(2.9, h, 1.3, x, y - 0.4, z, i % 4 === 0 ? WORN : STONE, -a + Math.PI / 2);
      // the top of each stretch is broken back in steps
      for (let k = 0; k < 2; k++) if (rand() < 0.7) b.box(1.2 + rand() * 0.6, 0.4 + rand() * 0.7, 1.3, x + Math.cos(a + 1.57) * (k - 0.5) * 1.2, y - 0.4 + h, z + Math.sin(a + 1.57) * (k - 0.5) * 1.2, i % 3 ? STONE : WORN, -a + Math.PI / 2);
      if (rand() < 0.5) { // ivy up the outside
        const ih = 1.5 + rand() * Math.min(5, h);
        b.card(x + Math.cos(a) * 0.7, y + ih / 2, z + Math.sin(a) * 0.7, 2.2, ih, Math.cos(a), 0, Math.sin(a), 0x4f7a34, ATLAS.ivy, rand() * 6, [Math.cos(a), 0.4, Math.sin(a)]);
      }
      addCircle(x, z, 1.25);
    }
    b.cyl(R + 1.2, R + 1.6, 0.3, l.x, y - 0.25, l.z, WORN, 12);
    rubble(b, rand, l.x, l.z, 12, 16);
  },

  colonnade(b, l, y, rand) {
    b.box(34, 0.2, 7, l.x, y - 0.12, l.z, WORN);
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const x = l.x - 15 + i * 5, z = l.z + s * 3.4, roll = rand();
        if (roll < 0.4) column(b, x, z, y, 5);
        else if (roll < 0.7) column(b, x, z, y, 0.8 + rand() * 1.6, 0.55, false);
        else fallenColumn(b, x + (rand() - 0.5) * 2, z + s * (2.5 + rand() * 2), y, 4.5, rand() * 3);
      }
    }
    b.box(5.4, 0.5, 1.2, l.x - 15, y + 5.7, l.z + 3.4, STONE);
    rubble(b, rand, l.x, l.z, 10, 30);
  },

  bridge(b, l, y, rand) {
    // The stream runs east-west here; the old bridge crossed north-south.
    for (const s of [-1, 1]) {
      const az = l.z + s * 11, ay = heightAt(l.x, az);
      b.box(4.4, 3.2, 4, l.x, ay - 1.4, az, STONE);
      addSolid({ minX: l.x - 2.2, maxX: l.x + 2.2, minZ: az - 2, maxZ: az + 2, bottom: ay - 3, top: ay + 1.8 });
      const pz = l.z + s * 3.6, py = heightAt(l.x, pz);
      b.box(3.6, 3.6 + s * 0.8, 1.8, l.x, py - 0.5, pz, WORN);
      addCircle(l.x, pz, 1.5);
      b.box(4.2, 0.7, 3.4, l.x, ay + 1.8, az - s * 2.6, STONE, 0, s * 0.25); // stub of the span
    }
    rubble(b, rand, l.x - 4, l.z, 9, 14);
  },

  shrine(b, l, y, rand) {
    b.box(9, 0.45, 9, l.x, y - 0.05, l.z, WORN);
    addSolid({ minX: l.x - 4.5, maxX: l.x + 4.5, minZ: l.z - 4.5, maxZ: l.z + 4.5, bottom: y - 2, top: y + 0.4 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      column(b, l.x + sx * 3.7, l.z + sz * 3.7, y + 0.4, sx * sz > 0 ? 4.2 : 2.2 + rand(), 0.45, sx * sz > 0);
    }
    b.box(1.6, 1.1, 1, l.x, y + 0.4, l.z - 1.5, STONE);          // the offering stone
    b.box(1.8, 0.14, 1.2, l.x, y + 1.5, l.z - 1.5, WORN);
    addCircle(l.x, l.z - 1.5, 1);
    b.box(7.4, 1.3, 0.6, l.x, y + 0.4, l.z - 4.1, STONE);        // low back wall
    rubble(b, rand, l.x, l.z + 6, 6, 10);
  },

  stair(b, l, y, rand) {
    // Twelve steps climbing east to a landing: a place to look out from.
    const steps = 12, rise = 0.45, run = 0.9, w = 3.2;
    for (let i = 0; i < steps; i++) {
      const x0 = l.x - 6 + i * run, top = y + (i + 1) * rise;
      b.box(run + 0.02, (i + 1) * rise + 0.5, w, x0 + run / 2, y - 0.5, l.z, i % 5 === 2 ? AGED : STONE);
      addSolid({ minX: x0, maxX: x0 + run, minZ: l.z - w / 2, maxZ: l.z + w / 2, bottom: y - 2, top });
    }
    const lx = l.x - 6 + steps * run, top = y + steps * rise;
    b.box(4.4, top - y + 0.5, 4.4, lx + 2.2, y - 0.5, l.z, STONE);
    addSolid({ minX: lx, maxX: lx + 4.4, minZ: l.z - 2.2, maxZ: l.z + 2.2, bottom: y - 2, top });
    b.box(0.5, 1.6, 0.5, lx + 4.1, top, l.z - 1.9, WORN);
    b.box(0.5, 0.7, 0.5, lx + 4.1, top, l.z + 1.9, WORN);
    rubble(b, rand, lx + 5, l.z, 10, 10);
  },

  fountain(b, l, y, rand) {
    b.cyl(9.5, 9.8, 0.25, l.x, y - 0.18, l.z, WORN, 16);
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) continue; // four ways in
      const a = (i / 16) * Math.PI * 2, x = l.x + Math.cos(a) * 9, z = l.z + Math.sin(a) * 9;
      b.box(3.3, 0.7 + (i % 3) * 0.25, 0.6, x, y, z, i % 5 === 1 ? AGED : STONE, -a + Math.PI / 2);
      addCircle(x, z, 1);
    }
    b.cyl(2.5, 2.7, 0.75, l.x, y, l.z, STONE, 12);
    b.cyl(2.1, 2.1, 0.06, l.x, y + 0.5, l.z, 0xa58f58, 12); // drifted leaves, not water
    b.cyl(0.3, 0.45, 2.2, l.x, y + 0.5, l.z, STONE, 8);
    b.cyl(0.9, 0.2, 0.3, l.x, y + 2.7, l.z, STONE, 8);
    addCircle(l.x, l.z, 2.7);
    for (const a of [0.8, 2.4, 3.9, 5.5]) b.box(2, 0.45, 0.6, l.x + Math.cos(a) * 5.5, y, l.z + Math.sin(a) * 5.5, WORN, -a + Math.PI / 2);
  },

  crossroads(b, l, y, rand, scene) {
    // The old king sits again upon his plinth, crowned with flowers.
    const kx = l.x + 7, kz = l.z - 7;
    b.box(3.4, 2.2, 3.4, kx, y - 0.2, kz, STONE);
    addSolid({ minX: kx - 1.7, maxX: kx + 1.7, minZ: kz - 1.7, maxZ: kz + 1.7, bottom: y - 2, top: y + 2 });
    b.box(2.2, 1.3, 2.0, kx, y + 2, kz, WORN);               // throne and lap
    b.box(2.4, 2.6, 0.6, kx, y + 2, kz - 0.9, WORN);         // throne back
    b.box(1.5, 1.7, 0.9, kx, y + 3.3, kz - 0.2, STONE);      // torso
    b.box(0.5, 1.2, 1.3, kx - 0.6, y + 2.6, kz + 0.6, STONE); // legs
    b.box(0.5, 1.2, 1.3, kx + 0.6, y + 2.6, kz + 0.6, STONE);
    b.box(0.8, 0.9, 0.8, kx, y + 5.0, kz - 0.15, STONE);     // head
    for (let i = 0; i < 9; i++) {                             // the crown of flowers
      const a = (i / 9) * Math.PI * 2;
      b.blob(0.16, kx + Math.cos(a) * 0.48, y + 5.95, kz - 0.15 + Math.sin(a) * 0.48, i % 2 ? 0xfff4c2 : 0xffffff);
    }
    // the ring of great trees
    const trees = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.22;
      trees.push({ x: l.x + Math.cos(a) * 34, z: l.z + Math.sin(a) * 34, scale: 1.15 + (i % 3) * 0.1 });
    }
    const planted = plantTrees('greatOak', trees);
    scene.add(planted.mesh);
    for (const c of planted.circles) addCircle(c.x, c.z, c.r);
  },

  osgiliath(b, l, y, rand) {
    // Roofless houses in rough rows either side of the road, and the bridge-head.
    const roadZ = southRoadZ(l.x);
    for (let i = 0; i < 34; i++) {
      const x = l.x - 75 + rand() * 150, z = l.z - 75 + rand() * 150;
      if (Math.abs(z - roadZ) < 9 || Math.hypot(x - l.x, z - l.z) > 80) continue;
      const gy = heightAt(x, z);
      if (gy < 1.2) continue;
      const w = 6 + rand() * 7, d = 5 + rand() * 6, h = 2 + rand() * 6;
      wall(b, x, z - d / 2, gy, w, h, 0.9, rand() < 0.3 ? WORN : STONE);
      wall(b, x - w / 2, z, gy, 0.9, h * (0.4 + rand() * 0.6), d, STONE);
      if (rand() < 0.5) wall(b, x + w / 2, z + d * 0.2, gy, 0.9, h * 0.5, d * 0.6, WORN);
      if (rand() < 0.35) column(b, x + 1, z + d / 2 + 1.5, gy, 2 + rand() * 3, 0.5, rand() < 0.5);
    }
    // The bridge-head: a causeway running west into the river, then broken.
    const bx = bankX(roadZ);
    for (let i = 0; i < 4; i++) {
      const px = bx + 6 - i * 13;
      b.box(4, 9 + 3, 9, px, -6, roadZ, i === 3 ? WORN : STONE);
      if (i < 3) b.box(13.5, 1.2, 8, px - 6.5, 5.2, roadZ, STONE, 0, 0, i === 2 ? 0.12 : 0);
    }
    for (const s of [-1, 1]) {
      b.box(5, 13, 5, bx + 14, y - 1, roadZ + s * 8, STONE);   // gate towers
      addSolid({ minX: bx + 11.5, maxX: bx + 16.5, minZ: roadZ + s * 8 - 2.5, maxZ: roadZ + s * 8 + 2.5, bottom: y - 3, top: y + 12 });
    }
    rubble(b, rand, l.x, l.z, 40, 130);
  },

  morgul(b, l, y, rand) {
    // The rangers have barred the road with timber between two dark pillars.
    const gx = l.x + 34, gz = southRoadZ(gx), gy = heightAt(gx, gz);
    for (const s of [-1, 1]) {
      b.box(2.2, 9, 2.2, gx, gy - 0.5, gz + s * 7, DARK);
      b.cyl(0, 1.5, 2.4, gx, gy + 8.5, gz + s * 7, DARK, 4);
      addCircle(gx, gz + s * 7, 1.6);
    }
    for (let i = 0; i < 7; i++) b.box(0.35, 4.2, 0.35, gx - 1, gy - 0.3, gz - 5.4 + i * 1.8, 0x6a5238, 0, 0, i % 2 ? 0.5 : -0.5);
    b.box(0.3, 0.3, 12.5, gx - 1, gy + 1.9, gz, 0x5a4530);
    addSolid({ minX: gx - 2, maxX: gx, minZ: gz - 6, maxZ: gz + 6, bottom: gy - 2, top: gy + 3.5 });
    b.box(0.12, 4.6, 0.12, gx - 3, gy, gz - 3, 0x5a4530);        // a white pennant: "the King's peace holds here"
    b.box(0.05, 0.8, 1.5, gx - 3, gy + 3.7, gz - 2.2, 0xf2f0e6);
  },
};

export function buildRuins(scene) {
  for (const l of LANDMARKS) {
    const make = KINDS[l.kind];
    if (!make) continue;
    const b = new GeoBuilder(l.id.length * 97 + Math.round(l.x), 0.08);
    b.kind = SURF.masonry;
    make(b, l, heightAt(l.x, l.z), rng(Math.round(l.x * 7 + l.z)), scene);
    scene.add(b.mesh(materials.stone));
  }

  // Cair Andros: the fort on the island, seen across the water.
  const b = new GeoBuilder(3, 0.07);
  const c = CAIR_ANDROS, y = heightAt(c.x, c.z);
  b.box(26, 6, 60, c.x, y - 1, c.z, WORN);
  b.box(10, 13, 10, c.x, y - 1, c.z - 34, STONE);
  b.box(9, 10, 9, c.x, y - 1, c.z + 34, STONE);
  b.cyl(0, 7.5, 5, c.x, y + 12, c.z - 34, 0x7b6a5a, 4);
  scene.add(b.mesh(materials.stone));

  // A sickly light far up the Morgul Vale.
  const m = LANDMARKS.find((l) => l.id === 'morgul');
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(26, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x9fe0b0, transparent: true, opacity: 0.35, fog: false, depthWrite: false }),
  );
  glow.position.set(m.x + 300, heightAt(m.x + 300, m.z) + 45, m.z + 6);
  scene.add(glow);
}

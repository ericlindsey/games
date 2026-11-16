// The old works of Gondor scattered through Ithilien, and the larger landmarks.
// Everything is weathered pale stone built from simple blocks.

import * as THREE from 'three';
import { LANDMARKS, CAIR_ANDROS, bankX, southRoadZ } from './layout.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder } from './build.js';
import { plantTrees } from './vegetation.js';
import { rng } from '../util/noise.js';

const STONE = 0xd6cfba, WORN = 0xb5ae9a, MOSS = 0x8a9a62, DARK = 0x4b484c;

/** A standing or broken column; returns nothing, registers its collider. */
function column(b, x, z, y, h, r = 0.55, capital = true) {
  b.cyl(r * 1.25, r * 1.35, 0.35, x, y, z, WORN, 8);
  b.cyl(r * 0.9, r, h, x, y + 0.35, z, STONE, 8);
  if (capital) b.box(r * 2.6, 0.35, r * 2.6, x, y + 0.35 + h, z, STONE);
  else b.cyl(r * 0.5, r * 0.9, 0.3, x, y + 0.35 + h, z, WORN, 6);
  addCircle(x, z, r * 1.3);
}
function fallenColumn(b, x, z, y, len, ry, r = 0.5) {
  const m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  m.setPosition(x, y + r * 0.8, z);
  b.add(new THREE.CylinderGeometry(r * 0.9, r, len, 8), WORN, m);
  addCircle(x, z, r * 1.2);
}
/** A wall block that also blocks the player. */
function wall(b, x, z, y, w, h, d, color = STONE) {
  b.box(w, h, d, x, y - 0.3, z, color);
  addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y - 2, top: y - 0.3 + h });
}
function rubble(b, rand, x, z, n, spread) {
  for (let i = 0; i < n; i++) {
    const rx = x + (rand() - 0.5) * spread, rz = z + (rand() - 0.5) * spread;
    const s = 0.3 + rand() * 0.6;
    b.box(s * 1.4, s * 0.8, s, rx, heightAt(rx, rz) - 0.1, rz, rand() < 0.3 ? MOSS : WORN, rand() * 3, (rand() - 0.5) * 0.4);
  }
}

const KINDS = {
  arch(b, l, y, rand) {
    for (const s of [-1, 1]) {
      b.box(1.3, 4, 1.3, l.x + s * 2.4, y - 0.3, l.z, STONE);
      addCircle(l.x + s * 2.4, l.z, 0.85);
    }
    for (let i = 0; i <= 6; i++) { // voussoirs along a half circle
      const a = (i / 6) * Math.PI;
      b.box(1.35, 0.8, 1.2, l.x + Math.cos(a) * 2.4, y + 3.3 + Math.sin(a) * 2.1, l.z, i % 3 === 1 ? MOSS : STONE, 0, 0, a - Math.PI / 2);
    }
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
      b.box(run + 0.02, (i + 1) * rise + 0.5, w, x0 + run / 2, y - 0.5, l.z, i % 5 === 2 ? MOSS : STONE);
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
      b.box(3.3, 0.7 + (i % 3) * 0.25, 0.6, x, y, z, i % 5 === 1 ? MOSS : STONE, -a + Math.PI / 2);
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
    make(b, l, heightAt(l.x, l.z), rng(Math.round(l.x * 7 + l.z)), scene);
    scene.add(b.mesh());
  }

  // Cair Andros: the fort on the island, seen across the water.
  const b = new GeoBuilder(3, 0.07);
  const c = CAIR_ANDROS, y = heightAt(c.x, c.z);
  b.box(26, 6, 60, c.x, y - 1, c.z, WORN);
  b.box(10, 13, 10, c.x, y - 1, c.z - 34, STONE);
  b.box(9, 10, 9, c.x, y - 1, c.z + 34, STONE);
  b.cyl(0, 7.5, 5, c.x, y + 12, c.z - 34, 0x7b6a5a, 4);
  scene.add(b.mesh());

  // A sickly light far up the Morgul Vale.
  const m = LANDMARKS.find((l) => l.id === 'morgul');
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(26, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x9fe0b0, transparent: true, opacity: 0.35, fog: false, depthWrite: false }),
  );
  glow.position.set(m.x + 300, heightAt(m.x + 300, m.z) + 45, m.z + 6);
  scene.add(glow);
}

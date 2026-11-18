// Builds the lesser ruins (see relicSites.js) and the waymarks along the old paths.

import * as THREE from 'three';
import { RELICS } from './relicSites.js';
import { PATHS, pathWear } from './paths.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { addRock } from './rocks.js';
import { ATLAS } from './surface.js';
import { column, fallenColumn, wall, rubble, archStones, STONE, WORN, MOSS } from './ruins.js';
import { rng } from '../util/noise.js';

const GREY = 0x8f8a80, TURF = 0x6f9148;

const BUILD = {
  stones(b, r, y, rand) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2, x = r.x + Math.cos(a) * 6.5, z = r.z + Math.sin(a) * 6.5, gy = heightAt(x, z);
      if (i === 5) { addRock(b, x, gy - 0.25, z, 2.6, GREY, 900 + i, { detail: 2, sx: 1.25, sy: 0.32, sz: 0.4, cuts: 8, rough: 0.12 }, a); continue; } // one has fallen
      const tall = 2.4 + rand() * 1.6;
      addRock(b, x, gy - 0.4, z, 1.3, i % 3 ? GREY : 0x8a8f78, 900 + i, { detail: 2, sx: 0.85, sy: tall / 1.3, sz: 0.5, cuts: 8, rough: 0.1, sink: 0.05, tilt: 0.12 }, -a + Math.PI / 2);
      addCircle(x, z, 0.7);
    }
    addRock(b, r.x, y - 0.15, r.z, 2.4, GREY, 950, { detail: 2, sx: 1, sy: 0.3, sz: 0.6, cuts: 6, flatTop: true, rough: 0.08 }, 0.4);
    addCircle(r.x, r.z, 1.1);
  },

  statue(b, r, y, rand) {
    b.box(2.6, 1.3, 2.6, r.x, y - 0.2, r.z, STONE);
    b.box(3.2, 0.3, 3.2, r.x, y - 0.25, r.z, WORN);
    addSolid({ minX: r.x - 1.3, maxX: r.x + 1.3, minZ: r.z - 1.3, maxZ: r.z + 1.3, bottom: y - 2, top: y + 1.1 });
    b.box(0.55, 1.5, 0.6, r.x - 0.45, y + 1.1, r.z, STONE);        // the legs still stand
    b.box(0.55, 1.1, 0.6, r.x + 0.45, y + 1.1, r.z, STONE);
    const tx = r.x + 3.6, tz = r.z + 1.5, ty = heightAt(tx, tz);    // the rest lies in the grass
    b.box(1.5, 0.9, 2.4, tx, ty - 0.15, tz, STONE, 0.5, 0.08);
    b.box(0.5, 0.5, 1.6, tx + 1.2, ty - 0.1, tz - 0.6, WORN, 0.9);
    const hx = r.x + 5.4, hz = r.z - 1.8, hy = heightAt(hx, hz);
    b.box(0.85, 0.9, 0.85, hx, hy - 0.2, hz, STONE, 0.7, 0.5, 0.3);
    b.blob(0.5, hx, hy + 0.55, hz, TURF, 1.2, 0.35, 1.2);
  },

  aqueduct(b, r, y, rand) {
    const n = 7, gap = 6.5;
    const heights = [];
    for (let i = 0; i < n; i++) {
      const x = r.x - ((n - 1) * gap) / 2 + i * gap, gy = heightAt(x, r.z);
      const whole = i > 0 && i < 5 && rand() < 0.8;
      const h = whole ? y + 7 - gy : 1.5 + rand() * 3.5;
      heights.push(whole ? y + 7 : null);
      b.box(1.7, h + 0.5, 1.9, x, gy - 0.5, r.z, i % 3 === 1 ? WORN : STONE);
      addCircle(x, r.z, 1.25);
      if (i > 0 && heights[i] && heights[i - 1]) { // a span still stands between two whole piers
        b.box(gap + 1.7, 1.0, 1.9, x - gap / 2, y + 7, r.z, STONE);
        b.box(gap - 1.2, 0.5, 1.5, x - gap / 2, y + 6.5, r.z, WORN);
        b.box(gap + 1.7, 0.35, 0.3, x - gap / 2, y + 8, r.z - 0.8, WORN);
        b.box(gap + 1.7, 0.35, 0.3, x - gap / 2, y + 8, r.z + 0.8, WORN);
      }
    }
    rubble(b, rand, r.x, r.z + 2, 12, 36);
  },

  barrow(b, r, y, rand) {
    b.kind = SURF.leaf;
    b.lump(7.5, r.x, y - 0.6, r.z, TURF, 1, 0.5, 1, 3, 0.06);
    b.kind = SURF.masonry;
    addCircle(r.x, r.z, 6.2);
    const dz = 6.6; // the door faces south
    b.box(0.7, 2.2, 0.8, r.x - 1.1, y - 0.3, r.z + dz, GREY);
    b.box(0.7, 2.2, 0.8, r.x + 1.1, y - 0.3, r.z + dz, GREY);
    b.box(3.2, 0.6, 1.0, r.x, y + 1.9, r.z + dz, GREY);
    b.box(1.6, 2.0, 0.3, r.x, y - 0.2, r.z + dz - 0.2, 0x3a3a3c);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, x = r.x + Math.cos(a) * 8.2, z = r.z + Math.sin(a) * 8.2;
      if (Math.abs(x - r.x) < 2.2 && z > r.z) continue;
      addRock(b, x, heightAt(x, z) - 0.15, z, 0.9, GREY, 970 + i, { detail: 1, sx: 1, sy: 0.6 + rand() * 0.3, sz: 0.7, cuts: 7, rough: 0.1 }, a);
    }
  },

  rotunda(b, r, y, rand) {
    b.cyl(6.3, 6.6, 0.3, r.x, y - 0.18, r.z, WORN, 14);
    const n = 8, standing = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = r.x + Math.cos(a) * 5, z = r.z + Math.sin(a) * 5;
      const up = rand() < 0.6;
      standing.push(up);
      if (up) column(b, x, z, y + 0.1, 5, 0.45);
      else if (rand() < 0.5) column(b, x, z, y + 0.1, 0.8 + rand() * 1.5, 0.45, false);
      else fallenColumn(b, x + Math.cos(a) * 3, z + Math.sin(a) * 3, y, 4.5, a + 1.2, 0.42);
    }
    for (let i = 0; i < n; i++) { // the ring beam survives only between neighbours that both stand
      if (!standing[i] || !standing[(i + 1) % n]) continue;
      const a = ((i + 0.5) / n) * Math.PI * 2;
      b.box(4.1, 0.6, 0.9, r.x + Math.cos(a) * 4.62, y + 5.8, r.z + Math.sin(a) * 4.62, STONE, -a + Math.PI / 2);
    }
  },

  chapel(b, r, y, rand) {
    const w = 8, d = 13;
    // the east end stands tall, with a window in it
    wall(b, r.x - 2.9, r.z - d / 2, y, 2.2, 8, 0.8);
    wall(b, r.x + 2.9, r.z - d / 2, y, 2.2, 6.5, 0.8);
    b.box(3.6, 1.2, 0.8, r.x, y + 5.3, r.z - d / 2, STONE);
    wall(b, r.x, r.z - d / 2, y, 3.6, 1.6, 0.8, WORN);
    for (const s of [-1, 1]) { // side walls, broken down toward the west
      for (let i = 0; i < 4; i++) {
        const h = Math.max(0.6, 5 - i * 1.3 + (rand() - 0.5));
        wall(b, r.x + s * w / 2, r.z - d / 2 + 1.7 + i * 3.2, y, 0.8, h, 3.1, i % 2 ? WORN : STONE);
      }
    }
    b.box(2.2, 1.0, 1.1, r.x, y - 0.1, r.z - d / 2 + 2.6, STONE); // the altar
    addCircle(r.x, r.z - d / 2 + 2.6, 1.1);
    rubble(b, rand, r.x, r.z + 2, 14, 12);
  },

  waystone(b, r, y, rand) {
    b.box(2.2, 0.35, 2.2, r.x, y - 0.15, r.z, WORN);
    b.box(1.5, 0.35, 1.5, r.x, y + 0.2, r.z, STONE);
    const m = new THREE.Matrix4().makeRotationZ(0.07).setPosition(r.x, y + 0.5 + 1.9, r.z);
    b.add(new THREE.CylinderGeometry(0.28, 0.55, 3.8, 4, 6), STONE, m);
    b.add(new THREE.ConeGeometry(0.28 * 1.41, 0.4, 4), STONE, new THREE.Matrix4().makeRotationZ(0.07).setPosition(r.x - 0.14, y + 0.5 + 3.98, r.z));
    b.card(r.x + 0.4, y + 0.9, r.z + 0.1, 0.9, 1.2, 1, 0, 0.3, 0x4f7a34, ATLAS.ivy, 0.5, [1, 0.3, 0]);
    addCircle(r.x, r.z, 0.9);
    rubble(b, rand, r.x, r.z, 4, 6);
  },

  gate(b, r, y, rand) {
    for (const s of [-1, 1]) {
      wall(b, r.x + s * 2.6, r.z, y, 1.5, 4.6, 1.5, STONE, false);
      addCircle(r.x + s * 2.6, r.z, 1.0);
      for (let i = 0; i < 3; i++) wall(b, r.x + s * (4.6 + i * 2.4), r.z, y, 2.4, Math.max(0.5, 2.6 - i * 0.9 + (rand() - 0.5) * 0.5), 0.9, i % 2 ? WORN : STONE);
    }
    // the arch has lost a stone or two from one side
    const lost = rand() < 0.5 ? 1 + Math.floor(rand() * 2) : -1;
    b.missing = (i) => i === lost;
    archStones(b, r.x, y + 4.3, r.z, 3.7, 2.0, 1.4, 0.8, 9);
    b.missing = null;
    rubble(b, rand, r.x, r.z + 2.5, 6, 9);
  },

  tower(b, r, y, rand) {
    const R = 4.2, N = 10;
    for (let i = 0; i < N; i++) {
      if (i === 2) continue; // the doorway
      const a = (i / N) * Math.PI * 2, x = r.x + Math.cos(a) * R, z = r.z + Math.sin(a) * R;
      const h = 5 + Math.max(0, Math.sin(a * 1.3 + 2)) * 5 + rand();
      b.box(2.8, h, 1.2, x, heightAt(x, z) - 0.4, z, i % 4 === 0 ? WORN : STONE, -a + Math.PI / 2);
      addCircle(x, z, 1.2);
    }
    rubble(b, rand, r.x, r.z, 9, 13);
  },

  baths(b, r, y, rand) {
    const w = 11, d = 15;
    b.box(w, 0.16, d, r.x, y - 0.08, r.z, WORN);
    b.box(w - 4, 0.1, d - 5, r.x, y + 0.05, r.z, 0xa58f58); // leaves where the water was
    for (const s of [-1, 1]) {
      wall(b, r.x + s * (w / 2 + 0.4), r.z, y, 0.8, 0.9, d + 1.6);
      wall(b, r.x, r.z + s * (d / 2 + 0.4), y, w - 4, 0.9, 0.8);     // a gap at each corner to walk in by
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      column(b, r.x + sx * (w / 2 - 1.2), r.z + sz * (d / 2 - 1.2), y, sx * sz > 0 ? 3.8 : 1 + rand() * 1.5, 0.4, sx * sz > 0);
    }
  },
};

export function buildRelics(scene, shadows) {
  for (const r of RELICS) {
    const b = new GeoBuilder(Math.round(r.x * 3 + r.z), 0.08);
    b.kind = SURF.masonry;
    BUILD[r.kind](b, r, heightAt(r.x, r.z), rng(Math.round(r.x + r.z * 5)));
    scene.add(b.mesh(materials.stone, shadows));
  }

  // Along the old paths: a worn slab here and there, and a little cairn every
  // so often where the way still shows.
  const b = new GeoBuilder(31, 0.1);
  b.kind = SURF.masonry;
  const rand = rng(909);
  let count = 0;
  for (const pts of PATHS) {
    let since = 40 + rand() * 60;
    for (let i = 1; i < pts.length; i++) {
      const [x, z] = pts[i];
      const y = heightAt(x, z);
      if (y < 1.2 || pathWear(x, z) < 0.25) continue;
      if (rand() < 0.3) b.box(0.9 + rand() * 0.8, 0.12, 0.7 + rand() * 0.5, x + (rand() - 0.5) * 1.6, y - 0.05, z + (rand() - 0.5) * 1.6, WORN, rand() * 3);
      since -= Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      if (since > 0) continue;
      since = 90 + rand() * 80;
      const cx = x + (rand() < 0.5 ? -2.4 : 2.4), cz = z + (rand() - 0.5), cy = heightAt(cx, cz);
      addRock(b, cx, cy - 0.1, cz, 0.95, GREY, count * 3, { detail: 1, sy: 0.55, cuts: 6 });
      addRock(b, cx + 0.05, cy + 0.3, cz, 0.7, 0x9a958a, count * 3 + 1, { detail: 1, sy: 0.55, cuts: 6 });
      addRock(b, cx, cy + 0.6, cz - 0.03, 0.45, GREY, count * 3 + 2, { detail: 0, sy: 0.7, cuts: 5 });
      count++;
      if (count % 400 === 0) break;
    }
  }
  // One mesh per stretch of country would cull better, but this is small.
  scene.add(b.mesh(materials.stone, false));
}

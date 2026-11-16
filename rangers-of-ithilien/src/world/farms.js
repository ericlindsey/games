// Builds what still stands of the old farms and hamlets: roofless houses,
// tumbled field walls, wells and the paving of lost lanes.

import { SITES } from './oldworks.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder } from './build.js';
import { rng } from '../util/noise.js';

const WALL = [0xa9a394, 0x8f8a7c, 0x9c9686, 0x7d8f5a];   // field stone, some mossed
const HOUSE = [0xcbc4b0, 0xb5ae9a, 0xc2bba6];

/** A straight run of wall as a blocking box. */
function solidWall(b, x, z, w, d, y, h, color) {
  b.box(w, h + 0.5, d, x, y - 0.5, z, color);
  addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y - 2, top: y + h });
}

function house(b, rand, hs) {
  const y = heightAt(hs.x, hs.z), t = 0.6;
  const long = hs.w >= hs.d;                    // the door is in a long wall
  const color = () => HOUSE[Math.floor(rand() * HOUSE.length)];
  const height = () => 0.9 + rand() * 2.8;
  const x0 = hs.x - hs.w / 2, x1 = hs.x + hs.w / 2, z0 = hs.z - hs.d / 2, z1 = hs.z + hs.d / 2;
  // north and south walls (run east-west), east and west walls (run north-south)
  const sides = [
    { ew: true, x: hs.x, z: z0, len: hs.w }, { ew: true, x: hs.x, z: z1, len: hs.w },
    { ew: false, x: x0, z: hs.z, len: hs.d }, { ew: false, x: x1, z: hs.z, len: hs.d },
  ];
  const doorSide = long ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3);
  sides.forEach((s, i) => {
    const pieces = i === doorSide ? [[-s.len / 2, -0.8], [0.8, s.len / 2]] : rand() < 0.3 ? [[-s.len / 2, -s.len * 0.1]] : [[-s.len / 2, s.len / 2]];
    for (const [a, c] of pieces) {
      const len = c - a, mid = (a + c) / 2, h = height();
      if (s.ew) solidWall(b, s.x + mid, s.z, len, t, y, h, color());
      else solidWall(b, s.x, s.z + mid, t, len, y, h, color());
    }
  });
  // one gable still stands above the rest
  if (rand() < 0.6) {
    const g = sides[long ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * 2)];
    if (g.ew) b.box(g.len * 0.55, 1.8, t, g.x, y + 2.6, g.z, color()); else b.box(t, 1.8, g.len * 0.55, g.x, y + 2.6, g.z, color());
  }
  for (let i = 0; i < 6; i++) { // fallen stone, inside and out
    const s = 0.3 + rand() * 0.5;
    const rx = hs.x + (rand() - 0.5) * (hs.w + 4), rz = hs.z + (rand() - 0.5) * (hs.d + 4);
    b.box(s * 1.5, s * 0.7, s, rx, heightAt(rx, rz) - 0.1, rz, rand() < 0.35 ? WALL[3] : HOUSE[1], rand() * 3, (rand() - 0.5) * 0.4);
  }
}

/** Dry-stone wall along one edge of a field: standing, tumbled, or gone. */
function fieldEdge(b, rand, xa, za, xb, zb) {
  const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 5)), seg = len / n;
  const ew = Math.abs(xb - xa) > Math.abs(zb - za);
  let state = rand();
  for (let i = 0; i < n; i++) {
    if (rand() < 0.45) state = rand(); // walls fail in runs, not stone by stone
    if (state > 0.82) continue;        // gone
    const f = (i + 0.5) / n, x = xa + (xb - xa) * f, z = za + (zb - za) * f, y = heightAt(x, z);
    if (y < 1) continue;
    const color = WALL[Math.floor(rand() * WALL.length)];
    if (state < 0.5) {
      const h = 0.72 + rand() * 0.35, t = 0.7;
      if (ew) solidWall(b, x, z, seg + 0.05, t, y, h, color); else solidWall(b, x, z, t, seg + 0.05, y, h, color);
      // uneven cope-stones, so the wall reads as laid stone and not a slab
      for (let k = 0; k < 4; k++) {
        const o = (k - 1.5) * (seg / 4), s2 = 0.5 + rand() * 0.5;
        b.box(ew ? seg / 4 - 0.1 : t + 0.12, 0.12 + rand() * 0.2, ew ? t + 0.12 : seg / 4 - 0.1,
          ew ? x + o : x, y + h - 0.02, ew ? z : z + o, WALL[Math.floor(rand() * WALL.length)], (rand() - 0.5) * 0.15 * s2);
      }
    } else {
      // tumbled: a low spread of stone you can step over
      const h = 0.2 + rand() * 0.25;
      b.box(ew ? seg : 1.3, h + 0.3, ew ? 1.3 : seg, x, y - 0.3, z, color, (rand() - 0.5) * 0.12);
      for (let k = 0; k < 2; k++) {
        const s = 0.25 + rand() * 0.3;
        b.box(s * 1.4, s, s, x + (rand() - 0.5) * 3, y - 0.05, z + (rand() - 0.5) * 3, WALL[1], rand() * 3);
      }
    }
  }
}

function well(b, x, z) {
  const y = heightAt(x, z);
  b.cyl(1.25, 1.35, 0.85, x, y - 0.1, z, HOUSE[1], 10);
  b.cyl(0.95, 0.95, 0.06, x, y + 0.7, z, 0x2a2f2a, 10);
  addCircle(x, z, 1.35);
}

export function buildFarms(scene, shadows) {
  for (const site of SITES) {
    const rand = rng(Math.round(site.x * 13 + site.z * 7));
    const b = new GeoBuilder(Math.round(site.x + site.z), 0.09);
    for (const hs of site.houses) house(b, rand, hs);
    for (const f of site.fields) {
      fieldEdge(b, rand, f.minX, f.minZ, f.maxX, f.minZ);
      fieldEdge(b, rand, f.minX, f.maxZ, f.maxX, f.maxZ);
      fieldEdge(b, rand, f.minX, f.minZ, f.minX, f.maxZ);
      fieldEdge(b, rand, f.maxX, f.minZ, f.maxX, f.maxZ);
    }
    for (const l of site.lanes) { // worn paving, most of it under the turf
      const len = Math.hypot(l.x1 - l.x0, l.z1 - l.z0), a = Math.atan2(l.x1 - l.x0, l.z1 - l.z0);
      for (let d = 0; d < len; d += 2.6) {
        if (rand() < 0.55) continue;
        const x = l.x0 + ((l.x1 - l.x0) * d) / len + (rand() - 0.5) * 2, z = l.z0 + ((l.z1 - l.z0) * d) / len + (rand() - 0.5) * 2;
        const y = heightAt(x, z);
        if (y > 1.2) b.box(1.3 + rand(), 0.14, 1 + rand() * 0.6, x, y - 0.06, z, HOUSE[1], a + (rand() - 0.5) * 0.3);
      }
      // gateposts where the lane leaves the yard
      const gx = -(l.z1 - l.z0) / len, gz = (l.x1 - l.x0) / len;
      for (const s of [-1, 1]) {
        const px = l.x0 + gx * s * 2.4, pz = l.z0 + gz * s * 2.4, py = heightAt(px, pz);
        b.box(0.7, s > 0 ? 2.1 : 1.2, 0.7, px, py - 0.3, pz, HOUSE[0]);
        addCircle(px, pz, 0.55);
      }
    }
    if (site.kind === 'hamlet') {
      well(b, site.x - 4, site.z + 5);
      const y = heightAt(site.x + 9, site.z + 2); // the market cross, broken off short
      b.box(2.4, 0.5, 2.4, site.x + 9, y - 0.1, site.z + 2, HOUSE[1]);
      b.box(1.5, 0.45, 1.5, site.x + 9, y + 0.4, site.z + 2, HOUSE[0]);
      b.cyl(0.3, 0.38, 2.3, site.x + 9, y + 0.85, site.z + 2, HOUSE[0], 8);
      addCircle(site.x + 9, site.z + 2, 1.3);
    } else if (rand() < 0.5) {
      well(b, site.x + (rand() < 0.5 ? -7 : 7), site.z + 6);
    }
    scene.add(b.mesh(undefined, shadows));
  }
}

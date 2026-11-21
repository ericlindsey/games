// Builds what still stands of the old farms and hamlets: roofless houses,
// tumbled field walls, wells and the paving of lost lanes.

import { SITES } from './oldworks.js';
import { heightAt, streamDistance } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { wall as ashlar, rubble } from './ruins.js';
import { addRock } from './rocks.js';
import { rng } from '../util/noise.js';

const WALL = [0xa9a394, 0x8f8a7c, 0x9c9686, 0x8e8d7a];   // field stone, some darker with weather
const HOUSE = [0xcbc4b0, 0xb5ae9a, 0xc2bba6];

/** A straight run of wall as a blocking box. */
function solidWall(b, x, z, w, d, y, h, color) {
  ashlar(b, x, z, y + 0.3, w, h, d, color, false); // laid stone with a broken top, sometimes ivy
  addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: y - 2, top: y + h });
}

function house(b, rand, hs) {
  const t = 0.6;
  // on the lowest ground under it, so no corner hangs over a slope (the walls are buried a little)
  const y = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([sx, sz]) => heightAt(hs.x + sx * hs.w / 2, hs.z + sz * hs.d / 2)));
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
  // One gable may still stand above the rest: an end wall (never the door's),
  // whole and tall, with the gable resting on it. (It used to be set at a fixed
  // height over whatever stood below, and over a low wall it hung in the air.)
  const gable = rand() < 0.6 ? (long ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * 2)) : -1;
  sides.forEach((s, i) => {
    const pieces = i === doorSide ? [[-s.len / 2, -0.8], [0.8, s.len / 2]] : i !== gable && rand() < 0.3 ? [[-s.len / 2, -s.len * 0.1]] : [[-s.len / 2, s.len / 2]];
    for (const [a, c] of pieces) {
      const len = c - a, mid = (a + c) / 2, h = i === gable ? 2.9 + rand() * 0.6 : height();
      if (s.ew) solidWall(b, s.x + mid, s.z, len, t, y, h, color());
      else solidWall(b, s.x, s.z + mid, t, len, y, h, color());
      if (i === gable) {
        const gh = 1.7, gy = y + h - 0.5; // set into the wall's broken top, so it never floats
        if (s.ew) b.box(s.len * 0.55, gh, t, s.x, gy, s.z, color()); else b.box(t, gh, s.len * 0.55, s.x, gy, s.z, color());
        if (s.ew) b.box(s.len * 0.3, 0.7, t, s.x, gy + gh - 0.05, s.z, color()); else b.box(t, 0.7, s.len * 0.3, s.x, gy + gh - 0.05, s.z, color());
      }
    }
  });
  rubble(b, rand, hs.x, hs.z, 6, Math.max(hs.w, hs.d) + 4); // fallen stone, inside and out
}

/**
 * A stretch of field wall still standing: rough stones laid dry (SURF.drystone),
 * broken along its top, a few stones still lying on it and a few fallen at its
 * foot. On sloping ground it is built in short steps, each on its own ground,
 * so no end of it hangs in the air.
 */
function dryWall(b, rand, xa, za, xb, zb, h, ew) {
  const ya = heightAt(xa, za), yb = heightAt(xb, zb);
  const steps = Math.min(6, 1 + Math.floor(Math.abs(ya - yb) / 0.35));
  for (let k = 0; k < steps; k++) {
    const f0 = k / steps, f1 = (k + 1) / steps;
    const x0 = xa + (xb - xa) * f0, z0 = za + (zb - za) * f0, x1 = xa + (xb - xa) * f1, z1 = za + (zb - za) * f1;
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0) + 0.04;
    const g0 = heightAt(x0, z0), g1 = heightAt(x1, z1), lo = Math.min(g0, g1), hi = Math.max(g0, g1);
    if (streamDistance(x, z) < 5) continue; // no wall stands in a stream
    const top = hi + h, t = 0.78;
    const color = WALL[Math.floor(rand() * WALL.length)];
    b.kind = SURF.drystone;
    // battered: broad below, narrower above, the upper part broken in runs
    b.box(ew ? len : t, top - 0.4 - (lo - 0.6), ew ? t : len, x, lo - 0.6, z, color);
    const runs = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i < runs; i++) {
      const o = -len / 2 + (len / runs) * (i + 0.5), drop = rand() < 0.35 ? 0.15 + rand() * 0.35 : 0;
      if (0.4 - drop < 0.08) continue;
      b.box(ew ? len / runs + 0.02 : t - 0.14, 0.4 - drop, ew ? t - 0.14 : len / runs + 0.02, ew ? x + o : x, top - 0.4, ew ? z : z + o, rand() < 0.25 ? WALL[3] : color);
      if (!drop && rand() < 0.7) { // a cope-stone on top
        const cx = ew ? x + o + (rand() - 0.5) * 0.4 : x, cz = ew ? z : z + o + (rand() - 0.5) * 0.4;
        addRock(b, cx, top - 0.06, cz, 0.5 + rand() * 0.25, rand() < 0.3 ? WALL[3] : color, Math.floor(rand() * 1e5), { detail: 0, sy: 0.55, cuts: 5, rough: 0.12 });
      }
    }
    b.kind = SURF.masonry;
    if (rand() < 0.5) { // fallen from it
      const side = rand() < 0.5 ? -1 : 1, o = (rand() - 0.5) * len;
      const fx = ew ? x + o : x + side * 0.9, fz = ew ? z + side * 0.9 : z + o;
      addRock(b, fx, heightAt(fx, fz) - 0.12, fz, 0.45 + rand() * 0.3, color, Math.floor(rand() * 1e5), { detail: 0, sy: 0.6, cuts: 6, rough: 0.12 });
    }
    addSolid({ minX: x - (ew ? len : t) / 2, maxX: x + (ew ? len : t) / 2, minZ: z - (ew ? t : len) / 2, maxZ: z + (ew ? t : len) / 2, bottom: lo - 2, top });
  }
}

/**
 * Field wall along one edge of a field, in runs: mostly a low line of tumbled
 * field stone you can step over, here and there still standing shoulder high,
 * and in places gone altogether. (Since v0.6 these are all rough stone; they
 * were laid ashlar, which looked like brick.)
 */
function fieldEdge(b, rand, xa, za, xb, zb) {
  const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 5)), seg = len / n;
  const ew = Math.abs(xb - xa) > Math.abs(zb - za);
  let state = rand();
  for (let i = 0; i < n; i++) {
    if (rand() < 0.45) state = rand(); // walls fail in runs, not stone by stone
    if (state > 0.84) continue;        // gone
    const f = (i + 0.5) / n, x = xa + (xb - xa) * f, z = za + (zb - za) * f, y = heightAt(x, z);
    if (y < 1 || streamDistance(x, z) < 4) continue;
    const color = WALL[Math.floor(rand() * WALL.length)];
    if (state < 0.28) {
      const f0 = i / n, f1 = (i + 1) / n;
      dryWall(b, rand, xa + (xb - xa) * f0, za + (zb - za) * f0, xa + (xb - xa) * f1, za + (zb - za) * f1, 0.95 + rand() * 0.7, ew);
    } else {
      // tumbled: a low spread of stone you can step over, now and then a second course still on the first
      const n = Math.max(3, Math.round(seg * 1.2));
      for (let k = 0; k < n; k++) {
        const f2 = (k + 0.5) / n - 0.5, s = 0.5 + rand() * 0.5;
        const sx = ew ? x + f2 * seg : x + (rand() - 0.5) * 0.9, sz = ew ? z + (rand() - 0.5) * 0.9 : z + f2 * seg, sy = heightAt(sx, sz);
        addRock(b, sx, sy - 0.15, sz, s, k % 3 ? color : WALL[1], Math.floor(rand() * 1e5), { detail: 0, sy: 0.6, cuts: 6, rough: 0.12 });
        if (state < 0.45 && rand() < 0.5) addRock(b, sx + (rand() - 0.5) * 0.2, sy + s * 0.3, sz + (rand() - 0.5) * 0.2, s * 0.7, color, Math.floor(rand() * 1e5), { detail: 0, sy: 0.6, cuts: 6, rough: 0.12 });
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
    b.kind = SURF.masonry;
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
    scene.add(b.mesh(materials.stone, shadows));
  }
}

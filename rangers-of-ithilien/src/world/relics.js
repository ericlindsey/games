// Builds the lesser ruins (see relicSites.js) and the waymarks along the old paths.

import * as THREE from 'three';
import { RELICS, COURT } from './relicSites.js';
import { PATHS, pathWear } from './paths.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { addRock } from './rocks.js';
import { ATLAS } from './surface.js';
import { column, fallenColumn, wall, rubble, archStones, STONE, WORN, AGED } from './ruins.js';
import { rng } from '../util/noise.js';

/** Beyond this the small things about a ruin are not drawn. */
const NEAR_DETAIL = 150;
const GREY = 0x8f8a80, TURF = 0x6f9148, IVY = 0x4f7a34, IVY2 = 0x5a8a3c, LICHEN = 0xb7b48f;
const LEAVES = [0xa3803f, 0x8c6a34, 0xb39553, 0x7d6a3a, 0x9a7a3c, 0x6f6232];

/**
 * How far the barrow's mound stands above the ground at (dx, dz) from its middle:
 * a bell that sinks away at its rim, and nothing in the cut before the door,
 * which faces south (+z). Shared by the drawing and the floor.
 */
function barrowRise(dx, dz) {
  const rr = Math.hypot(dx, dz);
  if (rr > 11.5) return 0;
  const bell = 3.4 * Math.exp(-((rr / 5.4) ** 2)) - 0.25 * (rr / 11.5) ** 2;
  const s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cut = (1 - s(1.6, 2.3, Math.abs(dx))) * s(3.45, 3.75, dz);
  return Math.max(0, bell) * (1 - cut) - 0.1 * cut;
}

// ---- small things, drawn only near (the `d` builder: see buildRelics) ----

/** Fallen leaves lying flat, n of them over a w x dd patch about (x, z). */
function litter(d, rand, x, z, w, dd, n, at = heightAt) {
  for (let i = 0; i < n; i++) {
    const px = x + (rand() - 0.5) * w, pz = z + (rand() - 0.5) * dd, s = 0.55 + rand() * 0.7;
    d.card(px, at(px, pz) + 0.03 + rand() * 0.05, pz, s, s, (rand() - 0.5) * 0.4, 1, (rand() - 0.5) * 0.4, LEAVES[Math.floor(rand() * LEAVES.length)], ATLAS.broad, rand() * 6.28, [0, 1, 0]);
  }
}
/** Leaves blown into a drift along the foot of a wall: a low brown bank under loose leaves. */
function drift(d, rand, x, z, len, alongX, y) {
  const save = d.kind;
  d.kind = SURF.leaf;
  d.lump(1, x, y - 0.05, z, LEAVES[3], alongX ? len / 2 : 0.55, 0.22, alongX ? 0.55 : len / 2, 1, 0.25, [0, 0, 0]);
  d.kind = save;
  litter(d, rand, x, z, alongX ? len : 1.3, alongX ? 1.3 : len, Math.round(len * 2.5), () => y + 0.12);
}
/** Ivy hanging down a face from its top (normal nx, nz), w wide. */
function ivyDown(d, rand, x, top, z, w, h, nx, nz) {
  for (let j = 0; j < 3; j++) {
    const o = (rand() - 0.5) * w * 0.5;
    d.card(x - nz * o + nx * (0.04 + j * 0.01), top - h * (0.25 + j * 0.22), z + nx * o + nz * (0.04 + j * 0.01), w * (0.8 + rand() * 0.3), h * 0.6, nx, 0, nz, j % 2 ? IVY : IVY2, ATLAS.ivy, rand() * 6.28, [nx, 0.4, nz]);
  }
}
/** A cushion of moss on a top surface. */
function moss(d, x, y, z, w, dd) {
  const save = d.kind;
  d.kind = SURF.leaf;
  d.lump(1, x, y, z, 0x6f8a3c, w / 2, 0.09, dd / 2, 1, 0.3, [0, 0, 0]);
  d.kind = save;
}
/** Loose stones in the grass. */
function stones(d, rand, x, z, spread, n, color = WORN) {
  for (let i = 0; i < n; i++) {
    const px = x + (rand() - 0.5) * spread, pz = z + (rand() - 0.5) * spread;
    addRock(d, px, heightAt(px, pz) - 0.08, pz, 0.25 + rand() * 0.4, rand() < 0.3 ? AGED : color, Math.floor(rand() * 1e5), { detail: 0, sy: 0.6, cuts: 5 });
  }
}
/** A dressed block lying where it fell, half sunk, sometimes mossed. */
function block(b, rand, x, z, w = 0.9, h = 0.45, dd = 0.55) {
  b.box(w, h, dd, x, heightAt(x, z) - h * 0.3, z, rand() < 0.3 ? AGED : WORN, rand() * 3, (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25);
}

const BUILD = {
  stones(b, d, r, y, rand) {
    const n = 8, R = 6.5, tall = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2, x = r.x + Math.cos(a) * R, z = r.z + Math.sin(a) * R, gy = heightAt(x, z);
      if (i === 5) { addRock(b, x, gy - 0.25, z, 2.6, GREY, 900 + i, { detail: 2, sx: 1.25, sy: 0.32, sz: 0.4, cuts: 8, rough: 0.12 }, a); tall.push(0); continue; } // one has fallen
      const h = 2.4 + rand() * 1.6;
      tall.push(h);
      addRock(b, x, gy - 0.4, z, 1.3, i % 3 ? GREY : 0x8a8f78, 900 + i, { detail: 2, sx: 0.85, sy: h / 1.3, sz: 0.5, cuts: 8, rough: 0.1, sink: 0.05, tilt: 0.12 }, -a + Math.PI / 2);
      addCircle(x, z, 0.7);
      // lichen on the weather side, moss about the foot, grass grown up close
      d.card(x + Math.cos(a) * 0.32, gy + h * 0.55, z + Math.sin(a) * 0.32, 0.6, h * 0.5, Math.cos(a), 0, Math.sin(a), LICHEN, ATLAS.ivy, rand() * 6.28, [Math.cos(a), 0.3, Math.sin(a)]);
      moss(d, x, gy + 0.05, z, 1.4, 1.1);
    }
    // a lintel still laid across the two tallest neighbours: the ring was once a gate of stones
    let best = 0;
    for (let i = 0; i < n; i++) if (tall[i] && tall[(i + 1) % n] && Math.min(tall[i], tall[(i + 1) % n]) > Math.min(tall[best], tall[(best + 1) % n] || 0)) best = i;
    if (tall[best] && tall[(best + 1) % n]) {
      const a = ((best + 0.5) / n) * Math.PI * 2 + 0.2, top = y + Math.min(tall[best], tall[(best + 1) % n]) - 0.55;
      addRock(b, r.x + Math.cos(a) * R * 0.93, top, r.z + Math.sin(a) * R * 0.93, 1.3, GREY, 960, { detail: 1, sx: 4.4, sy: 0.4, sz: 0.55, cuts: 6, rough: 0.06 }, -a + Math.PI / 2);
    }
    // the altar stone in the middle, a hollow worn in its top, and an inner ring of small stones
    addRock(b, r.x, y - 0.15, r.z, 2.4, GREY, 950, { detail: 2, sx: 1, sy: 0.3, sz: 0.6, cuts: 6, flatTop: true, rough: 0.08 }, 0.4);
    addCircle(r.x, r.z, 1.1);
    d.cyl(0.32, 0.22, 0.05, r.x + 0.2, y + 0.58, r.z, 0x3e3b33, 8);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2, x = r.x + Math.cos(a) * 3.3, z = r.z + Math.sin(a) * 3.3;
      addRock(d, x, heightAt(x, z) - 0.1, z, 0.35 + rand() * 0.2, GREY, 1000 + i, { detail: 0, sy: 0.7, cuts: 5 });
    }
    litter(d, rand, r.x, r.z, 12, 12, 30);
  },

  statue(b, d, r, y, rand) {
    // a stepped plinth, the legs still on it, the rest in the grass
    b.box(3.6, 0.3, 3.6, r.x, y - 0.25, r.z, WORN);
    b.box(3.0, 0.35, 3.0, r.x, y + 0.05, r.z, STONE);
    b.box(2.6, 1.0, 2.6, r.x, y + 0.1, r.z, STONE);
    b.box(2.75, 0.18, 2.75, r.x, y + 1.08, r.z, WORN); // the moulded cap
    addSolid({ minX: r.x - 1.4, maxX: r.x + 1.4, minZ: r.z - 1.4, maxZ: r.z + 1.4, bottom: y - 2, top: y + 1.26 });
    d.box(1.5, 0.55, 0.04, r.x, y + 0.35, r.z + 1.31, 0x8e8774); // the panel where his name was cut
    for (let k = 0; k < 4; k++) d.box(0.25 + rand() * 0.15, 0.05, 0.03, r.x - 0.5 + k * 0.33, y + 0.6 - (k % 2) * 0.12, r.z + 1.335, 0x5b564a);
    b.box(0.55, 1.5, 0.6, r.x - 0.45, y + 1.26, r.z, STONE);        // the legs still stand
    b.box(0.55, 1.1, 0.6, r.x + 0.45, y + 1.26, r.z, STONE);
    b.box(1.3, 0.25, 0.9, r.x, y + 1.26, r.z + 0.15, WORN);          // the hem of a robe
    const tx = r.x + 3.6, tz = r.z + 1.5, ty = heightAt(tx, tz);     // the body, face down
    b.box(1.5, 0.9, 2.4, tx, ty - 0.15, tz, STONE, 0.5, 0.08);
    b.box(0.5, 0.5, 1.6, tx + 1.2, ty - 0.1, tz - 0.6, WORN, 0.9);  // an arm, with the sceptre broken from it
    b.cyl(0.08, 0.08, 1.4, tx + 1.9, ty + 0.15, tz - 1.4, WORN, 6, Math.PI / 2, 0.5);
    const hx = r.x + 5.4, hz = r.z - 1.8, hy = heightAt(hx, hz);     // the head, crowned with moss and flowers
    b.box(0.85, 0.9, 0.85, hx, hy - 0.2, hz, STONE, 0.7, 0.5, 0.3);
    b.blob(0.5, hx, hy + 0.55, hz, TURF, 1.2, 0.35, 1.2);
    for (let i = 0; i < 9; i++) { const a = i * 0.7; d.dot(0.07, hx + Math.cos(a) * 0.45, hy + 0.66, hz + Math.sin(a) * 0.45, i % 2 ? 0xf2efe0 : 0xe8c64a); }
    // ivy up the plinth; moss on the steps; the paving of the place, mostly gone under turf
    ivyDown(d, rand, r.x - 1.31, y + 1.2, r.z - 0.4, 1.2, 1.2, -1, 0);
    moss(d, r.x + 1.2, y + 0.4, r.z - 1.2, 1.1, 0.8);
    for (let i = 0; i < 14; i++) {
      const a = rand() * 6.28, rr = 2.4 + rand() * 3.5, x = r.x + Math.cos(a) * rr, z = r.z + Math.sin(a) * rr;
      d.box(0.8 + rand() * 0.5, 0.1, 0.6 + rand() * 0.4, x, heightAt(x, z) - 0.05, z, WORN, rand() * 0.3);
    }
    stones(d, rand, r.x + 2, r.z, 9, 6);
    litter(d, rand, r.x + 1, r.z, 10, 9, 22);
  },

  aqueduct(b, d, r, y, rand) {
    const n = 7, gap = 6.5;
    const heights = [];
    for (let i = 0; i < n; i++) {
      const x = r.x - ((n - 1) * gap) / 2 + i * gap, gy = heightAt(x, r.z);
      const whole = i > 0 && i < 5 && rand() < 0.8;
      const h = whole ? y + 7 - gy : 1.5 + rand() * 3.5;
      heights.push(whole ? y + 7 : null);
      b.box(1.7, h + 0.5, 1.9, x, gy - 0.5, r.z, i % 3 === 1 ? WORN : STONE);
      b.box(2.1, 0.5, 2.3, x, gy - 0.3, r.z, WORN); // the footing
      addCircle(x, r.z, 1.25);
      if (whole) { b.box(2.0, 0.3, 2.1, x, y + 6.7, r.z, WORN); ivyDown(d, rand, x, y + 6.6, r.z + 0.98, 1.4, 3 + rand() * 3, 0, 1); }
      else moss(d, x, gy + h - 0.5, r.z, 1.6, 1.8);
      if (i > 0 && heights[i] && heights[i - 1]) { // a span still stands between two whole piers
        b.box(gap + 1.7, 1.0, 1.9, x - gap / 2, y + 7, r.z, STONE);
        b.box(gap - 1.2, 0.5, 1.5, x - gap / 2, y + 6.5, r.z, WORN);
        b.box(gap + 1.7, 0.35, 0.3, x - gap / 2, y + 8, r.z - 0.8, WORN); // the channel's sides
        b.box(gap + 1.7, 0.35, 0.3, x - gap / 2, y + 8, r.z + 0.8, WORN);
        d.box(gap + 1.6, 0.05, 1.25, x - gap / 2, y + 8.02, r.z, 0x6b5a38); // silt and leaves in the dry channel
        moss(d, x - gap / 2, y + 8.05, r.z, gap * 0.8, 1.1);
        d.box(gap * 0.5, 2.2, 0.04, x - gap / 2, y + 5.3, r.z + 0.97, 0x6f6a58); // where the water once spilled and stained it
      }
    }
    // the fallen spans: voussoirs and channel stones in a long spill on the downhill side
    for (let i = 0; i < 9; i++) block(b, rand, r.x + (rand() - 0.5) * 36, r.z + 2.5 + rand() * 4, 1.2 + rand() * 0.8, 0.5 + rand() * 0.3, 0.8);
    rubble(b, rand, r.x, r.z + 2, 12, 36);
    // at its end, the cistern it fed: a stone tank, cracked, full of leaves
    const cx = r.x + ((n - 1) * gap) / 2 + 5, cz = r.z, cy = heightAt(cx, cz);
    for (const [w, dd, ox, oz] of [[4, 0.5, 0, -1.75], [4, 0.5, 0, 1.75], [0.5, 3, -1.75, 0], [0.5, 3, 1.75, 0]]) b.box(w, 1.1, dd, cx + ox, cy - 0.3, cz + oz, WORN);
    addSolid({ minX: cx - 2, maxX: cx + 2, minZ: cz - 2, maxZ: cz + 2, bottom: cy - 2, top: cy + 0.8 });
    drift(d, rand, cx, cz, 2.8, true, cy + 0.45);
    litter(d, rand, r.x, r.z, 40, 8, 40);
    stones(d, rand, r.x, r.z - 2, 30, 10);
  },

  barrow(b, d, r, y, rand) {
    // A long low mound that swells out of the ground like a bell, no edge to it,
    // with a sunken way cut into its south side down to the door. Built as a
    // field of heights (barrowRise), and the same heights are a floor the ranger
    // walks on, up and over it (since v0.7: it used to be drawn only, and the
    // ranger sank into its flanks); the cut's sides stop them.
    b.kind = SURF.leaf;
    const R = 11.5, step = 0.5, n = Math.round((2 * R) / step), Y = (h) => y - 0.12 + h;
    const pos = [], index = [], rise = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = r.x - R + i * step, z = r.z - R + j * step, h = barrowRise(x - r.x, z - r.z);
        pos.push(x, Y(h), z); rise.push(h);
      }
    }
    const at = (i, j) => j * (n + 1) + i;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (Math.max(rise[at(i, j)], rise[at(i + 1, j)], rise[at(i, j + 1)], rise[at(i + 1, j + 1)]) <= 0.02) continue; // (only where it stands above the ground)
        index.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i + 1, j));
      }
    }
    const mound = new THREE.BufferGeometry();
    mound.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mound.setIndex(index);
    mound.computeVertexNormals();
    b.add(mound, TURF, null, true);
    addSolid({ minX: r.x - R, maxX: r.x + R, minZ: r.z - R, maxZ: r.z + R, bottom: y - 3, top: (x, z) => Y(barrowRise(x - r.x, z - r.z)) });
    b.kind = SURF.masonry;
    const dz = 4.1; // the door faces south, set into the mound, down a short sunken way lined with stones
    b.box(0.7, 2.2, 0.8, r.x - 1.1, y - 0.3, r.z + dz, GREY);
    b.box(0.7, 2.2, 0.8, r.x + 1.1, y - 0.3, r.z + dz, GREY);
    b.box(3.2, 0.6, 1.0, r.x, y + 1.9, r.z + dz, GREY);
    b.box(1.6, 2.0, 0.3, r.x, y - 0.2, r.z + dz - 0.2, 0x3a3a3c);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x = r.x + s * 1.5, z = r.z + dz + 1 + k * 1.1;
      addRock(b, x, heightAt(x, z) - 0.2, z, 0.9, GREY, 940 + k + (s > 0 ? 3 : 0), { detail: 1, sx: 0.6, sy: 1.3 - k * 0.3, sz: 1, cuts: 6, rough: 0.08 });
      addCircle(x, z, 0.4);
    }
    // the kerb of stones round the mound
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, x = r.x + Math.cos(a) * 8.2, z = r.z + Math.sin(a) * 8.2;
      if (Math.abs(x - r.x) < 2.4 && z > r.z) continue;
      addRock(b, x, heightAt(x, z) - 0.15, z, 0.9, i % 4 ? GREY : 0x8a8f78, 970 + i, { detail: 1, sx: 1, sy: 0.6 + rand() * 0.3, sz: 0.7, cuts: 7, rough: 0.1 }, a);
      if (i % 3 === 0) moss(d, x, heightAt(x, z) + 0.35, z, 0.9, 0.7);
    }
    // a capstone on top, and flowers someone has laid at the door, not long ago
    addRock(b, r.x + 0.8, y + 3.05, r.z - 0.6, 1.4, GREY, 999, { detail: 1, sx: 1.3, sy: 0.35, sz: 0.9, cuts: 6, flatTop: true });
    for (let i = 0; i < 7; i++) d.dot(0.08, r.x - 0.4 + rand() * 0.8, y + 0.05, r.z + dz + 0.6 + rand() * 0.4, i % 3 ? 0xf0ede0 : 0xc94f8a);
    d.box(0.6, 0.04, 0.08, r.x, y + 0.02, r.z + dz + 0.75, 0x5c7a34, 0.4);
    litter(d, rand, r.x, r.z + dz + 2, 4, 3, 10);
    stones(d, rand, r.x, r.z, 20, 8, GREY);
  },

  rotunda(b, d, r, y, rand) {
    // a stepped floor, cracked, with a pedestal where something stood in the middle
    b.cyl(6.9, 7.1, 0.25, r.x, y - 0.3, r.z, WORN, 18);
    b.cyl(6.3, 6.6, 0.3, r.x, y - 0.18, r.z, WORN, 18);
    b.box(1.2, 0.9, 1.2, r.x, y + 0.1, r.z, STONE);
    b.box(1.45, 0.16, 1.45, r.x, y + 1.0, r.z, WORN);
    addCircle(r.x, r.z, 0.85);
    d.cyl(0.35, 0.22, 0.45, r.x + 0.15, y + 1.16, r.z, 0x8a7f6a, 8); // an urn, its lip broken
    const n = 8, standing = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = r.x + Math.cos(a) * 5, z = r.z + Math.sin(a) * 5;
      const up = rand() < 0.6;
      standing.push(up);
      if (up) { column(b, x, z, y + 0.1, 5, 0.45); if (rand() < 0.6) ivyDown(d, rand, x + Math.cos(a) * 0.5, y + 4.2, z + Math.sin(a) * 0.5, 0.8, 3, Math.cos(a), Math.sin(a)); }
      else if (rand() < 0.5) column(b, x, z, y + 0.1, 0.8 + rand() * 1.5, 0.45, false);
      else fallenColumn(b, x + Math.cos(a) * 3, z + Math.sin(a) * 3, y, 4.5, a + 1.2, 0.42);
    }
    for (let i = 0; i < n; i++) { // the ring beam survives only between neighbours that both stand
      const a = ((i + 0.5) / n) * Math.PI * 2;
      if (!standing[i] || !standing[(i + 1) % n]) { // else a piece of it lies below, by the gap
        if (rand() < 0.7) b.box(2.6, 0.55, 0.85, r.x + Math.cos(a) * 6.8, heightAt(r.x + Math.cos(a) * 6.8, r.z + Math.sin(a) * 6.8) - 0.2, r.z + Math.sin(a) * 6.8, STONE, -a + Math.PI / 2 + (rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.3);
        continue;
      }
      b.box(4.1, 0.6, 0.9, r.x + Math.cos(a) * 4.62, y + 5.8, r.z + Math.sin(a) * 4.62, STONE, -a + Math.PI / 2);
      b.box(4.1, 0.18, 1.05, r.x + Math.cos(a) * 4.62, y + 6.4, r.z + Math.sin(a) * 4.62, WORN, -a + Math.PI / 2); // the cornice
      moss(d, r.x + Math.cos(a) * 4.62, y + 6.58, r.z + Math.sin(a) * 4.62, 1.6, 0.6);
    }
    // the floor's cracks have let in grass and leaves
    for (let i = 0; i < 10; i++) { const a = rand() * 6.28, rr = rand() * 5.5; d.box(0.08, 0.02, 1 + rand() * 2, r.x + Math.cos(a) * rr, y + 0.13, r.z + Math.sin(a) * rr, 0x5f5a4c, rand() * 3); }
    litter(d, rand, r.x, r.z, 11, 11, 34, () => y + 0.12);
    moss(d, r.x - 2.5, y + 0.12, r.z + 2, 2.4, 1.6);
  },

  chapel(b, d, r, y, rand) {
    const w = 8, dd = 13;
    // the floor, its slabs heaved by roots
    for (let i = 0; i < 26; i++) {
      const x = r.x + (rand() - 0.5) * (w - 1), z = r.z + (rand() - 0.5) * (dd - 1);
      d.box(1.0 + rand() * 0.4, 0.12, 0.9 + rand() * 0.3, x, y - 0.06, z, rand() < 0.3 ? AGED : WORN, rand() * 0.3, (rand() - 0.5) * 0.1);
    }
    // the east end stands tall, with a window in it
    wall(b, r.x - 2.9, r.z - dd / 2, y, 2.2, 8, 0.8);
    wall(b, r.x + 2.9, r.z - dd / 2, y, 2.2, 6.5, 0.8);
    b.box(3.6, 1.2, 0.8, r.x, y + 5.3, r.z - dd / 2, STONE);
    wall(b, r.x, r.z - dd / 2, y, 3.6, 1.6, 0.8, WORN);
    archStones(b, r.x, y + 4.1, r.z - dd / 2, 1.6, 1.0, 0.85, 0.35, 7); // the window's head, its tracery gone
    b.box(0.18, 3.3, 0.5, r.x, y + 0.9, r.z - dd / 2, WORN);           // but for the mullion, standing on the sill
    ivyDown(d, rand, r.x - 2.9, y + 7.6, r.z - dd / 2 + 0.42, 2, 5, 0, 1);
    for (const s of [-1, 1]) { // side walls, broken down toward the west, with a buttress or two
      for (let i = 0; i < 4; i++) {
        const h = Math.max(0.6, 5 - i * 1.3 + (rand() - 0.5));
        const z = r.z - dd / 2 + 1.7 + i * 3.2;
        wall(b, r.x + s * w / 2, z, y, 0.8, h, 3.1, i % 2 ? WORN : STONE);
        if (i < 2) { b.box(0.9, h * 0.8, 0.9, r.x + s * (w / 2 + 0.8), y - 0.3, z + 1.55, WORN); addCircle(r.x + s * (w / 2 + 0.8), z + 1.55, 0.6); }
        if (h > 1.2) moss(d, r.x + s * w / 2, y - 0.3 + h, z, 0.7, 2.6);
        drift(d, rand, r.x + s * (w / 2 - 0.9), z, 2.6, false, y);
      }
    }
    // two steps up to the altar, a fallen bell, and stone benches gone to moss
    b.box(4.6, 0.2, 2.6, r.x, y - 0.05, r.z - dd / 2 + 2.3, WORN);
    b.box(2.2, 1.0, 1.1, r.x, y + 0.15, r.z - dd / 2 + 2.6, STONE); // the altar
    b.box(2.5, 0.12, 1.3, r.x, y + 1.15, r.z - dd / 2 + 2.6, WORN);
    addCircle(r.x, r.z - dd / 2 + 2.6, 1.1);
    const bx = r.x + 2, bz = r.z - 1;
    d.add(new THREE.CylinderGeometry(0.25, 0.6, 0.9, 10, 1, true), 0x5c6a58, new THREE.Matrix4().makeRotationZ(1.3).setPosition(bx, y + 0.5, bz));
    for (let i = 0; i < 4; i++) {
      const z = r.z - 1 + i * 2.2;
      for (const s of [-1, 1]) if (rand() < 0.7) { b.box(2.2, 0.45, 0.5, r.x + s * 1.9, y - 0.05, z, rand() < 0.5 ? AGED : WORN, (rand() - 0.5) * 0.15); }
    }
    rubble(b, rand, r.x, r.z + 2, 14, 12);
    litter(d, rand, r.x, r.z, w - 1, dd - 1, 40);
  },

  waystone(b, d, r, y, rand) {
    b.box(2.2, 0.35, 2.2, r.x, y - 0.15, r.z, WORN);
    b.box(1.5, 0.35, 1.5, r.x, y + 0.2, r.z, STONE);
    const m = new THREE.Matrix4().makeRotationZ(0.07).setPosition(r.x, y + 0.5 + 1.9, r.z);
    b.add(new THREE.CylinderGeometry(0.28, 0.55, 3.8, 4, 6), STONE, m);
    b.add(new THREE.ConeGeometry(0.28 * 1.41, 0.4, 4), STONE, new THREE.Matrix4().makeRotationZ(0.07).setPosition(r.x - 0.14, y + 0.5 + 3.98, r.z));
    b.card(r.x + 0.4, y + 0.9, r.z + 0.1, 0.9, 1.2, 1, 0, 0.3, IVY, ATLAS.ivy, 0.5, [1, 0.3, 0]);
    addCircle(r.x, r.z, 0.9);
    // the letters, cut in lines on two faces
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) d.box(0.04, 0.05, 0.3 + rand() * 0.25, r.x + s * 0.43 - 0.05, y + 1.4 + k * 0.32, r.z, 0x5b564a, 0, 0, 0.07);
    // a bench for the traveller, and a trough
    b.box(2.4, 0.45, 0.6, r.x + 3, heightAt(r.x + 3, r.z + 1.6) - 0.05, r.z + 1.6, WORN, 0.2);
    for (const o of [-0.9, 0.9]) b.box(0.4, 0.45, 0.55, r.x + 3 + o, heightAt(r.x + 3 + o, r.z + 1.6) - 0.4, r.z + 1.6 - o * 0.2, STONE, 0.2);
    addSolid({ minX: r.x + 1.9, maxX: r.x + 4.1, minZ: r.z + 1.2, maxZ: r.z + 2, bottom: y - 2, top: y + 0.4 });
    const tx = r.x - 2.6, tz = r.z + 1.8, ty = heightAt(tx, tz);
    b.box(1.8, 0.6, 0.9, tx, ty - 0.2, tz, WORN, -0.3);
    d.box(1.5, 0.04, 0.6, tx, ty + 0.36, tz, 0x6b5a38, -0.3);
    addCircle(tx, tz, 0.9);
    moss(d, r.x, y + 0.56, r.z, 1.3, 1.3);
    rubble(b, rand, r.x, r.z, 4, 6);
    litter(d, rand, r.x, r.z, 7, 7, 14);
  },

  gate(b, d, r, y, rand) {
    // a threshold of worn steps under the arch, and paving running through it
    b.box(4.4, 0.25, 2.2, r.x, y - 0.12, r.z, WORN);
    for (const s of [-1, 1]) b.box(4.0, 0.15, 0.9, r.x, y - 0.1, r.z + s * 1.5, WORN);
    for (let i = 0; i < 12; i++) {
      const z = r.z + (rand() < 0.5 ? -1 : 1) * (2.2 + rand() * 6), x = r.x + (rand() - 0.5) * 3.4;
      d.box(0.9 + rand() * 0.6, 0.1, 0.7 + rand() * 0.4, x, heightAt(x, z) - 0.05, z, WORN, rand() * 0.4);
    }
    for (const s of [-1, 1]) {
      wall(b, r.x + s * 2.6, r.z, y, 1.5, 4.6, 1.5, STONE, false);
      b.box(1.8, 0.3, 1.75, r.x + s * 2.6, y + 4.0, r.z, WORN); // the impost
      addCircle(r.x + s * 2.6, r.z, 1.0);
      ivyDown(d, rand, r.x + s * 3.36, y + 4.2, r.z, 1.2, 3.6, s, 0);
      // the wall it pierced, each piece on its own ground, lower as it goes
      for (let i = 0; i < 3; i++) {
        const x = r.x + s * (4.6 + i * 2.4), gy = heightAt(x, r.z), h = Math.max(0.5, 2.6 - i * 0.9 + (rand() - 0.5) * 0.5);
        wall(b, x, r.z, gy, 2.4, h, 0.9, i % 2 ? WORN : STONE);
        if (h > 0.8) moss(d, x, gy - 0.3 + h, r.z, 2, 0.8);
      }
      // and beyond, only its footing, a line of stones in the grass
      for (let k = 0; k < 6; k++) {
        const x = r.x + s * (11.5 + k * 1.4), gy = heightAt(x, r.z);
        if (rand() < 0.25) continue;
        b.box(1.2, 0.35, 0.9, x, gy - 0.22, r.z + (rand() - 0.5) * 0.2, k % 3 ? WORN : AGED, (rand() - 0.5) * 0.2);
      }
    }
    // the arch has lost a stone or two from one side; they lie below it
    const lost = rand() < 0.5 ? 1 + Math.floor(rand() * 2) : -1;
    b.missing = (i) => i === lost;
    archStones(b, r.x, y + 4.3, r.z, 3.7, 2.0, 1.4, 0.8, 9);
    b.missing = null;
    if (lost >= 0) block(b, rand, r.x - 1.6, r.z + 1.9, 1.0, 0.5, 0.8);
    ivyDown(d, rand, r.x, y + 6.9, r.z + 0.72, 1.6, 1.4, 0, 1);
    rubble(b, rand, r.x, r.z + 2.5, 6, 9);
    litter(d, rand, r.x, r.z, 14, 8, 30);
    stones(d, rand, r.x, r.z, 18, 8);
  },

  tower(b, d, r, y, rand) {
    const R = 4.2, N = 10;
    for (let i = 0; i < N; i++) {
      if (i === 2) continue; // the doorway
      const a = (i / N) * Math.PI * 2, x = r.x + Math.cos(a) * R, z = r.z + Math.sin(a) * R;
      const h = 5 + Math.max(0, Math.sin(a * 1.3 + 2)) * 5 + rand();
      b.box(2.8, h, 1.2, x, y - 0.4, z, i % 4 === 0 ? WORN : STONE, -a + Math.PI / 2);
      b.box(3.0, 0.5, 1.4, x, y - 0.4, z, WORN, -a + Math.PI / 2); // the batter at its foot
      addCircle(x, z, 1.2);
      // arrow-slits, dark on both faces, and the ivy that has the tower now
      if (h > 6) for (const s of [-1, 1]) d.box(0.16, 1.1, 0.05, x + Math.cos(a) * s * 0.62, y + 3.2, z + Math.sin(a) * s * 0.62, 0x1d1c1a, -a + Math.PI / 2);
      if (rand() < 0.45) ivyDown(d, rand, x + Math.cos(a) * 0.64, y - 0.4 + h, z + Math.sin(a) * 0.64, 2.2, h * 0.8, Math.cos(a), Math.sin(a));
      moss(d, x, y - 0.4 + h, z, 2.4, 1);
    }
    // inside: the stair that wound up the wall, broken off; a heap of the fallen upper floors; nests
    for (let k = 0; k < 8; k++) {
      const a = 0.9 + k * 0.42, x = r.x + Math.cos(a) * 2.9, z = r.z + Math.sin(a) * 2.9;
      b.box(1.3, 0.3 + k * 0.42, 0.7, x, y - 0.2, z, WORN, -a);
    }
    addSolid({ minX: r.x + 0.2, maxX: r.x + 3.6, minZ: r.z + 0.2, maxZ: r.z + 3.6, bottom: y - 2, top: y + 0.6 }); // (the first steps only)
    rubble(b, rand, r.x - 1, r.z - 1, 9, 5);
    for (let k = 0; k < 4; k++) {
      const a = rand() * 6.28, x = r.x + Math.cos(a) * 3.4, z = r.z + Math.sin(a) * 3.4;
      d.lump(0.35, x, y + 4 + rand() * 3, z, 0x5d4a30, 1, 0.45, 1, 1, 0.4); // nests, in the holes where beams were
    }
    litter(d, rand, r.x, r.z, 6, 6, 18);
    rubble(b, rand, r.x, r.z, 9, 13);
    stones(d, rand, r.x, r.z, 16, 8);
  },

  baths(b, d, r, y, rand) {
    // A sunken court: the ground is dug down (relicSites.js levelGround), a paved
    // walk runs round it at the old level, its inner face a wall down to the
    // floor of the court, one stair down at the south end. In the middle a pool,
    // its kerb whole, holding only leaves.
    const { hw, hd, walk } = COURT, floor = y;
    const ox = hw + walk + 1.6, oz = hd + walk + 1.6;
    const level = (heightAt(r.x - ox, r.z) + heightAt(r.x + ox, r.z) + heightAt(r.x, r.z - oz) + heightAt(r.x, r.z + oz)) / 4;
    const top = level + 0.12, H = top - floor + 0.3;
    // the walk, in four pieces, from below the floor to the old level
    const pieces = [
      [2 * (hw + walk), walk, r.x, r.z - hd - walk / 2], [2 * (hw + walk), walk, r.x, r.z + hd + walk / 2],
      [walk, 2 * hd, r.x - hw - walk / 2, r.z], [walk, 2 * hd, r.x + hw + walk / 2, r.z],
    ];
    for (const [w, dd, x, z] of pieces) {
      b.box(w, H, dd, x, floor - 0.3, z, STONE);
      addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2, bottom: floor - 2, top });
    }
    // slabs on the walk, some lifted, some gone; a coping along the inner edge, broken where the stair goes down
    for (const [w, dd, x, z] of pieces) {
      const nx = Math.round(w / 1.2), nz = Math.round(dd / 1.2);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (rand() < 0.18) continue;
        const sx = x - w / 2 + (i + 0.5) * (w / nx), sz = z - dd / 2 + (j + 0.5) * (dd / nz);
        d.box(w / nx - 0.08, 0.08, dd / nz - 0.08, sx, top - 0.02 + (rand() < 0.15 ? 0.05 : 0), sz, rand() < 0.25 ? AGED : WORN, 0, (rand() - 0.5) * 0.04, (rand() - 0.5) * 0.04);
      }
    }
    for (const s of [-1, 1]) {
      b.box(2 * hw + 0.3, 0.22, 0.4, r.x, top, r.z + s * (hd + 0.15), WORN);
      if (s < 0) b.box(0.4, 0.22, 2 * hd, r.x - hw - 0.15, top, r.z, WORN); else b.box(0.4, 0.22, 2 * hd, r.x + hw + 0.15, top, r.z, WORN);
    }
    // niches in the long walls, where statues stood, and a spout in the north wall that fed the pool
    for (const s of [-1, 1]) for (const o of [-3.5, 3.5]) {
      const x = r.x + s * (hw - 0.02), z = r.z + o;
      d.box(0.06, 1.0, 0.9, x, floor + 0.3, z, 0x2f2d29);
      d.box(0.12, 0.12, 1.2, x - s * 0.03, floor + 1.3, z, WORN);
    }
    d.box(0.5, 0.4, 0.5, r.x, top - 0.75, r.z - hd + 0.2, STONE);
    d.box(0.7, top - floor - 0.6, 0.04, r.x, floor + 0.05, r.z - hd + 0.03, 0x6f6a58); // the stain below it
    // the stair down, at the south end
    const steps = 5, rise = (top - floor) / (steps + 1);
    for (let i = 0; i < steps; i++) {
      const z = r.z + hd - 0.45 * (i + 0.5), t = top - rise * (i + 1);
      b.box(3, t - floor + 0.3, 0.45, r.x, floor - 0.3, z, i % 2 ? WORN : STONE);
      addSolid({ minX: r.x - 1.5, maxX: r.x + 1.5, minZ: z - 0.225, maxZ: z + 0.225, bottom: floor - 2, top: t });
    }
    // the floor of the court, paved round the pool
    for (let i = 0; i < 40; i++) {
      const x = r.x + (rand() - 0.5) * (2 * hw - 0.6), z = r.z + (rand() - 0.5) * (2 * hd - 3);
      if (Math.abs(x - r.x) < 3.3 && Math.abs(z - r.z) < 4.8) continue;
      d.box(1.1 + rand() * 0.3, 0.1, 0.9 + rand() * 0.3, x, floor - 0.04, z, rand() < 0.3 ? AGED : WORN, rand() * 0.2);
    }
    // the pool: a kerb you can step over, and leaves where the water was, heaped deepest in the middle
    const pw = 3, pd = 4.4;
    for (const [w, dd, x, z] of [[2 * pw + 0.5, 0.5, r.x, r.z - pd], [2 * pw + 0.5, 0.5, r.x, r.z + pd], [0.5, 2 * pd, r.x - pw, r.z], [0.5, 2 * pd, r.x + pw, r.z]]) {
      b.box(w, 0.75, dd, x, floor - 0.3, z, WORN);
      addSolid({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2, bottom: floor - 2, top: floor + 0.45 });
    }
    d.kind = SURF.leaf;
    d.lump(1, r.x, floor + 0.05, r.z, 0x8a6a38, pw - 0.3, 0.35, pd - 0.3, 2, 0.15, [0, 0, 0]);
    d.kind = SURF.masonry;
    litter(d, rand, r.x, r.z, 2 * pw - 0.5, 2 * pd - 0.5, 70, (x, z) => floor + 0.32 * (1 - Math.max(Math.abs(x - r.x) / pw, Math.abs(z - r.z) / pd) ** 2));
    // leaves blown into every corner and along the foot of each wall; ivy hanging over the top
    for (const s of [-1, 1]) {
      drift(d, rand, r.x + s * (hw - 0.7), r.z + (rand() - 0.5) * 4, 2 * hd - 4, false, floor);
      drift(d, rand, r.x + s * 2.5, r.z - hd + 0.7, 3, true, floor);
      ivyDown(d, rand, r.x + s * hw, top + 0.1, r.z + (rand() - 0.5) * 8, 2.4, top - floor, -s, 0);
      ivyDown(d, rand, r.x + s * 3, top + 0.1, r.z - hd, 2, top - floor - 0.3, 0, 1);
    }
    litter(d, rand, r.x, r.z, 2 * hw, 2 * hd, 60, () => floor + 0.04);
    for (const [w, dd, x, z] of pieces) litter(d, rand, x, z, w, dd, Math.round(w * dd / 3), () => top + 0.08); // on the walk only
    // columns at the corners of the walk, two standing; a third lies in the court
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = r.x + sx * (hw + walk / 2), z = r.z + sz * (hd + walk / 2);
      column(b, x, z, top, sx * sz > 0 ? 3.8 : 0.6 + rand() * 1.2, 0.4, sx * sz > 0);
    }
    fallenColumn(b, r.x - 2.2, r.z + 2.5, floor + 0.05, 3.4, 0.7, 0.38);
    // the foot of the walk outside, where the land falls to meet it
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, x = r.x + Math.cos(a) * (hw + walk + 0.6) * 1.08, z = r.z + Math.sin(a) * (hd + walk + 0.6) * 1.06;
      addRock(d, x, heightAt(x, z) - 0.2, z, 0.5 + rand() * 0.5, rand() < 0.4 ? AGED : WORN, 2000 + i, { detail: 0, sy: 0.6, cuts: 5 });
    }
  },
};

export function buildRelics(scene, shadows) {
  for (const r of RELICS) {
    // Two meshes: the ruin itself, seen from afar, and the small things about
    // it (leaves, ivy, moss, loose stones, cut letters), drawn only near.
    const b = new GeoBuilder(Math.round(r.x * 3 + r.z), 0.08);
    const d = new GeoBuilder(Math.round(r.x * 5 + r.z), 0.1);
    b.kind = d.kind = SURF.masonry;
    BUILD[r.kind](b, d, r, heightAt(r.x, r.z), rng(Math.round(r.x + r.z * 5)));
    // (The geometry is in world space; the LOD stands at the ruin, so its
    // distance is measured from there, and its parts are set back by as much.)
    const y = heightAt(r.x, r.z), lod = new THREE.LOD();
    lod.position.set(r.x, y, r.z);
    const near = new THREE.Group(), far = b.mesh(materials.stone, shadows);
    near.add(far.clone(), d.mesh(materials.stone, shadows));
    near.position.set(-r.x, -y, -r.z);
    far.position.set(-r.x, -y, -r.z);
    lod.addLevel(near, 0);
    lod.addLevel(far, NEAR_DETAIL);
    scene.add(lod);
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

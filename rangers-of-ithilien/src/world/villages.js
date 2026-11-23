// The settlements as they come back to life (since v0.7): houses mended and
// roofed, smoke from their chimneys, plots cleared and sown in rows, a boat at
// the landing, and the people themselves, on their green or following the
// ranger home from the river. What stands is read from the saved state
// (systems/settlement.js) each time `sync` is called; the old ruins under it
// (world/farms.js) are left as they are, and the mended walls are built over them.

import * as THREE from 'three';
import { GeoBuilder, SURF, materials } from './build.js';
import { heightAt } from './terrain.js';
import { SITES } from './oldworks.js';
import { HOUSE } from './farms.js';
import { plantGeometry } from './herbs.js';
import { addSolid, addCircle } from './collision.js';
import { makeFigure, animateFigure } from '../entities/figure.js';
import { rng } from '../util/noise.js';
import { SETTLEMENTS, settlementBySite, homesteadBySite, stageOf, housesMended, cropsSown, homesteadsLived, STAGE_MAX } from '../systems/settlement.js';

const siteById = Object.fromEntries(SITES.map((s) => [s.id, s]));
const PLASTER = [0xe6e0cf, 0xddd5c0, 0xe9e4d6], THATCH = [0xb39556, 0xa88a4c, 0xbfa063], TIMBER = 0x5a4530, DOOR = 0x4a3524, STONE = 0x9a9484;
const SHOW = 260;  // people and fields are drawn within this of the ranger
const NEAR_CROP = 70; // nearer than this every plant in a field is drawn; further, a third of them

/** Looks for the settlers: plain country clothes, no arms. */
const FOLK = [
  { tunic: 0x7a5a3a, legs: 0x4a3c2c, skin: 0xdcae88, hair: 0x4a3020, cloak: null, sleeve: 0x6a4a30, belt: 0x3a2a1c },
  { tunic: 0x8a6a8a, legs: 0x8a6a8a, skin: 0xe8c0a0, hair: 0x6a4a28, cloak: null, skirt: true, longHair: true, belt: 0x5a4030 },
  { tunic: 0x5a6a7a, legs: 0x3a3a34, skin: 0xc89a78, hair: 0x2a1e16, cloak: 0x6a5a40, sleeve: 0x4a5a6a },
  { tunic: 0xb8a878, legs: 0xb8a878, skin: 0xe0b896, hair: 0xb08a4a, cloak: null, skirt: true, longHair: true, belt: 0x7a5a38 },
  { tunic: 0x6a7a4a, legs: 0x4a4032, skin: 0xd4a682, hair: 0x7a7a74, cloak: null, sleeve: 0x5a6a3a, belt: 0x3a2a1c },
  { tunic: 0xa05a3a, legs: 0xa05a3a, skin: 0xd8aa86, hair: 0x2a1a12, cloak: 0x4a4a3a, skirt: true, longHair: true },
];
/** Whoever speaks for a settlement wears something a little better. */
const REEVE = { tunic: 0x3f5a6a, legs: 0x2c2c30, skin: 0xd8aa86, hair: 0x5a5a56, cloak: 0x5a3a2a, sleeve: 0x3f5a6a, belt: 0xc9a84a, boots: 0x2a2018 };

function folk(look, scale = 1) {
  const f = makeFigure(look);
  f.scale.setScalar(scale);
  f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return f;
}

// ---- building ----

/** The floor of a mended house: level with the ground, or on a slope a little below its high side (a stone footing holds up the low side). */
export function houseFloor(hs) {
  const c = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => heightAt(hs.x + (a * hs.w) / 2, hs.z + (b * hs.d) / 2));
  const lo = Math.min(...c), hi = Math.max(...c), mean = c.reduce((n, h) => n + h, 0) / c.length;
  return { y: Math.max(mean, hi - 0.6), lo };
}

/**
 * A ruined house of oldworks.js mended: walls whole to the eaves, gables, a
 * thatched roof, a door and a chimney; on a slope, a stone footing under its low
 * side (since v0.7a; it was set on the lowest ground and half sunk in the hill).
 */
function mendHouse(b, rand, hs, chimneys, roofB = b, inn = false) {
  const { y, lo } = houseFloor(hs), E = y + 4.1, t = 0.82; // (above the tallest of the old walls, which are hidden inside)
  const long = hs.w >= hs.d, L = long ? hs.w : hs.d, D = long ? hs.d : hs.w; // ridge along the long side
  const plaster = PLASTER[Math.floor(rand() * PLASTER.length)], thatch = THATCH[Math.floor(rand() * THATCH.length)];
  const ry = long ? 0 : Math.PI / 2;
  const at = (u, v) => (long ? [hs.x + u, hs.z + v] : [hs.x + v, hs.z + u]); // u along the ridge, v across it
  b.kind = SURF.masonry;
  if (y - lo > 0.3) b.box(hs.w + t + 0.2, y - lo + 0.5, hs.d + t + 0.2, hs.x, lo - 0.5, hs.z, STONE); // the footing, down to the low side
  // the walls: a stone footing, plaster above it
  for (const s of [-1, 1]) {
    let [x, z] = at(0, (s * D) / 2);
    b.box(L + t, 1.0, t, x, y - 0.6, z, STONE, ry);
    b.box(L + t - 0.04, E - y - 0.4, t - 0.04, x, y + 0.4, z, plaster, ry);
    [x, z] = at((s * L) / 2, 0);
    b.box(t, 1.0, D + t, x, y - 0.6, z, STONE, ry);
    b.box(t - 0.04, E - y - 0.4, D + t - 0.04, x, y + 0.4, z, plaster, ry);
    // the gable over each end wall: a triangle, as tall as half the house is wide (45 degrees), faced both ways
    const half = D / 2 + t / 2, top = E + D / 2;
    for (const f of [-1, 1]) {
      const u = (s * L) / 2 + (f * t) / 2;
      const [ax, az] = at(u, -half), [bx, bz] = at(u, half), [cx, cz] = at(u, 0);
      b.tri(ax, E, az, bx, E, bz, cx, top, cz, plaster);
      b.tri(bx, E, bz, ax, E, az, cx, top, cz, plaster);
    }
  }
  // the roof: two thatched slabs at 45 degrees, overhanging the walls a little, and a ridge
  // (built apart when asked, so it can go on last)
  const wallsB = b;
  b = roofB;
  b.kind = SURF.plain;
  const over = 0.55, slope = (D / 2 + over) * Math.SQRT2, rise = D / 2, n = 0.15 * Math.SQRT1_2;
  for (const s of [-1, 1]) {
    const v = (s * (D / 2 + over)) / 2 + s * n, my = E + (rise - over) / 2 + n - 0.15;
    const [mx, mz] = at(0, v);
    if (long) b.box(L + 1.2, 0.3, slope, mx, my, mz, thatch, 0, (s * Math.PI) / 4, 0);
    else b.box(slope, 0.3, L + 1.2, mx, my, mz, thatch, 0, 0, (-s * Math.PI) / 4);
  }
  { const [rx, rz] = at(0, 0); b.box(long ? L + 1.3 : 0.5, 0.28, long ? 0.5 : L + 1.3, rx, E + rise - 0.02, rz, thatch); }
  b = wallsB;
  // a door and two shuttered windows on the door's side, or a long side
  b.kind = SURF.wood;
  const doorV = hs.door === undefined ? 1 : long ? (hs.door === 1 ? 1 : -1) : (hs.door === 3 ? 1 : -1);
  const onLong = hs.door === undefined || (long ? hs.door <= 1 : hs.door >= 2);
  let door;
  if (onLong) {
    const [dx, dz] = at(0.6, doorV * (D / 2 + t / 2 + 0.03));
    door = { x: dx, z: dz, nx: long ? 0 : doorV, nz: long ? doorV : 0, ax: long ? 1 : 0, az: long ? 0 : 1 };
    b.box(long ? 1.1 : 0.08, 2.1, long ? 0.08 : 1.1, dx, y - 0.05, dz, DOOR);
    for (const w of [-1, 1]) {
      const [wx, wz] = at(0.6 + w * Math.min(2.4, L / 2 - 1), doorV * (D / 2 + t / 2 + 0.03));
      b.box(long ? 0.8 : 0.08, 0.8, long ? 0.08 : 0.8, wx, y + 1.5, wz, TIMBER);
    }
  } else {
    const [dx, dz] = at(doorV * (L / 2 + t / 2 + 0.03), 0);
    door = { x: dx, z: dz, nx: long ? doorV : 0, nz: long ? 0 : doorV, ax: long ? 0 : 1, az: long ? 1 : 0 };
    b.box(long ? 0.08 : 1.1, 2.1, long ? 1.1 : 0.08, dx, y - 0.05, dz, DOOR);
  }
  if (inn) { // the inn's sign: a board hung from a bracket beside the door, and a lantern
    const sx = door.x + door.ax * 1.5, sz = door.z + door.az * 1.5, ry = Math.atan2(door.nx, door.nz);
    b.box(0.08, 0.08, 1.0, sx + door.nx * 0.5, y + 2.75, sz + door.nz * 0.5, TIMBER, ry);
    b.box(0.03, 0.3, 0.03, sx + door.nx * 0.9, y + 2.55, sz + door.nz * 0.9, 0x3a3a3e);
    b.box(0.9, 0.62, 0.06, sx + door.nx * 0.9, y + 1.85, sz + door.nz * 0.9, 0x2f5a3a, ry + Math.PI / 2);
    b.box(0.74, 0.46, 0.08, sx + door.nx * 0.9, y + 1.93, sz + door.nz * 0.9, 0xc9a84a, ry + Math.PI / 2);
    b.box(0.34, 0.3, 0.1, sx + door.nx * 0.9, y + 2.0, sz + door.nz * 0.9, 0x2f5a3a, ry + Math.PI / 2);
    b.cyl(0.1, 0.12, 0.3, door.x - door.ax * 1.0 + door.nx * 0.25, y + 2.2, door.z - door.az * 1.0 + door.nz * 0.25, 0xf0c060, 6);
  }
  // a stone chimney through the ridge at one end, with smoke over it
  b.kind = SURF.masonry;
  const cs = rand() < 0.5 ? -1 : 1, [cx, cz] = at(cs * (L / 2 - 0.9), 0);
  b.box(0.9, E + rise + 1.1 - (E - 0.5), 0.9, cx, E - 0.5, cz, STONE);
  chimneys.push({ x: cx, y: E + rise + 1.1, z: cz });
  return { door, y };
}

/** The well on the green, roofed over with a winding beam. */
function wellHouse(b, x, z) {
  const y = heightAt(x, z);
  b.kind = SURF.wood;
  for (const s of [-1, 1]) b.box(0.18, 2.4, 0.18, x + s * 1.2, y + 0.4, z, TIMBER);
  b.box(2.8, 0.14, 0.14, x, y + 2.15, z, TIMBER);
  b.box(0.1, 0.9, 0.1, x, y + 1.25, z, 0x3a3028); // the rope
  b.cyl(0.22, 0.2, 0.32, x, y + 1.0, z, 0x6a4a2a, 8); // and the bucket
  b.kind = SURF.plain;
  for (const s of [-1, 1]) b.box(3.0, 0.1, 1.2, x, y + 2.55, z + s * 0.42, THATCH[0], 0, s * 0.7);
}

/** The market cross set up again: a new shaft and arms on the old steps. */
function crossMended(b, x, z) {
  const y = heightAt(x, z);
  b.kind = SURF.masonry;
  b.cyl(0.24, 0.3, 4.2, x, y + 0.85, z, HOUSE[0], 8);
  b.box(1.5, 0.3, 0.3, x, y + 4.2, z, HOUSE[0]);
  b.box(0.3, 0.9, 0.3, x, y + 4.5, z, HOUSE[0]);
  for (let i = 0; i < 10; i++) { const a = i * 0.63; b.dot(0.1, x + Math.cos(a) * 1.5, y + 0.55, z + Math.sin(a) * 1.5, i % 2 ? 0xe8d04a : 0xd8402a); }
}

/** Flowers in beds before the mended houses. */
function gardens(b, rand, site, count) {
  b.kind = SURF.plain;
  for (const k of site.houses.slice(0, count)) {
    const hs = k, y = hs.y ?? heightAt(hs.x, hs.z);
    for (let i = 0; i < 8; i++) {
      const x = hs.x + (rand() - 0.5) * (hs.w + 2), z = hs.z + (hs.d / 2 + 1.1) * (rand() < 0.5 ? -1 : 1);
      b.dot(0.09, x, heightAt(x, z) + 0.25, z, [0xd8402a, 0xe8d04a, 0xf0ece0, 0xb070c0][i % 4]);
      void y;
    }
  }
}

/** A plot new-cleared and sown: tilled earth in furrows, a fence of posts and rails, and the crop in rows. */
function plotGround(rect, rand) {
  const b = new GeoBuilder(Math.round(rect.minX + rect.minZ), 0.05);
  b.kind = SURF.plain;
  const w = rect.maxX - rect.minX, d = rect.maxZ - rect.minZ, along = w >= d;
  const nx = Math.ceil(w), nz = Math.ceil(d), sx = w / nx, sz = d / nz;
  const H = (x, z) => heightAt(x, z) + 0.06;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = rect.minX + i * sx, z0 = rect.minZ + j * sz, x1 = x0 + sx, z1 = z0 + sz;
      const furrow = (along ? j : i) % 2 === 0, c = furrow ? 0x5a4630 : 0x6e563a;
      const a = [x0, H(x0, z0), z0], bb = [x1, H(x1, z0), z0], cc = [x1, H(x1, z1), z1], dd = [x0, H(x0, z1), z1];
      b.tri(...a, ...dd, ...cc, c); b.tri(...a, ...cc, ...bb, c);
    }
  }
  b.kind = SURF.wood;
  const post = (x, z) => { const y = heightAt(x, z); b.box(0.14, 1.25, 0.14, x, y - 0.2, z, TIMBER); return y; };
  const edge = (xa, za, xb, zb, gate) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 3)), a = Math.atan2(xb - xa, zb - za);
    for (let k = 0; k < n; k++) {
      const f0 = k / n, f1 = (k + 1) / n, x0 = xa + (xb - xa) * f0, z0 = za + (zb - za) * f0, x1 = xa + (xb - xa) * f1, z1 = za + (zb - za) * f1;
      const y0 = post(x0, z0);
      if (gate && k === Math.floor(n / 2)) continue; // a way in
      const y1 = heightAt(x1, z1);
      for (const h of [0.45, 0.85]) b.box(0.06, 0.1, Math.hypot(x1 - x0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2, 0x7a5e40, a, Math.atan2(y0 - y1, Math.hypot(x1 - x0, z1 - z0)));
    }
  };
  edge(rect.minX, rect.minZ, rect.maxX, rect.minZ, false);
  edge(rect.maxX, rect.minZ, rect.maxX, rect.maxZ, false);
  edge(rect.maxX, rect.maxZ, rect.minX, rect.maxZ, true);
  edge(rect.minX, rect.maxZ, rect.minX, rect.minZ, true);
  post(rect.minX, rect.minZ);
  void rand;
  return b.mesh(materials.wood, true);
}

const cropGeo = new Map();
/** The crop in rows: an instanced field of the seed plant, larger than the wild ones (it is tended), not to be gathered. */
function plotCrop(rect, crop, rand) {
  if (!cropGeo.has(crop)) cropGeo.set(crop, plantGeometry(crop));
  const w = rect.maxX - rect.minX, d = rect.maxZ - rect.minZ, along = w >= d;
  const rowGap = crop === 'thymeSeed' ? 1.3 : crop === 'poppySeed' ? 1.2 : 1.9, step = crop === 'thymeSeed' ? 0.9 : crop === 'poppySeed' ? 0.7 : 1.5;
  const spots = [];
  const U = along ? w : d, V = along ? d : w;
  for (let v = 1; v < V - 0.6; v += rowGap) {
    for (let u = 0.8; u < U - 0.6; u += step) {
      const x = rect.minX + (along ? u : v) + (rand() - 0.5) * 0.15, z = rect.minZ + (along ? v : u) + (rand() - 0.5) * 0.15;
      spots.push([x, z]);
    }
  }
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; } // so a share of them is spread over the field
  const mesh = new THREE.InstancedMesh(cropGeo.get(crop), materials.flatDouble, spots.length);
  const dummy = new THREE.Object3D(), scale = crop === 'thymeSeed' ? 2.2 : crop === 'poppySeed' ? 2.0 : 1.7;
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, heightAt(x, z) + 0.04, z);
    dummy.rotation.y = rand() * 6.28;
    dummy.scale.setScalar(scale * (0.85 + rand() * 0.3));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.full = spots.length;
  return mesh;
}

// ---- smoke from the chimneys ----

function smokeTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const PUFFS = 9, CHIMNEYS = 12;


// ---- what people carry, and what they build with ----

function propMesh(fill) {
  const b = new GeoBuilder(7, 0.05);
  fill(b);
  const m = b.mesh(materials.wood, true);
  m.visible = false;
  return m;
}
/** Things a person may have about them: a hammer in the right hand, a plank held before them, a sack on the back. */
function equip(f, o = {}) {
  const l = f.limbs;
  f.props = {};
  f.props.hammer = propMesh((b) => {
    b.kind = SURF.wood;
    b.box(0.035, 0.035, 0.42, 0, -0.018, 0.12, 0x7a5a38);
    b.kind = SURF.metal;
    b.box(0.07, 0.07, 0.17, 0, -0.035, 0.34, 0x5a5a60, Math.PI / 2);
  });
  f.props.hammer.position.set(0, -0.3, 0.02);
  l.elbowR.add(f.props.hammer);
  f.props.plank = propMesh((b) => {
    b.kind = SURF.wood;
    b.box(1.7, 0.05, 0.22, 0, 0, 0, 0xb08a5a, 0.1);
    b.box(1.5, 0.05, 0.2, 0.05, 0.05, 0.02, 0xa27c4c, -0.05);
  });
  f.props.plank.position.set(0, 0.22, 0.3);
  l.body.add(f.props.plank);
  f.props.sack = propMesh((b) => {
    b.kind = SURF.cloth;
    b.blob(0.2, 0, 0, 0, o.sackColor ?? 0xb8a878, 1.1, 1.3, 0.8, 1);
    b.blob(0.08, 0, 0.26, 0, 0x8a7a5a, 1, 1, 1);
  });
  f.props.sack.position.set(0, 0.38, -0.26);
  l.body.add(f.props.sack);
  return f;
}
const SACKS = [0xb8a878, 0x8a6a4a, 0x7a8a9a, 0xc8b890, 0x9a7a5a];

/** A handcart, two-wheeled, piled with bundles and a chest: one of the settlers pushes it home. */
function handcart() {
  const b = new GeoBuilder(31, 0.06);
  b.kind = SURF.wood;
  b.box(1.2, 0.12, 1.7, 0, 0.55, 0, 0x7a5a38);
  for (const s of [-1, 1]) {
    b.box(0.08, 0.35, 1.7, s * 0.6, 0.6, 0, 0x6a4a2e);
    b.box(0.07, 0.07, 1.3, s * 0.42, 0.62, -1.4, 0x6a4a2e, 0, -0.25); // the handles, toward whoever pushes
  }
  b.box(0.9, 0.06, 0.06, 0, 0.45, -2.0, 0x6a4a2e);
  b.box(0.7, 0.45, 0.5, -0.15, 0.67, 0.4, 0x5a4024); // a chest
  b.kind = SURF.cloth;
  [[0.25, 0.85, -0.3, 0xb8a878], [-0.2, 0.85, -0.35, 0x8a6a4a], [0.3, 0.8, 0.45, 0x7a8a9a], [0, 1.15, 0, 0xc8b890]].forEach(([x, y, z, c]) => b.blob(0.27, x, y, z, c, 1.2, 0.8, 1));
  b.kind = SURF.wood;
  const g = new THREE.Group();
  g.add(b.mesh(materials.wood, true));
  for (const s of [-1, 1]) {
    const w = new GeoBuilder(32, 0.04);
    w.kind = SURF.wood;
    w.cyl(0.45, 0.45, 0.09, 0, -0.045, 0, 0x4a3524, 12);
    w.cyl(0.08, 0.08, 0.14, 0, -0.07, 0, 0x3a2a1c, 6);
    const wm = w.mesh(materials.wood, true);
    wm.rotation.z = Math.PI / 2;
    wm.position.set(s * 0.7, 0.45, 0.1);
    g.add(wm);
    (g.userData.wheels ??= []).push(wm);
  }
  g.name = 'villages';
  return g;
}

/** Scaffolding round a house going up: poles, ledgers at two heights, boards. */
function scaffold(hs, y) {
  const b = new GeoBuilder(Math.round(hs.x), 0.06);
  b.kind = SURF.wood;
  const x0 = hs.x - hs.w / 2 - 1, x1 = hs.x + hs.w / 2 + 1, z0 = hs.z - hs.d / 2 - 1, z1 = hs.z + hs.d / 2 + 1, H = 5.4;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [hs.x, z0], [hs.x, z1], [x0, hs.z], [x1, hs.z]]) b.box(0.12, H + 0.6, 0.12, x, heightAt(x, z) - 0.3, z, 0x8a6a42);
  for (const h of [1.8, 3.6]) {
    b.box(x1 - x0, 0.1, 0.1, hs.x, y + h, z0, 0x7a5a38); b.box(x1 - x0, 0.1, 0.1, hs.x, y + h, z1, 0x7a5a38);
    b.box(0.1, 0.1, z1 - z0, x0, y + h, hs.z, 0x7a5a38); b.box(0.1, 0.1, z1 - z0, x1, y + h, hs.z, 0x7a5a38);
  }
  b.box(x1 - x0 - 0.4, 0.06, 0.5, hs.x, y + 3.7, z0 + 0.3, 0xb08a5a);
  b.box(x1 - x0 - 0.4, 0.06, 0.5, hs.x, y + 3.7, z1 - 0.3, 0xb08a5a);
  const m = b.mesh(materials.wood, true);
  m.name = 'villages';
  return m;
}

/** Where to stand to work on a house: round its walls, a little out from them, facing in. */
function workSpots(hs) {
  const out = [], ox = hs.w / 2 + 1.5, oz = hs.d / 2 + 1.5;
  for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-0.55, -1], [0.55, 1], [-1, 0.5], [1, -0.5]]) {
    const x = hs.x + a * ox, z = hs.z + b * oz;
    out.push({ x, z, face: Math.atan2(hs.x - x, hs.z - z) });
  }
  return out;
}

const turnTo = (fig, want, k) => { let t = want - fig.rotation.y; t = Math.atan2(Math.sin(t), Math.cos(t)); fig.rotation.y += t * k; };

/** A settlement's storekeeper, and the goodwife who speaks for a farm. */
const TRADER = { tunic: 0x8a5a2a, legs: 0x8a5a2a, skin: 0xe0b48e, hair: 0x5a3a20, cloak: null, skirt: true, longHair: true, belt: 0x3a2a1c, sleeve: 0x6a4a2a };
const GOODWIFE = { tunic: 0x3f5a6a, legs: 0x3f5a6a, skin: 0xd8aa86, hair: 0x8a8a84, cloak: 0x5a3a2a, skirt: true, longHair: true, belt: 0xc9a84a };
/** Who comes off a boat, in order: whoever speaks for them, the storekeeper, then the rest (two of them children; the last pushes the cart). */
function settlerLook(s, i) {
  if (i === 0) return s.kind === 'hamlet' ? REEVE : GOODWIFE;
  if (i === 1) return TRADER;
  return FOLK[i % FOLK.length];
}
const isChild = (i) => i === 4 || i === 8;

export class Villages {
  constructor(scene, shadows = true) {
    this.scene = scene;
    this.shadows = shadows;
    this.places = new Map(); // site id -> place (see buildPlace)
    this.boats = new Map();  // site id -> boat mesh
    this.escort = null;      // { site, people, trail, following, cart }
    this.arrivals = new Map(); // site id -> { people, cart }: the settlers just come home, handed over whole
    this.smokePos = new Float32Array(PUFFS * CHIMNEYS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({ map: smokeTexture(), size: 5, color: 0xe8e4dc, transparent: true, opacity: 0.45, depthWrite: false }));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 7;
    this.smoke.name = 'villages';
    scene.add(this.smoke);
    this.smoking = [];
  }

  /**
   * Build whatever has changed since the last call. With `animate` (anything
   * that happens in play, not the loading of a save) what is new is built by the
   * people, a piece at a time: the well, then the houses one by one, the cross at
   * the last. Returns the plots newly sown.
   */
  sync(state, animate = false) {
    const sown = [];
    const want = new Map(); // site id -> stage (-1 for a homestead)
    for (const s of SETTLEMENTS) { const st = stageOf(state, s.site); if (st >= 0) want.set(s.site, st); }
    for (const id of homesteadsLived(state)) want.set(id, -1);
    for (const [id, stage] of want) {
      let p = this.places.get(id);
      if (!p) p = this.buildPlace(state, id);
      if (p.stage !== stage) this.dress(p, stage);
      // what should stand: the well (a village's), the houses, the cross once the place is whole
      const s = settlementBySite[id], hamlet = siteById[id].kind === 'hamlet';
      const order = s ? s.houses : homesteadBySite[id].houses;
      const jobs = [];
      if (s && hamlet) jobs.push({ type: 'well' });
      for (const i of order.slice(0, s ? housesMended(state, id) : 1)) jobs.push({ type: 'house', i });
      if (s && hamlet && stage >= STAGE_MAX) jobs.push({ type: 'cross' });
      for (const j of jobs) {
        const k = jobKey(j);
        if (p.done.has(k) || p.queue.some((q) => jobKey(q) === k) || (p.build && jobKey(p.build.job) === k)) continue;
        if (animate) p.queue.push(j); else this.raise(p, j, 1);
      }
      // plots
      const crops = s ? cropsSown(state, id) : [homesteadBySite[id].crop];
      const rects = s ? s.plots : [homesteadBySite[id].plot];
      for (let k = p.plots.length; k < crops.length; k++) {
        if (!rects[k]) continue;
        const r = rects[k], prand = rng(Math.round(r.minX * 3 + r.minZ));
        const ground = plotGround(r, prand), mesh = plotCrop(r, crops[k], prand);
        p.group.add(ground, mesh);
        p.plots.push({ rect: r, crop: crops[k], mesh, x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
        sown.push(r);
      }
    }
    // the boat at the landing, once its settlers have been sent for (and left there after)
    for (const s of SETTLEMENTS) {
      const sent = state.quests.active.includes('s-' + s.province) || state.quests.done.includes('s-' + s.province) || state.settled.includes(s.site);
      if (sent && !this.boats.has(s.site)) this.buildBoat(s);
    }
    return sown;
  }

  /**
   * A place newly lived in, and its people. Settlers just led home are handed
   * over whole (the same people, where they stand, with their cart); otherwise
   * (a save loaded) they are made, about the place.
   */
  buildPlace(state, id) {
    const s = settlementBySite[id], site = siteById[id];
    const rand = rng(Math.round(site.x * 7 + site.z * 3));
    const group = new THREE.Group();
    group.name = 'villages';
    this.scene.add(group);
    const hamlet = site.kind === 'hamlet';
    const home = hamlet ? { x: site.x - 1, z: site.z + 2, r: 11 } : { x: site.x, z: site.z + site.houses[0].d / 2 + 3.5, r: 4 };
    const goods = hamlet ? { x: site.x + 2, z: site.z - 9 } : { x: site.x + site.houses[0].w / 2 + 4, z: site.z - 2 };
    const order = s ? s.houses : homesteadBySite[id].houses;
    const p = {
      site: id, settlement: !!s, x: site.x, z: site.z, group, home, goods, rand,
      inn: s ? order[hamlet ? Math.min(1, order.length - 1) : 0] : null, // a village's second house is its inn; a farm's bed is in the farmhouse
      done: new Set(), houses: new Map(), queue: [], build: null, chimneys: [], plots: [], people: [], stage: null, extras: null, cart: null,
    };
    // where the reeve and the storekeeper keep to: by the well (a farm: before the door), and beside the cart
    const posts = {
      reeve: hamlet ? { x: site.x - 1.5, z: site.z + 7.5 } : { x: home.x + 3.5, z: home.z + 1 }, // (a farm's, before the house but clear of its door)
      trader: { x: goods.x - 1.6, z: goods.z + 1.2 },
    };
    const came = this.arrivals.get(id);
    this.arrivals.delete(id);
    const n = s ? (hamlet ? 12 : 7) : 2;
    for (let i = 0; i < n; i++) {
      const role = s && i === 0 ? 'reeve' : s && i === 1 ? 'trader' : null;
      const c = came?.people[i];
      let f, x, z, small;
      if (c) { // the settler who walked here, just as they are
        f = c.fig; x = c.x; z = c.z; small = c.small;
        f.props.sack.visible = false; // (put down: they are home)
      } else {
        small = s ? isChild(i) : false;
        f = equip(folk(s ? settlerLook(s, i) : FOLK[(i + Math.floor(site.x)) % FOLK.length], small ? 0.66 : 0.95 + rand() * 0.08));
        const post = role && posts[role], a = rand() * 6.28, r = rand() * home.r;
        x = post ? post.x : home.x + Math.cos(a) * r; z = post ? post.z : home.z + Math.sin(a) * r;
      }
      f.position.set(x, heightAt(x, z), z);
      group.add(f); // (from the scene, if they came with the ranger)
      p.people.push({ fig: f, x, z, tx: x, tz: z, wait: rand() * 4, heading: f.rotation.y, speed: 0, small, role, post: role ? posts[role] : null,
        pusher: !!c?.pusher, job: i % 3 === 2 ? 'carry' : 'hammer', phase: rand() * 6.28 });
    }
    for (const r of Object.values(posts)) if (s) addCircle(r.x, r.z, 0.45); // (they stand still there; walk round them)
    // their cart: pushed here by whoever brought it, else standing at their goods
    if (came?.cart) { p.cart = came.cart; p.cartAt = goods; }
    else { p.cart = handcart(); p.cart.position.set(goods.x, heightAt(goods.x, goods.z), goods.z); p.cart.rotation.y = 0.4; }
    group.add(p.cart);
    this.places.set(id, p);
    void state;
    return p;
  }

  /** What a place has about it at its stage that is not built by hand: flowers before the doors, once it is whole. */
  dress(p, stage) {
    if (p.extras) { p.group.remove(p.extras); p.extras.geometry.dispose(); p.extras = null; }
    p.stage = stage;
    if (stage < STAGE_MAX) return;
    const site = siteById[p.site], b = new GeoBuilder(Math.round(site.x + site.z * 2), 0.06);
    gardens(b, rng(Math.round(site.z * 5 + stage)), site, site.houses.length);
    p.extras = b.mesh(materials.stone, this.shadows);
    p.group.add(p.extras);
  }

  /** Something going up: `k` from 0 (just begun) to 1 (finished). A house's walls rise, then its thatch; a well or a cross rises whole. */
  raise(p, job, k) {
    const key = jobKey(job);
    let h = p.houses.get(key);
    const holder = (mesh, at) => { const g = new THREE.Group(); g.position.set(0, at, 0); mesh.position.set(0, -at, 0); g.add(mesh); p.group.add(g); return g; };
    if (!h) {
      const site = siteById[p.site];
      if (job.type === 'house') {
        const hs = site.houses[job.i], { y } = houseFloor(hs), E = y + 4.1;
        const b = new GeoBuilder(Math.round(hs.x + hs.z), 0.06), rb = new GeoBuilder(Math.round(hs.x + hs.z) + 1, 0.06), chimneys = [];
        const info = mendHouse(b, rng(Math.round(hs.x * 3 + hs.z)), hs, chimneys, rb, p.settlement && job.i === p.inn);
        h = { walls: holder(b.mesh(materials.stone, this.shadows), y), roof: holder(rb.mesh(materials.stone, this.shadows), E), chimneys, door: info.door, y };
        if (job.i === p.inn) p.innDoor = { x: info.door.x + info.door.nx * 1.3, z: info.door.z + info.door.nz * 1.3 };
      } else {
        const b = new GeoBuilder(Math.round(site.x) + (job.type === 'well' ? 3 : 5), 0.06);
        const at = job.type === 'well' ? { x: site.x - 4, z: site.z + 5 } : { x: site.x + 9, z: site.z + 2 };
        if (job.type === 'well') wellHouse(b, at.x, at.z); else crossMended(b, at.x, at.z);
        h = { walls: holder(b.mesh(materials.stone, this.shadows), heightAt(at.x, at.z)), roof: null, chimneys: [], at };
      }
      p.houses.set(key, h);
    }
    const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 2);
    if (h.roof) {
      h.walls.scale.set(1, k >= 1 ? 1 : 0.04 + 0.96 * ease(k / 0.75), 1);
      h.roof.visible = k > 0.75;
      h.roof.scale.set(1, k >= 1 ? 1 : 0.1 + 0.9 * ease((k - 0.75) / 0.25), 1);
    } else h.walls.scale.set(1, k >= 1 ? 1 : 0.04 + 0.96 * ease(k), 1);
    if (k >= 1 && !p.done.has(key)) { p.done.add(key); p.chimneys.push(...h.chimneys); }
  }

  /** A broad river boat, afloat off the bank where the settlers land. */
  buildBoat(s) {
    const b = new GeoBuilder(Math.round(s.landing.z), 0.06);
    b.kind = SURF.wood;
    const x = s.boat.x, z = s.boat.z, y = -0.15;
    b.box(2.4, 0.5, 7.5, x, y, z, 0x6a4a2e);
    for (const side of [-1, 1]) b.box(0.18, 0.7, 7.8, x + side * 1.25, y + 0.2, z, 0x5a3e26);
    b.box(2.0, 0.6, 0.18, x, y + 0.2, z - 3.85, 0x5a3e26);
    b.box(1.6, 0.9, 0.2, x, y + 0.2, z + 3.9, 0x5a3e26, 0, 0.3);
    b.box(0.14, 4.5, 0.14, x, y + 0.4, z - 0.8, TIMBER);
    for (let i = 0; i < 3; i++) b.box(2.2, 0.08, 0.3, x, y + 0.5, z - 2.5 + i * 2.2, 0x7a5a3a); // thwarts
    b.box(0.08, 0.08, 4, x + 0.6, y + 0.6, z + 1, TIMBER, 0, 0.1); // an oar
    // a gangplank to the shore, and a rope to a stake on it
    const sx = s.landing.x - 3;
    b.box(Math.max(1, sx - x - 1.2), 0.08, 0.7, (x + 1.2 + sx) / 2, Math.max(y + 0.45, heightAt(sx, z) - 0.05) - 0.2, z + 2, 0x7a5a3a, 0, 0, Math.atan2(y + 0.45 - heightAt(sx, z), sx - x - 1.2) * 0.9);
    b.box(0.12, 1, 0.12, sx + 0.5, heightAt(sx + 0.5, z - 3) - 0.3, z - 3, TIMBER);
    addSolid({ minX: x - 1.35, maxX: x + 1.35, minZ: z - 3.9, maxZ: z + 3.9, bottom: -3, top: y + 0.9 });
    const mesh = b.mesh(materials.wood, this.shadows);
    mesh.name = 'villages';
    this.scene.add(mesh);
    this.boats.set(s.site, mesh);
  }

  // ---- the settlers on their way home ----

  /** Show a settlement's people waiting at `at` (their boat, or where they were left), or set them following. */
  setEscort(site, at, following) {
    if (this.escort && this.escort.site !== site) this.endEscort();
    if (!site) return;
    if (!this.escort) {
      const s = settlementBySite[site], many = s.kind === 'hamlet' ? 12 : 7, people = [];
      const rand = rng(site.length * 97 + Math.round(at.z));
      for (let i = 0; i < many; i++) {
        const small = isChild(i);
        const f = equip(folk(settlerLook(s, i), small ? 0.66 : 0.95 + rand() * 0.08), { sackColor: SACKS[i % SACKS.length] });
        const pusher = i === many - 1;
        f.props.sack.visible = !pusher && !small;
        // standing about in a loose crowd, inland of where they wait, a step apart
        const col = i % 4, row = Math.floor(i / 4);
        const x = at.x + col * 2.2 + (row % 2) * 1.1, z = at.z + (row - 1) * 2.4;
        f.position.set(x, heightAt(x, z), z);
        f.rotation.y = pusher ? Math.PI / 2 : -Math.PI / 2; // (the cart stands inland of whoever will push it)
        f.name = 'villages';
        this.scene.add(f);
        // they walk in pairs behind the ranger (whoever speaks for them first); the cart comes last, with room for it
        const lag = pusher ? 3.2 + Math.ceil((many - 1) / 2) * 1.9 + 1.8 : 2.6 + Math.floor(i / 2) * 1.9;
        people.push({ fig: f, x, z, heading: pusher ? Math.PI / 2 : -Math.PI / 2, speed: 0, small, lag, side: pusher ? 0 : (i % 2 ? 0.85 : -0.85), pusher });
      }
      const cart = handcart();
      this.scene.add(cart);
      this.escort = { site, people, trail: [], following, cart };
      this.pushCart(people.find((p) => p.pusher), cart);
    }
    this.escort.following = following;
    if (following) this.escort.trail = [];
  }

  /** The cart goes ahead of whoever pushes it, its wheels turning as it goes. */
  pushCart(q, c) {
    const fx = Math.sin(q.fig.rotation.y), fz = Math.cos(q.fig.rotation.y);
    const x = q.x + fx * 2.1, z = q.z + fz * 2.1;
    const moved = Math.hypot(x - c.position.x, z - c.position.z);
    c.position.set(x, heightAt(x, z), z);
    c.rotation.y = q.fig.rotation.y;
    for (const w of c.userData.wheels) w.rotation.x += moved / 0.45;
  }

  /** The settlers have come home: they are handed to their place as they are, to go to work from where they stand. */
  arrive() {
    const e = this.escort;
    if (!e) return;
    this.arrivals.set(e.site, { people: e.people, cart: e.cart });
    this.escort = null; // (the figures stay in the scene until their place takes them)
  }

  endEscort() {
    if (!this.escort) return;
    for (const p of this.escort.people) this.scene.remove(p.fig);
    this.scene.remove(this.escort.cart);
    this.escort = null;
  }

  /** Where the settlers are: the one leading. */
  escortAt() {
    const e = this.escort;
    return e ? { x: e.people[0].x, z: e.people[0].z } : null;
  }

  /**
   * Move the following settlers along the ranger's trail, each a little further
   * behind, two abreast, and never on top of one another. `hold` stops them where
   * they stand (a fight). Returns the distance from the ranger to the nearest.
   */
  updateEscort(dt, time, player, hold) {
    const e = this.escort;
    if (!e) return Infinity;
    const px = player.pos.x, pz = player.pos.z;
    if (e.following && !hold) {
      const last = e.trail[e.trail.length - 1];
      if (!last || Math.hypot(px - last.x, pz - last.z) > 0.8) e.trail.push({ x: px, z: pz, d: (last?.d ?? 0) + (last ? Math.hypot(px - last.x, pz - last.z) : 0) });
      if (e.trail.length > 1500) e.trail.splice(0, 500);
    }
    let nearest = Infinity;
    const total = e.trail.length ? e.trail[e.trail.length - 1].d : 0;
    for (const p of e.people) {
      let tx = p.x, tz = p.z;
      const want = total - p.lag;
      if (e.following && !hold && e.trail.length > 1 && want > e.trail[0].d) { // (until the ranger has gone that far, they wait their turn)
        let k = e.trail.length - 1;
        while (k > 0 && e.trail[k].d > want) k--;
        const q = e.trail[k], r = e.trail[Math.min(e.trail.length - 1, k + 1)];
        const ax = r.x - q.x, az = r.z - q.z, al = Math.hypot(ax, az) || 1;
        tx = q.x - (az / al) * p.side; tz = q.z + (ax / al) * p.side;
      }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const speed = d > 0.3 ? Math.min(d * 2.2, 7) : 0;
      if (speed > 0) { p.x += (dx / d) * Math.min(d, speed * dt); p.z += (dz / d) * Math.min(d, speed * dt); p.heading = Math.atan2(dx, dz); }
      else if (!p.pusher && Math.hypot(px - p.x, pz - p.z) < 12) p.heading = Math.atan2(px - p.x, pz - p.z); // waiting, they watch the ranger
      p.speed += (speed - p.speed) * Math.min(1, dt * 6);
    }
    apart(e.people);
    for (const p of e.people) {
      p.fig.position.set(p.x, heightAt(p.x, p.z), p.z);
      turnTo(p.fig, p.heading, Math.min(1, dt * 6));
      animateFigure(p.fig, p.speed, dt, time + p.lag);
      if (p.pusher) pushPose(p.fig);
      nearest = Math.min(nearest, Math.hypot(px - p.x, pz - p.z));
    }
    this.pushCart(e.people.find((p) => p.pusher), e.cart);
    return nearest;
  }

  // ---- every frame ----

  update(dt, time, player) {
    dt *= this.pace ?? 1; // (the tests may hurry village life along: software rendering is slow)
    const px = player.pos.x, pz = player.pos.z;
    for (const p of this.places.values()) {
      const d = Math.hypot(p.x - px, p.z - pz);
      const show = d < SHOW;
      for (const q of p.people) q.fig.visible = show;
      for (const pl of p.plots) {
        const pd = Math.hypot(pl.x - px, pl.z - pz);
        pl.mesh.visible = pd < SHOW;
        pl.mesh.count = pd < NEAR_CROP ? pl.mesh.userData.full : Math.ceil(pl.mesh.userData.full / 3);
      }
      this.work(p, dt); // building goes on whether or not anyone watches
      if (!show || d > 120) { // people far off stand still (but come to where they were going)
        for (const q of p.people) if (q.post && Math.hypot(q.x - q.post.x, q.z - q.post.z) > 0.3) { q.x = q.post.x; q.z = q.post.z; q.fig.position.set(q.x, heightAt(q.x, q.z), q.z); }
        if (p.cartAt) this.parkCart(p);
        continue;
      }
      for (const q of p.people) this.tend(p, q, dt, time, px, pz);
      apart(p.people.filter((q) => !q.post || Math.hypot(q.x - q.post.x, q.z - q.post.z) > 0.5));
    }
    // smoke from the nearest chimneys
    this.smokeTick = (this.smokeTick ?? 0) - dt;
    if (this.smokeTick <= 0) {
      this.smokeTick = 1.5;
      this.smoking = [...this.places.values()].flatMap((p) => p.chimneys).filter((c) => Math.abs(c.x - px) < 500 && Math.abs(c.z - pz) < 500)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, CHIMNEYS);
    }
    const sp = this.smokePos;
    for (let k = 0; k < CHIMNEYS; k++) {
      const c = this.smoking[k];
      for (let i = 0; i < PUFFS; i++) {
        const o = (k * PUFFS + i) * 3;
        if (!c) { sp[o + 1] = -1000; continue; }
        const life = (time * 0.09 + i / PUFFS + (c.x % 5) * 0.13) % 1;
        sp[o] = c.x + life * life * 5 + Math.sin(time * 0.5 + i) * life;
        sp[o + 1] = c.y + 0.4 + life * 16;
        sp[o + 2] = c.z + Math.cos(time * 0.4 + i * 2) * life;
      }
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
  }

  /** The cart set down at the place's goods, where it stays. */
  parkCart(p) {
    p.cart.position.set(p.goods.x, heightAt(p.goods.x, p.goods.z), p.goods.z);
    p.cartAt = null;
    for (const q of p.people) q.pusher = false;
  }

  /** The job in hand: begin the next in the queue, and when its time is up, it stands. A house 5 to 10 s, a well or a cross 4. */
  work(p, dt) {
    if (!p.build && p.queue.length) {
      const job = p.queue.shift(), site = siteById[p.site];
      if (job.type === 'house') {
        const hs = site.houses[job.i], sc = scaffold(hs, houseFloor(hs).y);
        p.group.add(sc);
        p.build = { job, t: 0, total: 5.5 + p.rand() * 4, spots: workSpots(hs), scaffold: sc };
      } else {
        const at = job.type === 'well' ? { x: site.x - 4, z: site.z + 5 } : { x: site.x + 9, z: site.z + 2 };
        p.build = { job, t: 0, total: 4, spots: ringSpots(at, job.type === 'well' ? 2.3 : 2.4), scaffold: null };
      }
      this.raise(p, job, 0);
    }
    const b = p.build;
    if (!b) return;
    b.t += dt;
    this.raise(p, b.job, Math.min(1, b.t / b.total));
    if (b.t >= b.total) {
      if (b.scaffold) { p.group.remove(b.scaffold); b.scaffold.geometry.dispose(); }
      p.build = null;
    }
  }

  /** One of a place's people, about their business: at their post, building, or at ease on the green. */
  tend(p, q, dt, time, px, pz) {
    const b = p.build, workers = p.people.filter((o) => !o.post && !o.small);
    let tx = q.tx, tz = q.tz, face = null, act = null;
    if (q.post) { // the reeve and the storekeeper go to their places, and stay; they turn to whoever comes to talk
      tx = q.post.x; tz = q.post.z;
      face = Math.hypot(px - q.x, pz - q.z) < 7 ? Math.atan2(px - q.x, pz - q.z) : q.heading;
    } else if (q.pusher && p.cartAt) { // first the cart, to where their goods will be kept
      tx = p.cartAt.x - 1.6; tz = p.cartAt.z - 1.6;
      if (Math.hypot(tx - q.x, tz - q.z) < 0.6) this.parkCart(p);
    } else if (b && !q.small) {
      const k = workers.indexOf(q);
      if (q.job === 'hammer' || k >= b.spots.length) {
        const s = b.spots[k % b.spots.length];
        tx = s.x; tz = s.z; face = s.face; act = 'hammer';
      } else { // carrying: to the work with a plank, back to the cart for another
        q.carrying ??= true;
        const drop = b.spots[k % b.spots.length];
        const there = q.carrying ? drop : p.goods;
        tx = there.x + Math.sin(k) * 0.8; tz = there.z + Math.cos(k) * 0.8;
        if (Math.hypot(tx - q.x, tz - q.z) < 0.5) q.carrying = !q.carrying;
        act = q.carrying ? 'carry' : null;
      }
    } else {
      // at ease: a few steps here and there about the green (children run)
      q.wait -= dt;
      if (Math.hypot(q.tx - q.x, q.tz - q.z) < 0.25 && q.wait <= 0) {
        const a = Math.random() * 6.28, r = Math.random() * p.home.r;
        q.tx = p.home.x + Math.cos(a) * r; q.tz = p.home.z + Math.sin(a) * r; q.wait = 3 + Math.random() * 6;
      }
      tx = q.tx; tz = q.tz;
    }
    const dx = tx - q.x, dz = tz - q.z, dd = Math.hypot(dx, dz);
    if (dd > 0.2) {
      const v = q.pusher ? 1.8 : act === 'carry' ? 1.7 : dd > 8 && !q.post ? 4.5 : q.small ? 1.8 : 1.4; // to work at a run; the cart and those who speak for them at a walk
      q.x += (dx / dd) * Math.min(dd, v * dt); q.z += (dz / dd) * Math.min(dd, v * dt);
      q.heading = Math.atan2(dx, dz); q.speed = v;
    } else {
      q.speed = 0;
      if (face !== null) q.heading = face;
    }
    q.fig.position.set(q.x, heightAt(q.x, q.z), q.z);
    turnTo(q.fig, q.speed ? q.heading : face ?? q.heading, Math.min(1, dt * 5));
    animateFigure(q.fig, q.speed, dt, time + q.x);
    if (q.pusher && p.cartAt) { pushPose(q.fig); this.pushCart(q, p.cart); }
    const l = q.fig.limbs, pr = q.fig.props;
    const hammering = act === 'hammer' && q.speed === 0;
    if (pr) { pr.hammer.visible = act === 'hammer'; pr.plank.visible = act === 'carry'; pr.sack.visible = false; }
    if (hammering) { // swing and strike
      const sw = Math.max(0, Math.sin(time * 5.5 + q.phase));
      l.armR.rotation.x = -0.9 - 1.5 * sw; l.elbowR.rotation.x = -0.5 - 0.4 * sw;
    } else if (act === 'carry') {
      l.armL.rotation.x = l.armR.rotation.x = -0.55; l.elbowL.rotation.x = l.elbowR.rotation.x = -1.25;
    }
  }

  /**
   * Who stands within reach to talk to: a settlement's reeve or storekeeper, or a
   * homestead's people. { site, role: 'reeve' | 'trader' | 'farmer' } or null.
   */
  speakerNear(x, z, r = 3) {
    for (const p of this.places.values()) {
      if (Math.abs(p.x - x) > 60 || Math.abs(p.z - z) > 60) continue;
      for (const q of p.people) {
        if (!(q.role || !p.settlement) || Math.hypot(q.x - x, q.z - z) >= r) continue;
        if (q.post && Math.hypot(q.x - q.post.x, q.z - q.post.z) > 1.5) continue; // (not until they are at their place)
        return { site: p.site, role: q.role ?? 'farmer' };
      }
    }
    return null;
  }

  /** The settlement whose inn door the ranger stands at, once the inn is built: its site, or null. */
  innNear(x, z, r = 1.8) {
    for (const p of this.places.values()) if (p.innDoor && p.done.has('h' + p.inn) && Math.hypot(p.innDoor.x - x, p.innDoor.z - z) < r) return p.site;
    return null;
  }

  /** Where to arrive when travelling to a settlement: open ground on its green, or before its door. */
  arrivalAt(site) {
    const st = siteById[site];
    return st.kind === 'hamlet' ? { x: st.x - 2, z: st.z + 13 } : { x: st.x, z: st.z + st.houses[0].d / 2 + 7 };
  }
}

const jobKey = (j) => (j.type === 'house' ? 'h' + j.i : j.type);
/** Places to stand round something small being built, facing it. */
function ringSpots(at, r) {
  return [0, 1, 2, 3, 4, 5].map((k) => { const a = k * 1.047, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r; return { x, z, face: Math.atan2(at.x - x, at.z - z) }; });
}
/** Arms out to the cart's handles. */
function pushPose(fig) { const l = fig.limbs; l.armL.rotation.x = l.armR.rotation.x = -1.05; l.elbowL.rotation.x = l.elbowR.rotation.x = -0.35; }
/** Keep people a step apart (whoever pushes the cart a little more). */
function apart(ps) {
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.pusher || b.pusher ? 1.6 : 1.05;
      if (d >= min) continue;
      const push = (min - (d || 0.01)) / 2, ux = d ? dx / d : 1, uz = d ? dz / d : 0;
      a.x -= ux * push; a.z -= uz * push; b.x += ux * push; b.z += uz * push;
    }
  }
}

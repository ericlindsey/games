// The settlements as they come back to life (since v0.7): houses mended and
// roofed, smoke from their chimneys, plots cleared and sown in rows, a boat at
// the landing, and the people themselves, on their green or following the
// ranger home from the river. What stands is read from the saved state
// (systems/settlement.js) each time `sync` is called; the old ruins under it
// (world/farms.js) are left as they are, and the mended walls are built over them.

import * as THREE from 'three';
import { GeoBuilder, SURF, materials } from './build.js';
import { heightAt } from './terrain.js';
import { bankX } from './layout.js';
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

/** A ruined house of oldworks.js mended: walls whole to the eaves, gables, a thatched roof, a door and a chimney. */
function mendHouse(b, rand, hs, chimneys) {
  const y = hs.y ?? heightAt(hs.x, hs.z), E = y + 4.1, t = 0.82; // (above the tallest of the old walls, which are hidden inside)
  const long = hs.w >= hs.d, L = long ? hs.w : hs.d, D = long ? hs.d : hs.w; // ridge along the long side
  const plaster = PLASTER[Math.floor(rand() * PLASTER.length)], thatch = THATCH[Math.floor(rand() * THATCH.length)];
  const ry = long ? 0 : Math.PI / 2;
  const at = (u, v) => (long ? [hs.x + u, hs.z + v] : [hs.x + v, hs.z + u]); // u along the ridge, v across it
  b.kind = SURF.masonry;
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
  b.kind = SURF.plain;
  const over = 0.55, slope = (D / 2 + over) * Math.SQRT2, rise = D / 2, n = 0.15 * Math.SQRT1_2;
  for (const s of [-1, 1]) {
    const v = (s * (D / 2 + over)) / 2 + s * n, my = E + (rise - over) / 2 + n - 0.15;
    const [mx, mz] = at(0, v);
    if (long) b.box(L + 1.2, 0.3, slope, mx, my, mz, thatch, 0, (s * Math.PI) / 4, 0);
    else b.box(slope, 0.3, L + 1.2, mx, my, mz, thatch, 0, 0, (-s * Math.PI) / 4);
  }
  { const [rx, rz] = at(0, 0); b.box(long ? L + 1.3 : 0.5, 0.28, long ? 0.5 : L + 1.3, rx, E + rise - 0.02, rz, thatch); }
  // a door and two shuttered windows on the door's side, or a long side
  b.kind = SURF.wood;
  const doorV = hs.door === undefined ? 1 : long ? (hs.door === 1 ? 1 : -1) : (hs.door === 3 ? 1 : -1);
  const onLong = hs.door === undefined || (long ? hs.door <= 1 : hs.door >= 2);
  if (onLong) {
    const [dx, dz] = at(0.6, doorV * (D / 2 + t / 2 + 0.03));
    b.box(long ? 1.1 : 0.08, 2.1, long ? 0.08 : 1.1, dx, y - 0.05, dz, DOOR);
    for (const w of [-1, 1]) {
      const [wx, wz] = at(0.6 + w * Math.min(2.4, L / 2 - 1), doorV * (D / 2 + t / 2 + 0.03));
      b.box(long ? 0.8 : 0.08, 0.8, long ? 0.08 : 0.8, wx, y + 1.5, wz, TIMBER);
    }
  } else {
    const [dx, dz] = at(doorV * (L / 2 + t / 2 + 0.03), 0);
    b.box(long ? 0.08 : 1.1, 2.1, long ? 1.1 : 0.08, dx, y - 0.05, dz, DOOR);
  }
  // a stone chimney through the ridge at one end, with smoke over it
  b.kind = SURF.masonry;
  const cs = rand() < 0.5 ? -1 : 1, [cx, cz] = at(cs * (L / 2 - 0.9), 0);
  b.box(0.9, E + rise + 1.1 - (E - 0.5), 0.9, cx, E - 0.5, cz, STONE);
  chimneys.push({ x: cx, y: E + rise + 1.1, z: cz });
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

/** What the settlers brought: a handcart and their bundles, by the green. */
function goods(b, rand, x, z) {
  const y = heightAt(x, z);
  b.kind = SURF.wood;
  b.box(1.4, 0.5, 2.2, x, y + 0.55, z, 0x7a5a38, 0.4);
  for (const s of [-1, 1]) b.cyl(0.42, 0.42, 0.1, x + Math.cos(0.4) * s * 0.78, y + 0.42, z - Math.sin(0.4) * s * 0.78, 0x4a3524, 10, 0, Math.PI / 2);
  b.box(0.1, 0.1, 1.6, x - 0.9, y + 0.65, z + 1.6, 0x5a4530, 0.4);
  b.kind = SURF.cloth;
  for (let i = 0; i < 4; i++) b.blob(0.32 + rand() * 0.1, x + (rand() - 0.5), y + 1.1 + rand() * 0.2, z + (rand() - 0.5) * 1.4, [0xb8a878, 0x8a6a4a, 0x6a7a8a][i % 3], 1.2, 0.8, 1);
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

export class Villages {
  constructor(scene, shadows = true) {
    this.scene = scene;
    this.shadows = shadows;
    this.places = new Map(); // site id -> { key, group, chimneys, plots: [{ mesh, crop, rect }], people: [...] }
    this.boats = new Map();  // site id -> boat mesh
    this.escort = null;      // { site, people: [...], trail: [...], following }
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

  /** Build or rebuild whatever has changed since the last call. Returns the plots newly sown, if any. */
  sync(state) {
    const sown = [];
    const want = new Map(); // site id -> key of what should stand
    for (const s of SETTLEMENTS) {
      const st = stageOf(state, s.site);
      if (st >= 0) want.set(s.site, `s${st}`);
    }
    for (const id of homesteadsLived(state)) want.set(id, 'h');
    for (const [id, p] of this.places) if (want.get(id) !== p.key) { this.dropPlace(id); }
    for (const [id, key] of want) {
      if (this.places.has(id)) continue;
      const before = this.sownBefore?.get(id) ?? 0;
      const p = this.buildPlace(state, id, key);
      if (p.plots.length > before) sown.push(...p.plots.slice(before).map((q) => q.rect));
      (this.sownBefore ??= new Map()).set(id, p.plots.length);
    }
    // the boat at the landing, once its settlers have been sent for (and left there after)
    for (const s of SETTLEMENTS) {
      const sent = state.quests.active.includes('s-' + s.province) || state.quests.done.includes('s-' + s.province) || state.settled.includes(s.site);
      if (sent && !this.boats.has(s.site)) this.buildBoat(s);
    }
    return sown;
  }

  buildPlace(state, id, key) {
    const s = settlementBySite[id], h = homesteadBySite[id], site = siteById[id];
    const rand = rng(Math.round(site.x * 7 + site.z * 3));
    const b = new GeoBuilder(Math.round(site.x + site.z * 2), 0.06);
    const chimneys = [];
    const mended = s ? housesMended(state, id) : 1;
    const order = s ? s.houses : site.houses.map((_, i) => i);
    for (const i of order.slice(0, mended)) mendHouse(b, rand, site.houses[i], chimneys);
    const stage = s ? stageOf(state, id) : 0;
    if (s && site.kind === 'hamlet') {
      wellHouse(b, site.x - 4, site.z + 5);
      if (stage >= STAGE_MAX) crossMended(b, site.x + 9, site.z + 2);
    }
    if (stage < 2) goods(b, rand, site.x + (site.kind === 'hamlet' ? 2 : site.houses[0].w / 2 + 4), site.z - (site.kind === 'hamlet' ? 9 : 2));
    if (stage >= STAGE_MAX) gardens(b, rand, site, site.houses.length);
    const group = new THREE.Group();
    group.name = 'villages';
    group.add(b.mesh(materials.stone, this.shadows));
    // the plots sown
    const plots = [];
    const sow = (rect, crop) => {
      const prand = rng(Math.round(rect.minX * 3 + rect.minZ));
      const ground = plotGround(rect, prand), mesh = plotCrop(rect, crop, prand);
      group.add(ground, mesh);
      plots.push({ rect, crop, mesh, x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 });
    };
    if (s) cropsSown(state, id).forEach((crop, i) => { if (s.plots[i]) sow(s.plots[i], crop); });
    else if (h.plot) sow(h.plot, h.crop);
    // the people: whoever speaks for them by the well or the door, and the others about the place
    const people = [];
    const home = site.kind === 'hamlet' ? { x: site.x - 1, z: site.z + 2, r: 11 } : { x: site.x, z: site.z + site.houses[0].d / 2 + 3.5, r: 4 };
    const n = s ? (site.kind === 'hamlet' ? 3 + Math.min(stage, 3) : 2 + Math.min(stage, 2)) : 2;
    if (s) {
      const fx = site.kind === 'hamlet' ? site.x - 1.5 : home.x + 1.5, fz = site.kind === 'hamlet' ? site.z + 7.5 : home.z;
      const f = folk(REEVE, 1.0);
      f.position.set(fx, heightAt(fx, fz), fz);
      group.add(f);
      people.push({ fig: f, x: fx, z: fz, reeve: true, heading: 0, speed: 0 });
    }
    for (let i = 0; i < n; i++) {
      const look = FOLK[(i + Math.floor(site.x)) % FOLK.length], small = i === n - 1 && n > 2; // and a child
      const f = folk(look, small ? 0.66 : 0.95 + rand() * 0.08);
      const a = rand() * 6.28, r = rand() * home.r, x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      f.position.set(x, heightAt(x, z), z);
      group.add(f);
      people.push({ fig: f, x, z, tx: x, tz: z, wait: rand() * 4, home, heading: a, speed: 0, small });
    }
    if (s) addCircle(people[0].x, people[0].z, 0.45); // (the reeve stands still; walk round them)
    this.scene.add(group);
    const place = { key, group, chimneys, plots, people, site: id, x: site.x, z: site.z, settlement: !!s };
    this.places.set(id, place);
    return place;
  }

  dropPlace(id) {
    const p = this.places.get(id);
    if (!p) return;
    this.scene.remove(p.group);
    for (const c of p.group.children) { if (c.isInstancedMesh) c.dispose(); else if (c.isMesh) c.geometry.dispose(); }
    this.places.delete(id);
  }

  /** A broad river boat drawn up on the bank, where the settlers land. */
  buildBoat(s) {
    const b = new GeoBuilder(Math.round(s.landing.z), 0.06);
    b.kind = SURF.wood;
    const x = bankX(s.landing.z) - 2.5, z = s.landing.z, y = -0.15;
    b.box(2.4, 0.5, 7.5, x, y, z, 0x6a4a2e);
    for (const side of [-1, 1]) b.box(0.18, 0.7, 7.8, x + side * 1.25, y + 0.2, z, 0x5a3e26);
    b.box(2.0, 0.6, 0.18, x, y + 0.2, z - 3.85, 0x5a3e26);
    b.box(1.6, 0.9, 0.2, x, y + 0.2, z + 3.9, 0x5a3e26, 0, 0.3);
    b.box(0.14, 4.5, 0.14, x, y + 0.4, z - 0.8, TIMBER);
    for (let i = 0; i < 3; i++) b.box(2.2, 0.08, 0.3, x, y + 0.5, z - 2.5 + i * 2.2, 0x7a5a3a); // thwarts
    b.box(0.08, 0.08, 4, x + 0.6, y + 0.6, z + 1, TIMBER, 0, 0.1); // an oar
    addSolid({ minX: x - 1.35, maxX: x + 1.35, minZ: z - 3.9, maxZ: z + 3.9, bottom: -3, top: y + 0.9 });
    const mesh = b.mesh(materials.wood, this.shadows);
    mesh.name = 'villages';
    this.scene.add(mesh);
    this.boats.set(s.site, mesh);
  }

  // ---- the settlers on their way home ----

  /** Show (or stop showing) a settlement's people waiting at `at`, or following. */
  setEscort(site, at, following) {
    if (this.escort && this.escort.site !== site) this.endEscort();
    if (!site) return;
    if (!this.escort) {
      const people = [];
      const rand = rng(site.length * 97 + Math.round(at.z));
      for (let i = 0; i < 5; i++) {
        const small = i === 3;
        const f = folk(FOLK[i % FOLK.length], small ? 0.66 : 0.95 + rand() * 0.08);
        const x = at.x + (i % 3) * 1.4 - 1.4, z = at.z + Math.floor(i / 3) * 1.6 - 0.8;
        f.position.set(x, heightAt(x, z), z);
        f.name = 'villages';
        this.scene.add(f);
        people.push({ fig: f, x, z, heading: -Math.PI / 2, speed: 0, small, lag: 2.6 + i * 1.9 });
      }
      this.escort = { site, people, trail: [], following };
    }
    this.escort.following = following;
    if (following) this.escort.trail = [];
  }

  endEscort() {
    if (!this.escort) return;
    for (const p of this.escort.people) this.scene.remove(p.fig);
    this.escort = null;
  }

  /** Where the settlers are: the one leading. */
  escortAt() {
    const e = this.escort;
    return e ? { x: e.people[0].x, z: e.people[0].z } : null;
  }

  /**
   * Move the following settlers along the ranger's trail, each a little further
   * behind. `hold` stops them where they stand (a fight). Returns the distance
   * from the ranger to the nearest of them.
   */
  updateEscort(dt, time, player, hold) {
    const e = this.escort;
    if (!e) return Infinity;
    const px = player.pos.x, pz = player.pos.z;
    if (e.following && !hold) {
      const last = e.trail[e.trail.length - 1];
      if (!last || Math.hypot(px - last.x, pz - last.z) > 0.8) e.trail.push({ x: px, z: pz, d: (last?.d ?? 0) + (last ? Math.hypot(px - last.x, pz - last.z) : 0) });
      if (e.trail.length > 1200) e.trail.splice(0, 400);
    }
    let nearest = Infinity;
    for (const p of e.people) {
      let tx = p.x, tz = p.z;
      if (e.following && !hold && e.trail.length) {
        const total = e.trail[e.trail.length - 1].d, want = total - p.lag;
        // the point on the trail `lag` metres behind the ranger, or where they joined it
        let k = e.trail.length - 1;
        while (k > 0 && e.trail[k].d > want) k--;
        const q = e.trail[k];
        if (want > 0 || Math.hypot(q.x - p.x, q.z - p.z) > 1) { tx = q.x; tz = q.z; }
      }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const speed = d > 0.3 ? Math.min(d * 2.2, 7) : 0;
      if (speed > 0) { p.x += (dx / d) * Math.min(d, speed * dt); p.z += (dz / d) * Math.min(d, speed * dt); p.heading = Math.atan2(dx, dz); }
      else if (Math.hypot(px - p.x, pz - p.z) < 12) p.heading = Math.atan2(px - p.x, pz - p.z); // waiting, they watch the ranger
      p.speed += (speed - p.speed) * Math.min(1, dt * 6);
      p.fig.position.set(p.x, heightAt(p.x, p.z), p.z);
      let turn = p.heading - p.fig.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      p.fig.rotation.y += turn * Math.min(1, dt * 6);
      animateFigure(p.fig, p.speed, dt, time + p.lag);
      nearest = Math.min(nearest, Math.hypot(px - p.x, pz - p.z));
    }
    return nearest;
  }

  // ---- every frame ----

  update(dt, time, player) {
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
      if (!show || d > 120) continue; // people far off stand still
      for (const q of p.people) {
        if (q.reeve) { // turns to whoever comes to talk
          const want = Math.hypot(px - q.x, pz - q.z) < 7 ? Math.atan2(px - q.x, pz - q.z) : q.heading;
          let turn = want - q.fig.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          q.fig.rotation.y += turn * Math.min(1, dt * 3);
          animateFigure(q.fig, 0, dt, time + q.x);
          continue;
        }
        // the others go about their business: a few steps here and there about the green
        q.wait -= dt;
        const dx = q.tx - q.x, dz = q.tz - q.z, dd = Math.hypot(dx, dz);
        if (dd > 0.2) {
          const v = q.small ? 1.6 : 1.1;
          q.x += (dx / dd) * Math.min(dd, v * dt); q.z += (dz / dd) * Math.min(dd, v * dt);
          q.heading = Math.atan2(dx, dz); q.speed = v;
        } else {
          q.speed = 0;
          if (q.wait <= 0) {
            const a = Math.random() * 6.28, r = Math.random() * q.home.r;
            q.tx = q.home.x + Math.cos(a) * r; q.tz = q.home.z + Math.sin(a) * r; q.wait = 3 + Math.random() * 6;
          }
        }
        q.fig.position.set(q.x, heightAt(q.x, q.z), q.z);
        let turn = q.heading - q.fig.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        q.fig.rotation.y += turn * Math.min(1, dt * 5);
        animateFigure(q.fig, q.speed, dt, time + q.x);
      }
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

  /** The settlement whose speaker, or the homestead whose people, stand within reach: { site, homestead } or null. */
  speakerNear(x, z, r = 3) {
    for (const p of this.places.values()) {
      if (Math.abs(p.x - x) > 60 || Math.abs(p.z - z) > 60) continue;
      for (const q of p.people) {
        if ((q.reeve || !p.settlement) && Math.hypot(q.x - x, q.z - z) < r) return { site: p.site, homestead: !p.settlement };
      }
    }
    return null;
  }
}

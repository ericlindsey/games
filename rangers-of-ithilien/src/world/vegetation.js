// Trees and undergrowth. Each species is one low-poly geometry, instanced per
// terrain chunk. Placement is deterministic from the world seed and position.

import * as THREE from 'three';
import { hash2 } from '../util/noise.js';
import { WORLD, CHUNK } from '../config.js';
import { GeoBuilder, materials, SURF } from './build.js';
import { ATLAS } from './surface.js';
import { addRock } from './rocks.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { regionWeights } from './regions.js';
import { forestDensity, thicketDensity } from './forest.js';
import { inClearing, roadDistance } from './layout.js';
import { plantedIn, houseDistance } from './oldworks.js';
import { campNear } from './campSites.js';
import { pathDistance } from './paths.js';
import { relicDistance } from './relicSites.js';

const S = WORLD.seed;
const BARK = 0x5e4832, DARK_BARK = 0x4a3b2c;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3(), _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

/** A tapering bough from one point to another. */
function limb(b, x0, y0, z0, x1, y1, z1, r0, r1, color, seg = 6) {
  _a.set(x0, y0, z0); _b.set(x1, y1, z1);
  const len = _a.distanceTo(_b);
  _lq.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
  _lm.compose(_mid.copy(_a).add(_b).multiplyScalar(0.5), _lq, ONE);
  const k = b.kind;
  b.kind = SURF.bark;
  b.add(new THREE.CylinderGeometry(r1, r0, len, seg, 1, true), color, _lm.clone(), true);
  b.kind = k;
}

/**
 * A trunk: tapering, a little bent, flaring at the foot into `roots` buttresses.
 * Base at y0, height h. Returns nothing; the top is at (lean, y0 + h, 0) rotated by dir.
 */
function trunk(b, h, r0, r1, color, o = {}) {
  const seg = o.seg ?? 10, rows = o.rows ?? 6, roots = o.roots ?? 0, lean = o.lean ?? 0, dir = o.dir ?? 0, y0 = o.y0 ?? -0.4;
  const g = new THREE.CylinderGeometry(1, 1, 1, seg, rows, o.open ?? true);
  const pos = g.attributes.position, ph = b.rand() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), t = pos.getY(i) + 0.5, a = Math.atan2(z, x), rad = Math.hypot(x, z);
    let r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    const foot = Math.exp(-t * h / Math.max(0.5, r0 * 0.8));
    if (roots) r *= 1 + 0.45 * foot + 0.6 * foot * Math.pow(Math.max(0, Math.cos(a * roots + ph)), 3);
    else r *= 1 + 0.2 * foot;
    r *= 1 + 0.05 * Math.sin(a * 3 + t * 7 + ph);
    const bend = lean * t * t;
    pos.setXYZ(i, x / (rad || 1) * r * (rad ? 1 : 0) + Math.cos(dir) * bend, y0 + t * h, z / (rad || 1) * r * (rad ? 1 : 0) + Math.sin(dir) * bend);
  }
  g.computeVertexNormals();
  const k = b.kind;
  b.kind = SURF.bark;
  b.add(g, color, null, true);
  b.kind = k;
}

const lighten = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/**
 * A crown of leaves: for each cluster a soft dark core and, up close, a shell
 * of leaf cards that makes the outline ragged.
 * clusters: [x, y, z, r, squash]
 */
function crown(b, lod, clusters, colors, o = {}) {
  const region = o.region ?? ATLAS.broad, cards = o.cards ?? 22, size = o.size ?? 2.6;
  clusters.forEach(([x, y, z, r, sq = 0.65], i) => {
    const col = colors[i % colors.length];
    b.kind = SURF.leaf;
    if (lod === 'hi') {
      b.lump(r * 0.84, x, y, z, lighten(col, 0.72), 1.1, sq, 1.1, o.detail ?? 1, 0.2);
      b.leafShell(x, y, z, r * 1.05, r * sq * 1.08, r * 1.05, Math.round(cards * (o.cardScale?.(r) ?? 1)), size, lighten(col, 1.12), region);
    } else {
      b.lump(r * 1.0, x, y, z, lighten(col, 0.86), 1.1, sq, 1.1, 0, 0.16);
    }
    b.kind = 0;
  });
}

/** A conifer's tier: a ragged, drooping skirt of boughs with needle cards round its edge. */
function skirt(b, lod, y, R, H, color, o = {}) {
  const seg = lod === 'hi' ? (o.seg ?? 12) : 7, droop = o.droop ?? 0.22, ph = b.rand() * 6.28;
  const g = new THREE.ConeGeometry(R, H, seg, lod === 'hi' ? 3 : 1, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
    const t = yy / H + 0.5, a = Math.atan2(z, x);
    const k = 1 + 0.2 * Math.sin(a * 5 + ph) * (1 - t) + 0.08 * Math.sin(a * 11 + ph * 2) * (1 - t);
    pos.setXYZ(i, x * k, yy - droop * R * (1 - t) * (1 - t) * (0.7 + 0.5 * Math.sin(a * 3 + ph)), z * k);
  }
  g.computeVertexNormals();
  b.kind = SURF.leaf;
  b.add(g, lighten(color, lod === 'hi' ? 0.75 : 0.95), new THREE.Matrix4().makeTranslation(0, y + H / 2, 0), true);
  if (lod === 'hi') {
    const n = o.cards ?? Math.round(seg * 2.4);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + b.rand() * 0.5, f = 0.3 + 0.78 * Math.sqrt((i + 0.5) / n);
      const rr = R * f;
      const yy = y + H * (1 - f) - droop * R * (f * f) * 0.85 + 0.15;
      const s = R * (0.42 + b.rand() * 0.3) + 0.4;
      b.card(Math.cos(a) * rr, yy, Math.sin(a) * rr, s, s, Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8, lighten(color, 1.25 + b.rand() * 0.25), ATLAS.needle, b.rand() * 6.28, [Math.cos(a), 0.8, Math.sin(a)]);
    }
  }
  b.kind = 0;
}

// name -> { hi, lo, trunk radius (0 = no collision), material, shadow, cover }
const SPECIES = {};
function define(name, trunkR, build, opts = {}) {
  const geo = (lod) => { const b = new GeoBuilder(name.length * 31 + 7, 0.09); build(b, lod); return b.geometry(); };
  const hi = geo('hi');
  SPECIES[name] = {
    hi, lo: opts.cover ? hi : geo('lo'), geometry: hi, trunk: trunkR,
    material: opts.material ?? materials.tree, shadow: opts.shadow !== false, cover: !!opts.cover,
  };
}

// ---- The great trees: planted long ago, a hundred feet tall, roofing the woods. ----
define('greatOak', 1.6, (b, lod) => {
  trunk(b, 11, 1.25, 0.75, DARK_BARK, { roots: lod === 'hi' ? 5 : 0, seg: lod === 'hi' ? 12 : 7, rows: lod === 'hi' ? 6 : 2, lean: 0.4 });
  const ends = [[8, 16, 1.5], [-6.5, 17, 5], [-4, 15.5, -7.5], [4.5, 17.5, -6], [1, 15, 8.5]];
  for (const [x, y, z] of ends) {
    limb(b, 0.2, 9, 0, x * 0.6, y - 2.5, z * 0.6, 0.8, 0.45, DARK_BARK, lod === 'hi' ? 7 : 4);
    if (lod === 'hi') limb(b, x * 0.6, y - 2.5, z * 0.6, x, y + 0.5, z, 0.45, 0.18, DARK_BARK, 5);
  }
  limb(b, 0.3, 10, 0, 0.5, 20, -0.5, 0.85, 0.3, DARK_BARK, lod === 'hi' ? 7 : 4);
  const greens = [0x2f5f33, 0x386b38, 0x2b5830, 0x34653a, 0x3d7240];
  crown(b, lod, [...ends.map(([x, y, z]) => [x * 1.1, y + 2.2, z * 1.1, 6.6, 0.62]), [0.5, 22.5, -0.5, 7.4, 0.6], [-2, 18.5, 2, 5, 0.7], [3, 19, -2, 5, 0.7]], greens, { cards: 30, size: 3.4 });
});
define('greatCedar', 1.4, (b, lod) => {
  trunk(b, 31, 1.15, 0.25, BARK, { roots: lod === 'hi' ? 6 : 0, seg: lod === 'hi' ? 11 : 6, rows: lod === 'hi' ? 8 : 2, lean: 0.6 });
  const tiers = [[11.5, 12.5], [16.5, 10.8], [21.5, 8.4], [26, 5.6], [29.5, 3]];
  const greens = [0x355f3c, 0x3a6c3e, 0x2f5838];
  tiers.forEach(([y, R], t) => {
    const n = t < 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = t * 1.1 + i * (6.283 / n);
      const px = Math.cos(a) * R * 0.5, pz = Math.sin(a) * R * 0.5;
      limb(b, 0, y - 1.5, 0, px, y, pz, 0.4, 0.14, BARK, lod === 'hi' ? 6 : 4);
      // flat plates of foliage, the cedar's mark
      b.kind = SURF.leaf;
      const r = R * 0.6, col = greens[i % 3];
      if (lod === 'hi') {
        b.lump(r * 0.9, px, y + 0.4, pz, lighten(col, 0.72), 1.2, 0.2, 1.2, 1, 0.25);
        for (let k = 0; k < 16; k++) {
          const aa = b.rand() * 6.283, d = Math.sqrt(b.rand()) * r * 1.05;
          b.card(px + Math.cos(aa) * d, y + 0.7 + b.rand() * 0.5, pz + Math.sin(aa) * d, 2.8, 2.8, (b.rand() - 0.5) * 0.6, 1, (b.rand() - 0.5) * 0.6, lighten(col, 1.2 + b.rand() * 0.2), ATLAS.needle, b.rand() * 6.28, [0, 1, 0]);
        }
      } else b.lump(r, px, y + 0.5, pz, lighten(col, 0.86), 1.2, 0.22, 1.2, 0, 0.2);
      b.kind = 0;
    }
  });
});
define('greatFir', 1.05, (b, lod) => {
  trunk(b, 30, 0.9, 0.15, BARK, { roots: lod === 'hi' ? 4 : 0, seg: lod === 'hi' ? 9 : 6, rows: lod === 'hi' ? 5 : 2 });
  const tiers = [[8.5, 7, 6], [12, 6.4, 6], [15.5, 5.6, 5.5], [19, 4.8, 5], [22.5, 3.9, 4.6], [25.8, 3, 4], [28.8, 1.9, 3.6]];
  tiers.forEach(([y, R, H], i) => skirt(b, lod, y, R, H, [0x2f6a42, 0x34734a, 0x3a7a4c, 0x3f8250][i % 4], { droop: 0.32 }));
});
define('greatBeech', 1.0, (b, lod) => {
  const SKIN = 0x9c968a;
  trunk(b, 18, 0.85, 0.55, SKIN, { roots: lod === 'hi' ? 4 : 0, seg: lod === 'hi' ? 11 : 6, rows: lod === 'hi' ? 6 : 2, lean: 0.3 });
  const ends = [[5, 22, 2], [-4.5, 23, 3.5], [-1, 22, -5.5], [3, 24.5, -3.5]];
  for (const [x, y, z] of ends) limb(b, 0, 16, 0, x, y, z, 0.45, 0.18, SKIN, lod === 'hi' ? 6 : 4);
  crown(b, lod, [[5.8, 23.5, 2.4, 6.2, 0.62], [-5.4, 24.5, 4, 6.0, 0.62], [-1, 23.5, -6.5, 6.2, 0.62], [3.5, 26, -4, 5, 0.6], [0, 27.5, 0, 6.0, 0.6], [0, 21.5, 0, 4.5, 0.7]],
    [0x7fb04f, 0x8ab957, 0x76a84a, 0x86b653], { cards: 26, size: 3.0 });
});
define('larch', 0.5, (b, lod) => {
  trunk(b, 24, 0.5, 0.1, 0x6e5a44, { roots: lod === 'hi' ? 3 : 0, seg: lod === 'hi' ? 8 : 5, rows: lod === 'hi' ? 4 : 1 });
  [[6, 4.2, 6], [10, 3.6, 6], [14, 3, 5.5], [17.5, 2.3, 5], [20.5, 1.4, 4]].forEach(([y, R, H], i) =>
    skirt(b, lod, y, R, H, [0x86b352, 0x8fbc59, 0x98c460, 0xa0cb66][i % 4], { droop: 0.15, seg: 10 }));
});
define('cypress', 0.55, (b, lod) => {
  trunk(b, 3, 0.4, 0.3, BARK, { seg: 6, rows: 1 });
  b.kind = SURF.leaf;
  const col = 0x234d33;
  if (lod === 'hi') {
    for (let i = 0; i < 6; i++) b.lump(1.9 - i * 0.22, 0, 3 + i * 2.6, 0, lighten(col, 0.75 + i * 0.03), 1, 1.5, 1, 1, 0.22);
    for (let i = 0; i < 70; i++) {
      const t = i / 70, a = i * 2.4, y = 2.2 + t * 17, r = (2.1 - t * 1.7) * (0.85 + b.rand() * 0.25);
      b.card(Math.cos(a) * r, y, Math.sin(a) * r, 1.9, 2.4, Math.cos(a), 0.2, Math.sin(a), lighten(0x2b5a3a, 1.15 + b.rand() * 0.2), ATLAS.needle, b.rand() * 6.28, [Math.cos(a), 0.3, Math.sin(a)]);
    }
  } else {
    b.lump(2, 0, 7, 0, lighten(col, 0.85), 1, 3.0, 1, 0, 0.12);
    b.lump(1.3, 0, 15, 0, lighten(col, 0.9), 1, 3.0, 1, 0, 0.12);
  }
  b.kind = 0;
});
define('stonePine', 0.55, (b, lod) => {
  const RED = 0x8a5a3a;
  trunk(b, 13.5, 0.6, 0.35, RED, { roots: lod === 'hi' ? 3 : 0, seg: lod === 'hi' ? 9 : 5, rows: lod === 'hi' ? 5 : 2, lean: 1.2, dir: 0.3 });
  const ends = [[4.5, 15.5, 1], [-3.5, 15.5, 3], [-1.5, 15.8, -4.2], [2.5, 16.2, -2.5]];
  for (const [x, y, z] of ends) limb(b, 1.1, 12.5, 0.3, x, y, z, 0.3, 0.12, RED, lod === 'hi' ? 5 : 3);
  crown(b, lod, [...ends.map(([x, y, z]) => [x, y + 1, z, 4.4, 0.3]), [0.8, 17.4, 0, 4.2, 0.32]], [0x3f6d45, 0x477a4c], { region: ATLAS.needle, cards: 26, size: 2.6, detail: 1 });
});
define('willow', 0.7, (b, lod) => {
  trunk(b, 6, 0.75, 0.45, 0x6a5a40, { roots: lod === 'hi' ? 4 : 0, seg: lod === 'hi' ? 9 : 6, rows: 3, lean: 0.6 });
  for (const a of [0, 2.1, 4.2]) limb(b, 0, 5, 0, Math.cos(a) * 3, 8.5, Math.sin(a) * 3, 0.4, 0.15, 0x6a5a40, 5);
  crown(b, lod, [[0, 9, 0, 5.4, 0.7], [2.6, 8, 1.5, 3.6, 0.8], [-2.2, 8.2, -1.8, 3.6, 0.8]], [0x9bb85a, 0x8fae52], { cards: 20, size: 2.4 });
  if (lod === 'hi') { // the hanging curtain of leaves
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * 6.283 + b.rand() * 0.2, r = 4.6 + b.rand() * 1.0, len = 3.5 + b.rand() * 2.5;
      b.card(Math.cos(a) * r, 7.6 - len / 2, Math.sin(a) * r, 1.4, len, Math.cos(a), 0, Math.sin(a), lighten(0x9bb85a, 1.1 + b.rand() * 0.2), ATLAS.needle, 0, [Math.cos(a), 0.2, Math.sin(a)]);
    }
  }
});

// ---- The understory: the careless descendants, and the shrubs of the south. ----
const SHRUB = { material: materials.plant };
define('bay', 0.3, (b, lod) => {
  trunk(b, 3.4, 0.22, 0.12, 0x6a5237, { seg: 6, rows: 2, lean: 0.3 });
  crown(b, lod, [[0, 4.9, 0, 2.3, 0.95], [1.3, 4, 0.6, 1.6, 0.9], [-1.1, 4.3, -0.8, 1.5, 0.9], [0.2, 3.2, -0.6, 1.3, 0.9]], [0x4f8a3c, 0x5a9644, 0x478036], { cards: 16, size: 1.5 });
}, SHRUB);
define('olive', 0.3, (b, lod) => {
  trunk(b, 2.4, 0.3, 0.16, 0x6b5a45, { seg: 7, rows: 3, lean: 0.5, dir: 1, roots: lod === 'hi' ? 3 : 0 });
  limb(b, 0.3, 2, 0, 1.2, 3, 0.4, 0.14, 0.06, 0x6b5a45, 5);
  limb(b, 0.3, 2, 0, -0.8, 3.1, -0.6, 0.14, 0.06, 0x6b5a45, 5);
  crown(b, lod, [[0.2, 3.2, 0, 1.6, 0.75], [-0.9, 2.9, 0.5, 1.25, 0.75], [1.1, 3.2, 0.4, 1.1, 0.75]], [0x8fa37a, 0x9aae84], { cards: 14, size: 1.1 });
}, SHRUB);
define('hazel', 0.35, (b, lod) => {
  for (let i = 0; i < 6; i++) { const a = i * 1.1; limb(b, 0, 0, 0, Math.cos(a) * 1.4, 2.8, Math.sin(a) * 1.4, 0.08, 0.04, 0x7a6248, 4); }
  crown(b, lod, [[0, 3.1, 0, 1.9, 0.75], [1, 2.6, -0.8, 1.3, 0.8], [-1, 2.4, 0.7, 1.3, 0.8]], [0x8cb850, 0x9ac55a], { cards: 16, size: 1.3 });
}, SHRUB);
define('juniper', 0.4, (b, lod) => {
  skirt(b, lod, 0.0, 1.0, 2.8, 0x3f6a4a, { droop: 0.05, seg: 9, cards: 14 });
  b.kind = SURF.leaf;
  b.add(new THREE.ConeGeometry(0.7, 2.0, 7, 1, true), lighten(0x477552, 0.85), new THREE.Matrix4().makeTranslation(0.6, 1.0, 0.35), true);
  b.kind = 0;
}, SHRUB);
define('tamarisk', 0.2, (b, lod) => {
  trunk(b, 2.1, 0.15, 0.08, 0x6e5546, { seg: 5, rows: 2, lean: 0.4 });
  crown(b, lod, [[0.2, 2.9, 0, 1.5, 0.6], [-0.5, 3.4, 0.3, 1.1, 0.5]], [0x9ab58a], { cards: 12, size: 1.2, region: ATLAS.needle });
  crown(b, lod, [[0.9, 3.3, -0.4, 0.9, 0.5], [-0.3, 3.8, 0.2, 0.8, 0.5]], [0xd6a9bb, 0xe0b6c6], { cards: 8, size: 0.9, region: ATLAS.needle });
}, SHRUB);
define('youngFir', 0.2, (b, lod) => {
  trunk(b, 4.5, 0.15, 0.05, BARK, { seg: 5, rows: 1 });
  skirt(b, lod, 0.6, 1.5, 2.4, 0x2f6b3a, { seg: 9, droop: 0.25 });
  skirt(b, lod, 2.0, 1.1, 2.2, 0x397a41, { seg: 8, droop: 0.25 });
  skirt(b, lod, 3.3, 0.6, 1.6, 0x3f8247, { seg: 7, droop: 0.2 });
}, SHRUB);
define('sapling', 0.15, (b, lod) => { // a young broadleaf, thin and reaching for the light
  trunk(b, 5, 0.12, 0.05, 0x8a8070, { seg: 5, rows: 2, lean: 0.4 });
  crown(b, lod, [[0.4, 5.2, 0, 1.6, 0.8], [-0.4, 4.2, 0.4, 1.2, 0.8], [0.2, 3.4, -0.4, 1.0, 0.8]], [0x7fb04f, 0x8ab957], { cards: 12, size: 1.2 });
}, SHRUB);
define('bramble', 0, (b, lod) => { // a low thicket of briar and dog-rose
  b.kind = SURF.leaf;
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7, x = Math.cos(a) * 0.9, z = Math.sin(a) * 0.9;
    b.lump(0.9, x, 0.55, z, lighten(0x3f6a34, 0.8), 1.2, 0.7, 1.2, lod === 'hi' ? 1 : 0, 0.25);
    if (lod === 'hi') b.leafShell(x, 0.6, z, 1.0, 0.75, 1.0, 9, 0.9, lighten(0x4a7a3a, 1.15), ATLAS.broad);
  }
  if (lod === 'hi') for (let i = 0; i < 9; i++) { // a few pale roses
    const a = i * 2.3, r = 1.0 + (i % 3) * 0.35;
    b.dot(0.1, Math.cos(a) * r, 1.0 + (i % 2) * 0.2, Math.sin(a) * r, i % 3 ? 0xf2d6dc : 0xffffff);
  }
  b.kind = 0;
}, { ...SHRUB, shadow: false });

// ---- Deadfall and stone: the litter of an untended wood. ----
define('log', 0, (b, lod) => {
  const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.06).setPosition(0, 0.42, 0);
  b.kind = SURF.bark;
  b.add(new THREE.CylinderGeometry(0.4, 0.5, 6.5, lod === 'hi' ? 10 : 6, 3), 0x5a4a38, m, true);
  b.kind = SURF.leaf;
  b.lump(0.9, -1.2, 0.72, 0.1, 0x6f9148, 1.6, 0.28, 0.7, 1, 0.2);
  b.lump(0.6, 1.6, 0.7, -0.1, 0x7a9b4f, 1.4, 0.3, 0.7, 1, 0.2);
  b.kind = 0;
  limb(b, 2.2, 0.5, 0, 2.9, 1.7, 0.6, 0.14, 0.06, 0x5a4a38);
  if (lod === 'hi') for (let i = 0; i < 6; i++) b.card(-2.5 + i * 0.9, 0.95, (b.rand() - 0.5) * 0.4, 0.7, 0.7, 0, 1, 0.2, lighten(0x5f8a3a, 1.2), ATLAS.ivy, b.rand() * 6, [0, 1, 0]);
}, { shadow: false, material: materials.still });
define('stump', 0.5, (b, lod) => {
  trunk(b, 1.0, 0.55, 0.48, 0x5e4c38, { roots: 5, seg: lod === 'hi' ? 10 : 6, rows: 2, y0: -0.15, open: false });
  b.cyl(0.47, 0.47, 0.04, 0, 0.82, 0, 0xb39a72, 10);
  b.kind = SURF.leaf;
  b.lump(0.45, 0.45, 0.25, 0.3, 0x6f9148, 1, 0.4, 1, 1, 0.2);
  b.kind = 0;
}, { shadow: false, material: materials.still });
define('boulder', 1.5, (b, lod) => {
  addRock(b, 0, -0.1, 0, 3.6, 0x8a867c, 11, { detail: lod === 'hi' ? 3 : 1, sy: 0.62, cuts: 7 });
}, { material: materials.rock });
define('boulder2', 1.4, (b, lod) => {
  addRock(b, 0, -0.1, 0, 3.2, 0x8f8a7e, 29, { detail: lod === 'hi' ? 3 : 1, sy: 0.85, sx: 0.8, cuts: 8, strata: 0.6 });
  addRock(b, 1.6, -0.1, 0.7, 1.2, 0x86827a, 31, { detail: lod === 'hi' ? 2 : 1, sy: 0.6 });
}, { material: materials.rock });
define('mushrooms', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 5; i++) {
    const x = Math.cos(i * 2.2) * (0.15 + i * 0.09), z = Math.sin(i * 2.2) * (0.15 + i * 0.09), h = 0.14 + (i % 3) * 0.06;
    b.cyl(0.025, 0.035, h, x, 0, z, 0xe9e2cf, 4);
    const cap = new THREE.SphereGeometry(0.1, 7, 2, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add(cap, i % 2 ? 0xc9432f : 0xd98a3a, new THREE.Matrix4().makeScale(1, 0.6, 1).setPosition(x, h - 0.01, z), true);
  }
  b.smooth = false;
}, { shadow: false, cover: true, material: materials.herb });

// ---- East of the road: heather and gorse standing above a man's head. ----
define('gorse', 1.05, (b, lod) => {
  b.kind = SURF.leaf;
  b.lump(1.45, 0, 1.4, 0, lighten(0x4d7a3c, 0.8), 1, 1.0, 1, lod === 'hi' ? 1 : 0, 0.25);
  if (lod === 'hi') {
    b.leafShell(0, 1.45, 0, 1.55, 1.5, 1.55, 26, 1.0, lighten(0x557f40, 1.1), ATLAS.needle);
    for (let i = 0; i < 26; i++) { // the yellow flowers
      const t = (i + 0.5) / 26, y = 1 - 2 * t, r = Math.sqrt(1 - y * y), a = i * 2.4;
      if (y < -0.3) continue;
      b.dot(0.16, Math.cos(a) * r * 1.5, 1.4 + y * 1.5, Math.sin(a) * r * 1.5, i % 2 ? 0xe2c63a : 0xf0d84a);
    }
  } else b.blob(0.5, 0.4, 2.7, 0.2, 0xe2c63a);
  b.kind = 0;
}, { shadow: false, material: materials.plant });
define('tallHeather', 1.05, (b, lod) => {
  b.kind = SURF.leaf;
  b.lump(1.5, 0, 1.2, 0, lighten(0x6f7a4a, 0.85), 1, 0.85, 1, lod === 'hi' ? 1 : 0, 0.25);
  b.lump(1.1, 0.2, 2.0, 0.1, lighten(0x9a6fa0, 0.85), 1.1, 0.55, 1.1, lod === 'hi' ? 1 : 0, 0.3);
  if (lod === 'hi') {
    b.leafShell(0, 1.3, 0, 1.6, 1.3, 1.6, 18, 1.0, lighten(0x7a8452, 1.1), ATLAS.needle);
    b.leafShell(0.2, 2.1, 0.1, 1.2, 0.65, 1.2, 16, 0.8, lighten(0xae7fb4, 1.15), ATLAS.needle);
  }
  b.kind = 0;
}, { shadow: false, material: materials.plant });

// ---- Underfoot: a wealth of herbs. Drawn only close to. ----
const COVER_OPTS = { shadow: false, cover: true, material: materials.herb };
function blade(b, angle, lean, w, h, color, tip = color) {
  // a two-jointed curving blade, wide at the foot
  const c = Math.cos(angle), s = Math.sin(angle);
  const ox = Math.cos(angle * 3.7) * 0.25, oz = Math.sin(angle * 2.3) * 0.25;
  const mx = ox - s * lean * 0.35, mz = oz + c * lean * 0.35, my = h * 0.55;
  const tx = ox - s * lean, tz = oz + c * lean;
  b.tri(ox - c * w, 0, oz - s * w, ox + c * w, 0, oz + s * w, mx + c * w * 0.6, my, mz + s * w * 0.6, color);
  b.tri(ox - c * w, 0, oz - s * w, mx + c * w * 0.6, my, mz + s * w * 0.6, mx - c * w * 0.6, my, mz - s * w * 0.6, color);
  b.tri(mx - c * w * 0.6, my, mz - s * w * 0.6, mx + c * w * 0.6, my, mz + s * w * 0.6, tx, h, tz, tip);
}
/** A small flower head: a ring of petals round a darker eye. */
function bloom(b, x, y, z, r, color, eye = 0xe8c23a, petals = 5) {
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * 6.283, a1 = a - 0.45, a2 = a + 0.45;
    b.tri(x, y + 0.01, z, x + Math.cos(a1) * r, y + r * 0.25, z + Math.sin(a1) * r, x + Math.cos(a2) * r, y + r * 0.25, z + Math.sin(a2) * r, color);
  }
  b.dot(r * 0.3, x, y + 0.02, z, eye);
}
define('shrub', 0, (b) => {
  b.kind = SURF.leaf;
  b.lump(0.6, 0, 0.36, 0, lighten(0x4f8a3c, 0.8), 1, 0.7, 1, 1, 0.25);
  b.leafShell(0, 0.4, 0, 0.7, 0.5, 0.7, 12, 0.6, lighten(0x5a9644, 1.15), ATLAS.broad);
  b.lump(0.42, 0.5, 0.3, 0.25, lighten(0x5a9644, 0.8), 1, 0.7, 1, 1, 0.25);
  b.kind = 0;
}, COVER_OPTS);
define('broom', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 16; i++) blade(b, i * 0.4, 0.3 + (i % 3) * 0.1, 0.03, 0.9 + (i % 4) * 0.15, 0x4f7a34, 0x5c8a40);
  for (let i = 0; i < 18; i++) { const a = i * 2.4, r = 0.15 + (i % 4) * 0.12; b.dot(0.07, Math.cos(a) * r + 0.1, 0.75 + (i % 5) * 0.1, Math.sin(a) * r, 0xf0d040); }
  b.smooth = false;
}, COVER_OPTS);
define('heather', 0, (b) => {
  b.kind = SURF.leaf;
  b.lump(0.7, 0, 0.12, 0, lighten(0x6f7a4a, 0.85), 1.1, 0.35, 1.1, 0, 0.3);
  b.lump(0.5, 0.6, 0.1, -0.4, lighten(0x7a8452, 0.85), 1.1, 0.35, 1.1, 0, 0.3);
  b.kind = 0;
  for (let i = 0; i < 30; i++) { const a = i * 2.4, r = Math.sqrt((i + 0.5) / 30) * 0.8; b.dot(0.08, Math.cos(a) * r + 0.2, 0.28 + (i % 3) * 0.04, Math.sin(a) * r - 0.15, i % 3 ? 0xa77cab : 0xc49ac8); }
}, COVER_OPTS);
define('thyme', 0, (b) => {
  b.kind = SURF.leaf;
  b.lump(0.8, 0, 0.06, 0, lighten(0x7a9a5a, 0.85), 1.2, 0.22, 1.2, 0, 0.3);
  b.kind = 0;
  for (let i = 0; i < 22; i++) { const a = i * 2.4, r = Math.sqrt((i + 0.5) / 22) * 0.75; b.dot(0.07, Math.cos(a) * r, 0.22, Math.sin(a) * r, 0xe6b3d6); }
}, COVER_OPTS);
define('sage', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 12; i++) blade(b, i * 0.52, 0.18, 0.07, 0.35, 0x9aab8c, 0xa9b89a);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, x = Math.cos(a) * 0.25, z = Math.sin(a) * 0.25, h = 0.62 + (i % 2) * 0.14;
    b.tri(x - 0.01, 0, z, x + 0.01, 0, z, x, h, z, 0x7a8a6a);
    for (let k = 0; k < 4; k++) b.dot(0.06, x, h - k * 0.07, z, 0xffffff);
  }
  b.smooth = false;
}, COVER_OPTS);
define('flowers', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.15 + (i % 3) * 0.22, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.3 + (i % 3) * 0.1;
    b.tri(x - 0.008, 0, z, x + 0.008, 0, z, x, h, z, 0x6f9a4a);
    bloom(b, x, h, z, 0.075, 0xffffff, 0xffe9a0);
  }
  b.smooth = false;
}, COVER_OPTS);
define('asphodel', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 3; i++) {
    const x = Math.cos(i * 2.1) * 0.3, z = Math.sin(i * 2.1) * 0.3, h = 0.8 + i * 0.18;
    b.tri(x - 0.02, 0, z, x + 0.02, 0, z, x, h + 0.2, z, 0x6f9a4a);
    for (let k = 0; k < 5; k++) bloom(b, x + Math.cos(k * 2.4) * 0.05, h - k * 0.08, z + Math.sin(k * 2.4) * 0.05, 0.05, 0xffffff, 0xe8d0a0, 6);
  }
  for (let i = 0; i < 7; i++) blade(b, i * 0.9, 0.3, 0.05, 0.5, 0x6f9a4a);
  b.smooth = false;
}, COVER_OPTS);
define('tuft', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 14; i++) blade(b, i * 0.95, 0.12 + (i % 3) * 0.1, 0.035, 0.5 + (i % 4) * 0.14, 0x6f9e42, 0x9cc25e);
  b.smooth = false;
}, COVER_OPTS);
define('fern', 0, (b) => {
  b.smooth = true;
  for (let f = 0; f < 9; f++) { // fronds arching out, each a rachis with paired leaflets
    const a = f * 0.7 + (f % 2) * 0.3, c = Math.cos(a), s = Math.sin(a);
    const len = 0.75 + (f % 3) * 0.18, rise = 0.55 + (f % 2) * 0.15;
    const at = (t) => [c * len * t, rise * Math.sin(t * 2.4) * (1 - t * 0.35), s * len * t];
    for (let k = 1; k < 9; k++) {
      const t = k / 9, [x, y, z] = at(t), wd = 0.13 * (1 - t * 0.7), col = k % 2 ? 0x4f8f3f : 0x5a9a48;
      const [x0, y0, z0] = at(t - 0.08);
      for (const sg of [-1, 1]) b.tri(x0, y0, z0, x, y, z, x - s * wd * sg + c * 0.05, y - 0.03, z + c * wd * sg + s * 0.05, col);
    }
  }
  b.smooth = false;
}, COVER_OPTS);
define('reed', 0, (b) => {
  b.smooth = true;
  for (let i = 0; i < 14; i++) blade(b, i * 1.3, 0.1 + (i % 3) * 0.12, 0.035, 1.3 + (i % 4) * 0.3, 0x8a9a52, 0xa8b066);
  for (let i = 0; i < 4; i++) { const a = i * 1.7, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2; b.cyl(0.035, 0.035, 0.3, x, 1.5 + i * 0.12, z, 0x6b4f33, 5); }
  b.smooth = false;
}, COVER_OPTS);
define('rock', 0.7, (b, lod) => {
  addRock(b, 0, -0.05, 0, 1.7, 0x8d8879, 41, { detail: lod === 'hi' ? 2 : 0, sy: 0.6, cuts: 6 });
}, { shadow: false, material: materials.rock });
define('mossRock', 0.7, (b, lod) => {
  addRock(b, 0, -0.05, 0, 1.8, 0x7f7c6c, 53, { detail: lod === 'hi' ? 2 : 0, sy: 0.55, cuts: 6, flatTop: true });
  if (lod === 'hi') b.card(0, 0.5, 0, 1.4, 1.4, 0, 1, 0, lighten(0x6f9148, 1.1), ATLAS.ivy, 0.4, [0, 1, 0]);
}, { shadow: false, material: materials.rock });
define('scree', 0, (b) => {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.3, r = 0.3 + (i % 3) * 0.4;
    addRock(b, Math.cos(a) * r, -0.05, Math.sin(a) * r, 0.25 + (i % 4) * 0.12, 0x8d8879, 60 + i, { detail: 0, sy: 0.6, cuts: 3 });
  }
}, { shadow: false, cover: true, material: materials.rockCover });

// What grows where: [species, weight] pairs per region.
const CANOPY = {
  central: [['greatCedar', 0.25], ['greatFir', 0.22], ['greatOak', 0.18], ['greatBeech', 0.15], ['larch', 0.12], ['cypress', 0.08]],
  south: [['greatOak', 0.45], ['greatBeech', 0.2], ['greatCedar', 0.15], ['greatFir', 0.15], ['larch', 0.05]],
  heath: [['stonePine', 0.5], ['greatFir', 0.25], ['larch', 0.25]],
  river: [['willow', 0.35], ['greatBeech', 0.3], ['greatOak', 0.2], ['cypress', 0.15]],
  foothill: [['stonePine', 1]],
};
const UNDER = {
  central: [['bay', 0.18], ['olive', 0.14], ['hazel', 0.15], ['juniper', 0.09], ['tamarisk', 0.07], ['youngFir', 0.07], ['sapling', 0.09], ['bramble', 0.08], ['log', 0.05], ['stump', 0.03], ['boulder', 0.03], ['boulder2', 0.02]],
  south: [['hazel', 0.22], ['bay', 0.2], ['youngFir', 0.12], ['sapling', 0.1], ['bramble', 0.1], ['juniper', 0.06], ['log', 0.1], ['stump', 0.04], ['boulder', 0.04], ['boulder2', 0.02]],
  heath: [['juniper', 0.45], ['olive', 0.25], ['tamarisk', 0.15], ['boulder2', 0.15]],
  river: [['tamarisk', 0.35], ['hazel', 0.25], ['bay', 0.25], ['sapling', 0.15]],
  foothill: [['juniper', 0.5], ['olive', 0.3], ['boulder2', 0.2]],
};
const COVER = {
  central: [['tuft', 0.16], ['fern', 0.16], ['flowers', 0.16], ['sage', 0.11], ['thyme', 0.09], ['asphodel', 0.08], ['shrub', 0.09], ['broom', 0.04], ['mossRock', 0.05], ['mushrooms', 0.03], ['scree', 0.03]],
  south: [['fern', 0.36], ['tuft', 0.14], ['shrub', 0.14], ['mossRock', 0.11], ['flowers', 0.09], ['asphodel', 0.07], ['mushrooms', 0.09]],
  heath: [['heather', 0.4], ['broom', 0.18], ['thyme', 0.14], ['tuft', 0.12], ['rock', 0.1], ['scree', 0.06]],
  river: [['tuft', 0.32], ['reed', 0.22], ['flowers', 0.18], ['asphodel', 0.14], ['shrub', 0.14]],
  foothill: [['heather', 0.38], ['rock', 0.22], ['thyme', 0.18], ['tuft', 0.12], ['scree', 0.1]],
};
const REGION_KEYS = ['central', 'south', 'heath', 'river', 'foothill'];
// The great trees: their trunks stop an arrow. Lesser growth does not.
const GREAT = new Set(['greatOak', 'greatCedar', 'greatFir', 'greatBeech', 'larch', 'cypress', 'stonePine', 'willow']);
const TINTABLE = { flowers: 1, asphodel: 1 };
const FLOWER_TINTS = [0xffffff, 0xf6e36a, 0xf2a3c0, 0xb99cf0, 0x8fc0f5, 0xffc27a, 0xe8705f].map((h) => new THREE.Color(h));

function pick(table, r) {
  for (const [name, wgt] of table) { if ((r -= wgt) <= 0) return name; }
  return table[table.length - 1][0];
}
const w = {};
function pickRegion(r) {
  for (const k of REGION_KEYS) { if ((r -= w[k]) <= 0) return k; }
  return 'central';
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();

/**
 * Build the plants for one terrain chunk.
 * @returns {{ meshes: THREE.InstancedMesh[], circles: {x:number,z:number,r:number}[] }}
 */
export function buildVegetation(cx, cz, quality, lod = 'hi') {
  const lists = {}; // species -> [x, y, z, rot, scale, tint r, g, b]
  const circles = [];
  const put = (name, x, y, z, rot, scale, r, g, b) => {
    (lists[name] ||= []).push(x, y, z, rot, scale, r, g, b);
    const sp = SPECIES[name];
    if (sp.trunk && (!name.endsWith('ock') || scale > 1.3)) circles.push({ x, z, r: sp.trunk * scale, big: GREAT.has(name) });
  };
  const size = CHUNK.size;
  const H = (gx, gz, k) => hash2(gx, gz, S + k);

  // Trees planted in rows long ago.
  for (const p of plantedIn(cx, cz)) put(p.species, p.x, heightAt(p.x, p.z) - 0.2, p.z, p.x * 1.7, p.scale, 0.95, 0.95, 0.92);

  // The great trees: one candidate per 16 m cell. Density 1 closes the roof.
  const TC = 16, tn = size / TC;
  for (let j = 0; j < tn; j++) {
    for (let i = 0; i < tn; i++) {
      const gx = cx * tn + i, gz = cz * tn + j;
      const x = (gx + 0.12 + 0.76 * H(gx, gz, 1)) * TC, z = (gz + 0.12 + 0.76 * H(gx, gz, 2)) * TC;
      const density = forestDensity(x, z);
      if (H(gx, gz, 3) > Math.max(density, 0.03) * quality.trees) continue;
      if (inClearing(x, z) || streamDistance(x, z) < 5 || roadDistance(x, z) < 7 || houseDistance(x, z) < 6 || campNear(x, z, 9)) continue;
      if (pathDistance(x, z) < 3 || relicDistance(x, z) < 10) continue;
      const h = heightAt(x, z);
      if (h < 0.8 || h > 150 || slopeAt(x, z) > 0.5) continue;
      regionWeights(x, z, w);
      if (w.foothill > 0.5 && H(gx, gz, 4) > 0.12) continue;
      let name = pick(CANOPY[pickRegion(H(gx, gz, 4))], H(gx, gz, 5));
      if (w.lawn > 0.4) name = 'greatBeech';
      if (w.fen > 0.4 || h < 1.8) name = 'willow';
      const t = 0.84 + 0.26 * H(gx, gz, 6);
      put(name, x, h - 0.2, z, H(gx, gz, 7) * 6.283, 0.9 + 0.5 * H(gx, gz, 8), t, t * (0.97 + 0.06 * H(gx, gz, 9)), t * 0.95);
    }
  }

  // The understory: small trees and tall shrubs, one candidate per 8 m cell.
  const UC = 8, un = size / UC;
  for (let j = 0; j < un; j++) {
    for (let i = 0; i < un; i++) {
      const gx = cx * un + i, gz = cz * un + j;
      const r = H(gx, gz, 10);
      if (r > 0.56 * quality.under) continue;
      const x = (gx + H(gx, gz, 11)) * UC, z = (gz + H(gx, gz, 12)) * UC;
      if (r > (0.14 + 0.42 * forestDensity(x, z)) * quality.under) continue;
      if (inClearing(x, z) || streamDistance(x, z) < 4 || roadDistance(x, z) < 6 || campNear(x, z, 8)) continue;
      if (pathDistance(x, z) < 2.4 || relicDistance(x, z) < 8) continue;
      const h = heightAt(x, z);
      if (h < 1.2 || h > 150 || slopeAt(x, z) > 0.6) continue;
      regionWeights(x, z, w);
      if (w.fen > 0.5 || w.lawn > 0.6) continue;
      const name = pick(UNDER[pickRegion(H(gx, gz, 13))], H(gx, gz, 14));
      const t = 0.85 + 0.25 * H(gx, gz, 15);
      put(name, x, h - 0.1, z, H(gx, gz, 16) * 6.283, 0.8 + 0.7 * H(gx, gz, 17), t, t, t * 0.95);
    }
  }

  // East of the road the tall thickets: one candidate per 4 m cell.
  const GC = 4, gn = size / GC;
  for (let j = 0; j < gn; j++) {
    for (let i = 0; i < gn; i++) {
      const gx = cx * gn + i, gz = cz * gn + j;
      const x = (gx + H(gx, gz, 21)) * GC, z = (gz + H(gx, gz, 22)) * GC;
      const roll = H(gx, gz, 20);
      const thick = x > 1400 ? thicketDensity(x, z) : 0;
      if (!(thick > 0 && roll < thick * 0.9)) continue;
      if (campNear(x, z, 8) || inClearing(x, z)) continue;
      const h = heightAt(x, z);
      if (h > 170 || slopeAt(x, z) > 0.7) continue;
      const t = 0.82 + 0.3 * H(gx, gz, 28);
      put(H(gx, gz, 24) < 0.55 ? 'tallHeather' : 'gorse', x, h - 0.2, z, H(gx, gz, 29) * 6.283, 0.85 + 0.5 * H(gx, gz, 27), t, t, t);
    }
  }

  // Undergrowth: herbs, ferns and flowers, one candidate per 3.2 m cell.
  const CC = 3.2, cn = size / CC;
  for (let j = 0; j < cn; j++) {
    for (let i = 0; i < cn; i++) {
      const gx = cx * cn + i, gz = cz * cn + j;
      const x = (gx + H(gx, gz, 31)) * CC, z = (gz + H(gx, gz, 32)) * CC;
      const roll = H(gx, gz, 30);
      if (roll > 0.62 * quality.cover) continue;
      if (x > 1400 && thicketDensity(x, z) > 0.35) continue;
      if (inClearing(x, z) || roadDistance(x, z) < 4.5 || campNear(x, z, 4) || pathDistance(x, z) < 1.2) continue;
      const h = heightAt(x, z);
      if (h < 0.05 || h > 180) continue;
      regionWeights(x, z, w);
      let name = pick(COVER[pickRegion(H(gx, gz, 23))], H(gx, gz, 24));
      const wet = h < 1.4 || streamDistance(x, z) < 5;
      if (wet || w.fen > 0.3) name = H(gx, gz, 25) < 0.7 ? 'reed' : H(gx, gz, 25) < 0.85 ? 'asphodel' : 'tuft';
      else if (name === 'reed') name = 'tuft';
      if (w.lawn > 0.5 && !TINTABLE[name]) name = H(gx, gz, 26) < 0.6 ? 'flowers' : 'tuft';
      if (!name.endsWith('ock') && slopeAt(x, z) > 0.7) continue;
      const scale = name === 'heather' ? 0.6 + 0.5 * H(gx, gz, 27) : 0.7 + 0.8 * H(gx, gz, 27);
      if (TINTABLE[name]) {
        const c = FLOWER_TINTS[Math.floor(H(gx, gz, 28) * (name === 'asphodel' ? 2 : FLOWER_TINTS.length))];
        put(name, x, h, z, H(gx, gz, 29) * 6.283, scale, c.r, c.g, c.b);
      } else {
        const t = 0.85 + 0.25 * H(gx, gz, 28);
        put(name, x, h - 0.05, z, H(gx, gz, 29) * 6.283, name.endsWith('ock') ? scale * 1.3 : scale, t, t, t * 0.95);
      }
    }
  }

  const meshes = [];
  for (const name in lists) {
    const a = lists[name], n = a.length / 8, sp = SPECIES[name];
    const mesh = new THREE.InstancedMesh(lod === 'hi' ? sp.hi : sp.lo, sp.material, n);
    mesh.userData.species = name;
    if (sp.cover) mesh.visible = lod === 'hi';
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      _p.set(a[o], a[o + 1], a[o + 2]);
      _q.setFromAxisAngle(_up, a[o + 3]);
      _s.setScalar(a[o + 4]);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      mesh.setColorAt(i, _col.setRGB(a[o + 5], a[o + 6], a[o + 7]));
    }
    mesh.castShadow = sp.shadow && quality.shadows && lod === 'hi';
    mesh.receiveShadow = !sp.cover && quality.shadows;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }
  return { meshes, circles };
}

/** Swap a chunk's plants between the near ('hi') and far ('lo') forms. Ground cover shows only near. */
export function setVegetationLod(meshes, lod, shadows) {
  for (const m of meshes) {
    const sp = SPECIES[m.userData.species];
    if (!sp) continue;
    m.geometry = lod === 'hi' ? sp.hi : sp.lo;
    if (sp.cover) m.visible = lod === 'hi';
    m.castShadow = sp.shadow && shadows && lod === 'hi'; // far plants lie outside the shadow map anyway
  }
}

/** Hand-placed trees of one species (for set pieces). items: [{x, z, scale}] */
export function plantTrees(name, items, shadows = true) {
  const sp = SPECIES[name];
  const mesh = new THREE.InstancedMesh(sp.geometry, sp.material, items.length);
  const circles = [];
  items.forEach((it, i) => {
    _p.set(it.x, heightAt(it.x, it.z) - 0.15, it.z);
    _q.setFromAxisAngle(_up, i * 1.7);
    _s.setScalar(it.scale);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    circles.push({ x: it.x, z: it.z, r: sp.trunk * it.scale });
  });
  mesh.castShadow = shadows;
  mesh.computeBoundingSphere();
  return { mesh, circles };
}

/** Triangles per species, near and far (for checking the budget). */
export function speciesStats() {
  const out = {};
  for (const [k, sp] of Object.entries(SPECIES)) out[k] = [sp.hi.attributes.position.count / 3, sp.lo.attributes.position.count / 3];
  return out;
}

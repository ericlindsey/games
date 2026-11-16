// Trees and undergrowth. Each species is one low-poly geometry, instanced per
// terrain chunk. Placement is deterministic from the world seed and position.

import * as THREE from 'three';
import { hash2 } from '../util/noise.js';
import { WORLD, CHUNK } from '../config.js';
import { GeoBuilder, materials } from './build.js';
import { heightAt, slopeAt } from './terrain.js';
import { regionWeights } from './regions.js';
import { forestDensity, thicketDensity } from './forest.js';
import { inClearing, streamDistance, roadDistance } from './layout.js';
import { plantedIn, houseDistance } from './oldworks.js';
import { campNear } from './campSites.js';
import { pathDistance } from './paths.js';
import { relicDistance } from './relicSites.js';

const S = WORLD.seed;
const BARK = 0x5e4832, DARK_BARK = 0x4a3b2c;

function blade(b, angle, lean, w, h, color, tip = color) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const ox = Math.cos(angle * 3.7) * 0.25, oz = Math.sin(angle * 2.3) * 0.25;
  b.tri(ox - c * w, 0, oz - s * w, ox + c * w, 0, oz + s * w, ox - s * lean, h, oz + c * lean, color);
  if (tip !== color) {
    b.tri(ox - s * lean - c * w * 0.6, h * 0.82, oz + c * lean - s * w * 0.6,
          ox - s * lean + c * w * 0.6, h * 0.82, oz + c * lean + s * w * 0.6,
          ox - s * lean * 1.1, h * 1.12, oz + c * lean * 1.1, tip);
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3(), _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
/** A tapering bough from one point to another. */
function limb(b, x0, y0, z0, x1, y1, z1, r0, r1, color) {
  _a.set(x0, y0, z0); _b.set(x1, y1, z1);
  const len = _a.distanceTo(_b);
  _lq.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
  _lm.compose(_mid.copy(_a).add(_b).multiplyScalar(0.5), _lq, ONE);
  b.add(new THREE.CylinderGeometry(r1, r0, len, 5, 1, true), color, _lm.clone());
}

// name -> { geometry, trunk radius (0 = no collision), material, shadow }
const SPECIES = {};
function define(name, trunk, build, opts = {}) {
  const b = new GeoBuilder(name.length * 31 + 7, 0.09);
  build(b);
  SPECIES[name] = { geometry: b.geometry(), trunk, material: opts.double ? materials.flatDouble : materials.flat, shadow: opts.shadow !== false };
}

// ---- The great trees: planted long ago, a hundred feet tall, roofing the woods. ----
define('greatOak', 1.5, (b) => {
  b.cyl(1.4, 2.3, 1.6, 0, -0.2, 0, DARK_BARK, 7);
  b.cyl(1.05, 1.4, 9, 0, 1.2, 0, DARK_BARK, 7);
  const ends = [[8, 16, 1.5], [-6.5, 17, 5], [-4, 15.5, -7.5], [4.5, 17.5, -6], [1, 15, 8.5]];
  for (const [x, y, z] of ends) limb(b, 0, 9, 0, x, y, z, 0.75, 0.3, DARK_BARK);
  limb(b, 0, 9.5, 0, 0.5, 20, -0.5, 0.9, 0.35, DARK_BARK);
  const greens = [0x2f5f33, 0x386b38, 0x2b5830, 0x34653a, 0x3d7240];
  ends.forEach(([x, y, z], i) => b.blob(7.4, x * 1.12, y + 2.2, z * 1.12, greens[i], 1.15, 0.6, 1.15));
  b.blob(8.6, 0.5, 22.5, -0.5, 0x356a39, 1, 0.6, 1, 1);
});
define('greatCedar', 1.25, (b) => {
  b.cyl(1.1, 1.8, 1.4, 0, -0.2, 0, BARK, 6);
  b.cyl(0.35, 1.1, 30, 0, 1, 0, BARK, 6);
  const tiers = [[12.5, 12], [17.5, 10.4], [22.5, 8], [27, 5]];
  tiers.forEach(([y, R], t) => {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.1 + i * 2.094;
      limb(b, 0, y - 1.2, 0, Math.cos(a) * R * 0.6, y, Math.sin(a) * R * 0.6, 0.35, 0.15, BARK);
      b.blob(R * 0.62, Math.cos(a) * R * 0.55, y + 0.5, Math.sin(a) * R * 0.55, [0x355f3c, 0x3a6c3e, 0x2f5838][i], 1.15, 0.2, 1.15);
    }
  });
  b.cyl(0, 2.2, 3.5, 0, 29, 0, 0x3f7443, 6);
});
define('greatFir', 0.95, (b) => {
  b.cyl(0.85, 1.4, 1.3, 0, -0.2, 0, BARK, 6);
  b.cyl(0.45, 0.85, 16, 0, 1, 0, BARK, 6);
  b.cyl(0, 6.6, 9.5, 0, 11, 0, 0x26593a, 8);
  b.cyl(0, 5.3, 9, 0, 17, 0, 0x2b6240, 8);
  b.cyl(0, 4, 8.5, 0, 23, 0, 0x2f6b44, 7);
  b.cyl(0, 2.6, 8, 0, 29, 0, 0x357348, 7);
});
define('greatBeech', 0.9, (b) => {
  const SKIN = 0x9c968a;
  b.cyl(0.6, 0.95, 17, 0, -0.2, 0, SKIN, 6);
  const ends = [[5, 22, 2], [-4.5, 23, 3.5], [-1, 22, -5.5]];
  for (const [x, y, z] of ends) limb(b, 0, 16, 0, x, y, z, 0.45, 0.2, SKIN);
  b.blob(6.8, 5.8, 23.5, 2.4, 0x7fb04f, 1.15, 0.6, 1.15);
  b.blob(6.6, -5.4, 24.5, 4, 0x8ab957, 1.15, 0.6, 1.15);
  b.blob(6.8, -1, 23.5, -6.5, 0x76a84a, 1.15, 0.6, 1.15);
  b.blob(6.2, 0, 27, 0, 0x86b653, 1, 0.6, 1);
});
define('larch', 0.5, (b) => {
  b.cyl(0.2, 0.5, 23, 0, -0.2, 0, 0x6e5a44, 5);
  b.cyl(0, 4.2, 7, 0, 7, 0, 0x86b352, 7);
  b.cyl(0, 3.4, 7, 0, 12, 0, 0x8fbc59, 7);
  b.cyl(0, 2.4, 6.5, 0, 17, 0, 0x98c460, 6);
  b.cyl(0, 1.3, 4.5, 0, 21, 0, 0xa0cb66, 6);
});
define('cypress', 0.55, (b) => {
  b.cyl(0.35, 0.5, 2, 0, -0.2, 0, BARK, 5);
  b.cyl(1.7, 2.0, 9, 0, 1.5, 0, 0x234d33, 7);
  b.cyl(0, 1.7, 10.5, 0, 10.5, 0, 0x285538, 7);
});
define('stonePine', 0.55, (b) => {
  const RED = 0x8a5a3a;
  b.cyl(0.4, 0.6, 13, 0.4, -0.2, 0, RED, 6, 0, -0.05);
  const ends = [[4.5, 15.5, 1], [-3.5, 15.5, 3], [-1.5, 15.8, -4.2]];
  for (const [x, y, z] of ends) { limb(b, 0.8, 12.5, 0, x, y, z, 0.3, 0.14, RED); b.blob(4.6, x, y + 0.8, z, 0x3f6d45, 1.2, 0.3, 1.2); }
  b.blob(4, 0.5, 17.2, 0, 0x477a4c, 1.2, 0.3, 1.2);
});
define('willow', 0.7, (b) => {
  b.cyl(0.5, 0.75, 5.5, 0, -0.2, 0, 0x6a5a40, 6);
  b.blob(5.6, 0, 8.2, 0, 0x9bb85a, 1, 0.7, 1, 1);
  b.cyl(5.2, 4.5, 5, 0, 3, 0, 0x8fae52, 9);
});

// ---- The understory: the careless descendants, and the shrubs of the south. ----
define('bay', 0.3, (b) => {
  b.cyl(0.2, 0.3, 3.2, 0, 0, 0, 0x6a5237, 5);
  b.blob(2.3, 0, 4.9, 0, 0x4f8a3c, 1, 0.95, 1);
  b.blob(1.6, 1.3, 4, 0.6, 0x5a9644);
  b.blob(1.5, -1.1, 4.3, -0.8, 0x478036);
});
define('olive', 0.3, (b) => {
  b.cyl(0.2, 0.32, 2.2, 0, 0, 0, 0x6b5a45, 5, 0.12, 0.1);
  b.blob(1.6, 0.2, 3.1, 0, 0x8fa37a, 1.1, 0.8, 1);
  b.blob(1.2, -0.9, 2.7, 0.5, 0x9aae84);
});
define('hazel', 0.35, (b) => {
  for (let i = 0; i < 5; i++) { const a = i * 1.26; limb(b, 0, 0, 0, Math.cos(a) * 1.3, 2.6, Math.sin(a) * 1.3, 0.09, 0.05, 0x7a6248); }
  b.blob(1.9, 0, 3.1, 0, 0x8cb850, 1.1, 0.7, 1.1);
  b.blob(1.2, 1, 2.6, -0.8, 0x9ac55a);
});
define('juniper', 0.4, (b) => {
  b.cyl(0, 0.9, 2.6, 0, 0.1, 0, 0x3f6a4a, 6);
  b.cyl(0, 0.65, 1.8, 0.6, 0, 0.35, 0x477552, 5);
});
define('tamarisk', 0.2, (b) => {
  b.cyl(0.1, 0.16, 2, 0, 0, 0, 0x6e5546, 5, 0.1, -0.12);
  b.blob(1.5, 0.2, 2.9, 0, 0x9ab58a, 1.1, 0.6, 1.1);
  b.blob(1.1, -0.5, 3.5, 0.3, 0xd6a9bb, 1.1, 0.45, 1.1);
  b.blob(0.8, 0.9, 3.3, -0.4, 0xe0b6c6, 1, 0.4, 1);
});
define('youngFir', 0.2, (b) => {
  b.cyl(0.12, 0.18, 1.2, 0, 0, 0, BARK, 5);
  b.cyl(0, 1.5, 2.8, 0, 0.8, 0, 0x2f6b3a, 6);
  b.cyl(0, 1.0, 2.6, 0, 2.6, 0, 0x397a41, 6);
});

// ---- Deadfall and stone: the litter of an untended wood. ----
define('log', 0, (b) => {
  const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.06).setPosition(0, 0.42, 0);
  b.add(new THREE.CylinderGeometry(0.4, 0.5, 6.5, 6), 0x5a4a38, m);
  b.blob(0.9, -1.2, 0.75, 0.1, 0x6f9148, 1.6, 0.3, 0.7);
  b.blob(0.6, 1.6, 0.7, -0.1, 0x7a9b4f, 1.4, 0.3, 0.7);
  limb(b, 2.2, 0.5, 0, 2.9, 1.7, 0.6, 0.14, 0.06, 0x5a4a38);
}, { shadow: false });
define('stump', 0.5, (b) => {
  b.cyl(0.5, 0.75, 0.9, 0, -0.1, 0, 0x5e4c38, 7);
  b.cyl(0.46, 0.46, 0.05, 0, 0.8, 0, 0xb39a72, 7);
  b.blob(0.5, 0.45, 0.25, 0.3, 0x6f9148, 1, 0.4, 1);
}, { shadow: false });
define('boulder', 1.5, (b) => {
  b.add(new THREE.DodecahedronGeometry(1.8), 0x86827a, new THREE.Matrix4().makeScale(1.1, 0.75, 0.9));
  b.blob(1.3, 0.2, 0.95, 0, 0x6f9148, 1.2, 0.35, 1);
});
define('mushrooms', 0, (b) => {
  for (let i = 0; i < 5; i++) {
    const x = Math.cos(i * 2.2) * (0.15 + i * 0.09), z = Math.sin(i * 2.2) * (0.15 + i * 0.09), h = 0.14 + (i % 3) * 0.06;
    b.cyl(0.03, 0.04, h, x, 0, z, 0xe9e2cf, 4);
    b.cyl(0.02, 0.11, 0.07, x, h, z, i % 2 ? 0xc9432f : 0xd98a3a, 6);
  }
}, { shadow: false });

// ---- East of the road: heather and gorse standing above a man's head. ----
define('gorse', 1.05, (b) => {
  b.blob(1.5, 0, 1.4, 0, 0x4d7a3c, 1, 1.05, 1);
  b.add(new THREE.OctahedronGeometry(0.5), 0xe2c63a, new THREE.Matrix4().makeTranslation(0.4, 2.7, 0.2));
  b.add(new THREE.OctahedronGeometry(0.4), 0xe9d24a, new THREE.Matrix4().makeTranslation(-0.8, 2.2, -0.5));
}, { shadow: false });
define('tallHeather', 1.05, (b) => {
  b.blob(1.55, 0, 1.2, 0, 0x6f7a4a, 1, 0.9, 1);
  b.blob(1.15, 0.2, 2.1, 0.1, 0x9a6fa0, 1.1, 0.55, 1.1);
}, { shadow: false });

// ---- Underfoot: a wealth of herbs. ----
define('shrub', 0, (b) => {
  b.blob(0.7, 0, 0.36, 0, 0x4f8a3c, 1, 0.7, 1);
  b.blob(0.5, 0.5, 0.3, 0.25, 0x5a9644, 1, 0.7, 1);
}, { shadow: false });
define('broom', 0, (b) => {
  b.blob(0.7, 0, 0.42, 0, 0x5c8a40, 1, 0.8, 1);
  b.blob(0.42, 0.15, 0.8, 0.1, 0xe2c63a, 1, 0.6, 1);
}, { shadow: false });
define('heather', 0, (b) => {
  b.blob(0.85, 0, 0.18, 0, 0x9a6fa0, 1, 0.4, 1);
  b.blob(0.6, 0.6, 0.14, -0.4, 0xa77cab, 1, 0.4, 1);
}, { shadow: false });
define('thyme', 0, (b) => {
  b.blob(0.9, 0, 0.1, 0, 0x7a9a5a, 1.2, 0.3, 1.2);
  for (let i = 0; i < 5; i++) b.add(new THREE.OctahedronGeometry(0.09), 0xe6b3d6, new THREE.Matrix4().makeTranslation(Math.cos(i * 1.4) * 0.5, 0.36, Math.sin(i * 1.4) * 0.5));
}, { shadow: false });
define('sage', 0, (b) => {
  b.blob(0.5, 0, 0.3, 0, 0xa9b89a, 1, 0.8, 1);
  for (let i = 0; i < 6; i++) b.add(new THREE.OctahedronGeometry(0.1), 0xffffff, new THREE.Matrix4().makeTranslation(Math.cos(i * 1.1) * 0.3, 0.72 + (i % 2) * 0.12, Math.sin(i * 1.1) * 0.3));
}, { shadow: false });
define('flowers', 0, (b) => {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.2 + (i % 3) * 0.28;
    b.add(new THREE.OctahedronGeometry(0.11), 0xffffff,
      new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.24 + (i % 2) * 0.1, Math.sin(a) * r));
  }
}, { shadow: false });
define('asphodel', 0, (b) => {
  for (let i = 0; i < 3; i++) {
    const x = Math.cos(i * 2.1) * 0.3, z = Math.sin(i * 2.1) * 0.3, h = 0.8 + i * 0.18;
    b.tri(x - 0.03, 0, z, x + 0.03, 0, z, x, h, z, 0x6f9a4a);
    b.add(new THREE.OctahedronGeometry(0.1), 0xffffff, new THREE.Matrix4().makeScale(1, 2.2, 1).setPosition(x, h, z));
  }
  for (let i = 0; i < 4; i++) blade(b, i * 1.6, 0.25, 0.07, 0.45, 0x6f9a4a);
}, { double: true, shadow: false });
define('tuft', 0, (b) => {
  for (let i = 0; i < 6; i++) blade(b, i * 1.9, 0.12 + (i % 3) * 0.08, 0.09, 0.5 + (i % 4) * 0.12, 0x7fb04c);
}, { double: true, shadow: false });
define('fern', 0, (b) => {
  for (let i = 0; i < 7; i++) blade(b, i * 0.9, 0.55 + (i % 3) * 0.12, 0.17, 0.55 + (i % 2) * 0.2, 0x4f8f3f);
}, { double: true, shadow: false });
define('reed', 0, (b) => {
  for (let i = 0; i < 8; i++) blade(b, i * 2.1, 0.1 + (i % 3) * 0.1, 0.06, 1.3 + (i % 4) * 0.25, 0x9aa55c, 0x6b4f33);
}, { double: true, shadow: false });
define('rock', 0.7, (b) => {
  b.add(new THREE.DodecahedronGeometry(0.85), 0x8d8879, new THREE.Matrix4().makeScale(1, 0.62, 0.85));
}, { shadow: false });
define('mossRock', 0.7, (b) => {
  b.add(new THREE.DodecahedronGeometry(0.85), 0x858272, new THREE.Matrix4().makeScale(1.1, 0.6, 0.9));
  b.blob(0.7, 0, 0.36, 0, 0x6f9148, 1.2, 0.35, 1);
}, { shadow: false });

// What grows where: [species, weight] pairs per region.
const CANOPY = {
  central: [['greatCedar', 0.25], ['greatFir', 0.22], ['greatOak', 0.18], ['greatBeech', 0.15], ['larch', 0.12], ['cypress', 0.08]],
  south: [['greatOak', 0.45], ['greatBeech', 0.2], ['greatCedar', 0.15], ['greatFir', 0.15], ['larch', 0.05]],
  heath: [['stonePine', 0.5], ['greatFir', 0.25], ['larch', 0.25]],
  river: [['willow', 0.35], ['greatBeech', 0.3], ['greatOak', 0.2], ['cypress', 0.15]],
  foothill: [['stonePine', 1]],
};
const UNDER = {
  central: [['bay', 0.22], ['olive', 0.17], ['hazel', 0.18], ['juniper', 0.12], ['tamarisk', 0.09], ['youngFir', 0.08], ['log', 0.06], ['stump', 0.04], ['boulder', 0.04]],
  south: [['hazel', 0.28], ['bay', 0.24], ['youngFir', 0.16], ['juniper', 0.1], ['log', 0.1], ['stump', 0.05], ['boulder', 0.07]],
  heath: [['juniper', 0.5], ['olive', 0.3], ['tamarisk', 0.2]],
  river: [['tamarisk', 0.4], ['hazel', 0.3], ['bay', 0.3]],
  foothill: [['juniper', 0.6], ['olive', 0.4]],
};
const COVER = {
  central: [['tuft', 0.2], ['fern', 0.14], ['flowers', 0.16], ['sage', 0.12], ['thyme', 0.1], ['asphodel', 0.09], ['shrub', 0.07], ['broom', 0.04], ['mossRock', 0.05], ['mushrooms', 0.03]],
  south: [['fern', 0.32], ['tuft', 0.18], ['shrub', 0.12], ['mossRock', 0.12], ['flowers', 0.1], ['asphodel', 0.08], ['mushrooms', 0.08]],
  heath: [['heather', 0.42], ['broom', 0.2], ['thyme', 0.14], ['tuft', 0.12], ['rock', 0.12]],
  river: [['tuft', 0.34], ['reed', 0.22], ['flowers', 0.18], ['asphodel', 0.14], ['shrub', 0.12]],
  foothill: [['heather', 0.4], ['rock', 0.25], ['thyme', 0.2], ['tuft', 0.15]],
};
const REGION_KEYS = ['central', 'south', 'heath', 'river', 'foothill'];
const TINTABLE = { flowers: 1, sage: 1, asphodel: 1 };
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
export function buildVegetation(cx, cz, quality) {
  const lists = {}; // species -> [x, y, z, rot, scale, tint r, g, b]
  const circles = [];
  const put = (name, x, y, z, rot, scale, r, g, b) => {
    (lists[name] ||= []).push(x, y, z, rot, scale, r, g, b);
    const sp = SPECIES[name];
    if (sp.trunk && (!name.endsWith('ock') || scale > 1.3)) circles.push({ x, z, r: sp.trunk * scale });
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
      if (r > 0.42 * quality.under) continue;
      const x = (gx + H(gx, gz, 11)) * UC, z = (gz + H(gx, gz, 12)) * UC;
      if (r > (0.1 + 0.32 * forestDensity(x, z)) * quality.under) continue;
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

  // Undergrowth, and east of the road the tall thickets: one candidate per 4 m cell.
  const GC = 4, gn = size / GC;
  for (let j = 0; j < gn; j++) {
    for (let i = 0; i < gn; i++) {
      const gx = cx * gn + i, gz = cz * gn + j;
      const x = (gx + H(gx, gz, 21)) * GC, z = (gz + H(gx, gz, 22)) * GC;
      const roll = H(gx, gz, 20);
      const thick = x > 1400 ? thicketDensity(x, z) : 0;
      if (thick > 0 && roll < thick * 0.9) {
        if (campNear(x, z, 8) || inClearing(x, z)) continue;
        const h = heightAt(x, z);
        if (h > 170 || slopeAt(x, z) > 0.7) continue;
        const t = 0.82 + 0.3 * H(gx, gz, 28);
        put(H(gx, gz, 24) < 0.55 ? 'tallHeather' : 'gorse', x, h - 0.2, z, H(gx, gz, 29) * 6.283, 0.85 + 0.5 * H(gx, gz, 27), t, t, t);
        continue;
      }
      if (roll > 0.5 * quality.cover) continue;
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
    const mesh = new THREE.InstancedMesh(sp.geometry, sp.material, n);
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      _p.set(a[o], a[o + 1], a[o + 2]);
      _q.setFromAxisAngle(_up, a[o + 3]);
      _s.setScalar(a[o + 4]);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      mesh.setColorAt(i, _col.setRGB(a[o + 5], a[o + 6], a[o + 7]));
    }
    mesh.castShadow = sp.shadow && quality.shadows;
    mesh.receiveShadow = false;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }
  return { meshes, circles };
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

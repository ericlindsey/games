// Trees and undergrowth. Each species is one low-poly geometry, instanced per
// terrain chunk. Placement is deterministic from the world seed and position.

import * as THREE from 'three';
import { hash2 } from '../util/noise.js';
import { WORLD, CHUNK } from '../config.js';
import { GeoBuilder, materials } from './build.js';
import { heightAt, slopeAt } from './terrain.js';
import { regionWeights, forestDensity } from './regions.js';
import { inClearing, streamDistance, roadDistance } from './layout.js';

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

// name -> { geometry, trunk radius (0 = no collision), material, shadow }
const SPECIES = {};
function define(name, trunk, build, opts = {}) {
  const b = new GeoBuilder(name.length * 31 + 7, 0.09);
  build(b);
  SPECIES[name] = { geometry: b.geometry(), trunk, material: opts.double ? materials.flatDouble : materials.flat, shadow: opts.shadow !== false };
}

define('fir', 0.3, (b) => {
  b.cyl(0.2, 0.3, 2.6, 0, 0, 0, BARK, 6);
  b.cyl(0, 2.7, 5, 0, 1.8, 0, 0x2f6b3a, 7);
  b.cyl(0, 2.0, 4.5, 0, 4.9, 0, 0x33723d, 7);
  b.cyl(0, 1.3, 4, 0, 8, 0, 0x397a41, 7);
});
define('cypress', 0.28, (b) => {
  b.cyl(0.2, 0.25, 1.2, 0, 0, 0, BARK, 5);
  b.cyl(1.0, 1.25, 5, 0, 1, 0, 0x2b5a39, 7);
  b.cyl(0, 1.0, 7, 0, 6, 0, 0x2f623c, 7);
});
define('cedar', 0.4, (b) => {
  b.cyl(0.22, 0.4, 10, 0, 0, 0, BARK, 6);
  b.cyl(2.9, 4.3, 0.9, 0, 3.6, 0, 0x3a6c3e, 8);
  b.cyl(2.3, 3.5, 0.9, 0, 5.8, 0, 0x3f7443, 8);
  b.cyl(1.5, 2.5, 0.9, 0, 7.9, 0, 0x437a46, 8);
  b.cyl(0, 1.4, 1.8, 0, 9.6, 0, 0x478049, 7);
});
define('broadleaf', 0.33, (b) => {
  b.cyl(0.24, 0.34, 4.4, 0, 0, 0, 0x6a5237, 6);
  b.blob(2.7, 0, 6.2, 0, 0x5f9a3e, 1, 0.9, 1, 1);
  b.blob(2.0, 1.6, 5.2, 0.7, 0x6aa544);
  b.blob(1.9, -1.3, 5.5, -0.9, 0x578f3a);
});
define('olive', 0.26, (b) => {
  b.cyl(0.18, 0.28, 2.2, 0, 0, 0, 0x6b5a45, 5, 0.12, 0.1);
  b.blob(1.5, 0.2, 3.1, 0, 0x8fa37a, 1.1, 0.8, 1);
  b.blob(1.1, -0.9, 2.7, 0.5, 0x9aae84);
});
define('ilex', 0.95, (b) => {
  b.cyl(0.7, 1.05, 6.5, 0, 0, 0, DARK_BARK, 7);
  b.cyl(0.3, 0.45, 4, 1.6, 5, 0.4, DARK_BARK, 5, 0, -0.7);
  b.cyl(0.3, 0.45, 4, -1.4, 5, -0.8, DARK_BARK, 5, -0.3, 0.7);
  b.blob(5.2, 0, 10.5, 0, 0x2f5f33, 1, 0.75, 1, 1);
  b.blob(3.8, 3.8, 8.6, 1.2, 0x386b38);
  b.blob(3.6, -3.2, 9, -2.2, 0x2b5830);
  b.blob(3.4, 0.6, 8.8, 3.6, 0x34653a);
});
define('pine', 0.26, (b) => {
  b.cyl(0.18, 0.27, 8.6, 0, 0, 0, 0x7a5236, 6);
  b.blob(2.7, 0, 8.8, 0, 0x3f6d45, 1, 0.42, 1);
  b.blob(1.8, 0.5, 9.9, -0.3, 0x467649, 1, 0.45, 1);
});
define('willow', 0.42, (b) => {
  b.cyl(0.3, 0.44, 3.8, 0, 0, 0, 0x6a5a40, 6);
  b.blob(3.3, 0, 5.2, 0, 0x9bb85a, 1, 0.75, 1, 1);
  b.cyl(3.0, 2.6, 3.2, 0, 2.0, 0, 0x8fae52, 9);
});
define('shrub', 0, (b) => {
  b.blob(0.7, 0, 0.36, 0, 0x4f8a3c, 1, 0.7, 1);
  b.blob(0.5, 0.5, 0.3, 0.25, 0x5a9644, 1, 0.7, 1);
}, { shadow: false });
define('broom', 0, (b) => {
  b.blob(0.7, 0, 0.42, 0, 0x5c8a40, 1, 0.8, 1);
  b.blob(0.42, 0.15, 0.8, 0.1, 0xe2c63a, 1, 0.6, 1);
  b.blob(0.3, -0.4, 0.65, -0.25, 0xe9d24a, 1, 0.6, 1);
}, { shadow: false });
define('heather', 0, (b) => {
  b.blob(0.85, 0, 0.18, 0, 0x9a6fa0, 1, 0.4, 1);
  b.blob(0.6, 0.6, 0.14, -0.4, 0xa77cab, 1, 0.4, 1);
}, { shadow: false });
define('flowers', 0, (b) => {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = 0.2 + (i % 3) * 0.28;
    b.add(new THREE.OctahedronGeometry(0.11), 0xffffff,
      new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.24 + (i % 2) * 0.1, Math.sin(a) * r));
  }
}, { shadow: false });
define('tuft', 0, (b) => {
  for (let i = 0; i < 6; i++) blade(b, i * 1.9, 0.12 + (i % 3) * 0.08, 0.09, 0.5 + (i % 4) * 0.12, 0x7fb04c);
}, { double: true, shadow: false });
define('reed', 0, (b) => {
  for (let i = 0; i < 8; i++) blade(b, i * 2.1, 0.1 + (i % 3) * 0.1, 0.06, 1.3 + (i % 4) * 0.25, 0x9aa55c, 0x6b4f33);
}, { double: true, shadow: false });
define('rock', 0.7, (b) => {
  b.add(new THREE.DodecahedronGeometry(0.85), 0x8d8879, new THREE.Matrix4().makeScale(1, 0.62, 0.85));
}, {});

// Which trees and undergrowth grow in each region: [species, weight] pairs.
const TREES = {
  central: [['fir', 0.28], ['cedar', 0.2], ['broadleaf', 0.25], ['cypress', 0.15], ['olive', 0.12]],
  south: [['ilex', 0.5], ['broadleaf', 0.2], ['cedar', 0.15], ['fir', 0.1], ['cypress', 0.05]],
  heath: [['pine', 0.6], ['olive', 0.2], ['fir', 0.2]],
  river: [['willow', 0.45], ['broadleaf', 0.4], ['cypress', 0.15]],
  foothill: [['pine', 0.4], ['fir', 0.3], ['olive', 0.3]],
};
const COVER = {
  central: [['tuft', 0.4], ['flowers', 0.27], ['shrub', 0.18], ['broom', 0.1], ['rock', 0.05]],
  south: [['tuft', 0.5], ['shrub', 0.28], ['flowers', 0.12], ['rock', 0.1]],
  heath: [['heather', 0.45], ['broom', 0.25], ['tuft', 0.17], ['rock', 0.13]],
  river: [['tuft', 0.4], ['reed', 0.3], ['flowers', 0.2], ['shrub', 0.1]],
  foothill: [['rock', 0.35], ['broom', 0.22], ['shrub', 0.2], ['tuft', 0.23]],
};
const REGION_KEYS = ['central', 'south', 'heath', 'river', 'foothill'];
const FLOWER_TINTS = [0xffffff, 0xf6e36a, 0xf2a3c0, 0xb99cf0, 0x8fc0f5, 0xffc27a].map((h) => new THREE.Color(h));

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
    if (sp.trunk && (name !== 'rock' || scale > 1.3)) circles.push({ x, z, r: sp.trunk * scale });
  };

  // Trees: one candidate per 10 m cell.
  const TC = 10, tn = CHUNK.size / TC;
  for (let j = 0; j < tn; j++) {
    for (let i = 0; i < tn; i++) {
      const gx = cx * tn + i, gz = cz * tn + j;
      const x = (gx + 0.15 + 0.7 * hash2(gx, gz, S + 1)) * TC;
      const z = (gz + 0.15 + 0.7 * hash2(gx, gz, S + 2)) * TC;
      if (hash2(gx, gz, S + 3) > forestDensity(x, z) * quality.trees) continue;
      if (inClearing(x, z) || streamDistance(x, z) < 4.5) continue;
      const h = heightAt(x, z);
      if (h < 0.7 || h > 240 || slopeAt(x, z) > 0.55) continue;
      regionWeights(x, z, w);
      let name = pick(TREES[pickRegion(hash2(gx, gz, S + 4))], hash2(gx, gz, S + 5));
      if (w.lawn > 0.4) name = 'broadleaf';
      if (w.fen > 0.4) name = 'willow';
      if (h < 1.6 && name !== 'willow') continue;
      const t = 0.86 + 0.24 * hash2(gx, gz, S + 6);
      put(name, x, h - 0.15, z, hash2(gx, gz, S + 7) * 6.283, 0.75 + 0.6 * hash2(gx, gz, S + 8),
        t, t * (0.97 + 0.06 * hash2(gx, gz, S + 9)), t * 0.96);
    }
  }

  // Undergrowth: one candidate per 5 m cell.
  const GC = 5, gn = CHUNK.size / GC;
  for (let j = 0; j < gn; j++) {
    for (let i = 0; i < gn; i++) {
      const gx = cx * gn + i, gz = cz * gn + j;
      if (hash2(gx, gz, S + 20) > 0.42 * quality.cover) continue;
      const x = (gx + hash2(gx, gz, S + 21)) * GC;
      const z = (gz + hash2(gx, gz, S + 22)) * GC;
      if (inClearing(x, z) || roadDistance(x, z) < 4.5) continue;
      const h = heightAt(x, z);
      if (h < 0.05 || h > 200) continue;
      regionWeights(x, z, w);
      let name = pick(COVER[pickRegion(hash2(gx, gz, S + 23))], hash2(gx, gz, S + 24));
      const wet = h < 1.4 || streamDistance(x, z) < 5;
      if (wet || w.fen > 0.3) name = hash2(gx, gz, S + 25) < 0.75 ? 'reed' : 'tuft';
      else if (name === 'reed') name = 'tuft';
      if (w.lawn > 0.5 && name !== 'flowers') name = hash2(gx, gz, S + 26) < 0.6 ? 'flowers' : 'tuft';
      if (name !== 'rock' && slopeAt(x, z) > 0.7) continue;
      const scale = 0.7 + 0.8 * hash2(gx, gz, S + 27);
      if (name === 'flowers') {
        const c = FLOWER_TINTS[Math.floor(hash2(gx, gz, S + 28) * FLOWER_TINTS.length)];
        put(name, x, h, z, hash2(gx, gz, S + 29) * 6.283, scale, c.r, c.g, c.b);
      } else {
        const t = 0.85 + 0.25 * hash2(gx, gz, S + 28);
        put(name, x, h - 0.05, z, hash2(gx, gz, S + 29) * 6.283, name === 'rock' ? scale * 1.3 : scale, t, t, t * 0.95);
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

// Grass: a field of blades around the ranger, thick in the glades and the old
// fields, thin under the trees, gone from the roads and trodden paths. Built in
// square tiles as the ranger moves and dropped behind; the blades lean in the
// wind and shrink away toward the edge of the field so it never pops.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { heightAt, streamDistance, WATER_LEVEL } from './terrain.js';
import { groundColor } from './groundColor.js';
import { forestDensity } from './forest.js';
import { regionWeights } from './regions.js';
import { inField } from './oldworks.js';
import { pathWear } from './paths.js';
import { campNear } from './campSites.js';
import { roadDistance, ROAD_HALF_WIDTH, HA, gorgeZ, inClearing, bankX } from './layout.js';
import { groundAt } from './collision.js';
import { hash2 } from '../util/noise.js';
import { surfaceMaterial, SURF } from './surface.js';

const TILE = 24;
const S = WORLD.seed + 900;

/** One clump: a few curved blades, dark at the root and pale at the tip. */
function clumpGeometry(blades, segs) {
  const p = [], n = [], c = [], s = [];
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * Math.PI * 2 + k * 0.7;
    const ox = Math.cos(a * 1.7) * 0.16, oz = Math.sin(a * 2.3) * 0.16;
    const fx = Math.cos(a), fz = Math.sin(a);       // the way it bends
    const wx = -fz * 0.05, wz = fx * 0.05;         // half its width at the root
    const hgt = 0.75 + 0.25 * ((k * 7) % 3) / 2, bend = 0.22 + 0.1 * (k % 2);
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = 1 - t;
      const x = ox + fx * bend * t * t, z = oz + fz * bend * t * t, y = hgt * t;
      pts.push([x - wx * w, y, z - wz * w, x + wx * w, y, z + wz * w, t]);
    }
    for (let i = 0; i < segs; i++) {
      const A = pts[i], B = pts[i + 1];
      const quad = [[A[0], A[1], A[2], A[6]], [A[3], A[4], A[5], A[6]], [B[3], B[4], B[5], B[6]], [A[0], A[1], A[2], A[6]], [B[3], B[4], B[5], B[6]], [B[0], B[1], B[2], B[6]]];
      for (const [x, y, z, t] of quad) {
        p.push(x, y, z);
        n.push(fx * 0.3, 1, fz * 0.3); // lit mostly from above, like a lawn
        const shade = 0.45 + 0.75 * t;
        c.push(shade, shade, shade * 0.92);
        s.push(SURF.leaf);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.setAttribute('surf', new THREE.Float32BufferAttribute(s, 1));
  return g;
}

const _w = {}, _rgb = [0, 0, 0], _c = new THREE.Color();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** How thickly grass grows at a point, 0..1, and how tall. */
export function grassAt(x, z, h) {
  if (h < WATER_LEVEL + 0.3 || x < bankX(z) + 4) return 0;
  if (roadDistance(x, z) < ROAD_HALF_WIDTH + 0.8) return 0;
  if (streamDistance(x, z) < 2.6) return 0;
  // the wet stone of the basin and the cut at Henneth Annûn
  if (h < HA.plateau - 9 && x < HA.x + 1 && x > HA.gorge.endX && Math.abs(z - (x < HA.basin.minX ? gorgeZ(x) : HA.z)) < 24) return 0;
  let d = 1 - 0.72 * forestDensity(x, z);
  regionWeights(x, z, _w);
  d *= 1 - 0.35 * _w.heath - 0.55 * _w.foothill - 0.5 * _w.fen;
  if (inField(x, z) || _w.lawn > 0.3) d = Math.max(d, 0.95);
  d *= 1 - Math.min(1, pathWear(x, z) * 1.3);
  if (campNear(x, z, 9)) d *= 0.25;
  if (inClearing(x, z)) d *= 0.8;
  return d;
}

export class Grass {
  constructor(scene, quality) {
    this.scene = scene;
    this.tiles = new Map();
    this.material = surfaceMaterial({ kind: SURF.leaf, wind: 0.12, fade: [10, 20] });
    this.geometry = clumpGeometry(7, 3);
    this.setQuality(quality);
  }

  setQuality(q) {
    this.radius = q.grass ?? 0;
    this.spacing = q.grassSpacing ?? 0.7;
    this.shadows = q.shadows;
    this.material.userData.surf.uFade.value.set(Math.max(4, this.radius - 16), this.radius - 2);
    for (const key of [...this.tiles.keys()]) this.drop(key);
  }

  drop(key) {
    const t = this.tiles.get(key);
    if (t?.mesh) { this.scene.remove(t.mesh); t.mesh.dispose(); }
    this.tiles.delete(key);
  }

  build(tx, tz) {
    const sp = this.spacing, n = Math.round(TILE / sp);
    const x0 = tx * TILE, z0 = tz * TILE;
    // ground colour on a coarse lattice, looked up by the nearest point
    const CS = 3, cn = TILE / CS + 1, cols = new Float32Array(cn * cn * 3);
    for (let j = 0; j < cn; j++) {
      for (let i = 0; i < cn; i++) {
        const x = x0 + i * CS, z = z0 + j * CS, h = heightAt(x, z);
        groundColor(x, z, h, 0, _rgb);
        _c.setRGB(_rgb[0], _rgb[1], _rgb[2], THREE.SRGBColorSpace);
        cols.set([_c.r, _c.g, _c.b], (j * cn + i) * 3);
      }
    }
    const items = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gx = tx * n + i, gz = tz * n + j;
        const r = hash2(gx, gz, S);
        const x = x0 + (i + hash2(gx, gz, S + 1)) * sp, z = z0 + (j + hash2(gx, gz, S + 2)) * sp;
        const h = heightAt(x, z);
        const dens = grassAt(x, z, h);
        if (r > dens) continue;
        // not up through paving, floors and walls
        if (groundAt(x, z, h + 50) > h + 0.08) continue;
        const k = ((Math.round((z - z0) / CS) * cn) + Math.round((x - x0) / CS)) * 3;
        const tall = 0.45 + 0.55 * hash2(gx, gz, S + 3) * (0.5 + 0.5 * dens);
        items.push(x, h - 0.05, z, hash2(gx, gz, S + 4) * 6.283, tall, cols[k], cols[k + 1], cols[k + 2]);
      }
    }
    const count = items.length / 8;
    const tile = { mesh: null };
    if (count) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
      const vary = (t) => 0.9 + 0.25 * t;
      for (let i = 0; i < count; i++) {
        const o = i * 8, sc = items[o + 4];
        _p.set(items[o], items[o + 1], items[o + 2]);
        _q.setFromAxisAngle(_up, items[o + 3]);
        _s.set(0.8 + sc * 0.5, sc, 0.8 + sc * 0.5);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        const v = vary((i * 0.618) % 1);
        mesh.setColorAt(i, _c.setRGB(items[o + 5] * v * 1.15, items[o + 6] * v * 1.2, items[o + 7] * v));
      }
      mesh.receiveShadow = this.shadows;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
      tile.mesh = mesh;
    }
    this.tiles.set(tx + ',' + tz, tile);
  }

  /** Keep tiles within the radius; build at most `budget` a call. */
  update(px, pz, budget = 2) {
    if (!this.radius) return;
    const R = this.radius;
    const want = [];
    for (let tz = Math.floor((pz - R) / TILE); tz <= Math.floor((pz + R) / TILE); tz++) {
      for (let tx = Math.floor((px - R) / TILE); tx <= Math.floor((px + R) / TILE); tx++) {
        const dx = Math.max(tx * TILE - px, 0, px - (tx + 1) * TILE), dz = Math.max(tz * TILE - pz, 0, pz - (tz + 1) * TILE);
        const d = Math.hypot(dx, dz);
        if (d < R) want.push([d, tx, tz]);
      }
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz] of want) {
      if (budget <= 0) break;
      if (this.tiles.has(tx + ',' + tz)) continue;
      this.build(tx, tz);
      budget--;
    }
    for (const [key] of this.tiles) {
      const [tx, tz] = key.split(',').map(Number);
      const dx = Math.max(tx * TILE - px, 0, px - (tx + 1) * TILE), dz = Math.max(tz * TILE - pz, 0, pz - (tz + 1) * TILE);
      if (Math.hypot(dx, dz) > R + TILE) this.drop(key);
    }
  }
}

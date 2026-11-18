// Stone that looks like stone: boulders, outcrops and scree built from a
// lumpy sphere, then split along a few fracture planes so they show flat,
// broken faces with sharp edges, as real weathered rock does. Hollows are
// shaded darker. All deterministic from a seed.

import * as THREE from 'three';
import { smoothNormals, SURF } from './build.js';

function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return ((Math.imul(h, 2246822519) ^ (h >>> 13)) >>> 0) / 4294967296;
}
/** Smooth 3D value noise in [-1, 1]. */
export function noise3(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, s);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), ux), L(c(0, 1, 0), c(1, 1, 0), ux), uy),
    L(L(c(0, 0, 1), c(1, 0, 1), ux), L(c(0, 1, 1), c(1, 1, 1), ux), uy), uz) * 2 - 1;
}
export function fbm3(x, y, z, oct, s) {
  let sum = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { sum += noise3(x, y, z, s + i * 13) * a; n += a; x *= 2.1; y *= 2.1; z *= 2.1; a *= 0.5; }
  return sum / n;
}

function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _v = new THREE.Vector3(), _p = new THREE.Vector3();

/**
 * A unit-ish rock, resting on y = 0 with a buried base, about 1 across before scaling.
 * @param {object} o detail (sphere subdivision), cuts (fracture planes), rough,
 *   sx, sy, sz (stretch), strata (horizontal bedding, 0..1), sink (how deep the base sits)
 * @returns {THREE.BufferGeometry} non-indexed, with normals and a `color` shade attribute
 */
export function rockGeometry(seed, o = {}) {
  const rand = rngOf(seed * 7919 + 13);
  const detail = o.detail ?? 3, cuts = o.cuts ?? 6, rough = o.rough ?? 0.22;
  const sx = o.sx ?? 1, sy = o.sy ?? 0.7, sz = o.sz ?? 0.85, strata = o.strata ?? 0, sink = o.sink ?? 0.18;
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = g.attributes.position;
  const planes = [];
  for (let i = 0; i < cuts; i++) {
    const a = rand() * Math.PI * 2, e = (rand() - 0.25) * 1.6;
    planes.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), 0.3 + rand() * 0.14]);
  }
  if (o.flatTop) planes.push([0, 1, 0, 0.26]);
  const disp = new Float32Array(pos.count);
  const done = new Map();
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const key = `${_v.x.toFixed(4)},${_v.y.toFixed(4)},${_v.z.toFixed(4)}`;
    const hit = done.get(key);
    if (hit) { pos.setXYZ(i, hit[0], hit[1], hit[2]); disp[i] = hit[3]; continue; }
    const n = fbm3(_v.x * 2.2 + seed, _v.y * 2.2, _v.z * 2.2, 4, seed);
    let f = 1 + n * rough * 2;
    _p.copy(_v).multiplyScalar(f);
    for (const [nx, ny, nz, d] of planes) {
      const k = _p.x * nx + _p.y * ny + _p.z * nz;
      if (k > d) { _p.x -= nx * (k - d); _p.y -= ny * (k - d); _p.z -= nz * (k - d); }
    }
    if (strata > 0) { // bedding: the surface steps in and out in layers
      const layer = Math.sin((_p.y + seed * 0.37) * 26) * 0.5 + 0.5;
      const s = 1 - strata * 0.08 * Math.pow(layer, 4);
      _p.x *= s; _p.z *= s;
    }
    _p.set(_p.x * sx, Math.max(_p.y * sy, -sink), _p.z * sz);
    _p.y += sink;
    const shade = 0.72 + 0.28 * Math.min(1, Math.max(0, (_p.length() / 0.5 - 0.55) * 1.4)) * (0.85 + 0.15 * Math.sign(_p.y - sink));
    pos.setXYZ(i, _p.x, _p.y, _p.z);
    disp[i] = shade;
    done.set(key, [_p.x, _p.y, _p.z, shade]);
  }
  smoothNormals(g, 0.55);
  // darker underneath and in hollows
  const col = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) col[i] = Math.min(1.08, disp[i] * (0.8 + 0.25 * Math.min(1, pos.getY(i) / (sy * 0.6 + 0.01))));
  g.setAttribute('color', new THREE.BufferAttribute(col, 1));
  return g;
}

// Shapes are reused: small stones by the thousand would otherwise each be made anew.
const cache = new Map();
function cachedRock(seed, o) {
  const big = (o.detail ?? 3) >= 2;
  const key = (big ? seed : seed % 24) + JSON.stringify(o);
  let g = cache.get(key);
  if (!g) { g = rockGeometry(big ? seed : seed % 24, o); cache.set(key, g); }
  return g;
}

/** Add a rock into a GeoBuilder: centre of its base at (x, y, z), `size` across. */
export function addRock(b, x, y, z, size, color, seed, o = {}, ry = null) {
  const g = cachedRock(seed, o);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tilt ? (b.rand() - 0.5) * o.tilt : 0, ry ?? b.rand() * 6.283, o.tilt ? (b.rand() - 0.5) * o.tilt : 0)),
    new THREE.Vector3(size, size, size),
  );
  const save = b.kind;
  b.kind = SURF.rock;
  b.add(g, color, m, true);
  b.kind = save;
  return b;
}

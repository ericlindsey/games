// Helpers for building low-poly, vertex-coloured, flat-shaded geometry in code.

import * as THREE from 'three';
import { rng, noise2 } from '../util/noise.js';

export const materials = {
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  flatDouble: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
  smooth: new THREE.MeshLambertMaterial({ vertexColors: true }),
};

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const ONE = new THREE.Vector3(1, 1, 1);

/** Collects coloured triangles from many primitives into one mesh. */
export class GeoBuilder {
  constructor(seed = 1, vary = 0.07) {
    this.p = [];
    this.c = [];
    this.rand = rng(seed);
    this.vary = vary;
  }

  /** Add a geometry with a colour, optionally transformed by a matrix. */
  add(geom, color, matrix) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    const pos = g.attributes.position;
    _c.set(color);
    for (let i = 0; i < pos.count; i += 3) {
      const k = 1 + (this.rand() - 0.5) * 2 * this.vary;
      for (let j = 0; j < 3; j++) {
        _v.fromBufferAttribute(pos, i + j);
        if (matrix) _v.applyMatrix4(matrix);
        this.p.push(_v.x, _v.y, _v.z);
        this.c.push(_c.r * k, _c.g * k, _c.b * k);
      }
    }
    return this;
  }

  /** Box whose base sits at y. Rotation in radians (ry first). */
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    _m.compose(_v.set(x, y + h / 2, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), ONE);
    return this.add(new THREE.BoxGeometry(w, h, d), color, _m.clone());
  }

  /** Cylinder (or cone, with rTop = 0) whose base sits at y. */
  cyl(rTop, rBottom, h, x, y, z, color, seg = 8, rx = 0, rz = 0) {
    _m.compose(_v.set(x, y + h / 2, z), _q.setFromEuler(_e.set(rx, 0, rz)), ONE);
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, _m.clone());
  }

  /** Faceted blob centred at (x, y, z), optionally squashed. */
  blob(r, x, y, z, color, sx = 1, sy = 1, sz = 1, detail = 0) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(this.rand() * 3, this.rand() * 3, 0)), new THREE.Vector3(sx, sy, sz));
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, _m.clone());
  }

  /** A single triangle (for blades of grass and the like). */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color) {
    _c.set(color);
    const k = 1 + (this.rand() - 0.5) * 2 * this.vary;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let j = 0; j < 3; j++) this.c.push(_c.r * k, _c.g * k, _c.b * k);
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }

  mesh(material = materials.flat, shadows = true) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    return m;
  }
}

/** Displace a point by a smooth 3D field, so neighbouring rock stays watertight. */
export function rockDisplace(v, amp, seed = 7) {
  const s = 1 / 5.5;
  const dx = noise2(v.y * s + 3.1, v.z * s, seed);
  const dy = noise2(v.x * s, v.z * s + 7.7, seed + 1);
  const dz = noise2(v.x * s + 1.3, v.y * s, seed + 2);
  v.x += dx * amp; v.y += dy * amp * 0.6; v.z += dz * amp;
  return v;
}

/** Small repeating canvas texture of soft blotches, for water. */
export function makeNoiseTexture(size = 128, seed = 5, streaks = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const period = 6;
  // Tileable value noise: blend samples offset by one period in each axis.
  const tile = (u, v, fu, fv, sd) => {
    const a = noise2(u * period * fu, v * period * fv, sd);
    const b = noise2((u - 1) * period * fu, v * period * fv, sd);
    const c = noise2(u * period * fu, (v - 1) * period * fv, sd);
    const d = noise2((u - 1) * period * fu, (v - 1) * period * fv, sd);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = streaks ? tile(u, v, 4, 0.4, seed) : tile(u, v, 1, 1, seed) * 0.7 + tile(u, v, 2.5, 2.5, seed + 1) * 0.3;
      const val = Math.max(0, Math.min(255, 205 + n * 120));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

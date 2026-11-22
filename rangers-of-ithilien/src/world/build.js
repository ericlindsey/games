// Helpers for building low-poly, vertex-coloured, flat-shaded geometry in code.

import * as THREE from 'three';
import { rng, noise2 } from '../util/noise.js';

import { surfaceMaterial, SURF, SOLID_UV } from './surface.js';

export { SURF };

// Normals are stored per vertex by GeoBuilder (faceted or smooth part by part),
// so none of these needs flatShading.
export const materials = {
  flat: surfaceMaterial({ kind: SURF.plain }),
  flatDouble: surfaceMaterial({ kind: SURF.plain, side: THREE.DoubleSide }),
  smooth: surfaceMaterial({ kind: SURF.plain }),
  stone: surfaceMaterial({ kind: SURF.masonry, cards: true }),
  rock: surfaceMaterial({ kind: SURF.rock, cards: true }),
  rockDouble: surfaceMaterial({ kind: SURF.rock, side: THREE.DoubleSide }),
  wood: surfaceMaterial({ kind: SURF.wood }),
  plant: surfaceMaterial({ kind: SURF.leaf, cards: true, wind: 0.0016 }),
  tree: surfaceMaterial({ kind: SURF.leaf, cards: true, wind: 0.00022 }),
  herb: surfaceMaterial({ kind: SURF.leaf, cards: true, wind: 0.06, fade: [38, 56], lod: false }),
  rockCover: surfaceMaterial({ kind: SURF.rock, fade: [38, 56], lod: false }),
  still: surfaceMaterial({ kind: SURF.leaf, cards: true }),
};

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * Collects coloured triangles from many primitives into one mesh.
 * Set `kind` (a SURF kind) before adding parts to choose their grain, and
 * `smooth = true` to keep a part's own rounded normals instead of facets.
 */
export class GeoBuilder {
  constructor(seed = 1, vary = 0.07) {
    this.p = [];
    this.c = [];
    this.n = [];
    this.uv = [];
    this.s = [];
    this.rand = rng(seed);
    this.vary = vary;
    this.kind = 0;
    this.smooth = false;
  }

  _push(x, y, z, nx, ny, nz, r, g, b, u, v) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.uv.push(u, v); this.s.push(this.kind);
  }

  /** Add a geometry with a colour, optionally transformed by a matrix. */
  add(geom, color, matrix, smooth = this.smooth) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    const pos = g.attributes.position, nor = g.attributes.normal, uvs = g.attributes.uv, tint = g.attributes.color;
    const useN = smooth && nor;
    if (matrix && useN) _nm.getNormalMatrix(matrix);
    _c.set(color);
    for (let i = 0; i < pos.count; i += 3) {
      const k = 1 + (this.rand() - 0.5) * 2 * this.vary;
      if (!useN) {
        _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _d.fromBufferAttribute(pos, i + 2);
        if (matrix) { _a.applyMatrix4(matrix); _b.applyMatrix4(matrix); _d.applyMatrix4(matrix); }
        _n.copy(_d).sub(_b).cross(_v.copy(_a).sub(_b)).normalize();
      }
      for (let j = 0; j < 3; j++) {
        _v.fromBufferAttribute(pos, i + j);
        if (matrix) _v.applyMatrix4(matrix);
        if (useN) {
          _n.fromBufferAttribute(nor, i + j);
          if (matrix) _n.applyMatrix3(_nm);
          _n.normalize();
        }
        const u = uvs && this.uvRect ? this.uvRect[0] + uvs.getX(i + j) * (this.uvRect[1] - this.uvRect[0]) : SOLID_UV[0];
        const v = uvs && this.uvRect ? uvs.getY(i + j) : SOLID_UV[1];
        const t = tint ? tint.getX(i + j) : 1; // a part may shade itself (hollows darker)
        this._push(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, _c.r * k * t, _c.g * k * t, _c.b * k * t, u, v);
      }
    }
    return this;
  }

  /** Box whose base sits at y. Rotation in radians (ry first). */
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    _m.compose(_v.set(x, y + h / 2, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), ONE);
    return this.add(new THREE.BoxGeometry(w, h, d), color, _m.clone(), false);
  }

  /** Cylinder (or cone, with rTop = 0) whose base sits at y. */
  cyl(rTop, rBottom, h, x, y, z, color, seg = 8, rx = 0, rz = 0) {
    _m.compose(_v.set(x, y + h / 2, z), _q.setFromEuler(_e.set(rx, 0, rz)), ONE);
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, _m.clone());
  }

  /** Faceted blob centred at (x, y, z), optionally squashed. */
  blob(r, x, y, z, color, sx = 1, sy = 1, sz = 1, detail = 0) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(this.rand() * 3, this.rand() * 3, 0)), new THREE.Vector3(sx, sy, sz));
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, _m.clone(), false);
  }

  /**
   * A soft, lumpy mass (a canopy, a bush, a mound): a displaced sphere with
   * rounded normals. `rough` is how far the surface wanders, as a share of r.
   */
  lump(r, x, y, z, color, sx = 1, sy = 1, sz = 1, detail = 2, rough = 0.18, rot = null) {
    const g = new THREE.IcosahedronGeometry(1, Math.min(detail, this.maxDetail ?? 9));
    const pos = g.attributes.position, seed = Math.floor(this.rand() * 1000);
    const cache = new Map();
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      const key = `${_v.x.toFixed(3)},${_v.y.toFixed(3)},${_v.z.toFixed(3)}`;
      let f = cache.get(key);
      if (f === undefined) {
        f = 1 + rough * (noise2(_v.x * 1.7 + _v.y * 0.6, _v.z * 1.7 - _v.y * 0.4, seed) * 0.75 + noise2(_v.x * 4.1, _v.z * 4.1 + _v.y * 3, seed + 1) * 0.35);
        cache.set(key, f);
      }
      pos.setXYZ(i, _v.x * f, _v.y * f, _v.z * f);
    }
    smoothNormals(g);
    const r1 = this.rand() * 3, r2 = this.rand() * 3;
    _m.compose(_v.set(x, y, z), _q.setFromEuler(rot ? _e.set(rot[0], rot[1], rot[2], 'YXZ') : _e.set(r1, r2, 0)), new THREE.Vector3(sx * r, sy * r, sz * r));
    return this.add(g, color, _m.clone(), true);
  }

  /** A tiny flower or berry: a diamond of two triangles, cheaper than a blob. */
  dot(r, x, y, z, color) {
    const a = this.rand() * 3.14;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    this.tri(x - cx, y, z - cz, x + cz * 0.6, y + r * 0.5, z - cx * 0.6, x + cx, y, z + cz, color);
    this.tri(x - cx, y, z - cz, x + cx, y, z + cz, x - cz * 0.6, y + r * 0.5, z + cx * 0.6, color);
    return this;
  }

  /** A single triangle (for blades of grass and the like). */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color) {
    _c.set(color);
    const k = 1 + (this.rand() - 0.5) * 2 * this.vary;
    _a.set(ax, ay, az); _b.set(bx, by, bz); _d.set(cx, cy, cz);
    _n.copy(_d).sub(_b).cross(_v.copy(_a).sub(_b)).normalize();
    // grass and leaves: lean the normal upward so both faces light like foliage
    if (this.smooth) _n.lerp(_v.set(0, 1, 0), 0.6).normalize();
    this._push(ax, ay, az, _n.x, _n.y, _n.z, _c.r * k, _c.g * k, _c.b * k, SOLID_UV[0], SOLID_UV[1]);
    this._push(bx, by, bz, _n.x, _n.y, _n.z, _c.r * k, _c.g * k, _c.b * k, SOLID_UV[0], SOLID_UV[1]);
    this._push(cx, cy, cz, _n.x, _n.y, _n.z, _c.r * k, _c.g * k, _c.b * k, SOLID_UV[0], SOLID_UV[1]);
    return this;
  }

  /**
   * A cut-out card of leaves: a quad of size w x h centred at (x, y, z), facing
   * along `normal` (the card's normal leans toward it), using an atlas region.
   * Its shading normal points out of the mass it belongs to (`out`).
   */
  card(x, y, z, w, h, nx, ny, nz, color, region, spin = 0, out = null) {
    _n.set(nx, ny, nz).normalize();
    // build a basis on the card
    const up = Math.abs(_n.y) > 0.95 ? _v.set(1, 0, 0) : _v.set(0, 1, 0);
    const tx = new THREE.Vector3().crossVectors(up, _n).normalize();
    const ty = new THREE.Vector3().crossVectors(_n, tx).normalize();
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const ax = tx.clone().multiplyScalar(cs).addScaledVector(ty, sn).multiplyScalar(w / 2);
    const ay = ty.clone().multiplyScalar(cs).addScaledVector(tx, -sn).multiplyScalar(h / 2);
    const sh = out ? new THREE.Vector3(...out).normalize() : _n.clone();
    _c.set(color);
    const k = 1 + (this.rand() - 0.5) * 2 * this.vary;
    // A lighter form keeps only some cards (the same ones each time), a little larger.
    if (this.cardKeep !== undefined && this.cardKeep < 1) {
      const n = (this._cards = (this._cards ?? 0) + 1);
      if (Math.floor(n * this.cardKeep) === Math.floor((n - 1) * this.cardKeep)) return this;
      ax.multiplyScalar(1.3); ay.multiplyScalar(1.3);
    }
    const [u0, u1] = region;
    const corner = (sx, sy) => [x + ax.x * sx + ay.x * sy, y + ax.y * sx + ay.y * sy, z + ax.z * sx + ay.z * sy, u0 + (u1 - u0) * (sx + 1) / 2, (sy + 1) / 2];
    const A = corner(-1, -1), B = corner(1, -1), C = corner(1, 1), D = corner(-1, 1);
    const save = this.kind;
    this.kind = SURF.card;
    for (const P of [A, B, C, A, C, D]) this._push(P[0], P[1], P[2], sh.x, sh.y, sh.z, _c.r * k, _c.g * k, _c.b * k, P[3], P[4]);
    this.kind = save;
    return this;
  }

  /**
   * Leaf cards scattered over an ellipsoid mass (centre, radii), facing out.
   * Makes the outline of a canopy ragged and leafy rather than a smooth ball.
   */
  leafShell(cx, cy, cz, rx, ry, rz, n, size, color, region, colorVar = 0.15) {
    const base = new THREE.Color(color), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      // even-ish spread over the sphere (Fibonacci), jittered
      const t = (i + 0.5) / n, yy = 1 - 2 * t, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996 + this.rand() * 0.6;
      let dx = Math.cos(a) * rr, dy = yy, dz = Math.sin(a) * rr;
      if (dy < -0.55 && this.rand() < 0.6) continue; // fewer underneath
      const d = 0.92 + this.rand() * 0.26;
      const px = cx + dx * rx * d, py = cy + dy * ry * d, pz = cz + dz * rz * d;
      const s = size * (0.75 + this.rand() * 0.5);
      // tilt cards a little off the surface so they catch light and overlap
      const tx = dx + (this.rand() - 0.5) * 0.9, ty = dy + 0.35 + (this.rand() - 0.5) * 0.6, tz = dz + (this.rand() - 0.5) * 0.9;
      const l = 1 + (this.rand() - 0.5) * 2 * colorVar + dy * 0.12;
      c.copy(base).multiplyScalar(l);
      this.card(px, py, pz, s, s, tx, ty, tz, c, region, this.rand() * 6.28, [dx, dy * 0.8 + 0.3, dz]);
    }
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('surf', new THREE.Float32BufferAttribute(this.s, 1));
    return g;
  }

  mesh(material = materials.flat, shadows = true) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    return m;
  }
}

/**
 * Rounded normals for a non-indexed geometry: faces that share a corner
 * average their normals there, unless they meet at more than `crease` radians.
 */
export function smoothNormals(g, crease = Math.PI) {
  const pos = g.attributes.position, count = pos.count;
  const faceN = [];
  for (let i = 0; i < count; i += 3) {
    _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _d.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().copy(_d).sub(_b).cross(_v.copy(_a).sub(_b));
    const area = n.length();
    faceN.push(n.normalize(), area);
  }
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let l = groups.get(key);
    if (!l) groups.set(key, (l = []));
    l.push(i);
  }
  const out = new Float32Array(count * 3), cosC = Math.cos(crease);
  for (const list of groups.values()) {
    for (const i of list) {
      const ni = faceN[Math.floor(i / 3) * 2];
      _n.set(0, 0, 0);
      for (const j of list) {
        const nj = faceN[Math.floor(j / 3) * 2], area = faceN[Math.floor(j / 3) * 2 + 1];
        if (ni.dot(nj) >= cosC) _n.addScaledVector(nj, area);
      }
      _n.normalize();
      out[i * 3] = _n.x; out[i * 3 + 1] = _n.y; out[i * 3 + 2] = _n.z;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
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

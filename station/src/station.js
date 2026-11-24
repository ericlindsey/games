// The station's geometry and its materials. Rebuilt whenever a dimension changes.
//
// Station frame (metres): spin axis +Z through the hub, floor is the cylinder
// r = R, ceiling r = R - deck, side walls the planes z = ±width/2. Every mesh is
// built in this frame and never moves; the camera and the sky move instead.
//
// Kinds (uKind in the shader) and the textures each binds:
//   0 floor shell     A pavers, B grass, C deck plate, D soil
//   1 ceiling shell   A ceiling tiles, B hull
//   2 side walls      A wall panels, B hull
//   3 hub and spokes  A hull
//   4 trunks          A bark          5 foliage   A leaves
//   6 ribs            A hull          7 bench wood A wood
//   8 dark metal      A hull          9 lamp globes

import * as THREE from 'three';
import { stationVertex, stationFragment } from './stationShader.js';
import { rng, SPECIES } from './layout.js';

export { computeLayout } from './layout.js';

const TAU = Math.PI * 2;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Uniforms shared by every station material (one object, values updated in place). */
export function makeUniforms() {
  const u = {};
  for (const k of ['uR', 'uH', 'uHW', 'uCeilN', 'uCeilFill', 'uCeilHalfZ', 'uSideN', 'uSideFill', 'uSideLo', 'uSideHi',
    'uSpokeN', 'uSpokeR', 'uHubR', 'uHubHalfL', 'uRibN', 'uRibD', 'uTreeN', 'uTreeRows', 'uCrownH',
    'uPathHW', 'uBedW', 'uLampN', 'uLampZ', 'uLampH', 'uCabin', 'uBounce']) u[k] = { value: 0 };
  for (const k of ['uSunDir', 'uSunCol', 'uMoonDir', 'uMoonCol']) u[k] = { value: new THREE.Vector3() };
  u.uTreeTex = { value: null };
  return u;
}

export function applyLayout(u, L) {
  const set = {
    uR: L.R, uH: L.H, uHW: L.HW,
    uCeilN: L.ceilN, uCeilFill: L.ceilFill, uCeilHalfZ: L.ceilHalfZ,
    uSideN: L.sideN, uSideFill: L.sideFill, uSideLo: L.sideLo, uSideHi: L.sideHi,
    uSpokeN: L.spokeN, uSpokeR: L.spokeR, uHubR: L.hubR, uHubHalfL: L.hubHalfL,
    uRibN: L.ribN, uRibD: L.ribD,
    uTreeN: L.treeN, uTreeRows: L.treeRows, uCrownH: L.crownH,
    uPathHW: L.pathHW, uBedW: L.bedW, uLampN: L.lampN, uLampZ: L.lampZ, uLampH: L.lampH,
  };
  for (const k in set) u[k].value = set[k];
  // Tree data texture: per tree two texels (see stationShader.js treeA/treeB)
  u.uTreeTex.value?.dispose();
  const w = Math.max(1, L.treeN), h = Math.max(2, L.treeRows * 2);
  const data = new Float32Array(w * h * 4);
  for (const t of L.trees) {
    const a = ((t.row * 2) * w + t.k) * 4, b = ((t.row * 2 + 1) * w + t.k) * 4;
    data.set([t.angle, t.z, t.rx, t.ry], a);
    data.set([t.hc, t.species, t.trunkH, t.trunkR], b);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  u.uTreeTex.value = tex;
}

function material(shared, kind, side, tex, quality, opts = {}) {
  const slot = (k, t) => ({ [`uAlb${k}`]: { value: t?.alb ?? null }, [`uNrm${k}`]: { value: t?.nrm ?? null }, [`uSize${k}`]: { value: t?.size ?? 1 } });
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uKind: { value: kind }, ...slot('A', tex[0]), ...slot('B', tex[1]), ...slot('C', tex[2]), ...slot('D', tex[3]) },
    vertexShader: stationVertex,
    fragmentShader: stationFragment,
    defines: { QUALITY: quality },
    side,
    vertexColors: !!opts.vertexColors,
    // Everything the station draws marks the stencil, so the sky (drawn after)
    // only shades the pixels seen through windows or past the hull.
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
}

/**
 * A surface swept over (u, v) in [0,1]², with triangles wound so their front
 * face looks along `inward(u, v)` (the side the crew sees).
 */
function sweptSurface(nu, nv, pos, inward) {
  const P = new Float32Array((nu + 1) * (nv + 1) * 3);
  const Nn = new Float32Array(P.length);
  let o = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p = pos(i / nu, j / nv), n = inward(i / nu, j / nv);
      P[o] = p[0]; P[o + 1] = p[1]; P[o + 2] = p[2];
      Nn[o] = n[0]; Nn[o + 1] = n[1]; Nn[o + 2] = n[2];
      o += 3;
    }
  }
  const idx = (i, j) => j * (nu + 1) + i;
  const a = new THREE.Vector3().fromArray(P, idx(0, 0) * 3);
  const b = new THREE.Vector3().fromArray(P, idx(1, 0) * 3);
  const c = new THREE.Vector3().fromArray(P, idx(0, 1) * 3);
  const face = b.clone().sub(a).cross(c.clone().sub(a));
  const flip = face.dot(new THREE.Vector3().fromArray(Nn, 0)) < 0;
  const I = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const q = [idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)];
      if (!flip) I.push(q[0], q[1], q[3], q[1], q[2], q[3]);
      else I.push(q[0], q[3], q[1], q[1], q[3], q[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setIndex(I);
  return g;
}

// ---------------------------------------------------- merging many copies ----

/** A non-indexed template: positions, normals and a per-vertex shade (0..1). */
function template(geo, shade) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position.array, nrm = g.attributes.normal.array;
  const sh = new Float32Array(pos.length / 3);
  for (let i = 0; i < sh.length; i++) sh[i] = shade ? shade(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) : 1;
  return { pos, nrm, sh };
}

/** Accumulates transformed copies of templates (with vertex colours) into one geometry. */
class Merger {
  constructor() { this.parts = []; this.count = 0; }
  add(tpl, m, color = [1, 1, 1]) { this.parts.push({ tpl, m, color }); this.count += tpl.pos.length / 3; }
  build() {
    const P = new Float32Array(this.count * 3), Nn = new Float32Array(this.count * 3), C = new Float32Array(this.count * 3);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let o = 0;
    for (const { tpl, m, color } of this.parts) {
      nm.getNormalMatrix(m);
      const { pos, nrm, sh } = tpl;
      for (let i = 0; i < pos.length; i += 3) {
        v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m);
        P[o] = v.x; P[o + 1] = v.y; P[o + 2] = v.z;
        v.set(nrm[i], nrm[i + 1], nrm[i + 2]).applyMatrix3(nm).normalize();
        Nn[o] = v.x; Nn[o + 1] = v.y; Nn[o + 2] = v.z;
        const s = sh[i / 3];
        C[o] = color[0] * s; C[o + 1] = color[1] * s; C[o + 2] = color[2] * s;
        o += 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    return g;
  }
}

/** 3D value noise for shaping foliage (deterministic). */
function noise3(seed) {
  const r = rng(seed), tab = new Float32Array(4096);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const h = (x, y, z) => tab[((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 4095];
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), ux), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), ux), uy),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), ux), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), ux), uy), uz);
  };
}

/** Smooth normals for a displaced non-indexed mesh, averaging faces that share a position. */
function smoothNormals(geo) {
  geo.computeVertexNormals();      // flat, per face
  const pos = geo.attributes.position.array, nrm = geo.attributes.normal.array;
  const acc = new Map();
  const key = (i) => `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
  for (let i = 0; i < pos.length; i += 3) {
    const k = key(i), a = acc.get(k) ?? [0, 0, 0];
    a[0] += nrm[i]; a[1] += nrm[i + 1]; a[2] += nrm[i + 2];
    acc.set(k, a);
  }
  for (let i = 0; i < pos.length; i += 3) {
    const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm[i] = a[0] / l; nrm[i + 1] = a[1] / l; nrm[i + 2] = a[2] / l;
  }
  return geo;
}

/** A lumpy unit "cloud" of foliage (y up), with shade darker in the hollows and underneath. */
function foliageBlob(detail, seed) {
  const n = noise3(seed);
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position.array;
  const lump = new Float32Array(pos.length / 3);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const f = 1 + 0.32 * (n(x * 2.1 + 5, y * 2.1, z * 2.1) - 0.5) + 0.12 * (n(x * 5.3, y * 5.3 + 9, z * 5.3) - 0.5);
    const fy = y < -0.2 ? 0.85 : 1;
    pos[i] = x * f; pos[i + 1] = y * f * fy; pos[i + 2] = z * f;
    lump[i / 3] = f;
  }
  smoothNormals(g);
  let j = 0;
  return template(g, (x, y) => {
    const f = lump[j++];
    return clampN(0.3 + 0.9 * (f - 0.8) + 0.25 * (y * 0.5 + 0.5), 0.25, 1.1);
  });
}

/** A conifer: four jagged cones stacked, unit height 2 (y −1..1), radius 1 at the base. */
function coniferBlob(seed) {
  const n = noise3(seed);
  const parts = [];
  for (let t = 0; t < 4; t++) {
    const rad = 1 - t * 0.22, hgt = 0.9 - t * 0.08;
    const c = new THREE.ConeGeometry(rad, hgt, 16, 3, true).toNonIndexed();
    const p = c.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const y0 = p[i + 1];
      const j = 1 + 0.25 * (n(p[i] * 4 + t * 7, y0 * 4, p[i + 2] * 4) - 0.5);
      p[i] *= j; p[i + 2] *= j;
      p[i + 1] = y0 + (-1 + hgt / 2 + t * 0.42);
    }
    parts.push(c);
  }
  const total = parts.reduce((s, c) => s + c.attributes.position.array.length, 0);
  const P = new Float32Array(total);
  let o = 0;
  for (const c of parts) { P.set(c.attributes.position.array, o); o += c.attributes.position.array.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  smoothNormals(g);
  return template(g, (x, y, z) => clampN(0.45 + 0.6 * Math.hypot(x, z) + 0.15 * y, 0.3, 1.1));
}

/**
 * A crown made of `n` leafy clumps scattered through an ellipsoid (rx across,
 * ry up) centred at radius `rad`, plus a darker core to fill the gaps. Clumps
 * nearer the middle and underneath are shaded darker.
 */
function addClumps(merger, blobs, ang, rad, z, rx, ry, n, col, r) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const T = [-s, c, 0], U = [-c, -s, 0];
  const put = (lx, ly, lz, sx, sy, shade) => {
    const m = placeAt(ang, rad, z, r() * TAU, sx, sy, sx);
    m.elements[12] += T[0] * lx + U[0] * ly;
    m.elements[13] += T[1] * lx + U[1] * ly;
    m.elements[14] += lz;
    merger.add(blobs[Math.floor(r() * blobs.length)], m, col.map((q) => q * shade));
  };
  put(0, 0, 0, rx * 0.72, ry * 0.72, 0.6);
  const tall = Math.sqrt(Math.min(1.6, ry / rx));
  for (let i = 0; i < n; i++) {
    const zz = r() * 2 - 1, th = r() * TAU, q = Math.sqrt(1 - zz * zz);
    let dx = q * Math.cos(th), dy = zz * 0.9 + 0.1, dz = q * Math.sin(th);
    const f = 0.5 + 0.35 * r();
    const size = (0.34 + 0.18 * r()) * rx;
    put(dx * rx * f, dy * ry * f, dz * rx * f, size, size * tall, 0.7 + 0.3 * f + 0.2 * dy);
  }
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Matrix placing a y-up template at angle `ang` on a surface at radius `rad`, axial z, local yaw. */
function placeAt(ang, rad, z, yaw, sx, sy, sz) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(-s, c, 0), new THREE.Vector3(-c, -s, 0), new THREE.Vector3(0, 0, 1));
  const local = new THREE.Matrix4().compose(tmpP.set(0, 0, 0), tmpQ.setFromAxisAngle(Y, yaw), tmpS.set(sx, sy, sz));
  return basis.multiply(local).setPosition(rad * c, rad * s, z);
}

/** Matrix taking a unit cylinder (y 0..1, radius 1) from `a` to `b` with radius `r`. */
function between(a, b, r) {
  const d = b.clone().sub(a);
  const len = d.length();
  tmpQ.setFromUnitVectors(Y, d.normalize());
  return new THREE.Matrix4().compose(a, tmpQ, tmpS.set(r, len, r));
}

/** Build every station mesh for a layout into a fresh Group. */
export function buildStation(L, shared, tex, quality) {
  const group = new THREE.Group();
  const { R, HW, rc, H } = L;
  const mat = (kind, side, t, opts) => material(shared, kind, side, t, quality, opts);

  const nu = clampN(Math.ceil((TAU * R) / 1.5), 160, 6000);
  const ring = (r) => (u) => [r * Math.cos(u * TAU), r * Math.sin(u * TAU)];

  const floorAt = ring(R);
  group.add(new THREE.Mesh(sweptSurface(nu, 1,
    (u, v) => [...floorAt(u), -HW + 2 * HW * v],
    (u) => [-Math.cos(u * TAU), -Math.sin(u * TAU), 0]),
  mat(0, THREE.DoubleSide, [tex.pavers, tex.grass, tex.deck, tex.soil])));

  const ceilAt = ring(rc);
  group.add(new THREE.Mesh(sweptSurface(nu, 1,
    (u, v) => [...ceilAt(u), -HW + 2 * HW * v],
    (u) => [Math.cos(u * TAU), Math.sin(u * TAU), 0]),
  mat(1, THREE.DoubleSide, [tex.ceiling, tex.hull])));

  const wallMat = mat(2, THREE.DoubleSide, [tex.wall, tex.hull]);
  for (const side of [1, -1]) {
    group.add(new THREE.Mesh(sweptSurface(nu, 2,
      (u, v) => { const r = rc + (R - rc) * v; return [r * Math.cos(u * TAU), r * Math.sin(u * TAU), side * HW]; },
      () => [0, 0, -side]), wallMat));
  }

  const hull = mat(3, THREE.FrontSide, [tex.hull]);
  const hub = new THREE.CylinderGeometry(L.hubR, L.hubR, 2 * L.hubHalfL, 96, 1, false);
  hub.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(hub, hull));
  if (L.spokeN > 0) {
    const len = rc - L.hubR + 0.2;
    for (let k = 0; k < L.spokeN; k++) {
      const ang = (k * TAU) / L.spokeN;
      const g = new THREE.CylinderGeometry(L.spokeR, L.spokeR, len, 32, 1, true);
      g.translate(0, L.hubR + len / 2 - 0.1, 0);
      g.rotateZ(ang - Math.PI / 2);
      group.add(new THREE.Mesh(g, hull));
    }
  }

  // Ribs: a beam across under the ceiling and a post down each wall, per frame
  const box = template(new THREE.BoxGeometry(1, 1, 1));
  const ribs = new Merger();
  for (let k = 0; k < L.ribN; k++) {
    const ang = (k * TAU) / L.ribN;
    ribs.add(box, placeAt(ang, rc + L.ribD / 2, 0, 0, L.ribW, L.ribD, 2 * HW));
    for (const side of [1, -1]) ribs.add(box, placeAt(ang, (rc + R) / 2, side * (HW - L.ribD / 2), 0, L.ribW, H, L.ribD));
  }
  group.add(new THREE.Mesh(ribs.build(), mat(6, THREE.FrontSide, [tex.hull])));

  // Lamps (pole, arm, cap, globe) and benches
  if (L.lampN > 0) {
    const cyl = template(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0));
    const ball = template(new THREE.SphereGeometry(1, 16, 10));
    const metal = new Merger(), wood = new Merger(), globes = new Merger();
    const cell = TAU / L.lampN;
    for (let k = 0; k < L.lampN; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const ang = (k + 0.5) * cell;
      const c = Math.cos(ang), s = Math.sin(ang);
      const up = new THREE.Vector3(-c, -s, 0);
      const at = (h, z) => new THREE.Vector3(R * c, R * s, z).addScaledVector(up, h);
      const z = side * L.lampZ;
      metal.add(cyl, between(at(0, z), at(L.lampH + 0.1, z), 0.045));
      metal.add(cyl, between(at(0, z), at(0.25, z), 0.09));                       // base
      metal.add(ball, placeAt(ang, R - L.lampH - 0.16, z, 0, 0.24, 0.1, 0.24));   // cap
      globes.add(ball, placeAt(ang, R - L.lampH, z, 0, 0.17, 0.17, 0.17));
      // bench on the other side of the path, facing it
      const bz = -side * (L.pathHW + 0.4), out = -side;
      const seat = (h, dz, sx, sy, sz) => placeAt(ang, R - h, bz + out * dz, 0, sx, sy, sz);
      for (let i = 0; i < 4; i++) wood.add(box, seat(0.45, -0.15 + i * 0.1, 1.7, 0.035, 0.08));
      for (let i = 0; i < 3; i++) wood.add(box, seat(0.62 + i * 0.11, 0.22, 1.7, 0.08, 0.03));
      for (const e of [-0.75, 0.75]) {
        const m = placeAt(ang, R - 0.22, bz, 0, 0.05, 0.44, 0.42);
        const shift = new THREE.Vector3(-s, c, 0).multiplyScalar(e);
        m.elements[12] += shift.x; m.elements[13] += shift.y;
        metal.add(box, m);
        const back = placeAt(ang, R - 0.62, bz + out * 0.24, 0, 0.05, 0.42, 0.05);
        back.elements[12] += shift.x; back.elements[13] += shift.y;
        metal.add(box, back);
      }
    }
    group.add(new THREE.Mesh(metal.build(), mat(8, THREE.FrontSide, [tex.hull])));
    group.add(new THREE.Mesh(wood.build(), mat(7, THREE.FrontSide, [tex.wood])));
    group.add(new THREE.Mesh(globes.build(), mat(9, THREE.FrontSide, [])));
  }

  // Trees: trunks with a few branches into the crown, crowns by species
  if (L.trees.length) {
    const detail = quality > 1 && L.trees.length <= 160 ? 2 : 1;
    const blobs = Array.from({ length: 6 }, (_, i) => foliageBlob(detail, 100 + i));
    const cones = Array.from({ length: 3 }, (_, i) => coniferBlob(200 + i));
    const cyl = template(new THREE.CylinderGeometry(0.7, 1, 1, 8, 3, true).translate(0, 0.5, 0));
    const leaves = new Merger(), bark = new Merger();
    for (const t of L.trees) {
      const S = SPECIES[t.species];
      const r = rng(Math.floor(t.seed * 1e9));
      const tint = 0.85 + 0.3 * r();
      const leafCol = S.leaf.map((x) => x * tint);
      if (S.cone) {
        leaves.add(cones[Math.floor(r() * cones.length)], placeAt(t.angle, R - t.hc, t.z, r() * TAU, t.rx, t.ry, t.rx), leafCol);
      } else {
        addClumps(leaves, blobs, t.angle, R - t.hc, t.z, t.rx, t.ry, 12, leafCol, r);
      }
      const c = Math.cos(t.angle), s = Math.sin(t.angle);
      const up = new THREE.Vector3(-c, -s, 0), along = new THREE.Vector3(-s, c, 0), ax = new THREE.Vector3(0, 0, 1);
      const foot = new THREE.Vector3(R * c, R * s, t.z);
      const topH = t.hc + (S.cone ? t.ry * 0.6 : 0);
      bark.add(cyl, between(foot, foot.clone().addScaledVector(up, topH), t.trunkR), S.bark);
      if (!S.cone) {
        for (let b = 0; b < 3; b++) {
          const a = b * 2.1 + r();
          const from = foot.clone().addScaledVector(up, t.hc - t.ry * 0.6);
          const dir = along.clone().multiplyScalar(Math.cos(a)).addScaledVector(ax, Math.sin(a)).multiplyScalar(t.rx * 0.65).addScaledVector(up, t.ry * 0.6);
          bark.add(cyl, between(from, from.clone().add(dir), t.trunkR * 0.45), S.bark);
        }
      }
    }
    group.add(new THREE.Mesh(leaves.build(), mat(5, THREE.DoubleSide, [tex.leaves], { vertexColors: true })));
    group.add(new THREE.Mesh(bark.build(), mat(4, THREE.DoubleSide, [tex.bark], { vertexColors: true })));
  }

  // Shrubs: a loose hedge along the lawn's edge by each wall
  if (L.bedW > 0) {
    const shrubs = Array.from({ length: 4 }, (_, i) => foliageBlob(1, 300 + i));
    const leaves = new Merger();
    const step = Math.max(1.8, (TAU * R) / 600);     // ≤ 1200 shrubs
    const n = Math.floor((TAU * R) / step);
    const r = rng(77);
    const palette = [[0.06, 0.15, 0.04], [0.09, 0.17, 0.05], [0.05, 0.12, 0.06], [0.42, 0.12, 0.2], [0.45, 0.42, 0.38], [0.14, 0.2, 0.05]];
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const ang = ((i + r()) * TAU) / n;
        const sx = 0.45 + 0.5 * r(), sy = 0.35 + 0.45 * r();
        const z = side * (L.edgeIn - 0.4 - r() * 0.6);
        const col = palette[Math.floor(r() * palette.length)];
        addClumps(leaves, shrubs, ang, R - sy * 0.8, z, sx, sy, 3, col, r);
      }
    }
    group.add(new THREE.Mesh(leaves.build(), mat(5, THREE.DoubleSide, [tex.leaves], { vertexColors: true })));
  }
  return group;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

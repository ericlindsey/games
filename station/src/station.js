// The station's geometry and its material. Rebuilt whenever a dimension changes.
//
// Station frame (metres): spin axis +Z through the hub, floor is the cylinder
// r = R, ceiling r = R - deck, side walls the planes z = ±width/2. Every mesh is
// built in this frame and never moves; the camera and the sky move instead.

import * as THREE from 'three';
import { stationVertex, stationFragment } from './stationShader.js';

const TAU = Math.PI * 2;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Where the windows, spokes and trees go, from the parameters. Pure. */
export function computeLayout(p) {
  const R = p.diameter / 2;
  const H = Math.min(p.deck, R * 0.8);
  const HW = p.width / 2;
  const rc = R - H;

  // Ceiling: one skylight running all the way round the ring over the middle of
  // the deck, framed every ~6 m, broken only where a spoke meets the ceiling.
  // The slider is the share of ceiling area that is glass, which sets its width.
  const ceilN = Math.max(4, Math.round((TAU * rc) / 6));
  const ceilFill = p.ceilGlass > 0 ? 0.95 : 0;
  const ceilHalfZ = ceilFill ? Math.max(0, Math.min(HW - 0.8, (HW * p.ceilGlass) / 100 / ceilFill)) : 0;
  const zShare = HW > 0 ? ceilHalfZ / HW : 0;

  // Side walls: a band from sill to near the ceiling, cells about 4 m long.
  const sideLo = Math.min(0.9, H * 0.15);
  const sideHi = H - Math.min(0.6, H * 0.1);
  const sideN = Math.max(6, Math.round((TAU * R) / 4));
  const hShare = (sideHi - sideLo) / H;
  const sideFill = hShare > 0 ? clampN(p.sideGlass / 100 / hShare, 0, 0.95) : 0;

  // Hub and spokes
  const hubR = clampN(R * 0.1, 1.5, 80);
  const spokeR = clampN(R * 0.018, 0.8, 14);
  const hasSpokes = rc > hubR + 2;
  const spokeN = hasSpokes ? clampN(Math.round((TAU * R) / 160), 3, 12) : 0;
  const hubHalfL = HW * 1.15 + hubR * 0.4;

  // Trees: two staggered rows either side of the central path, if there's room
  let treeN = 0, treeZ = 0, crownR = 0, crownH = 0, trunkH = 0;
  const pathHW = Math.min(1.5, HW * 0.3);
  if (HW >= 6 && H >= 4.2) {
    crownR = Math.min(1.6, (H - 2.2) / 2.2);
    crownH = Math.min(3.8, H - crownR - 0.8);
    trunkH = crownH - crownR * 0.4;
    treeZ = pathHW + crownR + 0.9;
    treeN = Math.min(1500, Math.max(6, Math.round((TAU * R) / 11)));
  }

  return {
    R, H, HW, rc,
    ceilN, ceilFill, ceilHalfZ,
    sideN, sideFill, sideLo, sideHi,
    hubR, spokeR, spokeN, hubHalfL,
    treeN, treeZ, crownR, crownH, trunkH,
    glassArea: { ceil: ceilFill * zShare, side: sideFill * hShare },
  };
}

/** Uniforms shared by every station material (one object, values updated in place). */
export function makeUniforms() {
  const u = {};
  for (const k of ['uR', 'uH', 'uHW', 'uCeilN', 'uCeilFill', 'uCeilHalfZ', 'uSideN', 'uSideFill', 'uSideLo', 'uSideHi',
    'uSpokeN', 'uSpokeR', 'uHubR', 'uHubHalfL', 'uTreeN', 'uTreeZ', 'uCrownR', 'uCrownH', 'uCabin', 'uBounce']) u[k] = { value: 0 };
  for (const k of ['uSunDir', 'uSunCol', 'uMoonDir', 'uMoonCol']) u[k] = { value: new THREE.Vector3() };
  return u;
}

export function applyLayout(u, L) {
  u.uR.value = L.R; u.uH.value = L.H; u.uHW.value = L.HW;
  u.uCeilN.value = L.ceilN; u.uCeilFill.value = L.ceilFill; u.uCeilHalfZ.value = L.ceilHalfZ;
  u.uSideN.value = L.sideN; u.uSideFill.value = L.sideFill; u.uSideLo.value = L.sideLo; u.uSideHi.value = L.sideHi;
  u.uSpokeN.value = L.spokeN; u.uSpokeR.value = L.spokeR; u.uHubR.value = L.hubR; u.uHubHalfL.value = L.hubHalfL;
  u.uTreeN.value = L.treeN; u.uTreeZ.value = L.treeZ; u.uCrownR.value = L.crownR; u.uCrownH.value = L.crownH;
}

function material(shared, kind, side) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uKind: { value: kind } },
    vertexShader: stationVertex,
    fragmentShader: stationFragment,
    side,
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
  // choose winding from the first quad
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

/** Many copies of a template geometry, each placed by a matrix, as one geometry. */
function mergeCopies(template, matrices) {
  const src = template.index ? template.toNonIndexed() : template;
  const sp = src.attributes.position.array, sn = src.attributes.normal.array;
  const P = new Float32Array(sp.length * matrices.length);
  const Nn = new Float32Array(P.length);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  matrices.forEach((m, k) => {
    nm.getNormalMatrix(m);
    const base = k * sp.length;
    for (let i = 0; i < sp.length; i += 3) {
      v.set(sp[i], sp[i + 1], sp[i + 2]).applyMatrix4(m);
      P[base + i] = v.x; P[base + i + 1] = v.y; P[base + i + 2] = v.z;
      v.set(sn[i], sn[i + 1], sn[i + 2]).applyMatrix3(nm).normalize();
      Nn[base + i] = v.x; Nn[base + i + 1] = v.y; Nn[base + i + 2] = v.z;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  return g;
}

/** Build every station mesh for a layout into a fresh Group. */
export function buildStation(L, shared) {
  const group = new THREE.Group();
  const { R, HW, rc } = L;
  const nu = clampN(Math.ceil((TAU * R) / 1.5), 160, 6000);
  const ring = (r) => (u) => [r * Math.cos(u * TAU), r * Math.sin(u * TAU)];

  const floorAt = ring(R);
  const floor = sweptSurface(nu, 1,
    (u, v) => [...floorAt(u), -HW + 2 * HW * v],
    (u) => [-Math.cos(u * TAU), -Math.sin(u * TAU), 0]);
  group.add(new THREE.Mesh(floor, material(shared, 0, THREE.DoubleSide)));

  const ceilAt = ring(rc);
  const ceil = sweptSurface(nu, 1,
    (u, v) => [...ceilAt(u), -HW + 2 * HW * v],
    (u) => [Math.cos(u * TAU), Math.sin(u * TAU), 0]);
  group.add(new THREE.Mesh(ceil, material(shared, 1, THREE.DoubleSide)));

  for (const side of [1, -1]) {
    const wall = sweptSurface(nu, 2,
      (u, v) => { const r = rc + (R - rc) * v; return [r * Math.cos(u * TAU), r * Math.sin(u * TAU), side * HW]; },
      () => [0, 0, -side]);
    group.add(new THREE.Mesh(wall, material(shared, 2, THREE.DoubleSide)));
  }

  const hull = material(shared, 3, THREE.FrontSide);
  const hub = new THREE.CylinderGeometry(L.hubR, L.hubR, 2 * L.hubHalfL, 64, 1, false);
  hub.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(hub, hull));
  if (L.spokeN > 0) {
    const len = rc - L.hubR + 0.2;
    for (let k = 0; k < L.spokeN; k++) {
      const ang = (k * TAU) / L.spokeN;
      const g = new THREE.CylinderGeometry(L.spokeR, L.spokeR, len, 20, 1, true);
      g.translate(0, L.hubR + len / 2 - 0.1, 0);
      g.rotateZ(ang - Math.PI / 2);
      group.add(new THREE.Mesh(g, hull));
    }
  }

  if (L.treeN > 0) {
    const cell = TAU / L.treeN;
    const crowns = [], trunks = [];
    const t = new THREE.Vector3(), up = new THREE.Vector3(), zz = new THREE.Vector3(0, 0, 1);
    for (let row = 0; row < 2; row++) {
      const off = row === 0 ? 0 : 0.5, zc = row === 0 ? L.treeZ : -L.treeZ;
      for (let k = 0; k < L.treeN; k++) {
        const ang = (k + off) * cell;
        const c = Math.cos(ang), s = Math.sin(ang);
        t.set(-s, c, 0); up.set(-c, -s, 0);
        const base = new THREE.Matrix4().makeBasis(t, up, zz);
        trunks.push(base.clone().setPosition(R * c, R * s, zc));
        crowns.push(base.clone().setPosition((R - L.crownH) * c, (R - L.crownH) * s, zc));
      }
    }
    const crownT = new THREE.IcosahedronGeometry(L.crownR, 2);
    const trunkT = new THREE.CylinderGeometry(0.1, 0.16, L.trunkH, 6, 1, true);
    trunkT.translate(0, L.trunkH / 2, 0);
    group.add(new THREE.Mesh(mergeCopies(crownT, crowns), material(shared, 5, THREE.FrontSide)));
    group.add(new THREE.Mesh(mergeCopies(trunkT, trunks), material(shared, 4, THREE.DoubleSide)));
  }
  return group;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

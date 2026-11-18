// People: rounded, tapering bodies with knees, a proper hood and a cloak that
// swings, built in code and shaded with a fine weave. Still stylised, not real:
// the shapes are simple solids of revolution, smoothly lit.

import * as THREE from 'three';
import { GeoBuilder, SURF } from '../world/build.js';
import { surfaceMaterial } from '../world/surface.js';
import { ITEMS } from '../data/items.js';

/** The material people are drawn with; enemies each take their own (they flash when struck). */
export function figureMaterial() {
  return surfaceMaterial({ kind: SURF.cloth, object: true, side: THREE.DoubleSide, moss: 0 });
}
const SHARED = { material: null };

const V2 = (x, y) => new THREE.Vector2(x, y);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)).clone();

/** A solid of revolution from a profile of [radius, y] pairs, bottom to top. */
function lathe(b, profile, color, m, seg = 12) {
  b.add(new THREE.LatheGeometry(profile.map(([r, y]) => V2(Math.max(r, 0.0005), y)), seg), color, m, true);
}
/** A limb: rounded at both ends, tapering from rTop to rBot over len, hanging down from (x, y, z). */
function taper(b, rTop, rBot, len, x, y, z, color, sx = 1, sz = 1, seg = 10) {
  const prof = [[0, -len], [rBot * 0.7, -len + rBot * 0.3], [rBot, -len + rBot], [(rBot + rTop) / 2, -len / 2], [rTop, -rTop], [rTop * 0.7, -rTop * 0.3], [0, 0]];
  lathe(b, prof, color, M(x, y, z, 0, 0, 0, sx, 1, sz), seg);
}
function ball(b, rx, ry, rz, x, y, z, color, ws = 12, hs = 9) {
  b.add(new THREE.SphereGeometry(1, ws, hs), color, M(x, y, z, 0, 0, 0, rx, ry, rz), true);
}

function part(build, pivotY, parent, x = 0, z = 0) {
  const b = new GeoBuilder(11, 0.03);
  b.kind = SURF.cloth;
  build(b);
  const mesh = b.mesh(SHARED.material);
  const pivot = new THREE.Group();
  pivot.position.set(x, pivotY, z);
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

/**
 * @param {object} o colours and options:
 *   tunic, legs, skin, hair, cloak (or null), hood (bool), skirt (bool), bow (bool), longHair (bool);
 *   for gear: mail (a hauberk over the tunic), greaves, helm with helmCrest / helmNasal / helmWings,
 *   blade with bladeShape ('straight' | 'curved' | 'broad' | 'long' | 'knife') and hilt,
 *   heldBow with bowTips and bowLong
 * @returns {THREE.Group} with .limbs for animation; origin at the feet, facing +Z.
 */
export function makeFigure(o) {
  SHARED.material ||= figureMaterial();
  const g = new THREE.Group();
  const limbs = {};
  const boots = o.boots ?? 0x4a3828;
  const SKIN = SURF.skin, CLOTH = SURF.cloth, METAL = SURF.metal, LEATHER = SURF.wood;

  // Legs pivot at the hip, shins at the knee; arms at the shoulder. Geometry hangs below the pivot.
  for (const side of [-1, 1]) {
    const leg = part((b) => {
      taper(b, 0.088, 0.066, 0.47, 0, 0.02, 0, o.legs, 1, 0.95);
      if (o.mail && !o.skirt) { b.kind = METAL; taper(b, 0.096, 0.08, 0.2, 0, 0.02, 0, o.mail); b.kind = CLOTH; }
    }, 0.92, g, side * 0.105);
    const shin = part((b) => {
      taper(b, 0.064, 0.05, 0.36, 0, 0.0, 0, o.legs);
      b.kind = LEATHER;
      taper(b, 0.064, 0.058, 0.3, 0, -0.17, 0, boots);                // boot shaft
      ball(b, 0.058, 0.05, 0.125, 0, -0.43, 0.045, boots, 10, 6);    // foot
      b.kind = METAL;
      if (o.greaves) {
        taper(b, 0.074, 0.064, 0.3, 0, -0.05, 0.004, o.greaves, 1, 1.05);
        ball(b, 0.07, 0.06, 0.065, 0, 0.0, 0.03, o.greaves, 10, 6);   // knee cop
      }
      b.kind = CLOTH;
    }, -0.46, leg);
    limbs[side < 0 ? 'legL' : 'legR'] = leg;
    limbs[side < 0 ? 'shinL' : 'shinR'] = shin;
    limbs[side < 0 ? 'armL' : 'armR'] = part((b) => {
      if (o.mail) { b.kind = METAL; taper(b, 0.074, 0.062, 0.3, 0, 0.03, 0, o.mail); ball(b, 0.082, 0.07, 0.08, -side * 0.012, -0.02, 0, o.mail); b.kind = CLOTH; }
      else { taper(b, 0.07, 0.058, 0.32, 0, 0.03, 0, o.tunic); ball(b, 0.078, 0.068, 0.076, -side * 0.012, -0.02, 0, o.tunic); } // upper arm, rounded at the shoulder
      taper(b, 0.058, 0.044, 0.33, 0, -0.27, 0.01, o.sleeve ?? o.tunic); // forearm
      b.kind = SKIN;
      ball(b, 0.045, 0.06, 0.035, 0, -0.67, 0.012, o.skin, 8, 6);    // hand
      b.kind = CLOTH;
    }, 1.5, g, side * 0.29);
  }

  limbs.body = part((b) => {
    const T = (r) => r; // a profile helper, for readability
    // torso: hips, a waist, a chest, and sloping shoulders
    const torso = [[0, -0.07], [0.185, -0.05], [0.19, 0.04], [0.172, 0.17], [0.192, 0.31], [0.212, 0.43], [0.215, 0.51], [0.185, 0.58], [0.1, 0.635], [0, 0.65]];
    lathe(b, torso, o.tunic, M(0, 0, 0, 0, 0, 0, 1.02, 1, 0.66), 14);
    if (o.mail) { b.kind = METAL; lathe(b, torso.map(([r, y]) => [r * 1.045 + 0.004, y]), o.mail, M(0, 0, 0, 0, 0, 0, 1.02, 1, 0.68), 14); b.kind = CLOTH; }
    // the hem of the tunic (or a gown, or the hauberk's skirt)
    if (o.skirt) {
      lathe(b, [[0.42, -0.9], [0.36, -0.6], [0.26, -0.25], [0.19, 0.06], [0.17, 0.14]], o.tunic, M(0, 0, 0, 0, 0, 0, 1, 1, 0.8), 16);
    } else {
      lathe(b, [[0.25, -0.3], [0.225, -0.2], [0.2, -0.05], [0.18, 0.06]], o.tunic, M(0, 0, 0, 0, 0, 0, 1.08, 1, 0.68), 14);
      if (o.mail) { b.kind = METAL; lathe(b, [[0.255, -0.34], [0.232, -0.2], [0.205, -0.05], [0.19, 0.06]], o.mail, M(0, 0, 0, 0, 0, 0, 1.08, 1, 0.7), 14); b.kind = CLOTH; }
    }
    b.kind = LEATHER; // the belt and its buckle
    b.add(new THREE.TorusGeometry(0.19, 0.022, 5, 16), o.belt ?? 0x3d2f22, M(0, 0.05, 0, Math.PI / 2, 0, 0, 1.1, 0.7, 1), true);
    b.box(0.05, 0.045, 0.02, 0, 0.03, 0.125, o.belt === undefined ? 0x8a7a5a : o.belt);
    b.kind = SKIN;
    taper(b, 0.052, 0.058, 0.13, 0, 0.74, -0.005, o.skin, 1, 1, 8);   // neck
    const hy = 0.84; // centre of the head
    if (o.orc) {
      // a heavy, low-browed head thrust forward: jaw, tusks, long ears, and pale eyes
      ball(b, 0.115, 0.115, 0.12, 0, hy - 0.01, 0.03, o.skin);
      ball(b, 0.1, 0.075, 0.1, 0, hy - 0.08, 0.075, o.skin);               // jaw
      ball(b, 0.11, 0.035, 0.06, 0, hy + 0.035, 0.1, o.hair ?? o.skin, 10, 6); // brow
      for (const sx of [-1, 1]) {
        b.add(new THREE.ConeGeometry(0.014, 0.07, 5), 0xe8e2cc, M(sx * 0.045, hy - 0.05, 0.16, 0, 0, sx * 0.25), true); // tusks
        b.dot(0.018, sx * 0.042, hy + 0.012, 0.142, 0xffe04a);                                                        // eyes
        b.add(new THREE.ConeGeometry(0.035, 0.16, 6), o.skin, M(sx * 0.12, hy + 0.02, -0.0, 0, 0, -sx * 1.2, 1, 1, 0.45), true); // ears
      }
      b.add(new THREE.ConeGeometry(0.026, 0.05, 5), o.skin, M(0, hy - 0.01, 0.15, Math.PI / 2.4, 0, 0), true); // snout
      b.kind = CLOTH;
      ball(b, 0.27, 0.11, 0.17, 0, 0.52, -0.06, o.tunic);                   // hunched shoulders
    } else {
      ball(b, 0.102, 0.122, 0.112, 0, hy, 0, o.skin);                       // skull
      ball(b, 0.082, 0.07, 0.085, 0, hy - 0.06, 0.02, o.skin);              // jaw and cheeks
      b.add(new THREE.ConeGeometry(0.018, 0.05, 6), o.skin, M(0, hy - 0.005, 0.115, Math.PI / 2.3, 0, 0), true); // nose
      for (const sx of [-1, 1]) {
        ball(b, 0.016, 0.03, 0.012, sx * 0.1, hy - 0.005, -0.005, o.skin, 6, 4); // ears
        b.dot(0.012, sx * 0.038, hy + 0.012, 0.103, 0x2a2420);                   // eyes
      }
      b.kind = CLOTH;
      // hair: a cap over the crown and the back of the head
      b.add(new THREE.SphereGeometry(0.118, 14, 8, 0, Math.PI * 2, 0, 1.45), o.hair, M(0, hy + 0.005, -0.012, -0.35, 0, 0, 1.02, 1.08, 1.04), true);
      if (o.longHair) lathe(b, [[0.07, -0.42], [0.1, -0.2], [0.115, 0.0], [0.1, 0.06]], o.hair, M(0, hy - 0.03, -0.05, 0, 0, 0, 1, 1, 0.55), 10);
      if (o.beard) ball(b, 0.07, 0.06, 0.05, 0, hy - 0.09, 0.05, o.hair);
    }
    if (o.circlet) { b.kind = METAL; b.add(new THREE.TorusGeometry(0.112, 0.01, 4, 18), o.circlet, M(0, hy + 0.045, 0, Math.PI / 2 - 0.12, 0, 0), true); b.kind = CLOTH; }
    if (o.helm) { // a cap, with or without a ridge, horns, wings
      b.kind = METAL;
      const hz = o.orc ? 0.03 : 0;
      b.add(new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, 1.6), o.helm, M(0, hy + 0.02, hz, 0, 0, 0, 1.04, 1.05, 1.06), true);
      b.add(new THREE.TorusGeometry(0.128, 0.014, 4, 18), o.helm, M(0, hy + 0.0, hz, Math.PI / 2, 0, 0, 1.05, 1.07, 1), true); // the rim
      if (o.orc || o.helmCrest) b.box(0.03, 0.12, 0.24, 0, hy + 0.08, hz - 0.01, o.helmCrest ?? o.helm);
      if (o.helmNasal) b.box(0.025, 0.12, 0.02, 0, hy - 0.04, hz + 0.13, o.helm);
      if (o.horns) for (const sx of [-1, 1]) b.add(new THREE.ConeGeometry(0.03, 0.24, 7), 0xd8d2c0, M(sx * 0.15, hy + 0.13, hz, 0, 0, -sx * 0.6), true);
      if (o.helmWings) for (const sx of [-1, 1]) b.box(0.02, 0.22, 0.13, sx * 0.13, hy + 0.04, hz - 0.03, o.helmWings, -0.25, 0, -sx * 0.35);
      b.kind = CLOTH;
    }
    if (o.badge) b.add(new THREE.CircleGeometry(0.065, 12), o.badge, M(0, 0.33, 0.145), true); // the Red Eye, daubed on the breast
    if (o.quiver) {
      b.kind = LEATHER;
      b.add(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 8), o.quiver, M(0.12, 0.33, -0.17, 0, 0, 0.3), true);
      for (let i = 0; i < 4; i++) b.box(0.012, 0.09, 0.03, 0.2 + (i % 2) * 0.03, 0.64 + (i >> 1) * 0.02, -0.17 + (i - 1.5) * 0.02, 0xd8d2c0, 0, 0, 0.3);
      b.kind = CLOTH;
    }
    if (o.hood) {
      // a deep hood, open at the face, coming to a soft point behind
      const open = 0.95;
      b.add(new THREE.SphereGeometry(0.15, 16, 10, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, 2.2), o.cloak, M(0, hy + 0.01, -0.01, 0, 0, 0, 1, 1.08, 1.06), true);
      b.add(new THREE.ConeGeometry(0.09, 0.2, 8), o.cloak, M(0, hy + 0.06, -0.15, -2.1, 0, 0), true);
      // and the cowl over the shoulders
      lathe(b, [[0.29, 0.46], [0.24, 0.55], [0.15, 0.66], [0.11, 0.72]], o.cloak, M(0, 0, -0.01, 0, 0, 0, 1.06, 1, 0.8), 14);
    } else if (o.cloak) {
      lathe(b, [[0.27, 0.5], [0.22, 0.58], [0.12, 0.66], [0.08, 0.68]], o.cloak, M(0, 0, -0.01, 0, 0, 0, 1.08, 1, 0.76), 14); // a mantle
    }
    if (o.bow) { // a bow slung across the back
      b.kind = LEATHER;
      { // its middle on the back, the limbs running diagonally from shoulder to hip
        const R = 0.95, arc = 0.95, dir = 2.36;
        b.add(new THREE.TorusGeometry(R, 0.014, 4, 14, arc), o.heldBow ?? 0x6b4a2a, M(-0.05 - R * Math.cos(dir), 0.3 - R * Math.sin(dir), -0.19, 0, 0, dir - arc / 2), true);
      }
      b.add(new THREE.CylinderGeometry(0.055, 0.045, 0.5, 8), 0x5a4030, M(-0.13, 0.33, -0.17, 0, 0, -0.3), true); // quiver
      for (let i = 0; i < 4; i++) b.box(0.012, 0.09, 0.03, -0.2 - (i % 2) * 0.03, 0.62 + (i >> 1) * 0.02, -0.17 + (i - 1.5) * 0.02, 0xd8d2c0, 0, 0, -0.3);
      b.kind = CLOTH;
    }
    void T;
  }, 0.92, g);

  if (o.cloak) { // the cloak hangs from the shoulders and swings as they move
    limbs.cloak = part((b) => {
      const len = o.hood ? 1.12 : 1.02;
      const geo = new THREE.CylinderGeometry(0.21, 0.4, len, 14, 5, true, Math.PI - 1.35, 2.7);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { // folds, and a ragged hem
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), t = 0.5 - y / len, a = Math.atan2(x, z);
        const f = 1 + 0.06 * Math.sin(a * 9) * t;
        pos.setXYZ(i, x * f, y - (t > 0.98 ? 0.03 * Math.sin(a * 13) : 0), z * f);
      }
      geo.computeVertexNormals();
      b.add(geo, o.cloak, M(0, -len / 2, 0.02, 0, 0, 0, 1.05, 1, 0.78), true);
    }, 0.92 + 0.6, g, 0, -0.03);
  }
  // Weapons are separate meshes so they can be shown and hidden.
  if (o.blade) {
    const b = new GeoBuilder(3, 0.03);
    b.kind = SURF.metal;
    const shape = o.bladeShape ?? 'straight', hilt = o.hilt ?? 0x3a3028;
    if (shape === 'curved') { // a curved blade: segments that sweep up toward the point
      for (let k = 0; k < 5; k++) b.box(0.05 - k * 0.004, 0.022, 0.2, 0, -0.75 + 0.012 * k * k, 0.17 + 0.18 * k, o.blade, 0, -0.06 * k);
    } else if (shape === 'broad') {
      b.box(0.08, 0.025, 0.62, 0, -0.75, 0.38, o.blade);
      b.box(0.1, 0.025, 0.28, 0, -0.75, 0.82, o.blade);        // widening toward the point
    } else {
      const len = shape === 'long' ? 1.15 : shape === 'knife' ? 0.55 : 0.9;
      b.box(0.05, 0.02, len, 0, -0.75, 0.07 + len / 2, o.blade);
    }
    b.box(shape === 'knife' ? 0.14 : 0.2, 0.04, 0.05, 0, -0.76, 0.08, hilt);
    b.box(0.05, 0.05, shape === 'long' ? 0.24 : 0.16, 0, -0.77, shape === 'long' ? -0.06 : -0.02, 0x4a3828);
    b.box(0.07, 0.07, 0.06, 0, -0.78, shape === 'long' ? -0.2 : -0.12, hilt);  // pommel
    g.sword = b.mesh(SHARED.material);
    limbs.armR.add(g.sword);
  }
  if (o.heldBow) {
    const b = new GeoBuilder(4, 0.03);
    b.kind = SURF.wood;
    const limb = o.bowLong ? 0.76 : 0.62;
    b.box(0.035, limb, 0.035, 0, -0.72 - (limb - 0.62) * 0.15, 0.1, o.heldBow, 0, 0.32);
    b.box(0.035, limb, 0.035, 0, -1.3 - (limb - 0.62) * 0.85, 0.1, o.heldBow, 0, -0.32);
    if (o.bowTips) {
      b.box(0.045, 0.14, 0.045, 0, -0.72 + limb * 0.86, 0.1 - limb * 0.3, o.bowTips, 0, 0.32);
      b.box(0.045, 0.14, 0.045, 0, -1.3 - (limb - 0.62) * 0.85 - 0.02, 0.1 - limb * 0.3, o.bowTips, 0, -0.32);
      b.box(0.05, 0.12, 0.05, 0, -1.0, 0.11, o.bowTips);      // and the grip
    }
    b.box(0.008, 1.1 + (limb - 0.62) * 1.7, 0.008, 0, -1.27 - (limb - 0.62) * 0.85, -0.07, 0xd8d2c0);
    g.heldBow = b.mesh(SHARED.material);
    g.heldBow.position.y = 0.55;
    limbs.armL.add(g.heldBow);
  }

  g.limbs = limbs;
  g.userData.phase = 0;
  g.userData.bodyY = 0.92;
  g.userData.hunch = 0;
  if (o.orc) {
    // Long arms, short bowed legs, and a stoop.
    const drop = 0.92 * 0.16;
    for (const leg of [limbs.legL, limbs.legR]) { leg.scale.y = 0.84; leg.position.y -= drop; leg.rotation.z = leg.position.x > 0 ? 0.1 : -0.1; }
    for (const arm of [limbs.armL, limbs.armR]) { arm.scale.y = 1.24; arm.position.y -= drop; arm.position.z += 0.1; }
    g.userData.bodyY = 0.92 - drop;
    g.userData.hunch = 0.3;
  }
  return g;
}

/** Swing the limbs. `speed` in m/s; 0 stands still with a slight sway. */
/**
 * @param pose optional overrides, in radians: { armR, armL } set an arm's swing
 *   directly (negative is forward and up), for attacks and drawing a bow.
 */
export function animateFigure(fig, speed, dt, time, pose) {
  const l = fig.limbs;
  const moving = speed > 0.2;
  fig.userData.phase += dt * (moving ? 4.5 + speed * 0.9 : 0);
  const amp = moving ? Math.min(0.95, 0.35 + speed * 0.08) : 0;
  const s = Math.sin(fig.userData.phase) * amp;
  const ease = Math.min(1, dt * 12);
  l.legL.rotation.x += (s - l.legL.rotation.x) * ease;
  l.legR.rotation.x += (-s - l.legR.rotation.x) * ease;
  l.armL.rotation.x += (-s * 0.8 - l.armL.rotation.x) * ease;
  l.armR.rotation.x += (s * 0.8 - l.armR.rotation.x) * ease;
  // knees bend as each leg swings through, a little even standing
  const c = Math.cos(fig.userData.phase);
  const kneeL = moving ? 0.08 + amp * 1.1 * Math.max(0, -c) : 0.04, kneeR = moving ? 0.08 + amp * 1.1 * Math.max(0, c) : 0.04;
  l.shinL.rotation.x += (kneeL - l.shinL.rotation.x) * ease;
  l.shinR.rotation.x += (kneeR - l.shinR.rotation.x) * ease;
  if (l.cloak) {
    const want = -(moving ? Math.min(0.55, 0.08 + speed * 0.06) : 0.02) - (moving ? Math.abs(s) * 0.06 : Math.sin(time * 1.3) * 0.015);
    l.cloak.rotation.x += (want - l.cloak.rotation.x) * Math.min(1, dt * 5);
  }
  const bob = moving ? Math.abs(Math.cos(fig.userData.phase)) * 0.05 : Math.sin(time * 1.6) * 0.006;
  l.body.position.y = fig.userData.bodyY + bob;
  l.body.rotation.x = fig.userData.hunch + (moving ? Math.min(0.14, speed * 0.016) : 0);
  if (l.cloak) { l.cloak.position.y = l.body.position.y + 0.6; l.cloak.position.z = -0.03 + Math.sin(l.body.rotation.x) * 0.6; }
  if (pose) {
    if (pose.armR !== undefined) l.armR.rotation.x = pose.armR;
    if (pose.armL !== undefined) l.armL.rotation.x = pose.armL;
  }
}

/** The ranger as their gear makes them look. */
export function rangerLook(equipped) {
  const o = { ...LOOKS.ranger };
  const sword = ITEMS[equipped.sword]?.look, bow = ITEMS[equipped.bow]?.look;
  const body = ITEMS[equipped.body]?.look, helm = ITEMS[equipped.helm]?.look, legs = ITEMS[equipped.legs]?.look;
  if (sword) Object.assign(o, { blade: sword.blade, hilt: sword.hilt, bladeShape: sword.shape });
  if (bow) Object.assign(o, { heldBow: bow.wood, bowTips: bow.tips, bowLong: bow.long });
  if (body) {
    o.tunic = body.tunic; o.sleeve = body.sleeve;
    if (body.mail) o.mail = body.mail;
    if (body.badge) o.badge = body.badge;
  }
  if (helm) Object.assign(o, { hood: false, helm: helm.color, helmCrest: helm.crest, helmNasal: helm.nasal, helmWings: helm.wings });
  if (legs) o.greaves = legs.color;
  return o;
}

export const LOOKS = {
  ranger: { tunic: 0x4d6238, legs: 0x4b4032, skin: 0xd9ad86, hair: 0x3a2a1c, cloak: 0x3f5a34, hood: true, bow: true, sleeve: 0x5a4a36, blade: 0xd0d4dc, heldBow: 0x6b4a2a },
  mablung: { tunic: 0x5a5236, legs: 0x3f382c, skin: 0xcfa27c, hair: 0x6b6b68, cloak: 0x4a5a38, hood: false, belt: 0x8a6a3a, sleeve: 0x4d4632 },
  faramir: { tunic: 0x3f5c3a, legs: 0x3a3a34, skin: 0xdcb08a, hair: 0x241c18, cloak: 0x2e4030, belt: 0xb9b9c4, sleeve: 0x6a5a40, circlet: 0xd8d8e2 },
  eowyn: { tunic: 0xeeeadb, legs: 0xeeeadb, skin: 0xedc5a2, hair: 0xe6c263, cloak: null, skirt: true, longHair: true, belt: 0xc9a84a, boots: 0x8a7a5a },
  // the enemy
  snaga: { orc: true, tunic: 0x5a4a3c, legs: 0x3e362e, skin: 0x8a9a62, hair: 0x2a2a1e, cloak: null, boots: 0x26221f, blade: 0x5a5a5e },
  // archers wear a pale bone-coloured cowl, to be picked out at a distance
  archer: { orc: true, tunic: 0xcfc2a0, legs: 0x4a4236, skin: 0x9aa670, hair: 0x2a2a1e, cloak: 0xd8ccaa, hood: true, boots: 0x26221f, heldBow: 0x2a2420, quiver: 0x6a4a2a, sleeve: 0xcfc2a0 },
  uruk: { orc: true, tunic: 0x2e2e36, legs: 0x26262c, skin: 0x5a6248, hair: 0x101010, cloak: null, belt: 0x7a2a22, sleeve: 0x3a3a44, boots: 0x1c1c20, blade: 0x7a7a82, helm: 0x3a3a42, badge: 0xb3261e },
  haradrim: { tunic: 0x8a2a22, legs: 0x3a2a22, skin: 0x8a5a3a, hair: 0x1a1210, cloak: 0x2a2220, hood: true, belt: 0xc9a84a, sleeve: 0x8a2a22, circlet: 0xc9a84a, blade: 0xd8c890 },
  chief: { orc: true, tunic: 0x34343e, legs: 0x26262c, skin: 0x626a50, hair: 0x101010, cloak: 0x8a1f1a, belt: 0xc9a84a, sleeve: 0x3c3c46, boots: 0x16161a, blade: 0xa2a2aa, helm: 0x4a4a52, horns: true, badge: 0xb3261e },
};

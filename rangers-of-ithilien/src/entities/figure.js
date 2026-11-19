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
const meshOf = (b) => b.mesh(SHARED.material);

// ---- Heads ----------------------------------------------------------------

/**
 * A head from one deformed sphere: a narrower chin, cheekbones, a brow, a nose,
 * (for orcs a heavy jaw thrust forward), so there is no seam where parts meet.
 * Returns the shape function, to place eyes and the like on its surface.
 */
function headShape(orc) {
  const rx = orc ? 0.112 : 0.098, ry = orc ? 0.112 : 0.122, rz = orc ? 0.118 : 0.108;
  // the point of the head's surface in direction (dx, dy, dz) (unit), relative to its centre
  return (dx, dy, dz) => {
    let x = dx * rx, y = dy * ry, z = dz * rz;
    const low = Math.max(0, -dy);
    if (orc) { x *= 1 + 0.25 * low; z *= 1 + 0.25 * low * Math.max(0, dz); y *= 1 - 0.1 * low; }
    else { x *= 1 - 0.32 * Math.pow(low, 1.4); z *= 1 - 0.1 * low * (1 - Math.max(0, dz)); }
    const front = Math.max(0, dz);
    // the brow: a ridge across the front just above the eyes
    z += Math.exp(-Math.pow((dy - 0.28) / 0.1, 2)) * front * (orc ? 0.028 : 0.008) * Math.exp(-dx * dx * 4);
    // the nose
    z += Math.exp(-(dx * dx) / 0.012 - Math.pow((dy + 0.05) / 0.2, 2)) * front * (orc ? 0.05 : 0.03);
    // cheekbones, and the hollow of the eyes
    z += Math.exp(-Math.pow((Math.abs(dx) - 0.45) / 0.18, 2) - Math.pow((dy + 0.08) / 0.15, 2)) * front * 0.006;
    z -= Math.exp(-Math.pow((Math.abs(dx) - 0.33) / 0.13, 2) - Math.pow((dy - 0.13) / 0.1, 2)) * front * 0.009;
    return [x, y, z];
  };
}
function addHead(b, o, hy) {
  const shape = headShape(o.orc);
  const g = new THREE.SphereGeometry(1, 24, 18);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = shape(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const k = b.kind;
  b.kind = SURF.skin;
  b.add(g, o.skin, M(0, hy, o.orc ? 0.03 : 0), true);
  const at = (dx, dy, out = 0) => { const n = Math.hypot(dx, dy); const dz = Math.sqrt(Math.max(0, 1 - n * n)); const [x, y, z] = shape(dx, dy, dz); return [x, y + hy, z + out + (o.orc ? 0.03 : 0)]; };
  // eyes: a white with a dark iris, under a brow
  for (const sx of [-1, 1]) {
    const [ex, ey, ez] = at(sx * 0.36, 0.13, -0.006);
    b.add(new THREE.SphereGeometry(1, 10, 8), o.orc ? 0xd8c860 : 0xf2eee4, M(ex, ey, ez, 0, 0, 0, 0.019, 0.013, 0.012), true);
    b.add(new THREE.SphereGeometry(1, 8, 6), o.orc ? 0x2a1a08 : (o.eyes ?? 0x3a4a5a), M(ex, ey, ez + 0.009, 0, 0, 0, 0.0095, 0.0095, 0.006), true);
    const [bx, by, bz] = at(sx * 0.36, 0.27, 0.004);
    b.kind = SURF.cloth;
    b.box(0.036, 0.009, 0.012, bx, by, bz, o.hair ?? 0x2a2018, 0, 0, sx * -0.12);
    b.kind = SURF.skin;
    // ears
    if (o.orc) b.add(new THREE.ConeGeometry(0.035, 0.17, 6), o.skin, M(sx * 0.13, hy + 0.03, 0.01, 0, 0, -sx * 1.15, 1, 1, 0.45), true);
    else b.add(new THREE.SphereGeometry(1, 8, 6), o.skin, M(sx * 0.098, hy + 0.0, -0.008, 0, 0, 0, 0.014, 0.03, 0.02), true);
  }
  // lips: a soft line, a little darker than the skin
  const [mx, my, mz] = at(0, -0.43, -0.004);
  const lip = new THREE.Color(o.skin).multiply(new THREE.Color(o.orc ? 0x806060 : 0xd8a8a0));
  b.add(new THREE.SphereGeometry(1, 10, 6), lip, M(mx, my, mz, 0, 0, 0, o.orc ? 0.045 : 0.028, 0.008, 0.01), true);
  if (o.orc) for (const sx of [-1, 1]) { const [tx, ty, tz] = at(sx * 0.3, -0.5, 0); b.add(new THREE.ConeGeometry(0.012, 0.06, 5), 0xe8e2cc, M(tx, ty + 0.03, tz, 0, 0, sx * 0.2), true); }
  b.kind = k;
  return at;
}

// ---- Weapons ------------------------------------------------------------

const BLADE_LEN = { straight: 0.86, long: 1.08, knife: 0.5, broad: 0.72, curved: 0.82 };
/** A sword along +Y from its guard at the origin; the grip runs down -Y. Returns { full, hilt }. */
function swordGeometries(o) {
  const shape = o.bladeShape ?? 'straight', len = BLADE_LEN[shape] ?? 0.86, hilt = o.hilt ?? 0x3a3028;
  const pts = [];
  if (shape === 'curved') { // a scimitar: one smooth curve, widening toward the point, then a clipped tip
    const N = 18, w0 = 0.036;
    const c = (t) => [0.17 * t * t, len * t];
    const w = (t) => w0 * (1 + 0.45 * Math.sin(t * Math.PI * 0.85)) * (t > 0.9 ? (1 - t) / 0.1 : 1);
    for (let i = 0; i <= N; i++) { const t = i / N, [x, y] = c(t); pts.push([x + w(t), y - 0.04 * t]); }
    for (let i = N; i >= 0; i--) { const t = i / N, [x, y] = c(t); pts.push([x - w(t) * 0.7, y]); }
  } else if (shape === 'broad') { // a cleaver: broad, square-ended, with a clipped corner
    pts.push([-0.04, 0], [0.04, 0], [0.055, len * 0.8], [0.06, len], [-0.02, len], [-0.055, len * 0.85]);
  } else {
    const w = shape === 'knife' ? 0.03 : shape === 'long' ? 0.034 : 0.036;
    pts.push([-w, 0], [w, 0], [w * 0.92, len * 0.82], [0, len], [-w * 0.92, len * 0.82]);
  }
  const blade = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4 });
  blade.translate(0, 0, -0.004);
  const make = (withBlade) => {
    const b = new GeoBuilder(3, 0.02);
    b.kind = SURF.metal;
    if (withBlade) {
      b.add(blade, o.blade, null, false);
      if (shape !== 'curved' && shape !== 'broad') b.box(0.01, len * 0.7, 0.016, 0, 0.02, 0, new THREE.Color(o.blade).multiplyScalar(0.8)); // the fuller
    }
    const gw = shape === 'knife' ? 0.13 : 0.22;
    b.box(gw, 0.03, 0.045, 0, -0.015, 0, hilt);                                                   // the cross-guard
    for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.02, 8, 6), hilt, M(sx * gw / 2, 0, 0), true);
    b.kind = SURF.wood;
    const gl = shape === 'long' ? 0.26 : shape === 'knife' ? 0.11 : 0.16;
    b.add(new THREE.LatheGeometry([...Array(9)].map((_, i) => new THREE.Vector2(0.019 + 0.003 * (i % 2), -0.03 - (gl * i) / 8)), 8), 0x3a2a1e, null, true); // the grip, bound
    b.kind = SURF.metal;
    b.add(new THREE.SphereGeometry(0.03, 10, 8), hilt, M(0, -0.04 - gl, 0, 0, 0, 0, 1, 0.8, 1), true); // pommel
    return b.geometry();
  };
  return { full: make(true), hilt: make(false), len };
}

/** A bow in the left hand: grip at the hand, limbs up and down, the string on the archer's side. */
const BOW_HAND = -0.34; // the hand, in the forearm's frame
function bowParts(o) {
  const L = o.bowLong ? 0.8 : 0.66, c = 0.17, wood = o.heldBow ?? 0x6b4a2a;
  const b = new GeoBuilder(4, 0.02);
  b.kind = SURF.wood;
  const tips = [];
  for (const s of [-1, 1]) {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, BOW_HAND, 0), new THREE.Vector3(0, BOW_HAND - 0.07, s * L * 0.45),
      new THREE.Vector3(0, BOW_HAND - 0.02 + c * 0.4, s * L * 0.85), new THREE.Vector3(0, BOW_HAND + c, s * L));
    b.add(new THREE.TubeGeometry(curve, 12, 0.016, 6), wood, null, true);
    if (o.bowTips) { // horn tips that curve away
      const tip = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, BOW_HAND + c, s * L), new THREE.Vector3(0, BOW_HAND + c + 0.02, s * (L + 0.06)), new THREE.Vector3(0, BOW_HAND + c - 0.04, s * (L + 0.1)));
      b.add(new THREE.TubeGeometry(tip, 4, 0.013, 5), o.bowTips, null, true);
    }
    tips.push(new THREE.Vector3(0, BOW_HAND + c, s * (o.bowTips ? L + 0.04 : L)));
  }
  b.add(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 8), o.bowTips ?? 0x4a3020, M(0, BOW_HAND, 0, Math.PI / 2, 0, 0), true); // the grip
  const group = new THREE.Group();
  group.add(meshOf(b));
  // the string, in two halves meeting at the nock, and the arrow on it
  const strMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c0 });
  const halves = tips.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4), strMat); group.add(m); return m; });
  const arrow = new THREE.Mesh(arrowGeometry(), SHARED.material);
  group.add(arrow);
  const rest = new THREE.Vector3(0, BOW_HAND + c, 0.055), nock = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  group.userData.arrow = arrow;
  group.userData.setDraw = (draw, nocked) => {
    nock.copy(rest).y += draw * 0.52;
    tips.forEach((t, i) => {
      const h = halves[i];
      mid.copy(t).add(nock).multiplyScalar(0.5);
      dir.copy(nock).sub(t);
      h.position.copy(mid);
      h.scale.set(1, dir.length(), 1);
      h.quaternion.setFromUnitVectors(UPV, dir.normalize());
    });
    arrow.visible = nocked;
    arrow.position.copy(nock); // the arrow points from the nock past the grip, toward the mark (-y here)
  };
  group.userData.setDraw(0, false);
  return { group, tips, c, L };
}
/** One arrow from its nock at the origin, pointing down -Y: shaft, head, and three vanes. */
let ARROW_GEO = null;
function arrowGeometry() {
  if (ARROW_GEO) return ARROW_GEO;
  const b = new GeoBuilder(5, 0);
  b.kind = SURF.wood;
  b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.72, 5), 0x8a6a42, M(0, -0.36, 0), true);
  b.kind = SURF.metal;
  b.add(new THREE.ConeGeometry(0.013, 0.06, 6), 0x9a9aa2, M(0, -0.75, 0, Math.PI, 0, 0), true);
  b.kind = SURF.cloth;
  for (let i = 0; i < 3; i++) b.box(0.002, 0.11, 0.022, Math.cos(i * 2.09) * 0.011, -0.13, Math.sin(i * 2.09) * 0.011, i ? 0xe8e2d0 : 0xa83a2a, i * 2.09);
  ARROW_GEO = b.geometry();
  return ARROW_GEO;
}

// The quiver on the back, and the arrows showing at its mouth (all of them, up to ten).
const QUIVER = { x: 0.12, y: 0.05, z: -0.2, rz: 0.32, len: 0.56 };
const quiverArrows = [];
function quiverGeometry(n) {
  if (quiverArrows[n]) return quiverArrows[n];
  const b = new GeoBuilder(6, 0);
  const ax = -Math.sin(QUIVER.rz), ay = Math.cos(QUIVER.rz);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 0.018 + (i % 3) * 0.008;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r * 0.8, rise = 0.1 + (i % 4) * 0.015;
    const x = QUIVER.x + ax * (QUIVER.len + rise) + ox, y = QUIVER.y + ay * (QUIVER.len + rise), z = QUIVER.z + oz;
    b.kind = SURF.wood;
    b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), 0x8a6a42, M(x - ax * 0.15, y - ay * 0.15, z, 0, 0, QUIVER.rz), true);
    b.kind = SURF.cloth;
    for (let k = 0; k < 3; k++) b.box(0.002, 0.1, 0.022, x + Math.cos(k * 2.09 + a) * 0.01 - ax * 0.06, y - ay * 0.06, z + Math.sin(k * 2.09 + a) * 0.01, k ? 0xe8e2d0 : 0xa83a2a, k * 2.09 + a, 0, QUIVER.rz);
  }
  quiverArrows[n] = b.geometry();
  return quiverArrows[n];
}

/**
 * @param {object} o colours and options:
 *   tunic, legs, skin, hair, cloak (or null), hood (bool), skirt (bool), bow (bool), longHair (bool);
 *   for gear: mail (a hauberk over the tunic), greaves, helm with helmCrest / helmNasal / helmWings,
 *   blade with bladeShape ('straight' | 'curved' | 'broad' | 'long' | 'knife') and hilt,
 *   heldBow with bowTips and bowLong; quiver (colour) to carry arrows on the back
 * @returns {THREE.Group} with .limbs for animation and setWeapons / setDraw / setArrows;
 *   origin at the feet, facing +Z.
 */
export function makeFigure(o) {
  SHARED.material ||= figureMaterial();
  const g = new THREE.Group();
  g.name = 'people';
  const limbs = {};
  const boots = o.boots ?? 0x4a3828;
  const SKIN = SURF.skin, CLOTH = SURF.cloth, METAL = SURF.metal, LEATHER = SURF.wood;

  // Legs pivot at the hip, shins at the knee; arms at the shoulder, forearms at the elbow.
  for (const side of [-1, 1]) {
    const leg = part((b) => {
      taper(b, 0.092, 0.074, 0.48, 0, 0.02, 0, o.legs, 1, 0.95);
      if (o.mail && !o.skirt) { b.kind = METAL; taper(b, 0.1, 0.086, 0.2, 0, 0.02, 0, o.mail); b.kind = CLOTH; }
    }, 0.92, g, side * 0.105);
    const shin = part((b) => {
      ball(b, 0.066, 0.068, 0.068, 0, -0.01, 0.004, o.legs, 10, 8);  // the knee
      taper(b, 0.07, 0.054, 0.36, 0, 0.0, 0, o.legs);
      b.kind = LEATHER;
      taper(b, 0.068, 0.062, 0.3, 0, -0.17, 0, boots);                // boot shaft
      ball(b, 0.06, 0.052, 0.128, 0, -0.43, 0.045, boots, 10, 6);    // foot
      b.kind = METAL;
      if (o.greaves) {
        taper(b, 0.078, 0.068, 0.3, 0, -0.05, 0.004, o.greaves, 1, 1.05);
        ball(b, 0.074, 0.065, 0.068, 0, 0.0, 0.03, o.greaves, 10, 6);   // knee cop
      }
      b.kind = CLOTH;
    }, -0.46, leg);
    limbs[side < 0 ? 'legL' : 'legR'] = leg;
    limbs[side < 0 ? 'shinL' : 'shinR'] = shin;
    const sleeveTop = o.mail ?? o.tunic;
    const arm = part((b) => {
      if (o.mail) b.kind = METAL;
      ball(b, 0.084, 0.074, 0.082, -side * 0.012, -0.02, 0, sleeveTop);   // the shoulder
      taper(b, 0.074, 0.064, 0.31, 0, 0.03, 0, sleeveTop);               // upper arm
      b.kind = CLOTH;
    }, 1.5, g, side * 0.29);
    const fore = part((b) => {
      ball(b, 0.062, 0.062, 0.062, 0, 0, 0, o.sleeve ?? o.tunic, 10, 8);  // the elbow
      taper(b, 0.06, 0.047, 0.31, 0, 0.01, 0.004, o.sleeve ?? o.tunic);   // forearm
      if (o.trim) { b.kind = METAL; b.add(new THREE.TorusGeometry(0.05, 0.011, 5, 14), o.trim, M(0, -0.25, 0.004, Math.PI / 2, 0, 0), true); } // a silver-edged cuff
      b.kind = SKIN;
      ball(b, 0.042, 0.05, 0.032, 0, BOW_HAND, 0.008, o.skin, 10, 8);    // the hand, closed
      ball(b, 0.013, 0.026, 0.013, side * -0.032, BOW_HAND + 0.012, 0.03, o.skin, 6, 5); // thumb
      b.kind = CLOTH;
    }, -0.29, arm);
    limbs[side < 0 ? 'armL' : 'armR'] = arm;
    limbs[side < 0 ? 'elbowL' : 'elbowR'] = fore;
  }

  limbs.body = part((b) => {
    // torso: hips, a waist, a chest, and sloping shoulders
    const torso = [[0, -0.07], [0.185, -0.05], [0.19, 0.04], [0.172, 0.17], [0.192, 0.31], [0.212, 0.43], [0.215, 0.51], [0.185, 0.58], [0.1, 0.635], [0, 0.65]];
    lathe(b, torso, o.tunic, M(0, 0, 0, 0, 0, 0, 1.02, 1, 0.66), 14);
    if (o.mail) { b.kind = METAL; lathe(b, torso.map(([r, y]) => [r * 1.045 + 0.004, y]), o.mail, M(0, 0, 0, 0, 0, 0, 1.02, 1, 0.68), 14); b.kind = CLOTH; }
    if (o.skirt) {
      lathe(b, [[0.42, -0.9], [0.36, -0.6], [0.26, -0.25], [0.19, 0.06], [0.17, 0.14]], o.tunic, M(0, 0, 0, 0, 0, 0, 1, 1, 0.8), 16);
    } else if (o.surcoat) { // a long coat, split at the sides, falling to the knee
      lathe(b, [[0.3, -0.5], [0.27, -0.32], [0.235, -0.15], [0.205, 0.0], [0.19, 0.08]], o.tunic, M(0, 0, 0, 0, 0, 0, 1.06, 1, 0.74), 16);
      if (o.trim) { b.kind = METAL; b.add(new THREE.TorusGeometry(0.3, 0.012, 5, 24), o.trim, M(0, -0.495, 0, Math.PI / 2, 0, 0, 1.06, 0.74, 1), true); b.kind = CLOTH; }
    } else {
      lathe(b, [[0.25, -0.3], [0.225, -0.2], [0.2, -0.05], [0.18, 0.06]], o.tunic, M(0, 0, 0, 0, 0, 0, 1.08, 1, 0.68), 14);
      if (o.mail) { b.kind = METAL; lathe(b, [[0.255, -0.34], [0.232, -0.2], [0.205, -0.05], [0.19, 0.06]], o.mail, M(0, 0, 0, 0, 0, 0, 1.08, 1, 0.7), 14); b.kind = CLOTH; }
    }
    b.kind = LEATHER; // the belt and its buckle
    b.add(new THREE.TorusGeometry(0.19, 0.022, 5, 16), o.belt ?? 0x3d2f22, M(0, 0.05, 0, Math.PI / 2, 0, 0, 1.1, 0.7, 1), true);
    b.kind = METAL;
    b.box(0.05, 0.045, 0.02, 0, 0.03, 0.125, o.belt === undefined ? 0x8a7a5a : o.belt);
    b.kind = SKIN;
    taper(b, 0.054, 0.06, 0.13, 0, 0.74, -0.005, o.skin, 1, 1, 8);   // neck
    const hy = 0.84; // centre of the head
    addHead(b, o, hy);
    b.kind = CLOTH;
    if (o.orc) ball(b, 0.27, 0.11, 0.17, 0, 0.52, -0.06, o.tunic);    // hunched shoulders
    else {
      // hair: a cap over the crown and the back of the head
      b.add(new THREE.SphereGeometry(0.114, 18, 10, 0, Math.PI * 2, 0, 1.45), o.hair, M(0, hy + 0.012, -0.012, -0.42, 0, 0, 1.0, 1.08, 1.05), true);
      if (o.longHair) lathe(b, [[0.07, -0.42], [0.1, -0.2], [0.115, 0.0], [0.1, 0.06]], o.hair, M(0, hy - 0.03, -0.05, 0, 0, 0, 1, 1, 0.55), 10);
      else if (o.collarHair) lathe(b, [[0.1, -0.17], [0.115, -0.08], [0.118, 0.0], [0.1, 0.06]], o.hair, M(0, hy - 0.03, -0.035, 0, 0, 0, 1, 1, 0.62), 12); // to the collar
      if (o.beard) ball(b, 0.07, 0.06, 0.05, 0, hy - 0.09, 0.05, o.hair);
    }
    if (o.circlet) {
      b.kind = METAL;
      b.add(new THREE.TorusGeometry(0.11, 0.009, 5, 24), o.circlet, M(0, hy + 0.05, 0.002, Math.PI / 2 - 0.12, 0, 0), true);
      if (o.gem) { // a white stone set at the brow, in a pointed silver mount
        b.add(new THREE.ConeGeometry(0.026, 0.06, 4), o.circlet, M(0, hy + 0.085, 0.112, -0.12, Math.PI / 4, 0, 1, 1, 0.35), false);
        b.add(new THREE.OctahedronGeometry(1, 0), o.gem, M(0, hy + 0.072, 0.118, 0, 0, Math.PI / 4, 0.015, 0.015, 0.009), false);
      }
      b.kind = CLOTH;
    }
    if (o.trim) { b.kind = METAL; b.add(new THREE.TorusGeometry(0.075, 0.012, 5, 16), o.trim, M(0, 0.655, 0.0, Math.PI / 2, 0, 0, 1.25, 0.9, 1), true); b.kind = CLOTH; } // the collar's edge
    if (o.device === 'tree') { // on the breast: a white tree on a dark field, edged in silver
      const T = 0.11, at = (y) => 0.149 + (y - 0.36) * T; // the chest leans out a little going up
      b.add(new THREE.CircleGeometry(1, 18), 0x16181c, M(0, 0.36, at(0.36), T, 0, 0, 0.066, 0.086, 1), true);
      if (o.trim) b.add(new THREE.RingGeometry(0.9, 1.1, 18), o.trim, M(0, 0.36, at(0.36) + 0.001, T, 0, 0, 0.066, 0.086, 1), true);
      const W = 0xf2f0e6;
      b.box(0.009, 0.11, 0.004, 0, 0.295, at(0.35) + 0.002, W, 0, T);
      for (const [dy, dx, len, rz] of [[0.355, 0.02, 0.05, 0.8], [0.355, -0.02, 0.05, -0.8], [0.38, 0.015, 0.04, 0.6], [0.38, -0.015, 0.04, -0.6], [0.395, 0, 0.026, 0]]) {
        b.box(0.007, len, 0.004, dx, dy - len / 2, at(dy) + 0.002, W, 0, T, -rz);
      }
    }
    if (o.helm) helm(b, o, hy);
    if (o.badge) b.add(new THREE.CircleGeometry(0.065, 12), o.badge, M(0, 0.33, 0.145), true); // a device on the breast
    if (o.hood) {
      // a deep hood, open at the face, coming to a soft point behind
      const open = 0.95;
      b.add(new THREE.SphereGeometry(0.15, 18, 10, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, 2.2), o.cloak, M(0, hy + 0.01, -0.01, 0, 0, 0, 1, 1.08, 1.06), true);
      b.add(new THREE.ConeGeometry(0.09, 0.2, 8), o.cloak, M(0, hy + 0.06, -0.15, -2.1, 0, 0), true);
      lathe(b, [[0.25, 0.47], [0.225, 0.55], [0.15, 0.65], [0.11, 0.72]], o.cloak, M(0, 0, -0.01, 0, 0, 0, 1.0, 1, 0.78), 14); // the cowl
    } else if (o.cloak) {
      lathe(b, [[0.27, 0.5], [0.22, 0.58], [0.12, 0.66], [0.08, 0.68]], o.cloak, M(0, 0, -0.01, 0, 0, 0, 1.08, 1, 0.76), 14); // a mantle
    }
  }, 0.92, g);

  const cloakLen = o.longCloak ? 1.34 : o.hood ? 1.12 : 1.02;
  if (o.cloak) { // the cloak hangs from the shoulders and swings as they move
    limbs.cloak = part((b) => {
      const len = cloakLen;
      const geo = new THREE.CylinderGeometry(0.21, 0.4, len, 14, 8, true, Math.PI - 1.35, 2.7);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { // folds, and a ragged hem
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), t = 0.5 - y / len, a = Math.atan2(x, z);
        const f = 1 + 0.06 * Math.sin(a * 9) * t;
        pos.setXYZ(i, x * f, y - (t > 0.98 ? 0.03 * Math.sin(a * 13) : 0), z * f);
      }
      geo.computeVertexNormals();
      b.add(geo, o.cloak, M(0, -len / 2, 0.02, 0, 0, 0, 1.05, 1, 0.78), true);
      if (o.clasp) { // a jewelled brooch pinning the cloak at the breast
        b.kind = METAL;
        b.add(new THREE.SphereGeometry(1, 12, 8), o.clasp, M(0.12, -0.06, 0.172, 0, 0, 0, 0.038, 0.038, 0.016), true);
        b.add(new THREE.SphereGeometry(1, 8, 6), o.gem ?? 0x3a5a8a, M(0.12, -0.06, 0.186, 0, 0, 0, 0.016, 0.016, 0.008), true);
        b.kind = CLOTH;
      }
    }, 0.92 + 0.6, g, 0, -0.03);
    const mesh = limbs.cloak.children[0], geo = mesh.geometry;
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 0.6; // it bends out behind when running (bendCloak)
    limbs.cloak.userData = {
      mesh, len: cloakLen, stream: 0, bent: 0,
      rest: Float32Array.from(geo.attributes.position.array), restN: Float32Array.from(geo.attributes.normal.array),
    };
  }

  // What is carried on the back, over the cloak: the quiver and the slung bow.
  // They ride in a frame that follows the cloak's upper part (which stays close
  // to the back; only below the hips does it stream out), laid back along it,
  // so the cloak is always under them.
  const gear = new THREE.Group(), lay = new THREE.Group();
  if (o.cloak) {
    lay.position.set(0, 0.6, 0);         // the shoulders, where the cloak hangs from
    lay.rotation.x = 0.132;              // along the slope of the cloak down the back
    gear.position.set(0, -0.6, -0.045);  // and just outside it
    lay.add(gear);
    const frame = new THREE.Group();     // in the cloak's frame, the body's origin
    frame.position.set(0, -0.6, 0.03);
    frame.add(lay);
    limbs.cloak.add(frame);
  } else limbs.body.add(gear);
  const quiver = o.quiver ?? (o.bow ? 0x5a4030 : null);
  if (quiver) {
    const qb = new GeoBuilder(12, 0.02);
    qb.kind = LEATHER;
    qb.add(new THREE.CylinderGeometry(0.058, 0.046, QUIVER.len, 10), quiver, M(QUIVER.x - Math.sin(QUIVER.rz) * QUIVER.len / 2, QUIVER.y + Math.cos(QUIVER.rz) * QUIVER.len / 2, QUIVER.z, 0, 0, QUIVER.rz), true);
    qb.add(new THREE.TorusGeometry(0.058, 0.008, 4, 12), 0x3a2a1e, M(QUIVER.x - Math.sin(QUIVER.rz) * QUIVER.len, QUIVER.y + Math.cos(QUIVER.rz) * QUIVER.len, QUIVER.z, Math.PI / 2, 0, -QUIVER.rz), true);
    gear.add(meshOf(qb));
  }
  if (o.quiver ?? o.bow) { // the arrows in it, as many as there are (up to ten)
    g.quiverArrows = new THREE.Mesh(quiverGeometry(10), SHARED.material);
    gear.add(g.quiverArrows);
  }

  // Weapons: in the hand when fighting, sheathed or slung otherwise.
  if (o.blade) {
    const sw = swordGeometries(o);
    // held: the grip in the right hand, the blade forward
    g.sword = new THREE.Mesh(sw.full, SHARED.material);
    g.sword.rotation.x = Math.PI / 2;
    g.sword.position.set(0, BOW_HAND, 0.02 + 0.09);
    limbs.elbowR.add(g.sword);
    // sheathed: a scabbard at the left hip, the hilt up and forward
    const sb = new GeoBuilder(7, 0.02);
    sb.kind = LEATHER;
    const a = 0.32, sl = sw.len + 0.04;
    sb.add(new THREE.CylinderGeometry(1, 0.8, sl, 10), 0x3a2a1e, M(0, -sl / 2, 0, 0, 0, 0, 0.045, 1, 0.022), true);
    sb.kind = METAL;
    sb.add(new THREE.CylinderGeometry(1, 1, 0.05, 10), o.hilt ?? 0x8a7a5a, M(0, -sl + 0.03, 0, 0, 0, 0, 0.04, 1, 0.02), true); // the chape
    const sheath = new THREE.Group();
    sheath.add(meshOf(sb));
    const hiltMesh = new THREE.Mesh(sw.hilt, SHARED.material);
    hiltMesh.rotation.z = Math.PI; // grip up
    sheath.add(hiltMesh);
    sheath.position.set(-0.21, 0.06, 0.04);
    sheath.rotation.set(a, 0, 0.12);
    limbs.body.add(sheath);
    g.sheath = sheath;
  }
  if (o.heldBow) {
    const bow = bowParts(o);
    g.heldBow = bow.group;
    limbs.elbowL.add(g.heldBow);
    // slung across the back, from the left shoulder to the right hip
    const sb = new GeoBuilder(8, 0.02);
    sb.kind = LEATHER;
    const L = bow.L, c = bow.c;
    for (const s of [-1, 1]) {
      const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.07, s * L * 0.45, 0), new THREE.Vector3(0.02 - c * 0.4, s * L * 0.85, 0), new THREE.Vector3(-c, s * L, 0));
      sb.add(new THREE.TubeGeometry(curve, 10, 0.016, 5), o.heldBow, null, true);
    }
    sb.add(new THREE.CylinderGeometry(0.004, 0.004, 2 * L, 4), 0xd8d2c0, M(-c, 0, 0), true);
    const slung = meshOf(sb);
    slung.position.set(-0.02, 0.24, -0.26);
    slung.rotation.set(0, Math.PI, 0.38);
    gear.add(slung);
    g.slungBow = slung;
  }

  if (o.stature) g.scale.setScalar(o.stature);
  g.limbs = limbs;
  g.userData.phase = 0;
  g.userData.bodyY = 0.92;
  g.userData.hunch = 0;
  if (o.orc) {
    // Long arms, short bowed legs, and a stoop.
    const drop = 0.92 * 0.16;
    for (const leg of [limbs.legL, limbs.legR]) { leg.scale.y = 0.84; leg.position.y -= drop; leg.rotation.z = leg.position.x > 0 ? 0.1 : -0.1; }
    for (const arm of [limbs.armL, limbs.armR]) { arm.scale.y = 1.2; arm.position.y -= drop; arm.position.z += 0.1; }
    g.userData.bodyY = 0.92 - drop;
    g.userData.hunch = 0.3;
  }

  /** Which weapons are in hand (the rest are sheathed or slung). */
  g.setWeapons = (sword, bow) => {
    if (g.sword) { g.sword.visible = !!sword; g.sheath.visible = !sword; }
    if (g.heldBow) { g.heldBow.visible = !!bow; g.slungBow.visible = !bow; }
  };
  /** How far the bow is drawn (0..1), and whether an arrow is on the string. */
  g.setDraw = (draw, nocked) => g.heldBow?.userData.setDraw(draw, nocked);
  let shown = 10;
  /** Arrows showing in the quiver: all of them up to ten. */
  g.setArrows = (n) => {
    if (!g.quiverArrows) return;
    n = Math.max(0, Math.min(10, Math.floor(n)));
    if (n !== shown) { shown = n; g.quiverArrows.geometry = quiverGeometry(n); }
  };
  g.setWeapons(false, false);
  return g;
}

/** A helmet: straight sides down over the ears and the back of the neck, open at the face, and a crown. */
function helm(b, o, hy) {
  const k = b.kind;
  b.kind = SURF.metal;
  const hz = o.orc ? 0.03 : 0, R = o.orc ? 0.138 : 0.124, peak = o.helmNasal ? 0.2 : o.orc ? 0.15 : 0.165;
  // the crown: a full shell from the brow up, conical for a nasal helm, rounder otherwise
  const crown = [[R + 0.004, 0.0], [R, 0.04], [R * 0.93, 0.085], [R * 0.75, 0.13], [R * 0.42, peak - 0.015], [0.0001, peak]];
  b.add(new THREE.LatheGeometry(crown.map(([r, y]) => new THREE.Vector2(r, y)), 18), o.helm, M(0, hy + 0.035, hz), true);
  // the sides and back: flat-faced plates down to the jaw, leaving the face open
  const sides = [[R + 0.012, -0.12], [R + 0.006, -0.06], [R + 0.004, 0.0], [R + 0.004, 0.04]];
  b.add(new THREE.LatheGeometry(sides.map(([r, y]) => new THREE.Vector2(r, y)), 8, 0.85, Math.PI * 2 - 1.7), o.helm, M(0, hy + 0.035, hz), false);
  // a band round the brow, rivets, and the nasal
  b.add(new THREE.TorusGeometry(R + 0.006, 0.01, 4, 20), new THREE.Color(o.helm).multiplyScalar(0.8), M(0, hy + 0.04, hz, Math.PI / 2, 0, 0), true);
  if (o.helmNasal || o.orc) b.box(0.024, 0.11, 0.014, 0, hy - 0.025, hz + R + 0.004, o.helm);
  if (o.orc || o.helmCrest) { // a crest from brow to nape
    b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.022, 14, 1, false, 0, Math.PI), o.helmCrest ?? o.helm, M(0, hy + peak - 0.07, hz, 0, 0, Math.PI / 2, 1, 1, 1.3), false);
  }
  if (o.horns) for (const sx of [-1, 1]) b.add(new THREE.ConeGeometry(0.032, 0.26, 7), 0xd8d2c0, M(sx * 0.17, hy + 0.13, hz, 0.2, 0, -sx * 0.75), true);
  if (o.helmWings) for (const sx of [-1, 1]) {
    for (let f = 0; f < 3; f++) b.box(0.012, 0.2 - f * 0.04, 0.05, sx * (R + 0.02), hy + 0.1 + f * 0.015, hz - 0.05 - f * 0.045, o.helmWings, -0.2 - f * 0.25, 0, -sx * (0.45 + f * 0.12));
  }
  b.kind = k;
}

/** Swing the limbs. `speed` in m/s; 0 stands still with a slight sway. */
/**
 * @param pose optional overrides, in radians: { armR, armL } set an arm's swing
 *   directly (negative is forward and up), { elbowR, elbowL } its bend (negative
 *   bends the forearm forward), for attacks and drawing a bow.
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
  // elbows: a little bent at rest, more as the arm swings forward, most when running
  const run = moving ? Math.min(1, speed / 7) : 0;
  const elbowL = -0.15 - run * 0.55 - Math.max(0, s) * 0.45, elbowR = -0.15 - run * 0.55 - Math.max(0, -s) * 0.45;
  l.elbowL.rotation.x += (elbowL - l.elbowL.rotation.x) * ease;
  l.elbowR.rotation.x += (elbowR - l.elbowR.rotation.x) * ease;
  const bob = moving ? Math.abs(Math.cos(fig.userData.phase)) * 0.05 : Math.sin(time * 1.6) * 0.006;
  l.body.position.y = fig.userData.bodyY + bob;
  l.body.rotation.x = fig.userData.hunch + (moving ? Math.min(0.14, speed * 0.016) : 0);
  if (l.cloak) {
    // The cloak streams out behind (a positive turn carries its hem backward):
    // a little from the shoulders, and the rest from the hips down, so what is
    // slung on the back stays over it.
    const cu = l.cloak.userData;
    const want = moving ? Math.min(0.42, 0.06 + speed * 0.05) + Math.abs(s) * 0.05 : 0.02 + Math.sin(time * 1.3) * 0.015;
    cu.stream += (want - cu.stream) * Math.min(1, dt * 5);
    l.cloak.rotation.x = l.body.rotation.x + cu.stream * 0.25;
    l.cloak.position.y = l.body.position.y + 0.6 * Math.cos(l.body.rotation.x);
    l.cloak.position.z = -0.03 + Math.sin(l.body.rotation.x) * 0.6;
    bendCloak(cu, cu.stream * 1.35);
  }
  if (pose) {
    if (pose.armR !== undefined) { l.armR.rotation.x = pose.armR; l.elbowR.rotation.x = pose.elbowR ?? -0.1; }
    if (pose.armL !== undefined) { l.armL.rotation.x = pose.armL; l.elbowL.rotation.x = pose.elbowL ?? 0; }
  }
}

/**
 * Bend the cloak below the hips by `phi` (radians at the hem): the cloth from
 * the shoulders to CLOAK_HIP hangs as it is; below that it curls back evenly,
 * each row turned by its share of the bend, so it curves rather than kinks.
 */
const CLOAK_HIP = 0.6, CLOAK_AXIS_Z = 0.02;
function bendCloak(cu, phi) {
  if (Math.abs(phi - cu.bent) < 0.002) return;
  cu.bent = phi;
  const geo = cu.mesh.geometry, P = geo.attributes.position, N = geo.attributes.normal;
  const p = P.array, n = N.array, r = cu.rest, rn = cu.restN;
  const k = phi / (cu.len - CLOAK_HIP);
  for (let i = 0; i < p.length; i += 3) {
    const y = r[i + 1], d = -y - CLOAK_HIP;
    if (d <= 0 || Math.abs(k) < 1e-5) { p[i] = r[i]; p[i + 1] = y; p[i + 2] = r[i + 2]; n[i] = rn[i]; n[i + 1] = rn[i + 1]; n[i + 2] = rn[i + 2]; continue; }
    const a = k * d, ca = Math.cos(a), sa = Math.sin(a), dz = r[i + 2] - CLOAK_AXIS_Z;
    // the line down the middle of the cloak, curled, then this point's offset from it turned with it
    const cy = -CLOAK_HIP - sa / k, cz = CLOAK_AXIS_Z - (1 - ca) / k;
    p[i] = r[i]; p[i + 1] = cy - dz * sa; p[i + 2] = cz + dz * ca;
    const ny = rn[i + 1], nz = rn[i + 2];
    n[i] = rn[i]; n[i + 1] = ny * ca - nz * sa; n[i + 2] = ny * sa + nz * ca;
  }
  P.needsUpdate = true; N.needsUpdate = true;
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
  // the Prince of Ithilien: a long green coat edged with silver, the white tree on his breast,
  // a circlet with a white stone, a long cloak pinned at the throat, a sword with a silver hilt
  faramir: { tunic: 0x2b4a31, legs: 0x2c2c30, skin: 0xdcb08a, hair: 0x241c18, collarHair: true, cloak: 0x1f3326, longCloak: true, clasp: 0xd8d8e2,
    belt: 0x2a221c, sleeve: 0x2b4a31, circlet: 0xaeb2be, gem: 0xf4f8ff, trim: 0xb4b6c0, surcoat: true, device: 'tree', boots: 0x2a2018,
    blade: 0xd8dce4, hilt: 0x9a9ca8, stature: 1.04 },
  eowyn: { tunic: 0xeeeadb, legs: 0xeeeadb, skin: 0xedc5a2, hair: 0xe6c263, cloak: null, skirt: true, longHair: true, belt: 0xc9a84a, boots: 0x8a7a5a },
  // the enemy
  snaga: { orc: true, tunic: 0x5a4a3c, legs: 0x3e362e, skin: 0x8a9a62, hair: 0x2a2a1e, cloak: null, boots: 0x26221f, blade: 0x5a5a5e },
  // archers wear a pale bone-coloured cowl, to be picked out at a distance
  archer: { orc: true, tunic: 0xcfc2a0, legs: 0x4a4236, skin: 0x9aa670, hair: 0x2a2a1e, cloak: 0xd8ccaa, hood: true, boots: 0x26221f, heldBow: 0x2a2420, quiver: 0x6a4a2a, sleeve: 0xcfc2a0 },
  uruk: { orc: true, tunic: 0x2e2e36, legs: 0x26262c, skin: 0x5a6248, hair: 0x101010, cloak: null, belt: 0x7a2a22, sleeve: 0x3a3a44, boots: 0x1c1c20, blade: 0x7a7a82, helm: 0x3a3a42, badge: 0xb3261e },
  haradrim: { tunic: 0x8a2a22, legs: 0x3a2a22, skin: 0x8a5a3a, hair: 0x1a1210, cloak: 0x2a2220, hood: true, belt: 0xc9a84a, sleeve: 0x8a2a22, circlet: 0xc9a84a, blade: 0xd8c890 },
  chief: { orc: true, tunic: 0x34343e, legs: 0x26262c, skin: 0x626a50, hair: 0x101010, cloak: 0x8a1f1a, belt: 0xc9a84a, sleeve: 0x3c3c46, boots: 0x16161a, blade: 0xa2a2aa, helm: 0x4a4a52, horns: true, badge: 0xb3261e },
};

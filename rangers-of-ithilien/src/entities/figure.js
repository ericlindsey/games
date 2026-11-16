// Simple low-poly people built from boxes, with a procedural walk.

import * as THREE from 'three';
import { GeoBuilder } from '../world/build.js';

function part(build, pivotY, parent, x = 0, z = 0) {
  const b = new GeoBuilder(11, 0.04);
  build(b);
  const mesh = b.mesh();
  const pivot = new THREE.Group();
  pivot.position.set(x, pivotY, z);
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

/**
 * @param {object} o colours and options:
 *   tunic, legs, skin, hair, cloak (or null), hood (bool), skirt (bool), bow (bool), longHair (bool)
 * @returns {THREE.Group} with .limbs for animation; origin at the feet, facing +Z.
 */
export function makeFigure(o) {
  const g = new THREE.Group();
  const limbs = {};

  // Legs pivot at the hip; arms at the shoulder. Geometry hangs below the pivot.
  for (const side of [-1, 1]) {
    limbs[side < 0 ? 'legL' : 'legR'] = part((b) => {
      b.box(0.17, 0.5, 0.19, 0, -0.5, 0, o.legs);
      b.box(0.16, 0.42, 0.18, 0, -0.9, 0, o.boots ?? 0x4a3828);
      b.box(0.17, 0.08, 0.27, 0, -0.92, 0.04, o.boots ?? 0x4a3828);
    }, 0.92, g, side * 0.11);
    limbs[side < 0 ? 'armL' : 'armR'] = part((b) => {
      b.box(0.13, 0.34, 0.15, 0, -0.34, 0, o.tunic);
      b.box(0.11, 0.28, 0.12, 0, -0.62, 0, o.sleeve ?? o.tunic);
      b.box(0.1, 0.1, 0.1, 0, -0.72, 0, o.skin);
    }, 1.5, g, side * 0.33);
  }

  limbs.body = part((b) => {
    b.box(0.5, 0.62, 0.27, 0, 0, 0, o.tunic);                 // torso
    b.box(0.52, 0.07, 0.29, 0, 0.02, 0, o.belt ?? 0x3d2f22);  // belt
    if (o.skirt) {
      b.cyl(0.27, 0.46, 0.92, 0, -0.9, 0, o.tunic, 8);
    } else {
      b.box(0.5, 0.22, 0.27, 0, -0.2, 0, o.tunic);            // tunic hem
    }
    b.box(0.13, 0.1, 0.13, 0, 0.62, 0, o.skin);               // neck
    b.box(0.24, 0.26, 0.25, 0, 0.7, 0, o.skin);               // head
    b.box(0.26, 0.1, 0.27, 0, 0.9, -0.01, o.hair);            // hair, top
    b.box(0.26, 0.24, 0.07, 0, 0.72, -0.12, o.hair);          // hair, back
    if (o.longHair) b.box(0.28, 0.5, 0.07, 0, 0.3, -0.16, o.hair);
    if (o.circlet) b.box(0.27, 0.035, 0.28, 0, 0.87, 0, o.circlet);
    if (o.orc) {
      // a heavy, low-browed head thrust forward: jaw, tusks, ears, and pale eyes
      b.box(0.3, 0.2, 0.2, 0, 0.62, 0.1, o.skin);                       // muzzle and jaw
      b.box(0.32, 0.07, 0.1, 0, 0.86, 0.11, o.hair);                    // brow
      for (const sx of [-1, 1]) {
        b.box(0.035, 0.1, 0.035, sx * 0.09, 0.7, 0.2, 0xe8e2cc, 0, 0, sx * 0.25);   // tusks
        b.box(0.06, 0.04, 0.02, sx * 0.075, 0.82, 0.135, 0xffe04a);                // eyes
        b.box(0.05, 0.2, 0.14, sx * 0.19, 0.8, -0.03, o.skin, 0, 0, -sx * 0.7);    // ears
      }
      b.box(0.56, 0.16, 0.34, 0, 0.5, -0.06, o.tunic);                  // hunched shoulders
    }
    if (o.helm) {                                                        // an iron cap, with or without horns
      b.box(0.3, 0.14, 0.3, 0, 0.9, 0, o.helm);
      b.box(0.06, 0.22, 0.2, 0, 0.98, -0.02, o.helm);
      if (o.horns) for (const sx of [-1, 1]) b.box(0.06, 0.26, 0.06, sx * 0.19, 0.98, 0, 0xd8d2c0, 0, 0, -sx * 0.5);
    }
    if (o.badge) b.box(0.16, 0.16, 0.02, 0, 0.3, 0.145, o.badge);        // the Red Eye, daubed on the breast
    if (o.quiver) b.box(0.13, 0.55, 0.13, 0.16, 0.1, -0.2, o.quiver, 0, 0, 0.25);
    if (o.hood) {
      b.box(0.3, 0.3, 0.2, 0, 0.7, -0.07, o.cloak);
      b.box(0.3, 0.08, 0.3, 0, 0.95, 0, o.cloak);
      b.box(0.04, 0.26, 0.24, -0.15, 0.7, 0.02, o.cloak);
      b.box(0.04, 0.26, 0.24, 0.15, 0.7, 0.02, o.cloak);
    }
    if (o.cloak) {
      b.box(0.56, 0.1, 0.32, 0, 0.56, -0.01, o.cloak);        // mantle
      b.box(0.56, 1.05, 0.05, 0, -0.45, -0.19, o.cloak, 0, 0.07);
    }
    if (o.bow) {
      b.box(0.04, 1.2, 0.04, 0.1, -0.1, -0.26, 0x6b4a2a, 0, 0, 0.45);
      b.box(0.1, 0.5, 0.1, -0.14, 0.15, -0.27, 0x5a4030, 0, 0, -0.3);
    }
  }, 0.92, g);

  // Weapons are separate meshes so they can be shown and hidden.
  if (o.blade) {
    const b = new GeoBuilder(3, 0.03);
    b.box(0.05, 0.02, 0.9, 0, -0.75, 0.52, o.blade);
    b.box(0.2, 0.04, 0.05, 0, -0.76, 0.08, 0x3a3028);
    b.box(0.05, 0.05, 0.16, 0, -0.77, -0.02, 0x4a3828);
    g.sword = b.mesh();
    limbs.armR.add(g.sword);
  }
  if (o.heldBow) {
    const b = new GeoBuilder(4, 0.03);
    b.box(0.035, 0.62, 0.035, 0, -0.72, 0.1, o.heldBow, 0, 0.32);
    b.box(0.035, 0.62, 0.035, 0, -1.3, 0.1, o.heldBow, 0, -0.32);
    b.box(0.008, 1.1, 0.008, 0, -1.27, -0.07, 0xd8d2c0);
    g.heldBow = b.mesh();
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
  const bob = moving ? Math.abs(Math.cos(fig.userData.phase)) * 0.05 : Math.sin(time * 1.6) * 0.006;
  l.body.position.y = fig.userData.bodyY + bob;
  l.body.rotation.x = fig.userData.hunch + (moving ? Math.min(0.14, speed * 0.016) : 0);
  if (pose) {
    if (pose.armR !== undefined) l.armR.rotation.x = pose.armR;
    if (pose.armL !== undefined) l.armL.rotation.x = pose.armL;
  }
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

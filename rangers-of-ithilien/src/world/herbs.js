// Gatherable plants: kingsfoil (athelas), a low white-flowered herb of the glade
// edges, for Éowyn's healing draughts; and thyme, bay, poppy and wild olive,
// whose seed she wants for the gardens. Walk over a plant to gather it.

import * as THREE from 'three';
import { GeoBuilder, materials } from './build.js';
import { heightAt } from './terrain.js';
import { herbSites } from './herbSites.js';

/** The look of each plant, built around its root (world/villages.js sows them in rows too). */
export function plantGeometry(kind) {
  const b = new GeoBuilder(61 + kind.length, 0.06);
  if (kind === 'athelas') {
    for (let i = 0; i < 7; i++) { // a rosette of leaves
      const a = i * 0.9, c = Math.cos(a), s = Math.sin(a);
      b.tri(c * 0.05 - s * 0.09, 0.02, s * 0.05 + c * 0.09, c * 0.05 + s * 0.09, 0.02, s * 0.05 - c * 0.09, c * 0.42, 0.16, s * 0.42, 0x5f9a4a);
    }
    for (let i = 0; i < 5; i++) { // and white stars above them
      const a = i * 1.3, r = 0.08 + (i % 3) * 0.07;
      b.cyl(0.012, 0.012, 0.3 + (i % 2) * 0.08, Math.cos(a) * r, 0, Math.sin(a) * r, 0x6fa456, 3);
      b.add(new THREE.OctahedronGeometry(0.075), 0xffffff, new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.36 + (i % 2) * 0.08, Math.sin(a) * r));
    }
  } else if (kind === 'thymeSeed') { // a low cushion, purple with flower
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, r = 0.12 + (i % 2) * 0.1;
      b.blob(0.13, Math.cos(a) * r, 0.07, Math.sin(a) * r, i % 2 ? 0x6a7a48 : 0x8a6aa8, 1, 0.6, 1);
    }
    b.blob(0.12, 0, 0.13, 0, 0xa784c4, 1, 0.7, 1);
  } else if (kind === 'baySeed') { // a little bay bush, glossy, with dark berries
    b.cyl(0.03, 0.04, 0.35, 0, 0, 0, 0x5a4030, 4);
    b.blob(0.32, 0, 0.5, 0, 0x2f5a2a, 1, 1.1, 1);
    b.blob(0.22, 0.12, 0.72, 0.05, 0x3a6a32, 1, 1, 1);
    for (let i = 0; i < 6; i++) b.blob(0.05, Math.cos(i * 1.1) * 0.3, 0.45 + (i % 3) * 0.12, Math.sin(i * 1.1) * 0.3, 0x2a1a30);
  } else if (kind === 'poppySeed') { // tall stems with red heads
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3, r = 0.06 + (i % 3) * 0.06, h = 0.45 + (i % 2) * 0.15;
      b.cyl(0.01, 0.012, h, Math.cos(a) * r, 0, Math.sin(a) * r, 0x5f8a42, 3);
      b.blob(0.07, Math.cos(a) * r, h + 0.02, Math.sin(a) * r, i === 2 ? 0x8a8a5a : 0xd8302a, 1, 0.55, 1);
    }
  } else { // a wild olive sapling, grey-green, with dark fruit
    b.cyl(0.035, 0.05, 0.55, 0, 0, 0, 0x6a6050, 4);
    b.blob(0.34, 0, 0.75, 0, 0x7a8a62, 1.2, 0.8, 1.1);
    b.blob(0.22, -0.15, 0.95, 0.1, 0x8a9a72, 1, 0.8, 1);
    for (let i = 0; i < 6; i++) b.blob(0.045, Math.cos(i * 1.2) * 0.32, 0.65 + (i % 2) * 0.15, Math.sin(i * 1.2) * 0.32, 0x3a3428);
  }
  return b.geometry();
}

function glintTexture(core = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  if (core) g.addColorStop(0.28, 'rgba(255,255,255,1)'); // a solid bright middle, then a short glow
  g.addColorStop(core ? 0.45 : 0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** How high each kind's glimmer hangs: just over the plant (they are drawn 2.1 times their model size). */
const GLINT_AT = { athelas: 1.0, thymeSeed: 1.1, poppySeed: 1.8, baySeed: 2.2, oliveStone: 2.35 };
/** And how big: larger over the bushes, where it is seen against leaves. */
const GLINT_SIZE = { athelas: 1.1, thymeSeed: 0.8, poppySeed: 0.8, baySeed: 0.9, oliveStone: 0.9 };

export class Herbs {
  constructor(scene, picked) {
    this.sites = herbSites().filter((s) => !picked.includes(s.id));
    this.dummy = new THREE.Object3D();
    this.kinds = new Map(); // kind -> { mesh, glint, glintPos, sites }
    const tex = glintTexture(), dot = glintTexture(true);
    for (const kind of new Set(this.sites.map((s) => s.kind))) {
      const sites = this.sites.filter((s) => s.kind === kind);
      const mesh = new THREE.InstancedMesh(plantGeometry(kind), materials.flatDouble, sites.length);
      mesh.frustumCulled = false;
      // A small glimmer hangs over each plant so it can be told from the other
      // flowers of the woods: pale green over kingsfoil, warm gold over seed.
      const glintPos = new Float32Array(sites.length * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(glintPos, 3));
      const glint = new THREE.Points(geo, new THREE.PointsMaterial({
        map: kind === 'athelas' ? tex : dot, size: GLINT_SIZE[kind], color: kind === 'athelas' ? 0xe6fff0 : 0xffd85a,
        // kingsfoil a soft pale halo; seed a small bright gold dot, which shows against leaves too
        transparent: true, opacity: 0.8, depthWrite: false, blending: kind === 'athelas' ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      glint.frustumCulled = false;
      glint.renderOrder = 9;
      const entry = { mesh, glint, glintPos, sites };
      // (over the top of each: a bush's glimmer used to hang inside it, unseen)
      sites.forEach((s, i) => { s.i = i; s.entry = entry; this.place(s, 2.1); glintPos.set([s.x, heightAt(s.x, s.z) + GLINT_AT[kind], s.z], i * 3); });
      scene.add(mesh, glint);
      this.kinds.set(kind, entry);
    }
  }

  update(time) {
    for (const [kind, e] of this.kinds) e.glint.material.opacity = kind === 'athelas' ? 0.55 + 0.3 * Math.sin(time * 2.2) : 0.8 + 0.2 * Math.sin(time * 2.2 + 1.7);
  }

  place(s, scale) {
    const d = this.dummy;
    d.position.set(s.x, heightAt(s.x, s.z), s.z);
    d.rotation.y = s.x;
    d.scale.setScalar(scale);
    d.updateMatrix();
    s.entry.mesh.setMatrixAt(s.i, d.matrix);
    s.entry.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Gather any plant underfoot. Returns { id, kind }, or null. */
  gatherAt(x, z) {
    for (const s of this.sites) {
      if (s.gone || Math.abs(s.x - x) > 1.5 || Math.abs(s.z - z) > 1.5) continue;
      s.gone = true;
      this.place(s, 0.0001);
      s.entry.glintPos[s.i * 3 + 1] = -1000;
      s.entry.glint.geometry.attributes.position.needsUpdate = true;
      return { id: s.id, kind: s.kind };
    }
    return null;
  }

  /** Plants still standing, of a kind: for hints. */
  standing(kind) { return this.sites.filter((s) => !s.gone && s.kind === kind); }
}

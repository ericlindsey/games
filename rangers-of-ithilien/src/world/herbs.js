// Kingsfoil (athelas): a low white-flowered herb of the glade edges, gathered
// for Éowyn's healing draughts. Walk over a plant to gather it.

import * as THREE from 'three';
import { GeoBuilder, materials } from './build.js';
import { heightAt } from './terrain.js';
import { herbSites } from './herbSites.js';

export class Herbs {
  constructor(scene, picked) {
    this.sites = herbSites().filter((s) => !picked.includes(s.id));
    const b = new GeoBuilder(61, 0.06);
    for (let i = 0; i < 7; i++) { // a rosette of leaves
      const a = i * 0.9, c = Math.cos(a), s = Math.sin(a);
      b.tri(c * 0.05 - s * 0.09, 0.02, s * 0.05 + c * 0.09, c * 0.05 + s * 0.09, 0.02, s * 0.05 - c * 0.09, c * 0.42, 0.16, s * 0.42, 0x5f9a4a);
    }
    for (let i = 0; i < 5; i++) { // and white stars above them
      const a = i * 1.3, r = 0.08 + (i % 3) * 0.07;
      b.cyl(0.012, 0.012, 0.3 + (i % 2) * 0.08, Math.cos(a) * r, 0, Math.sin(a) * r, 0x6fa456, 3);
      b.add(new THREE.OctahedronGeometry(0.075), 0xffffff, new THREE.Matrix4().makeTranslation(Math.cos(a) * r, 0.36 + (i % 2) * 0.08, Math.sin(a) * r));
    }
    this.mesh = new THREE.InstancedMesh(b.geometry(), materials.flatDouble, this.sites.length);
    this.dummy = new THREE.Object3D();
    this.sites.forEach((s, i) => this.place(i, 2.1));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // A small pale glimmer hangs over each plant, so it can be told from the
    // other white flowers of the woods.
    this.glintPos = new Float32Array(this.sites.length * 3);
    this.sites.forEach((s, i) => this.glintPos.set([s.x, heightAt(s.x, s.z) + 1.0, s.z], i * 3));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.glintPos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(220,255,235,0.6)');
    g.addColorStop(1, 'rgba(200,255,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    this.glint = new THREE.Points(geo, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c), size: 1.1, color: 0xe6fff0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glint.frustumCulled = false;
    this.glint.renderOrder = 9;
    scene.add(this.glint);
  }

  update(time) {
    this.glint.material.opacity = 0.55 + 0.3 * Math.sin(time * 2.2);
  }

  place(i, scale) {
    const s = this.sites[i];
    this.dummy.position.set(s.x, heightAt(s.x, s.z), s.z);
    this.dummy.rotation.y = s.x;
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Gather any plant underfoot. Returns its id, or null. */
  gatherAt(x, z) {
    for (let i = 0; i < this.sites.length; i++) {
      const s = this.sites[i];
      if (s.gone || Math.abs(s.x - x) > 1.5 || Math.abs(s.z - z) > 1.5) continue;
      s.gone = true;
      this.place(i, 0.0001);
      this.glintPos[i * 3 + 1] = -1000;
      this.glint.geometry.attributes.position.needsUpdate = true;
      return s.id;
    }
    return null;
  }
}

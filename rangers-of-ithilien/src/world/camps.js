// Enemy camps. In this prototype they stand cold and empty; breaking one up
// lifts the blight around it. Later milestones will put enemies and loot here.

import * as THREE from 'three';
import { CAMPS } from './layout.js';
import { heightAt } from './terrain.js';
import { GeoBuilder } from './build.js';
import { rng } from '../util/noise.js';

const HIDE = 0x4a4036, CHAR = 0x26221f, RAG = 0x7a2a22, BONE = 0xd8d2c0;

export class Camps {
  /** @param {(id:string)=>boolean} isCleared */
  constructor(scene, isCleared) {
    this.sites = CAMPS.map((c) => {
      const y = heightAt(c.x, c.z), rand = rng(Math.round(c.x + c.z * 3));
      const occupied = new GeoBuilder(Math.round(c.x), 0.1);
      const always = new GeoBuilder(Math.round(c.z), 0.1);
      for (let i = 0; i < 9; i++) { // fire ring
        const a = (i / 9) * Math.PI * 2;
        always.blob(0.32, c.x + Math.cos(a) * 1.15, y + 0.1, c.z + Math.sin(a) * 1.15, 0x77726a, 1, 0.7, 1);
      }
      always.box(1.5, 0.2, 0.25, c.x, y, c.z, CHAR, 0.6);
      always.box(1.5, 0.2, 0.25, c.x, y + 0.1, c.z, CHAR, 2.2);
      for (let i = 0; i < 3; i++) { // crude hide shelters
        const a = rand() * 6.28, d = 4.5 + rand() * 2.5;
        const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        m.setPosition(c.x + Math.cos(a) * d, y + 0.55, c.z + Math.sin(a) * d);
        occupied.add(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3), HIDE, m);
      }
      const px = c.x + 3, pz = c.z - 3.5;
      occupied.box(0.14, 4.4, 0.14, px, y - 0.2, pz, 0x3a3028, 0, 0.06);
      occupied.box(0.05, 1.5, 1.1, px, y + 2.7, pz + 0.6, RAG);
      occupied.box(0.05, 0.6, 0.5, px, y + 2.2, pz + 0.9, CHAR);
      occupied.box(1.1, 0.8, 0.8, c.x - 3.2, y - 0.05, c.z + 2.6, 0x54402c, 0.5);   // a stash, for later
      occupied.box(0.9, 0.6, 0.7, c.x - 4.2, y - 0.05, c.z + 3.3, 0x4a3826, 1.2);
      for (let i = 0; i < 5; i++) occupied.box(0.5, 0.07, 0.08, c.x + (rand() - 0.5) * 6, y + 0.02, c.z + (rand() - 0.5) * 6, BONE, rand() * 3);

      const cleared = new GeoBuilder(Math.round(c.x) + 1, 0.06); // a ranger's marker
      cleared.box(0.1, 3, 0.1, px, y - 0.2, pz, 0x6e5236);
      cleared.box(0.04, 0.7, 1.2, px, y + 2, pz + 0.65, 0xf2f0e6);
      cleared.box(0.05, 0.35, 0.35, px, y + 2.2, pz + 0.6, 0x3f6b3a);

      const site = {
        ...c, y,
        occupied: occupied.mesh(), cleared: cleared.mesh(),
        strength: isCleared(c.id) ? 0 : 1, // 1 = blighted, eases to 0 once cleared
        isCleared: isCleared(c.id),
      };
      site.occupied.visible = !site.isCleared;
      site.cleared.visible = site.isCleared;
      scene.add(always.mesh(), site.occupied, site.cleared);
      return site;
    });
    this.byId = Object.fromEntries(this.sites.map((s) => [s.id, s]));
    this.strength = (id) => this.byId[id].strength;
  }

  clear(id) {
    const s = this.byId[id];
    s.isCleared = true;
    s.occupied.visible = false;
    s.cleared.visible = true;
  }

  reset() {
    for (const s of this.sites) {
      s.isCleared = false; s.strength = 1; s.occupied.visible = true; s.cleared.visible = false;
    }
  }

  /** Let the land heal gradually after a camp is cleared. */
  update(dt) {
    for (const s of this.sites) {
      if (s.isCleared && s.strength > 0) s.strength = Math.max(0, s.strength - dt / 6);
    }
  }
}

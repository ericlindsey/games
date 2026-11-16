// Enemy camps: the fires, shelters and stockades. Who holds them is in
// entities/enemies.js; when the last of a camp's company falls the camp is
// cleared and the blight around it lifts.

import * as THREE from 'three';
import { CAMPS } from './campSites.js';
import { heightAt } from './terrain.js';
import { addCircle } from './collision.js';
import { GeoBuilder } from './build.js';
import { rng } from '../util/noise.js';

const HIDE = 0x4a4036, CHAR = 0x26221f, RAG = 0x7a2a22, BONE = 0xd8d2c0, STAKE = 0x4d3d2c;

export class Camps {
  /** @param {(id:string)=>boolean} isCleared */
  constructor(scene, isCleared) {
    this.sites = CAMPS.map((c) => {
      const y = heightAt(c.x, c.z), rand = rng(Math.round(c.x + c.z * 3));
      const at = (x, z) => heightAt(x, z);
      const occupied = new GeoBuilder(Math.round(c.x), 0.1);
      const always = new GeoBuilder(Math.round(c.z), 0.1);
      for (let i = 0; i < 9; i++) { // fire ring
        const a = (i / 9) * Math.PI * 2;
        always.blob(0.32, c.x + Math.cos(a) * 1.15, y + 0.1, c.z + Math.sin(a) * 1.15, 0x77726a, 1, 0.7, 1);
      }
      always.box(1.5, 0.2, 0.25, c.x, y, c.z, CHAR, 0.6);
      always.box(1.5, 0.2, 0.25, c.x, y + 0.1, c.z, CHAR, 2.2);

      const shelters = [1, 3, 5][c.size - 1];
      for (let i = 0; i < shelters; i++) { // crude hide shelters
        const a = rand() * 6.28, d = 4.2 + rand() * (1.5 + c.size);
        const sx = c.x + Math.cos(a) * d, sz = c.z + Math.sin(a) * d;
        const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
        m.setPosition(sx, at(sx, sz) + 0.55, sz);
        occupied.add(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3), HIDE, m);
      }
      const px = c.x + 3, pz = c.z - 3.5, py = at(px, pz);
      if (c.size > 1) { // a ragged standard
        occupied.box(0.14, 4.4, 0.14, px, py - 0.2, pz, 0x3a3028, 0, 0.06);
        occupied.box(0.05, 1.5, 1.1, px, py + 2.7, pz + 0.6, RAG);
        occupied.box(0.05, 0.6, 0.5, px, py + 2.2, pz + 0.9, CHAR);
      }
      for (let i = 0; i < c.size; i++) { // stashes, for later
        const sx = c.x - 3.2 - i * 1.1, sz = c.z + 2.6 + i * 0.8;
        occupied.box(1.1 - i * 0.15, 0.8 - i * 0.15, 0.8, sx, at(sx, sz) - 0.05, sz, 0x54402c, 0.5 + i);
      }
      for (let i = 0; i < 3 + c.size * 2; i++) {
        const bx = c.x + (rand() - 0.5) * 7, bz = c.z + (rand() - 0.5) * 7;
        occupied.box(0.5, 0.07, 0.08, bx, at(bx, bz) + 0.02, bz, BONE, rand() * 3);
      }
      if (c.size === 3) { // a stockade of sharpened stakes
        const R = 11.5, gate = rand() * 6.28;
        for (let a = 0; a < 6.28; a += 0.085) {
          // three gates, so the company inside can come out at whoever troubles them
          let off = (((a - gate) % 2.094) + 2.094) % 2.094; off = Math.min(off, 2.094 - off);
          if (off < 0.19 || rand() < 0.06) continue;
          const sx = c.x + Math.cos(a) * R, sz = c.z + Math.sin(a) * R, sy = at(sx, sz);
          always.cyl(0, 0.17, 2.5 + rand() * 0.6, sx, sy - 0.2, sz, STAKE, 4, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2);
          addCircle(sx, sz, 0.42);
        }
      }

      const cleared = new GeoBuilder(Math.round(c.x) + 1, 0.06); // a ranger's marker
      cleared.box(0.1, 3, 0.1, px, py - 0.2, pz, 0x6e5236);
      cleared.box(0.04, 0.7, 1.2, px, py + 2, pz + 0.65, 0xf2f0e6);
      cleared.box(0.05, 0.35, 0.35, px, py + 2.2, pz + 0.6, 0x3f6b3a);

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

  /** Let the land heal gradually after a camp is cleared. */
  update(dt) {
    for (const s of this.sites) {
      if (s.isCleared && s.strength > 0) s.strength = Math.max(0, s.strength - dt / 6);
    }
  }
}

// Enemy camps: the fires, shelters and stockades. Who holds them is in
// entities/enemies.js; when the last of a camp's company falls the camp is
// cleared and the blight around it lifts.

import * as THREE from 'three';
import { CAMPS } from './campSites.js';
import { HOLDS } from './provinces.js';
import { heightAt } from './terrain.js';
import { addCircle } from './collision.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { addRock } from './rocks.js';
import { rng } from '../util/noise.js';

const HIDES = [0xb08a5a, 0x9a4a32, 0xc2a070, 0x8a6a4a], CHAR = 0x26221f, RAG = 0xb3261e, BONE = 0xd8d2c0, STAKE = 0x4d3d2c, ROCK = 0x7d776c;
const HOLD_IDS = new Set(Object.values(HOLDS).map((h) => h.id));
const SMOKE_PER_CAMP = 14, SMOKE_CAMPS = 14, SMOKE_RANGE = 520;

export class Camps {
  /** @param {(id:string)=>boolean} isCleared */
  constructor(scene, isCleared) {
    const flameGeo = new THREE.ConeGeometry(0.42, 1.1, 5);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, fog: false });
    this.sites = CAMPS.map((c) => {
      const rand = rng(Math.round(c.x + c.z * 3));
      const at = (x, z) => heightAt(x, z);
      const occupied = new GeoBuilder(Math.round(c.x), 0.1);
      const always = new GeoBuilder(Math.round(c.z), 0.1);
      occupied.kind = always.kind = SURF.wood;
      let fx = c.x, fz = c.z; // where the fire is

      if (c.kind === 'mine') {
        // An old digging in the hillside: a heap of rock with a black mouth, shored
        // with timber. They lair inside and keep their fire out front.
        const a = rand() * 6.28, mx = c.x + Math.cos(a) * 7, mz = c.z + Math.sin(a) * 7, my = at(mx, mz);
        addRock(always, mx, my - 1.2, mz, 13, ROCK, Math.round(c.x), { detail: 3, sy: 0.62, sx: 1.1, cuts: 8, strata: 0.7 });
        addRock(always, mx + Math.cos(a + 1.4) * 5, my - 0.8, mz + Math.sin(a + 1.4) * 5, 8, 0x8a8478, Math.round(c.z), { detail: 2, sy: 0.6, cuts: 7 });
        addRock(always, mx + Math.cos(a - 1.3) * 5, my - 0.8, mz + Math.sin(a - 1.3) * 5, 7, 0x7f8270, Math.round(c.x + c.z), { detail: 2, sy: 0.55, cuts: 7 });
        addCircle(mx, mz, 6);
        const ex = c.x + Math.cos(a) * 2.2, ez = c.z + Math.sin(a) * 2.2, ey = at(ex, ez); // the mouth, facing the fire
        always.box(2.6, 2.6, 2.6, ex + Math.cos(a) * 1.6, ey - 0.1, ez + Math.sin(a) * 1.6, 0x0c0b0a, -a);
        for (const s of [-1, 1]) always.box(0.3, 2.9, 0.3, ex - Math.sin(a) * 1.45 * s, ey - 0.1, ez + Math.cos(a) * 1.45 * s, 0x5a4530);
        always.box(0.35, 0.35, 3.4, ex, ey + 2.7, ez, 0x5a4530, -a);
        for (let k = 0; k < 7; k++) { // the spoil heap
          const sx = c.x - Math.cos(a) * 5 + (rand() - 0.5) * 3, sz = c.z - Math.sin(a) * 5 + (rand() - 0.5) * 3;
          addRock(always, sx, at(sx, sz) - 0.15, sz, 0.5 + rand() * 0.8, 0x8a8070, k + Math.round(c.x), { detail: 1, sy: 0.6, cuts: 5 });
        }
        fx = c.x - Math.cos(a) * 1.5; fz = c.z - Math.sin(a) * 1.5;
      }
      const y = at(fx, fz);
      for (let i = 0; i < 9; i++) { // fire ring
        const a = (i / 9) * Math.PI * 2;
        addRock(always, fx + Math.cos(a) * 1.15, at(fx + Math.cos(a) * 1.15, fz + Math.sin(a) * 1.15) - 0.08, fz + Math.sin(a) * 1.15, 0.55, 0x77726a, i + 7, { detail: 0, sy: 0.6, cuts: 4 });
      }
      always.box(1.5, 0.2, 0.25, fx, y, fz, CHAR, 0.6);
      always.box(1.5, 0.2, 0.25, fx, y + 0.1, fz, CHAR, 2.2);

      // Hide shelters: bigger and paler than the woods, so a camp can be picked out.
      const shelters = c.kind === 'mine' ? c.size - 1 : [2, 3, 5, 8][c.size - 1];
      for (let i = 0; i < shelters; i++) {
        const a = rand() * 6.28, d = 4.6 + rand() * (1.5 + c.size * 1.4);
        const sx = c.x + Math.cos(a) * d, sz = c.z + Math.sin(a) * d, big = 1.2 + rand() * 0.5;
        const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).scale(new THREE.Vector3(big, big, big));
        m.setPosition(sx, at(sx, sz) + 0.75 * big, sz);
        occupied.kind = SURF.cloth;
        occupied.add(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3, 2), HIDES[Math.floor(rand() * HIDES.length)], m);
        occupied.kind = SURF.wood;
      }
      const px = c.x + 3, pz = c.z - 3.5, py = at(px, pz);
      if (c.size > 1) { // a standard, red on a tall pole
        occupied.box(0.16, 6, 0.16, px, py - 0.2, pz, 0x3a3028, 0, 0.05);
        occupied.box(0.06, 2, 1.5, px, py + 3.8, pz + 0.85, RAG);
        occupied.box(0.07, 0.7, 0.6, px, py + 4.4, pz + 0.9, CHAR);
      }
      for (let i = 0; i < Math.min(3, c.size); i++) { // their stores
        const sx = c.x - 3.2 - i * 1.1, sz = c.z + 2.6 + i * 0.8;
        occupied.box(1.1 - i * 0.15, 0.8 - i * 0.15, 0.8, sx, at(sx, sz) - 0.05, sz, 0x6a5236, 0.5 + i);
      }
      for (let i = 0; i < 3 + c.size * 2; i++) {
        const bx = c.x + (rand() - 0.5) * 7, bz = c.z + (rand() - 0.5) * 7;
        occupied.box(0.5, 0.07, 0.08, bx, at(bx, bz) + 0.02, bz, BONE, rand() * 3);
      }
      // A stockade of sharpened stakes, round every stockade and war-camp, and
      // (since v0.6) round every province's hold, even where the hold is only a band.
      if ((c.size >= 3 || HOLD_IDS.has(c.id)) && c.kind !== 'mine') {
        const R = c.size === 4 ? 17 : c.size === 3 ? 11.5 : 10.5, gate = rand() * 6.28;
        for (let a = 0; a < 6.28; a += 0.98 / R) {
          // three gates, so the company inside can come out at whoever troubles them
          let off = (((a - gate) % 2.094) + 2.094) % 2.094; off = Math.min(off, 2.094 - off);
          if (off < 2.2 / R || rand() < 0.06) continue;
          const sx = c.x + Math.cos(a) * R, sz = c.z + Math.sin(a) * R, sy = at(sx, sz);
          always.cyl(0, 0.17, 2.5 + rand() * 0.6, sx, sy - 0.2, sz, STAKE, 6, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2);
          addCircle(sx, sz, 0.42, 'stake'); // stops the ranger; the camp's own company slips between
        }
        if (c.size === 4) { // and a watch-platform over a war-camp
          const tx = c.x + 6, tz = c.z + 6, ty = at(tx, tz);
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) occupied.box(0.22, 6, 0.22, tx + dx * 1.2, ty - 0.2, tz + dz * 1.2, STAKE);
          occupied.box(3, 0.2, 3, tx, ty + 5.6, tz, 0x5a4530);
          occupied.box(0.1, 2.4, 0.1, tx, ty + 5.8, tz, 0x3a3028);
          occupied.box(0.06, 1.2, 1.6, tx, ty + 7, tz + 0.85, RAG);
        }
      }

      const cleared = new GeoBuilder(Math.round(c.x) + 1, 0.06); // a ranger's marker
      cleared.box(0.1, 3, 0.1, px, py - 0.2, pz, 0x6e5236);
      cleared.box(0.04, 0.7, 1.2, px, py + 2, pz + 0.65, 0xf2f0e6);
      cleared.box(0.05, 0.35, 0.35, px, py + 2.2, pz + 0.6, 0x3f6b3a);

      const site = {
        ...c, y, fire: { x: fx, y, z: fz },
        occupied: occupied.mesh(materials.wood), cleared: cleared.mesh(materials.wood),
        strength: isCleared(c.id) ? 0 : 1, // 1 = blighted, eases to 0 once cleared
        isCleared: isCleared(c.id),
      };
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(fx, y + 0.7, fz);
      site.occupied.add(flame);
      site.flame = flame;
      site.occupied.visible = !site.isCleared;
      site.cleared.visible = site.isCleared;
      scene.add(always.mesh(materials.wood), site.occupied, site.cleared);
      return site;
    });
    this.byId = Object.fromEntries(this.sites.map((s) => [s.id, s]));
    this.strength = (id) => this.byId[id].strength;

    // Smoke: a thin column over each lit fire nearby, standing above the trees,
    // so a camp can be found by looking for it.
    const n = SMOKE_PER_CAMP * SMOKE_CAMPS;
    this.smokePos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(cv), size: 15, color: 0xd9d4cc, transparent: true, opacity: 0.6, depthWrite: false, fog: false,
    }));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 7;
    scene.add(this.smoke);
    this.smokeTick = 0;
    this.smoking = [];
  }

  clear(id) {
    const s = this.byId[id];
    s.isCleared = true;
    s.occupied.visible = false;
    s.cleared.visible = true;
  }

  /** Let the land heal after a camp is cleared; keep the fires burning and smoking at the others. */
  update(dt, time = 0, px = 0, pz = 0) {
    for (const s of this.sites) {
      if (s.isCleared && s.strength > 0) s.strength = Math.max(0, s.strength - dt / 6);
    }
    this.smokeTick -= dt;
    if (this.smokeTick <= 0) { // now and then, choose the nearest lit fires
      this.smokeTick = 1.5;
      this.smoking = this.sites.filter((s) => !s.isCleared && Math.abs(s.x - px) < SMOKE_RANGE && Math.abs(s.z - pz) < SMOKE_RANGE)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, SMOKE_CAMPS);
    }
    const p = this.smokePos;
    for (let k = 0; k < SMOKE_CAMPS; k++) {
      const s = this.smoking[k];
      for (let i = 0; i < SMOKE_PER_CAMP; i++) {
        const o = (k * SMOKE_PER_CAMP + i) * 3;
        if (!s) { p[o + 1] = -1000; continue; }
        const life = (time * 0.06 + i / SMOKE_PER_CAMP + (s.x % 7) * 0.1) % 1; // 0 at the fire, 1 at the top
        p[o] = s.fire.x + life * life * 9 + Math.sin(time * 0.4 + i) * life * 2;      // leaning down the wind
        p[o + 1] = s.fire.y + 1.5 + life * 58; // well above the tallest trees
        p[o + 2] = s.fire.z + Math.cos(time * 0.3 + i * 2) * life * 2;
      }
      if (s) s.flame.scale.setScalar(0.85 + 0.25 * Math.sin(time * 11 + s.x));
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
  }
}

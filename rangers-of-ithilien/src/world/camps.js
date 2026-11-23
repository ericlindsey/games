// Enemy camps: the fires, shelters and stockades. Who holds them is in
// entities/enemies.js; when the last of a camp's company falls the camp is
// cleared and the blight around it lifts.

import * as THREE from 'three';
import { CAMPS } from './campSites.js';
import { HOLDS } from './provinces.js';
import { heightAt } from './terrain.js';
import { addCircle, removeCircles } from './collision.js';
import { surfaceUniforms, CAMP_TINTS } from './surface.js';
import { GeoBuilder, SURF, materials } from './build.js';
import { addRock } from './rocks.js';
import { rng } from '../util/noise.js';

const HIDES = [0xb08a5a, 0x9a4a32, 0xc2a070, 0x8a6a4a], CHAR = 0x26221f, RAG = 0xb3261e, BONE = 0xd8d2c0, STAKE = 0x4d3d2c, ROCK = 0x7d776c;
const HOLD_IDS = new Set(Object.values(HOLDS).map((h) => h.id));
const SMOKE_PER_CAMP = 14, SMOKE_CAMPS = 14, SMOKE_RANGE = 520;
// Camps further off than this are not drawn (they are specks in the haze by then; their smoke still shows).
const CAMP_SEEN = 700;

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
      let ox = c.x, oz = c.z, facing = null; // where their gear lies about (a mine's, in front of the cut, the way it faces)

      if (c.kind === 'mine') {
        // An old mine in the hillside (since v0.7): a cut into the hill, walled
        // with rock on either hand, runs up to a timbered adit, its frames going
        // back into the dark; a tramway of rails comes out of it, with a tipped
        // cart, and the spoil lies heaped at the mouth of the cut. They lair
        // inside and keep their fire in the cut.
        const turn = rand() * 6.28, a = c.face ?? turn, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux; // u: into the hill; v: across (face: set by hand, campSites.js)
        const P = (du, dv) => [c.x + ux * du + vx * dv, c.z + uz * du + vz * dv];
        const along = -a, across = -(a + Math.PI / 2); // turn a rock's long side along u, or across it
        { // the hill: a long ridge of rock across the end of the cut, and its shoulders
          const [hx, hz] = P(12.5, 0);
          addRock(always, hx, at(hx, hz) - 1.4, hz, 18, ROCK, Math.round(c.x), { detail: 3, sx: 1.35, sy: 0.6, sz: 0.85, cuts: 8, strata: 0.7 }, across);
          for (const s of [-1, 1]) {
            const [sx, sz] = P(8.5, s * 8.5);
            addRock(always, sx, at(sx, sz) - 0.9, sz, 11, s > 0 ? 0x8a8478 : 0x7f8270, Math.round(c.z) + (s > 0 ? 1 : 0), { detail: 2, sy: 0.6, cuts: 7, strata: 0.5 });
          }
          // the ridge runs some 24 m across the end of the cut and 15 m deep: a row of circles fills it
          for (const [dv, du, r] of [[0, 12, 6.8], [4.4, 12.3, 6.5], [-4.4, 12.3, 6.5], [8.4, 13, 5.2], [-8.4, 13, 5.2]]) { const [rx, rz] = P(du, dv); addCircle(rx, rz, r); }
          for (const s of [-1, 1]) { const [sx, sz] = P(8.5, s * 8.5); addCircle(sx, sz, 4.6); } // and its shoulders
        }
        for (const s of [-1, 1]) { // the sides of the cut, high by the adit and lower toward the mouth of the cut
          [[4.2, 5.6, 0.95], [0.6, 4.2, 0.8], [-2.6, 3.2, 0.66], [-4.8, 2.2, 0.55]].forEach(([du, size, sy], k) => {
            const [wx, wz] = P(du, s * (1.55 + size * 0.42));
            addRock(always, wx, at(wx, wz) - 0.35, wz, size, ROCK, Math.round(c.x) + k * 7 + (s > 0 ? 3 : 0), { detail: 2, sx: 1.5, sy, sz: 0.85, cuts: 7, strata: 0.6 }, along);
            addCircle(wx, wz, size * 0.36);
          });
        }
        // the adit: frames of timber going back into the dark, roofed with lagging, under a brow of rock
        const [mx, mz] = P(3.4, 0), my = at(mx, mz);
        const [kx, kz] = P(4.6, 0);
        always.box(2.4, 2.6, 2.0, kx, my - 0.3, kz, 0x0b0a09, -a + Math.PI / 2);
        for (let k = 0; k < 2; k++) {
          const [fx0, fz0] = P(3.4 + k * 1.1, 0), sh = k ? 0.3 : 0;
          for (const s of [-1, 1]) always.box(0.34, 2.9 - sh, 0.34, fx0 + vx * s * 1.3, my - 0.25, fz0 + vz * s * 1.3, k ? 0x2e2418 : 0x5a4530, -a);
          always.box(0.4, 0.4, 3.3, fx0, my + 2.6 - sh, fz0, k ? 0x2e2418 : 0x5a4530, -a);
        }
        for (let i = -2; i <= 2; i++) { const [lx, lz] = P(4.0, i * 0.6); always.box(1.6, 0.08, 0.5, lx, my + 3.0, lz, 0x4a3828, -a); } // lagging over the frames
        { const [tx, tz] = P(3.2, 0); always.box(0.5, 0.3, 3.9, tx, my + 3.0, tz, 0x5a4530, -a); } // the heavy lintel
        { const [bx, bz] = P(5.4, 0); addRock(always, bx, my + 2.6, bz, 6.5, ROCK, Math.round(c.x) + 77, { detail: 2, sx: 1.3, sy: 0.7, sz: 0.9, cuts: 7, strata: 0.6 }, across); } // the brow of the hill over it
        addCircle(...P(4.6, 0), 1.6);
        // the tramway: two rails on sleepers, out of the dark and down the cut, in short lengths that keep to the ground
        for (let d0 = 4.2; d0 > -5; d0 -= 0.8) {
          const [sx, sz] = P(d0, 0);
          always.box(0.25, 0.1, 1.5, sx, at(sx, sz) - 0.02, sz, 0x4a3a2a, -a);
        }
        for (const s of [-1, 1]) {
          for (let d0 = 4.2; d0 > -5; d0 -= 1.6) {
            const [x0, z0] = P(d0, s * 0.5), [x1, z1] = P(d0 - 1.6, s * 0.5), [rx, rz] = P(d0 - 0.8, s * 0.5);
            const y0 = at(x0, z0), y1 = at(x1, z1);
            always.box(1.62, 0.08, 0.07, rx, (y0 + y1) / 2 + 0.06, rz, 0x5a5a5e, -a, 0, Math.atan2(y0 - y1, 1.6));
          }
        }
        { // a cart, tipped off the rails
          const [cx2, cz2] = P(-2.6, 1.2), cy2 = at(cx2, cz2);
          always.box(1.1, 0.75, 1.6, cx2, cy2 + 0.2, cz2, 0x5a4530, -a + 0.3, 0, 0.35);
          for (const s of [-1, 1]) always.cyl(0.24, 0.24, 0.1, cx2 + vx * s * 0.6, cy2 + 0.1, cz2 + vz * s * 0.6, 0x3a3a3e, 8, 0, Math.PI / 2);
        }
        for (let k = 0; k < 9; k++) { // the spoil heap, at the mouth of the cut
          const sx = c.x - ux * 6 + vx * (3.5 + rand() * 3) * (k % 2 ? 1 : -1) + (rand() - 0.5) * 2, sz = c.z - uz * 6 + vz * (3.5 + rand() * 3) * (k % 2 ? 1 : -1) + (rand() - 0.5) * 2;
          addRock(always, sx, at(sx, sz) - 0.15, sz, 0.5 + rand() * 0.9, 0x8a8070, k + Math.round(c.x), { detail: 1, sy: 0.6, cuts: 5 });
        }
        fx = c.x - ux * 8.5; fz = c.z - uz * 8.5; // their fire, out in front of the cut
        ox = fx - ux * 1.5; oz = fz - uz * 1.5; facing = a + Math.PI;
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
        const a = facing === null ? rand() * 6.28 : facing + (rand() - 0.5) * 2.2, d = facing === null ? 4.6 + rand() * (1.5 + c.size * 1.4) : 3.5 + rand() * 2;
        const sx = ox + Math.cos(a) * d, sz = oz + Math.sin(a) * d, big = 1.2 + rand() * 0.5;
        const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).scale(new THREE.Vector3(big, big, big));
        m.setPosition(sx, at(sx, sz) + 0.75 * big, sz);
        occupied.kind = SURF.cloth;
        occupied.add(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3, 2), HIDES[Math.floor(rand() * HIDES.length)], m);
        occupied.kind = SURF.wood;
      }
      const px = ox + 3, pz = oz - 3.5, py = at(px, pz);
      if (c.size > 1) { // a standard, red on a tall pole
        occupied.box(0.16, 6, 0.16, px, py - 0.2, pz, 0x3a3028, 0, 0.05);
        occupied.box(0.06, 2, 1.5, px, py + 3.8, pz + 0.85, RAG);
        occupied.box(0.07, 0.7, 0.6, px, py + 4.4, pz + 0.9, CHAR);
      }
      for (let i = 0; i < Math.min(3, c.size); i++) { // their stores
        const sx = ox - 3.2 - i * 1.1, sz = oz + 2.6 + i * 0.8;
        occupied.box(1.1 - i * 0.15, 0.8 - i * 0.15, 0.8, sx, at(sx, sz) - 0.05, sz, 0x6a5236, 0.5 + i);
      }
      for (let i = 0; i < 3 + c.size * 2; i++) {
        const bx = ox + (rand() - 0.5) * 7, bz = oz + (rand() - 0.5) * 7;
        occupied.box(0.5, 0.07, 0.08, bx, at(bx, bz) + 0.02, bz, BONE, rand() * 3);
      }
      const knocked = []; // stakes that lie on the ground once the stockade is broken
      // A stockade of sharpened stakes, round every stockade and war-camp, and
      // (since v0.6) round every province's hold, even where the hold is only a band.
      if ((c.size >= 3 || HOLD_IDS.has(c.id)) && c.kind !== 'mine') {
        const R = c.size === 4 ? 17 : c.size === 3 ? 11.5 : 10.5, gate = rand() * 6.28;
        const downRand = rng(Math.round(c.x * 3 + c.z)), wasCleared = isCleared(c.id);
        for (let a = 0; a < 6.28; a += 0.98 / R) {
          // three gates, so the company inside can come out at whoever troubles them
          let off = (((a - gate) % 2.094) + 2.094) % 2.094; off = Math.min(off, 2.094 - off);
          if (off < 2.2 / R || rand() < 0.06) continue;
          const sx = c.x + Math.cos(a) * R, sz = c.z + Math.sin(a) * R, sy = at(sx, sz);
          const h = 2.5 + rand() * 0.6, lx = (rand() - 0.5) * 0.2, lz = (rand() - 0.5) * 0.2;
          // (since v0.7.7) about half of them are knocked flat when the stockade falls
          const down = downRand() < 0.5;
          (down ? occupied : always).cyl(0, 0.17, h, sx, sy - 0.2, sz, STAKE, 6, lx, lz);
          if (down) {
            const fall = downRand() < 0.5 ? 1 : -1, across = downRand() < 0.5;
            knocked.push({ h, x: sx + (across ? 0 : fall * h * 0.45), z: sz + (across ? fall * h * 0.45 : 0), y: at(sx, sz), rx: across ? fall * Math.PI / 2 : 0, rz: across ? 0 : -fall * Math.PI / 2 });
            if (!wasCleared) addCircle(sx, sz, 0.42, 'stake', 'down:' + c.id);
          } else addCircle(sx, sz, 0.42, 'stake'); // stops the ranger; the camp's own company slips between
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
      for (const k of knocked) cleared.cyl(0, 0.17, k.h, k.x, k.y - k.h / 2 + 0.12, k.z, STAKE, 6, k.rx, k.rz); // (lying where they fell)
      { // and in the cold fire ring, beside the dead logs, flowers come up already (since v0.7.7)
        cleared.kind = SURF.leaf;
        const ox = fx + 0.48, oz = fz - 0.3;
        for (const [dx, dz, hh, col] of [[0, 0, 0.55, 0xf4f0e2], [0.18, 0.12, 0.42, 0xf2d24a], [-0.14, 0.16, 0.48, 0xf4f0e2], [0.06, -0.17, 0.36, 0xe8a0c8]]) {
          cleared.cyl(0.016, 0.022, hh, ox + dx, y - 0.02, oz + dz, 0x5f8a42, 4);
          cleared.kind = SURF.plain;
          for (let p = 0; p < 6; p++) { const a = p * 1.047; cleared.blob(0.055, ox + dx + Math.cos(a) * 0.07, y + hh + 0.01, oz + dz + Math.sin(a) * 0.07, col, 1.2, 0.4, 1.2); }
          cleared.blob(0.045, ox + dx, y + hh + 0.03, oz + dz, 0xe0a020, 1, 0.7, 1);
          cleared.kind = SURF.leaf;
        }
        for (let l = 0; l < 5; l++) { const a = l * 1.256 + 0.4; cleared.tri(ox, y + 0.02, oz, ox + Math.cos(a) * 0.32 - Math.sin(a) * 0.08, y + 0.12, oz + Math.sin(a) * 0.32 + Math.cos(a) * 0.08, ox + Math.cos(a) * 0.32 + Math.sin(a) * 0.08, y + 0.12, oz + Math.sin(a) * 0.32 - Math.cos(a) * 0.08, 0x5f8a42); }
        cleared.kind = SURF.wood;
      }

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
      site.always = always.mesh(materials.wood);
      site.near = true;
      site.occupied.visible = !site.isCleared;
      site.cleared.visible = site.isCleared;
      scene.add(site.always, site.occupied, site.cleared);
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
    removeCircles('down:' + id); // the stakes knocked flat stop no one
    this.show(s);
  }

  show(s) {
    s.always.visible = s.near;
    s.occupied.visible = s.near && !s.isCleared;
    s.cleared.visible = s.near && s.isCleared;
  }

  /** Let the land heal after a camp is cleared; keep the fires burning and smoking at the others. */
  update(dt, time = 0, px = 0, pz = 0) {
    for (const s of this.sites) {
      if (s.isCleared && s.strength > 0) s.strength = Math.max(0, s.strength - dt / 6);
    }
    // the dry, trodden ground of the nearest camps (since v0.7.7), greening as each heals (strength 1 -> 0 over 6 s)
    this.tintTick = (this.tintTick ?? 0) - dt;
    if (!(this.tintTick > 0) || !this.tinted) { // (also on the first call, and after a strange dt)
      this.tintTick = 0.5;
      this.tinted = this.sites.filter((s) => s.strength > 0 && Math.abs(s.x - px) < 400 && Math.abs(s.z - pz) < 400)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, CAMP_TINTS);
    }
    const tints = surfaceUniforms.uCamps.value;
    for (let k = 0; k < CAMP_TINTS; k++) {
      const s = this.tinted[k];
      if (s) tints[k].set(s.x, s.z, [0, 12, 15, 19, 25][s.size] ?? 14, s.strength); else tints[k].set(0, 0, 0, 0);
    }
    this.smokeTick -= dt;
    if (this.smokeTick <= 0) { // now and then, choose the nearest lit fires, and draw only the camps near enough to see
      this.smokeTick = 1.5;
      for (const s of this.sites) {
        const d = Math.hypot(s.x - px, s.z - pz), near = s.near ? d < CAMP_SEEN + 30 : d < CAMP_SEEN;
        if (near !== s.near) { s.near = near; this.show(s); }
      }
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

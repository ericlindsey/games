// The enemy: who waits at each camp, and how they behave. Enemies exist only
// near the ranger; a camp's company appears as you approach and is forgotten
// when you leave, unless you finish it, which clears the camp for good.

import * as THREE from 'three';
import { rng } from '../util/noise.js';
import { PLAYER } from '../config.js';
import { HA } from '../world/layout.js';
import { CAMPS } from '../world/campSites.js';
import { heightAt } from '../world/terrain.js';
import { groundAt, blockedBySolid, resolveCircles } from '../world/collision.js';
import { makeFigure, animateFigure, LOOKS } from './figure.js';
import { ENEMY_TYPES, rosterFor } from '../data/enemies.js';

export { ENEMY_TYPES, rosterFor };

const SPAWN_AT = 120, FORGET_AT = 190, SIGHT = 27, SIGHT_QUIET = 13, LEASH = 80, REACH = 1.9;

const _up = new THREE.Vector3(0, 1, 0);

export class Enemies {
  /**
   * @param api {
   *   isCleared(campId), onCampCleared(camp), onKill(enemy),
   *   hurtPlayer(amount, enemy), shoot(from {x,y,z}, to {x,y,z}, damage) }
   */
  constructor(scene, api) {
    this.scene = scene;
    this.api = api;
    this.list = [];
    this.camps = new Map(); // campId -> { alive }
    this.tick = 0;
    this.barMaterial = new THREE.SpriteMaterial({ color: 0xc23a2e, fog: false });
  }

  spawnCamp(camp) {
    const rand = rng(Math.round(camp.x + camp.z * 7));
    const roster = rosterFor(camp);
    this.camps.set(camp.id, { alive: roster.length });
    roster.forEach((type, i) => {
      const def = ENEMY_TYPES[type];
      const a = (i / roster.length) * Math.PI * 2 + rand() * 0.8, r = 2.6 + rand() * (2 + camp.size * 1.3);
      const x = camp.x + Math.cos(a) * r, z = camp.z + Math.sin(a) * r;
      const fig = makeFigure(LOOKS[type]);
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      fig.traverse((o) => { if (o.isMesh) { o.material = material; o.castShadow = true; } });
      fig.scale.setScalar(def.scale);
      const bar = new THREE.Sprite(this.barMaterial);
      bar.center.set(0, 0.5);
      bar.visible = false;
      this.scene.add(fig, bar);
      const tough = 1 + 0.18 * (camp.tier - 1);
      this.list.push({
        type, def, camp, fig, material, bar,
        x, z, y: heightAt(x, z), yaw: a + Math.PI, home: { x, z },
        hp: def.hp * tough, maxHp: def.hp * tough, damage: def.damage * (1 + 0.14 * (camp.tier - 1)),
        state: 'idle', timer: rand() * 3, cooldown: 0, speed: 0, alerted: false, flash: 0, dead: false, deathT: 0,
        side: rand() < 0.5 ? -1 : 1, stuck: 0,
      });
    });
  }

  remove(e) {
    this.scene.remove(e.fig, e.bar);
    e.fig.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    e.material.dispose();
  }

  forgetCamp(campId) {
    this.list = this.list.filter((e) => { if (e.camp.id !== campId) return true; this.remove(e); return false; });
    this.camps.delete(campId);
  }

  /** Everything forgotten: used when the ranger falls and wakes at home. */
  reset() {
    for (const id of [...this.camps.keys()]) this.forgetCamp(id);
  }

  /** The nearest living enemy within range of a point, or null. */
  nearest(x, z, range) {
    let best = null, bd = range;
    for (const e of this.list) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** True if any enemy has noticed the ranger. */
  inCombat() { return this.list.some((e) => !e.dead && e.alerted); }

  damage(e, amount, dirX = 0, dirZ = 0) {
    if (e.dead) return;
    e.hp -= amount;
    e.flash = 0.12;
    e.alerted = true;
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
    this.step(e, e.x + dirX * 0.6, e.z + dirZ * 0.6); // a little knock-back
    for (const o of this.list) if (o.camp === e.camp && !o.dead) o.alerted = true; // the camp is roused
    if (e.hp > 0) return;
    e.dead = true;
    e.deathT = 0;
    e.bar.visible = false;
    this.api.onKill(e);
    const c = this.camps.get(e.camp.id);
    if (c && --c.alive === 0) this.api.onCampCleared(e.camp);
  }

  /** Try to move an enemy to (nx, nz), sliding along what blocks it. Returns true if it moved. */
  step(e, nx, nz) {
    const ok = (x, z) => {
      if (blockedBySolid(x, z, e.y, 0.4)) return false;
      const h = heightAt(x, z);
      if (h < -0.7) return false;
      const run = Math.hypot(x - e.x, z - e.z);
      return !(h > e.y + 0.02 && run > 1e-5 && (h - heightAt(e.x, e.z)) / run > PLAYER.maxSlope);
    };
    const x0 = e.x, z0 = e.z;
    if (ok(nx, e.z)) e.x = nx;
    if (ok(e.x, nz)) e.z = nz;
    resolveCircles(e, 0.4, 'stake');
    e.y = groundAt(e.x, e.z, e.y);
    return Math.hypot(e.x - x0, e.z - z0) > 1e-4;
  }

  moveToward(e, tx, tz, speed, dt) {
    let dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    dx /= d; dz /= d;
    if (e.stuck > 0) { // go round whatever is in the way
      e.stuck -= dt;
      const sx = -dz * e.side, sz = dx * e.side;
      dx = dx * 0.3 + sx; dz = dz * 0.3 + sz;
      const n = Math.hypot(dx, dz); dx /= n; dz /= n;
    }
    const s = Math.min(d, speed * dt);
    const x0 = e.x, z0 = e.z;
    this.step(e, e.x + dx * s, e.z + dz * s);
    if (Math.hypot(e.x - x0, e.z - z0) < s * 0.35 && e.stuck <= 0) { e.stuck = 0.7; e.side = -e.side; }
    e.speed = speed;
    this.face(e, dx, dz, dt);
  }

  face(e, dx, dz, dt) {
    let turn = Math.atan2(dx, dz) - e.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    e.yaw += turn * Math.min(1, dt * 9);
  }

  /**
   * @param player { pos, speed }  @param quiet true if the ranger is walking softly
   * @param alive false while the ranger is down
   */
  update(dt, time, player, quiet, alive, camera) {
    const p = player.pos;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const camp of CAMPS) {
        const d = Math.hypot(camp.x - p.x, camp.z - p.z);
        const here = this.camps.has(camp.id);
        if (!here && d < SPAWN_AT && !this.api.isCleared(camp.id)) this.spawnCamp(camp);
        else if (here && d > FORGET_AT) this.forgetCamp(camp.id);
      }
    }
    const atHome = Math.hypot(p.x - HA.x, p.z - HA.z) < 210; // they will not come near the falls

    for (const e of this.list) {
      const pose = {};
      if (e.dead) {
        e.deathT += dt;
        e.fig.rotation.x = -Math.min(1, e.deathT / 0.45) * 1.5;
        if (e.deathT > 6) e.fig.position.y = e.y - (e.deathT - 6) * 0.5;
        continue;
      }
      const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz), dy = Math.abs(p.y - e.y);
      const fromCamp = Math.hypot(e.x - e.camp.x, e.z - e.camp.z);
      e.cooldown -= dt;
      e.speed = 0;

      if (!e.alerted && alive && dy < 6 && dist < (quiet ? SIGHT_QUIET : SIGHT)) {
        for (const o of this.list) if (o.camp === e.camp && !o.dead) { o.alerted = true; if (o.state === 'idle') o.state = 'chase'; }
      }
      if (e.alerted && (fromCamp > LEASH || !alive || (atHome && fromCamp > 40) || dist > 70)) { e.alerted = false; e.state = 'return'; }
      if (e.alerted && e.state === 'idle') e.state = 'chase';

      switch (e.state) {
        case 'idle': {
          e.timer -= dt;
          if (e.timer < 0) { e.timer = 3 + ((e.x * 7 + time) % 4); e.wander = { x: e.home.x + Math.sin(time + e.x) * 2.5, z: e.home.z + Math.cos(time * 1.3 + e.z) * 2.5 }; }
          if (e.wander && Math.hypot(e.wander.x - e.x, e.wander.z - e.z) > 0.4) this.moveToward(e, e.wander.x, e.wander.z, 1.2, dt);
          break;
        }
        case 'return': {
          if (Math.hypot(e.home.x - e.x, e.home.z - e.z) < 1) { e.state = 'idle'; e.hp = e.maxHp; } else this.moveToward(e, e.home.x, e.home.z, e.def.speed * 0.8, dt);
          break;
        }
        case 'chase': {
          if (e.def.ranged) {
            if (dist < 8) this.moveToward(e, e.x - dx, e.z - dz, e.def.speed, dt);           // too close: fall back
            else if (dist > 23) this.moveToward(e, p.x, p.z, e.def.speed, dt);
            else {
              this.face(e, dx / dist, dz / dist, dt);
              if (e.cooldown <= 0) { e.state = 'aim'; e.timer = 0.8; }
            }
          } else if (dist > REACH) this.moveToward(e, p.x, p.z, e.def.speed, dt);
          else {
            this.face(e, dx / dist, dz / dist, dt);
            if (e.cooldown <= 0) { e.state = 'windup'; e.timer = 0.45; }
          }
          break;
        }
        case 'windup': { // the blade goes up; step away now and it misses
          e.timer -= dt;
          this.face(e, dx / dist, dz / dist, dt);
          pose.armR = -2.7;
          if (e.timer <= 0) {
            if (dist < REACH + 0.7 && dy < 2) this.api.hurtPlayer(e.damage * (0.85 + 0.3 * ((time * 13) % 1)), e);
            e.state = 'strike'; e.timer = 0.22; e.cooldown = 1.0;
          }
          break;
        }
        case 'strike': {
          e.timer -= dt;
          pose.armR = -0.4;
          if (e.timer <= 0) e.state = 'chase';
          break;
        }
        case 'aim': {
          e.timer -= dt;
          this.face(e, dx / dist, dz / dist, dt);
          pose.armL = -1.5; pose.armR = -1.25;
          if (e.timer <= 0) {
            const lead = Math.min(1, dist / 26);
            this.api.shoot({ x: e.x, y: e.y + 1.4 * e.def.scale, z: e.z },
              { x: p.x + (player.vx ?? 0) * lead * 0.5, y: p.y + 1.2, z: p.z + (player.vz ?? 0) * lead * 0.5 }, e.damage);
            e.state = 'chase'; e.cooldown = 2.2 + ((time * 7) % 1);
          }
          break;
        }
      }

      // keep them from standing inside one another
      for (const o of this.list) {
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
        if (od < 0.85 && od > 1e-3) { e.x += (ox / od) * (0.85 - od) * 0.5; e.z += (oz / od) * (0.85 - od) * 0.5; }
      }

      e.fig.position.set(e.x, e.y, e.z);
      e.fig.rotation.y = e.yaw;
      animateFigure(e.fig, e.speed, dt, time, pose);
      if (e.flash > 0) { e.flash -= dt; e.material.color.setRGB(2.4, 1.3, 1.2); } else e.material.color.setRGB(1, 1, 1);
      const hurt = e.hp < e.maxHp;
      e.bar.visible = hurt || e.alerted;
      if (e.bar.visible) {
        // the bar grows from its left end, so shift it to stay centred over the head
        const w = 1.1 * Math.max(0, e.hp / e.maxHp);
        e.bar.scale.set(w, 0.09, 1);
        e.bar.position.set(e.x, e.y + 2.15 * e.def.scale, e.z).addScaledVector(_right(camera), -0.55);
      }
    }
    // the fallen sink into the leaf-mould and are gone
    this.list = this.list.filter((e) => { if (!e.dead || e.deathT < 8) return true; this.remove(e); return false; });
  }
}

const _r = new THREE.Vector3();
function _right(camera) {
  return _r.setFromMatrixColumn(camera.matrixWorld, 0);
}

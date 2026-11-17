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
import { ENEMY_TYPES, rosterFor, patrolRoster } from '../data/enemies.js';
import { enemyStrength } from '../systems/renown.js';
import { haradRoadX } from '../world/layout.js';
import { dangerTier } from '../world/regions.js';

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
    this.patrolIn = 30;   // seconds until the next band may come down the road
    this.patrolCount = 0;
    this.rand = rng(9191);
  }

  /**
   * A band marching on the Harad Road. `dir` is +1 for southward. They are a
   * company like a camp's, but their home moves with them.
   */
  spawnPatrol(z, dir, forced) {
    const x = haradRoadX(z);
    const { list, host } = forced ?? patrolRoster(dangerTier(x - 60, z), this.rand, this.api.renown?.() ?? 0);
    const camp = { id: 'patrol' + ++this.patrolCount, x, z, tier: Math.max(2, dangerTier(x - 60, z)), size: 2, patrol: { dir, host } };
    this.spawnCamp(camp, list);
    if (host) this.api.onHost?.(camp);
    return camp;
  }

  spawnCamp(camp, roster = rosterFor(camp, this.api.renown?.() ?? 0)) {
    const rand = rng(Math.round(camp.x + camp.z * 7));
    this.camps.set(camp.id, { alive: roster.length, camp });
    roster.forEach((type, i) => {
      const def = ENEMY_TYPES[type];
      const a = (i / roster.length) * Math.PI * 2 + rand() * 0.8, r = 2.6 + rand() * (2 + camp.size * 1.3);
      // a camp's company stands about its fire; a band on the road walks in file
      const x = camp.patrol ? haradRoadX(camp.z - camp.patrol.dir * i * 1.8) + (i % 2 ? 1.2 : -1.2) : camp.x + Math.cos(a) * r;
      const z = camp.patrol ? camp.z - camp.patrol.dir * i * 1.8 : camp.z + Math.sin(a) * r;
      const fig = makeFigure(LOOKS[type]);
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      fig.traverse((o) => { if (o.isMesh) { o.material = material; o.castShadow = true; } });
      fig.scale.setScalar(def.scale);
      const bar = new THREE.Sprite(this.barMaterial);
      bar.center.set(0, 0.5);
      bar.visible = false;
      this.scene.add(fig, bar);
      const str = enemyStrength(this.api.renown?.() ?? 0); // they grow harder as the ranger's name grows
      const tough = (1 + 0.18 * (camp.tier - 1)) * str.hp;
      this.list.push({
        type, def, camp, fig, material, bar,
        x, z, y: heightAt(x, z), yaw: a + Math.PI, home: { x, z },
        hp: def.hp * tough, maxHp: def.hp * tough, damage: def.damage * (1 + 0.14 * (camp.tier - 1)) * str.damage,
        state: 'idle', timer: rand() * 3, cooldown: 0, speed: 0, alerted: false, flash: 0, dead: false, deathT: 0,
        side: rand() < 0.5 ? -1 : 1, stuck: 0,
        vy: 0, air: false, check: { t: 0, x, z }, stuckFor: 0,
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
    if (c && --c.alive === 0) { if (e.camp.patrol) this.api.onPatrolBeaten?.(e.camp); else this.api.onCampCleared(e.camp); }
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
    if (!e.air) e.y = groundAt(e.x, e.z, e.y);
    return Math.hypot(e.x - x0, e.z - z0) > 1e-4;
  }

  /**
   * Getting unstuck. Every second, see how far an enemy that wants to move has
   * got. Only one that is after the ranger jumps, after a second of going nowhere
   * (which clears a low wall); any that is stuck four seconds is set down a step
   * or two aside, on open ground, toward where it was trying to go.
   */
  unstick(e, tx, tz, dt, jump) {
    const c = e.check;
    c.t += dt;
    if (c.t < 1) return;
    const moved = Math.hypot(e.x - c.x, e.z - c.z);
    c.t = 0; c.x = e.x; c.z = e.z;
    if (moved > 1.2) { e.stuckFor = 0; return; }
    e.stuckFor++;
    if (jump && !e.air) { e.vy = 6.8; e.air = true; }
    if (e.stuckFor >= 4) {
      const want = Math.atan2(tx - e.x, tz - e.z);
      for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
        for (const r of [1.6, 2.4, 3.2]) {
          const nx = e.x + Math.sin(want + off) * r, nz = e.z + Math.cos(want + off) * r;
          const g = groundAt(nx, nz, e.y + 1);
          if (Math.abs(g - e.y) < 2 && !blockedBySolid(nx, nz, g, 0.45)) {
            e.x = nx; e.z = nz; e.y = g; e.air = false; e.vy = 0; e.stuckFor = 0;
            return;
          }
        }
      }
    }
  }

  /** `unstick`: 'jump' when chasing, 'shift' to only be set aside, else nothing. */
  moveToward(e, tx, tz, speed, dt, unstick = null) {
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
    if (unstick && d > 1.5) this.unstick(e, tx, tz, dt, unstick === 'jump' && d > 3); // not when crowding the ranger
    else { e.check.t = 0; e.check.x = e.x; e.check.z = e.z; e.stuckFor = 0; }
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
      // Bands on the road: forgotten when far behind, and a new one now and then
      // while the ranger is anywhere near the road.
      for (const [id, c] of this.camps) {
        if (!c.camp.patrol) continue;
        const lead = this.list.find((e) => e.camp === c.camp && !e.dead);
        const any = this.list.some((e) => e.camp === c.camp);
        if (!any) this.camps.delete(id); // all fallen and gone
        else if (lead && (Math.hypot(lead.x - p.x, lead.z - p.z) > 300 || lead.z < 80 || lead.z > 3800)) this.forgetCamp(id);
      }
      const nearRoad = Math.abs(p.x - haradRoadX(p.z)) < 240 && p.z > 260 && p.z < 3700;
      this.patrolIn -= nearRoad ? 0.5 : 0;
      if (nearRoad && this.patrolIn <= 0 && alive && ![...this.camps.values()].some((c) => c.camp.patrol)) {
        const dir = this.rand() < 0.75 ? 1 : -1; // most come south from the Black Gate
        this.spawnPatrol(p.z - dir * 190, dir);
        this.patrolIn = 50 + this.rand() * 70;
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
      const pat = e.camp.patrol;
      // a band's "camp" is the road itself: how far it has strayed from it
      const fromCamp = pat ? Math.abs(e.x - haradRoadX(e.z)) : Math.hypot(e.x - e.camp.x, e.z - e.camp.z);
      e.cooldown -= dt;
      e.speed = 0;
      if (e.air) { // in the air: fall back to whatever is underfoot
        e.vy -= 20 * dt;
        e.y += e.vy * dt;
        const g = groundAt(e.x, e.z, e.y);
        if (e.y <= g && e.vy <= 0) { e.y = g; e.vy = 0; e.air = false; }
      }

      if (!e.alerted && alive && dy < 6 && dist < (quiet ? SIGHT_QUIET : SIGHT)) {
        for (const o of this.list) if (o.camp === e.camp && !o.dead) { o.alerted = true; if (o.state === 'idle') o.state = 'chase'; }
      }
      if (e.alerted && (fromCamp > LEASH || !alive || (atHome && fromCamp > 40) || dist > 70)) { e.alerted = false; e.state = 'return'; }
      if (e.alerted && e.state === 'idle') e.state = 'chase';

      switch (e.state) {
        case 'idle': {
          if (pat) { // on the march
            const tz = e.z + pat.dir * 8;
            this.moveToward(e, haradRoadX(tz) + (e.side > 0 ? 1.2 : -1.2), tz, 2.1, dt, 'shift');
            break;
          }
          e.timer -= dt;
          if (e.timer < 0) { e.timer = 3 + ((e.x * 7 + time) % 4); e.wander = { x: e.home.x + Math.sin(time + e.x) * 2.5, z: e.home.z + Math.cos(time * 1.3 + e.z) * 2.5 }; }
          if (e.wander && Math.hypot(e.wander.x - e.x, e.wander.z - e.z) > 0.4) this.moveToward(e, e.wander.x, e.wander.z, 1.2, dt);
          break;
        }
        case 'return': {
          if (pat) { // back to the road, then march on
            if (fromCamp < 3) e.state = 'idle'; else this.moveToward(e, haradRoadX(e.z), e.z + pat.dir * 4, e.def.speed * 0.8, dt, 'shift');
          } else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) < 1) { e.state = 'idle'; e.hp = e.maxHp; } else this.moveToward(e, e.home.x, e.home.z, e.def.speed * 0.8, dt, 'shift');
          break;
        }
        case 'chase': {
          if (e.def.ranged) {
            if (dist < 8) this.moveToward(e, e.x - dx, e.z - dz, e.def.speed, dt);           // too close: fall back
            else if (dist > 23) this.moveToward(e, p.x, p.z, e.def.speed, dt, 'jump');
            else {
              this.face(e, dx / dist, dz / dist, dt);
              if (e.cooldown <= 0) { e.state = 'aim'; e.timer = 0.8; }
            }
          } else if (dist > REACH) this.moveToward(e, p.x, p.z, e.def.speed, dt, 'jump');
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

// The ranger's fighting: sword and bow, arrows in flight (both sides'),
// health, loot bags, and falling in battle.

import * as THREE from 'three';
import { rng } from '../util/noise.js';
import { pointBlocked } from '../world/collision.js';
import { stats, addItem, describeLoot, enemyLoot, quickHeal, useItem, BASE_HEALTH } from './inventory.js';
import { ITEMS } from '../data/items.js';
import { GeoBuilder } from '../world/build.js';

const GRAVITY = 9, SWING = 0.5, FULL_DRAW = 0.8;
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Combat {
  /** @param g { scene, camera, player, rig, input, state, enemies, hud, onFallen() } */
  constructor(g) {
    Object.assign(this, g);
    this.rand = rng(7771);
    this.swing = 0;         // time left in the current sword stroke
    this.struck = true;
    this.draw = 0;          // how long the bow has been bent
    this.drawing = false;
    this.autoShot = null;   // touch: { target, t } while an aimed shot is being made
    this.cooldown = 0;
    this.sinceHurt = 99;
    this.fallen = 0;        // > 0 while the ranger is down
    this.arrows = [];
    this.bags = [];
    this.noArrowsToast = 0;
    this.arrowGeo = new THREE.BoxGeometry(0.035, 0.035, 0.85);
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0x6b5a3a });
    this.bagGeo = new GeoBuilder(12, 0.1).blob(0.3, 0, 0.2, 0, 0x7a5c3a, 1, 0.8, 1).blob(0.12, 0, 0.48, 0, 0x5a4028).geometry();
    this.bagMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.syncWeapon();
  }

  get weapon() { return this.state.weapon; }

  syncWeapon() {
    const f = this.player.figure;
    f.sword.visible = this.state.weapon === 'sword';
    f.heldBow.visible = this.state.weapon === 'bow';
    this.hud.setWeapon(this.state);
  }

  swap(to) {
    if (this.swing > 0 || this.drawing) return;
    this.state.weapon = to ?? (this.state.weapon === 'sword' ? 'bow' : 'sword');
    this.syncWeapon();
  }

  heal() {
    const id = quickHeal(this.state);
    if (!id) { this.hud.toast('', this.state.health >= BASE_HEALTH ? 'You are whole already.' : 'Nothing in the pack to mend you.'); return; }
    const got = useItem(this.state, id);
    if (got) this.hud.toast('', `${ITEMS[id].name}: you feel better.`);
    this.hud.setHealth(this.state.health);
  }

  /** The ranger is struck. */
  hurt(amount) {
    if (this.fallen > 0) return;
    this.state.health -= amount * (1 - stats(this.state).defence);
    this.sinceHurt = 0;
    this.hud.flashHurt();
    if (this.state.health <= 0) {
      this.state.health = 0;
      this.fallen = 2.6;
      this.drawing = false; this.autoShot = null; this.swing = 0;
      this.state.stats.deaths++;
      this.hud.showFallen(true);
    }
    this.hud.setHealth(this.state.health);
  }

  /** Loose an arrow from `from` so that it arrives at `to`. */
  shoot(from, to, damage, speed, fromPlayer) {
    _d.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const t = Math.max(0.05, _d.length() / speed);
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    this.scene.add(mesh);
    this.arrows.push({
      x: from.x, y: from.y, z: from.z,
      vx: _d.x / t, vy: _d.y / t + 0.5 * GRAVITY * t, vz: _d.z / t, // aim high enough to fall onto the mark
      damage, fromPlayer, life: 5, mesh,
    });
  }

  dropLoot(e) {
    const loot = enemyLoot(e.type, e.camp.tier, this.rand);
    if (!loot.length) return;
    const mesh = new THREE.Mesh(this.bagGeo, this.bagMat);
    mesh.position.set(e.x, e.y, e.z);
    this.scene.add(mesh);
    this.bags.push({ x: e.x, y: e.y, z: e.z, loot, mesh, age: 0 });
  }

  /** Give loot (pairs of [id, count]) to the ranger and say so. */
  give(loot, heading = 'Taken') {
    for (const [id, n] of loot) addItem(this.state, id, n);
    this.hud.toast('', `${heading}: ${describeLoot(loot)}`);
    this.hud.setWeapon(this.state);
  }

  /** Where the ranger is looking: the first thing the line of sight meets. */
  aimPoint(out) {
    const c = this.camera.position;
    this.camera.getWorldDirection(_d);
    for (let t = Math.max(2, this.rig.dist + 1); t < 90; t += 1.5) {
      out.set(c.x + _d.x * t, c.y + _d.y * t, c.z + _d.z * t);
      if (pointBlocked(out.x, out.y, out.z)) return out;
      const e = this.enemies.nearest(out.x, out.z, 0.9);
      if (e && out.y > e.y - 0.3 && out.y < e.y + 2.3) return out;
    }
    return out;
  }

  loose(target, power) {
    const p = this.player.pos, s = stats(this.state);
    const from = { x: p.x + Math.sin(this.player.yaw) * 0.5, y: p.y + 1.45, z: p.z + Math.cos(this.player.yaw) * 0.5 };
    this.shoot(from, target, s.bow * (0.5 + 0.5 * power), 36 + 26 * power, true);
    this.state.arrows--;
    this.hud.setWeapon(this.state);
    this.cooldown = 0.35;
  }

  /**
   * @param attack true while the attack control is held
   * @returns the pose for the ranger's arms this frame, and whether they must move slowly
   */
  update(dt, time, attack) {
    const pose = {}, st = this.state, p = this.player.pos, touch = this.input.touch;
    this.cooldown -= dt;
    this.sinceHurt += dt;
    this.noArrowsToast -= dt;
    let slow = false;

    if (this.fallen > 0) {
      this.fallen -= dt;
      if (this.fallen <= 0) { this.hud.showFallen(false); this.onFallen(); }
      attack = false;
    } else if (this.sinceHurt > 9 && st.health < BASE_HEALTH && !this.enemies.inCombat()) {
      st.health = Math.min(BASE_HEALTH, st.health + dt * 2.5); // rest mends, slowly, once the fight is over
      this.hud.setHealth(st.health);
    }

    // On touch there is one attack button: it picks the weapon and the mark for you.
    if (touch && attack && !this.autoShot && this.swing <= 0 && this.cooldown <= 0) {
      const near = this.enemies.nearest(p.x, p.z, 34);
      if (near && Math.hypot(near.x - p.x, near.z - p.z) > 4.5 && st.arrows > 0) {
        if (st.weapon !== 'bow') this.swap('bow');
        this.autoShot = { target: near, t: 0 };
      } else {
        if (st.weapon !== 'sword') this.swap('sword');
        if (near && Math.hypot(near.x - p.x, near.z - p.z) < 6) this.player.yaw = Math.atan2(near.x - p.x, near.z - p.z);
        else this.player.yaw = this.rig.yaw;
        this.swing = SWING; this.struck = false;
      }
    }
    if (this.autoShot) {
      const a = this.autoShot;
      a.t += dt;
      slow = true;
      this.player.yaw = Math.atan2(a.target.x - p.x, a.target.z - p.z);
      pose.armL = -1.5; pose.armR = -1.5 + Math.min(1, a.t / 0.45) * 0.5;
      if (a.target.dead) this.autoShot = null;
      else if (a.t >= 0.45) {
        this.loose({ x: a.target.x, y: a.target.y + 1.1 * a.target.def.scale, z: a.target.z }, 0.85);
        this.autoShot = null;
      }
    } else if (!touch) {
      if (st.weapon === 'sword') {
        if (attack && this.swing <= 0 && this.cooldown <= 0) { this.swing = SWING; this.struck = false; this.player.yaw = this.rig.yaw; }
      } else if (attack && this.cooldown <= 0) {
        if (st.arrows <= 0) {
          if (this.noArrowsToast <= 0) { this.hud.toast('', 'Your quiver is empty.'); this.noArrowsToast = 4; }
        } else { this.drawing = true; this.draw += dt; }
      } else if (this.drawing) { // released: loose
        this.drawing = false;
        if (this.draw > 0.18) this.loose(this.aimPoint(_v), Math.min(1, this.draw / FULL_DRAW));
        this.draw = 0;
      }
      if (this.drawing) {
        slow = true;
        this.player.yaw = this.rig.yaw;
        pose.armL = -1.5; pose.armR = -1.5 + Math.min(1, this.draw / FULL_DRAW) * 0.55;
      }
    }

    if (this.swing > 0) {
      this.swing -= dt;
      const t = 1 - this.swing / SWING; // 0..1 through the stroke
      pose.armR = t < 0.3 ? -0.4 - (t / 0.3) * 2.4 : -2.8 + Math.min(1, (t - 0.3) / 0.25) * 2.6;
      if (!this.struck && t >= 0.42) {
        this.struck = true;
        const fx = Math.sin(this.player.yaw), fz = Math.cos(this.player.yaw), dmg = stats(st).sword;
        for (const e of this.enemies.list) {
          if (e.dead) continue;
          const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
          if (d > 2.8 || Math.abs(e.y - p.y) > 2.5) continue;
          if (d > 0.6 && (dx * fx + dz * fz) / d < 0.35) continue; // not in front
          this.enemies.damage(e, dmg * (0.85 + 0.3 * this.rand()), dx / (d || 1), dz / (d || 1));
        }
      }
      if (this.swing <= 0) this.cooldown = 0.08;
    }

    this.flyArrows(dt);

    // pick up what the fallen dropped
    for (const b of this.bags) {
      b.age += dt;
      if (Math.hypot(b.x - p.x, b.z - p.z) < 1.7 && Math.abs(b.y - p.y) < 2.5 && this.fallen <= 0) { this.give(b.loot); b.age = 1e9; }
    }
    this.bags = this.bags.filter((b) => { if (b.age < 240) return true; this.scene.remove(b.mesh); return false; });

    return { pose, slow };
  }

  flyArrows(dt) {
    const p = this.player.pos;
    for (const a of this.arrows) {
      a.life -= dt;
      const steps = 3, h = dt / steps;
      for (let i = 0; i < steps && a.life > 0; i++) {
        a.vy -= GRAVITY * h;
        a.x += a.vx * h; a.y += a.vy * h; a.z += a.vz * h;
        if (a.fromPlayer) {
          const e = this.enemies.nearest(a.x, a.z, 0.6);
          if (e && a.y > e.y - 0.1 && a.y < e.y + 2 * e.def.scale) {
            const n = Math.hypot(a.vx, a.vz) || 1;
            this.enemies.damage(e, a.damage, a.vx / n, a.vz / n);
            a.life = 0;
          }
        } else if (Math.hypot(a.x - p.x, a.z - p.z) < 0.5 && a.y > p.y && a.y < p.y + 1.9) {
          this.hurt(a.damage);
          a.life = 0;
        }
        if (a.life > 0 && pointBlocked(a.x, a.y, a.z)) a.life = 0;
      }
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
    }
    this.arrows = this.arrows.filter((a) => { if (a.life > 0) return true; this.scene.remove(a.mesh); return false; });
  }

  /** Clear the field: arrows and bags are forgotten (when the ranger wakes at home). */
  reset() {
    for (const a of this.arrows) this.scene.remove(a.mesh);
    for (const b of this.bags) this.scene.remove(b.mesh);
    this.arrows = []; this.bags = [];
    this.swing = 0; this.drawing = false; this.draw = 0; this.autoShot = null;
  }
}

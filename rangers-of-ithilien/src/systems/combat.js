// The ranger's fighting: sword and bow, arrows in flight (both sides'),
// health, loot bags, and falling in battle.

import * as THREE from 'three';
import { rng } from '../util/noise.js';
import { pointBlocked, trunkAt } from '../world/collision.js';
import { heightAt } from '../world/terrain.js';
import { stats, addItem, describeLoot, enemyLoot, wantedTrophies, quickHeal, calmHeal, useItem, wearOnce, BASE_HEALTH } from './inventory.js';
import { ITEMS } from '../data/items.js';
import { GeoBuilder } from '../world/build.js';

const GRAVITY = 9, SWING = 0.5, FULL_DRAW = 0.8;
/** What an arrow does that finds neither head nor heart: the body, or (aimed low) a limb. */
const ARROW_BODY = 0.75, ARROW_LIMB = 0.6;
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

/** Drawing a bow, f of the way (figure.js turns the archer side-on and sets both arms). */
function drawPose(f) {
  return { bow: Math.max(0, Math.min(1, f)) };
}

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
    this.aim = false;       // aim mode: zoomed, steady, and (on touch) aimed with the thumb pad
    this.god = false;       // testing: the ranger takes no hurt
    this.arrowGeo = new THREE.BoxGeometry(0.035, 0.035, 0.85);
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0x6b5a3a });
    this.bagGeo = new GeoBuilder(12, 0.1).blob(0.3, 0, 0.2, 0, 0x7a5c3a, 1, 0.8, 1).blob(0.12, 0, 0.48, 0, 0x5a4028).geometry();
    this.bagMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.syncWeapon();
  }

  get weapon() { return this.state.weapon; }

  syncWeapon() {
    this.hud.setWeapon(this.state); // what is in hand is decided each frame (handWeapons)
  }

  swap(to) {
    // mid-stroke or with the bow bent, the change waits until the stroke is done
    if (this.swing > 0 || this.drawing) { this.pendingSwap = to ?? (this.state.weapon === 'sword' ? 'bow' : 'sword'); return; }
    this.pendingSwap = null;
    this.state.weapon = to ?? (this.state.weapon === 'sword' ? 'bow' : 'sword');
    this.syncWeapon();
  }

  /** Mend the ranger from the pack: in a fight one remedy, the one that serves; out of one (`calm`), the cheapest food first. */
  heal(calm = false) {
    if (calm && this.state.health < BASE_HEALTH) {
      const eaten = calmHeal(this.state);
      const list = Object.entries(eaten).map(([id, n]) => (n > 1 ? `${n} × ` : '') + ITEMS[id].name.toLowerCase());
      if (list.length) {
        this.hud.toast('', `You eat and drink: ${list.join(', ')}. You feel better.`);
        this.hud.setHealth(this.state.health);
        return;
      }
    }
    const id = quickHeal(this.state);
    if (!id) { this.hud.toast('', this.state.health >= BASE_HEALTH ? 'You are whole already.' : 'Nothing in the pack to mend you.'); return; }
    const got = useItem(this.state, id);
    if (got) this.hud.toast('', `${ITEMS[id].name}: you feel better.`);
    this.hud.setHealth(this.state.health);
  }

  /** Enter or leave aim mode. Taking aim brings the bow to hand. */
  setAim(on) {
    if (on && this.state.arrows <= 0) { this.hud.toast('', 'Your quiver is empty.'); on = false; }
    if (on && this.state.weapon !== 'bow') this.swap('bow');
    this.aim = on && this.state.weapon === 'bow';
    if (!this.aim) { this.drawing = false; this.draw = 0; }
  }

  /** The weapon in hand is used once; say so when it grows dull. */
  wear(slot) {
    const pct = wearOnce(this.state, slot);
    if (pct === null) return;
    const blade = slot === 'sword';
    const what = pct <= 20 ? (blade ? 'Your blade is badly blunted' : 'Your bowstring is fraying')
      : pct <= 50 ? (blade ? 'Your blade is losing its edge' : 'Your bowstring is wearing slack')
      : (blade ? 'Your blade is dulling' : 'Your bowstring is stretching');
    const hurt = blade ? `it cuts at only ${Math.max(10, pct)}% of its strength` : `your arrows strike at only ${Math.max(10, pct)}% of their strength`;
    const mend = this.state.skills?.repair ? (blade ? 'A whetstone will mend it.' : 'A spare string will mend it.') : 'Mablung can put it right, or teach you to.';
    this.hud.toast('', `${what}: ${pct}% sound, and ${hurt}. ${mend}`);
  }

  /** The ranger is struck. */
  hurt(amount) {
    if (this.fallen > 0 || this.god) return;
    this.state.health -= amount * (1 - stats(this.state).defence);
    this.sinceHurt = 0;
    this.hud.flashHurt();
    // A blow spoils the aim: out of aim mode, the arrow let down unloosed, and
    // no aiming or drawing again until the controls have been let go.
    if (this.aim || this.drawing || this.autoShot || this.input?.aimMouse) {
      if (this.drawing || this.aim || this.input?.aimMouse) this.hud.callout('Struck! Your aim is lost.', 'hurt');
      this.aim = false; this.drawing = false; this.draw = 0; this.autoShot = null;
      this.shaken = true;
    }
    if (this.state.health <= 0) {
      this.state.health = 0;
      this.fallen = 2.6;
      this.drawing = false; this.autoShot = null; this.swing = 0; this.aim = false;
      this.state.stats.deaths++;
      this.hud.showFallen(true);
    }
    this.hud.setHealth(this.state.health);
  }

  /** Loose an arrow from `from` so that it arrives at `to`. */
  shoot(from, to, damage, speed, fromPlayer, aimed = false) {
    _d.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const t = Math.max(0.05, _d.length() / speed);
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    this.scene.add(mesh);
    this.arrows.push({
      x: from.x, y: from.y, z: from.z,
      vx: _d.x / t, vy: _d.y / t + 0.5 * GRAVITY * t, vz: _d.z / t, // aim high enough to fall onto the mark
      damage, fromPlayer, aimed, life: 5, mesh,
    });
  }

  dropLoot(e) {
    const loot = enemyLoot(e.type, e.camp.tier, this.rand, !!e.camp.patrol, wantedTrophies(this.state));
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
    this.onLoot?.();
  }

  /** Where the ranger is looking: the first thing the line of sight meets. */
  aimPoint(out) {
    const c = this.camera.position;
    this.camera.getWorldDirection(_d);
    for (let t = Math.max(2, this.rig.dist + 1); t < 90; t += 1.5) {
      out.set(c.x + _d.x * t, c.y + _d.y * t, c.z + _d.z * t);
      if (pointBlocked(out.x, out.y, out.z) || trunkAt(out.x, out.z)) return out;
      const e = this.enemies.nearest(out.x, out.z, 0.9);
      if (e && out.y > e.y - 0.3 && out.y < e.y + 2.3) return out;
    }
    return out;
  }

  /** @param aimed true if the ranger chose the mark (so where it strikes matters) */
  /**
   * What the ranger holds this frame: the bow only while drawing or taking aim
   * (and a moment after loosing), the sword only in a fight. Otherwise the bow is
   * slung and the sword sheathed. Also how far the bow is drawn.
   */
  handWeapons(running) {
    const st = this.state, bowing = this.drawing || this.aim || !!this.autoShot || this.sinceLoose < 0.6;
    const sword = st.weapon === 'sword' && (this.swing > 0 || this.sinceFight < 4 || (this.enemies.inCombat() && !running));
    const bow = st.weapon === 'bow' && bowing;
    const draw = this.autoShot ? Math.min(1, this.autoShot.t / 0.45) : Math.min(1, this.draw / FULL_DRAW);
    return { sword, bow, draw, nocked: st.arrows > 0 && bow && this.sinceLoose > 0.25 };
  }

  loose(target, power, aimed) {
    this.sinceLoose = 0;
    const p = this.player.pos, s = stats(this.state);
    const from = { x: p.x + Math.sin(this.player.yaw) * 0.5, y: p.y + 1.45, z: p.z + Math.cos(this.player.yaw) * 0.5 };
    this.shoot(from, target, s.bow * (0.5 + 0.5 * power), 36 + 26 * power, true, aimed);
    this.state.arrows--;
    this.wear('bow');
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
    this.sinceLoose = (this.sinceLoose ?? 9) + dt;
    this.sinceFight = (this.sinceFight ?? 9) + dt;
    if (this.enemies.inCombat()) this.sinceFight = 0;
    this.noArrowsToast -= dt;
    let slow = false;

    if (this.fallen > 0) {
      this.fallen -= dt;
      if (this.fallen <= 0) { this.hud.showFallen(false); this.onFallen(); }
      attack = false;
    } // (wounds do not mend by themselves: food, draughts, or rest on the mats at Henneth Annûn)

    if (this.shaken) { // knocked out of the aim: wait for the controls to be let go
      if (!attack && !this.input?.aimMouse) this.shaken = false;
      else attack = false;
    }
    if (this.aim && (st.weapon !== 'bow' || st.arrows <= 0 || this.fallen > 0)) this.setAim(false);
    if (touch && this.aim) {
      // Aim mode by touch: the bow bends by itself while you line up the shot with
      // the thumb pad or a drag; Attack looses, and it bends again for the next.
      slow = true;
      this.player.yaw = this.rig.yaw;
      if (this.cooldown <= 0) this.draw = Math.min(FULL_DRAW, this.draw + dt);
      this.drawing = this.draw > 0;
      Object.assign(pose, drawPose(this.draw / FULL_DRAW));
      if (attack && !this.wasAttack && this.draw > 0.25) {
        this.loose(this.aimPoint(_v), Math.min(1, this.draw / FULL_DRAW), true);
        this.draw = 0;
      }
    } else
    // Otherwise on touch there is one attack button: it picks the weapon and the mark for you.
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
      Object.assign(pose, drawPose(Math.min(1, a.t / 0.45) * 0.9));
      if (a.target.dead) this.autoShot = null;
      else if (a.t >= 0.45) {
        this.loose({ x: a.target.x, y: a.target.y + 1.1 * a.target.def.scale, z: a.target.z }, 0.85, false);
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
        if (this.draw > 0.18) this.loose(this.aimPoint(_v), Math.min(1, this.draw / FULL_DRAW), true);
        this.draw = 0;
      }
      if (this.drawing) {
        slow = true;
        this.player.yaw = this.rig.yaw;
        Object.assign(pose, drawPose(this.draw / FULL_DRAW));
      }
    }

    if (this.swing > 0) {
      this.swing -= dt;
      const t = 1 - this.swing / SWING; // 0..1 through the stroke
      pose.armR = t < 0.3 ? -0.4 - (t / 0.3) * 2.4 : -2.8 + Math.min(1, (t - 0.3) / 0.25) * 2.6;
      pose.elbowR = t < 0.3 ? -0.2 - (t / 0.3) * 0.9 : -1.1 + Math.min(1, (t - 0.3) / 0.25) * 1.0;
      this.sinceFight = 0;
      if (!this.struck && t >= 0.42) {
        this.struck = true;
        const fx = Math.sin(this.player.yaw), fz = Math.cos(this.player.yaw), dmg = stats(st).sword;
        let landed = false;
        for (const e of this.enemies.list) {
          if (e.dead) continue;
          const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
          if (d > 2.8 || Math.abs(e.y - p.y) > 2.5) continue;
          if (d > 0.6 && (dx * fx + dz * fz) / d < 0.35) continue; // not in front
          this.enemies.damage(e, dmg * (0.85 + 0.3 * this.rand()), dx / (d || 1), dz / (d || 1));
          landed = true;
        }
        if (landed) this.wear('sword');
      }
      if (this.swing <= 0) this.cooldown = 0.08;
    }
    // just after loosing, the bow arm stays up a moment before the bow goes back over the shoulder
    if (pose.bow === undefined && pose.armL === undefined && st.weapon === 'bow' && this.sinceLoose < 0.6) Object.assign(pose, drawPose(0));
    if (this.pendingSwap && this.swing <= 0 && !this.drawing) {
      this.swap(this.pendingSwap);
    }

    this.wasAttack = attack;
    this.flyArrows(dt);

    // pick up what the fallen dropped
    for (const b of this.bags) {
      b.age += dt;
      if (Math.hypot(b.x - p.x, b.z - p.z) < 1.7 && Math.abs(b.y - p.y) < 2.5 && this.fallen <= 0) { this.give(b.loot); b.age = 1e9; }
    }
    this.bags = this.bags.filter((b) => { if (b.age < 240) return true; this.scene.remove(b.mesh); return false; });

    return { pose, slow, still: touch && this.aim };
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
          const e = this.enemies.nearest(a.x, a.z, 0.55);
          const tall = e ? 1.78 * e.def.scale : 0;
          if (e && a.y > e.y - 0.1 && a.y < e.y + tall + 0.12) {
            // Where it strikes matters, if the ranger chose the mark: the head
            // kills outright, the heart of the body wounds deeply. Anywhere else an
            // arrow only wounds: it takes several to bring one down that way.
            const up = (a.y - e.y) / tall, off = Math.hypot(a.x - e.x, a.z - e.z);
            let dmg = a.damage * ARROW_BODY, mark = '';
            if (a.aimed) {
              if (up > 0.8 && off < 0.32) { const helm = e.type === 'chief' || e.type === 'marshal'; dmg = helm ? a.damage * 3 : 1e6; mark = helm ? 'His helm turns it!' : 'Head!'; }
              else if (up > 0.42 && up <= 0.8 && off < 0.3) { dmg = a.damage * 1.6; mark = 'Heart'; }
              else if (up < 0.42) dmg = a.damage * ARROW_LIMB;
            }
            const n = Math.hypot(a.vx, a.vz) || 1;
            this.enemies.damage(e, dmg, a.vx / n, a.vz / n);
            if (mark) this.hud.hitMark(mark);
            a.life = 0;
          }
        } else if (Math.hypot(a.x - p.x, a.z - p.z) < 0.5 && a.y > p.y && a.y < p.y + 1.9) {
          this.hurt(a.damage);
          a.life = 0;
        }
        if (a.life > 0 && pointBlocked(a.x, a.y, a.z)) a.life = 0;
        // the trunk of a great tree stops an arrow; bushes and saplings do not
        if (a.life > 0 && trunkAt(a.x, a.z) && a.y < heightAt(a.x, a.z) + 13) a.life = 0;
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
    this.swing = 0; this.drawing = false; this.draw = 0; this.autoShot = null; this.aim = false; this.pendingSwap = null;
  }
}

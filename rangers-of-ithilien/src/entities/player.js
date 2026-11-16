// The ranger and the camera that follows them.
// Yaw convention: forward = (sin yaw, 0, cos yaw). North (-Z) is yaw = PI.

import * as THREE from 'three';
import { PLAYER, WORLD } from '../config.js';
import { heightAt, WATER_LEVEL } from '../world/terrain.js';
import { groundAt, terrainAt, blockedBySolid, resolveCircles, pointBlocked } from '../world/collision.js';
import { southRoadZ } from '../world/layout.js';
import { regionWeights } from '../world/regions.js';
import { makeFigure, animateFigure, LOOKS } from './figure.js';

/** Edges of the ranger's charge. Returns a line of text if (x, z) is out of bounds. */
function boundary(x, z) {
  if (z < 60) return 'North lies only the waste before the Black Gate. Your charge is Ithilien.';
  if (z > southRoadZ(x) + 70) return 'Your charge lies north of the road.';
  if (x > 1782) return 'The way into the mountains is barred, and wisely.';
  if (x > WORLD.width - 20 || x < -40) return 'You can go no farther.';
  return null;
}

export class Player {
  constructor(scene) {
    this.figure = makeFigure(LOOKS.ranger);
    this.figure.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.figure);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.vy = 0;
    this.speed = 0;
    this.onGround = true;
    this.onNotice = () => {};
    this.noticeCooldown = 0;
  }

  /** Put the ranger at (x, z). `y` picks the floor at that height; omit it for the topmost surface. */
  place(x, z, yaw = 0, y = 1e4) {
    this.pos.set(x, groundAt(x, z, y + 0.3), z);
    this.yaw = yaw;
    this.vy = 0;
    this.onGround = true;
    this.sync(0, 0);
  }

  canStand(nx, nz) {
    const p = this.pos;
    if (blockedBySolid(nx, nz, p.y, PLAYER.radius)) return false;
    if (heightAt(nx, nz) < WATER_LEVEL - PLAYER.maxWadeDepth) {
      this.notice('The Great River is too deep and swift to cross here.');
      return false;
    }
    const why = boundary(nx, nz);
    if (why) { this.notice(why); return false; }
    // Rising ground: walkable only if we are on the terrain and it is not too steep.
    const h = terrainAt(nx, nz, p.y);
    if (this.onGround && h > p.y + 0.02) {
      const here = terrainAt(p.x, p.z, p.y);
      if (Math.abs(here - p.y) > 0.1) return h <= p.y + PLAYER.stepHeight; // on a built floor: the ground ahead is a wall
      const run = Math.hypot(nx - p.x, nz - p.z);
      if (run > 1e-5 && (h - here) / run > PLAYER.maxSlope) return false;
    }
    return true;
  }

  notice(text) {
    if (this.noticeCooldown > 0) return;
    this.noticeCooldown = 4;
    this.onNotice(text);
  }

  /**
   * @param {{move:{x:number,y:number}, walk:boolean, haste:boolean, jumpHeld:boolean}} input
   * @param {number} camYaw direction the camera faces
   */
  update(dt, time, input, camYaw) {
    const p = this.pos;
    this.noticeCooldown -= dt;
    const mx = input.move.x, my = input.move.y;
    const amount = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    let dx = fx * my - fz * mx, dz = fz * my + fx * mx;
    const len = Math.hypot(dx, dz);

    const running = !input.walk && amount > 0.6;
    let target = amount > 0.05 ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed * Math.max(0.5, amount / 0.6)) : 0;
    if (input.haste) target *= 6;
    this.speed += (target - this.speed) * Math.min(1, dt * 9);

    if (len > 0.05 && this.speed > 0.01) {
      dx /= len; dz /= len;
      // turn to face the way we are going
      let turn = Math.atan2(dx, dz) - this.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.yaw += turn * Math.min(1, dt * 12);
      // move one axis at a time so we slide along walls
      const step = this.speed * dt;
      const nx = p.x + dx * step, nz = p.z + dz * step;
      if (this.canStand(nx, p.z)) p.x = nx;
      if (this.canStand(p.x, nz)) p.z = nz;
      resolveCircles(p, PLAYER.radius);
    }

    const ground = groundAt(p.x, p.z, p.y);
    if (this.onGround) {
      if (input.jumpHeld) {
        this.vy = PLAYER.jumpSpeed;
        this.onGround = false;
      } else if (ground < p.y - PLAYER.stepHeight * 1.5) {
        this.onGround = false; // walked off an edge
        this.vy = 0;
      } else {
        p.y = ground;
      }
    }
    if (!this.onGround) {
      this.vy -= PLAYER.gravity * dt;
      p.y += this.vy * dt;
      if (p.y <= ground && this.vy <= 0) { p.y = ground; this.vy = 0; this.onGround = true; }
    }
    this.sync(dt, time);
  }

  sync(dt, time) {
    this.figure.position.copy(this.pos);
    this.figure.rotation.y = this.yaw;
    animateFigure(this.figure, this.onGround ? this.speed : 0, dt, time);
  }
}

const _dir = new THREE.Vector3(), _target = new THREE.Vector3(), _look = { x: 0, y: 0, zoom: 0 }, _w = {};

/** Third-person camera on a boom that shortens when something is in the way. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = -0.18;      // positive looks up
    this.wantDist = 6;
    this.dist = 6;
  }

  update(dt, input, player) {
    input.consumeLook(_look);
    const sens = 0.0026;
    this.yaw -= _look.x * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - _look.y * sens, -1.25, 1.2);
    if (_look.zoom > 0) this.wantDist = this.wantDist < 1 ? 2 : Math.min(16, this.wantDist * (1 + 0.12 * _look.zoom));
    else if (_look.zoom < 0) {
      this.wantDist *= Math.max(0.3, 1 + 0.12 * _look.zoom);
      if (this.wantDist < 1.5) this.wantDist = 0; // all the way in: first person
    }
    // On touch, steering sideways swings the camera round so one thumb can explore.
    if (input.touch && input.lookPointers.size === 0) this.yaw -= input.move.x * dt * 1.3;

    const cp = Math.cos(this.pitch);
    _dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    _target.copy(player.pos);
    _target.y += 1.62;

    // March outward from the head until something blocks the view.
    let free = this.wantDist;
    for (let d = 0.4; d <= this.wantDist + 0.3; d += 0.3) {
      if (pointBlocked(_target.x - _dir.x * d, _target.y - _dir.y * d, _target.z - _dir.z * d)) { free = Math.max(0, d - 0.45); break; }
    }
    this.dist = free < this.dist ? free : this.dist + (free - this.dist) * Math.min(1, dt * 4);

    // Among the tall heather the camera rides up over the bushes rather than
    // pushing through them.
    regionWeights(player.pos.x, player.pos.z, _w);
    this.lift = (this.lift ?? 0) + (_w.foothill * 3.2 - (this.lift ?? 0)) * Math.min(1, dt * 2);

    const firstPerson = this.dist < 0.8;
    player.figure.visible = !firstPerson;
    const d = firstPerson ? -0.15 : this.dist;
    this.camera.position.set(_target.x - _dir.x * d, _target.y - _dir.y * d, _target.z - _dir.z * d);
    const c = this.camera.position;
    if (firstPerson) {
      this.camera.lookAt(c.x + _dir.x, c.y + _dir.y, c.z + _dir.z);
    } else {
      c.y += this.lift * Math.min(1, this.dist / 4);
      this.camera.lookAt(_target); // the ranger's head: the same as looking along the boom when there is no lift
    }
  }

  /** Compass bearing in degrees, clockwise from north. */
  bearing() {
    const deg = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(this.yaw), -Math.cos(this.yaw)));
    return (deg + 360) % 360;
  }
}

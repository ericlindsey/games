// Drifting motes of pollen and light under the trees: a little of the
// "dishevelled dryad loveliness". A fixed cloud of points that wraps around
// the camera, so it costs the same everywhere.

import * as THREE from 'three';
import { rng } from '../util/noise.js';

const BOX = 44, HEIGHT = 16;

export class Motes {
  constructor(scene, count) {
    const rand = rng(404);
    this.count = count;
    this.seed = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) this.seed[i] = rand();
    this.pos = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,250,210,0.55)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    this.material = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c), size: 0.28, color: 0xfff2b0, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);
  }

  /** @param {number} amount 0..1: how many motes hang in the air here */
  update(time, camera, groundY, amount) {
    this.material.opacity += (0.2 + 0.7 * amount - this.material.opacity) * 0.03;
    const wrap = (v, centre) => centre + ((((v - centre) % BOX) + BOX * 1.5) % BOX) - BOX / 2;
    const s = this.seed, p = this.pos, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      const x = s[o] * BOX + Math.sin(time * 0.21 + s[o + 3] * 30) * 1.6 + time * 0.12;
      const z = s[o + 1] * BOX + Math.cos(time * 0.17 + s[o + 3] * 50) * 1.6;
      p[i * 3] = wrap(x, cx);
      p[i * 3 + 1] = groundY + 0.4 + ((s[o + 2] * HEIGHT + time * (0.05 + s[o + 3] * 0.12)) % HEIGHT);
      p[i * 3 + 2] = wrap(z, cz);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

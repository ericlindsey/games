// The Anduin and the streams that feed it.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { makeNoiseTexture } from './build.js';
import { WATER_LEVEL, STREAMS, POOLS, inPool, heightAt } from './terrain.js';

export const STREAM_DEPTH = 0.45;
const HALF_WIDTH = 2.6;

export class Water {
  constructor(scene) {
    this.ripples = makeNoiseTexture(128, 5, false);
    this.streaks = makeNoiseTexture(128, 9, true);

    // The Great River: one broad sheet at water level; land hides the rest.
    const b = WORLD.backdrop, maxX = 640;
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(maxX - b.minX, b.maxZ - b.minZ),
      new THREE.MeshLambertMaterial({ color: 0x5c8e9c, map: this.ripples, transparent: true, opacity: 0.84 }),
    );
    this.riverTex = makeNoiseTexture(128, 6, false);
    this.riverTex.repeat.set((maxX - b.minX) / 60, (b.maxZ - b.minZ) / 60);
    river.material.map = this.riverTex;
    river.rotation.x = -Math.PI / 2;
    river.position.set((maxX + b.minX) / 2, WATER_LEVEL, (b.maxZ + b.minZ) / 2);
    scene.add(river);

    // Streams: ribbons that follow the gullies cut by the terrain function.
    this.streamMaterial = new THREE.MeshLambertMaterial({
      color: 0x8cc4d2, map: this.streaks, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide,
    });
    for (const st of STREAMS) {
      const pts = [];
      let level = Infinity;
      const flush = () => { if (pts.length > 3) scene.add(this.ribbon(pts)); pts.length = 0; };
      let prev = null, prevIn = false;
      for (const p of st.points) {
        // Lie on the bed; where another stream's deeper valley has taken the
        // ground lower still (near a meeting), follow the ground. Never rise.
        level = Math.min(level, p.bed, st.home === 'cut' ? Infinity : heightAt(p.x, p.z));
        if (level + STREAM_DEPTH < WATER_LEVEL + 0.08) break; // it has reached the Great River
        const isIn = inPool(p.x, p.z);
        if (prev && isIn !== prevIn) {
          // Crossing a pool's edge: end (or begin) the stream just inside it, so
          // the two waters meet without the stream lying across the pool.
          let a = prev, b = p;
          for (let k = 0; k < 12; k++) {
            const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
            if (inPool(m.x, m.z) === prevIn) a = m; else b = m;
          }
          pts.push(b.x, level + STREAM_DEPTH, b.z);
          if (isIn) flush();
        }
        if (!isIn) pts.push(p.x, level + STREAM_DEPTH, p.z);
        prev = p; prevIn = isIn;
      }
      flush();
    }

    // The pools where streams rest in a hollow.
    const poolMaterial = new THREE.MeshLambertMaterial({ color: 0x6fa7b4, map: this.ripples, transparent: true, opacity: 0.82, depthWrite: false });
    for (const p of POOLS) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r + 1.9, 28), poolMaterial);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, p.bed + STREAM_DEPTH, p.z);
      m.renderOrder = 1;
      scene.add(m);
    }
  }

  /** A flat ribbon along a list of [x, y, z] centre points, running downstream. */
  ribbon(pts, halfWidth = HALF_WIDTH) {
    const n = pts.length / 3;
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      if (i > 0) dist += Math.hypot(x - pts[i * 3 - 3], z - pts[i * 3 - 1]);
      // across the stream: square to the line between the neighbouring points
      const a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
      let tx = pts[b] - pts[a], tz = pts[b + 2] - pts[a + 2];
      const t = Math.hypot(tx, tz) || 1;
      tx /= t; tz /= t;
      pos.set([x - tz * halfWidth, y, z + tx * halfWidth, x + tz * halfWidth, y, z - tx * halfWidth], i * 6);
      uv.set([0, dist / 10, 1, dist / 10], i * 4);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.streamMaterial);
    mesh.renderOrder = 2;
    return mesh;
  }

  update(time) {
    this.riverTex.offset.set(Math.sin(time * 0.05) * 0.2, time * 0.012);
    this.streaks.offset.y = -time * 0.22; // v grows downstream, so a falling offset carries the pattern down with it
  }
}

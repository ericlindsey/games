// The Anduin and the streams that feed it.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { makeNoiseTexture } from './build.js';
import { heightAt, WATER_LEVEL } from './terrain.js';
import { HA, bankX, streamZ, STREAM_COUNT, STREAM_END_X } from './layout.js';

export const STREAM_DEPTH = 0.45;
const HALF_WIDTH = 2.6;

export class Water {
  constructor(scene) {
    this.ripples = makeNoiseTexture(128, 5, false);
    this.streaks = makeNoiseTexture(128, 9, true);

    // The Great River: one broad sheet at water level; land hides the rest.
    const b = WORLD.backdrop, maxX = 1000;
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
    for (let i = 0; i < STREAM_COUNT; i++) {
      const isHome = Math.abs(streamZ(i, HA.x) - HA.z) < 1;
      let run = [];
      const flush = () => { if (run.length > 1) scene.add(this.ribbon(run)); run = []; };
      for (let x = STREAM_END_X - 150; ; x -= 5) {
        const z = streamZ(i, x);
        if (x < bankX(z) - 6) break;
        // The home stream is drawn by hand where it crosses the falls.
        if (isHome && x > HA.outcrop.minX - 4 && x < HA.outcrop.maxX + 4) { flush(); continue; }
        const y = heightAt(x, z) + STREAM_DEPTH;
        if (y < WATER_LEVEL + 0.05) break;
        run.push(x, y, z);
      }
      flush();
    }
  }

  /** A flat ribbon along a list of [x, y, z] centre points (flowing in -x). */
  ribbon(pts, halfWidth = HALF_WIDTH) {
    const n = pts.length / 3;
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      if (i > 0) dist += Math.hypot(x - pts[i * 3 - 3], z - pts[i * 3 - 1]);
      pos.set([x, y, z - halfWidth, x, y, z + halfWidth], i * 6);
      uv.set([0, dist / 10, 1, dist / 10], i * 4);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
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
    this.streaks.offset.y = time * 0.22;
  }
}

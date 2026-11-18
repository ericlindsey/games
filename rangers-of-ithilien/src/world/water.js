// The Anduin and the streams that feed it.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { makeNoiseTexture } from './build.js';
import { surfaceUniforms } from './surface.js';
import { WATER_LEVEL, STREAMS, POOLS, inPool, heightAt } from './terrain.js';

export const STREAM_DEPTH = 0.45;
const nearPool = (x, z) => POOLS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 4);
const HALF_WIDTH = 2.6;

/** A tileable normal map of small waves, from a sum of periodic noises. */
function waveNormals(size = 256) {
  const h = new Float32Array(size * size);
  const hash = (x, y, s) => { let t = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177); t = Math.imul(t ^ (t >>> 13), 1103515245); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
  const noise = (u, v, p, s) => {
    const x = u * p, y = v * p, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix % p, iy % p, s), b = hash((ix + 1) % p, iy % p, s), c = hash(ix % p, (iy + 1) % p, s), d = hash((ix + 1) % p, (iy + 1) % p, s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    h[y * size + x] = noise(u, v, 6, 1) * 0.5 + noise(u, v, 12, 2) * 0.3 + noise(u, v, 24, 3) * 0.2;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x + size - 1) % size)], r = h[y * size + ((x + 1) % size)];
    const dn = h[((y + size - 1) % size) * size + x], up = h[((y + 1) % size) * size + x];
    let nx = (l - r) * 6, ny = (dn - up) * 6, nz = 1;
    const k = 1 / Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4;
    data[i] = (nx * k * 0.5 + 0.5) * 255; data[i + 1] = (ny * k * 0.5 + 0.5) * 255; data[i + 2] = (nz * k * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Water that catches the light: small waves (a moving normal map), a glint of
 * the low sun, and the sky's pale colour where it is seen at a slant.
 */
export function waterMaterial(color, normals, repeat, opacity, o = {}) {
  const map = normals.clone();
  map.repeat.set(repeat[0], repeat[1]);
  map.needsUpdate = true;
  const m = new THREE.MeshPhongMaterial({
    color, specular: 0xfff2d8, shininess: o.shininess ?? 90, normalMap: map, normalScale: new THREE.Vector2(o.wave ?? 0.6, o.wave ?? 0.6),
    transparent: true, opacity, depthWrite: false, side: o.side ?? THREE.FrontSide, map: o.map ?? null,
  });
  const sky = surfaceUniforms.uSkyColor;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSkyColor = sky;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkyColor;')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
        outgoingLight = mix(outgoingLight, uSkyColor, fres * 0.55);
        diffuseColor.a = mix(diffuseColor.a, 1.0, fres * 0.8);
        #include <opaque_fragment>`);
  };
  m.userData.waves = map;
  return m;
}

export class Water {
  constructor(scene) {
    this.normals = waveNormals();
    this.ripples = makeNoiseTexture(128, 5, false);
    this.streaks = makeNoiseTexture(128, 9, true);

    // The Great River: one broad sheet at water level; land hides the rest.
    const b = WORLD.backdrop, maxX = 640;
    this.riverTex = makeNoiseTexture(128, 6, false);
    this.riverTex.repeat.set((maxX - b.minX) / 60, (b.maxZ - b.minZ) / 60);
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(maxX - b.minX, b.maxZ - b.minZ),
      waterMaterial(0x4f8696, this.normals, [(maxX - b.minX) / 14, (b.maxZ - b.minZ) / 14], 0.88, { map: this.riverTex, wave: 0.5 }),
    );
    this.riverMat = river.material;
    river.rotation.x = -Math.PI / 2;
    river.position.set((maxX + b.minX) / 2, WATER_LEVEL, (b.maxZ + b.minZ) / 2);
    scene.add(river);

    // Streams: ribbons that follow the gullies cut by the terrain function.
    this.streamMaterial = waterMaterial(0x7fb4c2, this.normals, [0.6, 0.3], 0.74, { map: this.streaks, side: THREE.DoubleSide, wave: 0.8 });
    for (const st of STREAMS) {
      const pts = [];
      let level = Infinity;
      const flush = () => { if (pts.length > 3) scene.add(this.ribbon(pts)); pts.length = 0; };
      let prev = null, prevIn = false;
      for (const p of st.points) {
        // Lie on the bed; where another stream's deeper valley has taken the
        // ground lower still (near a meeting), follow the ground. Never rise.
        // A pool's bowl is deeper than its bed on purpose: do not sink into it.
        level = Math.min(level, p.bed, st.home === 'cut' || nearPool(p.x, p.z) ? Infinity : heightAt(p.x, p.z));
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
    const poolMaterial = waterMaterial(0x5f97a6, this.normals, [3, 3], 0.82, { map: this.ripples, wave: 0.4 });
    this.poolMaterial = poolMaterial;
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
    this.riverMat.userData.waves.offset.set(time * 0.004, time * 0.011);
    this.streamMaterial.userData.waves.offset.set(Math.sin(time * 0.3) * 0.02, -time * 0.35);
    this.poolMaterial.userData.waves.offset.set(time * 0.01, time * 0.007);
    this.riverTex.offset.set(Math.sin(time * 0.05) * 0.2, time * 0.012);
    this.streaks.offset.y = -time * 0.22; // v grows downstream, so a falling offset carries the pattern down with it
  }
}

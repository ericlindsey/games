// Draws the ground: detailed chunks near the player (with their plants) over a
// coarse backdrop of the whole land. The backdrop is cut away where chunks exist.

import * as THREE from 'three';
import { WORLD, CHUNK } from '../config.js';
import { heightAt } from './terrain.js';
import { groundColor, canopyColor } from './groundColor.js';
import { forestDensity } from './regions.js';
import { buildVegetation } from './vegetation.js';
import { setChunkCircles, removeChunkCircles } from './collision.js';

const rgb = [0, 0, 0], rgb2 = [0, 0, 0];
const _c = new THREE.Color();

/** A height-field grid mesh. `sample(x, z)` gives height; `paint` gives colour. */
function gridGeometry(x0, z0, nx, nz, step, sample, paint) {
  const W = nx + 3, H = nz + 3; // one extra ring of samples for normals
  const hs = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) hs[j * W + i] = sample(x0 + (i - 1) * step, z0 + (j - 1) * step);
  }
  const count = (nx + 1) * (nz + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let k = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const a = (j + 1) * W + (i + 1);
      const h = hs[a];
      const gx = (hs[a + 1] - hs[a - 1]) / (2 * step), gz = (hs[a + W] - hs[a - W]) / (2 * step);
      const x = x0 + i * step, z = z0 + j * step;
      const inv = 1 / Math.hypot(gx, 1, gz);
      pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      nor[k] = -gx * inv; nor[k + 1] = inv; nor[k + 2] = -gz * inv;
      paint(x, z, h, Math.hypot(gx, gz), rgb);
      _c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
      col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
      k += 3;
    }
  }
  const idx = new (count > 65535 ? Uint32Array : Uint16Array)(nx * nz * 6);
  k = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function paintGround(x, z, h, slope, out) { groundColor(x, z, h, slope, out); }

function paintBackdrop(x, z, h, slope, out) {
  groundColor(x, z, h, slope, out);
  const d = backdropForest(x, z, h);
  if (d > 0) {
    canopyColor(x, z, rgb2);
    const t = Math.min(1, d * 1.5);
    out[0] += (rgb2[0] - out[0]) * t; out[1] += (rgb2[1] - out[1]) * t; out[2] += (rgb2[2] - out[2]) * t;
  }
}
function backdropForest(x, z, h) {
  return h > 1.5 && h < 230 && x > 0 ? forestDensity(x, z) : 0;
}

export class Ground {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.chunks = new Map();
    this.hole = new THREE.Vector3(0, 0, 0); // x, z, radius
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });

    // Backdrop: the whole land, coarse. Forest is suggested by colour and a lift.
    const b = WORLD.backdrop, step = 32;
    const geo = gridGeometry(b.minX, b.minZ, (b.maxX - b.minX) / step, (b.maxZ - b.minZ) / step, step,
      (x, z) => { const h = heightAt(x, z); return h + backdropForest(x, z, h) * 7 - 1.5; }, paintBackdrop);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const hole = this.hole;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHole = { value: hole };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;\nuniform vec3 uHole;')
        .replace('void main() {', 'void main() {\nif (distance(vXZ, uHole.xy) < uHole.z) discard;');
    };
    this.backdrop = new THREE.Mesh(geo, mat);
    this.backdrop.receiveShadow = false;
    scene.add(this.backdrop);
  }

  setQuality(quality) {
    this.quality = quality;
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
  }

  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const size = CHUNK.size, n = CHUNK.segments;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(gridGeometry(cx * size, cz * size, n, n, size / n, heightAt, paintGround), this.material);
    mesh.receiveShadow = true;
    group.add(mesh);
    const veg = buildVegetation(cx, cz, this.quality);
    for (const m of veg.meshes) group.add(m);
    setChunkCircles(key, veg.circles);
    this.scene.add(group);
    this.chunks.set(key, { group, cx, cz });
  }

  dropChunk(key) {
    const ch = this.chunks.get(key);
    if (!ch) return;
    this.scene.remove(ch.group);
    ch.group.children[0].geometry.dispose();
    for (const m of ch.group.children) if (m.isInstancedMesh) m.dispose();
    removeChunkCircles(key);
    this.chunks.delete(key);
  }

  /** Chunks wanted around a point, nearest first. */
  wanted(px, pz) {
    const size = CHUNK.size, R = this.quality.loadRadius;
    const out = [];
    const c0x = Math.floor((px - R) / size), c1x = Math.floor((px + R) / size);
    const c0z = Math.floor((pz - R) / size), c1z = Math.floor((pz + R) / size);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        // distance from the point to the chunk's rectangle
        const dx = Math.max(cx * size - px, 0, px - (cx + 1) * size);
        const dz = Math.max(cz * size - pz, 0, pz - (cz + 1) * size);
        const d = Math.hypot(dx, dz);
        if (d < R) out.push({ cx, cz, d });
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }

  /**
   * Keep chunks loaded around the player.
   * @param {number} budget how many chunks may be built this call
   * @returns {number} chunks still waiting to be built
   */
  update(px, pz, budget = 1) {
    const want = this.wanted(px, pz);
    let missing = 0, holeR = this.quality.loadRadius;
    for (const wnt of want) {
      const key = wnt.cx + ',' + wnt.cz;
      if (this.chunks.has(key)) continue;
      if (budget > 0) { this.buildChunk(wnt.cx, wnt.cz); budget--; continue; }
      missing++;
      holeR = Math.min(holeR, wnt.d);
    }
    const dropR = this.quality.loadRadius + CHUNK.size * 1.5;
    for (const [key, ch] of this.chunks) {
      const dx = (ch.cx + 0.5) * CHUNK.size - px, dz = (ch.cz + 0.5) * CHUNK.size - pz;
      if (Math.hypot(dx, dz) > dropR + CHUNK.size) this.dropChunk(key);
    }
    this.hole.set(px, pz, Math.max(0, holeR - 6));
    return missing;
  }
}

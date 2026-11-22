// Draws the ground: detailed chunks near the player (with their plants) over a
// coarse backdrop of the whole land. The backdrop is cut away where chunks exist.

import * as THREE from 'three';
import { WORLD, CHUNK } from '../config.js';
import { heightAt } from './terrain.js';
import { groundColor, canopyColor } from './groundColor.js';
import { forestDensity } from './forest.js';
import { regionWeights } from './regions.js';
const _w = {};
import { HA } from './layout.js';
import { noise2 } from '../util/noise.js';
import { vegetationSteps, VegetationField } from './vegetation.js';
import { finish } from '../util/slice.js';
import { setChunkCircles, removeChunkCircles } from './collision.js';
import { surfaceMaterial, SURF, surfaceSettings, surfaceUniforms } from './surface.js';
import { materials } from './build.js';

const rgb = [0, 0, 0], rgb2 = [0, 0, 0];
const _c = new THREE.Color();

/** A height-field grid mesh. `sample(x, z)` gives height; `paint` gives colour. */
const gridGeometry = (...a) => finish(gridSteps(...a));

/** The same, yielding after each row, so a chunk's ground can be laid over a few frames. */
function* gridSteps(x0, z0, nx, nz, step, sample, paint, skip) {
  const W = nx + 3, H = nz + 3; // one extra ring of samples for normals
  const hs = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) hs[j * W + i] = sample(x0 + (i - 1) * step, z0 + (j - 1) * step);
    yield;
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
    yield;
  }
  const idx = new (count > 65535 ? Uint32Array : Uint16Array)(nx * nz * 6);
  k = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (skip && skip(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step)) continue;
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(k < idx.length ? idx.slice(0, k) : idx, 1));
  return g;
}

function paintGround(x, z, h, slope, out) { groundColor(x, z, h, slope, out); }

// The cliff behind the fall at Henneth Annûn is built by hand, so the terrain
// leaves a slot for it.
// So is the stair's hole in the forest floor above the cave.
function inRockSlot(x, z) {
  const h = HA.hatch;
  if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) return true;
  return x > HA.x && x < HA.x + 4 && z > HA.rock.minZ && z < HA.rock.maxZ;
}

/**
 * Turf over the top of the cliff at Henneth Annûn, where the ground leaves its
 * slot: the same grid, heights, colours and material as the ground beside it,
 * so no seam shows, with a lip of earth turned down over the edge of the rock.
 * (The ground function itself drops to the pool at HA.x, so it is sampled just
 * east of that.) Covers x0..x1, z0..z1 (on the chunk's grid) inside the slot.
 */
function cliffCap(x0, z0, x1, z1, step) {
  const sample = (x, z) => heightAt(Math.max(x, HA.x + 0.01), z);
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
  const cap = gridGeometry(x0, z0, nx, nz, step, sample, paintGround);
  if (x0 > HA.x + 0.01) return [cap];
  const pos = [], nor = [], col = [], idx = [];
  for (let j = 0; j <= nz; j++) {
    const z = z0 + j * step, h = sample(HA.x, z);
    paintGround(HA.x, z, h, 0, rgb);
    _c.setRGB(rgb[0] * 0.5, rgb[1] * 0.45, rgb[2] * 0.4, THREE.SRGBColorSpace);
    pos.push(HA.x, h + 0.02, z, HA.x - 0.05, h - 0.5, z);
    nor.push(-0.6, 0.8, 0, -1, 0, 0);
    col.push(_c.r * 1.4, _c.g * 1.4, _c.b * 1.4, _c.r, _c.g, _c.b);
    if (j > 0) { const k = (j - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const lip = new THREE.BufferGeometry();
  lip.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lip.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  lip.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  lip.setIndex(idx);
  return [cap, lip];
}

function farForest(x, z, h) {
  return h > 1.5 && h < 150 && x > 0 ? forestDensity(x, z) : 0;
}
function paintFarGround(x, z, h, slope, out) {
  groundColor(x, z, h, slope, out);
  const k = 1 - 0.35 * farForest(x, z, h); // shade under distant trees
  out[0] *= k; out[1] *= k; out[2] *= k;
}
function paintCanopy(x, z, h, slope, out) {
  canopyColor(x, z, out);
}
/** Height of the far forest's roof, or well below ground where there is none. */
function canopyHeight(x, z) {
  const h = heightAt(x, z);
  const d = farForest(x, z, h);
  if (d < 0.25) return h - 12;
  regionWeights(x, z, _w);
  return h + 14 + d * 12 + _w.south * 12 + noise2(x / 45, z / 45, 77) * 5; // the old forest of the south stands higher
}

export class Ground {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.chunks = new Map();
    this.hole = new THREE.Vector3(0, 0, 0); // x, z, radius
    this.material = surfaceMaterial({ kind: SURF.ground });
    this.field = new VegetationField(scene, quality); // every plant in the loaded chunks
    // herbs and small stones shrink away toward the edge of where they are shown
    for (const m of [materials.herb, materials.rockCover]) m.userData.surf.uFade.value.set(quality.coverFar * 0.68, quality.coverFar - 1);

    // Backdrop: the whole land, coarse, with the roof of the far forest above it.
    const b = WORLD.backdrop, step = 32;
    const nx = (b.maxX - b.minX) / step, nz = (b.maxZ - b.minZ) / step;
    const hole = this.hole;
    const cutHole = (mat) => {
      const before = mat.onBeforeCompile;
      mat.customProgramCacheKey = () => 'surf-hole' + (surfaceSettings.lite ? '-lite' : '');
      mat.onBeforeCompile = (shader, r) => {
        before.call(mat, shader, r);
        shader.uniforms.uHole = { value: hole };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvXZ = (modelMatrix * vec4(position, 1.0)).xz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;\nuniform vec3 uHole;')
          .replace('void main() {', 'void main() {\nif (distance(vXZ, uHole.xy) < uHole.z) discard;');
      };
      return mat;
    };
    this.backdrop = new THREE.Mesh(
      gridGeometry(b.minX, b.minZ, nx, nz, step, (x, z) => heightAt(x, z) - 1.5, paintFarGround),
      cutHole(surfaceMaterial({ kind: SURF.ground })),
    );
    this.canopy = new THREE.Mesh(
      gridGeometry(0, 0, WORLD.width / 20, WORLD.length / 20, 20, canopyHeight, paintCanopy),
      cutHole(surfaceMaterial({ kind: SURF.leaf, side: THREE.DoubleSide })),
    );
    scene.add(this.backdrop, this.canopy);
  }

  setQuality(quality) {
    this.quality = quality;
    this.field.setQuality(quality);
    this.job = null;
    for (const key of [...this.chunks.keys()]) this.dropChunk(key);
  }

  /** Build one chunk now: its ground and its plants. */
  buildChunk(cx, cz) {
    if (this.job?.cx === cx && this.job?.cz === cz) this.job = null;
    this.commit(cx, cz, finish(this.chunkSteps(cx, cz)));
  }

  /** The slow part of building a chunk (laying the ground, placing the plants), a row at a time. */
  *chunkSteps(cx, cz) {
    const size = CHUNK.size, n = this.quality.terrainSegments ?? CHUNK.segments;
    const geos = [yield* gridSteps(cx * size, cz * size, n, n, size / n, heightAt, paintGround, inRockSlot)];
    { // turf over the cliff's slot, where it falls in this chunk
      const step = size / n, x0 = Math.max(cx * size, HA.x), x1 = Math.min((cx + 1) * size, HA.x + 4);
      const z0 = Math.max(cz * size, HA.rock.minZ), z1 = Math.min((cz + 1) * size, HA.rock.maxZ);
      if (x1 > x0 && z1 > z0) geos.push(...cliffCap(Math.floor(x0 / step) * step, Math.floor(z0 / step) * step, Math.ceil(x1 / step) * step, Math.ceil(z1 / step) * step, step));
    }
    const veg = yield* vegetationSteps(cx, cz, this.quality);
    return { geos, veg };
  }

  /** Put a built chunk in the world. */
  commit(cx, cz, { geos, veg }) {
    const key = cx + ',' + cz;
    const group = new THREE.Group();
    for (const geo of geos) {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.field.add(key, veg.groups);
    setChunkCircles(key, veg.circles);
    this.scene.add(group);
    this.chunks.set(key, { group, cx, cz, veg: veg.groups });
  }

  dropChunk(key) {
    const ch = this.chunks.get(key);
    if (!ch) return;
    this.scene.remove(ch.group);
    for (const m of ch.group.children) m.geometry.dispose();
    this.field.remove(key);
    removeChunkCircles(key);
    this.chunks.delete(key);
  }

  /** Build again the chunks over a rectangle, so their plants are placed again (a field has been cleared there). */
  refresh(r, margin = 6) {
    const size = CHUNK.size;
    this.job = null; // (a chunk half built may have been placed before the change)
    for (const [key, ch] of [...this.chunks]) {
      if (ch.cx * size < r.maxX + margin && (ch.cx + 1) * size > r.minX - margin && ch.cz * size < r.maxZ + margin && (ch.cz + 1) * size > r.minZ - margin) {
        this.dropChunk(key);
        this.buildChunk(ch.cx, ch.cz); // at once, so no hole shows
      }
    }
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
   * @param {number} budget how many chunks may be built whole this call (while loading)
   * @param {number} ms else how long may be spent this call on building the nearest, a piece a frame
   * @returns {number} chunks still waiting to be built
   */
  update(px, pz, budget = 1, ms = 0) {
    surfaceUniforms.uLodFrom.value.set(px, pz); // plants fade between forms by distance from here
    const want = this.wanted(px, pz);
    let missing = 0, holeR = this.quality.loadRadius;
    const waiting = [];
    for (const wnt of want) {
      const key = wnt.cx + ',' + wnt.cz;
      if (this.chunks.has(key)) continue;
      if (budget > 0) { this.buildChunk(wnt.cx, wnt.cz); budget--; continue; }
      waiting.push(wnt);
      missing++;
      holeR = Math.min(holeR, wnt.d);
    }
    if (ms > 0 && waiting.length) missing -= this.work(waiting, ms);
    // every few metres walked (or a turn of the camera), each plant in view takes the form its distance calls for
    if (this.field.update(px, pz)) this.lodAt = this.field.at;
    const dropR = this.quality.loadRadius + CHUNK.size * 1.5;
    for (const [key, ch] of this.chunks) {
      const dx = (ch.cx + 0.5) * CHUNK.size - px, dz = (ch.cz + 0.5) * CHUNK.size - pz;
      if (Math.hypot(dx, dz) > dropR + CHUNK.size) this.dropChunk(key);
    }
    this.hole.set(px, pz, Math.max(0, holeR - 6));
    return missing;
  }

  /**
   * Go on building the chunk begun (or the nearest waiting) for about `ms`, and
   * longer when the nearest gap is well inside the range drawn. The work is cut
   * so fine (a row of ground or of plants at a time) that no frame stalls.
   * @returns {number} chunks finished
   */
  work(waiting, ms) {
    const job = this.job;
    if (job && !waiting.some((w) => w.cx === job.cx && w.cz === job.cz)) this.job = null; // walked out of range
    const end = performance.now() + (waiting[0].d < this.quality.loadRadius * 0.6 ? 3 * ms : ms);
    let done = 0, next = 0;
    do {
      if (!this.job) {
        while (next < waiting.length && this.chunks.has(waiting[next].cx + ',' + waiting[next].cz)) next++;
        if (next >= waiting.length) break;
        const { cx, cz } = waiting[next++];
        this.job = { cx, cz, steps: this.chunkSteps(cx, cz) };
      }
      const r = this.job.steps.next();
      if (r.done) { this.commit(this.job.cx, this.job.cz, r.value); this.job = null; done++; }
    } while (performance.now() < end);
    return done;
  }
}

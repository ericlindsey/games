// Surfaces: small procedural textures, and the one material family that draws
// almost everything in the world. Geometry is still coloured by vertex colours;
// these materials add the grain of the thing on top: bark, leaves, stone, the
// courses of old masonry, the turf. Detail is projected in world space from
// three sides (triplanar), so nothing built in code needs texture coordinates.
//
// Each vertex carries a `surf` kind (see SURF); a material has a default kind
// for geometry without one. Leaf cards use real texture coordinates into a
// small atlas of leaf clusters, cut out with an alpha test.

import * as THREE from 'three';
import { EPHEL } from './layout.js';

/** Surface kinds, written per vertex by GeoBuilder (`b.kind = SURF.bark`). */
export const SURF = {
  auto: 0,     // the material's default
  plain: 1,    // a faint grain
  bark: 2,
  leaf: 3,     // the solid mass of a canopy
  card: 4,     // a cut-out card of leaves (uses the atlas)
  rock: 5,
  masonry: 6,
  wood: 7,     // worked timber
  cloth: 8,
  ground: 9,   // the terrain
  skin: 10,
  metal: 11,
  cave: 12,    // rock under cover: no moss
  drystone: 13, // field stone laid without mortar: the old field walls (its own texture, uStones)
};

// Regions of the leaf atlas (u from, u to). The last quarter is solid white:
// geometry that is not a card samples it, so one material serves both.
export const ATLAS = { broad: [0, 0.25], needle: [0.25, 0.5], ivy: [0.5, 0.75], solid: [0.75, 1] };
export const SOLID_UV = [0.875, 0.5];

// ---------------------------------------------------------------------------
// Texture generation (tileable value noise on a periodic lattice).

function makeHash(seed) {
  return (x, y) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h ^= h >>> 16;
    return ((Math.imul(h, 2246822519) ^ (h >>> 13)) >>> 0) / 4294967296;
  };
}
/** Periodic value noise in [-1, 1]; px, py lattice cells across the tile. */
function tileNoise(u, v, px, py, hash) {
  const x = u * px, y = v * py;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1), d = hash(x1, y1);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}
function tileFbm(u, v, px, py, oct, hash, gain = 0.5) {
  let s = 0, a = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += tileNoise(u, v, px, py, hash) * a; n += a; px *= 2; py *= 2; a *= gain; }
  return s / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * One RGBA detail texture, each channel a different material's grain:
 * R rock, G leaves and turf, B bark (streaked along v), A masonry courses.
 */
function makeDetailTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  const h1 = makeHash(11), h2 = makeHash(23), h3 = makeHash(37), h4 = makeHash(41), h5 = makeHash(53), h6 = makeHash(67);
  // Masonry: 8 courses; each course cut into blocks at its own joints.
  const rows = 8, rowJoints = [];
  const rr = makeHash(91);
  for (let r = 0; r < rows; r++) {
    const joints = [];
    let u = rr(r, 0) * 0.3;
    while (u < 1) { joints.push(u); u += 0.16 + rr(r, joints.length + 1) * 0.22; }
    rowJoints.push(joints);
  }
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size, i = (y * size + x) * 4;
      // Rock: broad lumps, fine grain, and dark cracks.
      const lump = tileFbm(u, v, 6, 6, 5, h1);
      const crack = Math.abs(tileFbm(u, v, 5, 5, 3, h2));
      const crack2 = Math.abs(tileNoise(u, v, 14, 14, h3));
      let rock = 0.56 + lump * 0.42 + tileNoise(u, v, 96, 96, h4) * 0.05;
      rock *= 0.72 + 0.28 * sstep(0.0, 0.05, crack);
      rock *= 0.86 + 0.14 * sstep(0.0, 0.08, crack2);
      rock += tileFbm(u, v, 24, 24, 3, h6) * 0.12;
      // Leaves and turf: a clumpy speckle.
      const clump = tileFbm(u, v, 24, 24, 3, h5);
      const fine = tileNoise(u, v, 128, 128, h6);
      const leaf = 0.55 + clump * 0.35 + fine * 0.18;
      // Bark: long fibres and fissures running along v.
      const fib = tileFbm(u, v, 32, 3, 4, h2);
      const fis = Math.abs(tileFbm(u, v, 10, 2, 3, h3));
      const bark = (0.6 + fib * 0.35) * (0.45 + 0.55 * sstep(0.02, 0.16, fis));
      // Masonry: blocks with chamfered edges and mortar lines.
      const row = Math.floor(v * rows), fv = v * rows - row;
      const joints = rowJoints[row];
      let k = 0;
      while (k < joints.length && joints[k] <= u) k++;
      const jl = k > 0 ? joints[k - 1] : joints[joints.length - 1] - 1, jr = k < joints.length ? joints[k] : joints[0] + 1;
      const du = Math.min(u - jl, jr - u) * 6, dv = Math.min(fv, 1 - fv) / rows * 6; // distance to the edge, in tile units * 6
      const edge = Math.min(du, dv);
      const block = rr(row * 31 + k, 7);
      let mas = edge < 0.035 ? 0.2 : 0.42 + 0.48 * sstep(0.035, 0.11, edge);
      mas *= 0.86 + block * 0.22;
      mas += lump * 0.12 + fine * 0.04;
      const cl = (t) => Math.max(0, Math.min(255, Math.round(t * 255)));
      data[i] = cl(rock); data[i + 1] = cl(leaf); data[i + 2] = cl(bark); data[i + 3] = cl(mas);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dry-stone walling, in the red channel: rough field stones of every size laid
 * in uneven courses, with deep dark gaps between them and no mortar. One tile
 * is about 2.2 m across at the scale it is drawn (SURF.drystone).
 */
function makeStoneTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const rr = makeHash(131), h1 = makeHash(137), h2 = makeHash(139);
  // courses of uneven height, summing to the tile; each cut into stones of uneven length
  const rows = [];
  let v0 = 0;
  while (v0 < 0.999) {
    const hgt = Math.min(1 - v0, 0.11 + rr(rows.length, 1) * 0.1);
    const left = 1 - v0 - hgt;
    const h = left < 0.09 ? 1 - v0 : hgt;
    const joints = [];
    let u = rr(rows.length, 2) * 0.2;
    while (u < 1) { joints.push(u); u += 0.09 + rr(rows.length, joints.length + 3) * 0.2; }
    rows.push({ v0, h, joints });
    v0 += h;
  }
  for (let y = 0; y < size; y++) {
    const v = y / size;
    let r = 0;
    while (r < rows.length - 1 && rows[r].v0 + rows[r].h <= v) r++;
    const row = rows[r], fv = (v - row.v0) / row.h;
    for (let x = 0; x < size; x++) {
      const u = x / size, i = (y * size + x) * 4;
      const J = row.joints;
      let k = 0;
      while (k < J.length && J[k] <= u) k++;
      const jl = k > 0 ? J[k - 1] : J[J.length - 1] - 1, jr = k < J.length ? J[k] : J[0] + 1;
      const fu = (u - jl) / (jr - jl);
      // a rounded stone: superellipse distance from its middle, its outline wobbling
      const wob = tileNoise(u, v, 24, 24, h1) * 0.12;
      const du = Math.abs(fu - 0.5) * 2, dv = Math.abs(fv - 0.5) * 2;
      const e = Math.pow(Math.pow(du, 3) + Math.pow(dv, 3), 1 / 3) + wob;
      const shade = 0.5 + rr(r * 53 + k, 9) * 0.4;
      let st = e > 0.93 ? 0.08 : shade * (0.75 + 0.25 * sstep(0.93, 0.6, e)) + tileFbm(u, v, 16, 16, 3, h2) * 0.12;
      st += (1 - fv) * 0.05; // the top of each stone a little lighter
      const c = Math.max(0, Math.min(255, Math.round(st * 255)));
      data[i] = c; data[i + 1] = c; data[i + 2] = c; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Leaf clusters drawn on a canvas: broad leaves, needles, small ivy leaves, and solid white. */
function makeLeafAtlas() {
  const W = 1024, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rand = (() => { let a = 99; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const shade = (k) => { const c = Math.round(178 + Math.min(1, Math.max(0, k)) * 77); return `rgb(${c},${c},${c})`; };
  // Broad leaves: many small ovals with a midrib, thick at the centre, ragged at the edge.
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 256, 256); ctx.clip();
  for (let i = 0; i < 520; i++) {
    const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.75) * 118;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    const s = 6 + rand() * 7;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + (rand() - 0.5) * 1.6);
    ctx.fillStyle = shade(0.25 + rand() * 0.75 - r / 400);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,90,90,0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // Needles: sprays of thin strokes from a few twigs.
  ctx.save(); ctx.beginPath(); ctx.rect(256, 0, 256, 256); ctx.clip();
  for (let t = 0; t < 26; t++) {
    const a0 = rand() * Math.PI * 2, r0 = rand() * 60;
    let x = 384 + Math.cos(a0) * r0, y = 128 + Math.sin(a0) * r0;
    const dir = a0 + (rand() - 0.5);
    for (let k = 0; k < 16; k++) {
      x += Math.cos(dir) * 4; y += Math.sin(dir) * 4;
      if (Math.hypot(x - 384, y - 128) > 118) break;
      for (const sgn of [-1, 1]) {
        const na = dir + sgn * (0.9 + rand() * 0.4), len = 9 + rand() * 7;
        ctx.strokeStyle = shade(0.3 + rand() * 0.7); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(na) * len, y + Math.sin(na) * len); ctx.stroke();
      }
    }
  }
  ctx.restore();
  // Ivy: small lobed leaves spread thinly.
  ctx.save(); ctx.beginPath(); ctx.rect(512, 0, 256, 256); ctx.clip();
  for (let i = 0; i < 260; i++) {
    const x = 520 + rand() * 240, y = 8 + rand() * 240;
    if (Math.hypot(x - 640, y - 128) > 122 * (0.7 + 0.3 * rand())) continue;
    const s = 5 + rand() * 6;
    ctx.fillStyle = shade(0.2 + rand() * 0.8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rand() * 6.3);
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.lineTo(Math.cos(a + 0.6) * s * 0.55, Math.sin(a + 0.6) * s * 0.55); }
    ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.fillRect(768, 0, 256, 256);

  // Copy out and give transparent pixels a leaf-grey colour, so mipmaps do not darken the edges.
  const img = ctx.getImageData(0, 0, W, H).data;
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H * 4; i += 4) {
    const a = img[i + 3];
    if (a < 250) {
      const k = a / 255, base = 200;
      data[i] = Math.round(img[i] * k + base * (1 - k)); data[i + 1] = Math.round(img[i + 1] * k + base * (1 - k)); data[i + 2] = Math.round(img[i + 2] * k + base * (1 - k));
    } else { data[i] = img[i]; data[i + 1] = img[i + 1]; data[i + 2] = img[i + 2]; }
    data[i + 3] = a;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.flipY = false;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true; // kept linear: the shades multiply the leaf colour directly
  return tex;
}

/**
 * (since v0.8.5) Mountain crags, seen from far off: R is the height of the
 * rock, ridged into knife-edged ribs with gullies between, running along v
 * (which is up on a cliff face, seen from the side); G is its layering, broken
 * bands across v. One tile covers tens of metres (see FRAG_COLOR), so the far
 * mountains are rough without a polygon more.
 */
function makeCragTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const h1 = makeHash(211), h2 = makeHash(223), h3 = makeHash(227), h4 = makeHash(229);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size, i = (y * size + x) * 4;
      const warp = tileFbm(u, v, 4, 4, 3, h4) * 0.08;
      const rib = 1 - Math.abs(tileFbm(u + warp, v, 9, 2, 4, h1));   // ribs and gullies running down the face
      const rib2 = 1 - Math.abs(tileFbm(u, v + warp, 22, 4, 3, h2)); // and smaller ones between
      const block = tileFbm(u, v, 6, 6, 4, h3);                       // broken buttresses
      let hgt = 0.15 + 0.5 * rib * rib * rib + 0.2 * rib2 * rib2 + 0.25 * (block * 0.5 + 0.5);
      const band = Math.sin((v * 7 + u * 2 + tileFbm(u, v, 3, 3, 3, h2) * 1.1) * Math.PI * 2); // beds, tilted and bent
      const strata = 0.5 + 0.5 * band * (0.3 + 0.7 * sstep(-0.2, 0.5, tileFbm(u, v, 5, 5, 2, h3))); // and broken
      const cl = (t) => Math.max(0, Math.min(255, Math.round(t * 255)));
      data[i] = cl(hgt); data[i + 1] = cl(strata); data[i + 2] = 128; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

let detailTex = null, atlasTex = null, stoneTex = null, cragTex = null;
export function cragTexture() { return (cragTex ||= makeCragTexture()); }
export function detailTexture() { return (detailTex ||= makeDetailTexture()); }
export function stoneTexture() { return (stoneTex ||= makeStoneTexture()); }
export function leafAtlas() { return (atlasTex ||= makeLeafAtlas()); }

// ---------------------------------------------------------------------------
// The material patch.

/** How many torches the cave's light is reckoned from. */
export const TORCHES = 6;
/** How many camps' dry ground the ground and grass shaders know of at once (the nearest). */
export const CAMP_TINTS = 10;

/** Shared uniforms: time for the wind, and how hard it blows. */
export const surfaceUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uMossColor: { value: new THREE.Color(0x5f7a35) },
  uSunDir: { value: new THREE.Vector3(-0.86, 0.42, 0.28).normalize() },
  uSunGlow: { value: new THREE.Color(1, 0.92, 0.7) }, // set by the atmosphere: sunlight through leaves
  uSkyColor: { value: new THREE.Color(0.75, 0.85, 0.88) }, // and the sky at the horizon, seen in water
  // Torchlight in the cave at Henneth Annûn: every torch lights what is near it.
  // Off (and free) anywhere else; set each frame by hennethAnnun.js.
  uTorchOn: { value: 0 },
  uTorchView: { value: Array.from({ length: TORCHES }, () => new THREE.Vector3()) }, // in view space
  uTorchI: { value: new Array(TORCHES).fill(0) },
  uTorchColor: { value: new THREE.Color(1.0, 0.66, 0.34) },
  // Plants change form by distance from the ranger (vegetation.js). Across a
  // band either side of each change both forms are drawn, each in a dither the
  // other fills, so one fades into the next instead of jumping.
  uLodFrom: { value: new THREE.Vector2() },     // where the ranger stands (x, z)
  uLodTree: { value: new THREE.Vector2(1e5, 2e5) },  // great trees: near -> middle, middle -> far
  uLodShrub: { value: new THREE.Vector2(1e5, 2e5) }, // everything else
  uLodBand: { value: 6 },                        // half the width of the band, metres
  // (since v0.7.7) The ground and grass of the nearest enemy camps are dry and
  // brown: (x, z, radius, how blighted 0..1), eased back to green as a camp heals (camps.js).
  uCamps: { value: Array.from({ length: CAMP_TINTS }, () => new THREE.Vector4()) },
  uCampN: { value: 0 }, // how many of them are in use (the loop stops there; none, and it costs nothing)
  // (since v0.8.5) The ground east of x turns to crags (cragTexture), fully by y: the Ephel Dúath.
  uCragX: { value: new THREE.Vector2(EPHEL.footX + 30, EPHEL.cragFull) },
};
export function updateSurfaces(time) { surfaceUniforms.uTime.value = time; }

/** Set once at start from the quality level: `lite` drops the slow mottle and the bump (low quality). */
export const surfaceSettings = { lite: false };

const VERT_HEAD = /* glsl */`
attribute float surf;
attribute vec2 lod; // a plant's form (1 near, 2 middle, 3 far, 4 near and middle alike; 0 none) and kind (0 tree, 1 shrub)
varying vec2 vLodKeep;
uniform vec2 uLodFrom;
uniform vec2 uLodTree;
uniform vec2 uLodShrub;
uniform float uLodBand;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;
varying float vSurfKind;
uniform float uTime;
uniform float uWind;
uniform float uDefaultKind;
uniform float uSway;
uniform vec2 uFade;
uniform vec2 uFadeIn;
`;
const VERT_SWAY = /* glsl */`
// Grain and moss are laid on by where a point rests on its object, before it
// sways or shrinks, so they stay fixed to it and never slide across it.
vec3 surfRest = transformed;
#ifdef SURF_FADE
{
  // small things shrink away into the distance instead of popping out
  vec3 o = vec3(0.0);
  #ifdef USE_INSTANCING
    o = instanceMatrix[3].xyz;
  #endif
  o = (modelMatrix * vec4(o, 1.0)).xyz;
  float fd = distance(o, cameraPosition);
  transformed *= (1.0 - smoothstep(uFade.x, uFade.y, fd)) * smoothstep(uFadeIn.x, uFadeIn.y, fd);
}
#endif
#ifdef SURF_WIND
{
  // Sway grows with height above the base; the phase comes from where the plant stands.
  vec3 origin = vec3(0.0);
  #ifdef USE_INSTANCING
    origin = instanceMatrix[3].xyz;
  #endif
  float hgt = max(transformed.y, 0.0);
  float ph = dot(origin.xz, vec2(0.13, 0.17));
  float gust = 0.6 + 0.4 * sin(uTime * 0.37 + origin.x * 0.01);
  float s = uSway * uWind * gust * hgt * hgt;
  float k = (surf > 2.5 && surf < 4.5) || (surf < 0.5 && uDefaultKind > 2.5 && uDefaultKind < 4.5) ? 1.0 : 0.35;
  transformed.x += s * k * (sin(uTime * 1.3 + ph) + 0.35 * sin(uTime * 2.9 + ph * 1.7 + transformed.y));
  transformed.z += s * k * 0.7 * cos(uTime * 1.1 + ph * 1.3);
}
#endif
`;
const VERT_TAIL = /* glsl */`
{
  vec4 sp = vec4(surfRest, 1.0);
  vec3 sn = objectNormal;
  #ifdef USE_INSTANCING
    sp = instanceMatrix * sp;
    sn = mat3(instanceMatrix) * sn;
  #endif
  #ifdef SURF_OBJECT
    vSurfPos = sp.xyz;
    vSurfNrm = sn;
  #else
    vSurfPos = (modelMatrix * sp).xyz;
    vSurfNrm = mat3(modelMatrix) * sn;
  #endif
  vSurfKind = surf < 0.5 ? uDefaultKind : surf;
}
// Which share of the dither this form of the plant keeps: near [t0, 1], middle
// [t1, t0), far [0, t1), where t0 and t1 rise from 0 to 1 across each band.
vLodKeep = vec2(-1.0, 2.0);
#ifdef USE_INSTANCING
if (lod.x > 0.5) {
  vec2 lodAt = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz;
  float ld = distance(lodAt, uLodFrom);
  vec2 lr = lod.y > 0.5 ? uLodShrub : uLodTree;
  float t0 = smoothstep(lr.x - uLodBand, lr.x + uLodBand, ld), t1 = smoothstep(lr.y - uLodBand, lr.y + uLodBand, ld);
  vLodKeep = lod.x < 1.5 ? vec2(t0, 2.0) : lod.x < 2.5 ? vec2(t1, t0) : lod.x < 3.5 ? vec2(-1.0, t1) : vec2(t1, 2.0);
}
#endif
`;

const FRAG_HEAD = /* glsl */`
uniform vec4 uCamps[${CAMP_TINTS}];
uniform int uCampN;
uniform sampler2D uDetail;
uniform sampler2D uStones;
uniform sampler2D uCrag;
uniform vec2 uCragX;
uniform vec3 uMossColor;
uniform float uMossAmt;
uniform float uDetailAmt;
uniform vec3 uSunDir;
uniform vec3 uSunGlow;
uniform float uTorchOn;
uniform vec3 uTorchView[${TORCHES}];
uniform float uTorchI[${TORCHES}];
uniform vec3 uTorchColor;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;
varying float vSurfKind;
varying vec2 vLodKeep;
float surfD;      // the grain at this point, about 0.5
float surfBump;   // how strongly it raises the surface
float surfLeaf;   // 1 on leaves: they glow a little, more with the sun behind them
float cragW;      // how far this is mountain crag (0 none)
float cragH;      // and the height of the crag here, about 0.5
// Triplanar: the grain seen from each axis, weighted by how squarely the surface
// faces it. A face that barely faces an axis (flat ground from the side, a trunk
// from above) is not looked up at all; the rest share its weight. (Gradients are
// taken before the branches, so the mip chosen is the same either way.)
#define TRI_SKIP 0.03
vec4 surfTri(vec3 p, vec3 w) {
  vec3 dx = dFdx(p), dy = dFdy(p);
  vec4 c = vec4(0.0); float s = 0.0;
  if (w.x > TRI_SKIP) { c += textureGrad(uDetail, p.zy, dx.zy, dy.zy) * w.x; s += w.x; }
  if (w.y > TRI_SKIP) { c += textureGrad(uDetail, p.xz, dx.xz, dy.xz) * w.y; s += w.y; }
  if (w.z > TRI_SKIP) { c += textureGrad(uDetail, p.xy, dx.xy, dy.xy) * w.z; s += w.z; }
  return c / s;
}
float stoneTri(vec3 p, vec3 w) {
  vec3 dx = dFdx(p), dy = dFdy(p);
  float c = 0.0, s = 0.0;
  if (w.x > TRI_SKIP) { c += textureGrad(uStones, p.zy, dx.zy, dy.zy).r * w.x; s += w.x; }
  if (w.y > TRI_SKIP) { c += textureGrad(uStones, p.xz, dx.xz, dy.xz).r * w.y; s += w.y; }
  if (w.z > TRI_SKIP) { c += textureGrad(uStones, p.xy, dx.xy, dy.xy).r * w.z; s += w.z; }
  return c / s;
}
vec2 cragTri(vec3 p, vec3 w) {
  vec3 dx = dFdx(p), dy = dFdy(p);
  vec2 c = vec2(0.0); float s = 0.0;
  if (w.x > TRI_SKIP) { c += textureGrad(uCrag, p.zy, dx.zy, dy.zy).rg * w.x; s += w.x; }
  if (w.y > TRI_SKIP) { c += textureGrad(uCrag, p.xz, dx.xz, dy.xz).rg * w.y; s += w.y; }
  if (w.z > TRI_SKIP) { c += textureGrad(uCrag, p.xy, dx.xy, dy.xy).rg * w.z; s += w.z; }
  return c / s;
}
vec3 surfPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;
// First of all (before the leaf atlas is even looked up): a plant between two
// forms keeps only this form's share of a fine screen dither.
const FRAG_DITHER = /* glsl */`
#ifdef SURF_LOD
{
  float lodH = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodH < vLodKeep.x || lodH >= vLodKeep.y) discard;
}
#endif
`;
// The grain, after the alpha test: nothing is spent on the clear part of a leaf card.
const FRAG_COLOR = /* glsl */`
{
  float k = floor(vSurfKind + 0.5);
  vec3 tn = normalize(vSurfNrm);
  vec3 w = pow(abs(tn), vec3(4.0));
  w /= (w.x + w.y + w.z);
  // per kind: channel, scale (1/metres), contrast, bump, moss
  vec4 ch = vec4(1.0, 0.0, 0.0, 0.0); float sc = 0.35, con = 0.18, bmp = 0.4, moss = 0.0;
  if (k == 2.0)       { ch = vec4(0.0, 0.0, 1.0, 0.0); sc = 0.9;  con = 0.75; bmp = 2.2; moss = 0.25; }
  else if (k == 3.0)  { ch = vec4(0.0, 1.0, 0.0, 0.0); sc = 0.55; con = 0.6;  bmp = 1.2; }
  else if (k == 4.0)  { ch = vec4(0.0, 1.0, 0.0, 0.0); sc = 1.2;  con = 0.15; bmp = 0.0; }
  else if (k == 5.0)  { ch = vec4(1.0, 0.0, 0.0, 0.0); sc = 0.42; con = 0.8;  bmp = 3.0; moss = 1.0; }
  else if (k == 6.0)  { ch = vec4(0.0, 0.0, 0.0, 1.0); sc = 0.25; con = 0.6;  bmp = 2.4; moss = 0.55; }
  else if (k == 7.0)  { ch = vec4(0.0, 0.0, 1.0, 0.0); sc = 2.2;  con = 0.4;  bmp = 0.8; }
  else if (k == 8.0)  { ch = vec4(0.0, 1.0, 0.0, 0.0); sc = 5.0;  con = 0.22; bmp = 0.5; }
  else if (k == 9.0)  { ch = vec4(0.0, 1.0, 0.0, 0.0); sc = 0.45; con = 0.55; bmp = 1.0; }
  else if (k == 10.0) { ch = vec4(0.0, 1.0, 0.0, 0.0); sc = 6.0;  con = 0.05; bmp = 0.1; }
  else if (k == 12.0) { ch = vec4(1.0, 0.0, 0.0, 0.0); sc = 0.42; con = 0.7;  bmp = 2.6; }
  else if (k == 11.0) { ch = vec4(1.0, 0.0, 0.0, 0.0); sc = 3.0;  con = 0.25; bmp = 0.3; }
  if (k == 13.0)      { ch = vec4(1.0, 0.0, 0.0, 0.0); sc = 0.45; con = 0.95; bmp = 3.2; moss = 0.45; }
  vec4 t = surfTri(vSurfPos * sc, w);
  float d = dot(t, ch);
  if (k == 13.0) d = mix(stoneTri(vSurfPos * sc, w), d, 0.18); // the walling, with a little of the rock's grain on each stone
  if (k == 5.0 || k == 12.0) {
    // rock: blend in the same grain at a much larger, offset scale, so the
    // repeat of the small one cannot be seen across a cliff
    float big = surfTri(vSurfPos * 0.11 + vec3(3.7, 1.3, 5.1), w).r;
    d = mix(d, big, 0.45);
  }
  #ifdef SURF_LITE
    vec4 macro = vec4(0.55);
  #else
    vec4 macro = surfTri(vSurfPos * 0.045, w);
  #endif
  if (k == 9.0) {
    // Turf on the flat, stone on the steep, and a slower mottle over both.
    float steep = smoothstep(0.5, 0.78, 1.0 - tn.y);
    #ifdef SURF_LITE
      d = mix(d, t.r, steep);
    #else
      vec4 r = surfTri(vSurfPos * 0.22, w);
      d = mix(d * 0.7 + 0.5 * 0.3 + (surfTri(vSurfPos * 0.11, w).g - 0.5) * 0.35, r.r, steep);
    #endif
    con = mix(0.55, 0.9, steep); bmp = mix(0.8, 3.2, steep);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.92, 0.9, 0.86), steep);
  }
  cragW = 0.0;
  if (k == 9.0 && vSurfPos.x > uCragX.x) {
    // The mountains: ribs and gullies of rock tens of metres across, and its layers.
    cragW = smoothstep(uCragX.x, uCragX.y, vSurfPos.x) * (0.55 + 0.45 * smoothstep(0.12, 0.45, 1.0 - tn.y));
    vec2 c1 = cragTri(vSurfPos * (1.0 / 150.0) + vec3(0.37, 0.0, 0.71), w);
    vec2 c2 = cragTri(vSurfPos * (1.0 / 47.0), w);
    cragH = c1.x * 0.62 + c2.x * 0.38;
    float strata = mix(c1.y, c2.y, 0.35);
    diffuseColor.rgb *= mix(1.0, (0.4 + 1.15 * cragH) * (0.93 + 0.14 * strata), cragW);
    d = mix(d, 0.55, cragW * smoothstep(120.0, 400.0, distance(vSurfPos, cameraPosition))); // the fine grain only shimmers this far off
  }
  con *= uDetailAmt;
  surfLeaf = (k == 3.0 || k == 4.0) ? 1.0 : 0.0;
  surfD = d;
  surfBump = bmp * uDetailAmt;
  diffuseColor.rgb *= clamp(1.0 + (d - 0.55) * 2.0 * con, 0.25, 1.6);
  diffuseColor.rgb *= 0.92 + 0.16 * macro.r;
  if (moss > 0.0 && uMossAmt > 0.0) {
    float up = tn.y + (macro.g - 0.5) * 0.9 + (d - 0.5) * 0.35;
    float m = smoothstep(0.5, 0.85, up) * smoothstep(0.3, 0.6, macro.g + (d - 0.5)) * moss * uMossAmt;
    if (k == 5.0) m = max(m, smoothstep(0.6, 0.76, macro.g + (d - 0.5) * 0.5) * 0.65 * uMossAmt); // damp patches on the walls too
    diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor * (0.75 + 0.5 * t.g), m);
    surfBump *= 1.0 - 0.6 * m;
  }
}
`;
/** The dry, trodden grass of an enemy camp (ground and grass only: `camps` in surfaceMaterial). */
const FRAG_CAMPS = /* glsl */`
if (uCampN > 0) {
  float dead = 0.0;
  for (int i = 0; i < ${CAMP_TINTS}; i++) {
    if (i >= uCampN) break;
    vec4 c = uCamps[i];
    vec2 dv = vSurfPos.xz - c.xy;
    if (abs(dv.x) > c.z || abs(dv.y) > c.z) continue; // (most of the ground is nowhere near)
    dead = max(dead, c.w * (1.0 - smoothstep(c.z * 0.55, c.z, length(dv))));
  }
  if (dead > 0.0) {
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
    diffuseColor.rgb = mix(diffuseColor.rgb, lum * vec3(1.32, 1.04, 0.56), dead * 0.88);
  }
}
`;
const FRAG_GLOW = /* glsl */`
if (surfLeaf > 0.0) {
  #ifdef SURF_OBJECT
    vec3 vdir = normalize(vViewPosition);
    float back = 0.0;
  #else
    vec3 vdir = normalize(vSurfPos - cameraPosition);
    float back = pow(max(dot(vdir, uSunDir), 0.0), 3.0);
  #endif
  totalEmissiveRadiance += diffuseColor.rgb * uSunGlow * (0.11 + 0.55 * back);
}
`;
// Light from the torches, reckoned as point lights would be (falling off with
// distance to nothing at 13 m), but only switched on near the cave.
const FRAG_TORCH = /* glsl */`
if (uTorchOn > 0.0) {
  for (int i = 0; i < ${TORCHES}; i++) {
    vec3 tl = uTorchView[i] - geometryPosition;
    float td = length(tl);
    float fall = uTorchI[i] / max(pow(td, 1.6), 0.01) * pow2(saturate(1.0 - pow4(td / 13.0)));
    reflectedLight.directDiffuse += saturate(dot(geometryNormal, tl / td)) * fall * uTorchOn * uTorchColor * BRDF_Lambert(diffuseColor.rgb);
  }
}
`;
const FRAG_NORMAL = /* glsl */`
#ifndef SURF_LITE
{
  float fade = 1.0 - smoothstep(25.0, 70.0, length(vViewPosition));
  if (surfBump > 0.0 && fade > 0.0) {
    vec2 dH = vec2(dFdx(surfD), dFdy(surfD)) * surfBump * fade;
    normal = surfPerturb(-vViewPosition, normal, dH, faceDirection);
  }
  if (cragW > 0.0) {
    // crags at any distance: lit as the faces of the ground's own facets, not smoothed over
    // (a bump from the crag texture itself speckles at this distance)
    vec3 facet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    normal = normalize(mix(normal, facet, 0.6 * cragW));
  }
}
#endif
`;

// Shadows fade out toward the edge of the sun's shadow map (110 m round the
// ranger), so they come in gently as you walk, never all at once.
const SHADOW_RETURN = 'return mix( 1.0, shadow, shadowIntensity );';
if (!THREE.ShaderChunk.shadowmap_pars_fragment.includes(SHADOW_RETURN)) throw new Error('three.js shadow chunk has changed: update SHADOW_PARS in surface.js');
const SHADOW_PARS = THREE.ShaderChunk.shadowmap_pars_fragment.replace(SHADOW_RETURN, `{
    vec2 shadowEdge = min(shadowCoord.xy, 1.0 - shadowCoord.xy);
    return mix( 1.0, shadow, shadowIntensity * smoothstep(0.0, 0.14, min(shadowEdge.x, shadowEdge.y)) );
  }`);

/**
 * A Lambert material with surface detail.
 * @param {object} o kind (default SURF kind), cards (leaf atlas + alpha test),
 *   wind (sway, metres per metre squared of height), object (detail fixed to the
 *   object, for things that move), side, moss (0..1), detail (0..1), lod (false:
 *   instanced, but never fading between forms, so built without the discard)
 */
export function surfaceMaterial(o = {}) {
  const params = { vertexColors: true, side: o.side ?? THREE.FrontSide };
  if (o.cards) { params.map = leafAtlas(); params.alphaTest = 0.5; params.side = THREE.DoubleSide; }
  if (o.color !== undefined) params.color = o.color;
  const mat = new THREE.MeshLambertMaterial(params);
  const uniforms = {
    uDetail: { value: detailTexture() },
    uStones: { value: stoneTexture() },
    uCrag: { value: cragTexture() },
    uDefaultKind: { value: o.kind ?? SURF.plain },
    uSway: { value: o.wind ?? 0 },
    uMossAmt: { value: o.moss ?? 1 },
    uDetailAmt: { value: o.detail ?? 1 },
    uFade: { value: new THREE.Vector2(...(o.fade ?? [1e5, 2e5])) },
    uFadeIn: { value: new THREE.Vector2(-2, -1) },
  };
  mat.userData.surf = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, surfaceUniforms);
    if (o.wind) shader.defines = { ...(shader.defines || {}), SURF_WIND: '' };
    if (surfaceSettings.lite) shader.defines = { ...(shader.defines || {}), SURF_LITE: '' };
    if (o.fade) shader.defines = { ...(shader.defines || {}), SURF_FADE: '' };
    if (o.object) shader.defines = { ...(shader.defines || {}), SURF_OBJECT: '' };
    // Only instanced plants fade between forms. Anything else is built without the
    // discard that fading needs: a shader that can discard costs more on a phone's GPU
    // (and a Mac's), which then cannot skip drawing what is hidden behind it.
    if (shader.instancing && o.lod !== false) shader.defines = { ...(shader.defines || {}), SURF_LOD: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_SWAY)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_TAIL);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', SHADOW_PARS)
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_DITHER)
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + FRAG_COLOR + (o.camps ? FRAG_CAMPS : ''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_GLOW)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAG_TORCH);
  };
  mat.customProgramCacheKey = () => `surf|${o.wind ? 1 : 0}|${o.object ? 1 : 0}|${o.fade ? 1 : 0}|${surfaceSettings.lite ? 1 : 0}|${o.lod === false ? 0 : 1}|${o.camps ? 1 : 0}`;
  return mat;
}

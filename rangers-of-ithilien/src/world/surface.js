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

let detailTex = null, atlasTex = null;
export function detailTexture() { return (detailTex ||= makeDetailTexture()); }
export function leafAtlas() { return (atlasTex ||= makeLeafAtlas()); }

// ---------------------------------------------------------------------------
// The material patch.

/** Shared uniforms: time for the wind, and how hard it blows. */
export const surfaceUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uMossColor: { value: new THREE.Color(0x5f7a35) },
  uSunDir: { value: new THREE.Vector3(-0.86, 0.42, 0.28).normalize() },
  uSunGlow: { value: new THREE.Color(1, 0.92, 0.7) }, // set by the atmosphere: sunlight through leaves
  uSkyColor: { value: new THREE.Color(0.75, 0.85, 0.88) }, // and the sky at the horizon, seen in water
};
export function updateSurfaces(time) { surfaceUniforms.uTime.value = time; }

/** Set once at start from the quality level: `lite` drops the slow mottle and the bump (low quality). */
export const surfaceSettings = { lite: false };

const VERT_HEAD = /* glsl */`
attribute float surf;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;
varying float vSurfKind;
uniform float uTime;
uniform float uWind;
uniform float uDefaultKind;
uniform float uSway;
uniform vec2 uFade;
`;
const VERT_SWAY = /* glsl */`
#ifdef SURF_FADE
{
  // small things shrink away into the distance instead of popping out
  vec3 o = vec3(0.0);
  #ifdef USE_INSTANCING
    o = instanceMatrix[3].xyz;
  #endif
  o = (modelMatrix * vec4(o, 1.0)).xyz;
  transformed *= 1.0 - smoothstep(uFade.x, uFade.y, distance(o, cameraPosition));
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
  vec4 sp = vec4(transformed, 1.0);
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
`;

const FRAG_HEAD = /* glsl */`
uniform sampler2D uDetail;
uniform vec3 uMossColor;
uniform float uMossAmt;
uniform float uDetailAmt;
uniform vec3 uSunDir;
uniform vec3 uSunGlow;
varying vec3 vSurfPos;
varying vec3 vSurfNrm;
varying float vSurfKind;
float surfD;      // the grain at this point, about 0.5
float surfBump;   // how strongly it raises the surface
float surfLeaf;   // 1 on leaves: they glow a little, more with the sun behind them
vec4 surfTri(vec3 p, vec3 w) {
  return texture2D(uDetail, p.zy) * w.x + texture2D(uDetail, p.xz) * w.y + texture2D(uDetail, p.xy) * w.z;
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
  vec4 t = surfTri(vSurfPos * sc, w);
  float d = dot(t, ch);
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
  con *= uDetailAmt;
  surfLeaf = (k == 3.0 || k == 4.0) ? 1.0 : 0.0;
  surfD = d;
  surfBump = bmp * uDetailAmt;
  diffuseColor.rgb *= clamp(1.0 + (d - 0.55) * 2.0 * con, 0.25, 1.6);
  diffuseColor.rgb *= 0.92 + 0.16 * macro.r;
  if (moss > 0.0 && uMossAmt > 0.0) {
    float up = tn.y + (macro.g - 0.5) * 0.9 + (d - 0.5) * 0.35;
    float m = smoothstep(0.5, 0.85, up) * smoothstep(0.3, 0.6, macro.g + (d - 0.5)) * moss * uMossAmt;
    diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor * (0.75 + 0.5 * t.g), m);
    surfBump *= 1.0 - 0.6 * m;
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
const FRAG_NORMAL = /* glsl */`
#ifndef SURF_LITE
{
  float fade = 1.0 - smoothstep(25.0, 70.0, length(vViewPosition));
  if (surfBump > 0.0 && fade > 0.0) {
    vec2 dH = vec2(dFdx(surfD), dFdy(surfD)) * surfBump * fade;
    normal = surfPerturb(-vViewPosition, normal, dH, faceDirection);
  }
}
#endif
`;

/**
 * A Lambert material with surface detail.
 * @param {object} o kind (default SURF kind), cards (leaf atlas + alpha test),
 *   wind (sway, metres per metre squared of height), object (detail fixed to the
 *   object, for things that move), side, moss (0..1), detail (0..1)
 */
export function surfaceMaterial(o = {}) {
  const params = { vertexColors: true, side: o.side ?? THREE.FrontSide };
  if (o.cards) { params.map = leafAtlas(); params.alphaTest = 0.5; params.side = THREE.DoubleSide; }
  if (o.color !== undefined) params.color = o.color;
  const mat = new THREE.MeshLambertMaterial(params);
  const uniforms = {
    uDetail: { value: detailTexture() },
    uDefaultKind: { value: o.kind ?? SURF.plain },
    uSway: { value: o.wind ?? 0 },
    uMossAmt: { value: o.moss ?? 1 },
    uDetailAmt: { value: o.detail ?? 1 },
    uFade: { value: new THREE.Vector2(...(o.fade ?? [1e5, 2e5])) },
  };
  mat.userData.surf = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, surfaceUniforms);
    if (o.wind) shader.defines = { ...(shader.defines || {}), SURF_WIND: '' };
    if (surfaceSettings.lite) shader.defines = { ...(shader.defines || {}), SURF_LITE: '' };
    if (o.fade) shader.defines = { ...(shader.defines || {}), SURF_FADE: '' };
    if (o.object) shader.defines = { ...(shader.defines || {}), SURF_OBJECT: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_SWAY)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_TAIL);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_GLOW);
  };
  mat.customProgramCacheKey = () => `surf|${o.wind ? 1 : 0}|${o.object ? 1 : 0}|${o.fade ? 1 : 0}|${surfaceSettings.lite ? 1 : 0}`;
  return mat;
}

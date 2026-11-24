// Procedural, tileable surface textures, generated once at load.
//
// Each texture is a pair: albedo (RGB, sRGB) with roughness in alpha, and a
// tangent-space normal map made from a height field. All are drawn from seeded
// noise and shapes here; no image files. `size` is how many metres one tile
// covers; the shaders tile them by world position.

import * as THREE from 'three';

const S = 512;   // texels per side

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value noise: n(x, y, P) tiles with period P lattice cells (P ≤ 256). */
function valueNoise(seed) {
  const r = rng(seed);
  const v = new Float32Array(256 * 256);
  for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (i, j, P) => v[(((i % P) + P) % P) * 256 + (((j % P) + P) % P)];
  return (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = g(xi, yi, P), b = g(xi + 1, yi, P), c = g(xi, yi + 1, P), d = g(xi + 1, yi + 1, P);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

/** fbm over u, v in [0,1): base period P cells, doubling each octave. */
function fbm(n, u, v, P, oct = 5, gain = 0.5) {
  let s = 0, a = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * n(u * P, v * P, P);
    norm += a; a *= gain; P *= 2;
  }
  return s / norm;
}

class Canvas {
  constructor() {
    this.alb = new Float32Array(S * S * 3);
    this.rough = new Float32Array(S * S).fill(0.7);
    this.h = new Float32Array(S * S);
  }
  idx(x, y) { return ((((y % S) + S) % S) * S + (((x % S) + S) % S)); }
  each(fn) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      fn(x / S, y / S, i, x, y);
    }
  }
  setAlb(i, r, g, b) { this.alb[i * 3] = r; this.alb[i * 3 + 1] = g; this.alb[i * 3 + 2] = b; }
  mulAlb(i, k) { this.alb[i * 3] *= k; this.alb[i * 3 + 1] *= k; this.alb[i * 3 + 2] *= k; }
}

function toTextures(c, normalStrength, anisotropy) {
  const a = new Uint8Array(S * S * 4);
  const n = new Uint8Array(S * S * 4);
  const lin2srgb = (x) => {
    x = Math.min(1, Math.max(0, x));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    a[i * 4] = 255 * lin2srgb(c.alb[i * 3]);
    a[i * 4 + 1] = 255 * lin2srgb(c.alb[i * 3 + 1]);
    a[i * 4 + 2] = 255 * lin2srgb(c.alb[i * 3 + 2]);
    a[i * 4 + 3] = 255 * Math.min(1, Math.max(0.03, c.rough[i]));
    const dx = (c.h[c.idx(x + 1, y)] - c.h[c.idx(x - 1, y)]) * normalStrength;
    const dy = (c.h[c.idx(x, y + 1)] - c.h[c.idx(x, y - 1)]) * normalStrength;
    const l = Math.hypot(dx, dy, 1);
    n[i * 4] = 127.5 * (1 - dx / l);
    n[i * 4 + 1] = 127.5 * (1 - dy / l);
    n[i * 4 + 2] = 127.5 * (1 + 1 / l);
    n[i * 4 + 3] = 255;
  }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { alb: make(a, true), nrm: make(n, false) };
}

// --- the surfaces ------------------------------------------------------------

function grass() {
  const c = new Canvas(), n = valueNoise(11), n2 = valueNoise(12), r = rng(13);
  c.each((u, v, i) => {
    const f = fbm(n, u, v, 6, 5), dry = fbm(n2, u, v, 3, 4);
    const k = 0.75 + 0.5 * f;
    let col = [0.045 * k, 0.11 * k, 0.025 * k];
    if (dry > 0.58) { const t = Math.min(1, (dry - 0.58) * 6); col = col.map((x, j) => x + t * ([0.09, 0.08, 0.03][j] - x)); }
    c.setAlb(i, ...col);
    c.h[i] = 0.15 * f;
    c.rough[i] = 0.9;
  });
  // blades: short strokes, darker at the root, lighter and higher at the tip
  for (let b = 0; b < 22000; b++) {
    const x0 = r() * S, y0 = r() * S, ang = r() * Math.PI * 2, len = 5 + r() * 14;
    const tone = r(), yellow = r() < 0.12;
    const tip = yellow ? [0.12, 0.11, 0.04] : [0.045 + 0.05 * tone, 0.11 + 0.07 * tone, 0.02 + 0.015 * tone];
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let s = 0; s < len; s += 0.6) {
      const t = s / len;
      const i = c.idx(Math.round(x0 + dx * s), Math.round(y0 + dy * s));
      const hh = 0.3 + 0.7 * t;
      if (hh >= c.h[i]) {
        c.h[i] = hh;
        c.setAlb(i, tip[0] * (0.45 + 0.55 * t), tip[1] * (0.45 + 0.55 * t), tip[2] * (0.45 + 0.55 * t));
        c.rough[i] = 0.75;
      }
    }
  }
  return c;
}

function pavers() {
  // 0.5 m square stones in a 2 m tile (128 px each), 3 px joints, bevelled
  const c = new Canvas(), n = valueNoise(21), n2 = valueNoise(22), r = rng(23);
  const tones = Array.from({ length: 16 }, () => 0.85 + 0.3 * r());
  const tints = Array.from({ length: 16 }, () => r());
  c.each((u, v, i, x, y) => {
    const cx = Math.floor(x / 128), cy = Math.floor(y / 128);
    const lx = x % 128, ly = y % 128;
    const edge = Math.min(lx, ly, 127 - lx, 127 - ly);
    const id = cy * 4 + cx;
    const speck = fbm(n, u, v, 64, 3);
    const big = fbm(n2, u, v, 8, 4);
    const t = tones[id] * (0.85 + 0.3 * speck) * (0.9 + 0.2 * big);
    const warm = tints[id];
    let col = [0.30 * t + 0.03 * warm, 0.285 * t + 0.01 * warm, 0.26 * t - 0.02 * warm];
    let h = Math.min(1, edge / 6) * 0.8 + 0.2 * speck;
    if (edge < 3) { col = [0.10, 0.095, 0.09]; h = 0; }
    c.setAlb(i, ...col);
    c.h[i] = h;
    c.rough[i] = edge < 3 ? 0.95 : 0.7 + 0.2 * speck;
  });
  // small chips and stains
  for (let k = 0; k < 300; k++) {
    const x0 = Math.floor(r() * S), y0 = Math.floor(r() * S), rad = 1 + r() * 3;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const i = c.idx(x0 + dx, y0 + dy);
      c.h[i] -= 0.25; c.mulAlb(i, 0.8);
    }
  }
  return c;
}

function deck() {
  // 1 m steel plates with raised diamond tread, seams and corner bolts
  const c = new Canvas(), n = valueNoise(31), r = rng(32);
  c.each((u, v, i, x, y) => {
    const lx = x % 256, ly = y % 256;
    const edge = Math.min(lx, ly, 255 - lx, 255 - ly);
    // diamond tread: lozenges on a rotated 16 px grid, alternating direction
    const a = (x + y) / 16, b = (x - y) / 16;
    const fa = a - Math.floor(a) - 0.5, fb = b - Math.floor(b) - 0.5;
    const alt = (Math.floor(a) + Math.floor(b)) & 1;
    const lo = alt ? Math.abs(fa) * 3 + Math.abs(fb) * 0.9 : Math.abs(fa) * 0.9 + Math.abs(fb) * 3;
    const tread = Math.max(0, 1 - lo * 1.6);
    const scuff = fbm(n, u, v, 16, 5);
    const k = 0.85 + 0.3 * scuff;
    let col = [0.30 * k, 0.31 * k, 0.32 * k];
    let h = 0.5 * tread;
    let rough = 0.5 - 0.2 * tread + 0.2 * scuff;
    if (edge < 2) { col = [0.06, 0.06, 0.065]; h = -0.3; rough = 0.9; }
    // bolts at the plate corners
    for (const [bx, by] of [[12, 12], [243, 12], [12, 243], [243, 243]]) {
      const d = Math.hypot(lx - bx, ly - by);
      if (d < 5) { h = 0.8 * Math.sqrt(1 - (d / 5) ** 2); col = [0.24, 0.24, 0.25]; rough = 0.35; }
    }
    c.setAlb(i, ...col);
    c.h[i] = h;
    c.rough[i] = rough;
  });
  return c;
}

function wall() {
  // 1 m × 2 m panels, a vent in some, faint vertical grime
  const c = new Canvas(), n = valueNoise(41), n2 = valueNoise(42);
  c.each((u, v, i, x, y) => {
    const lx = x % 256, ly = y;
    const edge = Math.min(lx, ly, 255 - lx, S - 1 - ly);
    const grime = fbm(n, u * 0.25, v * 4, 8, 4);
    const mottle = fbm(n2, u, v, 16, 4);
    const k = 0.92 + 0.1 * mottle - 0.12 * Math.max(0, grime - 0.5);
    let col = [0.62 * k, 0.60 * k, 0.56 * k];
    let h = Math.min(1, edge / 4) * 0.6;
    let rough = 0.55 + 0.1 * mottle;
    if (edge < 2) { col = [0.12, 0.12, 0.12]; h = 0; rough = 0.9; }
    // vent grille low on the right-hand panel
    if (lx > 60 && lx < 196 && ly > 40 && ly < 100 && x >= 256) {
      const slot = (ly - 40) % 10;
      if (slot < 5) { col = [0.08, 0.08, 0.085]; h = -0.4; } else { h = 0.6; }
    }
    c.setAlb(i, ...col);
    c.h[i] = h;
    c.rough[i] = rough;
  });
  return c;
}

function ceiling() {
  // 1 m acoustic tiles with a perforation grid
  const c = new Canvas(), n = valueNoise(51);
  c.each((u, v, i, x, y) => {
    const lx = x % 256, ly = y % 256;
    const edge = Math.min(lx, ly, 255 - lx, 255 - ly);
    const m = fbm(n, u, v, 8, 4);
    const k = 0.95 + 0.08 * m;
    let col = [0.74 * k, 0.74 * k, 0.72 * k];
    let h = 0.5;
    const px = (lx % 12) - 6, py = (ly % 12) - 6;
    if (edge > 14 && px * px + py * py < 4.5) { col = col.map((q) => q * 0.45); h = 0.1; }
    if (edge < 3) { col = [0.25, 0.25, 0.25]; h = 0; }
    c.setAlb(i, ...col);
    c.h[i] = h;
    c.rough[i] = 0.9;
  });
  return c;
}

function hull() {
  // 4 m tile of welded plates in staggered rows, rivet lines, stains
  const c = new Canvas(), n = valueNoise(61), n2 = valueNoise(62), r = rng(63);
  const rows = 4, plateTone = Array.from({ length: 64 }, () => 0.85 + 0.25 * r());
  c.each((u, v, i, x, y) => {
    const row = Math.floor(y / (S / rows));
    const shift = (row % 2) * 64;
    const cols = 4;
    const xs = (x + shift) % S;
    const col = Math.floor(xs / (S / cols));
    const lx = xs % (S / cols), ly = y % (S / rows);
    const edge = Math.min(lx, ly, S / cols - 1 - lx, S / rows - 1 - ly);
    const tone = plateTone[row * 8 + col];
    const stain = fbm(n, u, v, 4, 5), fine = fbm(n2, u, v, 32, 3);
    const k = tone * (0.9 + 0.15 * fine) * (1 - 0.25 * Math.max(0, stain - 0.55) * 3);
    let cc = [0.58 * k, 0.585 * k, 0.6 * k];
    let h = 0.5 + 0.1 * fine;
    let rough = 0.45 + 0.25 * stain;
    if (edge < 2) { cc = [0.15, 0.15, 0.16]; h = 0.1; rough = 0.8; }
    if (edge >= 5 && edge < 9 && (((edge === 6 || edge === 7) && ((lx + ly) % 14) < 3))) { h = 0.9; cc = cc.map((q) => q * 0.85); }
    c.setAlb(i, ...cc);
    c.h[i] = h;
    c.rough[i] = rough;
  });
  return c;
}

function bark() {
  const c = new Canvas(), n = valueNoise(71), n2 = valueNoise(72);
  c.each((u, v, i) => {
    const furrow = Math.abs(fbm(n, u, v, 10, 4) * 2 - 1);      // ridged
    const stretch = fbm(n2, u * 2, v * 0.5, 4, 4);
    const ridge = 1 - Math.pow(Math.abs(Math.sin((u * 14 + stretch * 3) * Math.PI)), 0.5) * 0.6 - furrow * 0.4;
    const k = 0.5 + 0.6 * ridge;
    c.setAlb(i, 0.16 * k, 0.11 * k, 0.075 * k);
    c.h[i] = ridge;
    c.rough[i] = 0.95;
  });
  return c;
}

function wood() {
  const c = new Canvas(), n = valueNoise(81);
  c.each((u, v, i, x, y) => {
    const plank = Math.floor(y / 64);
    const w = fbm(n, u * 0.5 + plank * 0.37, v * 8, 4, 4);
    const grain = 0.5 + 0.5 * Math.sin((v * 160 + w * 18 + plank * 3) * 1.0);
    const k = 0.75 + 0.35 * grain * (0.7 + 0.3 * w);
    const gap = (y % 64) < 3;
    c.setAlb(i, gap ? 0.04 : 0.30 * k, gap ? 0.025 : 0.17 * k, gap ? 0.015 : 0.08 * k);
    c.h[i] = gap ? 0 : 0.6 + 0.1 * grain;
    c.rough[i] = 0.55 + 0.2 * w;
  });
  return c;
}

function leaves() {
  // overlapping leaf shapes over deep shade; neutral green, tinted per plant
  const c = new Canvas(), r = rng(91);
  c.each((u, v, i) => { c.setAlb(i, 0.07, 0.07, 0.06); c.h[i] = 0; c.rough[i] = 0.8; });
  for (let k = 0; k < 9000; k++) {
    const x0 = r() * S, y0 = r() * S, ang = r() * Math.PI, len = 7 + r() * 9, wid = len * (0.35 + 0.15 * r());
    const tone = 0.55 + 0.45 * r(), hue = r() * 0.15;
    const ca = Math.cos(ang), sa = Math.sin(ang), hz = r();
    const R = Math.ceil(len);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const a = (dx * ca + dy * sa) / len, b = (-dx * sa + dy * ca) / wid;
      const d = a * a + b * b;
      if (d > 1) continue;
      const i = c.idx(Math.round(x0 + dx), Math.round(y0 + dy));
      const hh = hz + 0.4 * (1 - d);
      if (hh < c.h[i]) continue;
      c.h[i] = hh;
      const vein = Math.abs(b) < 0.08 ? 0.85 : 1;
      c.setAlb(i, (0.46 + hue) * tone * vein, 0.55 * tone * vein, (0.40 - hue) * tone * vein);
      c.rough[i] = 0.55;
    }
  }
  return c;
}

function soil() {
  const c = new Canvas(), n = valueNoise(101), r = rng(102);
  c.each((u, v, i) => {
    const f = fbm(n, u, v, 16, 5);
    const k = 0.6 + 0.6 * f;
    c.setAlb(i, 0.09 * k, 0.06 * k, 0.04 * k);
    c.h[i] = f * 0.5;
    c.rough[i] = 0.95;
  });
  for (let k = 0; k < 1400; k++) {   // pebbles and bark mulch
    const x0 = Math.floor(r() * S), y0 = Math.floor(r() * S), rad = 1.5 + r() * 3.5, t = r();
    const col = t < 0.5 ? [0.2, 0.19, 0.17] : [0.14, 0.08, 0.04];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const d = (dx * dx + dy * dy) / (rad * rad);
      if (d > 1) continue;
      const i = c.idx(x0 + dx, y0 + dy);
      c.h[i] = 0.5 + 0.5 * Math.sqrt(1 - d);
      c.setAlb(i, ...col.map((q) => q * (0.8 + 0.4 * (1 - d))));
      c.rough[i] = 0.7;
    }
  }
  return c;
}

const RECIPES = {
  grass: { make: grass, size: 1.6, bump: 2.0 },
  pavers: { make: pavers, size: 2.0, bump: 3.0 },
  deck: { make: deck, size: 2.0, bump: 4.0 },
  wall: { make: wall, size: 2.0, bump: 2.5 },
  ceiling: { make: ceiling, size: 2.0, bump: 2.0 },
  hull: { make: hull, size: 6.0, bump: 3.0 },
  bark: { make: bark, size: 1.0, bump: 4.0 },
  wood: { make: wood, size: 1.0, bump: 2.0 },
  leaves: { make: leaves, size: 0.6, bump: 4.0 },
  soil: { make: soil, size: 1.0, bump: 3.0 },
};

/** Generate every texture: { name: { alb, nrm, size } }. Takes a few hundred ms. */
export function makeTextures(anisotropy = 8) {
  const out = {};
  for (const [name, r] of Object.entries(RECIPES)) {
    const t = toTextures(r.make(), r.bump, anisotropy);
    out[name] = { ...t, size: r.size };
  }
  return out;
}

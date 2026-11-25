// (since v0.8.5) The White Mountains, far off over the Anduin: Mindolluin at
// their eastern end, the range running away west under the low sun, and on
// Mindolluin's knee the white city, a pale fleck with a glint at the tower's top.
// Where they stand is in layout.js (WHITE_MOUNTAINS).
//
// They lie far beyond the fog, so they are drawn without it: a strip of ground
// along the crest (one mesh, with the city in it) whose own shader hazes it
// toward the sky's horizon colour by distance and by height, as air does, and
// more in the blight. Their crags are the crag texture (surface.js), not polygons.

import * as THREE from 'three';
import { WHITE_MOUNTAINS as WM } from './layout.js';
import { noise2 } from '../util/noise.js';
import { cragTexture } from './surface.js';

const S = 5021;
const ALONG = 460; // samples along the crest
// Across the range, from its front (the north-east face, toward Ithilien: -1) over the crest (0) to its back (1).
const ACROSS = [-1, -0.86, -0.72, -0.6, -0.49, -0.39, -0.3, -0.22, -0.15, -0.09, -0.04, 0, 0.06, 0.18, 0.4, 0.7, 1];
const FOOT = -60; // the plain at the mountains' feet, well down in the haze

const ridged = (x, y, seed) => { const v = 1 - Math.abs(noise2(x, y, seed)); return v * v; };

/** The crest: a point, the way it runs (unit), its height, `s` metres along it from the east. */
function crestAt(s, cum) {
  const R = WM.ridge;
  let i = 1;
  while (i < R.length - 1 && cum[i] < s) i++;
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / (cum[i] - cum[i - 1])));
  const a = R[i - 1], b = R[i];
  const k = t * t * (3 - 2 * t); // heights ease between the named summits
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
  return { x: a[0] + dx * t, z: a[1] + dz * t, ux: dx / l, uz: dz / l, h: a[2] + (b[2] - a[2]) * k };
}

/** The height of the city's ground at a distance from its middle (it climbs in circles to the top). */
function cityGround(d) {
  const c = WM.city;
  return c.foot + (c.top - c.foot) * Math.max(0, 1 - d / c.r);
}

function buildRange() {
  const R = WM.ridge, cum = [0];
  for (let i = 1; i < R.length; i++) cum.push(cum[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
  const L = cum.at(-1), nA = ACROSS.length;
  const pos = new Float32Array(ALONG * nA * 3), kind = new Float32Array(ALONG * nA);
  const c = WM.city;
  for (let i = 0; i < ALONG; i++) {
    const s = (i / (ALONG - 1)) * L;
    const p = crestAt(s, cum);
    // the crest broken into summits and notches; sharper and higher toward the middle of each stretch
    let H = p.h * (1 + 0.32 * (ridged(s / 300, 0.5, S) - 0.45) + 0.18 * (ridged(s / 110, 2.5, S + 1) - 0.45) + 0.07 * (ridged(s / 38, 4.5, S + 2) - 0.45));
    H = Math.max(H, 25);
    const nx = -p.uz, nz = p.ux; // toward the front: the north side, facing Ithilien
    for (let j = 0; j < nA; j++) {
      const v = ACROSS[j], front = v < 0;
      const W = front ? 1.05 * H + 330 : 0.9 * H + 260;
      // spurs run out from the crest and gullies cut back into it: the face is wider here, narrower there
      const spur = 1 + 0.5 * (ridged(s / 210, v * 1.7 + 9, S + 3) - 0.4) * Math.sin(Math.PI * Math.abs(v));
      const u = Math.min(1, Math.abs(v) / spur);
      let h = FOOT + (H - FOOT) * Math.pow(1 - u, 1.35);
      h += (noise2(s / 90, v * 6, S + 4) * 12) * (1 - u);
      const x = p.x - nx * v * W, z = p.z - nz * v * W; // (v < 0 lies out to the front)
      // the city's knee: the mountain falls away in front of the city, so its circles stand clear
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r * 2.2 && (dx * c.face[0] + dz * c.face[1]) > -0.45 * d) {
        const k = 1 - Math.max(0, Math.min(1, (d - c.r * 1.1) / (c.r * 1.1)));
        h = Math.min(h, h + (cityGround(d) - 6 - h) * k);
      }
      const o = (i * nA + j) * 3;
      pos[o] = x; pos[o + 1] = h; pos[o + 2] = z;
    }
  }
  const idx = [];
  for (let i = 0; i < ALONG - 1; i++) {
    for (let j = 0; j < nA - 1; j++) {
      const a = i * nA + j, b = a + 1, d = a + nA, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The city: seven white circles climbing the knee, each a wall facing out and its top, and the tower. */
function buildCity() {
  const c = WM.city, pos = [], idx = [];
  const fa = Math.atan2(c.face[1], c.face[0]), span = 2.1, seg = 22;
  const quad = (a, b, d, e) => { const n = pos.length / 3; pos.push(...a, ...b, ...d, ...e); idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
  for (let t = 0; t < 7; t++) {
    const r = c.r * (1 - t * 0.125), top = c.foot + (c.top - c.foot) * ((t + 1) / 7), low = c.foot - 30;
    const r2 = t < 6 ? c.r * (1 - (t + 1) * 0.125) : 0;
    for (let k = 0; k < seg; k++) {
      const a0 = fa - span + (2 * span * k) / seg, a1 = fa - span + (2 * span * (k + 1)) / seg;
      const p0 = [c.x + Math.cos(a0) * r, c.z + Math.sin(a0) * r], p1 = [c.x + Math.cos(a1) * r, c.z + Math.sin(a1) * r];
      const q0 = [c.x + Math.cos(a0) * r2, c.z + Math.sin(a0) * r2], q1 = [c.x + Math.cos(a1) * r2, c.z + Math.sin(a1) * r2];
      quad([p0[0], top, p0[1]], [p1[0], top, p1[1]], [p0[0], low, p0[1]], [p1[0], low, p1[1]]); // the wall
      quad([q0[0], top, q0[1]], [q1[0], top, q1[1]], [p0[0], top, p0[1]], [p1[0], top, p1[1]]); // the ledge inside it
    }
  }
  // the tower: a slim shaft from the topmost circle
  const w = 4.5, y0 = c.top - 4, y1 = c.tower;
  const corners = [[-w, -w], [w, -w], [w, w], [-w, w]].map(([a, b]) => [c.x + a, c.z + b]);
  for (let k = 0; k < 4; k++) {
    const p = corners[k], q = corners[(k + 1) % 4];
    quad([q[0], y1, q[1]], [p[0], y1, p[1]], [q[0], y0, q[1]], [p[0], y0, p[1]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('kind', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(1), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Join geometries with the same attributes into one. */
function merge(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), kind = new Float32Array(nv), idx = new Uint32Array(ni);
  let v = 0, i = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    kind.set(g.attributes.kind.array, v);
    const src = g.index.array;
    for (let k = 0; k < src.length; k++) idx[i + k] = src[k] + v;
    v += g.attributes.position.count; i += src.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** A soft four-rayed star, for the glint. */
function starTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1, r = Math.hypot(u, v);
      const core = Math.exp(-r * r * 40), halo = Math.exp(-r * r * 7) * 0.25;
      const rays = (Math.exp(-Math.abs(u) * 26) + Math.exp(-Math.abs(v) * 26)) * Math.max(0, 1 - r) * 0.6;
      const a = Math.min(1, core + halo + rays), o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255; data[o + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export class WhiteMountains {
  /** @param {import('./atmosphere.js').Atmosphere} atmosphere whose sky colours the haze */
  constructor(scene, atmosphere) {
    const au = atmosphere.uniforms;
    this.uniforms = {
      uHorizon: au.horizon, uTop: au.top, uSunDir: au.sunDir, uSunCol: au.sunCol, uSunAmt: au.sunAmt,
      uMurk: { value: 0 }, uCrag: { value: cragTexture() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float kind;
        varying vec3 vWorld; varying vec3 vNrm; varying float vKind;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz; vNrm = normal; vKind = kind;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uHorizon; uniform vec3 uTop; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunAmt; uniform float uMurk;
        uniform sampler2D uCrag;
        varying vec3 vWorld; varying vec3 vNrm; varying float vKind;
        vec2 crag(vec3 p, vec3 w) {
          return (texture2D(uCrag, p.zy).rg * w.x + texture2D(uCrag, p.xz).rg * w.y + texture2D(uCrag, p.xy).rg * w.z);
        }
        void main() {
          vec3 toEye = cameraPosition - vWorld;
          vec3 facet = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          if (dot(facet, toEye) < 0.0) facet = -facet;
          vec3 sn = normalize(vNrm);
          if (dot(sn, toEye) < 0.0) sn = -sn;
          vec3 n = normalize(mix(sn, facet, 0.5));
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
          vec3 albedo; float glow = 0.0;
          if (vKind > 0.5) {
            albedo = vec3(0.9, 0.9, 0.86); // the white stone of the city
            glow = 0.28;
          } else {
            vec2 c = crag(vWorld / 260.0, w) * 0.6 + crag(vWorld / 85.0 + 0.3, w) * 0.4;
            albedo = vec3(0.2, 0.21, 0.25) * (0.45 + 1.15 * c.x) * (0.92 + 0.16 * c.y);
            // snow on the high summits, lying where the rock is not too steep
            float snow = smoothstep(300.0, 380.0, vWorld.y + (c.x - 0.5) * 160.0) * smoothstep(0.28, 0.6, n.y);
            albedo = mix(albedo, vec3(0.82, 0.86, 0.94), snow);
          }
          float lit = max(dot(n, uSunDir), 0.0);
          vec3 sky = mix(uHorizon, uTop, 0.35) * (0.5 + 0.25 * n.y);
          vec3 col = albedo * (sky + uSunCol * lit * 1.3 * (0.4 + 0.6 * uSunAmt)) + albedo * glow * uHorizon;
          // the air between: thicker with distance and low down, and lit where the sun is near
          vec3 toP = vWorld - cameraPosition;
          float dist = length(toP);
          float haze = 1.0 - exp(-dist / 9000.0);
          haze += (1.0 - haze) * pow(1.0 - smoothstep(-25.0, 330.0, vWorld.y), 1.6); // the foot lost in the haze altogether
          haze = clamp(haze + (1.0 - haze) * uMurk, 0.0, 1.0);
          float s = max(dot(toP / dist, uSunDir), 0.0);
          vec3 air = uHorizon + uSunCol * uSunAmt * (pow(s, 5.0) * 0.22 + pow(s, 80.0) * 0.5);
          gl_FragColor = vec4(mix(col, air, haze), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(merge([buildRange(), buildCity()]), mat);
    scene.add(this.mesh);

    // The glint at the top of the tower: a faint star that comes and goes.
    const c = WM.city;
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starTexture(), color: 0xfff6e0, transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: false,
    }));
    this.glint.position.set(c.x + c.face[0] * 6, c.tower - 2, c.z + c.face[1] * 6);
    this.glint.scale.setScalar(0.011); // about 0.6 degrees across, whatever the distance
    scene.add(this.glint);
  }

  /** @param {number} blight 0..1 where the ranger stands; `time` in seconds */
  update(blight, time) {
    this.uniforms.uMurk.value = 0.55 * blight;
    const tw = 0.5 + 0.5 * Math.sin(time * 1.3) * Math.sin(time * 0.47 + 1.1);
    this.glint.material.opacity = (0.35 + 0.65 * tw * tw * tw) * (1 - 0.85 * blight);
  }
}

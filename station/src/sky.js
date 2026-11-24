// Everything outside the station: the Moon, the Earth, the Sun and the stars.
//
// Drawn in its own scene, in kilometres, with its own near/far planes, after the
// station and only where the station left the stencil clear (windows, open sky).
//
// Inertial frame (km), centred on the station:
//   +X points at the Sun.
//   The orbit lies in the plane perpendicular to the Sun (the Y–Z plane), so the
//   Moon is always seen exactly half lit, and the station never enters its shadow.
//   The Earth is 384,400 km from the Moon along -Z, also perpendicular to the Sun,
//   so it is half lit too.
// `skyRoot` is rotated each frame by the inverse of the station's attitude, so
// its children sit where the rotating station sees them.

import * as THREE from 'three';
import { MOON_R, EARTH_R, EARTH_DIST, SUN_ANG_RADIUS } from './physics.js';

const NOISE = /* glsl */ `
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * noise3(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// screen-space bump: perturb normal N by height h (world units) at world point P
vec3 bump(vec3 N, vec3 P, float h) {
  vec3 dpdx = dFdx(P), dpdy = dFdy(P);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - g);
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPw = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// The Moon's surface is procedural: no map of the real Moon is used. Dark
// lowland "seas" are biased toward the hemisphere facing Earth (as on the real
// Moon); craters come from four octaves of cellular noise with bowls and rims.
const MOON_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSunDir; uniform float uSunI; uniform mat3 uObjRot;
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
// Craters add albedo and a surface slope (gradient of height, in units of the
// Moon's radius), computed analytically so shading stays smooth at any zoom.
void craters(vec3 p, float scale, float density, float strength, inout vec3 grad, inout float alb) {
  vec3 x = p * scale, ip = floor(x), fp = fract(x);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 cid = ip + vec3(i, j, k);
    if (hash13(cid * 1.37 + 11.0) > density) continue;
    vec3 c = vec3(i, j, k) + 0.2 + 0.6 * hash33(cid) - fp;
    float rad = 0.12 + 0.3 * pow(hash13(cid + 7.1), 2.5);
    float len = length(c);
    float d = len / rad;
    if (d > 2.0 || len < 1e-5) continue;
    // height profile: bowl (d^2 - 1) inside, gaussian rim at d = 1; dh/dd below
    float dbowl = d < 1.0 ? 2.0 * d * 0.5 : 0.0;
    float rim = exp(-pow((d - 1.0) / 0.22, 2.0)) * 0.35;
    float drim = rim * (-2.0 * (d - 1.0) / (0.22 * 0.22));
    // dd/dp = -(scale / rad) * c/len; height is scaled by rad/scale, so slope is size-free
    grad += -strength * (dbowl + drim) * (c / len);
    float fresh = hash13(cid + 3.3);
    alb *= 1.0 + (fresh > 0.85 ? 0.35 : 0.08) * exp(-max(d - 0.8, 0.0) * 4.0);
  }
}
void main() {
  vec3 p = normalize(vObj);
  float m = fbm3(p * 1.6 + 4.0) + 0.22 * p.x - 0.05;    // local +x faces Earth
  float mare = smoothstep(0.55, 0.66, m);
  float alb = mix(0.15, 0.07, mare) * (0.8 + 0.4 * fbm3(p * 24.0)) * (0.9 + 0.2 * fbm3(p * 90.0));
  vec3 grad = vec3(0.0);
  float dens = mix(0.7, 0.2, mare);
  craters(p, 3.0, dens * 0.45, 0.10, grad, alb);
  craters(p, 8.0, dens * 0.6, 0.12, grad, alb);
  craters(p, 22.0, dens * 0.8, 0.14, grad, alb);
  craters(p, 60.0, dens, 0.14, grad, alb);
  craters(p, 160.0, dens, 0.12, grad, alb);
  vec3 Ng = normalize(vNw);
  // object-space gradient to world, tangent part only
  vec3 gw = uObjRot * grad;
  vec3 N = normalize(Ng - (gw - dot(gw, Ng) * Ng));
  vec3 V = normalize(cameraPosition - vPw);
  float mu0 = max(dot(N, uSunDir), 0.0) * smoothstep(-0.03, 0.03, dot(Ng, uSunDir));
  float mu = max(dot(Ng, V), 0.02);
  float ls = mu0 / (mu0 + mu);
  vec3 col = vec3(1.0, 0.97, 0.93) * alb * uSunI * mix(mu0, 2.0 * ls, 0.7);
  col += vec3(0.6, 0.7, 1.0) * alb * 0.0015 * uSunI;    // earthshine, faint
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The Earth is also procedural: continents from noise, clouds, ice caps and a
// thin blue limb. It spans about 1.9 degrees, so detail is modest.
const EARTH_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSunDir; uniform float uSunI; uniform float uRadius;
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
void main() {
  vec3 p = normalize(vObj);
  float land = fbm3(p * 2.2 + 1.7);
  float lat = abs(p.y);
  vec3 alb;
  if (land > 0.53) {
    float dry = fbm3(p * 6.0 + 9.0);
    alb = mix(vec3(0.07, 0.11, 0.04), vec3(0.33, 0.27, 0.17), smoothstep(0.4, 0.62, dry + (0.3 - abs(lat - 0.35))));
  } else alb = vec3(0.015, 0.035, 0.09);
  alb = mix(alb, vec3(0.8), smoothstep(0.82, 0.9, lat + 0.05 * noise3(p * 8.0)));
  float cl = fbm3(p * vec3(3.0, 6.0, 3.0) + 31.0);
  alb = mix(alb, vec3(0.85), smoothstep(0.5, 0.68, cl));
  vec3 N = normalize(vNw);
  vec3 V = normalize(cameraPosition - vPw);
  float ndl = dot(N, uSunDir);
  float day = max(ndl, 0.0);
  vec3 col = alb * uSunI * day;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.25, 0.45, 1.0) * rim * uSunI * 0.35 * smoothstep(-0.15, 0.25, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// The quad spans SUN_QUAD disc radii; r is distance from centre in disc radii.
const SUN_QUAD = 80;
const SUN_FRAG = /* glsl */ `
precision highp float;
uniform float uSunI;
varying vec2 vUv;
void main() {
  float r = length(vUv) * ${SUN_QUAD.toFixed(1)};
  float core = 0.0;
  if (r < 1.0) core = 30.0 * (1.0 - 0.6 * (1.0 - sqrt(1.0 - r * r)));
  float glow = (2.5 / (r * r + 1.0) + 0.06 * exp(-r / 12.0)) * smoothstep(${SUN_QUAD.toFixed(1)}, ${(SUN_QUAD * 0.6).toFixed(1)}, r);
  vec3 col = vec3(1.0, 0.97, 0.92) * (core + glow) * uSunI;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const STAR_VERT = /* glsl */ `
attribute float aMag; attribute vec3 aCol;
uniform float uPx;
varying float vMag; varying vec3 vCol;
void main() {
  vMag = aMag; vCol = aCol;
  gl_PointSize = (1.2 + 2.2 * aMag) * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const STAR_FRAG = /* glsl */ `
precision highp float;
uniform float uStarI;
varying float vMag; varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float a = max(0.0, 1.0 - dot(d, d));
  gl_FragColor = vec4(vCol * a * a * (0.15 + vMag * vMag * 2.0) * uStarI, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const skyStencil = {
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.KeepStencilOp,
};

export class Sky {
  constructor() {
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.camera = new THREE.PerspectiveCamera(70, 1, 10, 3e6);
    this.sunDir = new THREE.Vector3();

    const common = {
      uSunDir: { value: this.sunDir },
      uSunI: { value: 5 },
    };
    this.common = common;

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 256, 128),
      new THREE.ShaderMaterial({ uniforms: { ...common, uObjRot: { value: new THREE.Matrix3() } }, vertexShader: SPHERE_VERT, fragmentShader: MOON_FRAG, ...skyStencil }),
    );
    this.moon.scale.setScalar(MOON_R);
    this.moon.rotation.y = Math.PI / 2;    // local +X (the near side) toward the Earth (-Z)
    this.root.add(this.moon);

    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      new THREE.ShaderMaterial({ uniforms: { ...common, uRadius: { value: EARTH_R } }, vertexShader: SPHERE_VERT, fragmentShader: EARTH_FRAG, ...skyStencil }),
    );
    this.earth.scale.setScalar(EARTH_R);
    this.earthTilt = new THREE.Group();
    this.earthTilt.rotation.z = 23.4 * Math.PI / 180;
    this.earthTilt.add(this.earth);
    this.root.add(this.earthTilt);

    const sunDist = 1e6;
    const sunDisc = sunDist * Math.tan(SUN_ANG_RADIUS);
    this.sun = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * sunDisc * SUN_QUAD, 2 * sunDisc * SUN_QUAD),
      new THREE.ShaderMaterial({
        uniforms: { uSunI: common.uSunI }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, ...skyStencil,
      }),
    );
    this.sun.position.set(sunDist, 0, 0);
    this.sun.renderOrder = 2;
    this.root.add(this.sun);

    // Stars: a fixed random sky (not a real catalogue), faint, as they would be
    // next to sunlit surfaces.
    const rand = mulberry32(1969);
    const n = 6000;
    const pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const z = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      pos.set([1.5e6 * s * Math.cos(t), 1.5e6 * s * Math.sin(t), 1.5e6 * z], i * 3);
      mag[i] = Math.pow(rand(), 6);
      const warm = rand();
      col.set(warm < 0.3 ? [1, 0.85, 0.7] : warm > 0.85 ? [0.75, 0.85, 1] : [1, 1, 1], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    sg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    this.starUniforms = { uPx: { value: 1 }, uStarI: { value: 0.6 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, ...skyStencil,
    }));
    this.stars.renderOrder = 1;
    this.stars.frustumCulled = false;
    this.root.add(this.stars);
  }

  /**
   * stationPos: the station's position relative to the Moon's centre (inertial, km).
   * invAttitude: quaternion taking inertial vectors into the station frame.
   */
  update({ stationPos, invAttitude, sunI, pixelRatio, earthSpin }) {
    this.root.quaternion.copy(invAttitude);
    this.moon.position.copy(stationPos).negate();
    this.earthTilt.position.set(0, 0, -EARTH_DIST).sub(stationPos);
    this.earth.rotation.y = earthSpin;
    this.sunDir.set(1, 0, 0).applyQuaternion(invAttitude);
    this.common.uSunI.value = sunI;
    this.starUniforms.uPx.value = pixelRatio;
    this.root.updateMatrixWorld(true);
    this.sun.lookAt(0, 0, 0);
    // rotation part of the Moon's world matrix, for its crater slopes
    this.moon.material.uniforms.uObjRot.value.setFromMatrix4(this.moon.matrixWorld).multiplyScalar(1 / MOON_R);
  }

  /** Point the sky camera the same way as the station camera. */
  syncCamera(cam) {
    this.camera.quaternion.copy(cam.quaternion);
    this.camera.fov = cam.fov;
    this.camera.aspect = cam.aspect;
    this.camera.updateProjectionMatrix();
  }
}

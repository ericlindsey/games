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
import { MOON_R, MOON_ALBEDO, EARTH_R, EARTH_DIST, SUN_ANG_RADIUS } from './physics.js';

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
// Moon), with wrinkle ridges; highlands are rough. Craters come from up to seven
// octaves of cellular noise: bowls when small, flat floors, terraced walls and
// central peaks when large, each casting its own shadow near the terminator.
// Eight big young craters throw bright rays. Octaves too small to see at the
// current zoom fade out, so detail follows the field of view.
const MOON_FRAG = /* glsl */ `
precision highp float;
#ifndef QUALITY
#define QUALITY 2
#endif
uniform vec3 uSunDir; uniform vec3 uSunObj; uniform float uSunI; uniform mat3 uObjRot;
uniform vec4 uRays[8];
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
const float TAU = 6.28318531;
#ifdef USE_MAPS
// Real data (NASA SVS CGI Moon Kit): LROC colour, LOLA elevation in km above
// 1737.4 km, both equirectangular, centred on 0° longitude, north at v = 1.
// Local +x is (0°, 0°), the centre of the near side; +y is north; east is -z.
uniform sampler2D uColor; uniform sampler2D uHeight;
uniform vec2 uHTexel; uniform float uAlbScale;
const float PI = 3.14159265;
const float R_KM = 1737.4;
#if QUALITY > 1
#define SHADOW_STEPS 40
#elif QUALITY > 0
#define SHADOW_STEPS 24
#else
#define SHADOW_STEPS 12
#endif
vec2 uvOf(vec3 p) { return vec2(atan(-p.z, p.x) / TAU + 0.5, asin(clamp(p.y, -1.0, 1.0)) / PI + 0.5); }
// Terrain shadow: march from the point toward the sun over the elevation map,
// steps growing to ~600 km; the ray climbs at the sun's elevation and the
// sphere falls away beneath it. Soft over the sun's 0.53° disc. Heights are
// read at no finer a mip than the pixel's own footprint (lodPix), the start
// height included, so a blurred start never sits below sharp nearby rims; the
// march starts a footprint away; and the shadow edge is never sharper than a
// pixel. (Mixing a blurred start with sharp steps made false black blotches
// near the limb, where a pixel spans many kilometres.)
float terrainShadow(vec3 p, vec2 uv, float lodPix, float footKm, vec3 Lhd, float tanE) {
  float texKm = uHTexel.x * TAU * R_KM;
  float s = max(2.0, footKm);
  float grow = pow(600.0 / s, 1.0 / float(SHADOW_STEPS));
  float h0 = textureLod(uHeight, uv, lodPix).r;
  float res = 1.0;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float th = s / R_KM;
    vec3 q = p * cos(th) + Lhd * sin(th);
    float ray = h0 + s * tanE + s * s / (2.0 * R_KM);
    float lod = max(lodPix, log2(max(1.0, s * 0.3 / texKm)));
    float hq = textureLod(uHeight, uvOf(q), lod).r;
    res = min(res, (ray - hq) / (s * 0.0093 + 0.15 * footKm * max(tanE, 0.05)) + 0.5);
    if (res <= 0.0) break;
    s *= grow;
  }
  return clamp(res, 0.0, 1.0);
}
#endif

// value noise with its analytic gradient (xyz) in .yzw
vec4 noised(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash13(i), b = hash13(i + vec3(1,0,0)), c = hash13(i + vec3(0,1,0)), d = hash13(i + vec3(1,1,0));
  float e = hash13(i + vec3(0,0,1)), f1 = hash13(i + vec3(1,0,1)), g = hash13(i + vec3(0,1,1)), h = hash13(i + vec3(1,1,1));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f1, k7 = -a + b + c - d + e - f1 - g + h;
  float v = a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 dv = du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
                      k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
                      k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y);
  return vec4(v, dv);
}

// Crater height profile over d = distance / radius, in units of depth.
// cx: 0 simple bowl … 1 complex (flat floor, terraces, central peak).
float prof(float d, float cx) {
  float h = 0.0;
  if (d < 1.0) {
    float bowl = d * d - 1.0;
    float flr = max(bowl, -0.6);
    h = mix(bowl, flr, cx);
    if (cx > 0.4) { float x = (h + 1.0) * 5.0; h = mix(h, (floor(x) + smoothstep(0.25, 0.75, fract(x))) / 5.0 - 1.0, cx * 0.7); }
    h += cx * 0.45 * exp(-d * d / 0.012);
  }
  h += 0.22 * exp(-pow((d - 1.0) / 0.28, 2.0));
  if (d > 1.0) h += 0.06 * exp(-(d - 1.0) * 2.5);
  return h;
}
float dprof(float d, float cx) { return (prof(d + 0.01, cx) - prof(d - 0.01, cx)) / 0.02; }

// Shadow inside a crater: walk from the point toward the sun, horizontally,
// as far as the ray needs to climb to rim height; if that lands outside the rim
// circle, the wall blocks the sun. o: offset from the centre (same units as rad).
float craterShadow(vec3 o, float rad, float depth, float d, float cx, vec3 Lhd, float tanE) {
  if (d >= 1.0 || tanE <= 0.0) return 1.0;
  float below = depth * (0.22 - prof(d, cx));
  if (below <= 0.0) return 1.0;
  // the ray reaches rim height after this far; if it has left the rim circle
  // by then, it passed the rim while still below it: shadow
  vec3 q = o + Lhd * (below / tanE);
  return smoothstep(1.04, 0.94, length(q) / rad);
}

void craters(vec3 p, float scale, float density, float px, vec3 Lhd, float tanE,
             inout vec3 grad, inout float alb, inout float shadow) {
  float w = smoothstep(1.2 * px, 4.0 * px, 0.2 / scale);
  if (w <= 0.0) return;
  vec3 x = p * scale, ip = floor(x), fp = fract(x);
  float big = smoothstep(30.0, 3.0, scale);      // large craters are complex
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 cid = ip + vec3(i, j, k);
    if (hash13(cid * 1.37 + 11.0) > density) continue;
    vec3 c = vec3(i, j, k) + 0.2 + 0.6 * hash33(cid) - fp;
    float rad = 0.1 + 0.32 * pow(hash13(cid + 7.1), 2.5);
    float len = length(c);
    float d = len / rad;
    if (d > 2.2 || len < 1e-5) continue;
    float cx = big * smoothstep(0.15, 0.35, rad);
    float S = mix(0.3, 0.16, cx);                 // depth / radius
    vec3 away = -c / len;
    grad += w * S * dprof(d, cx) * away;
    float fresh = hash13(cid + 3.3);
    alb *= 1.0 + w * (fresh > 0.88 ? 0.3 : 0.03) * smoothstep(1.15, 0.6, d);
    vec3 o = -c; o -= dot(o, p) * p;
    shadow *= mix(1.0, craterShadow(o, rad, S * rad, d, cx, Lhd, tanE), w);
  }
}

void main() {
  vec3 p = normalize(vObj);
  float px = length(fwidth(vObj));
  vec3 Ls = normalize(uSunObj);
  float sinE = dot(Ls, p);
  vec3 Lh = Ls - sinE * p;
  float lh = max(length(Lh), 1e-4);
  vec3 Lhd = Lh / lh;
  float tanE = sinE / lh;

  vec3 grad = vec3(0.0);
  float shadow = 1.0;
  float alb = 1.0;
  vec3 tint;
#ifdef USE_MAPS
  vec2 uv = uvOf(p);
  float lat = (uv.y - 0.5) * PI, lon = (uv.x - 0.5) * TAU;
  // Footprints in ground terms. Toward the poles a map texel spans cos(lat) as
  // much ground east-west as north-south, so the map is oversampled there in
  // longitude. Shrinking the u gradient by cos(lat) stops the GPU from blowing
  // up the mip level (and blurring latitude too) to cover a footprint that is
  // long only in map space: that was the radial smear round the poles.
  float cl = max(cos(lat), 1e-3);
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5); gy.x -= floor(gy.x + 0.5);          // no seam where longitude wraps
  gx.x *= cl; gy.x *= cl;
  tint = textureGrad(uColor, uv, gx, gy).rgb * uAlbScale;
  float footKm = max(length(dFdx(p)), length(dFdy(p))) * R_KM;  // a pixel's size on the ground
  float texKm = PI * R_KM * uHTexel.y;                           // an elevation texel, north-south
  float stepKm = max(texKm, footKm);
  float lod = log2(max(1.0, footKm / texKm));
  // slopes from heights a step east, west, north and south on the sphere itself
  // (not in map space, which pinches at the poles)
  vec3 E = vec3(-sin(lon), 0.0, -cos(lon));
  vec3 Nn = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));
  float dl = stepKm / R_KM;
  float hE = textureLod(uHeight, uvOf(normalize(p + E * dl)), lod).r, hW = textureLod(uHeight, uvOf(normalize(p - E * dl)), lod).r;
  float hN = textureLod(uHeight, uvOf(normalize(p + Nn * dl)), lod).r, hS = textureLod(uHeight, uvOf(normalize(p - Nn * dl)), lod).r;
  grad += (hE - hW) / (2.0 * stepKm) * E + (hN - hS) / (2.0 * stepKm) * Nn;
  if (sinE > -0.03) shadow *= terrainShadow(p, uv, lod, footKm, Lhd, tanE);
  // finer than the maps: small craters and roughness, only once zoomed in that far
  float f = 600.0;
  for (int o = 0; o < 6; o++) {
    float w = smoothstep(1.5 * px, 5.0 * px, 0.5 / f);
    if (w <= 0.0) break;
    vec4 n = noised(p * f + float(o) * 13.7);
    grad += w * 0.06 * n.yzw;
    f *= 2.17;
  }
  craters(p, 450.0, 0.8, px, Lhd, tanE, grad, alb, shadow);
#if QUALITY > 0
  craters(p, 1000.0, 0.9, px, Lhd, tanE, grad, alb, shadow);
#endif
#if QUALITY > 1
  craters(p, 2200.0, 1.0, px, Lhd, tanE, grad, alb, shadow);
#endif
#else
  // seas and highlands
  float m = fbm3(p * 1.6 + 4.0) + 0.22 * p.x - 0.05;    // local +x faces Earth
  float mare = smoothstep(0.55, 0.64, m);
  alb = mix(0.16, 0.068, mare) * (0.8 + 0.4 * fbm3(p * 24.0)) * (0.9 + 0.2 * fbm3(p * 90.0));
  tint = mix(vec3(1.0, 0.99, 0.97), mix(vec3(0.95, 0.97, 1.03), vec3(1.04, 1.0, 0.94), fbm3(p * 5.0 + 9.0)), mare);

  // rolling terrain: rough highlands, smoother seas with wrinkle ridges
  float rough = mix(1.0, 0.3, mare);
  float f = 4.0;
  for (int o = 0; o < 8; o++) {
    float w = smoothstep(1.5 * px, 5.0 * px, 0.5 / f);
    if (w <= 0.0) break;
    vec4 n = noised(p * f + float(o) * 13.7);
    grad += w * rough * 0.075 * n.yzw;               // height ~ 1/f, so slope ~ constant
    f *= 2.17;
  }
  {
    vec4 n = noised(p * 7.0 + 31.0);
    float s = sign(n.x - 0.5);
    grad += mare * 0.06 * (-2.0 * s) * n.yzw;       // ridged: 1 - |2n - 1|
  }

  float dens = mix(0.8, 0.25, mare);
  craters(p, 2.5, dens * 0.4, px, Lhd, tanE, grad, alb, shadow);
  craters(p, 6.0, dens * 0.55, px, Lhd, tanE, grad, alb, shadow);
  craters(p, 14.0, dens * 0.7, px, Lhd, tanE, grad, alb, shadow);
  craters(p, 34.0, dens * 0.9, px, Lhd, tanE, grad, alb, shadow);
#if QUALITY > 0
  craters(p, 80.0, dens * 1.1, px, Lhd, tanE, grad, alb, shadow);
  craters(p, 190.0, dens * 1.2, px, Lhd, tanE, grad, alb, shadow);
#endif
#if QUALITY > 1
  craters(p, 450.0, dens * 1.2, px, Lhd, tanE, grad, alb, shadow);
#endif

  // big young craters and their rays
  for (int i = 0; i < 8; i++) {
    vec3 c = uRays[i].xyz;
    float rr = uRays[i].w;
    float cd = dot(p, c);
    if (cd < 0.0) continue;
    vec3 dv = p - c * cd;
    float g = length(dv);
    float d = g / rr;
    if (d > 16.0) continue;
    vec3 t1 = normalize(cross(c, abs(c.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(c, t1);
    float az = atan(dot(dv, t2), dot(dv, t1)) / TAU * 64.0;
    float i0 = floor(az);
    float h0 = hash13(vec3(mod(i0, 64.0), float(i), 3.0)), h1 = hash13(vec3(mod(i0 + 1.0, 64.0), float(i), 3.0));
    float streak = smoothstep(0.55, 0.95, mix(h0, h1, smoothstep(0.0, 1.0, fract(az))));
    streak *= 0.6 + 0.4 * noise3(p * 300.0);
    if (d > 1.0) alb += (0.09 * streak * exp(-(d - 1.0) / 5.0) + 0.06 * exp(-(d - 1.0) / 0.7)) * (1.0 - 0.3 * mare);
    if (d < 2.2 && g > 1e-6) {
      vec3 away = dv / g;
      grad += 0.16 * dprof(d, 1.0) * away;
      shadow *= craterShadow(dv, rr, 0.16 * rr, d, 1.0, Lhd, tanE);
      if (d < 1.0) alb *= 1.15;
    }
  }

#endif

  vec3 Ng = normalize(vNw);
  vec3 gw = uObjRot * grad;                         // object-space slope to world, tangent part
  vec3 N = normalize(Ng - (gw - dot(gw, Ng) * Ng));
  vec3 V = normalize(cameraPosition - vPw);
  float mu0 = max(dot(N, uSunDir), 0.0) * smoothstep(-0.03, 0.03, dot(Ng, uSunDir)) * shadow;
  float mu = max(dot(Ng, V), 0.02);
  float ls = mu0 / (mu0 + mu);
  vec3 col = vec3(1.0, 0.97, 0.93) * tint * alb * uSunI * mix(mu0, 2.0 * ls, 0.7);
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
  if (land <= 0.53) {                                   // sun glint on open ocean
    vec3 H = normalize(uSunDir + V);
    col += vec3(1.0, 0.95, 0.85) * uSunI * 0.5 * pow(max(dot(N, H), 0.0), 80.0) * (1.0 - smoothstep(0.5, 0.68, cl)) * step(0.0, ndl);
  }
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
uniform float uSunI; uniform float uGlow;
varying vec2 vUv;
void main() {
  float r = length(vUv) * ${SUN_QUAD.toFixed(1)};
  float core = 0.0;
  if (r < 1.0) core = 30.0 * (1.0 - 0.6 * (1.0 - sqrt(1.0 - r * r)));
  float glow = uGlow * (2.5 / (r * r + 1.0) + 0.06 * exp(-r / 12.0)) * smoothstep(${SUN_QUAD.toFixed(1)}, ${(SUN_QUAD * 0.6).toFixed(1)}, r);
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

// Mean linear luminance of moon_color_*.jpg (printed by tools/moon_maps.py);
// the map is brightness-normalised, so it is scaled to the Moon's mean albedo.
const MOON_MAP_MEAN = 0.5075;

/** Decode moon_height_2k.webp (see tools/moon_maps.py) to a half-float texture of km, with mipmaps. */
async function loadHeight(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const W = bmp.width, H = bmp.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  let km = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = (H - 1 - y) * W;                // image row 0 is north; texture v = 1 is north
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, hi = d[i];
      const lo = hi & 1 ? 255 - d[i + 1] : d[i + 1];
      km[row + x] = ((hi * 256 + lo) * 8 - 10000) / 1000;
    }
  }
  const half = (f) => { const o = new Uint16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = THREE.DataUtils.toHalfFloat(f[i]); return o; };
  const mipmaps = [];
  let w = W, h = H;
  for (;;) {
    mipmaps.push({ data: half(km), width: w, height: h });
    if (w === 1 && h === 1) break;
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), next = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1), y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
      next[y * nw + x] = (km[y0 * w + x0] + km[y0 * w + x1] + km[y1 * w + x0] + km[y1 * w + x1]) / 4;
    }
    km = next; w = nw; h = nh;
  }
  const tex = new THREE.DataTexture(mipmaps[0].data, W, H, THREE.RedFormat, THREE.HalfFloatType);
  tex.mipmaps = mipmaps;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

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

    // eight big young craters with ray systems, scattered at random
    const rr = mulberry32(4242);
    const rays = Array.from({ length: 8 }, () => {
      const z = rr() * 2 - 1, t = rr() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      return new THREE.Vector4(s * Math.cos(t), s * Math.sin(t), z, 0.012 + 0.03 * rr());
    });
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 256, 128),
      new THREE.ShaderMaterial({ uniforms: { ...common, uObjRot: { value: new THREE.Matrix3() }, uSunObj: { value: new THREE.Vector3() }, uRays: { value: rays }, uColor: { value: null }, uHeight: { value: null }, uHTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) }, uAlbScale: { value: MOON_ALBEDO / MOON_MAP_MEAN } }, vertexShader: SPHERE_VERT, fragmentShader: MOON_FRAG, ...skyStencil }),
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
        uniforms: { uSunI: common.uSunI, uGlow: { value: 1 } }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
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
    const rot = this.moon.material.uniforms.uObjRot.value.setFromMatrix4(this.moon.matrixWorld).multiplyScalar(1 / MOON_R);
    this.moon.material.uniforms.uSunObj.value.copy(this.sunDir).applyMatrix3(new THREE.Matrix3().copy(rot).transpose());
  }

  /** 0 low … 2 high: crater octaves on the Moon, and less painted glare once bloom is on. */
  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    this.applyMoonDefines();
    this.sun.material.uniforms.uGlow.value = q > 0 ? 0.35 : 1;
    // High quality gets the 4k colour map; the others the 2k one
    const want = q > 1 ? 4 : 2;
    if (this.colorK !== want && !this.loadingK) this.loadMoonMaps(want);
  }

  applyMoonDefines() {
    this.moon.material.defines = this.mapsReady ? { QUALITY: this.quality, USE_MAPS: '' } : { QUALITY: this.quality };
    this.moon.material.needsUpdate = true;
  }

  /**
   * Fetch the real Moon: colour (2k or 4k JPEG) and elevation (lossless WebP,
   * decoded to half-float kilometres with CPU-built mipmaps). Until both arrive,
   * or if they can't be loaded, the procedural Moon stands in.
   */
  async loadMoonMaps(k) {
    this.loadingK = k;
    try {
      const base = new URL('../assets/moon/', import.meta.url);
      const color = new THREE.TextureLoader().loadAsync(new URL(`moon_color_${k}k.jpg`, base).href);
      const height = this.heightTex ? Promise.resolve(this.heightTex) : loadHeight(new URL('moon_height_2k.webp', base).href);
      const [c, h] = await Promise.all([color, height]);
      c.colorSpace = THREE.SRGBColorSpace;
      c.wrapS = THREE.RepeatWrapping; c.wrapT = THREE.ClampToEdgeWrapping;
      c.anisotropy = 8;
      const u = this.moon.material.uniforms;
      u.uColor.value?.dispose();
      u.uColor.value = c;
      u.uHeight.value = this.heightTex = h;
      u.uHTexel.value.set(1 / h.image.width, 1 / h.image.height);
      this.colorK = k;
      this.mapsReady = true;
      this.applyMoonDefines();
    } catch (e) {
      console.warn('Moon maps not loaded; using the procedural Moon.', e);
    } finally {
      this.loadingK = 0;
    }
  }

  /** Point the sky camera the same way as the station camera. */
  syncCamera(cam) {
    this.camera.quaternion.copy(cam.quaternion);
    this.camera.fov = cam.fov;
    this.camera.aspect = cam.aspect;
    this.camera.updateProjectionMatrix();
  }
}

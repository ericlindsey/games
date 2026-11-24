// GLSL for every surface of the station.
//
// Sunlight is not shadow-mapped. The station's structure is simple enough to
// ray-trace exactly in the fragment shader: from each point, a ray toward the sun
// is tested against the floor shell, the ceiling (with its window grid), the two
// side walls (with theirs), the hub, the spokes, the ceiling ribs and the nearest
// tree crowns (ellipsoids, read from a data texture). So the window patches on the
// floor are exact at any ring size, and they sweep as the ring turns. The same
// window functions cut the holes (discard), so what you see through and what
// light comes through always agree.
//
// Surfaces are textured from procedural tiles (src/textures.js): the shells by
// arc length and height or axial position, everything else triplanar. Each
// material binds up to four albedo/normal pairs (A–D); what they hold depends on
// uKind (see station.js).
//
// Station frame: spin axis is +Z, the floor is the cylinder r = uR, the ceiling
// r = uR - uH, the side walls are the planes z = ±uHW.

export const stationVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vCol;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
#ifdef USE_COLOR
  vCol = color;
#else
  vCol = vec3(1.0);
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const stationFragment = /* glsl */ `
precision highp float;
precision highp sampler2D;

#ifndef QUALITY
#define QUALITY 2
#endif

uniform float uR, uH, uHW;
uniform float uCeilN, uCeilFill, uCeilHalfZ;
uniform float uSideN, uSideFill, uSideLo, uSideHi;
uniform float uSpokeN, uSpokeR, uHubR, uHubHalfL;
uniform float uRibN, uRibD;
uniform float uTreeN, uTreeRows, uCrownH;
uniform sampler2D uTreeTex;
uniform float uPathHW, uBedW;
uniform float uLampN, uLampZ, uLampH;
uniform vec3 uSunDir, uSunCol, uMoonDir, uMoonCol;
uniform float uCabin, uBounce;
uniform int uKind;   // 0 floor, 1 ceiling, 2 side wall, 3 hub/spoke, 4 trunk, 5 foliage, 6 rib, 7 wood, 8 dark metal, 9 lamp head

uniform sampler2D uAlbA, uNrmA, uAlbB, uNrmB, uAlbC, uNrmC, uAlbD, uNrmD;
uniform float uSizeA, uSizeB, uSizeC, uSizeD;

varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vCol;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float EPS = 1e-3;

float angOf(vec2 p) { float a = atan(p.y, p.x); return a < 0.0 ? a + TAU : a; }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

// ---------------------------------------------------------------- windows ----

// Ceiling glass: a skylight round the ring, centred across the width, broken
// where a spoke meets the ceiling. m > 0 widens the panes and drops the
// mullions (used to draw frames). Glazing bars every ~1.8 m both ways.
bool ceilGlass(vec3 q, float m) {
  if (uCeilN < 0.5 || uCeilFill <= 0.0) return false;
  if (abs(q.z) > uCeilHalfZ + m) return false;
  float rc = uR - uH;
  float a = angOf(q.xy);
  float cell = TAU / uCeilN;
  float k = floor(a / cell);
  float clen = cell * rc;
  float u = (a / cell - k - 0.5) * clen;
  float hl = 0.5 * uCeilFill * clen;
  if (abs(u) > hl + m) return false;
  if (uSpokeN > 0.5) {
    float sp = TAU / uSpokeN;
    float d = abs(mod((k + 0.5) * cell + 0.5 * sp, sp) - 0.5 * sp) * rc;
    if (d < uSpokeR + 0.5 * clen + 0.5) return false;
  }
  float bw = 0.05 - m;
  if (bw > 0.0) {
    float nu = max(1.0, floor(2.0 * hl / 1.8));
    float pu = 2.0 * hl / nu;
    float xu = mod(u + hl, pu);
    if (min(xu, pu - xu) < bw && abs(u) < hl - bw) return false;
    float nz = max(1.0, floor(2.0 * uCeilHalfZ / 1.8));
    float pz = 2.0 * uCeilHalfZ / nz;
    float xz = mod(q.z + uCeilHalfZ, pz);
    if (min(xz, pz - xz) < bw && abs(q.z) < uCeilHalfZ - bw) return false;
  }
  return true;
}

// Side-wall glass: a band of windows between sill and head height, all round.
bool sideGlass(vec3 q, float m) {
  if (uSideN < 0.5 || uSideFill <= 0.0) return false;
  float h = uR - length(q.xy);
  if (h < uSideLo - m || h > uSideHi + m) return false;
  float a = angOf(q.xy);
  float cell = TAU / uSideN;
  float k = floor(a / cell);
  float clen = cell * uR;
  float u = (a / cell - k - 0.5) * clen;
  float hl = 0.5 * uSideFill * clen;
  if (abs(u) > hl + m) return false;
  float bw = 0.04 - m;
  if (bw > 0.0) {
    float nu = max(1.0, floor(2.0 * hl / 1.4));
    float pu = 2.0 * hl / nu;
    float xu = mod(u + hl, pu);
    if (min(xu, pu - xu) < bw && abs(u) < hl - bw) return false;
    float span = uSideHi - uSideLo;
    float nh = max(1.0, floor(span / 1.6));
    float ph = span / nh;
    float xh = mod(h - uSideLo, ph);
    if (min(xh, ph - xh) < bw && h > uSideLo + bw && h < uSideHi - bw) return false;
  }
  return true;
}

// ------------------------------------------------------------ trees data ----

// Two texels per tree: (angle, z, horizontal radius, vertical radius) and
// (crown-centre height above floor, species, trunk height, trunk radius).
vec4 treeA(int k, int row) { return texelFetch(uTreeTex, ivec2(k, row * 2), 0); }
vec4 treeB(int k, int row) { return texelFetch(uTreeTex, ivec2(k, row * 2 + 1), 0); }
vec3 crownCentre(vec4 A, vec4 B) {
  return vec3((uR - B.x) * cos(A.x), (uR - B.x) * sin(A.x), A.y);
}
int wrapTree(float k) { return int(mod(k, uTreeN)); }

// ------------------------------------------------------------- shadowing ----

// 1 if the ray p + tL (t > 0) leaves the station without hitting anything solid.
float occl(vec3 p, vec3 L) {
  float rc = uR - uH;
  float a = dot(L.xy, L.xy);
  float b = dot(p.xy, L.xy);
  float pp = dot(p.xy, p.xy);
  if (a > 1e-9) {
    float d, s, t;
    // floor shell: solid wherever |z| <= half width
    d = b * b - a * (pp - uR * uR);
    if (d > 0.0) {
      s = sqrt(d);
      t = (-b - s) / a; if (t > EPS && abs(p.z + t * L.z) <= uHW) return 0.0;
      t = (-b + s) / a; if (t > EPS && abs(p.z + t * L.z) <= uHW) return 0.0;
    }
    // ceiling: solid except glass
    d = b * b - a * (pp - rc * rc);
    if (d > 0.0) {
      s = sqrt(d);
      t = (-b - s) / a;
      if (t > EPS) { vec3 q = p + t * L; if (abs(q.z) <= uHW && !ceilGlass(q, 0.0)) return 0.0; }
      t = (-b + s) / a;
      if (t > EPS) { vec3 q = p + t * L; if (abs(q.z) <= uHW && !ceilGlass(q, 0.0)) return 0.0; }
    }
    // hub barrel
    d = b * b - a * (pp - uHubR * uHubR);
    if (d > 0.0) {
      s = sqrt(d);
      t = (-b - s) / a; if (t > EPS && abs(p.z + t * L.z) <= uHubHalfL) return 0.0;
      t = (-b + s) / a; if (t > EPS && abs(p.z + t * L.z) <= uHubHalfL) return 0.0;
    }
  }
  if (abs(L.z) > 1e-6) {
    for (int i = 0; i < 2; i++) {
      float zw = i == 0 ? uHW : -uHW;
      float t = (zw - p.z) / L.z;
      if (t > EPS) {
        vec3 q = p + t * L;
        float r = length(q.xy);
        if (r >= rc && r <= uR && !sideGlass(q, 0.0)) return 0.0;
      }
      float zh = i == 0 ? uHubHalfL : -uHubHalfL;
      t = (zh - p.z) / L.z;
      if (t > EPS && length((p + t * L).xy) <= uHubR) return 0.0;
    }
  }
  // spokes: finite cylinders from the hub out to the ceiling
  for (int k = 0; k < 12; k++) {
    if (float(k) >= uSpokeN) break;
    float ang = float(k) * TAU / uSpokeN;
    vec3 D = vec3(cos(ang), sin(ang), 0.0);
    vec3 w = p - dot(p, D) * D;
    vec3 v = L - dot(L, D) * D;
    float aa = dot(v, v);
    if (aa < 1e-9) continue;
    float bb = dot(w, v);
    float dd = bb * bb - aa * (dot(w, w) - uSpokeR * uSpokeR);
    if (dd <= 0.0) continue;
    float ss = sqrt(dd);
    float t0 = (-bb - ss) / aa, t1 = (-bb + ss) / aa;
    if (t0 > EPS) { float x = dot(p + t0 * L, D); if (x >= uHubR && x <= rc) return 0.0; }
    if (t1 > EPS) { float x = dot(p + t1 * L, D); if (x >= uHubR && x <= rc) return 0.0; }
  }
  // ribs: thin radial slabs at every ceiling frame, a beam under the ceiling
  // and a post down each wall; tested near the point and where the ray leaves
  // the rib layer
  if (uRibN > 0.5) {
    float cell = TAU / uRibN;
    float rr = rc + uRibD;
    float a0 = angOf(p.xy), a1 = a0;
    if (a > 1e-9) {
      float d = b * b - a * (pp - rr * rr);
      if (d > 0.0) {
        float t = (-b - sqrt(d)) / a;
        if (t < EPS) t = (-b + sqrt(d)) / a;
        if (t > EPS) a1 = angOf((p + t * L).xy);
      }
    }
    for (int c = 0; c < 2; c++) {
      float k0 = floor((c == 0 ? a0 : a1) / cell + 0.5);
      for (int j = -1; j <= 1; j++) {
        float ang = (k0 + float(j)) * cell;
        vec2 dir = vec2(cos(ang), sin(ang));
        vec3 n = vec3(-dir.y, dir.x, 0.0);
        float den = dot(L, n);
        if (abs(den) < 1e-6) continue;
        float t = -dot(p, n) / den;
        if (t <= EPS) continue;
        vec3 q = p + t * L;
        if (dot(q.xy, dir) <= 0.0) continue;
        float rq = length(q.xy);
        if (rq < rc || rq > uR || abs(q.z) > uHW) continue;
        if (rq < rr || abs(q.z) > uHW - uRibD) return 0.0;
      }
    }
  }
  // tree crowns: ellipsoids for the trees nearest the point, and nearest where
  // the ray crosses mean crown height
  if (uTreeN > 0.5) {
    float cell = TAU / uTreeN;
    float rcr = uR - uCrownH;
    float a0 = angOf(p.xy), a1 = a0;
    if (a > 1e-9) {
      float d = b * b - a * (pp - rcr * rcr);
      if (d > 0.0) {
        float t = (-b - sqrt(d)) / a;
        if (t < EPS) t = (-b + sqrt(d)) / a;
        if (t > EPS) a1 = angOf((p + t * L).xy);
      }
    }
    for (int c = 0; c < 2; c++) {
      float ac = c == 0 ? a0 : a1;
      for (int row = 0; row < 6; row++) {
        if (float(row) >= uTreeRows) break;
        float off = mod(float(row), 2.0) * 0.5;
        float k0 = floor(ac / cell - off + 0.5);
        for (int j = -1; j <= 1; j++) {
          int k = wrapTree(k0 + float(j));
          vec4 A = treeA(k, row), B = treeB(k, row);
          vec3 C = crownCentre(A, B);
          vec3 up = -vec3(cos(A.x), sin(A.x), 0.0);
          float sc = A.z / A.w - 1.0;           // squash the ellipsoid into a sphere
          vec3 oc = p - C;
          oc += dot(oc, up) * sc * up;
          vec3 Ls = L + dot(L, up) * sc * up;
          float rad = 0.86 * A.z;
          float aq = dot(Ls, Ls), bq = dot(oc, Ls);
          float dq = bq * bq - aq * (dot(oc, oc) - rad * rad);
          if (dq > 0.0 && (-bq + sqrt(dq)) / aq > EPS) return 0.0;
        }
      }
    }
  }
  return 1.0;
}

// ----------------------------------------------------------- texturing ----

float lines(float x, float period, float hw, float px) {
  float d = abs(fract(x / period + 0.5) - 0.5) * period;
  float l = 1.0 - smoothstep(hw, hw + px, d);
  return mix(l, min(1.0, 2.0 * hw / period), smoothstep(period * 0.15, period * 0.4, px));
}
// Arc length that tiles evenly round the ring (no seam at angle 0).
float arcM(vec2 xy, float r, float period) {
  float n = max(1.0, floor(TAU * r / period + 0.5));
  return angOf(xy) / TAU * n * period;
}

// Sample a tile by metre coordinates with explicit gradients, so the wrap of
// the arc coordinate at angle 0 never shows as a seam.
vec4 samp(sampler2D t, vec2 uv, vec2 dx, vec2 dy, float size) {
  return textureGrad(t, uv / size, dx / size, dy / size);
}
vec3 tnorm(sampler2D t, vec2 uv, vec2 dx, vec2 dy, float size, float k) {
  vec3 n = samp(t, uv, dx, dy, size).xyz * 2.0 - 1.0;
  n.xy *= k;
  return n;
}
// Triplanar albedo and normal (whiteout blend) for odd shapes.
void triplanar(sampler2D ta, sampler2D tn, vec3 p, vec3 N, float size, float k, out vec4 alb, out vec3 nrm) {
  vec3 w = pow(abs(N), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec2 ux = p.zy / size, uy = p.xz / size, uz = p.xy / size;
  alb = texture(ta, ux) * w.x + texture(ta, uy) * w.y + texture(ta, uz) * w.z;
  vec3 nx = texture(tn, ux).xyz * 2.0 - 1.0; nx.xy *= k;
  vec3 ny = texture(tn, uy).xyz * 2.0 - 1.0; ny.xy *= k;
  vec3 nz = texture(tn, uz).xyz * 2.0 - 1.0; nz.xy *= k;
  nx = vec3(nx.xy + N.zy, abs(nx.z) * N.x);
  ny = vec3(ny.xy + N.xz, abs(ny.z) * N.y);
  nz = vec3(nz.xy + N.xy, abs(nz.z) * N.z);
  nrm = normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
}

// Flowers in the beds: a jittered dot per 11 cm cell, colours by stretch of bed.
vec4 flowers(vec2 m, float px) {
  vec2 c = m / 0.11;
  vec2 id = floor(c);
  vec2 f = fract(c) - 0.5 - (hash22(id) - 0.5) * 0.4;
  float has = step(0.35, hash12(id + 7.3));
  float ang = atan(f.y, f.x);
  float rr = 0.32 * (0.75 + 0.25 * cos(5.0 * ang + hash12(id) * 6.0));
  float d = length(f);
  float seg = floor(m.x / 5.0) + 17.0 * sign(m.y);
  float pick = hash12(vec2(seg, 3.0));
  vec3 col = pick < 0.2 ? vec3(0.55, 0.05, 0.06) : pick < 0.4 ? vec3(0.6, 0.45, 0.04) : pick < 0.6 ? vec3(0.28, 0.08, 0.45)
           : pick < 0.8 ? vec3(0.62, 0.6, 0.55) : vec3(0.65, 0.22, 0.03);
  col *= 0.8 + 0.4 * hash12(id + 1.1);
  if (d < 0.09) col = vec3(0.6, 0.45, 0.05);
  float cover = has * (1.0 - smoothstep(rr - 0.03, rr + 0.03, d));
  cover = mix(cover, has * 0.25, smoothstep(0.008, 0.03, px));   // average out far away
  return vec4(col, cover);
}

// GGX specular, scaled by π to match the diffuse convention (albedo × E × N·L).
vec3 ggx(vec3 N, vec3 V, vec3 L, float rough, vec3 F0) {
  vec3 H = normalize(V + L);
  float NoH = max(dot(N, H), 0.0), NoV = max(dot(N, V), 1e-4), NoL = max(dot(N, L), 0.0), VoH = max(dot(V, H), 0.0);
  float a = max(rough * rough, 0.006);
  float a2 = a * a;
  float dd = NoH * NoH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = (NoV / (NoV * (1.0 - k) + k)) * (NoL / (NoL * (1.0 - k) + k));
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
  return D * G * F / (4.0 * NoV * max(NoL, 1e-4)) * PI * NoL;
}

void main() {
  vec3 p = vPos;
  if (uKind == 1 && ceilGlass(p, 0.0)) discard;
  if (uKind == 2 && sideGlass(p, 0.0)) discard;

  vec3 Ng = normalize(vNrm);
  if (!gl_FrontFacing) Ng = -Ng;
  bool shell = uKind <= 2;
  bool inside = gl_FrontFacing && shell;
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float px = length(fwidth(p));
  float r = length(p.xy);
  float rc = uR - uH;
  vec3 rhat = vec3(p.xy / max(r, 1e-3), 0.0);
  vec3 upL = -rhat;                              // "up" for someone standing here
  vec3 T = vec3(-rhat.y, rhat.x, 0.0);           // along the ring
  vec2 dux = vec2(dot(dpx, T), dpx.z), duy = vec2(dot(dpy, T), dpy.z);
  float az = abs(p.z);

  vec3 alb = vec3(0.5);
  vec3 N = Ng;
  vec3 emis = vec3(0.0);
  float rough = 0.7, metal = 0.0;
  float amb = 0.0;        // share of the cabin lighting this surface gets
  float ao = 1.0;

  if (inside && uKind == 0) {
    // floor: paved path, a stone curb, flower beds, lawn, steel deck by the walls
    float bedOut = uPathHW + uBedW;
    float edgeIn = uHW - min(2.0, uHW * 0.2);
    vec3 tn = vec3(0.0, 0.0, 1.0);
    vec4 tx;
    if (az < uPathHW + 0.12) {
      vec2 uv = vec2(arcM(p.xy, uR, uSizeA), p.z + uPathHW);
      tx = samp(uAlbA, uv, dux, duy, uSizeA);
      tn = tnorm(uNrmA, uv, dux, duy, uSizeA, 1.0);
      alb = tx.rgb; rough = tx.a;
      if (az > uPathHW) { alb = alb * 1.25 + 0.03; tn = vec3(0.0, 0.0, 1.0); }      // curb
      float s25 = arcM(p.xy, uR, 25.0);
      float mark = lines(s25, 25.0, 0.05, px) * step(az, uPathHW - 0.2);           // brass inlay every 25 m
      alb = mix(alb, vec3(0.55, 0.38, 0.12), mark); metal = mark; rough = mix(rough, 0.3, mark);
    } else if (az < bedOut) {
      vec2 uv = vec2(arcM(p.xy, uR, uSizeD), p.z);
      tx = samp(uAlbD, uv, dux, duy, uSizeD);
      tn = tnorm(uNrmD, uv, dux, duy, uSizeD, 1.0);
      alb = tx.rgb; rough = tx.a;
      float leafy = smoothstep(0.45, 0.6, vnoise(vec2(arcM(p.xy, uR, 1.0), p.z) * 3.0));
      alb = mix(alb, vec3(0.04, 0.09, 0.025), leafy * 0.8);
      vec4 fl = flowers(vec2(arcM(p.xy, uR, 0.11), p.z), px);
      alb = mix(alb, fl.rgb, fl.a);
      rough = mix(rough, 0.6, fl.a);
    } else if (az < edgeIn) {
      vec2 uv = vec2(arcM(p.xy, uR, uSizeB), p.z);
      tx = samp(uAlbB, uv, dux, duy, uSizeB);
      tn = tnorm(uNrmB, uv, dux, duy, uSizeB, 1.0);
      alb = tx.rgb; rough = tx.a;
      float s3 = arcM(p.xy, uR, 3.0);
      alb *= 1.0 + 0.07 * (smoothstep(0.4, 0.6, fract(s3 / 3.0)) * 2.0 - 1.0);                // mowing stripes
      alb *= 0.85 + 0.3 * vnoise(vec2(arcM(p.xy, uR, 1.0), p.z) * 0.15);
    } else {
      vec2 uv = vec2(arcM(p.xy, uR, uSizeC), p.z);
      tx = samp(uAlbC, uv, dux, duy, uSizeC);
      tn = tnorm(uNrmC, uv, dux, duy, uSizeC, 1.0);
      alb = tx.rgb; rough = tx.a; metal = 0.6;
    }
    N = normalize(T * tn.x + vec3(0.0, 0.0, 1.0) * tn.y + Ng * tn.z);
    amb = 1.0;
    ao *= mix(0.45, 1.0, smoothstep(0.0, 1.6, uHW - az));                         // walls' corner
    // shade under the canopies
    if (uTreeN > 0.5) {
      float cell = TAU / uTreeN;
      float ap = angOf(p.xy);
      for (int row = 0; row < 6; row++) {
        if (float(row) >= uTreeRows) break;
        float k0 = floor(ap / cell - mod(float(row), 2.0) * 0.5 + 0.5);
        for (int j = -1; j <= 1; j++) {
          int k = wrapTree(k0 + float(j));
          vec4 A = treeA(k, row), B = treeB(k, row);
          vec3 base = vec3(uR * cos(A.x), uR * sin(A.x), A.y);
          float d2 = dot(p - base, p - base);
          ao *= 1.0 - 0.55 * exp(-d2 / (A.z * A.z * 1.1));
          ao *= 1.0 - 0.5 * exp(-d2 / (B.w * B.w * 6.0));                         // trunk foot
        }
      }
    }
    // benches and lamp feet
    if (uLampN > 0.5) {
      float cell = TAU / uLampN;
      float k0 = floor(angOf(p.xy) / cell);
      for (int j = -1; j <= 1; j++) {
        float k = k0 + float(j);
        float side = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
        float ang = (k + 0.5) * cell;
        vec3 c = vec3(uR * cos(ang), uR * sin(ang), 0.0);
        vec3 dl = p - c - vec3(0.0, 0.0, side * uLampZ);
        ao *= 1.0 - 0.6 * exp(-dot(dl, dl) / 0.03);
        vec3 db = p - c - vec3(0.0, 0.0, -side * (uPathHW + 0.4));
        float along = dot(db, T), across = db.z;
        ao *= 1.0 - 0.45 * exp(-(along * along / 0.9 + across * across / 0.06));
      }
    }
  } else if (inside && uKind == 1) {
    // ceiling: acoustic tiles, dark skylight frames, light strips along it
    vec2 uv = vec2(arcM(p.xy, rc, uSizeA), p.z);
    vec4 tx = samp(uAlbA, uv, dux, duy, uSizeA);
    vec3 tn = tnorm(uNrmA, uv, dux, duy, uSizeA, 1.0);
    alb = tx.rgb; rough = tx.a;
    N = normalize(T * tn.x + vec3(0.0, 0.0, 1.0) * tn.y + Ng * tn.z);
    if (ceilGlass(p, 0.12)) { alb = vec3(0.05, 0.055, 0.06); rough = 0.35; metal = 0.8; N = Ng; }
    float sz = uCeilFill > 0.0 && uCeilHalfZ > 0.5 ? uCeilHalfZ + 0.6 : uHW * 0.5;
    float strip = 1.0 - smoothstep(0.15, 0.15 + px, abs(az - sz));
    emis = vec3(1.0, 0.94, 0.84) * strip * uCabin * 3.0;
    amb = 0.4;
    ao *= mix(0.55, 1.0, smoothstep(0.0, 1.2, uHW - az));
  } else if (inside && uKind == 2) {
    // side walls: panels, a steel skirting, dark anodised window frames
    float h = uR - r;
    vec2 uv = vec2(arcM(p.xy, uR, uSizeA), h);
    vec2 dhx = vec2(dot(dpx, T), dot(dpx, upL)), dhy = vec2(dot(dpy, T), dot(dpy, upL));
    vec4 tx = samp(uAlbA, uv, dhx, dhy, uSizeA);
    vec3 tn = tnorm(uNrmA, uv, dhx, dhy, uSizeA, 1.0);
    alb = tx.rgb; rough = tx.a;
    N = normalize(T * tn.x + upL * tn.y + Ng * tn.z);
    if (h < 0.18) { alb = vec3(0.10, 0.105, 0.11); rough = 0.4; metal = 0.7; N = Ng; }
    if (sideGlass(p, 0.1)) { alb = vec3(0.05, 0.055, 0.06); rough = 0.3; metal = 0.8; N = Ng; }
    amb = 0.75;
    ao *= mix(0.5, 1.0, smoothstep(0.0, 1.2, h)) * mix(0.6, 1.0, smoothstep(0.0, 1.0, uH - h));
  } else if (shell) {
    // outer hull of the ring, seen from outside (floor: deck plate in C; others: hull in B)
    bool wallSide = uKind == 2;
    vec2 hx = wallSide ? vec2(dot(dpx, T), dot(dpx, upL)) : dux;
    vec2 hy = wallSide ? vec2(dot(dpy, T), dot(dpy, upL)) : duy;
    vec4 tx; vec3 tn;
    if (uKind == 0) {
      vec2 uv = vec2(arcM(p.xy, r, uSizeC), p.z);
      tx = samp(uAlbC, uv, hx, hy, uSizeC); tn = tnorm(uNrmC, uv, hx, hy, uSizeC, 1.0);
      tx.rgb *= 1.6;
    } else {
      vec2 uv = wallSide ? vec2(arcM(p.xy, r, uSizeB), uR - r) : vec2(arcM(p.xy, r, uSizeB), p.z);
      tx = samp(uAlbB, uv, hx, hy, uSizeB); tn = tnorm(uNrmB, uv, hx, hy, uSizeB, 1.0);
    }
    alb = tx.rgb; rough = tx.a; metal = 0.3;
    vec3 Bv = wallSide ? upL : vec3(0.0, 0.0, 1.0);
    N = normalize(T * tn.x + Bv * tn.y + Ng * tn.z);
    if (uKind == 1 && ceilGlass(p, 0.15)) { alb = vec3(0.07); N = Ng; }
    if (uKind == 2 && sideGlass(p, 0.12)) { alb = vec3(0.07); N = Ng; }
  } else {
    vec4 tx; vec3 tn;
    if (uKind == 3) {                                   // hub and spokes
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA, 1.0, tx, N);
      alb = tx.rgb; rough = tx.a; metal = 0.3;
    } else if (uKind == 4) {                            // bark
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA, 1.2, tx, N);
      alb = tx.rgb * vCol; rough = 0.95;
      amb = 0.75;
    } else if (uKind == 5) {                            // leaves
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA, 2.5, tx, N);
      alb = tx.rgb * vCol * 2.2; rough = 0.6;           // vertex colour: species tint × baked shade
      amb = 0.55 + 0.35 * max(0.0, dot(Ng, upL));
    } else if (uKind == 6) {                            // painted steel ribs
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA * 0.5, 0.6, tx, N);
      alb = vec3(0.66, 0.66, 0.64) * (0.8 + 0.4 * tx.r); rough = 0.4;
      amb = 0.6;
    } else if (uKind == 7) {                            // bench slats
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA, 1.0, tx, N);
      alb = tx.rgb; rough = tx.a;
      amb = 0.85;
    } else if (uKind == 8) {                            // dark powder-coated metal
      triplanar(uAlbA, uNrmA, p, Ng, uSizeA, 0.4, tx, N);
      alb = vec3(0.04, 0.045, 0.05) * (0.8 + 0.4 * tx.r); rough = 0.35; metal = 0.6;
      amb = 0.8;
    } else {                                            // lamp globe
      alb = vec3(0.8); rough = 0.2;
      emis = vec3(1.0, 0.85, 0.6) * uCabin * 12.0;
      amb = 0.5;
    }
  }

  vec3 V = normalize(cameraPosition - p);
  vec3 F0 = mix(vec3(0.04), alb, metal);
  vec3 dif = alb * (1.0 - metal);
  vec3 col = emis;

  // sun
  if (dot(Ng, uSunDir) > 0.0) {
    float vis = occl(p + Ng * 0.02, uSunDir);
    if (vis > 0.0) {
      float ndl = max(dot(N, uSunDir), 0.0);
      col += uSunCol * vis * (dif * ndl + ggx(N, V, uSunDir, max(rough, 0.12), F0));
    }
  }
  // moon: a broad source; wrapped falloff and visibility of its centre
  float ndm = dot(Ng, uMoonDir);
  if (ndm > -0.4) {
#if QUALITY > 0
    float vis = occl(p + Ng * 0.02, uMoonDir);
#else
    float vis = 1.0;
#endif
    col += uMoonCol * dif * clamp((dot(N, uMoonDir) + 0.4) / 1.4, 0.0, 1.0) * vis;
  }

  bool lit = inside || uKind >= 4;
  if (lit) {
    // cabin light: mostly from above; sunlight bounced off nearby floor from below
    float hemi = 0.6 + 0.4 * dot(N, upL);
    vec3 cabin = vec3(1.0, 0.95, 0.88) * (uCabin * amb * hemi);
    vec3 bounce = vec3(0.9, 1.0, 0.85) * uBounce * (0.6 - 0.4 * dot(N, upL));
    col += (dif + F0 * 0.25) * (cabin + bounce) * ao;
#if QUALITY > 1
    // pools of light from the lamps along the path
    if (uLampN > 0.5 && uCabin > 0.0) {
      float cell = TAU / uLampN;
      float k0 = floor(angOf(p.xy) / cell);
      for (int j = -1; j <= 1; j++) {
        float k = k0 + float(j);
        float side = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
        float ang = (k + 0.5) * cell;
        vec3 lp = vec3((uR - uLampH) * cos(ang), (uR - uLampH) * sin(ang), side * uLampZ);
        vec3 dl = lp - p;
        float d2 = dot(dl, dl);
        vec3 Ll = dl * inversesqrt(d2);
        float down = smoothstep(-0.2, 0.4, dot(-Ll, -upL));      // shade throws light down
        col += vec3(1.0, 0.82, 0.55) * uCabin * 7.0 / (d2 + 0.6) * down * (dif * max(dot(N, Ll), 0.0) + ggx(N, V, Ll, max(rough, 0.2), F0) * 0.5);
      }
    }
#endif
  } else {
    col += dif * vec3(0.002);   // earthshine and starlight: next to nothing
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

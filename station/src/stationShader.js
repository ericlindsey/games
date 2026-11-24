// GLSL for every surface of the station.
//
// Sunlight is not shadow-mapped. The station's structure is simple enough to
// ray-trace exactly in the fragment shader: from each point, a ray toward the sun
// is tested against the floor shell, the ceiling (with its window grid), the two
// side walls (with theirs), the hub, the spokes and the nearest trees. So the
// window patches on the floor are exact at any ring size, and they sweep as the
// ring turns. The same window functions cut the holes (discard), so what you see
// through and what light comes through always agree.
//
// Station frame: spin axis is +Z, the floor is the cylinder r = uR, the ceiling
// r = uR - uH, the side walls are the planes z = ±uHW.

export const stationVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vNrm;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const stationFragment = /* glsl */ `
precision highp float;

uniform float uR, uH, uHW;
uniform float uCeilN, uCeilFill, uCeilHalfZ;
uniform float uSideN, uSideFill, uSideLo, uSideHi;
uniform float uSpokeN, uSpokeR, uHubR, uHubHalfL;
uniform float uTreeN, uTreeZ, uCrownR, uCrownH;
uniform vec3 uSunDir, uSunCol, uMoonDir, uMoonCol;
uniform float uCabin, uBounce;
uniform int uKind;   // 0 floor, 1 ceiling, 2 side wall, 3 hub/spoke hull, 4 trunk, 5 crown

varying vec3 vPos;
varying vec3 vNrm;

const float TAU = 6.28318531;
const float EPS = 1e-3;

float angOf(vec2 p) { float a = atan(p.y, p.x); return a < 0.0 ? a + TAU : a; }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

// Ceiling glass: a row of window cells round the ring, centred across the width,
// none where a spoke meets the ceiling. m > 0 widens the panes and drops the
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
  // tree crowns: the few nearest the point, and nearest where the ray crosses crown height
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
      for (int row = 0; row < 2; row++) {
        float off = row == 0 ? 0.0 : 0.5;
        float zc = row == 0 ? uTreeZ : -uTreeZ;
        float k0 = floor(ac / cell - off + 0.5);
        for (int j = -1; j <= 1; j++) {
          float ang = (k0 + float(j) + off) * cell;
          vec3 oc = p - vec3(rcr * cos(ang), rcr * sin(ang), zc);
          float bq = dot(oc, L);
          float dq = bq * bq - (dot(oc, oc) - 0.88 * 0.88 * uCrownR * uCrownR);   // a bit inside the faceted mesh
          if (dq > 0.0 && -bq + sqrt(dq) > EPS) return 0.0;
        }
      }
    }
  }
  return 1.0;
}

// Antialiased lines: x in metres, lines every 'period' metres, 'hw' half width.
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

void main() {
  vec3 p = vPos;
  if (uKind == 1 && ceilGlass(p, 0.0)) discard;
  if (uKind == 2 && sideGlass(p, 0.0)) discard;

  vec3 N = normalize(vNrm);
  if (!gl_FrontFacing) N = -N;
  bool inside = gl_FrontFacing && uKind <= 2;
  float px = length(fwidth(p));
  float r = length(p.xy);
  float rc = uR - uH;

  vec3 alb = vec3(0.5);
  vec3 emis = vec3(0.0);
  float amb = 0.0;        // share of the cabin lighting this surface gets
  float shine = 0.0;      // specular strength
  float az = abs(p.z);

  if (inside && uKind == 0) {
    // floor: paved path down the middle, grass, deck plates along the walls
    float s1 = arcM(p.xy, uR, 1.0);
    float pathHW = min(1.5, uHW * 0.3);
    float edge = min(2.0, uHW * 0.2);
    if (az < pathHW) {
      alb = vec3(0.40, 0.38, 0.35) * (0.92 + 0.08 * hash12(floor(vec2(s1, p.z))));
      alb *= 1.0 - 0.35 * max(lines(s1, 1.0, 0.012, px), lines(p.z + pathHW, 1.0, 0.012, px));
      float s25 = arcM(p.xy, uR, 25.0);
      alb = mix(alb, vec3(0.55, 0.42, 0.12), lines(s25, 25.0, 0.12, px));   // distance marks every 25 m
      shine = 0.15;
    } else if (az < uHW - edge) {
      float n = vnoise(vec2(s1, p.z) * 1.7) * 0.5 + vnoise(vec2(s1, p.z) * 7.0) * 0.3 + vnoise(vec2(s1, p.z) * 0.25) * 0.4;
      alb = mix(vec3(0.035, 0.10, 0.02), vec3(0.09, 0.19, 0.04), n);
    } else {
      float s2 = arcM(p.xy, uR, 2.0);
      alb = vec3(0.22, 0.23, 0.24) * (0.9 + 0.1 * hash12(floor(vec2(s2 / 2.0, p.z))));
      alb *= 1.0 - 0.5 * max(lines(s2, 2.0, 0.015, px), lines(p.z, 2.0, 0.015, px));
      shine = 0.25;
    }
    amb = 1.0;
  } else if (inside && uKind == 1) {
    // ceiling: pale panels, light strips beside the window row
    float s2 = arcM(p.xy, rc, 2.0);
    alb = vec3(0.62, 0.62, 0.60) * (1.0 - 0.25 * max(lines(s2, 2.0, 0.02, px), lines(p.z, 2.0, 0.02, px)));
    if (ceilGlass(p, 0.12)) alb = vec3(0.06, 0.065, 0.07);
    float sz = uCeilFill > 0.0 && uCeilHalfZ > 0.5 ? uCeilHalfZ + 0.6 : uHW * 0.5;
    float strip = 1.0 - smoothstep(0.15, 0.15 + px, abs(az - sz));
    emis = vec3(1.0, 0.94, 0.84) * strip * uCabin * 2.5;
    amb = 0.45;
  } else if (inside && uKind == 2) {
    // side walls: panels, a dark band at the foot, frames round the glass
    float h = uR - r;
    float s15 = arcM(p.xy, uR, 1.5);
    alb = vec3(0.50, 0.48, 0.45) * (1.0 - 0.25 * max(lines(s15, 1.5, 0.012, px), lines(h, 1.2, 0.012, px)));
    if (h < 0.15) alb = vec3(0.12, 0.13, 0.14);
    if (sideGlass(p, 0.1)) alb = vec3(0.06, 0.065, 0.07);
    amb = 0.75;
    shine = 0.1;
  } else if (uKind == 4) {
    alb = vec3(0.12, 0.075, 0.045);
    amb = 0.7;
  } else if (uKind == 5) {
    vec2 q = vec2(angOf(p.xy) * uR, p.z + r);
    float n = vnoise(q * 2.3) * 0.6 + vnoise(q * 6.0) * 0.4;
    alb = mix(vec3(0.04, 0.11, 0.025), vec3(0.12, 0.24, 0.05), n);
    amb = 0.5 + 0.4 * max(0.0, dot(N, -normalize(vec3(p.xy, 0.0))));
  } else {
    // outer hull (any surface seen from outside), hub and spokes
    vec2 q = uKind == 3 ? vec2(angOf(p.xy) * max(r, 1.0), p.z) : vec2(arcM(p.xy, r, 3.0), p.z);
    vec2 cellId = floor(q / vec2(3.0, 2.0));
    alb = vec3(0.50, 0.51, 0.52) * (0.85 + 0.15 * hash12(cellId));
    alb *= 1.0 - 0.45 * max(lines(q.x, 3.0, 0.03, px), lines(q.y, 2.0, 0.03, px));
    if (uKind == 1 && ceilGlass(p, 0.15)) alb = vec3(0.08);
    if (uKind == 2 && sideGlass(p, 0.12)) alb = vec3(0.08);
    shine = 0.35;
  }

  vec3 V = normalize(cameraPosition - p);
  vec3 light = vec3(0.0);
  vec3 specl = vec3(0.0);
  float ndl = dot(N, uSunDir);
  if (ndl > 0.0) {
    float vis = occl(p + N * 0.02, uSunDir);
    light += uSunCol * ndl * vis;
    vec3 Hh = normalize(uSunDir + V);
    specl += uSunCol * vis * shine * pow(max(dot(N, Hh), 0.0), 40.0) * ndl;
  }
  float ndm = dot(N, uMoonDir);
  if (ndm > -0.4) {
    // the moon is a broad source: wrapped falloff, visibility of its centre
    float vis = occl(p + N * 0.02, uMoonDir);
    light += uMoonCol * clamp((ndm + 0.4) / 1.4, 0.0, 1.0) * vis;
  }
  if (inside || uKind >= 4) light += vec3(1.0, 0.96, 0.9) * (uCabin * amb + uBounce);
  else light += vec3(0.002);   // earthshine and starlight: next to nothing

  gl_FragColor = vec4(alb * light + specl + emis, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

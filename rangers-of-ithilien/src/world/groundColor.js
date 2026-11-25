// Colour of the ground as a function of place, height and slope.
// Pure: returns sRGB components in [0, 1] via the `out` array.

import { noise2, smoothstep, lerp } from '../util/noise.js';
import { WORLD } from '../config.js';
import { regionWeights } from './regions.js';
import { forestDensity } from './forest.js';
import { inField } from './oldworks.js';
import { pathWear } from './paths.js';
import { inCourt } from './relicSites.js';
import { roadDistance, ROAD_HALF_WIDTH, bankX, southRoadZ, HA, gorgeZ, EPHEL, valeDepth } from './layout.js';
import { streamDistance } from './terrain.js';
import { trodden } from './settlements.js';

const S = WORLD.seed;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const C = {
  central: hex(0x7aa64a), lawn: hex(0x8fbf55), south: hex(0x56843f), heath: hex(0xa3a264),
  heather: hex(0x94708f), river: hex(0x86a85c), fen: hex(0x6f8450), foothill: hex(0x8b8562),
  floor: hex(0x4b6a3a), meadow: hex(0x9dbb62), track: hex(0xb3a37c),
  rock: hex(0x8f8877), darkRock: hex(0x5d5a61), valeGlow: hex(0x4f7a5a), mud: hex(0xa3966f), bed: hex(0x55604c),
  road: hex(0xb9ae93), yard: hex(0x9a8462), canopy: hex(0x3f7436), canopySouth: hex(0x2f5c33), sick: hex(0x6b6f55),
};

const w = {};
function mix(out, c, t) {
  out[0] = lerp(out[0], c[0], t); out[1] = lerp(out[1], c[1], t); out[2] = lerp(out[2], c[2], t);
}

/**
 * @param {number} slope rise over run
 * @param {number[]} out receives [r, g, b]
 */
export function groundColor(x, z, h, slope, out) {
  regionWeights(x, z, w);
  out[0] = out[1] = out[2] = 0;
  for (const k of ['central', 'south', 'heath', 'river', 'foothill']) {
    const c = C[k], t = w[k];
    out[0] += c[0] * t; out[1] += c[1] * t; out[2] += c[2] * t;
  }
  if (w.heath > 0.05) {
    mix(out, C.heather, w.heath * smoothstep(0.1, 0.5, noise2(x / 38, z / 38, S + 400)) * 0.7);
  }
  mix(out, C.fen, w.fen * 0.8);
  mix(out, C.lawn, w.lawn * 0.85);
  // Old fields are still paler meadow; under the trees the floor is dark and mossy.
  if (x > bankX(z)) {
    if (inField(x, z)) mix(out, C.meadow, 0.45);
    mix(out, C.floor, forestDensity(x, z) * 0.6);
  }

  // Mottling so large fields do not read as one flat colour.
  const m = 1 + noise2(x / 55, z / 55, S + 410) * 0.14 + noise2(x / 9, z / 9, S + 420) * 0.09;
  out[0] *= m; out[1] *= m; out[2] *= m;

  // The old paths: a paler, trodden line that comes and goes.
  if (x > bankX(z)) {
    const wear = pathWear(x, z);
    if (wear > 0) mix(out, C.track, Math.min(1, wear * 1.1));
  }
  if (inCourt(x, z)) mix(out, [0.36, 0.29, 0.17], 0.85); // the sunken courts: old leaves, dark earth
  const yard = trodden(x, z); // (since v0.7.7) the yards and green of a settlement: trodden earth, a little grass at the edges
  if (yard > 0) mix(out, C.yard, yard * (0.78 + 0.12 * noise2(x / 4, z / 4, S + 450)));

  // Roads: pale paving, broken up by grass.
  const rd = roadDistance(x, z);
  if (rd < ROAD_HALF_WIDTH + 2.5) {
    const wear = 0.55 + 0.35 * noise2(x / 6, z / 6, S + 430);
    mix(out, C.road, (1 - smoothstep(ROAD_HALF_WIDTH - 1, ROAD_HALF_WIDTH + 2.5, rd)) * wear * (1 - smoothstep(EPHEL.valeHead - 60, EPHEL.valeHead + 40, x)));
  }

  // Wet margins and stream beds.
  const sd = streamDistance(x, z);
  if (sd < 7 && x > bankX(z)) mix(out, C.mud, 1 - smoothstep(3, 7, sd));
  if (h < 1.6) mix(out, C.mud, 1 - smoothstep(0.4, 1.6, h));
  if (h < 0.2) mix(out, C.bed, 1 - smoothstep(-2.5, 0.2, h));

  // The floor of the basin and the cut at Henneth Annûn is wet stone and shingle.
  const inBasin = x > HA.basin.minX - 6 && Math.abs(z - HA.z) < 22;
  const inCut = x > HA.gorge.endX && x <= HA.basin.minX - 6 && Math.abs(z - gorgeZ(x)) < HA.gorge.halfTop + 1;
  if (h < HA.plateau - 9 && (inBasin || inCut) && x < HA.x + 1) {
    mix(out, C.rock, 0.75);
    out[0] *= 0.82; out[1] *= 0.84; out[2] *= 0.84;
  }

  // Bare rock on steep ground; the mountains are dark stone.
  if (slope > 0.45) mix(out, C.rock, smoothstep(0.45, 0.85, slope));
  if (x > 1230) {
    const morgul = 1 - smoothstep(60, 220, Math.abs(z - southRoadZ(x)));
    mix(out, C.darkRock, smoothstep(1275, 1410, x) * (0.75 + 0.25 * morgul));
    // (since v0.8.5) the Morgul Vale is dark, darker toward its head, its walls in a sickly green light
    const vd = valeDepth(x, z);
    if (vd > 0) {
      const k = vd * (0.5 + 0.5 * smoothstep(EPHEL.cragFrom - 50, EPHEL.valeHead, x));
      out[0] *= 1 - 0.7 * k; out[1] *= 1 - 0.56 * k; out[2] *= 1 - 0.62 * k;
      mix(out, C.valeGlow, 0.3 * k);
    }
  }
}

/** Colour used on the far backdrop where forest stands: ground seen through canopy. */
export function canopyColor(x, z, out) {
  regionWeights(x, z, w);
  const t = Math.min(1, w.south + w.river * 0.3);
  out[0] = lerp(C.canopy[0], C.canopySouth[0], t);
  out[1] = lerp(C.canopy[1], C.canopySouth[1], t);
  out[2] = lerp(C.canopy[2], C.canopySouth[2], t);
  const m = 1 + noise2(x / 70, z / 70, S + 440) * 0.12;
  out[0] *= m; out[1] *= m; out[2] *= m;
}

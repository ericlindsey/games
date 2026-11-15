// Colour of the ground as a function of place, height and slope.
// Pure: returns sRGB components in [0, 1] via the `out` array.

import { noise2, smoothstep, lerp } from '../util/noise.js';
import { WORLD } from '../config.js';
import { regionWeights } from './regions.js';
import { roadDistance, streamDistance, ROAD_HALF_WIDTH, bankX, southRoadZ } from './layout.js';

const S = WORLD.seed;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const C = {
  central: hex(0x7aa64a), lawn: hex(0x8fbf55), south: hex(0x56843f), heath: hex(0xa3a264),
  heather: hex(0x94708f), river: hex(0x86a85c), fen: hex(0x6f8450), foothill: hex(0x90905f),
  rock: hex(0x8f8877), darkRock: hex(0x5d5a61), mud: hex(0xa3966f), bed: hex(0x55604c),
  road: hex(0xb9ae93), canopy: hex(0x3f7436), canopySouth: hex(0x2f5c33), sick: hex(0x6b6f55),
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

  // Mottling so large fields do not read as one flat colour.
  const m = 1 + noise2(x / 55, z / 55, S + 410) * 0.14 + noise2(x / 9, z / 9, S + 420) * 0.09;
  out[0] *= m; out[1] *= m; out[2] *= m;

  // Roads: pale paving, broken up by grass.
  const rd = roadDistance(x, z);
  if (rd < ROAD_HALF_WIDTH + 2.5) {
    const wear = 0.55 + 0.35 * noise2(x / 6, z / 6, S + 430);
    mix(out, C.road, (1 - smoothstep(ROAD_HALF_WIDTH - 1, ROAD_HALF_WIDTH + 2.5, rd)) * wear);
  }

  // Wet margins and stream beds.
  const sd = streamDistance(x, z);
  if (sd < 7 && x > bankX(z)) mix(out, C.mud, 1 - smoothstep(3, 7, sd));
  if (h < 1.6) mix(out, C.mud, 1 - smoothstep(0.4, 1.6, h));
  if (h < 0.2) mix(out, C.bed, 1 - smoothstep(-2.5, 0.2, h));

  // Bare rock on steep ground; the mountains are dark stone.
  if (slope > 0.45) mix(out, C.rock, smoothstep(0.45, 0.85, slope));
  if (x > 2600) {
    const morgul = 1 - smoothstep(80, 320, Math.abs(z - southRoadZ(x)));
    mix(out, C.darkRock, smoothstep(2700, 2950, x) * (0.75 + 0.25 * morgul));
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

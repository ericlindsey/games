// Where the gatherable plants grow: kingsfoil (athelas) for Éowyn's draughts,
// and four plants whose seed she wants for the gardens. Pure; world/herbs.js draws them.

import { hash2 } from '../util/noise.js';
import { WORLD } from '../config.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { forestDensity } from './forest.js';
import { inClearing, roadDistance, bankX, haradRoadX, HA } from './layout.js';
import { campNear } from './campSites.js';
import { houseDistance } from './oldworks.js';

/**
 * Each kind: the item it gives, how often a cell holds one, and where it will grow.
 * `d` is forest density, `h` distance to the nearest old house.
 */
export const PLANTS = {
  athelas: { cell: 55, rate: 0.34, salt: 600, grows: (x, z, d) => d <= 0.93 },
  // (since v0.6a about twice as many seed plants as before: they were hard to
  // find. A higher rate keeps every plant that stood before, so saved ids hold.)
  thymeSeed: { cell: 70, rate: 0.62, salt: 640, grows: (x, z, d) => d < 0.45 && z < 1725 },
  baySeed: { cell: 70, rate: 0.62, salt: 660, grows: (x, z, d) => d > 0.45 && d < 0.88 && z > 525 && z < 2175 },
  poppySeed: { cell: 50, rate: 0.9, salt: 680, grows: (x, z, d, h) => h > 8 && h < 70 },
  oliveStone: { cell: 70, rate: 0.72, salt: 700, grows: (x, z, d) => d < 0.9 && z > 1725 },
};

/** Where they grow: [{ id, kind, x, z }]. Fixed by the world seed. Pure. */
export function herbSites() {
  const out = [];
  for (const [kind, p] of Object.entries(PLANTS)) {
    const tag = kind === 'athelas' ? 'h' : kind[0] + kind[1]; // kingsfoil keeps the ids it always had
    for (let gz = 2; gz < WORLD.length / p.cell - 1; gz++) {
      for (let gx = 2; gx < WORLD.width / p.cell; gx++) {
        if (hash2(gx, gz, WORLD.seed + p.salt) > p.rate) continue;
        const x = (gx + hash2(gx, gz, WORLD.seed + p.salt + 1)) * p.cell, z = (gz + hash2(gx, gz, WORLD.seed + p.salt + 2)) * p.cell;
        if (x < bankX(z) + 30 || x > haradRoadX(z) - 20) continue;
        if (inClearing(x, z) || roadDistance(x, z) < 8 || streamDistance(x, z) < 6 || campNear(x, z, 30)) continue;
        const h = houseDistance(x, z);
        if (h < 6 || heightAt(x, z) < 2 || slopeAt(x, z) > 0.3) continue; // they want light
        if (!p.grows(x, z, forestDensity(x, z), h)) continue;
        out.push({ id: tag + gx + '_' + gz, kind, x, z });
      }
    }
  }
  // a few kingsfoil close to home, so the first task is not a long search
  for (const [dx, dz] of [[-60, 60], [-110, 95], [30, 85], [-20, 130], [90, 70], [-150, 50]]) {
    out.push({ id: 'home' + dx, kind: 'athelas', x: HA.x + dx, z: HA.z + dz });
  }
  return out;
}

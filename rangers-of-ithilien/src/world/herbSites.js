// Where kingsfoil (athelas) grows. Pure; world/herbs.js draws it.

import { hash2 } from '../util/noise.js';
import { WORLD } from '../config.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { forestDensity } from './forest.js';
import { inClearing, roadDistance, bankX, haradRoadX, HA } from './layout.js';
import { campNear } from './campSites.js';
import { houseDistance } from './oldworks.js';

const CELL = 55;

/** Where kingsfoil grows: [{ id, x, z }]. Fixed by the world seed. Pure. */
export function herbSites() {
  const out = [];
  for (let gz = 2; gz < WORLD.length / CELL - 1; gz++) {
    for (let gx = 2; gx < WORLD.width / CELL; gx++) {
      if (hash2(gx, gz, WORLD.seed + 600) > 0.34) continue;
      const x = (gx + hash2(gx, gz, WORLD.seed + 601)) * CELL, z = (gz + hash2(gx, gz, WORLD.seed + 602)) * CELL;
      if (x < bankX(z) + 30 || x > haradRoadX(z) - 20) continue;
      if (inClearing(x, z) || roadDistance(x, z) < 8 || streamDistance(x, z) < 6 || houseDistance(x, z) < 6 || campNear(x, z, 30)) continue;
      const d = forestDensity(x, z);
      if (d > 0.93 || heightAt(x, z) < 2 || slopeAt(x, z) > 0.3) continue; // it wants light
      out.push({ id: 'h' + gx + '_' + gz, x, z });
    }
  }
  // a few close to home, so the first task is not a long search
  for (const [dx, dz] of [[-60, 60], [-110, 95], [30, 85], [-20, 130], [90, 70], [-150, 50]]) {
    const x = HA.x + dx, z = HA.z + dz;
    out.push({ id: 'home' + dx, x, z });
  }
  return out;
}


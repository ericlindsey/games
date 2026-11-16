// Lesser ruins scattered through the land: things half-buried and unnamed,
// worth a detour. Pure: this decides where they are; world/relics.js builds them.

import { rng } from '../util/noise.js';
import { WORLD } from '../config.js';
import { HA, LANDMARKS, bankX, haradRoadX, southRoadZ, roadDistance } from './layout.js';
import { heightAt, slopeAt, streamDistance } from './terrain.js';
import { SITES, houseDistance } from './oldworks.js';

/** kind -> what the ranger notes on finding one */
export const RELIC_KINDS = {
  stones: ['A ring of standing stones', 'Older than Gondor, by the look of them.'],
  statue: ['A fallen king', 'The face is worn away. The moss has been kinder than the orcs.'],
  aqueduct: ['A broken aqueduct', 'It carried water to gardens that are forest now.'],
  barrow: ['A barrow', 'A green mound with a stone door. Best left shut.'],
  rotunda: ['A pillared rotunda', 'A ring of columns holding up the sky.'],
  chapel: ['A roofless chapel', 'Tall windows, and a beech tree for a congregation.'],
  waystone: ['A waystone', 'The letters name places that are only woods now.'],
  gate: ['A gateway to nothing', 'The wall it pierced is gone. The gate remains, out of habit.'],
  tower: ['A drum tower', 'Hollow, and full of birds.'],
  baths: ['A sunken court', 'Steps go down to a pool that holds only leaves.'],
};

function generate() {
  const rand = rng(WORLD.seed + 303);
  const kinds = Object.keys(RELIC_KINDS);
  const out = [];
  for (let tries = 0; tries < 5000 && out.length < 44; tries++) {
    const x = 170 + rand() * 1520, z = 150 + rand() * 3660;
    if (x < bankX(z) + 60 || x > haradRoadX(z) + 130 || z > southRoadZ(x) - 70) continue;
    if (Math.abs(z - HA.z) < 70 && x > 600 && x < HA.x + 90) continue;
    if (streamDistance(x, z) < 20 || roadDistance(x, z) < 18 || houseDistance(x, z) < 30) continue;
    if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * 0.5 + 60)) continue;
    if (SITES.some((s) => Math.hypot(x - s.x, z - s.z) < (s.kind === 'hamlet' ? 110 : 55))) continue;
    if (out.some((r) => Math.hypot(x - r.x, z - r.z) < 150)) continue;
    if (heightAt(x, z) < 3 || slopeAt(x, z) > 0.2) continue;
    out.push({ id: 'relic' + (out.length + 1), kind: kinds[out.length % kinds.length], x: Math.round(x), z: Math.round(z) });
  }
  return out;
}

/** @type {{id:string, kind:string, x:number, z:number}[]} */
export const RELICS = generate();

/** Distance to the nearest relic (large if none is near). */
export function relicDistance(x, z) {
  let d = Infinity;
  for (const r of RELICS) {
    const dx = Math.abs(x - r.x), dz = Math.abs(z - r.z);
    if (dx < 40 && dz < 40) d = Math.min(d, Math.hypot(dx, dz));
  }
  return d;
}

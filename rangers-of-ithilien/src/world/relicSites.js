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
  const ok = (x, z, gap) => {
    if (x < bankX(z) + 60 || x > haradRoadX(z) + 130 || z < 120 || z > southRoadZ(x) - 70) return false;
    if (Math.abs(z - HA.z) < 70 && x > 600 && x < HA.x + 90) return false;
    if (streamDistance(x, z) < 20 || roadDistance(x, z) < 18 || houseDistance(x, z) < 30) return false;
    if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * 0.5 + 60)) return false;
    if (SITES.some((s) => Math.hypot(x - s.x, z - s.z) < (s.kind === 'hamlet' ? 110 : 55))) return false;
    if (out.some((r) => Math.hypot(x - r.x, z - r.z) < gap)) return false;
    return heightAt(x, z) >= 3 && slopeAt(x, z) <= 0.2;
  };
  const add = (x, z) => out.push({ id: 'relic' + (out.length + 1), kind: kinds[out.length % kinds.length], x: Math.round(x), z: Math.round(z) });

  // First, one in each part of the land, so that wherever the ranger is there
  // is an old place not far off (they are also ways back by the old roads).
  // The parts run in a grid between the river and a little beyond the road.
  const COLS = 4, ROWS = 10;
  for (let j = 0; j < ROWS; j++) {
    const z = 260 + (j + 0.5) * (3500 / ROWS);
    const x0 = bankX(z) + 110, x1 = haradRoadX(z) + 90;
    for (let i = 0; i < COLS; i++) {
      const tx = x0 + (i + 0.5) * ((x1 - x0) / COLS);
      for (let t = 0; t < 160; t++) { // spiral out from the middle of the part until somewhere will do
        const a = t * 2.4, r = 6 + t * 0.9;
        const x = tx + Math.cos(a) * r, zz = z + Math.sin(a) * r * 1.6;
        if (ok(x, zz, 150)) { add(x, zz); break; }
      }
    }
  }
  // Then a few more wherever they fall.
  for (let tries = 0; tries < 4000 && out.length < 48; tries++) {
    const x = 170 + rand() * 1520, z = 150 + rand() * 3660;
    if (ok(x, z, 170)) add(x, z);
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

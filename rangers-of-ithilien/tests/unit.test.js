// Unit tests for the pure world logic. Run: node --test tests/unit.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt } from '../src/world/terrain.js';
import { HA, LANDMARKS, bankX, CROSSROADS, inClearing, haradRoadX } from '../src/world/layout.js';
import { regionWeights, dangerTier } from '../src/world/regions.js';
import { forestDensity, thicketDensity } from '../src/world/forest.js';
import { CAMPS, blightAt, campNear } from '../src/world/campSites.js';
import { SITES, inField, plantedIn, PLANTED_COUNT } from '../src/world/oldworks.js';
import { groundAt, blockedBySolid, addSolid, addHollow, terrainAt } from '../src/world/collision.js';
import { newState, migrate, SaveStore } from '../src/systems/save.js';
import { SAVE, WORLD } from '../src/config.js';

test('terrain is deterministic and finite', () => {
  for (let i = 0; i < 200; i++) {
    const x = (i * 137.5) % WORLD.width, z = (i * 311.7) % WORLD.length;
    const h = heightAt(x, z);
    assert.ok(Number.isFinite(h));
    assert.equal(h, heightAt(x, z));
  }
});

test('the land has the right shape', () => {
  const z = 2300;
  assert.ok(heightAt(bankX(z) - 150, z) < -5, 'the Anduin is deep mid-channel');
  assert.ok(heightAt(bankX(z) + 80, z) > 0, 'the east bank is dry');
  assert.ok(heightAt(1000, z) > heightAt(400, z), 'the land rises eastward');
  assert.ok(heightAt(1950, z) > 200, 'the Ephel Dúath are high');
});

test('Henneth Annûn: a walled pool, a deep cut, and a way out downstream', () => {
  const rim = heightAt(HA.x - 16, HA.z + 24), floor = heightAt(HA.x - 16, HA.z + 8);
  assert.ok(rim - floor > 15, `the basin is ${(rim - floor).toFixed(1)} m deep`);
  assert.ok(heightAt(HA.x + 6, HA.z) - floor > 14, 'the stream falls a long way');
  for (const z of [HA.z - 24, HA.z + 24]) assert.ok(heightAt(HA.x - 16, z) > floor + 15, 'cliffs north and south');
  assert.ok(heightAt(HA.basin.minX - 12, HA.z + 16) > floor + 15, 'cliffs to the west, either side of the cut');
  // the cut: deep near the pool, running out to open ground downstream
  const depth = (x) => heightAt(x, HA.z + 16) - heightAt(x, HA.z + 3);
  assert.ok(depth(900) > 15, 'the cut is deep near the pool');
  assert.ok(depth(HA.gorge.endX - 30) < 4, 'and has run out to ground level downstream');
  for (let x = HA.gorge.endX; x < HA.basin.minX; x += 10) {
    assert.ok(heightAt(x, HA.z + 3) <= heightAt(x + 10, HA.z + 3) + 0.2, 'the floor of the cut never climbs going downstream');
  }
});

test('every landmark stands on dry land inside the world', () => {
  for (const p of LANDMARKS) {
    assert.ok(p.x > 0 && p.x < WORLD.width && p.z > 0 && p.z < WORLD.length, p.id);
    if (p.id !== 'henneth') assert.ok(heightAt(p.x, p.z) > 0.1, `${p.id} is above water`);
  }
});

test('there are more than a hundred camps, none near home, all on usable ground', () => {
  assert.ok(CAMPS.length >= 100, `${CAMPS.length} camps`);
  assert.equal(new Set(CAMPS.map((c) => c.id)).size, CAMPS.length);
  for (const c of CAMPS) {
    assert.ok(Math.hypot(c.x - HA.x, c.z - HA.z) >= 249, `${c.id} keeps clear of home`);
    assert.ok(heightAt(c.x, c.z) > 1.5 && c.size >= 1 && c.size <= 3 && c.tier >= 1, c.id);
    assert.equal(campNear(c.x, c.z, 5).id, c.id);
  }
  const far = CAMPS.filter((c) => c.tier >= 3).length, close = CAMPS.filter((c) => c.tier === 1).length;
  assert.ok(far > close * 2, 'camps thicken away from home');
});

test('old farms and villages leave fields and planted rows', () => {
  assert.ok(SITES.filter((s) => s.kind === 'farm').length >= 30);
  assert.ok(SITES.filter((s) => s.kind === 'hamlet').length >= 4);
  assert.ok(PLANTED_COUNT > 1000);
  const f = SITES[0].fields[0];
  assert.ok(inField((f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2));
  assert.ok(!inField(HA.x, HA.z));
  let n = 0;
  for (let cz = 0; cz < 25; cz++) for (let cx = 0; cx < 13; cx++) n += plantedIn(cx, cz).length;
  assert.equal(n, PLANTED_COUNT, 'every planted tree belongs to a chunk');
});

test('tall thickets grow only east of the Harad Road, with ways between', () => {
  assert.equal(thicketDensity(800, 2000), 0);
  let thick = 0, open = 0;
  for (let i = 0; i < 400; i++) {
    const z = 300 + i * 8, x = haradRoadX(z) + 90 + (i % 7) * 6;
    (thicketDensity(x, z) > 0.5 ? thick++ : open++);
  }
  assert.ok(thick > 200 && open > 20, `${thick} thick, ${open} open`);
});

test('region weights sum to one', () => {
  for (const [x, z] of [[200, 300], [1000, 1190], [600, 3200], [1650, 2000], [1250, 120]]) {
    const w = regionWeights(x, z);
    const sum = w.river + w.heath + w.central + w.south + w.foothill;
    assert.ok(Math.abs(sum - 1) < 1e-9);
    const d = forestDensity(x, z);
    assert.ok(d >= 0 && d <= 1);
  }
});

test('danger grows with distance from home', () => {
  assert.equal(dangerTier(HA.x, HA.z), 0);
  assert.equal(dangerTier(HA.x + 400, HA.z), 1);
  assert.ok(dangerTier(CROSSROADS.x, CROSSROADS.z) >= 3);
  assert.ok(dangerTier(600, 3400) > dangerTier(900, 1500));
});

test('blight lies on occupied camps and lifts when they are cleared', () => {
  const c = CAMPS[0];
  assert.ok(blightAt(c.x, c.z, () => 1) > 0.9);
  assert.equal(blightAt(c.x, c.z, () => 0), 0);
  assert.equal(blightAt(HA.x, HA.z, () => 1), 0, 'home is never blighted');
});

test('clearings keep trees off built places', () => {
  assert.ok(inClearing(HA.x - 10, HA.z));
  assert.ok(inClearing(CROSSROADS.x, CROSSROADS.z));
  assert.ok(!inClearing(HA.x - 10, HA.z + 40), 'the woods crowd the rim of the pool');
});

test('solids act as floors from above and walls from the side', () => {
  const x = 1200, z = 2404, g = heightAt(x, z);
  addSolid({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2, bottom: g - 1, top: g + 3 });
  assert.ok(blockedBySolid(x - 2.2, z, heightAt(x - 2.2, z), 0.4), 'blocked at ground level');
  assert.equal(groundAt(x, z, g + 3), g + 3, 'stands on top');
  assert.ok(!blockedBySolid(x, z, g + 3, 0.4), 'not blocked when on top');
  assert.equal(groundAt(x, z, g), g, 'the top is out of reach from below');
});

test('a hollow lets a body stand beneath the terrain', () => {
  const x = 500, z = 3000, g = heightAt(x, z);
  addHollow({ minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5, ceiling: g - 2 });
  addSolid({ minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5, bottom: g - 12, top: g - 8 });
  assert.equal(terrainAt(x, z, g - 7), -Infinity);
  assert.equal(groundAt(x, z, g - 8), g - 8, 'inside: stands on the cave floor');
  assert.equal(groundAt(x, z, g), g, 'outside: stands on the turf above');
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('a save round-trips', () => {
  const store = new SaveStore(memoryStorage());
  assert.equal(store.load(), null);
  const s = newState();
  s.player = { x: 1234.5, y: 30, z: 2345.5, heading: 1.2 };
  assert.equal(s.version, 2);
  s.discovered.push('arch', 'camp:c1');
  s.cleared.push('c1');
  s.settings.quality = 'low';
  assert.ok(store.save(s));
  const back = store.load();
  assert.deepEqual(back.player, s.player);
  assert.deepEqual(back.discovered, s.discovered);
  assert.deepEqual(back.cleared, ['c1']);
  assert.equal(back.settings.quality, 'low');
  store.clear();
  assert.equal(store.load(), null);
});

test('bad saves are rejected or repaired, never thrown', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate('nonsense'), null);
  assert.equal(migrate({ version: SAVE.version + 1 }), null, 'a save from the future is not trusted');
  const old = migrate({ version: 1, player: { x: 3000, z: 6000 }, discovered: ['arch'], cleared: ['c1'], settings: { quality: 'low' } });
  assert.deepEqual(old.player, newState().player, 'a save from the old, larger world starts again at home');
  assert.deepEqual(old.cleared, []);
  assert.equal(old.settings.quality, 'low', 'but keeps its settings');
  const fixed = migrate({ version: 2, player: { x: 1e9, z: NaN }, discovered: [1, 'arch'], cleared: 'no' });
  assert.deepEqual(fixed.player, newState().player, 'out-of-world position falls back to home');
  assert.deepEqual(fixed.discovered, ['henneth', 'arch']);
  assert.deepEqual(fixed.cleared, []);
  const storage = memoryStorage();
  storage.m.set(SAVE.key, '{not json');
  assert.equal(new SaveStore(storage).load(), null);
});

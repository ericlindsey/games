// Unit tests for the pure world logic. Run: node --test tests/unit.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt } from '../src/world/terrain.js';
import { HA, LANDMARKS, CAMPS, bankX, CROSSROADS, inClearing } from '../src/world/layout.js';
import { regionWeights, dangerTier, blightAt, forestDensity } from '../src/world/regions.js';
import { groundAt, blockedBySolid, addSolid } from '../src/world/collision.js';
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
  const z = 3000;
  assert.ok(heightAt(bankX(z) - 190, z) < -5, 'the Anduin is deep mid-channel');
  assert.ok(heightAt(bankX(z) + 100, z) > 0, 'the east bank is dry');
  assert.ok(heightAt(1600, z) > heightAt(600, z), 'the land rises eastward');
  assert.ok(heightAt(3100, z) > 300, 'the Ephel Dúath are high');
});

test('Henneth Annûn has a cliff facing west', () => {
  const top = heightAt(HA.outcrop.maxX + 4, HA.z), low = heightAt(HA.outcrop.minX - 4, HA.z);
  assert.ok(top - low > 15, `cliff of ${top - low} m`);
});

test('every landmark and camp stands on dry land inside the world', () => {
  for (const p of [...LANDMARKS, ...CAMPS]) {
    assert.ok(p.x > 0 && p.x < WORLD.width && p.z > 0 && p.z < WORLD.length, p.id);
    assert.ok(heightAt(p.x, p.z) > 0.3, `${p.id} is above water`);
  }
});

test('region weights sum to one', () => {
  for (const [x, z] of [[300, 500], [1600, 1900], [1000, 5000], [2600, 3000], [2000, 200]]) {
    const w = regionWeights(x, z);
    const sum = w.river + w.heath + w.central + w.south + w.foothill;
    assert.ok(Math.abs(sum - 1) < 1e-9);
    const d = forestDensity(x, z);
    assert.ok(d >= 0 && d <= 1);
  }
});

test('danger grows with distance from home', () => {
  assert.equal(dangerTier(HA.x, HA.z), 0);
  assert.equal(dangerTier(HA.x + 600, HA.z), 1);
  assert.ok(dangerTier(CROSSROADS.x, CROSSROADS.z) >= 3);
  assert.ok(dangerTier(1000, 5500) > dangerTier(1500, 2400));
});

test('blight lies on occupied camps and lifts when they are cleared', () => {
  const c = CAMPS[0];
  assert.ok(blightAt(c.x, c.z, () => 1) > 0.9);
  assert.equal(blightAt(c.x, c.z, () => 0), 0);
  assert.equal(blightAt(HA.x, HA.z, () => 1), 0, 'home is never blighted');
});

test('clearings keep trees off built places', () => {
  assert.ok(inClearing(HA.outcrop.minX + 5, HA.z));
  assert.ok(inClearing(CAMPS[0].x, CAMPS[0].z));
  assert.ok(!inClearing(1200, 2400));
});

test('solids act as floors from above and walls from the side', () => {
  const x = 1200, z = 2400, g = heightAt(x, z);
  addSolid({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2, bottom: g - 1, top: g + 3 });
  assert.ok(blockedBySolid(x - 2.2, z, heightAt(x - 2.2, z), 0.4), 'blocked at ground level');
  assert.equal(groundAt(x, z, g + 3), g + 3, 'stands on top');
  assert.ok(!blockedBySolid(x, z, g + 3, 0.4), 'not blocked when on top');
  assert.equal(groundAt(x, z, g), g, 'the top is out of reach from below');
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
  const fixed = migrate({ version: 1, player: { x: 1e9, z: NaN }, discovered: [1, 'arch'], cleared: 'no' });
  assert.deepEqual(fixed.player, newState().player, 'out-of-world position falls back to home');
  assert.deepEqual(fixed.discovered, ['henneth', 'arch']);
  assert.deepEqual(fixed.cleared, []);
  const storage = memoryStorage();
  storage.m.set(SAVE.key, '{not json');
  assert.equal(new SaveStore(storage).load(), null);
});

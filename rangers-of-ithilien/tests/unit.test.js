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
import { SAVE, WORLD, PLAYER } from '../src/config.js';

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
  assert.ok(depth(600) < 4, 'and has run out to ground level downstream');
});

test('you can walk out of the cut: from the pool, downstream, and up into the woods', () => {
  // Walk as the player does: small steps, refusing any rise steeper than maxSlope.
  const walk = (x, z, dx, dz, dist) => {
    for (let d = 0; d < dist; d += 0.25) {
      const nx = x + dx * 0.25, nz = z + dz * 0.25;
      const rise = heightAt(nx, nz) - heightAt(x, z);
      assert.ok(rise / 0.25 <= PLAYER.maxSlope, `blocked at (${nx.toFixed(1)}, ${nz.toFixed(1)}): rise ${rise.toFixed(2)} m`);
      x = nx; z = nz;
    }
    return [x, z];
  };
  // from the foot of the stair, across the basin floor to the mouth of the cut
  let [x, z] = walk(HA.basin.minX + 4, HA.z + 3, -1, 0, 8);
  // down the cut, on the path south of the stream, until the walls are gone
  [x, z] = walk(x, z, -1, 0, 380);
  assert.ok(x < 600);
  // and out to either side, onto open ground
  walk(x, z, 0, 1, 70);
  walk(x, z, 0, -1, 70);
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
  assert.equal(s.version, 3);
  s.items = { draught: 2, orcTrinket: 3 }; s.equipped.armour = 'mailShirt'; s.silver = 77; s.quests.active = ['f2']; s.quests.done = ['f1']; s.health = 61.5; s.picked = ['h3_4'];
  s.discovered.push('arch', 'camp:c1');
  s.cleared.push('c1');
  s.settings.quality = 'low';
  assert.ok(store.save(s));
  const back = store.load();
  assert.deepEqual(back.player, s.player);
  assert.deepEqual(back.discovered, s.discovered);
  assert.deepEqual(back.cleared, ['c1']);
  assert.equal(back.settings.quality, 'low');
  for (const k of ['items', 'equipped', 'silver', 'quests', 'health', 'picked', 'arrows', 'renown']) assert.deepEqual(back[k], s[k], k);
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
  const v2 = migrate({ version: 2, player: { x: 700, z: 1000, heading: 1 }, discovered: ['arch'], cleared: ['c5'] });
  assert.deepEqual(v2.cleared, ['c5'], 'a save from before gear and tasks keeps its progress');
  assert.deepEqual(v2.equipped, newState().equipped, 'and is given the starting kit');
  const junk = migrate({ version: 3, items: { nonsense: 4, draught: -2, waybread: 3.7 }, equipped: { sword: 'greatBow', armour: 'mailShirt' }, health: 9999 });
  assert.deepEqual(junk.items, { waybread: 3 });
  assert.equal(junk.equipped.sword, 'rangerSword', 'a bow cannot be worn as a sword');
  assert.equal(junk.equipped.armour, 'mailShirt');
  assert.equal(junk.health, 100);
  const fixed = migrate({ version: 2, player: { x: 1e9, z: NaN }, discovered: [1, 'arch'], cleared: 'no' });
  assert.deepEqual(fixed.player, newState().player, 'out-of-world position falls back to home');
  assert.deepEqual(fixed.discovered, ['henneth', 'arch']);
  assert.deepEqual(fixed.cleared, []);
  const storage = memoryStorage();
  storage.m.set(SAVE.key, '{not json');
  assert.equal(new SaveStore(storage).load(), null);
});

test('old paths join the places worth finding, and never lead over the cliff', async () => {
  const { PATHS, pathDistance, pathWear } = await import('../src/world/paths.js');
  const { RELICS } = await import('../src/world/relicSites.js');
  assert.ok(PATHS.length > 80 && RELICS.length >= 30);
  for (const r of RELICS) assert.ok(pathDistance(r.x, r.z + 7) < 3, `${r.id} is on a path`);
  for (const s of SITES) assert.ok(pathDistance(s.x, s.z + (s.kind === 'hamlet' ? 0 : 9)) < 3, `${s.id} is on a path`);
  assert.ok(pathDistance(HA.x - 29, HA.z + 26) < 3, 'a path starts at the head of the stair');
  for (const pts of PATHS) for (const [x, z] of pts) {
    assert.ok(!(x > 660 && x < HA.x + 30 && Math.abs(z - HA.z) < 20), 'no path crosses the pool or the cut');
    const w = pathWear(x, z);
    assert.ok(w >= 0.3 && w <= 1, 'a path always shows at least faintly along its line');
  }
});

test('the pack: carrying, wearing, using, buying and selling', async () => {
  const inv = await import('../src/systems/inventory.js');
  const { ITEMS, SHOP } = await import('../src/data/items.js');
  const s = newState();
  assert.equal(inv.stats(s).sword, ITEMS.rangerSword.damage);
  inv.addItem(s, 'gondorBlade');
  assert.ok(inv.equip(s, 'gondorBlade'));
  assert.equal(inv.stats(s).sword, ITEMS.gondorBlade.damage);
  assert.equal(inv.count(s, 'rangerSword'), 1, 'the old sword goes back in the pack');
  assert.equal(inv.count(s, 'gondorBlade'), 0);
  assert.ok(!inv.equip(s, 'mailShirt'), 'cannot wear what is not carried');
  assert.ok(!inv.removeItem(s, 'draught'), 'cannot remove what is not there');

  s.health = 100;
  assert.equal(inv.useItem(s, 'waybread'), 0, 'food is not wasted at full health');
  assert.equal(inv.count(s, 'waybread'), 2);
  s.health = 50;
  inv.addItem(s, 'draught');
  assert.equal(inv.quickHeal(s), 'draught', 'badly hurt: reach for the strong remedy');
  s.health = 90;
  assert.equal(inv.quickHeal(s), 'waybread', 'scratched: the small one will do');
  assert.equal(inv.useItem(s, 'waybread'), 10, 'healing stops at full health');

  s.silver = 10; s.renown = 0;
  const mail = SHOP.find((e) => e.item === 'mailShirt');
  assert.ok(!inv.shopFor(s).includes(mail), 'better gear waits on renown');
  assert.ok(!inv.buy(s, mail));
  assert.ok(inv.buy(s, SHOP.find((e) => e.item === 'arrows')));
  assert.equal(s.arrows, 34);
  assert.equal(s.silver, 2);
  assert.ok(!inv.buy(s, SHOP.find((e) => e.item === 'draught')), 'cannot buy without the silver');
  inv.addItem(s, 'haradGold');
  assert.ok(inv.sell(s, 'haradGold'));
  assert.equal(s.silver, 2 + ITEMS.haradGold.value);

  let n = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (const type of ['snaga', 'archer', 'uruk', 'haradrim', 'chief']) {
    for (let i = 0; i < 50; i++) for (const [id, c] of inv.enemyLoot(type, 3, rand)) assert.ok((id === 'silver' || id === 'arrows' || ITEMS[id]) && c > 0);
  }
  for (const c of CAMPS) for (const [id, k] of inv.stashLoot(c, rand)) assert.ok((id === 'silver' || id === 'arrows' || ITEMS[id]) && k > 0);
});

test('tasks: offered in order, tracked, and rewarded once', async () => {
  const q = await import('../src/systems/quests.js');
  const { QUESTS } = await import('../src/data/quests.js');
  const { ITEMS } = await import('../src/data/items.js');
  for (const def of QUESTS) { // every task is well formed
    q.progress(def.objective, newState());
    for (const r of def.requires ?? []) assert.ok(q.byId[r], `${def.id} requires a real task`);
    for (const id of Object.keys(def.reward.items ?? {})) assert.ok(ITEMS[id], `${def.id} rewards a real item`);
  }
  const s = newState();
  assert.equal(q.offerFrom('faramir', s).id, 'f1');
  assert.equal(q.offerFrom('eowyn', s).id, 'e1');
  assert.equal(q.tracker(s), null);
  q.accept(s, 'f1');
  assert.equal(q.offerFrom('faramir', s), null, 'one task at a time from each giver');
  assert.equal(q.tracker(s).target.id, q.NEAREST_CAMP.id, 'the tracker points at the camp');
  assert.equal(q.turnIn(s, 'f1'), null, 'cannot hand in an unfinished task');
  s.cleared.push(q.NEAREST_CAMP.id);
  assert.ok(q.tracker(s).done);
  const loot = q.turnIn(s, 'f1');
  assert.ok(loot.some(([id]) => id === 'silver'));
  assert.equal(s.silver, 30);
  assert.equal(s.renown, 1);
  assert.equal(q.turnIn(s, 'f1'), null, 'and only once');
  assert.equal(q.offerFrom('faramir', s).id, 'f2');

  q.accept(s, 'e1');
  s.items.athelas = 6;
  assert.ok(q.turnIn(s, 'e1'));
  assert.equal(s.items.athelas, 1, 'gathered things are handed over');

  // the heather task needs both the road found and a camp broken beyond it
  const heather = CAMPS.find((c) => c.x > haradRoadX(c.z) + 10);
  assert.ok(heather, 'there are camps in the heather');
  const o = q.byId.f3.objective;
  assert.equal(q.progress(o, s).have, 0);
  s.discovered.push('haradroad');
  assert.equal(q.progress(o, s).have, 1);
  s.cleared.push(heather.id);
  assert.equal(q.progress(o, s).have, 2);
  assert.ok(CAMPS.some((c) => c.size === 3), 'there are stockades for the stockade task');
});

test('every camp has a company to fight, stronger with size and distance', async () => {
  const { rosterFor, ENEMY_TYPES } = await import('../src/data/enemies.js');
  let total = 0;
  for (const c of CAMPS) {
    const r = rosterFor(c);
    total += r.length;
    assert.ok(r.length >= 2 && r.every((t) => ENEMY_TYPES[t]), c.id);
    assert.deepEqual(r, rosterFor(c), 'the same company every time');
    assert.equal(r.includes('chief'), c.size === 3, 'a captain in every stockade and nowhere else');
  }
  const mean = (size) => { const cs = CAMPS.filter((c) => c.size === size); return cs.reduce((n, c) => n + rosterFor(c).length, 0) / cs.length; };
  assert.ok(mean(1) < mean(2) && mean(2) < mean(3));
  assert.ok(total > 300, `${total} enemies in all`);
});

test('kingsfoil grows across the land and within reach of home', async () => {
  const { herbSites } = await import('../src/world/herbSites.js');
  const sites = herbSites();
  assert.ok(sites.length > 60, `${sites.length} plants`);
  assert.equal(new Set(sites.map((h) => h.id)).size, sites.length);
  assert.ok(sites.filter((h) => Math.hypot(h.x - HA.x, h.z - HA.z) < 250).length >= 5);
  for (const h of sites) assert.ok(heightAt(h.x, h.z) > 1, `${h.id} is on dry ground`);
});

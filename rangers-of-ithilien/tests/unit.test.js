// Unit tests for the pure world logic. Run: node --test tests/unit.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, streamDistance } from '../src/world/terrain.js';
import { HA, LANDMARKS, bankX, CROSSROADS, inClearing, haradRoadX, gorgeZ, stairTop, poolQ } from '../src/world/layout.js';
import { regionWeights, dangerTier, REFUGE } from '../src/world/regions.js';
import { forestDensity, thicketDensity } from '../src/world/forest.js';
import { CAMPS, blightAt, campNear } from '../src/world/campSites.js';
import { SITES, SITES as SITES_ALL, inField, plantedIn, PLANTED_COUNT } from '../src/world/oldworks.js';
import { groundAt, blockedBySolid, addSolid, addHollow, terrainAt } from '../src/world/collision.js';
import { newState, migrate, SaveStore } from '../src/systems/save.js';
import { SAVE, WORLD, PLAYER } from '../src/config.js';
import { QUESTS as QUESTS_ALL } from '../src/data/quests.js';

/** Every told task in hand, so the givers have none to offer (errands come only then). */
const busy = (st) => { for (const t of QUESTS_ALL) if (!st.quests.active.includes(t.id)) st.quests.active.push(t.id); };
const siteHouses = (id) => SITES_ALL.find((s) => s.id === id).houses.length;

test('terrain is deterministic and finite', () => {
  for (let i = 0; i < 200; i++) {
    const x = (i * 137.5) % WORLD.width, z = (i * 311.7) % WORLD.length;
    const h = heightAt(x, z);
    assert.ok(Number.isFinite(h));
    assert.equal(h, heightAt(x, z));
  }
});

test('the land has the right shape', () => {
  const z = 1725;
  assert.ok(heightAt(bankX(z) - 150, z) < -5, 'the Anduin is deep mid-channel');
  assert.ok(heightAt(bankX(z) + 80, z) > 0, 'the east bank is dry');
  assert.ok(heightAt(750, z) > heightAt(300, z), 'the land rises eastward');
  for (const zz of [500, 1500, 2400]) assert.ok(heightAt(WORLD.width, zz) > 200, 'the Ephel Dúath are high');
});

test('Henneth Annûn: a walled pool, a deep cut, and a way out downstream', () => {
  const rim = heightAt(HA.x - 16, HA.z + 24), floor = heightAt(HA.x - 16, HA.z + 8);
  assert.ok(rim - floor > 15, `the basin is ${(rim - floor).toFixed(1)} m deep`);
  assert.ok(heightAt(HA.x + 6, HA.z) - floor > 14, 'the stream falls a long way');
  for (const z of [HA.z - 24, HA.z + 24]) assert.ok(heightAt(HA.x - 16, z) > floor + 15, 'cliffs north and south');
  assert.ok(heightAt(HA.basin.minX - 12, HA.z + 16) > floor + 15, 'cliffs to the west, either side of the cut');
  // the cut: deep near the pool, running out to open ground downstream
  const depth = (x) => heightAt(x, HA.z + 16) - heightAt(x, HA.z + 3);
  assert.ok(depth(HA.x - 100) > 15, 'the cut is deep near the pool');
  assert.ok(depth(HA.x - 400) < 4, 'and has run out to ground level downstream');
});

test('Henneth Annûn: the fall drops into deep water, right under the cliff', async () => {
  const water = HA.floor - 0.12; // the pool's surface (hennethAnnun.js)
  for (const x of [HA.x - 2, HA.x - 1.5, HA.x - 0.5]) assert.ok(water - heightAt(x, HA.z) > 0.3, `deep water at the foot of the fall (x ${x})`);
  assert.ok(heightAt(HA.x - 0.05, HA.z) < water, 'the pool reaches the cliff face');
  // and the stream out of it starts within the pool, so the water runs on unbroken
  const { STREAMS } = await import('../src/world/terrain.js');
  const cut = STREAMS.find((s) => s.home === 'cut');
  assert.ok(poolQ(cut.points[0].x, cut.points[0].z) < 1, 'the cut stream begins in the pool');
});

test('Henneth Annûn: the stair lies against the south wall, all the way up', () => {
  const s = HA.stair;
  for (let x = s.x0; x <= HA.x - 0.2; x += 0.5) {
    const t = stairTop(x);
    // nothing of the ground rises through the treads...
    for (let z = HA.z + s.z0; z <= HA.z + s.z1; z += 0.2) assert.ok(heightAt(x, z) < t + 0.05, `the ground stays under the treads (x ${x}, z ${z.toFixed(1)})`);
    // ...and the wall stands right at their outer edge, with no gap to fall into
    assert.ok(heightAt(x, HA.z + s.z1 + 0.3) > t + 0.2, `the wall rises from the stair's outer edge (x ${x})`);
  }
  assert.equal(stairTop(s.x0), HA.floor);
  assert.equal(stairTop(s.x1), HA.caveFloor);
});

test('you can walk out of the cut: from the pool, down the stream, and up into the woods', async () => {
  const { STREAMS } = await import('../src/world/terrain.js');
  // Walk as the player does: small steps, refusing any rise steeper than maxSlope.
  let x = HA.basin.minX + 4, z = HA.z + 3;
  const walkTo = (tx, tz) => {
    for (let n = 0; n < 400; n++) {
      const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
      if (d < 0.3) return;
      const s = Math.min(0.25, d), nx = x + (dx / d) * s, nz = z + (dz / d) * s;
      const rise = heightAt(nx, nz) - heightAt(x, z);
      assert.ok(rise / s <= PLAYER.maxSlope, `blocked at (${nx.toFixed(1)}, ${nz.toFixed(1)}): rise ${rise.toFixed(2)} m`);
      x = nx; z = nz;
    }
  };
  // down the cut beside the stream, then on along the stream below it
  const course = [...STREAMS.find((s) => s.home === 'cut').points, ...STREAMS.find((s) => s.home === 'lower').points.slice(0, 30)];
  for (const p of course) walkTo(p.x, p.z + 1.6);
  assert.ok(x < HA.gorge.endX - 40, 'well past the end of the slot');
  // and out of the valley to either side, onto open ground
  const [x0, z0] = [x, z];
  walkTo(x0, z0 + 60);
  x = x0; z = z0;
  walkTo(x0, z0 - 60);
});

test('the cut is a narrow winding slot, deep near the pool and gone within 260 m', () => {
  const g = HA.gorge;
  const depth = (x) => Math.min(heightAt(x, gorgeZ(x) + g.halfTop + 6), heightAt(x, gorgeZ(x) - g.halfTop - 6)) - heightAt(x, gorgeZ(x) + 1.5);
  assert.ok(depth(HA.x - 100) > 15, 'deep near the pool');
  assert.ok(depth(g.endX - 40) < 4, 'run out by its end');
  assert.ok(HA.basin.minX - (g.endX - 40) < 260, 'and not too long');
  let lo = Infinity, hi = -Infinity;
  for (let x = g.endX; x < HA.basin.minX; x += 4) { lo = Math.min(lo, gorgeZ(x)); hi = Math.max(hi, gorgeZ(x)); }
  assert.ok(hi - lo > 4, 'it winds');
  assert.ok(g.halfTop * 2 < 15, 'and is narrow');
});

test('the world and its backdrop are whole numbers of their grids', () => {
  const b = WORLD.backdrop;
  for (const span of [b.maxX - b.minX, b.maxZ - b.minZ]) assert.ok(Number.isInteger(span / 32), `the backdrop spans whole 32 m steps (${span} m)`);
  for (const span of [WORLD.width, WORLD.length]) assert.ok(Number.isInteger(span / 20), 'and the far forest roof whole 20 m steps');
  assert.ok(b.minX < 0 && b.minZ < 0 && b.maxX > WORLD.width && b.maxZ > WORLD.length, 'the backdrop reaches past the land on every side');
  assert.equal(HA.x % 4, 0, 'the cliff and the hidden stair lie on the terrain\'s 4 m grid');
  assert.equal((HA.hatch.z0 % 4 + 4) % 4, 0);
  assert.equal(HA.rock.minZ % 4, 0);
});

test('every landmark stands on dry land inside the world', () => {
  for (const p of LANDMARKS) {
    assert.ok(p.x > 0 && p.x < WORLD.width && p.z > 0 && p.z < WORLD.length, p.id);
    if (p.id !== 'henneth') assert.ok(heightAt(p.x, p.z) > 0.1, `${p.id} is above water`);
  }
});

test('camps: many small ones north of home, larger to the south, diggings in the heather', () => {
  assert.equal(CAMPS.length, 100, 'a round hundred camps');
  assert.equal(new Set(CAMPS.map((c) => c.id)).size, CAMPS.length);
  for (const c of CAMPS) {
    assert.ok(Math.hypot(c.x - HA.x, c.z - HA.z) >= REFUGE + 19, `${c.id} keeps clear of home`);
    assert.ok(heightAt(c.x, c.z) > 1.5 && c.size >= 1 && c.size <= 4 && c.tier >= 1, c.id);
    assert.equal(campNear(c.x, c.z, 5).id, c.id);
    assert.equal(c.kind === 'mine', c.x > haradRoadX(c.z) + 15, `${c.id}: diggings lie east of the road and nowhere else`);
    assert.ok(blightAt(c.x, c.z, () => 1) > 0.9, `${c.id} blights its own ground`);
  }
  const north = CAMPS.filter((c) => c.z < HA.z && c.kind === 'camp');
  assert.ok(north.length >= 25, `${north.length} camps in the northern hunting ground`);
  assert.ok(north.filter((c) => c.size === 1).length > north.length * 0.75, 'and they are small');
  const meanZ = (f) => { const cs = CAMPS.filter(f); return cs.reduce((n, c) => n + c.z, 0) / cs.length; };
  assert.ok(meanZ((c) => c.size >= 3) > meanZ((c) => c.size === 1) + 600, 'the great camps lie well to the south');
  assert.equal(CAMPS.filter((c) => c.size === 4).length, 3, 'there are three war-camps, as Faramir says');
  // not laid out on a grid: the gaps between neighbours vary widely
  const gaps = north.map((c) => Math.min(...north.filter((o) => o !== c).map((o) => Math.hypot(o.x - c.x, o.z - c.z))));
  assert.ok(Math.max(...gaps) > 2.2 * Math.min(...gaps), `nearest-neighbour gaps from ${Math.min(...gaps).toFixed(0)} to ${Math.max(...gaps).toFixed(0)} m`);
});

test('old farms and villages leave fields and planted rows', () => {
  assert.ok(SITES.filter((s) => s.kind === 'farm').length >= 20);
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
  assert.equal(thicketDensity(600, 1500), 0);
  let thick = 0, open = 0;
  for (let i = 0; i < 400; i++) {
    const z = 225 + i * 6, x = haradRoadX(z) + 68 + (i % 7) * 5;
    (thicketDensity(x, z) > 0.5 ? thick++ : open++);
  }
  assert.ok(thick > 200 && open > 20, `${thick} thick, ${open} open`);
});

test('region weights sum to one', () => {
  for (const [x, z] of [[150, 225], [HA.x, HA.z], [450, 2400], [1240, 1500], [938, 90]]) {
    const w = regionWeights(x, z);
    const sum = w.river + w.heath + w.central + w.south + w.foothill;
    assert.ok(Math.abs(sum - 1) < 1e-9);
    const d = forestDensity(x, z);
    assert.ok(d >= 0 && d <= 1);
  }
});

test('danger grows with distance from home', () => {
  assert.equal(dangerTier(HA.x, HA.z), 0);
  assert.equal(dangerTier(HA.x + 300, HA.z), 1);
  assert.equal(dangerTier(675, 225), 1, 'the far north is still the hunting ground of a new ranger');
  assert.ok(dangerTier(CROSSROADS.x, CROSSROADS.z) >= 3);
  assert.ok(dangerTier(450, 2550) > dangerTier(675, 1500) && dangerTier(675, 1500) > dangerTier(675, 675), 'danger grows southward');
  assert.ok(dangerTier(1240, 675) > dangerTier(675, 675), 'and the heather is worse than the woods beside it');
});

test('blight lies on occupied camps and lifts when they are cleared', () => {
  const c = CAMPS[0];
  assert.ok(blightAt(c.x, c.z, () => 1) > 0.9);
  assert.equal(blightAt(c.x + 150, c.z, (id) => (id === c.id ? 1 : 0)), 0, 'and it does not reach far');
  assert.equal(blightAt(c.x, c.z, () => 0), 0);
  assert.equal(blightAt(HA.x, HA.z, () => 1), 0, 'home is never blighted');
});

test('clearings keep trees off built places', () => {
  assert.ok(inClearing(HA.x - 10, HA.z));
  assert.ok(inClearing(CROSSROADS.x, CROSSROADS.z));
  assert.ok(!inClearing(HA.x - 10, HA.z + 40), 'the woods crowd the rim of the pool');
});

test('solids act as floors from above and walls from the side', () => {
  const x = 900, z = 1803, g = heightAt(x, z);
  addSolid({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2, bottom: g - 1, top: g + 3 });
  assert.ok(blockedBySolid(x - 2.2, z, heightAt(x - 2.2, z), 0.4), 'blocked at ground level');
  assert.equal(groundAt(x, z, g + 3), g + 3, 'stands on top');
  assert.ok(!blockedBySolid(x, z, g + 3, 0.4), 'not blocked when on top');
  assert.equal(groundAt(x, z, g), g, 'the top is out of reach from below');
});

test('a hollow lets a body stand beneath the terrain', () => {
  const x = 375, z = 2250, g = heightAt(x, z);
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
  assert.equal(s.version, 9);
  assert.equal(s.settings.fps, false, 'the frame-rate counter starts off');
  s.items = { draught: 2, orcTrinket: 3 }; s.equipped.body = 'mailShirt'; s.equipped.helm = 'leatherCap'; s.silver = 77; s.quests.done = ['f1']; s.health = 61.5; s.picked = ['h3_4'];
  s.honour = 140; s.renown = 4; s.wear = { rangerSword: 0.5 }; s.honed = { rangerBow: 1 }; s.skills = { repair: true }; s.told = ['c9']; s.stats.bands = 2;
  const errand = { id: 'xf0', giver: 'faramir', errand: 'bands', title: 'Watch on the road', offer: '', remind: '', done: '', objective: { type: 'bands', count: 1, base: 2 }, reward: { silver: 8, honour: 14, items: {} } };
  s.quests.active = ['f2', 'xf0']; s.quests.errands = [errand]; s.quests.count = { eowyn: 3 }; s.quests.asked = { f2: 2 }; s.quests.marks = { f2: { x: 5, z: 6 } };
  s.discovered.push('arch', 'camp:c1');
  s.cleared.push('c1');
  s.settings.quality = 'low';
  assert.equal(s.settings.cap, 0, 'the frame rate starts uncapped');
  s.settings.cap = 30;
  s.settled = ['hamlet4']; s.homesteads = ['farm5']; s.escort = { site: 'hamlet2', x: 300, z: 480, following: true };
  assert.ok(store.save(s));
  const back = store.load();
  assert.deepEqual(back.player, s.player);
  assert.deepEqual(back.discovered, s.discovered);
  assert.deepEqual(back.cleared, ['c1']);
  assert.equal(back.settings.quality, 'low');
  assert.equal(back.settings.cap, 30, 'a frame-rate cap is kept');
  for (const k of ['items', 'equipped', 'silver', 'quests', 'health', 'picked', 'arrows', 'renown', 'honour', 'wear', 'honed', 'skills', 'told', 'stats', 'settled', 'homesteads']) assert.deepEqual(back[k], s[k], k);
  assert.deepEqual(back.escort, { site: 'hamlet2', x: 300, z: 480, following: false }, 'settlers on the way wait where they were left');
  store.clear();
  assert.equal(store.load(), null);
});

test('bad saves are rejected or repaired, never thrown', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate('nonsense'), null);
  assert.equal(migrate({ version: SAVE.version + 1 }), null, 'a save from the future is not trusted');
  const v6 = migrate({ version: 6, player: { x: 700, z: 1000, heading: 1 }, discovered: ['arch'], cleared: ['c5'], silver: 40, settings: { quality: 'medium' } });
  assert.ok(v6.discovered.includes('arch') && v6.cleared.includes('c5') && v6.silver === 40 && v6.settings.quality === 'medium' && v6.settings.fps === false, 'a v6 save keeps everything, with the counter off');
  assert.deepEqual([v6.settled, v6.homesteads, v6.escort], [[], [], null], 'and has no settlements yet');
  const v6q = migrate({ version: 6, quests: { active: ['f5', 'e4', 'f17'], done: ['f1', 'e3'] } });
  assert.deepEqual(v6q.quests.active, ['f17'], 'tasks that are gone (the sights, the counts of places) are dropped from hand');
  const v5 = migrate({ version: 5, player: { x: 700, z: 1000, heading: 1 }, discovered: ['arch'], cleared: ['c5'], silver: 40, renown: 9, honour: 400, settings: { quality: 'medium', fps: true } });
  assert.deepEqual(v5.player, newState().player, 'a save from the larger world before 0.5 begins again at home');
  assert.deepEqual(v5.cleared, [], 'its camps meant other places');
  assert.ok(v5.silver === 0 && v5.renown === 0 && !v5.discovered.includes('arch'), 'and its ranger starts anew');
  assert.ok(v5.settings.quality === 'medium' && v5.settings.fps === true, 'but keeps the settings, the counter among them');
  const old = migrate({ version: 1, player: { x: 3000, z: 6000 }, discovered: ['arch'], cleared: ['c1'], settings: { quality: 'low' } });
  assert.deepEqual(old.player, newState().player, 'a save from the old, larger world starts again at home');
  assert.deepEqual(old.cleared, []);
  assert.equal(old.settings.quality, 'low', 'but keeps its settings');
  const v3 = migrate({ version: 3, player: { x: 700, z: 1000, heading: 1 }, discovered: ['arch'], cleared: ['c5'], renown: 17, equipped: { sword: 'guardBlade' }, settings: { quality: 'high' } });
  assert.deepEqual(v3.cleared, [], 'a save from before the v0.2 gear and renown begins again');
  assert.equal(v3.renown, 0);
  assert.deepEqual(v3.equipped, newState().equipped, 'with the starting kit');
  assert.equal(v3.settings.quality, 'high', 'but keeps its settings');
  const junk = migrate({ version: 6, items: { nonsense: 4, draught: -2, waybread: 3.7 }, equipped: { sword: 'greatBow', bow: null, body: 'mailShirt', helm: 'mailShirt' }, health: 9999,
    honour: 300, renown: 49, wear: { rangerSword: 7, nonsense: 0.5 }, quests: { active: ['xf9', 'f1'], errands: [{ id: 'xf9' }] } });
  assert.deepEqual(junk.items, { waybread: 3 });
  assert.equal(junk.equipped.sword, 'rangerSword', 'a bow cannot be worn as a sword');
  assert.equal(junk.equipped.bow, 'rangerBow', 'nor a ranger go without a bow');
  assert.equal(junk.equipped.body, 'mailShirt');
  assert.equal(junk.equipped.helm, null, 'mail is not a helm');
  assert.equal(junk.health, 100);
  assert.equal(junk.renown, 8, 'renown is worked out from the points, not trusted');
  assert.deepEqual(junk.wear, { rangerSword: 1 });
  assert.deepEqual(junk.quests.active, ['f1'], 'a broken errand is dropped');
  const fixed = migrate({ version: 6, player: { x: 1e9, z: NaN }, discovered: [1, 'arch'], cleared: 'no' });
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
  assert.ok(PATHS.length > 60 && RELICS.length >= 24);
  for (const r of RELICS) assert.ok(pathDistance(r.x, r.z + 7) < 3, `${r.id} is on a path`);
  for (const s of SITES) assert.ok(pathDistance(s.x, s.z + (s.kind === 'hamlet' ? 0 : 9)) < 3, `${s.id} is on a path`);
  assert.ok(pathDistance((HA.hatch.x0 + HA.hatch.x1) / 2, (HA.hatch.z0 + HA.hatch.z1) / 2) > 40, 'no path leads to the hidden stair');
  for (const pts of PATHS) for (const [x, z] of pts) {
    assert.ok(!(x > HA.basin.minX - 6 && x < HA.x + 30 && Math.abs(z - HA.z) < 20), 'no path crosses the pool');
    assert.ok(!(x > HA.gorge.endX && x < HA.basin.minX && Math.abs(z - gorgeZ(x)) < HA.gorge.halfTop + 2), 'or the cut');
    const w = pathWear(x, z);
    assert.ok(w >= 0.3 && w <= 1, 'a path always shows at least faintly along its line');
  }
});

test('the pack: carrying, wearing, using, buying and selling', async () => {
  const inv = await import('../src/systems/inventory.js');
  const { ITEMS, SHOP } = await import('../src/data/items.js');
  const s = newState();
  assert.equal(inv.stats(s).sword, ITEMS.rangerSword.damage);
  inv.addItem(s, 'guardBlade');
  assert.ok(inv.equip(s, 'guardBlade'));
  assert.equal(inv.stats(s).sword, ITEMS.guardBlade.damage);
  assert.equal(inv.count(s, 'rangerSword'), 1, 'the old sword goes back in the pack');
  assert.equal(inv.count(s, 'guardBlade'), 0);
  assert.ok(!inv.equip(s, 'mailShirt'), 'cannot wear what is not carried');
  assert.ok(!inv.removeItem(s, 'draught'), 'cannot remove what is not there');
  for (const id of ['mailShirt', 'gondorHelm', 'ironGreaves']) { inv.addItem(s, id); assert.ok(inv.equip(s, id)); }
  assert.ok(Math.abs(inv.stats(s).defence - (ITEMS.mailShirt.defence + ITEMS.gondorHelm.defence + ITEMS.ironGreaves.defence)) < 1e-9, 'the pieces of armour add up');
  assert.ok(inv.unequip(s, 'helm') && s.equipped.helm === null && inv.count(s, 'gondorHelm') === 1, 'a helm can be taken off');
  assert.ok(!inv.unequip(s, 'sword'), 'but the sword stays in hand');

  s.health = 100;
  assert.equal(inv.useItem(s, 'waybread'), 0, 'food is not wasted at full health');
  assert.equal(inv.count(s, 'waybread'), 2);
  s.health = 50;
  inv.addItem(s, 'draught');
  assert.equal(inv.quickHeal(s), 'draught', 'badly hurt: reach for the strong remedy');
  s.health = 90;
  assert.equal(inv.quickHeal(s), 'waybread', 'scratched: the small one will do');
  assert.equal(inv.useItem(s, 'waybread'), 10, 'healing stops at full health');

  s.silver = 14; s.renown = 0;
  const mail = SHOP.find((e) => e.item === 'mailShirt');
  assert.ok(!inv.shopFor(s).includes(mail), 'better gear waits on renown');
  assert.ok(!inv.buy(s, mail));
  assert.ok(inv.buy(s, SHOP.find((e) => e.item === 'arrows')));
  assert.equal(s.arrows, 34);
  assert.equal(s.silver, 2);
  s.renown = mail.renown; s.silver = 500;
  assert.ok(!inv.buy(s, mail), 'gear already owned is not sold twice');
  assert.ok(inv.owns(s, 'rangerBow'), 'worn gear counts as owned');
  assert.equal(s.silver, 500);
  s.silver = 2;
  assert.ok(!inv.buy(s, SHOP.find((e) => e.item === 'draught')), 'cannot buy without the silver');
  assert.ok(SHOP.every((e) => e.item === 'arrows' || ITEMS[e.item]), 'everything in the shop is a real item');
  inv.addItem(s, 'haradGold');
  assert.ok(inv.sell(s, 'haradGold'));
  assert.equal(s.silver, 2 + ITEMS.haradGold.value);

  let n = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (const type of ['snaga', 'archer', 'uruk', 'haradrim', 'chief']) {
    for (let i = 0; i < 50; i++) for (const [id, c] of inv.enemyLoot(type, 3, rand, i % 2 === 0)) assert.ok((id === 'silver' || id === 'arrows' || ITEMS[id]) && c > 0);
  }
  let heads = 0;
  const want = { arrowheads: 3 };
  for (let i = 0; i < 200; i++) {
    heads += inv.enemyLoot('archer', 3, rand, true, want).some(([id]) => id === 'arrowheads') ? 1 : 0;
    assert.ok(!inv.enemyLoot('archer', 3, rand, false, want).some(([id]) => id === 'arrowheads'), 'only archers on the road carry the arrowheads');
  }
  assert.ok(heads > 100, 'and most of those do');
  // trophies only while an errand wants them; plain loot is only things worth silver, food and gear
  for (const type of ['snaga', 'archer', 'uruk', 'haradrim', 'chief']) for (let i = 0; i < 200; i++) {
    for (const [id] of inv.enemyLoot(type, 3, rand, true)) assert.notEqual(ITEMS[id]?.kind, 'trophy', `${type} drops ${id} with no errand for it`);
  }
  const t = newState();
  assert.deepEqual(inv.wantedTrophies(t), {});
  t.quests.errands = [{ id: 'xf1', giver: 'faramir', objective: { type: 'gather', item: 'orcBlade', count: 3 } }]; t.quests.active = ['xf1'];
  t.items.orcBlade = 1;
  assert.deepEqual(inv.wantedTrophies(t), { orcBlade: 2 }, 'an errand in hand wants what it still lacks');
  assert.ok(!inv.sellable('orcBlade') && !inv.sellable('baySeed') && !inv.sellable('athelas') && inv.sellable('blackCoin'), 'Mablung buys no trophies, plants or seed');
  assert.ok(!inv.sell(t, 'orcBlade') && t.items.orcBlade === 1);
  for (const c of CAMPS) for (const [id, k] of inv.stashLoot(c, rand)) assert.ok((id === 'silver' || id === 'arrows' || ITEMS[id]) && k > 0);
});

test('gear is many, spread across the whole of renown, and every piece shows on the ranger', async () => {
  const { ITEMS, SHOP, SLOTS } = await import('../src/data/items.js');
  const gear = Object.entries(ITEMS).filter(([, it]) => it.slot);
  for (const slot of SLOTS) assert.ok(gear.filter(([, it]) => it.slot === slot).length >= 4, `at least four kinds of ${slot}`);
  for (const [id, it] of gear) assert.ok(it.look && typeof it.value === 'number', `${id} has a look and a value`);
  const levels = {};
  for (const [, it] of gear) if (it.damage) levels[it.slot + it.damage] = (levels[it.slot + it.damage] ?? 0) + 1;
  assert.ok(Object.values(levels).filter((k) => k > 1).length >= 3, 'several weapons share a damage level');
  const rs = SHOP.map((e) => e.renown);
  assert.ok(Math.max(...rs) >= 45, 'the best of the shop comes late');
  assert.ok(rs.filter((r) => r >= 25).length >= 6, 'and there is plenty to work toward after the middle');
  const best = (slot) => Math.max(...gear.filter(([, it]) => it.slot === slot).map(([, it]) => it.damage ?? it.defence));
  const early = (slot) => Math.max(...SHOP.filter((e) => e.renown <= 17 && ITEMS[e.item]?.slot === slot).map((e) => ITEMS[e.item].damage ?? ITEMS[e.item].defence));
  assert.ok(early('sword') < best('sword') * 0.75 && early('bow') < best('bow') * 0.75, 'at renown 17 the best is still far off');
  const { rangerLook } = await import('../src/entities/figure.js').catch(() => ({}));
  if (rangerLook) { // (needs Three.js; skipped where it cannot load)
    const look = rangerLook({ sword: 'southronScimitar', bow: 'hornBow', body: 'blackMail', helm: 'gondorHelm', legs: 'ironGreaves' });
    assert.equal(look.bladeShape, 'curved');
    assert.equal(look.bowTips, ITEMS.hornBow.look.tips);
    assert.equal(look.mail, ITEMS.blackMail.look.mail);
    assert.ok(look.helm && !look.hood && look.greaves);
  }
});

test('weapons wear, and can be mended, honed and restrung', async () => {
  const inv = await import('../src/systems/inventory.js');
  const { ITEMS, REPAIR, HONE } = await import('../src/data/items.js');
  const s = newState();
  const full = inv.stats(s).sword;
  let said = [];
  for (let i = 0; i < 1 / inv.WEAR_PER_USE + 5; i++) { const w = inv.wearOnce(s, 'sword'); if (w !== null) said.push(w); }
  assert.deepEqual(said, [90, 80, 70, 60, 50, 40, 30, 20, 10, 0], 'the ranger is told at every tenth as the edge goes');
  assert.ok(1 / inv.WEAR_PER_USE <= 150, 'and it goes quickly enough that mending is worth learning');
  assert.equal(inv.condition(s, 'rangerSword'), 0);
  assert.ok(Math.abs(inv.stats(s).sword - full * 0.1) < 1e-9, 'a worn-out blade does a tenth');
  s.wear.rangerSword = 0.7;
  assert.ok(Math.abs(inv.stats(s).sword - full * 0.7) < 1e-9, 'at 70% sound it does 70%');
  s.wear.rangerSword = 0;
  s.silver = 100;
  const price = inv.repairPrice(s, 'rangerSword');
  assert.ok(price > 0 && inv.repair(s, 'rangerSword'));
  assert.equal(s.silver, 100 - price);
  assert.equal(inv.stats(s).sword, full, 'mended');
  assert.equal(inv.repairPrice(s, 'rangerSword'), 0);
  s.wear.haradBlade = 0; s.wear.yewBow = 0;
  for (const [id, kit] of [['haradBlade', 'whetstone'], ['yewBow', 'bowstring']]) {
    assert.ok(inv.repairPrice(s, id) < inv.buyPrice({ item: kit }), `mending ${id} costs less than a ${kit}, however fine it is`);
  }

  for (let i = 0; i < 30; i++) inv.wearOnce(s, 'bow');
  inv.addItem(s, 'bowstring');
  assert.ok(!inv.useKit(s, 'bowstring'), 'a kit is no use until Mablung has taught it');
  assert.ok(!inv.canLearnRepair(s), 'and he teaches only a ranger of some renown');
  s.renown = REPAIR.teachRenown; s.silver = REPAIR.teachPrice;
  assert.ok(inv.learnRepair(s) && s.skills.repair && s.silver === 0);
  assert.ok(inv.shopFor(s).some((e) => e.item === 'whetstone'), 'then he sells the kits');
  assert.ok(inv.useKit(s, 'bowstring') && inv.condition(s, 'rangerBow') === 1 && inv.count(s, 'bowstring') === 0);

  s.renown = 0; s.silver = 1000;
  assert.ok(!inv.hone(s, 'rangerSword'), 'honing waits on renown');
  for (const step of HONE) { s.renown = step.renown; assert.ok(inv.hone(s, 'rangerSword')); }
  assert.ok(!inv.hone(s, 'rangerSword'), 'three times at most');
  assert.equal(inv.stats(s).sword, ITEMS.rangerSword.damage + 3);
});

test('renown: slow to earn, fifty only near the end, and the enemy grows with it', async () => {
  const r = await import('../src/systems/renown.js');
  const { rosterFor } = await import('../src/data/enemies.js');
  const { QUESTS } = await import('../src/data/quests.js');
  for (let n = 1; n <= r.MAX_RENOWN; n++) assert.ok(r.pointsFor(n) > r.pointsFor(n - 1));
  assert.equal(r.levelFor(r.pointsFor(12)), 12);
  assert.equal(r.levelFor(r.pointsFor(12) - 1), 11);
  assert.equal(r.levelFor(1e9), r.MAX_RENOWN);
  // everything the camps and the told tasks are worth
  let camps = 0;
  for (const c of CAMPS) { camps += r.HONOUR.camp[c.size]; for (const t of rosterFor(c, 25)) camps += r.HONOUR.kill[t]; }
  const told = QUESTS.reduce((n, q) => n + (q.reward.honour ?? 0), 0);
  assert.ok(camps + told < r.pointsFor(r.MAX_RENOWN), 'camps and told tasks alone do not reach fifty');
  assert.ok(camps + told > r.pointsFor(40), 'but they come within reach of it');
  const s = newState();
  assert.equal(r.addHonour(s, r.pointsFor(3)), 3);
  assert.equal(s.renown, 3);
  assert.equal(r.addHonour(s, 1), 0, 'no news when the level does not change');
  const c = CAMPS.find((k) => k.size === 2);
  assert.ok(rosterFor(c, 45).length > rosterFor(c, 0).length, 'a famous ranger meets bigger companies');
  assert.ok(r.enemyStrength(50).hp > 1.4 && r.enemyStrength(0).hp === 1);
});

test('errands never run out, grow slowly, and can be done', async () => {
  const q = await import('../src/systems/quests.js');
  const { ITEMS } = await import('../src/data/items.js');
  const { QUESTS } = await import('../src/data/quests.js');
  const s = newState();
  assert.equal(q.errandFrom('faramir', s), null, 'Faramir has no errands until the nearest fire is out');
  s.quests.done.push('f1', 'f3'); // (and has sent the ranger to the road, so the bands are asked for)
  assert.equal(q.errandFrom('faramir', s), null, 'nor while he has a told task to offer: the story comes first');
  busy(s);
  const seen = { faramir: new Set(), eowyn: new Set() };
  for (let n = 0; n < 40; n++) {
    for (const giver of ['faramir', 'eowyn']) {
      const e = q.errandFrom(giver, s);
      assert.ok(e, `${giver} has errand ${n}`);
      seen[giver].add(e.errand);
      for (const id of Object.keys(e.reward.items)) assert.ok(ITEMS[id], `${e.id} rewards a real item`);
      assert.ok(e.title && e.offer && e.remind && e.done && e.reward.honour > 0);
      q.acceptErrand(s, e);
      assert.equal(q.errandFrom(giver, s), null, 'one errand at a time from each');
      const p = q.progress(e.objective, s);
      assert.ok(p.have < p.need, `${e.id} is not done before it is begun`);
      s.quests.errands = s.quests.errands.filter((x) => x.id !== e.id); // (as if handed in)
      s.quests.active = s.quests.active.filter((x) => x !== e.id);
      s.quests.count[giver] = n + 1;
    }
  }
  assert.ok(seen.faramir.size >= 4 && seen.eowyn.size >= 3, 'they cycle through their kinds');
  assert.ok(!seen.eowyn.has('seeds'), 'Éowyn asks for no seed: the settlers ask for their own');
  assert.ok(!seen.faramir.has('captain'), 'no captain is asked for while the work is in the north, where there are none');
  // and even with every camp broken and every place found there is work
  const done = newState();
  done.cleared = CAMPS.map((c) => c.id);
  done.discovered.push(...q.PLACES.map((p) => p.id));
  done.quests.done.push(...QUESTS.map((t) => t.id));
  for (const giver of ['faramir', 'eowyn']) assert.ok(q.errandFrom(giver, done), `${giver} still has work at the end`);

  // a trophy errand, done and handed in
  const t = newState();
  t.quests.done.push('f1');
  busy(t);
  t.quests.count.faramir = 2;
  const e = q.errandFrom('faramir', t);
  assert.equal(e.objective.type, 'gather');
  q.acceptErrand(t, e);
  t.items[e.objective.item] = e.objective.count + 1;
  const back = q.turnIn(t, e.id);
  assert.ok(back && back.loot.some(([id]) => id === 'silver'));
  assert.equal(t.items[e.objective.item], 1, 'trophies are handed over');
  assert.equal(t.quests.count.faramir, 3);
  assert.ok(t.honour > 0);
});

test('asked again, they give a direction; a third time, they mark it on the map', async () => {
  const q = await import('../src/systems/quests.js');
  const s = newState();
  q.accept(s, 'f2');
  const def = q.byId.f2;
  assert.ok(!q.remindText(def, s).includes(' of here'));
  assert.ok(q.remindText(def, s).includes(' of here'), 'the second asking names a direction');
  assert.ok(!s.quests.marks.f2);
  assert.ok(q.remindText(def, s).includes('mark'));
  assert.ok(s.quests.marks.f2, 'the third puts a mark on the map');
  assert.deepEqual(q.tracker(s).target, s.quests.marks.f2, 'and the tracker follows it');
  assert.equal(q.directionWords(HA.x, HA.z - 1500).slice(0, 12), 'to the north');
  // Faramir's map always shows a few camps more than the ranger's
  const scouted = q.scoutedCamps(s);
  assert.equal(scouted.length, 3);
  for (const c of scouted) assert.ok(!s.discovered.includes('camp:' + c.id));
  s.discovered.push(...scouted.map((c) => 'camp:' + c.id));
  assert.ok(q.scoutedCamps(s).every((c) => !scouted.includes(c)), 'found, they give way to others');
});

test('tasks: offered in order, tracked, and rewarded once', async () => {
  const q = await import('../src/systems/quests.js');
  const { QUESTS } = await import('../src/data/quests.js');
  const { ITEMS } = await import('../src/data/items.js');
  for (const def of QUESTS) { // every task is well formed
    const p = q.progress(def.objective, newState());
    assert.ok(p.need > 0 && Number.isFinite(p.need), `${def.id} has something to do`);
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
  const { loot } = q.turnIn(s, 'f1');
  assert.ok(loot.some(([id]) => id === 'silver'));
  assert.equal(s.silver, q.byId.f1.reward.silver);
  assert.equal(s.honour, q.byId.f1.reward.honour);
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

test('every camp has a company to fight, stronger with size; archers in most', async () => {
  const { rosterFor, patrolRoster, ENEMY_TYPES } = await import('../src/data/enemies.js');
  let total = 0, withArchers = 0;
  for (const c of CAMPS) {
    const r = rosterFor(c);
    total += r.length;
    if (r.includes('archer')) withArchers++;
    assert.ok(r.length >= 2 && r.every((t) => ENEMY_TYPES[t]), c.id);
    assert.deepEqual(r, rosterFor(c), 'the same company every time');
    assert.equal(r.includes('chief') || r.includes('marshal'), c.size >= 3, 'a captain in every stockade and nowhere else');
    if (c.size === 1 && c.tier === 1) assert.ok(r.length <= 4, 'the smallest camps near home are two to four');
    if (c.size === 2) assert.ok(r.includes('archer'), 'every band keeps an archer');
  }
  const mean = (size) => { const cs = CAMPS.filter((c) => c.size === size); return cs.reduce((n, c) => n + rosterFor(c).length, 0) / cs.length; };
  assert.ok(mean(1) < mean(2) && mean(2) < mean(3) && mean(3) < mean(4));
  assert.ok(withArchers > CAMPS.length * 0.6 && withArchers < CAMPS.length * 0.9, `${withArchers} of ${CAMPS.length} camps have archers`);
  const near = CAMPS.filter((c) => c.size === 1 && c.tier === 1);
  const nearArchers = near.filter((c) => rosterFor(c).includes('archer')).length;
  assert.ok(nearArchers > near.length * 0.3 && nearArchers < near.length * 0.7, `even near home, some stragglers keep an archer (${nearArchers} of ${near.length})`);
  assert.ok(total > 300, `${total} enemies in all`);

  let n = 1, hosts = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 400; i++) {
    const p = patrolRoster(3, rand);
    assert.ok(p.list.every((t) => ENEMY_TYPES[t]));
    if (p.host) { hosts++; assert.ok(p.list.length >= 10, 'a host is too many to fight'); } else assert.ok(p.list.length <= 4);
  }
  assert.ok(hosts > 15 && hosts < 100, `${hosts} hosts in 400 bands: rare but real`);
});

test('kingsfoil grows across the land and within reach of home', async () => {
  const { herbSites } = await import('../src/world/herbSites.js');
  const sites = herbSites();
  assert.ok(sites.length > 60, `${sites.length} plants`);
  assert.equal(new Set(sites.map((h) => h.id)).size, sites.length);
  assert.ok(sites.filter((h) => Math.hypot(h.x - HA.x, h.z - HA.z) < 250).length >= 5);
  for (const h of sites) assert.ok(heightAt(h.x, h.z) > 1, `${h.id} is on dry ground`);
});

test('streams run downhill all the way, in valleys of their own', async () => {
  const { STREAMS, streamDistance } = await import('../src/world/terrain.js');
  assert.ok(STREAMS.length >= 10, `${STREAMS.length} streams`);
  assert.ok(STREAMS.filter((s) => s.joins).length >= 3, 'some join others before they reach the river');
  for (const s of STREAMS) {
    for (let i = 1; i < s.points.length; i++) {
      assert.ok(s.points[i].bed <= s.points[i - 1].bed, 'a stream bed never rises on the way down');
    }
    if (s.joins) {
      const at = STREAMS[s.joins.stream].points[s.joins.index];
      assert.ok(at.bed <= s.points[s.points.length - 1].bed + 1e-9, 'and it meets the stream it joins at or above that stream\u2019s level');
    }
    const mid = s.points[Math.floor(s.points.length / 2)];
    assert.ok(streamDistance(mid.x, mid.z) < 1);
    if (!s.home) assert.ok(Math.abs(heightAt(mid.x, mid.z) - mid.bed) < 2.5, 'the ground is cut down to the bed');
  }
  // the water leaves the pool at Henneth Annûn below the pool, not above it
  const cut = STREAMS.find((s) => s.home === 'cut');
  assert.ok(cut.points[0].bed + 0.45 < HA.floor - 0.1, 'the stream leaves the pool lower than the pool');
});

test('ruins stand level with the land around them, not in a bowl or on a mound', () => {
  for (const l of LANDMARKS.filter((x) => x.flat && x.id !== 'osgiliath')) {
    const centre = heightAt(l.x, l.z);
    let lowest = Infinity, highest = -Infinity;
    for (let a = 0; a < 6.28; a += 0.4) {
      const h = heightAt(l.x + Math.cos(a) * l.flat * 2.4, l.z + Math.sin(a) * l.flat * 2.4);
      lowest = Math.min(lowest, h); highest = Math.max(highest, h);
    }
    assert.ok(centre > lowest - 1.5 && centre < highest + 1.5, `${l.id}: centre ${centre.toFixed(1)}, surroundings ${lowest.toFixed(1)} to ${highest.toFixed(1)}`);
    assert.ok(Math.abs(heightAt(l.x + l.flat * 0.5, l.z) - centre) < 0.6, `${l.id} is level`);
  }
});

test('every module is in the import map, at one release, so caches never mix releases', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const root = new URL('..', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const files = (await readdir(new URL('src', root), { recursive: true })).filter((f) => f.endsWith('.js')).map((f) => f.split('\\').join('/'));
  const versions = new Set();
  for (const f of files) {
    const to = map['./src/' + f];
    assert.ok(to, `src/${f} is in the import map`);
    const [path, v] = to.split('?v=');
    assert.equal(path, './src/' + f);
    versions.add(v);
  }
  assert.equal(versions.size, 1, 'all at the same release');
  assert.ok(html.includes(`css/style.css?v=${[...versions][0]}`), 'and so is the stylesheet');
  assert.ok(html.includes(`import './src/main.js'`), 'the game is started through the map');
  const { VERSION } = await import('../src/config.js');
  assert.ok(html.includes(`<p class="version">v${VERSION}</p>`), `the title screen shows v${VERSION}`);
});

test('provinces: eight, every camp and place in one, each with a hold, following the land', async () => {
  const P = await import('../src/world/provinces.js');
  const { PLACES } = await import('../src/systems/provinces.js');
  assert.equal(P.PROVINCES.length, 8);
  const ids = new Set(P.PROVINCES.map((p) => p.id));
  for (const c of CAMPS) assert.ok(ids.has(P.CAMP_PROVINCE[c.id]), `camp ${c.id} lies in a province`);
  assert.equal(Object.values(P.PROVINCE_CAMPS).reduce((n, l) => n + l.length, 0), CAMPS.length);
  for (const p of P.PROVINCES) {
    assert.ok(P.PROVINCE_CAMPS[p.id].length >= 5, `${p.id} has camps to break`);
    assert.equal(P.CAMP_PROVINCE[P.HOLDS[p.id].id], p.id, `${p.id}'s hold lies in it`);
    assert.equal(P.provinceAt(p.label.x, p.label.z), p.id, `${p.id}'s name is written inside it`);
  }
  for (const p of PLACES) assert.ok(ids.has(p.province));
  const at = (id) => { const l = LANDMARKS.find((m) => m.id === id); return P.provinceAt(l.x, l.z); };
  assert.equal(P.provinceAt(HA.x, HA.z), 'henneth');
  assert.equal(at('cormallen'), 'henneth');
  assert.equal(at('cairandros'), 'henneth');
  assert.equal(at('fens'), 'forlad');
  assert.equal(at('pier'), 'bridgelands');
  for (const id of ['crossroads', 'osgiliath', 'morgul']) assert.equal(at(id), 'morgul');
  assert.equal(P.provinceAt(haradRoadX(750) + 100, 750), 'gorse');
  assert.equal(P.provinceAt(haradRoadX(2250) + 100, 2250), 'ash');
  // the south is held by stockades and war-camps; the north by lesser camps
  assert.equal(P.HOLDS.southwood.size, 4);
  assert.equal(P.HOLDS.morgul.size, 4);
  // borders are drawn, and the land either side of each differs
  const lines = P.provinceBorders();
  assert.ok(lines.length >= 7);
  for (const l of lines) for (const [x, z] of l.filter((_, i) => i % 10 === 0)) {
    const around = new Set([[0, -12], [0, 12], [-12, 0], [12, 0]].map(([dx, dz]) => P.provinceAt(x + dx, z + dz)));
    assert.ok(around.size > 1, `the border at ${x.toFixed(0)}, ${z.toFixed(0)} divides two provinces`);
  }
});

test('a province is freed by its hold and three in four of its camps', async () => {
  const { PROVINCE_CAMPS, HOLDS } = await import('../src/world/provinces.js');
  const { provinceStatus, freedProvinces, statusLine } = await import('../src/systems/provinces.js');
  const st = newState();
  let s = provinceStatus(st, 'henneth');
  assert.ok(!s.freed && !s.holdFound && s.cleared === 0 && s.need === Math.ceil(s.camps * 0.75));
  assert.match(statusLine(s), /not yet found/);
  const others = PROVINCE_CAMPS.henneth.filter((c) => c !== HOLDS.henneth);
  st.cleared.push(...others.slice(0, s.need).map((c) => c.id)); // enough camps, but the hold stands
  s = provinceStatus(st, 'henneth');
  assert.ok(s.cleared >= s.need && !s.freed);
  st.cleared.push(HOLDS.henneth.id);
  s = provinceStatus(st, 'henneth');
  assert.ok(s.freed && s.holdFound);
  assert.deepEqual(freedProvinces(st), ['henneth']);
  assert.match(statusLine(s), /^Free\./);
  const st2 = newState(); // the hold alone is not enough
  st2.cleared.push(HOLDS.forlad.id);
  assert.ok(!provinceStatus(st2, 'forlad').freed && provinceStatus(st2, 'forlad').holdCleared);
});

test('errands keep to the province the work is in', async () => {
  const q = await import('../src/systems/quests.js');
  const { PROVINCE_CAMPS, CAMP_PROVINCE, HOLDS } = await import('../src/world/provinces.js');
  const { workingProvince } = await import('../src/systems/provinces.js');
  const s = newState();
  s.quests.done.push('f1');
  busy(s);
  assert.equal(workingProvince(s), 'henneth', 'the work begins at home');
  const errandsAt = (st, giver) => [...Array(12).keys()].map((n) => { st.quests.count[giver] = n; return q.errandFrom(giver, st); });
  for (const e of errandsAt(s, 'faramir')) {
    assert.ok(!/Deep Woods|Home Woods|Northern Heath|Heather Slopes|Anduin Shore/.test(e.title + e.offer), `${e.title}: no terrain names`);
    const o = e.objective;
    if (o.type === 'clearCamp') assert.equal(CAMP_PROVINCE[o.camp], 'henneth', 'a scout\'s report is of a camp at home');
    if (o.type === 'clearSince') assert.ok(o.where.endsWith('henneth') || (e.errand === 'bounty' && o.where === 'any'), o.where);
    assert.notEqual(e.errand, 'region', 'no "break one camp here" beside the call to free the province');
    if (o.type === 'gather') assert.ok(!['captainToken', 'haradGold'].includes(o.item), `nothing only the south carries (${o.item})`);
  }
  for (const e of errandsAt(s, 'eowyn')) {
    if (e.objective.type === 'seek') assert.ok(e.objective.set.endsWith('henneth'), e.objective.set);
    if (e.objective.type === 'gather') assert.notEqual(e.objective.item, 'oliveStone', 'olives grow only in the south');
  }
  // free the home country and Forlad, and the work moves to the Gorse Fells, where captains are
  for (const pid of ['henneth', 'forlad']) s.cleared.push(...PROVINCE_CAMPS[pid].map((c) => c.id));
  assert.equal(workingProvince(s), 'gorse');
  s.quests.count.faramir = 4; // the captain's turn
  const cap = q.errandFrom('faramir', s);
  assert.equal(cap.errand, 'captain');
  assert.equal(cap.objective.where, 'stockade@gorse');
  const base = q.progress(cap.objective, s).have;
  s.cleared.push(PROVINCE_CAMPS.bridgelands.find((c) => c.size >= 3).id);
  assert.equal(q.progress(cap.objective, s).have, base, 'a stockade elsewhere does not count');
  s.cleared.push(HOLDS.gorse.id);
  assert.equal(q.progress(cap.objective, s).have, base + 1);
});

test('Faramir asks for the home country to be freed before he sends you further', async () => {
  const q = await import('../src/systems/quests.js');
  const { PROVINCE_CAMPS, HOLDS } = await import('../src/world/provinces.js');
  const s = newState();
  s.quests.done.push('f1', 'f2');
  assert.equal(q.offerFrom('faramir', s).id, 'f14');
  q.accept(s, 'f14');
  const def = q.byId.f14;
  assert.equal(q.progress(def.objective, s).have, 0);
  assert.equal(q.hintTarget(def.objective, s).id, HOLDS.henneth.id, 'asked, he points to their hold');
  const others = PROVINCE_CAMPS.henneth.filter((c) => c !== HOLDS.henneth);
  s.cleared.push(...others.map((c) => c.id));
  const p = q.progress(def.objective, s);
  assert.equal(p.have, p.need - 1, 'every camp but the hold leaves it one short');
  s.discovered.push('camp:' + HOLDS.henneth.id);
  assert.equal(q.targetOf(def.objective, s).id, HOLDS.henneth.id, 'the tracker points at the hold once it is found');
  s.cleared.push(HOLDS.henneth.id);
  assert.ok(q.isComplete(def, s));
  assert.ok(q.turnIn(s, 'f14'));
  assert.equal(q.offerFrom('faramir', s).id, 'f15', 'then Forlad, before the road and the stockades');
  assert.ok(q.byId.f3.requires.includes('f15'));
});

test('Faramir\'s story follows the provinces, with no standalone counts or stockades', async () => {
  const { QUESTS } = await import('../src/data/quests.js');
  const { CAMPAIGN } = await import('../src/world/provinces.js');
  const chain = QUESTS.filter((q) => q.giver === 'faramir');
  for (const gone of ['f4', 'f7', 'f10', 'f12', 'f13']) assert.ok(!chain.some((q) => q.id === gone), `${gone} is gone`);
  assert.ok(!chain.some((q) => q.objective.type === 'clearCount' && q.objective.count !== 'all' && q.objective.count > 5), 'no counts of fires but the first five and the last');
  assert.ok(!chain.some((q) => q.objective.type === 'clearWhere' && q.objective.where === 'stockade'), 'no stockade asked for on its own');
  const freed = chain.filter((q) => q.objective.type === 'freed').map((q) => q.objective.province);
  assert.deepEqual(freed, CAMPAIGN, 'every province is freed in his story, in the order of the campaign');
  for (const q of chain) for (const r of q.requires ?? []) assert.ok(chain.some((o) => o.id === r), `${q.id} needs ${r}, which exists`);
  // and every gear reward the removed tasks gave is still given somewhere
  const given = new Set(QUESTS.flatMap((q) => Object.keys(q.reward.items ?? {})));
  for (const id of ['falchion', 'whiteCompanyMail', 'greatBow', 'anorianSword', 'gondorHelm']) assert.ok(given.has(id), `${id} is still a reward`);
  // and a save holding a removed task drops it
  const { migrate, newState: fresh } = await import('../src/systems/save.js');
  const old = fresh(); old.quests.active = ['f4', 'f7', 'f3'];
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(old))).quests.active, ['f3']);
});

test('orcs carry orc bread, which mends less than waybread', async () => {
  const inv = await import('../src/systems/inventory.js');
  const { ITEMS } = await import('../src/data/items.js');
  assert.ok(ITEMS.orcBread.kind === 'heal' && ITEMS.orcBread.heal < ITEMS.waybread.heal);
  let n = 7, bread = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 400; i++) if (inv.enemyLoot('snaga', 1, rand).some(([id]) => id === 'orcBread')) bread++;
  assert.ok(bread > 50 && bread < 150, `about one orc in five carries some (${bread} of 400)`);
  const st = newState();
  st.health = 95; st.items = { orcBread: 1, draught: 1 };
  assert.equal(inv.quickHeal(st), 'orcBread', 'a scratch is mended with the lesser food');
  // Out of a fight the cheapest food goes first, one thing a touch, and the remedies are kept.
  st.health = 60; st.items = { orcBread: 3, waybread: 2, draught: 1, salve: 1 };
  assert.equal(inv.calmHeal(st), 'orcBread', 'out of a fight: the orc bread first');
  assert.ok(st.health === 70 && st.items.orcBread === 2 && st.items.waybread === 2, 'one at a time, not as many as the wound needs');
  inv.calmHeal(st); inv.calmHeal(st);
  assert.equal(inv.calmHeal(st), 'waybread', 'then waybread');
  assert.ok(st.items.draught === 1 && st.items.salve === 1, 'and the draught and salve are kept');
  st.health = 20; st.items = { draught: 1, salve: 1 };
  assert.equal(inv.calmHeal(st), 'draught', 'with no food, the remedies serve, the cheaper first');
  st.health = 100;
  assert.equal(inv.calmHeal(st), null, 'whole, nothing is eaten');
});

test('Éowyn\'s first map is of the Window Woods, and its village', async () => {
  const q = await import('../src/systems/quests.js');
  const home = q.PLACES.filter((p) => p.set === 'villages' && p.province === 'henneth');
  assert.equal(home.length, 1, 'Eryn Henneth has a village of its own');
  const s = newState();
  assert.equal(q.offerFrom('eowyn', s).id, 'e1');
  s.quests.active.push('e1');
  assert.equal(q.offerFrom('eowyn', s).id, 'm-henneth', 'then the map of the Window Woods');
  s.quests.active.push('m-henneth');
  const m = q.questOf(s, 'm-henneth');
  s.discovered.push(...q.PLACES.filter((p) => p.set === 'villages' && p.province !== 'henneth').map((p) => p.id));
  s.discovered.push(...q.PLACES.filter((p) => p.set === 'ruins' && p.province !== 'henneth').map((p) => p.id));
  assert.equal(q.progress(m.objective, s).have, 0, 'places elsewhere do not count');
  s.discovered.push(...q.PLACES.filter((p) => p.set === 'ruins' && p.province === 'henneth').slice(0, 4).map((p) => p.id));
  assert.ok(!q.isComplete(m, s), 'four old places, but not yet the village');
  const hint = q.hintTarget(m.objective, s);
  assert.equal(hint.x, home[0].x, 'and she points to the one at home');
  s.discovered.push(home[0].id);
  assert.ok(q.isComplete(m, s));
});

test('each province of the woods: freed, mapped, then its settlers led home; then they grow it', async () => {
  const q = await import('../src/systems/quests.js');
  const st = await import('../src/systems/settlement.js');
  const { PROVINCE_CAMPS, CAMPAIGN } = await import('../src/world/provinces.js');
  const { QUESTS } = await import('../src/data/quests.js');
  const { ITEMS } = await import('../src/data/items.js');
  // every settlement has its map task and its settling task, its two plots and a landing on dry ground
  assert.equal(st.SETTLEMENTS.length, 6, 'every province of the woods; the fells have no one to settle');
  for (const s of st.SETTLEMENTS) {
    const m = q.byId['m-' + s.province], set = q.byId['s-' + s.province];
    assert.ok(m && set && set.requires.includes(m.id) && set.whenFreed === s.province && set.objective.site === s.site, s.site);
    const ids = m.objective.of.find((o) => o.type === 'discover').ids;
    assert.deepEqual(ids, ['site:' + s.site], `${m.id} asks for the place its people will live`);
    const ruins = m.objective.of.find((o) => o.type === 'seek');
    assert.ok(ruins.count <= q.PLACES.filter((p) => p.province === s.province && p.set === 'ruins').length, `${m.id} asks for no more places than there are`);
    assert.equal(s.plots.length, 2, `${s.name} has two plots`);
    assert.ok(heightAt(s.landing.x, s.landing.z) > 0.5, `${s.name}'s settlers wait on dry ground`);
    for (const dx of [-1.4, 0, 1.4]) for (const dz of [-4, 0, 4]) assert.ok(heightAt(s.boat.x + dx, s.boat.z + dz) < -0.5, `${s.name}'s boat is afloat, not in the sand`);
    assert.ok(s.landing.x - s.boat.x < 25, `${s.name}'s people land beside their boat`);
    const site = SITES_ALL.find((x) => x.id === s.site);
    for (const i of s.houses) {
      const h = site.houses[i];
      for (const [a, b] of [[0, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]]) assert.ok(streamDistance(h.x + (a * h.w) / 2, h.z + (b * h.d) / 2) >= 3, `no house ${s.name} keeps stands in a stream`);
    }
    const level = s.houses.filter((i) => { const h = site.houses[i]; const c = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => heightAt(h.x + (a * h.w) / 2, h.z + (b * h.d) / 2)); return Math.max(...c) - Math.min(...c) < 0.5; });
    assert.ok(level.length >= s.houses.length * 0.6, `most of ${s.name}'s houses stand on level ground (${level.length} of ${s.houses.length})`);
    for (const c of s.crops) assert.equal(ITEMS[c].kind, 'seed');
    for (const r of s.plots) for (const c of CAMPS) assert.ok(c.x < r.minX - 15 || c.x > r.maxX + 15 || c.z < r.minZ - 15 || c.z > r.maxZ + 15, `no camp in ${s.name}'s fields`);
  }
  assert.deepEqual(st.SETTLEMENTS.map((s) => s.province), CAMPAIGN.filter((p) => st.settlementIn[p]), 'settled in the order they are freed');

  const s = newState(), home = st.settlementIn.henneth;
  s.quests.done.push('e1', 'm-henneth');
  assert.notEqual(q.offerFrom('eowyn', s)?.id, 's-henneth', 'no boat is sent for until the woods are free');
  s.cleared.push(...PROVINCE_CAMPS.henneth.map((c) => c.id));
  assert.equal(q.offerFrom('eowyn', s).id, 's-henneth', 'free and mapped: she sends for them');
  q.accept(s, 's-henneth');
  assert.deepEqual(q.tracker(s).target, home.landing, 'the tracker points to their boat');
  s.escort = { site: home.site, x: 300, z: 900, following: false };
  assert.deepEqual(q.tracker(s).target, { x: 300, z: 900 }, 'or to where they were left');
  s.escort.following = true;
  assert.deepEqual(q.tracker(s).target, { x: home.x, z: home.z }, 'and while they follow, to their village');
  assert.equal(st.stageOf(s, home.site), -1);
  assert.equal(q.errandFrom(home.site, s), null, 'nobody there to ask anything yet');
  s.settled.push(home.site); s.escort = null;
  assert.ok(q.turnIn(s, 's-henneth'));
  assert.equal(st.stageOf(s, home.site), 0);
  assert.equal(st.housesMended(s, home.site), 3);
  // their own tasks: seed, a remnant camp, seed, kingsfoil; each grows the place
  const kinds = [];
  for (let n = 0; n < st.STAGE_MAX; n++) {
    const e = q.errandFrom(home.site, s);
    assert.ok(e && e.giver === home.site && e.title && e.offer && e.remind && e.done, `task ${n} at ${home.name}`);
    kinds.push(e.errand);
    q.acceptErrand(s, e);
    assert.ok(q.trackers(s).some((t) => t.text.startsWith(e.title)));
    const o = e.objective;
    if (o.type === 'gather') s.items[o.item] = o.count;
    if (o.type === 'clearCamp') s.cleared.push(o.camp);
    if (o.type === 'discover') s.discovered.push(...o.ids);
    assert.ok(q.isComplete(e, s));
    assert.equal(q.trackers(s).find((t) => t.text.startsWith(e.title)).target.site, home.site, 'done, the way home is to the village');
    assert.ok(q.turnIn(s, e.id));
    assert.equal(st.stageOf(s, home.site), n + 1);
    if (n === 0) {
      assert.deepEqual(st.cropsSown(s, home.site), [home.crops[0]], 'the first field sown');
      assert.deepEqual(st.seedForSale(s, home.site), [home.crops[0]], 'and its seed on sale');
      assert.equal(st.sownPlots(s).length, 1);
    }
  }
  assert.deepEqual(kinds.filter((k) => k === 'seed').length, 2);
  assert.equal(q.errandFrom(home.site, s), null, 'grown, they ask no more');
  assert.equal(st.housesMended(s, home.site), home.houses.length, 'every house they keep is mended');
  assert.ok(home.houses.length < siteHouses(home.site), 'one Beechwell ruin stands over a stream, and is left a ruin');
  assert.deepEqual(st.cropsSown(s, home.site), home.crops);
  // and her last task asks for every settlement grown
  const garden = QUESTS.find((t) => t.id === 'e-garden');
  assert.deepEqual(q.progress(garden.objective, s), { have: 1, need: 6 });
});

test('a farmstead found for Éowyn takes a family once its province is free', async () => {
  const q = await import('../src/systems/quests.js');
  const st = await import('../src/systems/settlement.js');
  const { PROVINCE_CAMPS } = await import('../src/world/provinces.js');
  const { QUESTS } = await import('../src/data/quests.js');
  const s = newState();
  s.quests.active.push(...QUESTS.filter((t) => t.giver === 'eowyn').map((t) => t.id)); // (no told task to offer)
  const e = q.errandFrom('eowyn', s);
  assert.equal(e.errand, 'site');
  const farm = e.homestead;
  assert.ok(st.homesteadBySite[farm] && e.objective.ids[0] === 'site:' + farm);
  q.acceptErrand(s, e);
  s.discovered.push('site:' + farm);
  assert.ok(q.turnIn(s, e.id));
  assert.deepEqual(s.homesteads, [farm]);
  const pid = st.homesteadBySite[farm].province;
  assert.deepEqual(st.homesteadsLived(s), [], 'not until its province is free');
  s.cleared.push(...PROVINCE_CAMPS[pid].map((c) => c.id));
  assert.deepEqual(st.homesteadsLived(s), [farm]);
  if (st.homesteadBySite[farm].plot) assert.ok(st.sownPlots(s).some((p) => p.site === farm), 'with a field sown');
});

test('the Marshal holds the Morgul Marches', async () => {
  const { rosterFor, MARSHAL_CAMP, ENEMY_TYPES } = await import('../src/data/enemies.js');
  const { HOLDS } = await import('../src/world/provinces.js');
  const { HONOUR } = await import('../src/systems/renown.js');
  assert.equal(MARSHAL_CAMP, HOLDS.morgul.id);
  const camp = CAMPS.find((c) => c.id === MARSHAL_CAMP);
  assert.equal(rosterFor(camp).filter((t) => t === 'marshal').length, 1, 'he leads his hold himself');
  assert.ok(CAMPS.every((c) => c.id === MARSHAL_CAMP || !rosterFor(c, 50).includes('marshal')), 'and is nowhere else');
  assert.ok(ENEMY_TYPES.marshal.hp > ENEMY_TYPES.chief.hp * 2 && HONOUR.kill.marshal > HONOUR.kill.chief);
});

test('a roused camp never draws in its neighbour while both are at rest', async () => {
  const { CHASE, campReach } = await import('../src/data/enemies.js');
  let worst = Infinity;
  for (const a of CAMPS) for (const b of CAMPS) {
    if (a.id >= b.id) continue;
    const gap = Math.hypot(a.x - b.x, a.z - b.z) - campReach(a.size) - campReach(b.size);
    worst = Math.min(worst, gap);
  }
  assert.ok(worst > CHASE.rouse + 3, `the nearest two companies at rest stand ${worst.toFixed(1)} m apart (rousing reaches ${CHASE.rouse})`);
});

test('the lesser ruins stand on level ground, and the sunken court is sunken', async () => {
  const { RELICS, RELIC_FLAT, COURT } = await import('../src/world/relicSites.js');
  for (const r of RELICS) {
    const R = RELIC_FLAT[r.kind];
    if (!R) continue;
    // the ground under a ruin's whole footprint is level, so no end of it hangs in the air
    const y = heightAt(r.x + (r.kind === 'baths' ? 20 : 0), r.z), heights = [];
    for (let a = 0; a < 6.28; a += 0.5) heights.push(heightAt(r.x + Math.cos(a) * R * 0.85, r.z + Math.sin(a) * R * 0.85));
    if (r.kind !== 'baths') assert.ok(Math.max(...heights) - Math.min(...heights) < 0.5, `${r.id} (${r.kind}) is level: ${Math.min(...heights).toFixed(2)} to ${Math.max(...heights).toFixed(2)}`);
    // and the levelling stops short of every camp, which were placed on the land as it was
    for (const c of CAMPS) assert.ok(Math.hypot(c.x - r.x, c.z - r.z) > Math.min(22, R * 1.75) + 2, `${r.id}'s levelling reaches camp ${c.id}`);
    if (r.kind === 'baths') {
      const floor = heightAt(r.x, r.z), around = heightAt(r.x + COURT.hw + COURT.walk + 1, r.z);
      assert.ok(around - floor > COURT.depth - 0.3, `the court lies ${(around - floor).toFixed(2)} m down`);
      assert.ok(Math.abs(heightAt(r.x + COURT.hw - 0.5, r.z + COURT.hd - 0.5) - floor) < 0.05, 'its floor is flat');
    }
  }
});

test('settlers land in their own province, no other province\'s camp stands by a settlement, and mines face the road', async () => {
  const { SETTLEMENTS } = await import('../src/world/settlements.js');
  const { provinceAt, CAMP_PROVINCE } = await import('../src/world/provinces.js');
  const { haradRoadX } = await import('../src/world/layout.js');
  for (const s of SETTLEMENTS) {
    assert.equal(provinceAt(s.landing.x, s.landing.z), s.province, `${s.name}'s boat puts in on its own province's shore`);
    for (const c of CAMPS) {
      if (CAMP_PROVINCE[c.id] === s.province) continue; // (cleared before they come)
      assert.ok(Math.hypot(c.x - s.x, c.z - s.z) > 150, `${s.name} has no other province's camp (${c.id}) in sight`);
    }
  }
  for (const c of CAMPS.filter((q) => q.kind === 'mine')) {
    const off = c.x - haradRoadX(c.z);
    assert.ok(off >= 33.5, `mine ${c.id} stands back from the Harad Road (${off.toFixed(0)} m)`);
    if (off < 45) assert.equal(c.face, 0, `and one near it faces it (${c.id})`);
  }
});

test('a settled place keeps its yards bare and trodden; the old planted trees stand', async () => {
  const S = await import('../src/world/settlements.js');
  const st = await import('../src/systems/settlement.js');
  const home = S.SETTLEMENTS[0];
  const yards = S.yardsOf(home.site);
  assert.ok(yards.length >= home.houses.length + 1, 'a yard round every house it keeps, and its green');
  const s = newState();
  assert.equal(st.clearedGround(s).length, 0, 'nothing is cleared before anyone comes');
  s.settled.push(home.site);
  const ground = st.clearedGround(s);
  S.setClearedPlots(ground);
  const h = SITES_ALL.find((x) => x.id === home.site).houses[home.houses[0]];
  assert.ok(S.inPlot(h.x + h.w / 2 + 2, h.z), 'brush keeps off a doorway');
  assert.ok(!S.inPlot(h.x + h.w / 2 + 2, h.z, 0, false), 'but a yard is not a field: planted trees are left');
  assert.equal(S.trodden(h.x + h.w / 2 + 2, h.z), 1, 'and the ground is trodden earth');
  assert.equal(S.trodden(h.x + 200, h.z + 200), 0);
  S.setClearedPlots([]);
});

test('stakes knocked down stop no one', async () => {
  const { addCircle, removeCircles, resolveCircles } = await import('../src/world/collision.js');
  addCircle(5000, 5000, 0.42, 'stake', 'down:test');
  const p = { x: 5000.1, z: 5000 };
  resolveCircles(p, 0.4);
  assert.ok(p.x > 5000.5, 'a standing stake pushes the ranger off');
  removeCircles('down:test');
  const q = { x: 5000.1, z: 5000 };
  resolveCircles(q, 0.4);
  assert.equal(q.x, 5000.1, 'once knocked down it does not');
});

test('v0.8: breaking up a camp is saved apart from clearing it; a camp cleared before is broken up already', () => {
  assert.deepEqual(newState().broken, []);
  const v7 = migrate({ version: 7, cleared: ['c5', 'c12'] });
  assert.deepEqual(v7.broken, ['c5', 'c12'], 'before v0.8, clearing a camp broke it up at once');
  const v8 = migrate({ version: 8, cleared: ['c5', 'c12'], broken: ['c12', 'c40', 7] });
  assert.deepEqual(v8.broken, ['c12'], 'only a cleared camp can be broken up');
});

test('v0.8: scouts go round Henneth Annûn, and are set down out of sight on a way that passes near the ranger', async () => {
  const { scoutRoute, meetingPoint, alongRoute, routeLength, scoutRoster, SCOUT_BERTH } = await import('../src/data/enemies.js');
  // straight through the refuge, east to west: bent round it
  const r = scoutRoute({ x: HA.x - 400, z: HA.z + 5 }, { x: HA.x + 400, z: HA.z - 5 });
  assert.ok(r.length > 2, 'a way through Henneth Annûn bends');
  const L = routeLength(r);
  for (let s = 0; s <= L; s += 3) { const p = alongRoute(r, s); assert.ok(Math.hypot(p.x - HA.x, p.z - HA.z) > SCOUT_BERTH - 3, 'and keeps outside the berth'); }
  // every pair of camps that might be walked between keeps out of the refuge
  for (let i = 0; i < CAMPS.length; i += 3) for (let j = 1; j < CAMPS.length; j += 7) {
    const route = scoutRoute(CAMPS[i], CAMPS[j]), n = routeLength(route);
    for (let s = 0; s <= n; s += 10) { const p = alongRoute(route, s); assert.ok(Math.hypot(p.x - HA.x, p.z - HA.z) > REFUGE + 10, `${CAMPS[i].id} to ${CAMPS[j].id} keeps out of the refuge`); }
  }
  const straight = scoutRoute({ x: 300, z: 2000 }, { x: 900, z: 2000 });
  const at = meetingPoint(straight, 600, 2040);
  assert.ok(at && Math.hypot(at.x - 600, at.z - 2040) >= 160 && at.x < 600, 'set down out of sight, before the ranger');
  assert.equal(meetingPoint(straight, 600, 2200), null, 'not if the way never comes near');
  let rs = 1; const rand = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 200; k++) {
    const a = scoutRoster(3, rand), c = scoutRoster(3, rand, true);
    assert.ok(a.length >= 1 && a.length <= 3 && c.length >= 1 && c.length <= 2);
  }
});

test('v0.8: the Marshal stands head and shoulders over his captains; bands carry more; kingsfoil is twice as thick', async () => {
  const { ENEMY_TYPES } = await import('../src/data/enemies.js');
  assert.ok(ENEMY_TYPES.marshal.scale > ENEMY_TYPES.chief.scale * 1.35);
  const inv = await import('../src/systems/inventory.js');
  let rs = 7; const rand = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  let band = 0, host = 0;
  for (let k = 0; k < 100; k++) { band += inv.bandLoot(3, 2, false, rand)[0][1]; host += inv.bandLoot(11, 3, true, rand)[0][1]; }
  assert.ok(band / 100 > 8 && band / 100 < 20, `a band carries a little silver (${band / 100})`);
  assert.ok(host / 100 > 40 && host / 100 < 70, `a host more (${host / 100})`);
  const { herbSites } = await import('../src/world/herbSites.js');
  assert.ok(herbSites().filter((h) => h.kind === 'athelas').length > 350, 'kingsfoil grows thickly');
});

test('v0.8.1: the Marshal holds the war-camp by the Cross-roads; old saves credit the deeds to the hold', async () => {
  const { HOLDS } = await import('../src/world/provinces.js');
  const { MARSHAL_CAMP } = await import('../src/data/enemies.js');
  const { CROSSROADS } = await import('../src/world/layout.js');
  assert.equal(MARSHAL_CAMP, 'c9');
  assert.equal(HOLDS.morgul.size, 4);
  assert.ok(Math.hypot(HOLDS.morgul.x - CROSSROADS.x, HOLDS.morgul.z - CROSSROADS.z) < 200, 'within sight of the Cross-roads');
  assert.equal(CAMPS.find((c) => c.id === 'c63').size, 1, 'the old hold is a small camp');
  const old = migrate({ version: 8, cleared: ['c63', 'c5'], broken: ['c63'], discovered: ['camp:c63', 'camp:c9'], told: ['c9'] });
  assert.deepEqual(old.cleared, ['c9', 'c5'], 'a hold broken before is broken still');
  assert.deepEqual(old.broken, ['c9']);
  assert.deepEqual(old.discovered, ['henneth', 'camp:c9', 'camp:c63']);
  assert.deepEqual(old.told, ['c63']);
  const now = migrate({ version: 9, cleared: ['c63'] });
  assert.deepEqual(now.cleared, ['c63'], 'a save from 0.8.1 is left as it is');
});

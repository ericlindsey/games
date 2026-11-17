// What the ranger carries and wears, and the keeping of it. Pure functions over the saved state.

import { ITEMS, SHOP, SLOTS, REPAIR, HONE } from '../data/items.js';

export const BASE_HEALTH = 100;
export const MAX_DEFENCE = 0.5;

export function count(state, id) { return state.items[id] ?? 0; }

export function addItem(state, id, n = 1) {
  if (id === 'arrows') { state.arrows += n; return; }
  if (id === 'silver') { state.silver += n; return; }
  if (!ITEMS[id]) throw new Error('unknown item ' + id);
  state.items[id] = count(state, id) + n;
}

/** Remove n of an item; returns false (and changes nothing) if there are too few. */
export function removeItem(state, id, n = 1) {
  if (count(state, id) < n) return false;
  state.items[id] -= n;
  if (state.items[id] === 0) delete state.items[id];
  return true;
}

/** Wear or wield an item that is in the pack. The old one goes back in the pack. */
export function equip(state, id) {
  const it = ITEMS[id];
  if (!it?.slot || !removeItem(state, id)) return false;
  const old = state.equipped[it.slot];
  if (old) addItem(state, old);
  state.equipped[it.slot] = id;
  return true;
}

/** Take off a piece of armour (swords and bows cannot be left empty-handed). */
export function unequip(state, slot) {
  const id = state.equipped[slot];
  if (!id || slot === 'sword' || slot === 'bow') return false;
  addItem(state, id);
  state.equipped[slot] = null;
  return true;
}

// ---- wear, mending and honing ----

/** How sound a piece of gear is: 1 new, 0 worn out. Only swords and bows wear. */
export function condition(state, id) { return state.wear?.[id] ?? 1; }
/** How many times it has been honed (a sword) or restrung (a bow): 0 to 3. */
export function honed(state, id) { return state.honed?.[id] ?? 0; }
/** A worn blade or string does a little over half its work. */
export function wearFactor(c) { return 0.6 + 0.4 * c; }

/** Damage a weapon does as it is now. */
export function weaponDamage(state, id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return (it.damage + honed(state, id)) * wearFactor(condition(state, id));
}

export function stats(state) {
  const e = state.equipped;
  let defence = 0;
  for (const slot of ['body', 'helm', 'legs']) defence += ITEMS[e[slot]]?.defence ?? 0;
  return {
    sword: e.sword ? weaponDamage(state, e.sword) : 8,
    bow: e.bow ? weaponDamage(state, e.bow) : 0,
    defence: Math.min(MAX_DEFENCE, defence),
  };
}

// A sword loses its edge over about 300 strokes that land; a string wears over about 300 shots.
export const WEAR_PER_USE = 1 / 300;

/**
 * The weapon in a slot is used once. Returns 'dull' or 'worn' the moment it
 * crosses half or a fifth of its condition (so the ranger can be told), else null.
 */
export function wearOnce(state, slot) {
  const id = state.equipped[slot];
  if (!id) return null;
  state.wear ??= {};
  const before = condition(state, id), after = Math.max(0, before - WEAR_PER_USE);
  state.wear[id] = after;
  if (before > 0.2 && after <= 0.2) return 'worn';
  if (before > 0.5 && after <= 0.5) return 'dull';
  return null;
}

/** What Mablung asks to put a weapon right; 0 if it needs nothing. */
export function repairPrice(state, id) {
  const c = condition(state, id);
  return c > 0.98 ? 0 : 1 + Math.ceil(ITEMS[id].value * (1 - c) * 0.12);
}
export function repair(state, id) {
  const price = repairPrice(state, id);
  if (!price || state.silver < price) return false;
  state.silver -= price;
  state.wear[id] = 1;
  return true;
}

export function canLearnRepair(state) { return !state.skills?.repair && state.renown >= REPAIR.teachRenown; }
export function learnRepair(state) {
  if (!canLearnRepair(state) || state.silver < REPAIR.teachPrice) return false;
  state.silver -= REPAIR.teachPrice;
  state.skills ??= {};
  state.skills.repair = true;
  return true;
}

/** Use a whetstone or a bowstring on what is in hand. */
export function useKit(state, kit) {
  const it = ITEMS[kit], id = state.equipped[it?.mends];
  if (it?.kind !== 'kit' || !state.skills?.repair || !id || condition(state, id) > 0.98 || !removeItem(state, kit)) return false;
  state.wear[id] = 1;
  return true;
}

/** The next honing step for a weapon, or null if there is none. */
export function honeStep(state, id) { return HONE[honed(state, id)] ?? null; }
export function canHone(state, id) {
  const step = honeStep(state, id);
  return !!step && state.renown >= step.renown;
}
export function hone(state, id) {
  const step = honeStep(state, id);
  if (!step || state.renown < step.renown || state.silver < step.price) return false;
  state.silver -= step.price;
  state.honed ??= {};
  state.honed[id] = honed(state, id) + 1;
  return true;
}

// ---- eating and drinking ----

/** Eat or drink something. Returns the health restored, or 0 if it could not be used. */
export function useItem(state, id) {
  const it = ITEMS[id];
  if (it?.kind !== 'heal' || state.health >= BASE_HEALTH || !removeItem(state, id)) return 0;
  const before = state.health;
  state.health = Math.min(BASE_HEALTH, state.health + it.heal);
  return state.health - before;
}

/** The best healing item to reach for in a hurry: the smallest that is not wasted, else the largest. */
export function quickHeal(state) {
  const missing = BASE_HEALTH - state.health;
  if (missing <= 0) return null;
  const have = Object.keys(state.items).filter((id) => ITEMS[id].kind === 'heal').sort((a, b) => ITEMS[a].heal - ITEMS[b].heal);
  if (!have.length) return null;
  return have.find((id) => ITEMS[id].heal >= missing) ?? have[have.length - 1];
}

// ---- trade ----

export function sellPrice(id) {
  const it = ITEMS[id];
  return ['goods', 'trophy', 'seed', 'herb'].includes(it.kind) ? it.value : Math.max(1, Math.floor(it.value / 2));
}
export function buyPrice(entry) { return entry.price ?? ITEMS[entry.item].value; }

/** True if the ranger already has this piece of gear, worn or in the pack. */
export function owns(state, id) {
  return Object.values(state.equipped).includes(id) || count(state, id) > 0;
}

/** What Mablung will sell at the ranger's present renown. Kits only once he has taught their use. */
export function shopFor(state) {
  const list = SHOP.filter((e) => e.renown <= state.renown);
  if (state.skills?.repair) list.splice(3, 0, { item: 'whetstone', renown: 0 }, { item: 'bowstring', renown: 0 });
  return list;
}

export function buy(state, entry) {
  const price = buyPrice(entry);
  if (state.silver < price || entry.renown > state.renown) return false;
  if (ITEMS[entry.item]?.slot && owns(state, entry.item)) return false; // one of each is enough
  state.silver -= price;
  addItem(state, entry.item, entry.count ?? 1);
  return true;
}

export function sell(state, id) {
  if (!removeItem(state, id)) return false;
  state.silver += sellPrice(id);
  return true;
}

/** A line of text listing loot, e.g. "12 silver, 5 arrows, Orc scimitar". */
export function describeLoot(loot) {
  return loot.map(([id, n]) => (id === 'silver' ? `${n} silver` : id === 'arrows' ? `${n} arrows` : n > 1 ? `${ITEMS[id].name} ×${n}` : ITEMS[id].name)).join(', ');
}

// ---- loot ----

// Gear the enemy may drop, and how often: rare, so a find is worth something.
const GEAR_DROPS = {
  snaga: [['orcCleaver', 0.015], ['orcScimitar', 0.015], ['orcHelm', 0.012]],
  archer: [['orcBow', 0.035]],
  uruk: [['urukBlade', 0.025], ['orcHauberk', 0.02], ['orcGreaves', 0.02], ['orcHelm', 0.02]],
  haradrim: [['southronScimitar', 0.03], ['southronBow', 0.025], ['scaleCoat', 0.02], ['southronHelm', 0.02]],
  chief: [['captainsBlade', 0.07], ['blackBow', 0.05]],
};

/**
 * Loot from a fallen enemy: a list of [id, count]. `rand` gives floats in [0, 1).
 * Kept lean on purpose. `onRoad` is true for a band met on the road: only
 * their archers still carry the blackened arrowheads.
 */
export function enemyLoot(type, tier, rand, onRoad = false) {
  const loot = [];
  if (rand() < 0.4) loot.push(['silver', 1 + Math.floor(rand() * (1 + tier * 1.5))]);
  if (type === 'archer' ? rand() < 0.6 : rand() < 0.12) loot.push(['arrows', 1 + Math.floor(rand() * (type === 'archer' ? 3 : 2))]);
  if (rand() < 0.25) loot.push([type === 'haradrim' ? (rand() < 0.4 ? 'haradGold' : 'blackCoin') : rand() < 0.75 ? 'orcTrinket' : 'blackCoin', 1]);
  // trophies for Faramir's count
  if ((type === 'snaga' || type === 'uruk') && rand() < 0.18) loot.push(['orcBlade', 1]);
  if (type === 'uruk' && rand() < 0.35) loot.push(['redEye', 1]);
  if (type === 'archer' && onRoad && rand() < 0.75) loot.push(['arrowheads', 1 + Math.floor(rand() * 2)]);
  if (rand() < 0.04) loot.push(['waybread', 1]);
  for (const [id, p] of GEAR_DROPS[type] ?? []) if (rand() < p) { loot.push([id, 1]); break; }
  if (type === 'chief') {
    loot.push(['silver', 10 + Math.floor(rand() * 12)], ['captainToken', 1]);
    if (rand() < 0.5) loot.push(['redEye', 1]);
    if (rand() < 0.5) loot.push(['draught', 1]);
  }
  return loot;
}

/** What is worth taking from a camp once it is broken up. */
export function stashLoot(camp, rand) {
  const loot = [['silver', 2 + camp.size * 3 + Math.floor(rand() * (2 + camp.tier * 2))]];
  if (rand() < 0.45) loot.push(['arrows', 2 + Math.floor(rand() * 5)]);
  if (rand() < 0.2 + camp.size * 0.12) loot.push([rand() < 0.6 ? 'waybread' : 'draught', 1]);
  if (rand() < 0.4) loot.push([rand() < 0.7 ? 'orcTrinket' : 'blackCoin', 1 + Math.floor(rand() * camp.size)]);
  if (camp.size >= 3 && rand() < 0.5) loot.push(['haradGold', 1]);
  if (camp.size === 4) loot.push([['ironGreaves', 'yewBow', 'dolAmrothSword'][Math.floor(rand() * 3)], 1]);
  return loot;
}

export { SLOTS };

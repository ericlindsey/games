// What the ranger carries and wears. Pure functions over the saved state.

import { ITEMS, SHOP } from '../data/items.js';

export const BASE_HEALTH = 100;

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

export function stats(state) {
  const e = state.equipped;
  return {
    sword: ITEMS[e.sword]?.damage ?? 8,
    bow: ITEMS[e.bow]?.damage ?? 0,
    defence: ITEMS[e.armour]?.defence ?? 0,
  };
}

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

export function sellPrice(id) {
  const it = ITEMS[id];
  return it.kind === 'goods' ? it.value : Math.max(1, Math.floor(it.value / 2));
}
export function buyPrice(entry) { return entry.price ?? ITEMS[entry.item].value; }

/** True if the ranger already has this piece of gear, worn or in the pack. */
export function owns(state, id) {
  return Object.values(state.equipped).includes(id) || count(state, id) > 0;
}

/** What Mablung will sell at the ranger's present renown. */
export function shopFor(state) { return SHOP.filter((e) => e.renown <= state.renown); }

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

/** Loot from a fallen enemy: a list of [id, count]. `rand` gives floats in [0, 1). Kept lean on purpose. */
export function enemyLoot(type, tier, rand) {
  const loot = [];
  if (rand() < 0.4) loot.push(['silver', 1 + Math.floor(rand() * (1 + tier * 1.5))]);
  if (type === 'archer' ? rand() < 0.6 : rand() < 0.12) loot.push(['arrows', 1 + Math.floor(rand() * (type === 'archer' ? 3 : 2))]);
  if (rand() < 0.25) loot.push([type === 'haradrim' ? (rand() < 0.4 ? 'haradGold' : 'blackCoin') : rand() < 0.75 ? 'orcTrinket' : 'blackCoin', 1]);
  if (rand() < 0.04) loot.push(['waybread', 1]);
  const gear = { snaga: ['orcScimitar', 0.03], archer: ['orcBow', 0.05], uruk: ['orcScimitar', 0.08], haradrim: ['haradBlade', 0.05], chief: ['haradBlade', 0.2] }[type];
  if (gear && rand() < gear[1]) loot.push([gear[0], 1]);
  if (type === 'chief') {
    loot.push(['silver', 10 + Math.floor(rand() * 12)]);
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
  if (camp.size === 4) loot.push([['brigandine', 'lebenninBow', 'dunedainSword'][Math.floor(rand() * 3)], 1]);
  return loot;
}

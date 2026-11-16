// Reads the tasks in data/quests.js against the saved state. Pure.

import { QUESTS } from '../data/quests.js';
import { CAMPS } from '../world/campSites.js';
import { HA, LANDMARKS, haradRoadX } from '../world/layout.js';
import { RELICS } from '../world/relicSites.js';
import { SITES } from '../world/oldworks.js';
import { addItem, removeItem, count } from './inventory.js';

export const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** The camp nearest to Henneth Annûn: the first one a new ranger is sent against. */
export const NEAREST_CAMP = CAMPS.reduce((a, b) => (Math.hypot(a.x - HA.x, a.z - HA.z) < Math.hypot(b.x - HA.x, b.z - HA.z) ? a : b));

const RUIN_IDS = new Set([
  ...LANDMARKS.filter((l) => l.kind && !['crossroads', 'osgiliath', 'morgul'].includes(l.kind)).map((l) => l.id),
  ...RELICS.map((r) => r.id),
]);
const VILLAGE_IDS = new Set(SITES.filter((s) => s.kind === 'hamlet').map((s) => 'site:' + s.id));
const campById = Object.fromEntries(CAMPS.map((c) => [c.id, c]));
const WHERE = {
  stockade: (c) => c.size === 3,
  heather: (c) => c.x > haradRoadX(c.z) + 10,
};
const campOf = (o) => (o.camp === 'nearest' ? NEAREST_CAMP : campById[o.camp]);

/** { have, need } for an objective. Done when have >= need. */
export function progress(o, state) {
  switch (o.type) {
    case 'clearCamp': return { have: state.cleared.includes(campOf(o).id) ? 1 : 0, need: 1 };
    case 'clearCount': return { have: state.cleared.length, need: o.count === 'all' ? CAMPS.length : o.count };
    case 'clearWhere': return { have: state.cleared.filter((id) => campById[id] && WHERE[o.where](campById[id])).length, need: o.count };
    case 'discover': return { have: o.ids.filter((id) => state.discovered.includes(id)).length, need: o.ids.length };
    case 'discoverCount': {
      const set = o.set === 'ruins' ? RUIN_IDS : VILLAGE_IDS;
      return { have: state.discovered.filter((id) => set.has(id)).length, need: o.count };
    }
    case 'gather': return { have: count(state, o.item), need: o.count };
    case 'all': {
      const parts = o.of.map((p) => progress(p, state));
      return { have: parts.filter((p) => p.have >= p.need).length, need: parts.length };
    }
    default: throw new Error('unknown objective ' + o.type);
  }
}

export function isComplete(q, state) {
  const p = progress(q.objective, state);
  return p.have >= p.need;
}

/** Where to go for this objective, if it has a place: { x, z } or null. */
export function targetOf(o, state) {
  if (o.type === 'clearCamp') return state.cleared.includes(campOf(o).id) ? null : campOf(o);
  if (o.type === 'discover') {
    const id = o.ids.find((i) => !state.discovered.includes(i));
    return LANDMARKS.find((l) => l.id === id) ?? null;
  }
  if (o.type === 'all') {
    for (const p of o.of) { const t = targetOf(p, state); if (t) return t; }
  }
  return null;
}

/** The next task this giver has to offer, or null. */
export function offerFrom(giver, state) {
  return QUESTS.find((q) => q.giver === giver && !state.quests.done.includes(q.id) && !state.quests.active.includes(q.id) &&
    (q.requires ?? []).every((r) => state.quests.done.includes(r))) ?? null;
}
/** This giver's tasks that the ranger has taken and not yet handed in. */
export function activeFrom(giver, state) {
  return state.quests.active.map((id) => byId[id]).filter((q) => q.giver === giver);
}

export function accept(state, id) {
  if (!state.quests.active.includes(id) && !state.quests.done.includes(id)) state.quests.active.push(id);
}

/** Hand a finished task in. Returns the reward as loot pairs, or null if it is not finished. */
export function turnIn(state, id) {
  const q = byId[id];
  if (!state.quests.active.includes(id) || !isComplete(q, state)) return null;
  if (q.objective.type === 'gather') removeItem(state, q.objective.item, q.objective.count);
  state.quests.active = state.quests.active.filter((a) => a !== id);
  state.quests.done.push(id);
  const r = q.reward, loot = [];
  if (r.silver) loot.push(['silver', r.silver]);
  if (r.arrows) loot.push(['arrows', r.arrows]);
  for (const [item, n] of Object.entries(r.items ?? {})) loot.push([item, n]);
  for (const [item, n] of loot) addItem(state, item, n);
  state.renown += r.renown ?? 0;
  return loot;
}

/** One line for the HUD: the first active task and how far along it is. */
export function tracker(state) {
  const q = byId[state.quests.active[0]];
  if (!q) return null;
  const p = progress(q.objective, state);
  const done = p.have >= p.need;
  return {
    text: done ? `${q.title}: done. Return to ${q.giver === 'faramir' ? 'Faramir' : 'Éowyn'}.` : `${q.title}${p.need > 1 ? ` (${Math.min(p.have, p.need)}/${p.need})` : ''}`,
    target: done ? { x: HA.x - 29, z: HA.z + 26 } : targetOf(q.objective, state),
    done,
  };
}

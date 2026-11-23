// How each province stands, read from the saved state. Pure.
//
// A province is freed when its hold is broken and three in four of its camps
// with it (the rest are remnants). Nothing is counted or stored here: like the
// tasks, it is all worked out again from `state.cleared` and `state.discovered`.
//
// The old places (ruins, villages, farms) are listed here too, by province, so
// that the tasks (systems/quests.js) can ask after them without a cycle.

import { LANDMARKS } from '../world/layout.js';
import { RELICS } from '../world/relicSites.js';
import { SITES } from '../world/oldworks.js';
import { PROVINCES, PROVINCE_CAMPS, HOLDS, CAMPAIGN, provinceAt } from '../world/provinces.js';

/** The share of a province's camps that must be broken, with its hold, to free it. */
export const FREE_SHARE = 0.75;

const NOT_RUINS = ['crossroads', 'osgiliath', 'morgul'];
/** Every old place: { id, x, z, kind, set, province } where set is 'ruins' | 'villages' | 'farms'. */
export const PLACES = [
  ...LANDMARKS.filter((l) => l.kind && !NOT_RUINS.includes(l.kind)).map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, set: 'ruins' })),
  ...RELICS.map((r) => ({ id: r.id, x: r.x, z: r.z, kind: r.kind, set: 'ruins' })),
  ...SITES.map((s) => ({ id: 'site:' + s.id, x: s.x, z: s.z, kind: s.kind, set: s.kind === 'hamlet' ? 'villages' : 'farms' })),
].map((p) => ({ ...p, province: provinceAt(p.x, p.z) }));

/**
 * Where a province stands:
 * { camps, cleared, need, hold, holdFound, holdKnown, holdCleared, freed, places, found }
 * (`holdKnown`: found, or marked on the ranger's map from a scout's map or Faramir's, since v0.8)
 * `need` is how many camps in all (the hold among them) free it.
 */
export function provinceStatus(state, id) {
  const list = PROVINCE_CAMPS[id], hold = HOLDS[id];
  const cleared = list.filter((c) => state.cleared.includes(c.id)).length;
  const need = Math.ceil(list.length * FREE_SHARE);
  const holdCleared = state.cleared.includes(hold.id);
  const places = PLACES.filter((p) => p.province === id);
  return {
    camps: list.length, cleared, need, hold,
    holdFound: holdCleared || state.discovered.includes('camp:' + hold.id),
    holdKnown: holdCleared || state.discovered.includes('camp:' + hold.id) || (state.told ?? []).includes(hold.id),
    holdCleared,
    freed: holdCleared && cleared >= need,
    places: places.length,
    found: places.filter((p) => state.discovered.includes(p.id)).length,
  };
}

/** Ids of the provinces now free. */
export function freedProvinces(state) {
  return PROVINCES.filter((p) => provinceStatus(state, p.id).freed).map((p) => p.id);
}

/** The province the work is in now: the first in Faramir's order not yet free (the last, once all are). */
export function workingProvince(state) {
  return CAMPAIGN.find((id) => !provinceStatus(state, id).freed) ?? CAMPAIGN.at(-1);
}

/**
 * Progress toward freeing a province as { have, need }: camps broken count up
 * to one short of what is needed, and the hold is the last of them.
 */
export function freeProgress(s) {
  if (s.freed) return { have: s.need, need: s.need };
  const others = s.cleared - (s.holdCleared ? 1 : 0);
  return { have: Math.min(others, s.need - 1) + (s.holdCleared ? 1 : 0), need: s.need };
}

/** A line saying how a province stands, for the pack and for notices. */
export function statusLine(s) {
  if (s.freed) return `Free. ${s.cleared} of ${s.camps} camps broken.`;
  const left = Math.max(0, s.need - s.cleared);
  const hold = s.holdCleared ? 'The hold is broken.' : s.holdFound ? 'The hold stands.' : s.holdKnown ? 'The hold is marked on your map, not yet found.' : 'The hold is not yet found.';
  return `${s.cleared} of ${s.camps} camps broken` + (left ? `; ${left} more to free it. ` : '. ') + hold;
}

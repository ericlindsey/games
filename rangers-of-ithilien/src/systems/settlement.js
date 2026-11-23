// How far each settlement has come, read from the saved state. Pure.
//
// A settlement's people arrive when the ranger has led them in from their boat
// (`state.settled`, the one fact here that is stored: it happened once, on the
// way). After that it grows a stage for every task its people have had done
// (`state.quests.count[site]`, kept by the errand code in systems/quests.js):
//
//   0  arrived: the first houses roofed, smoke, the well in use, people on the green
//   1  the first field cleared and sown (their first crop); they sell its seed
//   2  more houses mended
//   3  the second field sown (their second crop); they sell that seed too
//   4  every house mended, the market cross set up again, a garden
//
// A homestead (a farmstead Éowyn was shown, `state.homesteads`) is lived in
// once its province is free: its house roofed and one field sown.

import { SETTLEMENTS, settlementBySite, settlementIn, HOMESTEADS, homesteadBySite, yardsOf } from '../world/settlements.js';
import { provinceStatus } from './provinces.js';

export { SETTLEMENTS, settlementBySite, settlementIn, HOMESTEADS, homesteadBySite };
/** The last stage: a settlement whose people have nothing more to ask. */
export const STAGE_MAX = 4;

/** True once the settlers of this site are home. */
export const arrived = (state, site) => state.settled.includes(site);

/** The stage a settlement has reached: -1 before its people arrive, then 0 to STAGE_MAX. */
export function stageOf(state, site) {
  if (!arrived(state, site)) return -1;
  return Math.min(STAGE_MAX, state.quests.count[site] ?? 0);
}

/** The crops sown at a settlement now, in the order they were sown. */
export function cropsSown(state, site) {
  const s = settlementBySite[site], st = stageOf(state, site);
  return !s ? [] : s.crops.filter((_, i) => st >= (i === 0 ? 1 : 3));
}

/** Seed its people will sell: what they have sown. */
export const seedForSale = cropsSown;

/** How many of a settlement's houses are mended at its stage. */
export function housesMended(state, site) {
  const s = settlementBySite[site], st = stageOf(state, site);
  if (!s || st < 0) return 0;
  const n = s.houses.length;
  if (s.kind === 'farm') return st >= 2 ? n : 1;
  return st >= 4 ? n : st >= 2 ? Math.min(n, 6) : Math.min(n, 3);
}

/** Homesteads lived in now: those Éowyn was shown, in a free province. */
export function homesteadsLived(state) {
  return (state.homesteads ?? []).filter((id) => homesteadBySite[id] && provinceStatus(state, homesteadBySite[id].province).freed);
}

/** Every plot cleared and sown now: [{ rect, crop, site }]. */
export function sownPlots(state) {
  const out = [];
  for (const s of SETTLEMENTS) cropsSown(state, s.site).forEach((crop, i) => { if (s.plots[i]) out.push({ rect: s.plots[i], crop, site: s.site }); });
  for (const id of homesteadsLived(state)) { const h = homesteadBySite[id]; if (h.plot) out.push({ rect: h.plot, crop: h.crop, site: id }); }
  return out;
}

/**
 * Where a province stands for Éowyn, in a few words (for her "How goes the
 * settling?"): which step is next, freeing, mapping, the boat, or the settlers' own work.
 */
export function settlingLine(state, s, mapDone) {
  const free = provinceStatus(state, s.province).freed, st = stageOf(state, s.site);
  if (st >= STAGE_MAX) return `${s.name} stands whole, and its fields are sown.`;
  if (st >= 0) return `${s.name} is lived in again. ${s.reeve.name} has work for you there${st > 0 ? `; they have sown ${st >= 3 ? 'both their fields' : 'their first field'}` : ''}.`;
  if (free && mapDone) return 'Free, and mapped. The settlers wait at the river for someone to bring them in.';
  if (free) return 'Free. My map of it is not done: the old places, and where they will live.';
  if (mapDone) return 'Mapped, but not yet free. Faramir’s work comes first.';
  return 'Not yet free, and not yet mapped.';
}

/** All the ground the settlers keep clear now: their sown fields, and the yards of every place lived in (since v0.7.7). */
export function clearedGround(state) {
  const out = sownPlots(state).map((p) => p.rect);
  for (const s of SETTLEMENTS) if (arrived(state, s.site)) out.push(...yardsOf(s.site));
  for (const id of homesteadsLived(state)) out.push(...yardsOf(id));
  return out;
}

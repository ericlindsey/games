// Reads the tasks in data/quests.js against the saved state, builds the
// errands, and finds the hints Faramir and Éowyn give when asked. Pure.
//
// The told tasks (QUESTS) are known by id. An errand is built when it is
// offered and kept whole in `state.quests.errands` once taken, with any
// starting counts (`base`) it needs, so its progress can still be read from
// the saved state alone.

import { QUESTS, ERRANDS, TROPHY_HINTS, SEED_HINTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { CAMPS } from '../world/campSites.js';
import { HA, LANDMARKS, haradRoadX } from '../world/layout.js';
import { RELIC_KINDS } from '../world/relicSites.js';
import { regionName } from '../world/regions.js';
import { PLACES, provinceStatus, workingProvince, freeProgress } from './provinces.js';
import { CAMP_PROVINCE, PROVINCES, provinceById } from '../world/provinces.js';
import { herbSites } from '../world/herbSites.js';
import { addItem, removeItem, count, owns } from './inventory.js';
import { addHonour } from './renown.js';
import { SETTLEMENTS, settlementBySite, stageOf, arrived, STAGE_MAX, homesteadBySite } from './settlement.js';

export const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** The camp nearest to Henneth Annûn: the first one a new ranger is sent against. */
export const NEAREST_CAMP = CAMPS.reduce((a, b) => (Math.hypot(a.x - HA.x, a.z - HA.z) < Math.hypot(b.x - HA.x, b.z - HA.z) ? a : b));
/** Where a ranger goes to hand a task in: the hidden stair into the rock. */
export const HOME_DOOR = { x: HA.hatch.exitX + 2, z: (HA.hatch.z0 + HA.hatch.z1) / 2 };

/** Who gives a task, by name: Faramir, Éowyn, or the one who speaks for a settlement. */
export function giverName(giver) {
  if (giver === 'faramir') return 'Faramir';
  if (giver === 'eowyn') return 'Éowyn';
  return settlementBySite[giver]?.reeve.name ?? giver;
}

// ---- places and camps, sorted into the sets the tasks speak of ----

/** Every old place (listed in systems/provinces.js, with the province each lies in). */
export { PLACES };
const RUIN_IDS = new Set(PLACES.filter((p) => p.set === 'ruins').map((p) => p.id));
const VILLAGE_IDS = new Set(PLACES.filter((p) => p.set === 'villages').map((p) => p.id));
// 'region:<name>' (terrain regions) is only read for errands taken before provinces; new work speaks of provinces.
const regionCache = new Map();
const regionOf = (p) => { if (!regionCache.has(p)) regionCache.set(p, regionName(p.x, p.z)); return regionCache.get(p); };
/** A `where` or `set` may end '@<province>', to count only what lies in it. */
const within = (spec) => { const i = spec.indexOf('@'); return i < 0 ? [spec, null] : [spec.slice(0, i), spec.slice(i + 1)]; };

const campById = Object.fromEntries(CAMPS.map((c) => [c.id, c]));
/** Which camps a `where` names. */
function campMatches(spec, c) {
  const [where, pid] = within(spec);
  if (pid && CAMP_PROVINCE[c.id] !== pid) return false;
  if (where === 'any') return true;
  if (where.startsWith('province:')) return CAMP_PROVINCE[c.id] === where.slice(9);
  if (where === 'stockade') return c.size >= 3;
  if (where === 'warcamp') return c.size === 4;
  if (where === 'heather') return c.x > haradRoadX(c.z) + 10;
  if (where.startsWith('region:')) return regionOf(c) === where.slice(7);
  return false;
}
/** Which places a `set` names. */
function placeMatches(spec, p) {
  const [set, pid] = within(spec);
  if (pid && p.province !== pid) return false;
  if (set.startsWith('province:')) return p.province === set.slice(9);
  if (set === 'ruins' || set === 'villages' || set === 'farms') return p.set === set;
  if (set === 'places') return true;
  if (set.startsWith('kind:')) return p.set === 'ruins' && p.kind === set.slice(5);
  if (set.startsWith('region:')) return regionOf(p) === set.slice(7);
  return false;
}
const campOf = (o) => (o.camp === 'nearest' ? NEAREST_CAMP : campById[o.camp]);
const clearedWhere = (state, where) => state.cleared.filter((id) => campById[id] && campMatches(where, campById[id])).length;
const foundIn = (state, set) => PLACES.filter((p) => placeMatches(set, p) && state.discovered.includes(p.id)).length;

let plants = null; // built on first use: it walks the whole map
const allPlants = () => (plants ??= herbSites());
let kindById = null;
/** The kind of plant a gathered plant's id was. */
export const plantKind = (id) => (kindById ??= new Map(allPlants().map((s) => [s.id, s.kind]))).get(id) ?? 'athelas';
/** Plants of a kind still standing (not yet gathered). */
export const standingPlants = (state, kind) => allPlants().filter((s) => s.kind === kind && !state.picked.includes(s.id));

// ---- progress ----

/** { have, need } for an objective. Done when have >= need. */
export function progress(o, state) {
  switch (o.type) {
    case 'clearCamp': return { have: state.cleared.includes(campOf(o).id) ? 1 : 0, need: 1 };
    case 'clearCount': return { have: state.cleared.length, need: o.count === 'all' ? CAMPS.length : o.count };
    case 'clearWhere': return { have: clearedWhere(state, o.where), need: o.count === 'all' ? CAMPS.filter((c) => campMatches(o.where, c)).length : o.count };
    case 'clearSince': return { have: clearedWhere(state, o.where) - o.base, need: o.count };
    case 'bands': return { have: (state.stats.bands ?? 0) - o.base, need: o.count };
    case 'discover': return { have: o.ids.filter((id) => state.discovered.includes(id)).length, need: o.ids.length };
    case 'discoverCount': {
      const set = o.set === 'ruins' ? RUIN_IDS : VILLAGE_IDS;
      return { have: state.discovered.filter((id) => set.has(id)).length, need: o.count === 'all' ? set.size : o.count };
    }
    case 'seek': return { have: foundIn(state, o.set) - o.base, need: o.count };
    case 'gather': return { have: count(state, o.item), need: o.count };
    case 'gatherAll': return { have: o.items.reduce((n, id) => n + Math.min(o.count, count(state, id)), 0), need: o.items.length * o.count };
    case 'freed': return freeProgress(provinceStatus(state, o.province));
    case 'holdFound': return { have: provinceStatus(state, o.province).holdFound ? 1 : 0, need: 1 };
    case 'settled': return { have: arrived(state, o.site) ? 1 : 0, need: 1 };
    case 'grown': {
      const sites = o.sites === 'all' ? SETTLEMENTS.map((s) => s.site) : o.sites;
      return { have: sites.filter((id) => stageOf(state, id) >= STAGE_MAX).length, need: sites.length };
    }
    case 'all': { // (each part counted in full: "4 old places and the village" is 5 things, not 2)
      const parts = o.of.map((p) => progress(p, state));
      return { have: parts.reduce((n, p) => n + Math.max(0, Math.min(p.have, p.need)), 0), need: parts.reduce((n, p) => n + p.need, 0) };
    }
    default: throw new Error('unknown objective ' + o.type);
  }
}

/** A told task or a taken errand, by id. */
export function questOf(state, id) {
  return byId[id] ?? state.quests.errands.find((e) => e.id === id) ?? null;
}

export function isComplete(q, state) {
  const p = progress(q.objective, state);
  return p.have >= p.need;
}

/** Where to go for this objective, if it has a place of its own: { x, z } or null. */
export function targetOf(o, state) {
  if (o.type === 'clearCamp') return state.cleared.includes(campOf(o).id) ? null : campOf(o);
  if (o.type === 'discover') {
    const id = o.ids.find((i) => !state.discovered.includes(i));
    return placeById(id);
  }
  if (o.type === 'settled') return arrived(state, o.site) ? null : escortTarget(state, o.site);
  if (o.type === 'freed') { // the hold, once it has been found
    const s = provinceStatus(state, o.province);
    return s.holdFound && !s.holdCleared ? s.hold : null;
  }
  if (o.type === 'all') {
    for (const p of o.of) { if (isDone(p, state)) continue; const t = targetOf(p, state); if (t) return t; }
  }
  return null;
}
const isDone = (o, state) => { const p = progress(o, state); return p.have >= p.need; };
/** A landmark, ruin, village or farm by the id it is discovered by. */
const placeById = (id) => (id ? LANDMARKS.find((l) => l.id === id) ?? PLACES.find((p) => p.id === id) ?? null : null);
/**
 * Where to go to bring a settlement's people home: to their boat, or to where
 * they wait if the ranger left them on the way, or, while they follow, home.
 */
export function escortTarget(state, site) {
  const s = settlementBySite[site], e = state.escort;
  if (e && e.site === site) return e.following ? { x: s.x, z: s.z } : { x: e.x, z: e.z };
  return s.landing;
}

// ---- offering, taking and handing in ----

/** The next told task this giver has to offer, or null. */
export function offerFrom(giver, state) {
  return QUESTS.find((q) => q.giver === giver && !state.quests.done.includes(q.id) && !state.quests.active.includes(q.id) &&
    (q.requires ?? []).every((r) => state.quests.done.includes(r)) &&
    (!q.whenFreed || provinceStatus(state, q.whenFreed).freed)) ?? null;
}
/** This giver's tasks that the ranger has taken and not yet handed in. */
export function activeFrom(giver, state) {
  return state.quests.active.map((id) => questOf(state, id)).filter((q) => q && q.giver === giver);
}

export function accept(state, id) {
  if (!state.quests.active.includes(id) && !state.quests.done.includes(id)) state.quests.active.push(id);
}
/** Take an errand built by errandFrom(). */
export function acceptErrand(state, errand) {
  if (state.quests.errands.some((e) => e.id === errand.id)) return;
  state.quests.errands.push(errand);
  state.quests.active.push(errand.id);
}

/**
 * Hand a finished task in. Returns { loot, rose } (the reward as loot pairs, and
 * the new renown if it rose, else 0), or null if it is not finished.
 */
export function turnIn(state, id) {
  const q = questOf(state, id);
  if (!q || !state.quests.active.includes(id) || !isComplete(q, state)) return null;
  const o = q.objective;
  if (o.type === 'gather') removeItem(state, o.item, o.count);
  if (o.type === 'gatherAll') for (const item of o.items) removeItem(state, item, o.count);
  state.quests.active = state.quests.active.filter((a) => a !== id);
  if (q.errand) {
    state.quests.errands = state.quests.errands.filter((e) => e.id !== id);
    state.quests.count[q.giver] = (state.quests.count[q.giver] ?? 0) + 1;
  } else state.quests.done.push(id);
  if (q.homestead && homesteadBySite[q.homestead] && !state.homesteads.includes(q.homestead)) state.homesteads.push(q.homestead); // a family takes the farm
  delete state.quests.asked[id];
  delete state.quests.marks[id];
  const r = q.reward, loot = [];
  if (r.silver) loot.push(['silver', r.silver]);
  if (r.arrows) loot.push(['arrows', r.arrows]);
  for (const [item, n] of Object.entries(r.items ?? {})) loot.push([item, n]);
  for (const [item, n] of loot) addItem(state, item, n);
  const rose = addHonour(state, r.honour ?? 0);
  return { loot, rose };
}

// ---- errands ----

const KIND_PLURALS = {
  stones: 'rings of standing stones', statue: 'fallen kings', aqueduct: 'broken aqueducts', barrow: 'barrows',
  rotunda: 'pillared rotundas', chapel: 'roofless chapels', waystone: 'waystones', gate: 'gateways to nothing',
  tower: 'drum towers', baths: 'sunken courts',
};

/** A direction in words, from Henneth Annûn or another place: "to the south-east of here, a long walk". */
export function directionWords(x, z, from = HA, here = 'here') {
  const dx = x - from.x, dz = z - from.z, d = Math.hypot(dx, dz);
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = Math.atan2(dx, -dz); // 0 = north, clockwise
  const dir = names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  const far = d < 270 ? 'not far' : d < 680 ? 'a fair walk' : d < 1280 ? 'a long walk' : 'a very long way';
  return `to the ${dir} of ${here}, ${far}`;
}

const nearestTo = (list, x = HA.x, z = HA.z) => list.reduce((b, p) => (!b || Math.hypot(p.x - x, p.z - z) < Math.hypot(b.x - x, b.z - z) ? p : b), null);
const uncleared = (state) => CAMPS.filter((c) => !state.cleared.includes(c.id));

/**
 * The errand this giver would offer now, built whole, or null if one of theirs
 * is already in hand. Faramir and Éowyn offer errands only when they have no
 * told task to offer (the story first); each kind is tried in turn from where
 * the last left off, and a kind that cannot be done now is skipped. A
 * settlement's people (giver = its site id) have a short run of their own.
 */
export function errandFrom(giver, state) {
  if (state.quests.errands.some((e) => e.giver === giver)) return null;
  if (settlementBySite[giver]) return buildVillager(giver, state);
  if (offerFrom(giver, state)) return null;
  if (giver === 'faramir' && !state.quests.done.includes('f1')) return null; // the nearest fire first
  const E = ERRANDS[giver], n = state.quests.count[giver] ?? 0;
  for (let k = 0; k < E.kinds.length; k++) {
    const kind = E.kinds[(n + k) % E.kinds.length];
    const built = (giver === 'faramir' ? buildFaramir : buildEowyn)(kind, n, state, E);
    if (!built) continue;
    const { params, objective, extra, homestead } = built;
    const reward = { silver: Math.min(70, 8 + 3 * n), honour: Math.min(60, 14 + 2 * n), items: {} };
    if (giver === 'faramir' && n % 2 === 1) reward.arrows = 10;
    if (giver === 'eowyn' && n % 2 === 1) reward.items.draught = 1;
    if (extra) Object.assign(reward.items, extra);
    if (kind === 'bounty') { reward.silver = Math.round(reward.silver * 1.5); reward.honour = Math.round(reward.honour * 1.5); }
    if (n % 5 === 4) { // now and then, something worth having
      const gift = E.gifts.find((id) => !owns(state, id));
      if (gift) reward.items[gift] = 1; else reward.silver += 30;
    }
    return { id: `x${giver[0]}${n}`, giver, errand: kind, ...E.text[kind](params), objective, reward, ...(homestead ? { homestead } : {}) };
  }
  return null;
}

/** How a province is named in a sentence: "the Bridgelands", "Eryn Henneth". */
const inWords = (pid) => provinceById[pid].name.replace(/^The /, 'the ');

// Errands keep to the province the work is in (workingProvince): its camps,
// its old places. Only trophies, plants and the road bands are taken anywhere.
function buildFaramir(kind, n, state, E) {
  const pid = workingProvince(state);
  const open = uncleared(state).filter((c) => CAMP_PROVINCE[c.id] === pid);
  if (kind === 'trophy') {
    // only what is carried by those still in the province (or on the road, for the arrowheads)
    const carried = {
      redEye: open.some((c) => c.size >= 2 || c.tier >= 3), // Uruks
      captainToken: open.some((c) => c.size >= 3),
    };
    const L = E.trophies.length;
    const pick = [...Array(L).keys()].map((k) => E.trophies[(n + k) % L]).find(([id]) => carried[id] ?? true);
    const [item, base] = pick;
    const c = item === 'captainToken' ? 1 + Math.floor(n / 14) : base + Math.floor(n / 6);
    return { params: { itemName: ITEMS[item].name, count: c, hint: TROPHY_HINTS[item], marshal: state.quests.done.includes('f16') }, objective: { type: 'gather', item, count: c } };
  }
  if (kind === 'bounty') { // a purse for every five to ten camps broken, anywhere
    const left = uncleared(state).length;
    if (left < 5) return null;
    const c = Math.min(10, 5 + Math.floor(n / 4), left);
    return { params: { count: c }, objective: { type: 'clearSince', where: 'any', count: c, base: state.cleared.length } };
  }
  if (kind === 'bands') {
    if (!state.quests.done.includes('f3')) return null; // not until he has sent you to the road
    const c = Math.min(3, 1 + Math.floor(n / 8));
    return { params: { count: c }, objective: { type: 'bands', count: c, base: state.stats.bands ?? 0 } };
  }
  if (kind === 'scouted') {
    const camp = nearestTo(open.filter((c) => !state.discovered.includes('camp:' + c.id))) ?? nearestTo(open);
    if (!camp) return null;
    return { params: { where: directionWords(camp.x, camp.z), province: inWords(pid) }, objective: { type: 'clearCamp', camp: camp.id } };
  }
  if (kind === 'captain') {
    if (!open.some((c) => c.size >= 3)) return null;
    const where = 'stockade@' + pid;
    return { params: { where: inWords(pid) }, objective: { type: 'clearSince', where, count: 1, base: clearedWhere(state, where) } };
  }
  return null;
}

/** The province Éowyn is mapping now: the first settlement whose map is not handed in (else Faramir's). */
function mappingProvince(state) {
  return SETTLEMENTS.find((s) => !state.quests.done.includes('m-' + s.province))?.province ?? workingProvince(state);
}

function buildEowyn(kind, n, state, E) {
  if (kind === 'kingsfoil') {
    const c = 4 + Math.floor(n / 4);
    if (standingPlants(state, 'athelas').length + count(state, 'athelas') < c) return null;
    return { params: { count: c }, objective: { type: 'gather', item: 'athelas', count: c }, extra: { draught: 2 } };
  }
  if (kind === 'kind') {
    const pid = mappingProvince(state);
    const left = PLACES.filter((p) => p.province === pid && p.set === 'ruins' && !state.discovered.includes(p.id));
    const kinds = Object.keys(RELIC_KINDS).filter((k) => left.some((p) => p.kind === k));
    if (!kinds.length) return null;
    const k = kinds[n % kinds.length], set = `kind:${k}@${pid}`;
    return { params: { title: RELIC_KINDS[k][0], kindPlural: KIND_PLURALS[k] ?? k, where: inWords(pid) }, objective: { type: 'seek', set, count: 1, base: foundIn(state, set) } };
  }
  if (kind === 'site') {
    // a farmstead for a family: in a free province if one has a farm not yet found, else where Faramir is working
    const unfound = (pid) => PLACES.filter((p) => p.set === 'farms' && p.province === pid && homesteadBySite[p.id.slice(5)] &&
      !state.discovered.includes(p.id) && !state.homesteads.includes(p.id.slice(5)));
    const free = PROVINCES.map((p) => p.id).filter((pid) => provinceStatus(state, pid).freed && unfound(pid).length);
    const pid = free[0] ?? workingProvince(state);
    const farm = nearestTo(unfound(pid));
    if (!farm) return null;
    return {
      params: { where: directionWords(farm.x, farm.z), province: inWords(pid), free: provinceStatus(state, pid).freed },
      objective: { type: 'discover', ids: [farm.id] }, homestead: farm.id.slice(5),
    };
  }
  return null;
}

/**
 * The next thing a settlement's people ask, built whole, or null once they have
 * asked all they will (or before they are home). Each done grows the place.
 */
function buildVillager(site, state) {
  const s = settlementBySite[site], n = state.quests.count[site] ?? 0;
  if (!arrived(state, site) || n >= STAGE_MAX) return null;
  const V = ERRANDS.village, from = (x, z) => directionWords(x, z, s, 'the village');
  const base = { name: s.name, last: n === STAGE_MAX - 1 };
  let kind = V.kinds[n], params = null, objective = null;
  if (kind === 'seed') {
    const i = V.kinds.slice(0, n).filter((k) => k === 'seed').length, item = s.crops[i], r = s.plots[i];
    const c = 4 + i;
    params = { ...base, first: i === 0, itemName: ITEMS[item].name, count: c, hint: SEED_HINTS[item] ?? '', where: r ? from((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2).replace(/, [^,]*$/, '') : 'by the houses' };
    objective = { type: 'gather', item, count: c };
  }
  if (kind === 'remnant') {
    const camp = nearestTo(uncleared(state).filter((c) => CAMP_PROVINCE[c.id] === s.province), s.x, s.z);
    if (camp) { params = { ...base, where: from(camp.x, camp.z) }; objective = { type: 'clearCamp', camp: camp.id }; }
    else kind = 'place';
  }
  if (kind === 'place') {
    const p = nearestTo(PLACES.filter((q) => q.province === s.province && q.set === 'ruins' && !state.discovered.includes(q.id)), s.x, s.z);
    if (p) { params = { ...base, where: from(p.x, p.z) }; objective = { type: 'discover', ids: [p.id] }; }
    else kind = 'kingsfoil';
  }
  if (kind === 'kingsfoil') {
    const c = 5;
    params = { ...base, count: c };
    objective = { type: 'gather', item: 'athelas', count: c };
  }
  const reward = { silver: 12 + 4 * n, honour: 12 + 2 * n, items: kind === 'kingsfoil' ? { draught: 2 } : n === 1 ? { waybread: 3 } : {} };
  return { id: `x${site}-${n}`, giver: site, errand: kind, ...V.text[kind](params), objective, reward };
}

// ---- hints, for a ranger who keeps asking ----

/** The nearest thing (to Henneth Annûn) that would move this objective on, or null. */
export function hintTarget(o, state) {
  const open = (where) => uncleared(state).filter((c) => !where || campMatches(where, c));
  switch (o.type) {
    case 'clearCamp': return campOf(o);
    case 'clearCount': return nearestTo(open());
    case 'clearWhere': case 'clearSince': return nearestTo(open(o.where));
    case 'discover': return placeById(o.ids.find((i) => !state.discovered.includes(i)));
    case 'discoverCount': case 'seek': return nearestTo(PLACES.filter((p) => placeMatches(o.set, p) && !state.discovered.includes(p.id)));
    case 'gather': return ITEMS[o.item].kind === 'herb' || ITEMS[o.item].kind === 'seed' ? nearestTo(standingPlants(state, o.item)) : null;
    case 'gatherAll': {
      const item = o.items.find((id) => count(state, id) < o.count);
      return item ? nearestTo(standingPlants(state, item)) : null;
    }
    case 'freed': { // the hold first, then the nearest camp still standing there
      const s = provinceStatus(state, o.province);
      return s.holdCleared ? nearestTo(open('province:' + o.province)) : s.hold;
    }
    case 'holdFound': return provinceStatus(state, o.province).hold;
    case 'settled': return escortTarget(state, o.site);
    case 'grown': { // the nearest settlement still growing
      const sites = (o.sites === 'all' ? SETTLEMENTS : SETTLEMENTS.filter((s) => o.sites.includes(s.site))).filter((s) => stageOf(state, s.site) < STAGE_MAX);
      return nearestTo(sites);
    }
    case 'all': for (const p of o.of) if (!isDone(p, state)) return hintTarget(p, state); return null;
    default: return null;
  }
}

/**
 * What a giver says when asked about a task in hand. The first time, a
 * reminder; asked again, a direction; asked a third time, they mark the place
 * on the ranger's map (state.quests.marks). Counts the asking.
 */
export function remindText(q, state) {
  const asked = (state.quests.asked[q.id] = (state.quests.asked[q.id] ?? 0) + 1);
  const p = progress(q.objective, state);
  let text = q.remind + (p.need > 1 ? ` (${Math.max(0, Math.min(p.have, p.need))} of ${p.need} so far.)` : '');
  if (asked < 2) return text;
  const o = q.objective;
  if (o.type === 'gather' && TROPHY_HINTS[o.item]) return text + ' ' + TROPHY_HINTS[o.item];
  if (o.type === 'bands') return text + ' They come down out of the north, mostly. Stand off the road a little, where you can see a long way along it.';
  if (o.type === 'settled') return text + ` Their boat is at the shore ${directionWords(settlementBySite[o.site].landing.x, settlementBySite[o.site].landing.z)}; their new home lies ${directionWords(settlementBySite[o.site].x, settlementBySite[o.site].z)}.`;
  const t = hintTarget(o, state);
  if (!t) return text;
  const s = settlementBySite[q.giver]; // the settlers give directions from their green
  const near = o.type === 'gather' || o.type === 'gatherAll' ? 'I saw some' : o.type.startsWith('clear') || o.type === 'holdFound' ? 'The scouts say there is one' : 'I have heard there is one';
  text += ` ${near} ${s ? directionWords(t.x, t.z, s, 'the village') : directionWords(t.x, t.z)}.`;
  if (asked >= 3) {
    state.quests.marks[q.id] = { x: t.x, z: t.z };
    text += ' Here: I will mark it on your map.';
  }
  return text;
}

// ---- Faramir's map ----

/**
 * Camps Faramir's scouts have word of that the ranger has not found: always a
 * few, the nearest to home first. Toward the end this is how the last are found.
 */
export function scoutedCamps(state) {
  const k = 3 + Math.floor(state.cleared.length / 25);
  return uncleared(state)
    .filter((c) => !state.discovered.includes('camp:' + c.id))
    .sort((a, b) => Math.hypot(a.x - HA.x, a.z - HA.z) - Math.hypot(b.x - HA.x, b.z - HA.z))
    .slice(0, k);
}

// ---- the HUD ----

/** A line for the HUD for every task in hand, in the order they were taken. */
export function trackers(state) {
  return state.quests.active.map((id) => questOf(state, id)).filter(Boolean).map((q) => trackerFor(q, state));
}

/** The first task in hand that has somewhere to go, or else the first; null if none. */
export function tracker(state) {
  const all = trackers(state);
  return all.find((t) => t.target) ?? all[0] ?? null;
}

function trackerFor(q, state) {
  const p = progress(q.objective, state);
  const done = p.have >= p.need;
  return {
    text: done ? `${q.title}: done. Return to ${giverName(q.giver)}.` : `${q.title}${p.need > 1 ? ` (${Math.max(0, Math.min(p.have, p.need))}/${p.need})` : ''}`,
    target: done ? (settlementBySite[q.giver] ?? HOME_DOOR) : targetOf(q.objective, state) ?? state.quests.marks[q.id] ?? null,
    done,
  };
}

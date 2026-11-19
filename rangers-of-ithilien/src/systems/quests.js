// Reads the tasks in data/quests.js against the saved state, builds the
// errands, and finds the hints Faramir and Éowyn give when asked. Pure.
//
// The told tasks (QUESTS) are known by id. An errand is built when it is
// offered and kept whole in `state.quests.errands` once taken, with any
// starting counts (`base`) it needs, so its progress can still be read from
// the saved state alone.

import { QUESTS, ERRANDS, TROPHY_HINTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { CAMPS } from '../world/campSites.js';
import { HA, LANDMARKS, haradRoadX } from '../world/layout.js';
import { RELIC_KINDS } from '../world/relicSites.js';
import { regionName } from '../world/regions.js';
import { PLACES, provinceStatus, workingProvince, freeProgress } from './provinces.js';
import { CAMP_PROVINCE, provinceById, provinceAt } from '../world/provinces.js';
import { herbSites } from '../world/herbSites.js';
import { addItem, removeItem, count, owns } from './inventory.js';
import { addHonour } from './renown.js';

export const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

/** The camp nearest to Henneth Annûn: the first one a new ranger is sent against. */
export const NEAREST_CAMP = CAMPS.reduce((a, b) => (Math.hypot(a.x - HA.x, a.z - HA.z) < Math.hypot(b.x - HA.x, b.z - HA.z) ? a : b));
/** Where a ranger goes to hand a task in: the hidden stair into the rock. */
export const HOME_DOOR = { x: HA.hatch.exitX + 2, z: (HA.hatch.z0 + HA.hatch.z1) / 2 };

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
    case 'all': {
      const parts = o.of.map((p) => progress(p, state));
      return { have: parts.filter((p) => p.have >= p.need).length, need: parts.length };
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
    return LANDMARKS.find((l) => l.id === id) ?? null;
  }
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

// ---- offering, taking and handing in ----

/** The next told task this giver has to offer, or null. */
export function offerFrom(giver, state) {
  return QUESTS.find((q) => q.giver === giver && !state.quests.done.includes(q.id) && !state.quests.active.includes(q.id) &&
    (q.requires ?? []).every((r) => state.quests.done.includes(r))) ?? null;
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

/** A direction from Henneth Annûn in words: "to the south-east, a long walk". */
export function directionWords(x, z) {
  const dx = x - HA.x, dz = z - HA.z, d = Math.hypot(dx, dz);
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = Math.atan2(dx, -dz); // 0 = north, clockwise
  const dir = names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  const far = d < 350 ? 'not far' : d < 900 ? 'a fair walk' : d < 1700 ? 'a long walk' : 'a very long way';
  return `to the ${dir} of here, ${far}`;
}

const nearestTo = (list, x = HA.x, z = HA.z) => list.reduce((b, p) => (!b || Math.hypot(p.x - x, p.z - z) < Math.hypot(b.x - x, b.z - z) ? p : b), null);
const uncleared = (state) => CAMPS.filter((c) => !state.cleared.includes(c.id));

/**
 * The errand this giver would offer now, built whole, or null if one of theirs
 * is already in hand. Each kind is tried in turn from where the last left off;
 * a kind that cannot be done now is skipped.
 */
export function errandFrom(giver, state) {
  if (state.quests.errands.some((e) => e.giver === giver)) return null;
  const E = ERRANDS[giver], n = state.quests.count[giver] ?? 0;
  for (let k = 0; k < E.kinds.length; k++) {
    const kind = E.kinds[(n + k) % E.kinds.length];
    const built = (giver === 'faramir' ? buildFaramir : buildEowyn)(kind, n, state, E);
    if (!built) continue;
    const { params, objective, extra } = built;
    const reward = { silver: Math.min(70, 8 + 3 * n), honour: Math.min(60, 14 + 2 * n), items: {} };
    if (giver === 'faramir' && n % 2 === 1) reward.arrows = 10;
    if (giver === 'eowyn' && n % 2 === 1) reward.items.draught = 1;
    if (extra) Object.assign(reward.items, extra);
    if (n % 5 === 4) { // now and then, something worth having
      const gift = E.gifts.find((id) => !owns(state, id));
      if (gift) reward.items[gift] = 1; else reward.silver += 30;
    }
    return { id: `x${giver[0]}${n}`, giver, errand: kind, ...E.text[kind](params), objective, reward };
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
      haradGold: open.some((c) => c.tier >= 3), // Southrons
    };
    const L = E.trophies.length;
    const pick = [...Array(L).keys()].map((k) => E.trophies[(n + k) % L]).find(([id]) => carried[id] ?? true);
    const [item, base] = pick;
    const c = item === 'captainToken' ? 1 + Math.floor(n / 14) : base + Math.floor(n / 6);
    return { params: { itemName: ITEMS[item].name, count: c, hint: TROPHY_HINTS[item] }, objective: { type: 'gather', item, count: c } };
  }
  if (kind === 'region') {
    if (!open.length) return null;
    const c = Math.min(open.length, 1 + Math.floor(n / 4), 5);
    const where = 'province:' + pid;
    return { params: { region: provinceById[pid].name, count: c }, objective: { type: 'clearSince', where, count: c, base: clearedWhere(state, where) } };
  }
  if (kind === 'bands') {
    const c = Math.min(3, 1 + Math.floor(n / 8));
    return { params: { count: c }, objective: { type: 'bands', count: c, base: state.stats.bands ?? 0 } };
  }
  if (kind === 'scouted') {
    const camp = nearestTo(open.filter((c) => !state.discovered.includes('camp:' + c.id))) ?? nearestTo(open);
    if (!camp) return null;
    return { params: { where: directionWords(camp.x, camp.z) }, objective: { type: 'clearCamp', camp: camp.id } };
  }
  if (kind === 'captain') {
    if (!open.some((c) => c.size >= 3)) return null;
    const where = 'stockade@' + pid;
    return { params: { where: inWords(pid) }, objective: { type: 'clearSince', where, count: 1, base: clearedWhere(state, where) } };
  }
  return null;
}

function buildEowyn(kind, n, state, E) {
  const pid = workingProvince(state);
  const left = PLACES.filter((p) => p.province === pid && !state.discovered.includes(p.id));
  if (kind === 'seeds' || kind === 'kingsfoil') {
    const c = kind === 'kingsfoil' ? 4 + Math.floor(n / 4) : 3 + Math.floor(n / 4);
    // a plant that grows in the province, enough of it standing there
    const here = (id) => standingPlants(state, id).filter((h) => provinceAt(h.x, h.z) === pid).length + count(state, id) >= c;
    const S = E.seeds.length, first = Math.floor(n / 2);
    const item = kind === 'kingsfoil' ? 'athelas' : [...Array(S).keys()].map((k) => E.seeds[(first + k) % S]).find(here);
    if (!item || !here(item)) return null;
    return {
      params: { itemName: ITEMS[item].name, count: c, hint: E.seedHints[item] ?? '' },
      objective: { type: 'gather', item, count: c },
      extra: kind === 'kingsfoil' ? { draught: 2 } : null,
    };
  }
  if (kind === 'kind') {
    const kinds = Object.keys(RELIC_KINDS).filter((k) => left.some((p) => p.set === 'ruins' && p.kind === k));
    if (!kinds.length) return null;
    const k = kinds[n % kinds.length], set = `kind:${k}@${pid}`;
    return { params: { title: RELIC_KINDS[k][0], kindPlural: KIND_PLURALS[k] ?? k, where: inWords(pid) }, objective: { type: 'seek', set, count: 1, base: foundIn(state, set) } };
  }
  if (kind === 'area') {
    if (!left.length) return null;
    const set = 'province:' + pid;
    const c = Math.min(left.length, 1 + Math.floor(n / 6), 3);
    return { params: { region: provinceById[pid].name, count: c }, objective: { type: 'seek', set, count: c, base: foundIn(state, set) } };
  }
  if (kind === 'site') {
    const has = (set) => left.some((p) => p.set === set);
    const set = has('villages') && (n % 2 === 0 || !has('farms')) ? 'villages' : has('farms') ? 'farms' : null;
    if (!set) return null;
    const spec = `${set}@${pid}`;
    return { params: { kind: set === 'villages' ? 'hamlet' : 'farm', where: inWords(pid) }, objective: { type: 'seek', set: spec, count: 1, base: foundIn(state, spec) } };
  }
  return null;
}

// ---- hints, for a ranger who keeps asking ----

/** The nearest thing (to Henneth Annûn) that would move this objective on, or null. */
export function hintTarget(o, state) {
  const open = (where) => uncleared(state).filter((c) => !where || campMatches(where, c));
  switch (o.type) {
    case 'clearCamp': return campOf(o);
    case 'clearCount': return nearestTo(open());
    case 'clearWhere': case 'clearSince': return nearestTo(open(o.where));
    case 'discover': return LANDMARKS.find((l) => l.id === o.ids.find((i) => !state.discovered.includes(i))) ?? null;
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
  const t = hintTarget(o, state);
  if (!t) return text;
  const near = o.type === 'gather' || o.type === 'gatherAll' ? 'I saw some' : o.type.startsWith('clear') ? 'The scouts say there is one' : 'I have heard there is one';
  text += ` ${near} ${directionWords(t.x, t.z)}.`;
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
  const k = 3 + Math.floor(state.cleared.length / 40);
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
    text: done ? `${q.title}: done. Return to ${q.giver === 'faramir' ? 'Faramir' : 'Éowyn'}.` : `${q.title}${p.need > 1 ? ` (${Math.max(0, Math.min(p.have, p.need))}/${p.need})` : ''}`,
    target: done ? HOME_DOOR : targetOf(q.objective, state) ?? state.quests.marks[q.id] ?? null,
    done,
  };
}

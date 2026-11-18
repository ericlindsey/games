// Saved game state: one versioned JSON object in localStorage.
// This is the only module that touches storage. A bad save never breaks the game.

import { SAVE, WORLD } from '../config.js';
import { HA } from '../world/layout.js';
import { ITEMS, SLOTS } from '../data/items.js';
import { levelFor } from './renown.js';

export function newState() {
  return {
    version: SAVE.version,
    savedAt: 0,
    player: { x: HA.spawn.x, z: HA.spawn.z, heading: HA.spawn.heading },
    discovered: ['henneth'],
    cleared: [],
    settings: { quality: null, fps: false },
    stats: { playSeconds: 0, kills: 0, deaths: 0, bands: 0 },
    // the ranger
    health: 100,
    weapon: 'sword',
    arrows: 24,
    silver: 0,
    honour: 0,  // renown points; `renown` is the level they make (systems/renown.js)
    renown: 0,
    items: { waybread: 2 },
    equipped: { sword: 'rangerSword', bow: 'rangerBow', body: null, helm: null, legs: null },
    wear: {},   // item id -> condition, 1 new to 0 worn out (swords and bows)
    honed: {},  // item id -> times honed or restrung, 0 to 3
    skills: {}, // { repair: true } once Mablung has taught it
    // tasks: told tasks by id; errands kept whole while in hand; how many errands
    // each giver has had done; how often each task has been asked after; marks
    // a giver has put on the map
    quests: { active: [], done: [], errands: [], count: {}, asked: {}, marks: {} },
    told: [],   // camps Faramir has marked from his own map
    picked: [], // plants already gathered
  };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const strings = (a) => (Array.isArray(a) ? a.filter((s) => typeof s === 'string') : []);

/** Turn whatever was stored into a valid current state, or null if unusable. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !num(raw.version) || raw.version > SAVE.version) return null;
  const s = newState();
  // v1 -> v2: the world was reshaped (2 km by 4 km, new camps), so places and
  // progress from v1 no longer mean anything. Only the settings carry over.
  // v3 -> v4 rebuilt the gear, renown and tasks (more of everything, spread
  // across the whole game), so a v3 ranger's progress no longer fits either:
  // again only the settings carry over (the player agreed to begin again).
  if (raw.version < 4) raw = { version: 4, settings: raw.settings };
  const p = raw.player;
  if (p && num(p.x) && num(p.z) && p.x >= 0 && p.x <= WORLD.width && p.z >= 0 && p.z <= WORLD.length) {
    s.player = { x: p.x, z: p.z, heading: num(p.heading) ? p.heading : 0 };
    if (num(p.y)) s.player.y = p.y;
  }
  s.discovered = [...new Set(['henneth', ...strings(raw.discovered)])];
  s.cleared = [...new Set(strings(raw.cleared))];
  if (raw.settings && ['low', 'medium', 'high'].includes(raw.settings.quality)) s.settings.quality = raw.settings.quality;
  // v4 -> v5 only added the frame-rate counter setting (off unless chosen); all else carries over
  if (raw.settings?.fps === true) s.settings.fps = true;
  if (raw.stats) for (const k of ['playSeconds', 'kills', 'deaths']) if (num(raw.stats[k])) s.stats[k] = raw.stats[k];
  if (num(raw.health)) s.health = Math.max(1, Math.min(100, raw.health));
  if (raw.weapon === 'bow') s.weapon = 'bow';
  for (const k of ['arrows', 'silver', 'honour']) if (num(raw[k]) && raw[k] >= 0) s[k] = Math.floor(raw[k]);
  s.renown = levelFor(s.honour);
  if (num(raw.stats?.bands)) s.stats.bands = raw.stats.bands;
  if (raw.items && typeof raw.items === 'object') {
    s.items = {};
    for (const [id, n] of Object.entries(raw.items)) if (ITEMS[id] && num(n) && n > 0) s.items[id] = Math.floor(n);
  }
  if (raw.equipped && typeof raw.equipped === 'object') {
    for (const slot of SLOTS) {
      const id = raw.equipped[slot];
      if ((id === null && slot !== 'sword' && slot !== 'bow') || ITEMS[id]?.slot === slot) s.equipped[slot] = id;
    }
  }
  for (const k of ['wear', 'honed']) {
    if (raw[k] && typeof raw[k] === 'object') for (const [id, v] of Object.entries(raw[k])) if (ITEMS[id] && num(v)) s[k][id] = k === 'wear' ? Math.max(0, Math.min(1, v)) : Math.max(0, Math.min(3, Math.floor(v)));
  }
  if (raw.skills?.repair === true) s.skills.repair = true;
  const q = raw.quests;
  if (q) {
    s.quests.done = strings(q.done);
    if (Array.isArray(q.errands)) s.quests.errands = q.errands.filter((e) => e && typeof e.id === 'string' && typeof e.giver === 'string' && e.objective?.type && e.reward);
    const ids = new Set(s.quests.errands.map((e) => e.id));
    s.quests.active = strings(q.active).filter((id) => !id.startsWith('x') || ids.has(id));
    for (const k of ['count', 'asked']) if (q[k] && typeof q[k] === 'object') for (const [id, v] of Object.entries(q[k])) if (num(v)) s.quests[k][id] = Math.floor(v);
    if (q.marks && typeof q.marks === 'object') for (const [id, m] of Object.entries(q.marks)) if (num(m?.x) && num(m?.z)) s.quests.marks[id] = { x: m.x, z: m.z };
  }
  s.told = strings(raw.told);
  s.picked = strings(raw.picked);
  s.savedAt = num(raw.savedAt) ? raw.savedAt : 0;
  return s;
}

export class SaveStore {
  /** @param key where to keep the save (the testing page keeps its own, apart from the real one) */
  constructor(storage, key = SAVE.key) {
    this.storage = storage;
    this.key = key;
  }
  /** @returns the saved state, or null if there is none or it is unreadable. */
  load() {
    try {
      const text = this.storage.getItem(this.key);
      return text ? migrate(JSON.parse(text)) : null;
    } catch {
      return null;
    }
  }
  save(state) {
    try {
      state.savedAt = Date.now();
      this.storage.setItem(this.key, JSON.stringify(state));
      return true;
    } catch {
      return false; // storage full or unavailable (private mode): play on without saving
    }
  }
  clear() {
    try { this.storage.removeItem(this.key); } catch { /* nothing to clear */ }
  }
}

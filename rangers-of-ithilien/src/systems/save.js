// Saved game state: one versioned JSON object in localStorage.
// This is the only module that touches storage. A bad save never breaks the game.

import { SAVE, WORLD } from '../config.js';
import { HA } from '../world/layout.js';
import { ITEMS } from '../data/items.js';

export function newState() {
  return {
    version: SAVE.version,
    savedAt: 0,
    player: { x: HA.spawn.x, z: HA.spawn.z, heading: HA.spawn.heading },
    discovered: ['henneth'],
    cleared: [],
    settings: { quality: null },
    stats: { playSeconds: 0, kills: 0, deaths: 0 },
    // the ranger
    health: 100,
    weapon: 'sword',
    arrows: 24,
    silver: 0,
    renown: 0,
    items: { waybread: 2 },
    equipped: { sword: 'rangerSword', bow: 'rangerBow', armour: null },
    quests: { active: [], done: [] },
    picked: [], // kingsfoil plants already gathered
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
  if (raw.version === 1) raw = { version: 2, settings: raw.settings };
  const p = raw.player;
  if (p && num(p.x) && num(p.z) && p.x >= 0 && p.x <= WORLD.width && p.z >= 0 && p.z <= WORLD.length) {
    s.player = { x: p.x, z: p.z, heading: num(p.heading) ? p.heading : 0 };
    if (num(p.y)) s.player.y = p.y;
  }
  s.discovered = [...new Set(['henneth', ...strings(raw.discovered)])];
  s.cleared = [...new Set(strings(raw.cleared))];
  if (raw.settings && ['low', 'medium', 'high'].includes(raw.settings.quality)) s.settings.quality = raw.settings.quality;
  if (raw.stats) for (const k of ['playSeconds', 'kills', 'deaths']) if (num(raw.stats[k])) s.stats[k] = raw.stats[k];
  // v2 -> v3 added the ranger's health, gear, pack and tasks. A v2 save has none
  // of these, so it simply keeps the defaults above.
  if (num(raw.health)) s.health = Math.max(1, Math.min(100, raw.health));
  if (raw.weapon === 'bow') s.weapon = 'bow';
  for (const k of ['arrows', 'silver', 'renown']) if (num(raw[k]) && raw[k] >= 0) s[k] = Math.floor(raw[k]);
  if (raw.items && typeof raw.items === 'object') {
    s.items = {};
    for (const [id, n] of Object.entries(raw.items)) if (ITEMS[id] && num(n) && n > 0) s.items[id] = Math.floor(n);
  }
  if (raw.equipped && typeof raw.equipped === 'object') {
    for (const slot of ['sword', 'bow', 'armour']) {
      const id = raw.equipped[slot];
      if (id === null || ITEMS[id]?.slot === slot) s.equipped[slot] = id;
    }
  }
  if (raw.quests) { s.quests.active = strings(raw.quests.active); s.quests.done = strings(raw.quests.done); }
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

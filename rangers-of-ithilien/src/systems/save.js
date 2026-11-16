// Saved game state: one versioned JSON object in localStorage.
// This is the only module that touches storage. A bad save never breaks the game.

import { SAVE, WORLD } from '../config.js';
import { HA } from '../world/layout.js';

export function newState() {
  return {
    version: SAVE.version,
    savedAt: 0,
    player: { x: HA.spawn.x, z: HA.spawn.z, heading: HA.spawn.heading },
    discovered: ['henneth'],
    cleared: [],
    settings: { quality: null },
    stats: { playSeconds: 0 },
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
  if (raw.stats && num(raw.stats.playSeconds)) s.stats.playSeconds = raw.stats.playSeconds;
  s.savedAt = num(raw.savedAt) ? raw.savedAt : 0;
  return s;
}

export class SaveStore {
  constructor(storage) {
    this.storage = storage;
  }
  /** @returns the saved state, or null if there is none or it is unreadable. */
  load() {
    try {
      const text = this.storage.getItem(SAVE.key);
      return text ? migrate(JSON.parse(text)) : null;
    } catch {
      return null;
    }
  }
  save(state) {
    try {
      state.savedAt = Date.now();
      this.storage.setItem(SAVE.key, JSON.stringify(state));
      return true;
    } catch {
      return false; // storage full or unavailable (private mode): play on without saving
    }
  }
  clear() {
    try { this.storage.removeItem(SAVE.key); } catch { /* nothing to clear */ }
  }
}

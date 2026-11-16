// Who the enemy are, and who holds each camp. Pure data and functions.

import { rng } from '../util/noise.js';

export const ENEMY_TYPES = {
  snaga: { name: 'Orc', hp: 30, damage: 7, speed: 4.7, scale: 0.92 },
  archer: { name: 'Orc archer', hp: 24, damage: 8, speed: 4.3, scale: 0.95, ranged: true },
  uruk: { name: 'Uruk', hp: 72, damage: 15, speed: 4.3, scale: 1.12 },
  haradrim: { name: 'Southron', hp: 55, damage: 12, speed: 5.1, scale: 1.02 },
  chief: { name: 'Captain', hp: 150, damage: 21, speed: 4.5, scale: 1.28 },
};

/**
 * Who holds a camp: a list of type names, fixed for each camp. Pure.
 * Archers are the dangerous ones to leave alone, so small camps often have none.
 */
export function rosterFor(camp) {
  const rand = rng(Math.round(camp.x * 31 + camp.z * 17));
  const strong = () => (camp.tier >= 3 && rand() < 0.5 ? 'haradrim' : 'uruk');
  const list = ['snaga', 'snaga'];
  if (camp.size === 1) {
    if (rand() < 0.3) list.push('snaga');
    if (camp.tier >= 2 && rand() < 0.35) list.push('archer');
    if (camp.tier >= 3) list[0] = strong();
  } else if (camp.size === 2) {
    list.push(strong());
    if (rand() < 0.6) list.push('archer');
    if (camp.tier >= 3) list.push('snaga');
  } else if (camp.size === 3) {
    list.push('snaga', 'archer', strong(), strong(), 'chief');
    if (rand() < 0.5) list.push('archer');
  } else {
    list.push('snaga', 'snaga', 'archer', 'archer', strong(), strong(), strong(), strong(), 'chief');
    if (rand() < 0.5) list.push('archer');
  }
  return list;
}

/** A band on the road: `host` is the rare great company that a lone ranger should not meet. Pure. */
export function patrolRoster(tier, rand) {
  if (rand() < 0.12) {
    const list = ['chief'];
    const n = 9 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) list.push(i % 4 === 3 ? 'archer' : i % 3 === 0 ? (rand() < 0.5 ? 'uruk' : 'haradrim') : 'snaga');
    return { list, host: true };
  }
  const list = ['snaga'];
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) list.push(rand() < 0.2 ? 'archer' : tier >= 3 && rand() < 0.4 ? 'uruk' : 'snaga');
  return { list, host: false };
}

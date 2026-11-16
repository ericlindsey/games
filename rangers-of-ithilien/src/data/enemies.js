// Who the enemy are, and who holds each camp. Pure data and functions.

import { rng } from '../util/noise.js';

export const ENEMY_TYPES = {
  snaga: { name: 'Orc', hp: 30, damage: 7, speed: 4.7, scale: 0.92 },
  archer: { name: 'Orc archer', hp: 24, damage: 8, speed: 4.3, scale: 0.95, ranged: true },
  uruk: { name: 'Uruk', hp: 72, damage: 15, speed: 4.3, scale: 1.12 },
  haradrim: { name: 'Southron', hp: 55, damage: 12, speed: 5.1, scale: 1.02 },
  chief: { name: 'Captain', hp: 150, damage: 21, speed: 4.5, scale: 1.28 },
};

/** Who holds a camp: a list of type names, fixed for each camp. Pure. */
export function rosterFor(camp) {
  const rand = rng(Math.round(camp.x * 31 + camp.z * 17));
  const strong = () => (camp.tier >= 3 && rand() < 0.5 ? 'haradrim' : 'uruk');
  const list = ['snaga', 'snaga'];
  if (camp.size === 1) {
    if (camp.tier >= 2) list.push('archer');
    if (camp.tier >= 3) list[0] = strong();
  } else if (camp.size === 2) {
    list.push('archer', strong());
    if (camp.tier >= 3) list.push(rand() < 0.5 ? 'archer' : 'snaga');
  } else {
    list.push('snaga', 'archer', 'archer', strong(), strong(), 'chief');
  }
  return list;
}


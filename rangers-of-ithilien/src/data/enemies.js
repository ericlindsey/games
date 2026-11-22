// Who the enemy are, and who holds each camp. Pure data and functions.

import { rng } from '../util/noise.js';
import { HOLDS } from '../world/provinces.js';

export const ENEMY_TYPES = {
  snaga: { name: 'Orc', hp: 40, damage: 7, speed: 4.7, scale: 0.92 },
  archer: { name: 'Orc archer', hp: 30, damage: 8, speed: 4.3, scale: 0.95, ranged: true },
  uruk: { name: 'Uruk', hp: 72, damage: 15, speed: 4.3, scale: 1.12 },
  haradrim: { name: 'Southron', hp: 55, damage: 12, speed: 5.1, scale: 1.02 },
  chief: { name: 'Captain', hp: 150, damage: 21, speed: 4.5, scale: 1.28 },
  // (since v0.7) the war-chief gathering the remnants: he holds the Morgul Marches himself
  marshal: { name: 'The Marshal', hp: 360, damage: 27, speed: 4.6, scale: 1.45 },
};
/** The camp the Marshal holds: the hold of the Morgul Marches, at the last. */
export const MARSHAL_CAMP = HOLDS.morgul.id;

/**
 * How a chase goes (since v0.6). Once roused, a company follows the ranger
 * wherever they go, however far from its camp, until the ranger is `lost`
 * metres off or back within the refuge of Henneth Annûn. On the way, anyone
 * at rest within `rouse` metres of a chaser takes up the chase too.
 */
export const CHASE = { lost: 100, rouse: 35 };
/** How far from its fire a camp's company may stand at rest (where they are set down, plus their wandering). */
export const campReach = (size) => 2.6 + 2 + size * 1.3 + 2.5;

/**
 * Who holds a camp: a list of type names, fixed for each camp. Pure.
 * Archers are the dangerous ones to leave alone. Even the stragglers near home
 * often keep one, and every band does.
 */
export function rosterFor(camp, renown = 0) {
  const rand = rng(Math.round(camp.x * 31 + camp.z * 17));
  const strong = () => (camp.tier >= 3 && rand() < 0.5 ? 'haradrim' : 'uruk');
  const list = ['snaga', 'snaga'];
  if (camp.size === 1) {
    if (rand() < 0.3) list.push('snaga');
    if (rand() < (camp.tier >= 2 ? 0.7 : 0.5)) list.push('archer');
    if (camp.tier >= 3) list[0] = strong();
  } else if (camp.size === 2) {
    list.push(strong(), 'archer');
    if (camp.tier <= 2 && rand() < 0.35) list.push('archer');
    if (camp.tier >= 3) list.push(rand() < 0.4 ? 'archer' : 'snaga');
  } else if (camp.size === 3) {
    list.push('snaga', 'archer', strong(), strong(), 'chief');
    if (rand() < 0.75) list.push('archer');
  } else {
    list.push('snaga', 'snaga', 'archer', 'archer', strong(), strong(), strong(), strong(), 'chief');
    if (rand() < 0.5) list.push('archer');
  }
  if (camp.id === MARSHAL_CAMP) { // he leads his own hold, in place of its captain
    const i = list.indexOf('chief');
    if (i >= 0) list[i] = 'marshal'; else list.push('marshal');
  }
  // As word of the ranger spreads, the camps take in stragglers and stand to arms.
  const more = camp.size === 1 ? (renown >= 25 ? 1 : 0) : Math.floor(renown / 15) + (camp.size >= 3 && renown >= 40 ? 1 : 0);
  for (let i = 0; i < more; i++) list.push(i % 3 === 0 ? 'archer' : i % 3 === 1 ? 'snaga' : strong());
  return list;
}

/** A band on the road: `host` is the rare great company that a lone ranger should not meet. Pure. */
export function patrolRoster(tier, rand, renown = 0) {
  if (rand() < 0.12) {
    const list = ['chief'];
    const n = 9 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) list.push(i % 4 === 3 ? 'archer' : i % 3 === 0 ? (rand() < 0.5 ? 'uruk' : 'haradrim') : 'snaga');
    return { list, host: true };
  }
  const list = ['snaga'];
  const n = 1 + Math.floor(rand() * 3) + Math.floor(renown / 20);
  for (let i = 0; i < n; i++) list.push(rand() < 0.3 ? 'archer' : tier >= 3 && rand() < 0.4 ? 'uruk' : 'snaga');
  return { list, host: false };
}

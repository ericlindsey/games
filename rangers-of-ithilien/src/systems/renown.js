// Renown: how far word of the ranger has spread. Deeds earn points (`honour`);
// points make the renown level (0 to 50) that Mablung, the tasks and the enemy
// answer to. Pure.
//
// The curve is set so that a ranger who clears every camp, does a good many
// errands and hunts the road bands reaches 50 at about the end, and no sooner:
// the hundred camps are worth about 2,050 points with their companies, the told
// tasks about 1,750, the old places 160, and the rest has to come from errands
// and the road. (Since 0.5 there are half as many camps as before, each worth
// about 1.6 times as much.)

export const MAX_RENOWN = 50;

/** Points needed to reach a level. */
export function pointsFor(level) {
  return Math.round(25 * level + 1.2 * level * level);
}

/** The level for a number of points. */
export function levelFor(points) {
  let n = 0;
  while (n < MAX_RENOWN && pointsFor(n + 1) <= points) n++;
  return n;
}

/** Progress within the current level: { level, have, need, frac }. */
export function progressOf(points) {
  const level = levelFor(points);
  if (level >= MAX_RENOWN) return { level, have: 0, need: 0, frac: 1 };
  const lo = pointsFor(level), hi = pointsFor(level + 1);
  return { level, have: points - lo, need: hi - lo, frac: (points - lo) / (hi - lo) };
}

/** What deeds are worth. */
export const HONOUR = {
  kill: { snaga: 2, archer: 2, uruk: 3, haradrim: 3, chief: 9, marshal: 60 },
  camp: [0, 4, 9, 20, 48],      // by camp size
  band: 6, host: 40,            // a band beaten on the road; a great host
  place: 3, village: 2,         // an old place found; a farm or village found
};

/**
 * Add points and keep `state.renown` in step. Returns the new level if it rose,
 * else 0, so the caller can say so.
 */
export function addHonour(state, n) {
  const before = state.renown;
  state.honour = Math.max(0, (state.honour ?? 0) + Math.round(n));
  state.renown = levelFor(state.honour);
  return state.renown > before ? state.renown : 0;
}

/**
 * How much harder the enemy has grown, as word of the ranger spreads: the
 * hardest of them gather to meet a famous foe. 1 at renown 0.
 */
export function enemyStrength(renown) {
  return { hp: 1 + 0.012 * renown, damage: 1 + 0.009 * renown };
}

// Who the enemy are, and who holds each camp. Pure data and functions.

import { rng } from '../util/noise.js';
import { HOLDS } from '../world/provinces.js';
import { HA } from '../world/layout.js';
import { REFUGE } from '../world/regions.js';

export const ENEMY_TYPES = {
  snaga: { name: 'Orc', hp: 40, damage: 7, speed: 4.7, scale: 0.92 },
  archer: { name: 'Orc archer', hp: 30, damage: 8, speed: 4.3, scale: 0.95, ranged: true },
  uruk: { name: 'Uruk', hp: 72, damage: 15, speed: 4.3, scale: 1.12 },
  haradrim: { name: 'Southron', hp: 55, damage: 12, speed: 5.1, scale: 1.02 },
  chief: { name: 'Captain', hp: 150, damage: 21, speed: 4.5, scale: 1.28 },
  // (since v0.7) the war-chief gathering the remnants: he holds the Morgul Marches himself.
  // (since v0.8) a giant, misshapen and in black, head and shoulders over his captains
  marshal: { name: 'The Marshal', hp: 360, damage: 27, speed: 4.6, scale: 1.85 },
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

/**
 * (since v0.8) A scouting party: one to three, going from camp to camp with word.
 * A courier, going between the holds of two provinces, is two at most and never
 * without a blade. Pure.
 */
export function scoutRoster(tier, rand, courier = false) {
  const n = courier ? 1 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 3);
  const list = [tier >= 3 && rand() < 0.4 ? 'uruk' : 'snaga'];
  for (let i = 1; i < n; i++) list.push(rand() < 0.45 ? 'archer' : 'snaga');
  return list;
}

/** How wide a berth scouts give Henneth Annûn: well outside the ground they will not chase into. */
export const SCOUT_BERTH = REFUGE + 70;

/**
 * The way a party walks from one point to another: straight, unless that would
 * bring it near Henneth Annûn, when it bends round outside SCOUT_BERTH. Returns
 * the points to walk to, the last being the end. Pure.
 */
export function scoutRoute(a, b) {
  const pts = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  for (let pass = 0; pass < 4; pass++) {
    let bent = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((HA.x - p.x) * dx + (HA.z - p.z) * dz) / L2));
      const cx = p.x + dx * t, cz = p.z + dz * t, d = Math.hypot(cx - HA.x, cz - HA.z);
      if (d >= SCOUT_BERTH - 1 || t <= 0 || t >= 1) continue;
      // push the nearest point of the leg out past the berth (sideways, if the leg runs right through)
      let ux = cx - HA.x, uz = cz - HA.z;
      if (d < 1) { const L = Math.sqrt(L2); ux = -dz / L; uz = dx / L; } else { ux /= d; uz /= d; }
      pts.splice(i + 1, 0, { x: HA.x + ux * (SCOUT_BERTH + 15), z: HA.z + uz * (SCOUT_BERTH + 15) });
      bent = true;
      break;
    }
    if (!bent) break;
  }
  return pts;
}

/** The length of a route, and the point a given distance along it. Pure. */
export function alongRoute(pts, dist) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], L = Math.hypot(q.x - p.x, q.z - p.z);
    if (dist <= L) { const t = L ? dist / L : 0; return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, leg: i + 1 }; }
    dist -= L;
  }
  const e = pts[pts.length - 1];
  return { x: e.x, z: e.z, leg: pts.length - 1 };
}
export const routeLength = (pts) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);

/**
 * Where on a route a party should be set down to meet the ranger at (px, pz):
 * out of sight (about `ahead` metres off), before the place the route passes
 * nearest the ranger, which must be within `near`. Null if the route never
 * comes that near, or only where the party would appear in plain view. Pure.
 */
export function meetingPoint(pts, px, pz, near = 90, ahead = 160) {
  const total = routeLength(pts);
  let best = Infinity, at = 0;
  for (let s = 0; s <= total; s += 5) {
    const q = alongRoute(pts, s), d = Math.hypot(q.x - px, q.z - pz);
    if (d < best) { best = d; at = s; }
  }
  if (best > near) return null;
  for (let s = at; s >= 0; s -= 5) { // back along the route to a point about `ahead` off
    const q = alongRoute(pts, s);
    if (Math.hypot(q.x - px, q.z - pz) >= ahead) return { ...q, s };
  }
  return null; // (the ranger stands too near where it starts)
}

// The eight provinces of Ithilien: the land as Faramir divides it for the
// clearing, each with a hold that keeps it. Pure.
//
// The borders follow the land. West of the Harad Road, five streams that run the
// whole way from the mountains to the Anduin cut the woods into bands from north
// to south. East of the road the heather is two fells, split where the third of
// those streams comes down. Along the southern road a strip 200 m deep belongs to
// the Morgul Marches, so the Cross-roads, the eastern shore of Osgiliath and the
// mouth of the Morgul Vale lie together.
//
// The terrain regions (world/regions.js) are kinds of country, for plants and
// looks; provinces are places to win, and are drawn over them.

import { WORLD } from '../config.js';
import { STREAMS } from './terrain.js';
import { haradRoadX, southRoadZ, bankX } from './layout.js';
import { CAMPS } from './campSites.js';

/**
 * In the order they are listed to the ranger: north to south, each fell after
 * the woods beside it. `label` is where the name is written on the map.
 * Names: Sindarin where Gondor kept an old name, English where the books would
 * give one in our tongue. Forlad (forod + lad, "north plain") is our own coinage.
 */
export const PROVINCES = [
  { id: 'forlad', name: 'Forlad', title: 'the North Plain', label: { x: 900, z: 470 },
    blurb: 'Open heath down to the fens. The smoke of every fire is seen for miles.' },
  { id: 'henneth', name: 'Eryn Henneth', title: 'the Window Woods', label: { x: 640, z: 1060 },
    blurb: 'The woods about the falls, from Cair Andros to the Harad Road.' },
  { id: 'bridgelands', name: 'The Bridgelands', title: '', label: { x: 1080, z: 1860 },
    blurb: 'Old fields and fallen columns about the Old Bridge.' },
  { id: 'gorse', name: 'The Gorse Fells', title: '', label: { x: 1775, z: 820 },
    blurb: 'Heather and gorse over a man’s head, under the mountains.' },
  { id: 'ithil', name: 'Eryn Ithil', title: 'the Moonwood', label: { x: 880, z: 2700 },
    blurb: 'Deep woods, where the great trees stand far apart. Stockades among them.' },
  { id: 'southwood', name: 'The Southwood', title: '', label: { x: 560, z: 3170 },
    blurb: 'The last of the deep woods, above the southern road. War-camps.' },
  { id: 'ash', name: 'The Ash Fells', title: '', label: { x: 1775, z: 2950 },
    blurb: 'The heather gone grey under the mountains. Their captains keep the strongest holds here.' },
  { id: 'morgul', name: 'The Morgul Marches', title: '', label: { x: 1000, z: 3700 },
    blurb: 'The Cross-roads, the eastern shore of Osgiliath, and the mouth of the Morgul Vale.' },
];
export const provinceById = Object.fromEntries(PROVINCES.map((p) => [p.id, p]));
/**
 * The order Faramir means them to be won in (PLAN.md 11.6): the home country,
 * then the middle, then the south. The tasks look to the first one not yet free.
 */
export const CAMPAIGN = ['henneth', 'forlad', 'gorse', 'bridgelands', 'ithil', 'southwood', 'ash', 'morgul'];
/** "Forlad, the North Plain", or just the name when it is already English. */
export const fullName = (p) => (p.title ? `${p.name}, ${p.title}` : p.name);

// ---- the borders ----

const STEP = 4; // metres between samples of a border stream
const SAMPLES = Math.ceil(WORLD.width / STEP) + 1;

/** A stream's z at every STEP of x, for streams that run from the mountains to the river. */
function tableOf(stream) {
  const p = stream.points, t = new Float32Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const x = i * STEP;
    let z = x > p[0].x ? p[0].z : p.at(-1).z;
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k], b = p[k + 1];
      if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { z = a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x); break; }
    }
    t[i] = z;
  }
  return t;
}
/** Streams that cross the whole land (rising under the mountains, reaching the Anduin). */
const crossing = STREAMS.filter((s) => s.points[0].x > 1780 && s.points.at(-1).x < 220);
/** The full-width stream crossing x = 1000 nearest to z. */
function streamNear(z) {
  return crossing.map((s) => ({ s, t: tableOf(s) })).sort((a, b) => Math.abs(a.t[250] - z) - Math.abs(b.t[250] - z))[0];
}
// The five borders, north to south, by roughly where they cross the middle of the land.
const BORDERS = [740, 1520, 2180, 2990, 3330].map(streamNear);
const FELL_SPLIT = 2; // the fells divide where the third border stream comes down
const SOUTH_STRIP = 200;

const zOn = (t, x) => {
  const f = Math.max(0, Math.min(SAMPLES - 1.001, x / STEP)), i = Math.floor(f);
  return t[i] + (t[i + 1] - t[i]) * (f - i);
};
const WOODS = ['forlad', 'henneth', 'bridgelands', 'ithil', 'southwood', 'morgul'];

/** The id of the province at a point. */
export function provinceAt(x, z) {
  if (z > southRoadZ(x) - SOUTH_STRIP) return 'morgul';
  if (x > haradRoadX(z) + 10) return z < zOn(BORDERS[FELL_SPLIT].t, x) ? 'gorse' : 'ash';
  let i = 0;
  for (const b of BORDERS) if (z > zOn(b.t, x)) i++;
  return WOODS[i];
}

/**
 * The borders as lines to draw: [[x, z], ...] runs, along the border streams, the
 * Harad Road and the southern strip, kept only where the land on either side
 * belongs to different provinces.
 */
export function provinceBorders() {
  const lines = [];
  const along = (pts, across) => { // across(x, z) -> [[x1, z1], [x2, z2]] two points either side
    let run = [];
    for (const [x, z] of pts) {
      const [a, b] = across(x, z);
      if (provinceAt(a[0], a[1]) !== provinceAt(b[0], b[1])) run.push([x, z]);
      else { if (run.length > 1) lines.push(run); run = []; }
    }
    if (run.length > 1) lines.push(run);
  };
  const ns = (x, z) => [[x, z - 8], [x, z + 8]];
  for (const b of BORDERS) {
    const pts = [];
    for (let x = bankX(zOn(b.t, 0)); x <= WORLD.width; x += 8) pts.push([x, zOn(b.t, x)]);
    along(pts, ns);
  }
  const road = [];
  for (let z = 0; z <= WORLD.length; z += 8) road.push([haradRoadX(z) + 10, z]);
  along(road, (x, z) => [[x - 8, z], [x + 8, z]]);
  const strip = [];
  for (let x = 0; x <= WORLD.width; x += 8) strip.push([x, southRoadZ(x) - SOUTH_STRIP]);
  along(strip.filter(([x, z]) => x > bankX(z)), ns);
  return lines;
}

// ---- camps and holds ----

/** The province of every camp, by camp id. */
export const CAMP_PROVINCE = Object.fromEntries(CAMPS.map((c) => [c.id, provinceAt(c.x, c.z)]));
/** The camps of each province, by province id. */
export const PROVINCE_CAMPS = Object.fromEntries(PROVINCES.map((p) => [p.id, CAMPS.filter((c) => CAMP_PROVINCE[c.id] === p.id)]));

/**
 * The hold of each province: its strongest camp, and of those the one nearest
 * the middle of the province's camps. (Until captains come, the northern
 * provinces' holds are only their biggest camps.)
 */
export const HOLDS = Object.fromEntries(PROVINCES.map((p) => {
  const list = PROVINCE_CAMPS[p.id];
  const cx = list.reduce((s, c) => s + c.x, 0) / list.length, cz = list.reduce((s, c) => s + c.z, 0) / list.length;
  const top = Math.max(...list.map((c) => c.size));
  const hold = list.filter((c) => c.size === top).sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0];
  return [p.id, hold];
}));

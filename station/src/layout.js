// Where everything in the station goes, from the parameters. Pure: no Three.js,
// so it runs in the unit tests. Deterministic (seeded), so the same design
// always grows the same trees.

const TAU = Math.PI * 2;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tree species. rx, ry: crown half-width and half-height relative to the
 * tree's size; leaf: foliage tint (multiplies the leaf texture); bark: trunk tint.
 */
export const SPECIES = [
  { name: 'oak', weight: 0.24, rx: 1.0, ry: 0.85, leaf: [0.085, 0.17, 0.04], bark: [1, 1, 1] },
  { name: 'poplar', weight: 0.14, rx: 0.5, ry: 1.6, leaf: [0.065, 0.15, 0.05], bark: [1.1, 1.1, 1.0] },
  { name: 'pine', weight: 0.16, rx: 0.72, ry: 1.45, leaf: [0.03, 0.085, 0.05], bark: [0.9, 0.75, 0.7], cone: true },
  { name: 'willow', weight: 0.12, rx: 0.95, ry: 0.75, leaf: [0.10, 0.15, 0.085], bark: [0.8, 0.65, 0.6] },
  { name: 'lime', weight: 0.18, rx: 0.8, ry: 1.0, leaf: [0.15, 0.24, 0.05], bark: [2.2, 2.1, 2.0] },
  { name: 'maple', weight: 0.16, rx: 1.05, ry: 0.9, leaf: [0.045, 0.15, 0.085], bark: [1, 0.9, 0.85] },
];

function pickSpecies(u) {
  let acc = 0;
  for (let i = 0; i < SPECIES.length; i++) { acc += SPECIES[i].weight; if (u < acc) return i; }
  return 0;
}

/** Where the windows, spokes, ribs, lamps and trees go. */
export function computeLayout(p) {
  const R = p.diameter / 2;
  const H = Math.min(p.deck, R * 0.8);
  const HW = p.width / 2;
  const rc = R - H;

  // Ceiling: one skylight running all the way round the ring over the middle of
  // the deck, framed every ~6 m (where the ribs are), broken only where a spoke
  // meets the ceiling. The slider is the share of ceiling area that is glass.
  const ceilN = Math.max(4, Math.round((TAU * rc) / 6));
  const ceilFill = p.ceilGlass > 0 ? 0.95 : 0;
  const ceilHalfZ = ceilFill ? Math.max(0, Math.min(HW - 0.8, (HW * p.ceilGlass) / 100 / ceilFill)) : 0;
  const zShare = HW > 0 ? ceilHalfZ / HW : 0;

  // Side walls: a band from sill to near the ceiling, two windows per rib bay,
  // so every rib stands on a pier between windows.
  const sideLo = Math.min(0.9, H * 0.15);
  const sideHi = H - Math.min(0.6, H * 0.1);
  const sideN = ceilN * 2;
  const hShare = (sideHi - sideLo) / H;
  const sideFill = hShare > 0 ? clampN(p.sideGlass / 100 / hShare / 0.93, 0, 0.93) : 0;

  // Ribs: a beam under the ceiling and a post down each wall at every frame
  const ribN = ceilN;
  const ribD = clampN(H * 0.05, 0.15, 0.6);
  const ribW = clampN(H * 0.03, 0.15, 0.5);

  // Hub and spokes
  const hubR = clampN(R * 0.1, 1.5, 80);
  const spokeR = clampN(R * 0.018, 0.8, 14);
  const hasSpokes = rc > hubR + 2;
  const spokeN = hasSpokes ? clampN(Math.round((TAU * R) / 160), 3, 12) : 0;
  const hubHalfL = HW * 1.15 + hubR * 0.4;

  // The deck: path, flower beds either side, lawn, steel strip by the walls
  const pathHW = Math.min(2.0, HW * 0.3);
  const bedW = HW >= 6 ? Math.min(1.2, HW * 0.1) : 0;
  const edgeIn = HW - Math.min(2.0, HW * 0.2);

  // Lamps every other rib bay, alternating sides, with a bench opposite each
  let lampN = 0, lampZ = 0, lampH = 0;
  if (bedW >= 0.8 && H >= 3.5) {
    lampN = Math.max(2, 2 * Math.floor(ribN / 4));
    lampZ = pathHW + bedW * 0.5;
    lampH = Math.min(3.6, H - 0.6);
  }

  // Trees: rows either side of the path (more rows on a wide deck), species
  // and size varied per tree, jittered so they don't stand on a grid.
  const trees = [];
  let treeN = 0, treeRows = 0, crownH = 0;
  if (HW >= 6 && H >= 4.2) {
    const s = clampN((H - 2) / 5.2, 0.55, 2.8);
    const base = 1.5 * s;
    const spacing = Math.max(9, base * 6.5);
    const firstZ = pathHW + bedW + 0.6 + base * 1.1;
    const rowGap = base * 4.5;
    const perSide = clampN(Math.floor((edgeIn - 1 - base - firstZ) / rowGap) + 1, 1, 3);
    treeRows = perSide * 2;
    // at most ~600 trees in all: big rings space them out instead
    treeN = Math.max(6, Math.min(Math.round((TAU * R) / spacing), Math.floor(600 / treeRows)));
    const rand = rng(2024);
    const cell = TAU / treeN;
    let hSum = 0;
    for (let row = 0; row < treeRows; row++) {
      const side = row % 2 === 0 ? 1 : -1;
      const off = (row % 2) * 0.5;
      const zBase = side * (firstZ + Math.floor(row / 2) * rowGap);
      for (let k = 0; k < treeN; k++) {
        const sp = pickSpecies(rand());
        const S = SPECIES[sp];
        const size = base * (0.75 + 0.5 * rand());
        const rx = Math.min(size * S.rx, rowGap * 0.48, edgeIn - Math.abs(zBase) + 0.5);
        let ry = size * S.ry;
        ry = Math.min(ry, (H - 1.6) * 0.48);
        const hc = Math.min(H - 0.35 - ry, Math.max(ry + 1.9, ry * 1.6 + 0.6));
        const angle = (k + off + (rand() - 0.5) * 0.5) * cell;
        const z = zBase + (rand() - 0.5) * Math.min(1.2, rowGap * 0.2);
        const trunkR = clampN(size * 0.1, 0.08, 0.5);
        trees.push({ row, k, angle, z, rx, ry, hc, species: sp, trunkH: hc, trunkR, seed: rand() });
        hSum += hc;
      }
    }
    crownH = hSum / trees.length;
  }

  return {
    R, H, HW, rc,
    ceilN, ceilFill, ceilHalfZ,
    sideN, sideFill, sideLo, sideHi,
    ribN, ribD, ribW,
    hubR, spokeR, spokeN, hubHalfL,
    pathHW, bedW, edgeIn,
    lampN, lampZ, lampH,
    treeN, treeRows, crownH, trees,
    glassArea: { ceil: ceilFill * zShare, side: sideFill * hShare },
  };
}


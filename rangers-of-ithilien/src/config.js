// Tunables in one place. 1 unit = 1 metre. +X east, +Z south, Y up.

export const WORLD = {
  seed: 3019,
  width: 1500,   // east-west: Anduin bank (low x) to the Ephel Dúath (high x)
  length: 3000,  // north-south: northern heath (z=0) to beyond the Morgul road
  // The backdrop terrain extends past the playable area on every side. It is
  // drawn on a 32 m grid, so each side must be a whole number of 32 m steps.
  backdrop: { minX: -640, maxX: 1920, minZ: -480, maxZ: 3488 },
};

export const CHUNK = { size: 160, segments: 40 };

export const PLAYER = {
  walkSpeed: 2.6,
  runSpeed: 7.5,
  jumpSpeed: 6.5,
  gravity: 20,
  radius: 0.4,
  height: 1.8,
  stepHeight: 0.6,
  maxSlope: 0.95,     // rise/run above which the player cannot climb
  maxWadeDepth: 1.3,  // below the Anduin's surface
};

// trees: share of canopy trees kept; under: understory; cover: herbs and flowers.
// Plants have three forms, chosen tree by tree by distance: in full nearer than
// treeNear (great trees) or shrubNear (the rest), a lighter form out to treeMid /
// shrubMid, and a far form beyond. Herbs and flowers show within coverFar.
// Near each change of form a plant fades from one form into the next (a dither,
// about 12 m wide). Herbs, flowers and small bushes grow in from nothing over
// the last third of coverFar, far enough off not to be seen doing it.
// grass: radius of the field of blades (0 = none); grassNear: within this the
// blades are thick, beyond it sparser and broader; grassSpacing: metres between clumps near.
// pixelRatio: the sharpest the picture is drawn; if the frame rate sags below
// about 40 it is drawn coarser, by steps, down to minPixelRatio (main.js).
// Phones start on medium: a recent phone has the power for shadows and grass.
export const QUALITY = {
  low:    { loadRadius: 200, fogFar: 2000, shadows: false, shadowMap: 0,    pixelRatio: 1.25, minPixelRatio: 1, trees: 0.8, under: 0.5, cover: 0.4, motes: 60,  terrainSegments: 40, treeNear: 45, treeMid: 160, shrubNear: 30, shrubMid: 110, coverFar: 40, grass: 40, grassNear: 22, grassSpacing: 0.95, liteSurfaces: true },
  medium: { loadRadius: 340, fogFar: 2600, shadows: true,  shadowMap: 1024, pixelRatio: 2, minPixelRatio: 1.5, trees: 0.9, under: 0.8, cover: 0.7, motes: 120, terrainSegments: 80, treeNear: 85, treeMid: 290, shrubNear: 55, shrubMid: 190, coverFar: 75, grass: 80, grassNear: 40, grassSpacing: 0.76 },
  high:   { loadRadius: 500, fogFar: 3200, shadows: true,  shadowMap: 2048, pixelRatio: 2, minPixelRatio: 1.5, trees: 1,   under: 1,   cover: 1,   motes: 200, terrainSegments: 80, treeNear: 160, treeMid: 460, shrubNear: 100, shrubMid: 300, coverFar: 100, grass: 120, grassNear: 60, grassSpacing: 0.62 },
};

export const VERSION = '0.8';

export const SAVE = { key: 'rangers-of-ithilien.save', version: 8, autosaveSeconds: 30 };

// Tunables in one place. 1 unit = 1 metre. +X east, +Z south, Y up.

export const WORLD = {
  seed: 3019,
  width: 2000,   // east-west: Anduin bank (low x) to the Ephel Dúath (high x)
  length: 4000,  // north-south: northern heath (z=0) to beyond the Morgul road
  // The backdrop terrain extends past the playable area on every side.
  backdrop: { minX: -640, maxX: 2400, minZ: -480, maxZ: 4480 },
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
// lodNear: plants in chunks nearer than this are drawn in full. grass: radius of
// the field of blades (0 = none), grassSpacing: metres between clumps.
// Phones start on medium: a recent phone has the power for shadows and grass.
export const QUALITY = {
  low:    { loadRadius: 200, fogFar: 2000, shadows: false, shadowMap: 0,    pixelRatio: 1.25, trees: 0.8, under: 0.5, cover: 0.4, motes: 60,  terrainSegments: 40, lodNear: 40, grass: 22, grassSpacing: 0.95, liteSurfaces: true },
  medium: { loadRadius: 280, fogFar: 2600, shadows: true,  shadowMap: 1024, pixelRatio: 2,    trees: 0.9, under: 0.8, cover: 0.7, motes: 120, terrainSegments: 80, lodNear: 60, grass: 38, grassSpacing: 0.72 },
  high:   { loadRadius: 360, fogFar: 3200, shadows: true,  shadowMap: 2048, pixelRatio: 2,    trees: 1,   under: 1,   cover: 1,   motes: 200, terrainSegments: 80, lodNear: 80, grass: 50, grassSpacing: 0.6 },
};

export const VERSION = '0.1';

export const SAVE = { key: 'rangers-of-ithilien.save', version: 4, autosaveSeconds: 30 };

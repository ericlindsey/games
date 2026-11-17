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
export const QUALITY = {
  low:    { loadRadius: 200, fogFar: 2000, shadows: false, pixelRatio: 1.25, trees: 0.8, under: 0.5, cover: 0.4, motes: 60 },
  medium: { loadRadius: 280, fogFar: 2600, shadows: false, pixelRatio: 1.5,  trees: 0.9, under: 0.8, cover: 0.7, motes: 120 },
  high:   { loadRadius: 360, fogFar: 3200, shadows: true,  pixelRatio: 2,    trees: 1,   under: 1,   cover: 1,   motes: 200 },
};

export const VERSION = '0.1';

export const SAVE = { key: 'rangers-of-ithilien.save', version: 4, autosaveSeconds: 30 };

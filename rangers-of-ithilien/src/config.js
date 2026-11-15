// Tunables in one place. 1 unit = 1 metre. +X east, +Z south, Y up.

export const WORLD = {
  seed: 3019,
  width: 3200,   // east-west: Anduin bank (low x) to the Ephel Dúath (high x)
  length: 6400,  // north-south: northern heath (z=0) to beyond the Morgul road
  // The backdrop terrain extends past the playable area on every side.
  backdrop: { minX: -800, maxX: 3712, minZ: -640, maxZ: 7040 },
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

export const QUALITY = {
  low:    { loadRadius: 260, fogFar: 2200, shadows: false, pixelRatio: 1.25, trees: 0.6, cover: 0.35 },
  medium: { loadRadius: 360, fogFar: 2800, shadows: false, pixelRatio: 1.5,  trees: 0.85, cover: 0.7 },
  high:   { loadRadius: 450, fogFar: 3400, shadows: true,  pixelRatio: 2,    trees: 1,   cover: 1 },
};

export const SAVE = { key: 'rangers-of-ithilien.save', version: 1, autosaveSeconds: 30 };

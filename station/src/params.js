// The tunable parameters: their ranges, defaults, how a slider maps to them, and
// how they round-trip through the page's URL hash (so a design can be shared).

export const WARP_STEPS = [0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 100, 300, 1000];

/**
 * kind: 'lin' | 'log' | 'steps'. `rebuild` marks parameters that change the
 * station's geometry (everything else is a uniform or a camera setting).
 */
export const PARAMS = [
  { group: 'Station', key: 'diameter', label: 'Diameter', unit: 'm', kind: 'log', min: 20, max: 4000, def: 200, rebuild: true, digits: 0 },
  { group: 'Station', key: 'width', label: 'Width along axis', unit: 'm', kind: 'log', min: 4, max: 300, def: 32, rebuild: true, digits: 1 },
  { group: 'Station', key: 'gravity', label: 'Gravity at floor', unit: 'g', kind: 'lin', min: 0.05, max: 1.5, step: 0.01, def: 1, digits: 2 },
  { group: 'Station', key: 'deck', label: 'Deck height', unit: 'm', kind: 'log', min: 2.5, max: 60, def: 8, rebuild: true, digits: 1 },

  { group: 'Windows', key: 'ceilGlass', label: 'Ceiling glass', unit: '%', kind: 'lin', min: 0, max: 85, step: 1, def: 40, digits: 0 },
  { group: 'Windows', key: 'sideGlass', label: 'Side-wall glass', unit: '%', kind: 'lin', min: 0, max: 85, step: 1, def: 50, digits: 0 },

  { group: 'Orientation', key: 'tilt', label: 'Spin axis tilt from sun', unit: '°', kind: 'lin', min: 0, max: 180, step: 1, def: 60, digits: 0 },
  { group: 'Orientation', key: 'roll', label: 'Spin axis roll about sun line', unit: '°', kind: 'lin', min: 0, max: 360, step: 1, def: 20, digits: 0 },
  { group: 'Orientation', key: 'orbit', label: 'Position in orbit', unit: '°', kind: 'lin', min: 0, max: 360, step: 0.5, def: 330, digits: 1 },

  { group: 'Sky', key: 'moonSize', label: 'Moon angular size', unit: '°', kind: 'lin', min: 2, max: 150, step: 1, def: 90, digits: 0 },

  { group: 'View', key: 'warp', label: 'Time rate', unit: '×', kind: 'steps', steps: WARP_STEPS, def: 1 },
  { group: 'View', key: 'cabin', label: 'Cabin lights', unit: '%', kind: 'lin', min: 0, max: 100, step: 1, def: 35, digits: 0 },
  { group: 'View', key: 'exposure', label: 'Exposure', unit: '', kind: 'log', min: 0.1, max: 4, def: 1, digits: 2 },
  { group: 'View', key: 'fov', label: 'Field of view', unit: '°', kind: 'lin', min: 40, max: 120, step: 1, def: 80, digits: 0 },
];

export const BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

export function defaults() {
  return Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));
}

/** Slider position (0..1000) ↔ value. */
export function toSlider(def, v) {
  if (def.kind === 'steps') return def.steps.indexOf(v) >= 0 ? def.steps.indexOf(v) : def.steps.indexOf(def.def);
  if (def.kind === 'log') return Math.round((1000 * Math.log(v / def.min)) / Math.log(def.max / def.min));
  return Math.round((1000 * (v - def.min)) / (def.max - def.min));
}

export function fromSlider(def, s) {
  if (def.kind === 'steps') return def.steps[Math.max(0, Math.min(def.steps.length - 1, Math.round(s)))];
  let v = def.kind === 'log'
    ? def.min * Math.pow(def.max / def.min, s / 1000)
    : def.min + ((def.max - def.min) * s) / 1000;
  if (def.step) v = Math.round(v / def.step) * def.step;
  // log sliders: round to a tidy number of significant figures
  if (def.kind === 'log') { const m = Math.pow(10, Math.floor(Math.log10(v)) - 2); v = Math.round(v / m) * m; }
  return clamp(def, v);
}

export function clamp(def, v) {
  if (def.kind === 'steps') return def.steps.includes(v) ? v : def.def;
  return Math.min(def.max, Math.max(def.min, v));
}

export function format(def, v) {
  if (def.kind === 'steps') return v === 0 ? 'paused' : `${v}${def.unit}`;
  return `${v.toFixed(def.digits ?? 1)}${def.unit && def.unit !== '%' && def.unit !== '°' ? ' ' : ''}${def.unit}`;
}

/** Read parameters from `#diameter=200&width=30…`; unknown or bad keys are ignored. */
export function fromHash(hash) {
  const p = defaults();
  const view = {};
  for (const part of hash.replace(/^#/, '').split('&')) {
    const [k, raw] = part.split('=');
    if (k === 'view') { view.mode = raw; continue; }
    const def = BY_KEY[k];
    const v = Number(raw);
    if (def && Number.isFinite(v)) p[k] = clamp(def, v);
  }
  return { params: p, view };
}

export function toHash(p, mode) {
  const parts = PARAMS.filter((d) => p[d.key] !== d.def).map((d) => `${d.key}=${+p[d.key].toFixed(3)}`);
  if (mode && mode !== 'inside') parts.push(`view=${mode}`);
  return parts.length ? '#' + parts.join('&') : '';
}

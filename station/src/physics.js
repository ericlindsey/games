// The numbers behind the station and its orbit. Pure functions, no Three.js.
//
// Units: station in metres and seconds; orbit and sky in kilometres.

export const G0 = 9.80665;            // m/s², one standard gravity
export const EYE = 1.7;               // m, eye height above the floor

export const MOON_R = 1737.4;         // km, mean radius
export const MOON_GM = 4902.8;        // km³/s²
export const MOON_ALBEDO = 0.12;      // geometric-ish, for how much light it throws at us
export const EARTH_R = 6371.0;        // km
export const EARTH_DIST = 384400;     // km, mean Earth–Moon distance
export const SUN_ANG_RADIUS = 0.2666 * Math.PI / 180;   // rad, seen from 1 AU

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Spin needed for a floor gravity of `gravity` g on a ring of floor radius R (m). */
export function spinFor(R, gravity) {
  const omega = Math.sqrt((gravity * G0) / R);        // rad/s
  return { omega, period: TAU / omega, rpm: (60 * omega) / TAU, rimSpeed: omega * R };
}

/**
 * The circular orbit at which a sphere of radius MOON_R spans `angDeg` degrees.
 * A sphere's angular diameter is 2·asin(r/d), so d = r / sin(angle/2).
 */
export function orbitFor(angDeg) {
  const d = MOON_R / Math.sin((angDeg * DEG) / 2);
  return {
    radius: d,
    altitude: d - MOON_R,
    period: TAU * Math.sqrt((d * d * d) / MOON_GM),   // s
    speed: Math.sqrt(MOON_GM / d),                     // km/s
  };
}

/**
 * Moon's light on the station relative to direct sunlight, for a half-lit moon
 * of the given angular size. Projected solid angle of the disc is π·sin²(α/2);
 * a half-lit Lambertian sphere returns about 1/π of a full one's light toward us
 * (phase integral at 90°), times albedo.
 */
export function moonlightRatio(angDeg) {
  const s = Math.sin((angDeg * DEG) / 2);
  return MOON_ALBEDO * s * s * (1 / Math.PI) * 1.4;   // 1.4: opposition-ish surge folded in, rough
}

/** Everything the readout panel shows, from the parameter set. */
export function derive(p) {
  const R = p.diameter / 2;
  const spin = spinFor(R, p.gravity);
  const headR = Math.max(0.1, R - EYE);
  const orbit = orbitFor(p.moonSize);
  const ceilR = Math.max(0.5, R - p.deck);
  return {
    R,
    ceilR,
    ...spin,
    gHead: (spin.omega * spin.omega * headR) / G0,        // in g
    gradient: 1 - headR / R,                              // fraction lost from feet to eyes
    coriolisWalk: (2 * spin.omega * 1.4) / G0,            // in g, walking at 1.4 m/s across the spin
    floorArea: TAU * R * p.width,                         // m²
    volume: Math.PI * (R * R - ceilR * ceilR) * p.width,  // m³
    orbit,
    earthAngDeg: (2 * Math.asin(EARTH_R / EARTH_DIST)) / DEG,
  };
}

/** Rule-of-thumb comfort band for a spin rate. Not a medical claim. */
export function comfortFor(rpm) {
  if (rpm <= 2) return { level: 0, text: 'comfortable for most people' };
  if (rpm <= 4) return { level: 1, text: 'needs some days to adapt' };
  if (rpm <= 6) return { level: 2, text: 'hard to adapt; head turns disorient' };
  return { level: 3, text: 'likely nauseating' };
}

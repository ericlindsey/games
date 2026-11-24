// Physics and parameter checks. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spinFor, orbitFor, derive, comfortFor, G0, MOON_R } from '../src/physics.js';
import { PARAMS, BY_KEY, defaults, toSlider, fromSlider, fromHash, toHash, format } from '../src/params.js';
import { computeLayout, SPECIES } from '../src/layout.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('spin for 1 g on a 100 m radius ring is about 3 rpm', () => {
  const s = spinFor(100, 1);
  near(s.rpm, 2.99, 0.01);
  near(s.omega * s.omega * 100, G0, 1e-9, 'centripetal = g');
  near(s.rimSpeed, 31.3, 0.1);
});

test('a 90 degree Moon means orbiting about 720 km up, every ~3 h', () => {
  const o = orbitFor(90);
  near(o.radius, MOON_R * Math.SQRT2, 1e-6);
  near(o.altitude, 719.7, 0.5);
  near(o.period / 3600, 3.04, 0.02);
  // and the angle really is 90: 2·asin(R/d)
  near((2 * Math.asin(MOON_R / o.radius) * 180) / Math.PI, 90, 1e-9);
});

test('defaults spin at 1 rpm, a comfortable rate', () => {
  const d = derive(defaults());
  near(d.rpm, 1.0, 0.005);
  assert.equal(comfortFor(d.rpm).level, 0);
});

test('derive: eye-level gravity and the Earth\'s size', () => {
  const d = derive(defaults());
  near(d.gHead, (d.R - 1.7) / d.R, 1e-9);
  near(d.earthAngDeg, 1.9, 0.01);
});

test('comfort bands', () => {
  assert.equal(comfortFor(1.5).level, 0);
  assert.equal(comfortFor(3).level, 1);
  assert.equal(comfortFor(10).level, 3);
});

test('every slider round-trips its default', () => {
  for (const def of PARAMS) {
    const v = fromSlider(def, toSlider(def, def.def));
    const tol = def.kind === 'log' ? def.def * 0.01 : (def.step ?? 0) + 1e-9;
    near(v, def.def, tol, def.key);
  }
});

test('hash round-trip keeps changed values and the view', () => {
  const p = defaults();
  p.diameter = 500; p.gravity = 0.5;
  const { params, view } = fromHash(toHash(p, 'outside'));
  assert.equal(params.diameter, 500);
  assert.equal(params.gravity, 0.5);
  assert.equal(params.width, defaults().width);
  assert.equal(view.mode, 'outside');
  assert.equal(fromHash('#diameter=999999').params.diameter, 4000, 'clamped');
});

test('quality slider shows names', () => {
  assert.equal(format(BY_KEY.quality, 0), 'Low');
  assert.equal(format(BY_KEY.quality, 2), 'High');
});

for (const [name, over] of [['default', {}], ['big', { diameter: 1800, width: 120, deck: 25 }], ['huge', { diameter: 4000, width: 300, deck: 60 }], ['tiny', { diameter: 40, width: 10, deck: 4 }]]) {
  test(`layout (${name}): ribs on piers, trees fit, counts bounded`, () => {
    const L = computeLayout({ ...defaults(), ...over });
    assert.equal(L.sideN, 2 * L.ceilN, 'two side windows per rib bay');
    assert.equal(L.ribN, L.ceilN);
    assert.equal(L.lampN % 2, 0, 'lamps alternate sides evenly round the ring');
    assert.ok(L.trees.length <= 600, `${L.trees.length} trees`);
    assert.equal(L.trees.length, L.treeN * L.treeRows);
    for (const t of L.trees) {
      assert.ok(t.hc + t.ry <= L.H - 0.3 + 1e-9, 'crown below the ceiling');
      assert.ok(t.hc - t.ry >= 0.5, 'crown above the ground');
      assert.ok(Math.abs(t.z) + t.rx <= L.HW, 'crown inside the walls');
      assert.ok(t.species >= 0 && t.species < SPECIES.length);
    }
    // deterministic
    assert.deepEqual(computeLayout({ ...defaults(), ...over }).trees[0], L.trees[0]);
  });
}

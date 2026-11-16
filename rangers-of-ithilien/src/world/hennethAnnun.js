// Henneth Annûn, the Window of the Sunset. The stream crosses a shelf of rock
// and falls into a pool walled in by cliffs; the cave lies behind the fall.
// The terrain function cuts the basin and the gorge (see terrain.js); this
// builds the rock that holds the cave, the stair in the cut, and the water.
// Local coordinates below: X east from the cliff face, Z south from the stream.

import * as THREE from 'three';
import { HA } from './layout.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle, addHollow } from './collision.js';
import { GeoBuilder, rockDisplace, makeNoiseTexture } from './build.js';
import { rng } from '../util/noise.js';
import { STREAM_DEPTH } from './water.js';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _n = new THREE.Vector3(), _col = new THREE.Color();

export function buildHennethAnnun(scene, water) {
  const fx = HA.x, fz = HA.z;
  const topY = heightAt(fx + 6, fz) - 0.1;   // just under the stream bed overhead
  const floorY = HA.caveFloor;
  const ceilY = floorY + 5.5;
  const base = HA.floor - 6;

  // Voids in the rock, in local coordinates.
  const room = { x0: 6, x1: 30, z0: -9, z1: 9 };
  const win = { x0: 0, x1: 6, z0: -5, z1: 5, ceil: floorY + 4.6 };
  const hall = { x0: 0, x1: 10, z0: 11, z1: 14, ceil: floorY + 3 };   // in from the stair
  const turn = { x0: 7, x1: 10, z0: 9, z1: 11, ceil: floorY + 3 };    // and round into the cave
  const R = { x0: 0, x1: 36, z0: -22, z1: 22 };

  const box = (x0, x1, z0, z1, bottom, top, extra) =>
    ({ minX: fx + x0, maxX: fx + x1, minZ: fz + z0, maxZ: fz + z1, bottom, top, ...extra });
  const rock = [
    box(R.x0, R.x1, R.z0, room.z0, base, topY),                 // north
    box(room.x1, R.x1, room.z0, R.z1, base, topY),              // east
    box(R.x0, room.x0, room.z0, win.z0, base, topY),            // piers either side of the window
    box(R.x0, room.x0, win.z1, room.z1, base, topY),
    box(R.x0, turn.x0, room.z1, hall.z0, base, topY),           // between the cave and the hall
    box(turn.x1, room.x1, room.z1, hall.z1, base, topY),
    box(R.x0, room.x1, hall.z1, R.z1, base, topY),              // south
    // floors
    box(room.x0, room.x1, room.z0, room.z1, base, floorY),
    box(win.x0, win.x1, win.z0, win.z1, base, floorY),
    box(hall.x0, hall.x1, hall.z0, hall.z1, base, floorY),
    box(turn.x0, turn.x1, turn.z0, turn.z1, base, floorY),
    // roofs
    box(room.x0, room.x1, room.z0, room.z1, ceilY, topY),
    box(win.x0, win.x1, win.z0, win.z1, win.ceil, topY),
    box(hall.x0, hall.x1, hall.z0, hall.z1, hall.ceil, topY),
    box(turn.x0, turn.x1, turn.z0, turn.z1, turn.ceil, topY),
  ];
  // The stair: a ramp of worn steps along the south wall of the basin, from
  // the floor of the cut up to the hidden door.
  const stairX0 = HA.basin.minX + 3 - fx, stairX1 = -2;
  const stairTop = (x) => HA.floor + (floorY - HA.floor) * Math.min(1, Math.max(0, (x - fx - stairX0) / (stairX1 - stairX0)));
  const stair = [box(stairX0, 0, 10.5, 14.2, base, stairTop, { topMax: floorY })];
  for (const s of [...rock, ...stair]) addSolid(s);
  // Inside the rock the terrain overhead is not the ground.
  addHollow({ minX: fx + R.x0, maxX: fx + R.x1, minZ: fz + R.z0, maxZ: fz + R.z1, ceiling: topY - 0.3 });

  // --- Rock: every solid drawn as a box with its faces roughened. ---
  const rand = rng(77);
  const within = (p, v, pad) => p.x > fx + v.x0 - pad && p.x < fx + v.x1 + pad && p.z > fz + v.z0 - pad && p.z < fz + v.z1 + pad;
  const inside = (p) => p.x > fx + 1.4 && p.y > floorY - 0.6 && p.y < ceilY + 1.2 &&
    (within(p, room, 0.9) || within(p, win, 0.9) || within(p, hall, 0.9) || within(p, turn, 0.9));
  const paintRock = (p, n) => {
    if (inside(p)) return n.y > 0.6 ? 0x6f6657 : n.y < -0.6 ? 0x4a443c : 0x5d554a;
    if (n.y > 0.6) return 0x7c8a5c;
    return p.y < HA.floor + 5 ? 0x6b675c : 0x8d8575; // darker where the spray wets it
  };
  const paintStair = (p, n) => (n.y > 0.5 ? 0xa39a86 : 0x8a8272);

  const builder = new GeoBuilder(5, 0);
  const segs = (len) => Math.max(1, Math.round(len / 2.2));
  const addRock = (s, paint, amp) => {
    const topMax = s.topMax ?? s.top;
    const w = s.maxX - s.minX, h = topMax - s.bottom, d = s.maxZ - s.minZ;
    const geo = new THREE.BoxGeometry(w, h, d, segs(w), segs(h), segs(d)).toNonIndexed();
    const pos = geo.attributes.position;
    const cx = (s.minX + s.maxX) / 2, cy = s.bottom + h / 2, cz = (s.minZ + s.maxZ) / 2;
    const place = (i, out) => {
      out.set(pos.getX(i) + cx, pos.getY(i) + cy, pos.getZ(i) + cz);
      const isTop = Math.abs(out.y - topMax) < 1e-3;
      if (isTop && typeof s.top === 'function') out.y = s.top(out.x, out.z);
      const y = out.y;
      // the cliff face behind the fall is rougher than the walls within
      rockDisplace(out, out.x < fx + 0.01 && amp > 0.3 ? amp * 2 : amp);
      if (isTop) out.y = y; // walkable tops stay true to the collision shape
      return out;
    };
    for (let i = 0; i < pos.count; i += 3) {
      place(i, _a); place(i + 1, _b); place(i + 2, _c);
      _n.copy(_b).sub(_a).cross(_v.copy(_c).sub(_a)).normalize();
      _v.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3);
      _col.set(paint(_v, _n));
      const k = 0.93 + rand() * 0.14;
      for (const p of [_a, _b, _c]) {
        builder.p.push(p.x, p.y, p.z);
        builder.c.push(_col.r * k, _col.g * k, _col.b * k);
      }
    }
  };
  for (const s of rock) addRock(s, paintRock, 0.5);
  for (const s of stair) addRock(s, paintStair, 0.2);
  scene.add(builder.mesh());

  // --- Furnishings of the refuge. ---
  const f = new GeoBuilder(9, 0.06);
  const WOOD = 0x6e5236, DARK_WOOD = 0x4d3a28;
  const tx = fx + 16, tz = fz - 6.5; // table with a map on it
  f.box(3, 0.12, 1.4, tx, floorY + 0.85, tz, WOOD);
  for (const [dx, dz] of [[-1.3, -0.55], [1.3, -0.55], [-1.3, 0.55], [1.3, 0.55]]) f.box(0.14, 0.85, 0.14, tx + dx, floorY, tz + dz, DARK_WOOD);
  f.box(1.3, 0.02, 0.9, tx - 0.3, floorY + 0.97, tz, 0xd9c99a, 0.2);
  f.box(0.5, 0.45, 0.5, tx - 1, floorY, tz + 1.3, DARK_WOOD);
  f.box(0.5, 0.45, 0.5, tx + 0.9, floorY, tz + 1.4, DARK_WOOD, 0.4);
  addSolid({ minX: tx - 1.5, maxX: tx + 1.5, minZ: tz - 0.7, maxZ: tz + 0.7, bottom: floorY, top: floorY + 0.97 });
  for (const [dx, dz, r] of [[28, -7, 0.55], [26.7, -7.4, 0.5], [28.2, -5.6, 0.5]]) { // barrels
    f.cyl(r * 0.9, r, 1.1, fx + dx, floorY, fz + dz, WOOD, 9);
    f.cyl(r * 0.93, r * 0.93, 0.08, fx + dx, floorY + 0.75, fz + dz, 0x3a3530, 9);
    addCircle(fx + dx, fz + dz, r);
  }
  f.box(1.1, 0.8, 1.1, fx + 24.6, floorY, fz - 7.6, DARK_WOOD, 0.2);
  f.box(0.9, 0.6, 0.9, fx + 24.5, floorY + 0.8, fz - 7.5, WOOD, 0.5);
  addCircle(fx + 24.6, fz - 7.6, 0.8);
  for (let i = 0; i < 5; i++) { // bedrolls along the south wall
    f.box(0.8, 0.14, 1.9, fx + 14 + i * 1.5, floorY, fz + 7.4, [0x5c6b45, 0x6b5a45, 0x4f5f6b, 0x6b4f45, 0x5a5a48][i]);
    f.box(0.6, 0.12, 0.4, fx + 14 + i * 1.5, floorY + 0.12, fz + 8, 0xcfc6ae);
  }
  f.cyl(0.9, 0.7, 0.7, fx + 8.2, floorY, fz - 6.4, 0x8f897a, 8); // a stone basin fed by the spray
  f.cyl(0.75, 0.75, 0.06, fx + 8.2, floorY + 0.66, fz - 6.4, 0x6fa3b0, 8);
  addCircle(fx + 8.2, fz - 6.4, 0.9);
  const wx = fx + room.x1 - 0.75; // the white tree on black, on the east wall
  f.box(0.06, 3.4, 2.2, wx, floorY + 1.3, fz, 0x16161a);
  f.box(0.04, 1.5, 0.16, wx - 0.05, floorY + 1.7, fz, 0xf2f0e6);
  for (const [dy, dz, len] of [[2.5, 0.35, 0.8], [2.5, -0.35, 0.8], [3.0, 0.3, 0.7], [3.0, -0.3, 0.7], [3.5, 0, 0.5]]) {
    f.box(0.04, 0.14, len, wx - 0.05, floorY + dy + 0.5, fz + dz, 0xf2f0e6, 0, dz > 0 ? 0.5 : dz < 0 ? -0.5 : 0);
  }
  const torches = [[10, -8.3], [25, -8.3], [14, 8.3], [27.5, 8.3], [5, 13.6]];
  for (const [dx, dz] of torches) f.box(0.12, 0.5, 0.12, fx + dx, floorY + 1.9, fz + dz, 0x3a3028);
  scene.add(f.mesh());

  const flames = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false });
  for (const [dx, dz] of torches) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), flameMat);
    fl.position.set(fx + dx, floorY + 2.6, fz + dz);
    flames.add(fl);
  }
  scene.add(flames);
  const lamp = new THREE.PointLight(0xffb060, 60, 36, 1.5);
  lamp.position.set(fx + 19, floorY + 3.6, fz);
  scene.add(lamp);

  // --- Water: the fall, the pool, the mist. (The stream itself is in water.js.) ---
  const waterY = topY + 0.1 + STREAM_DEPTH;
  const fallX = fx - 1.5;
  const poolY = HA.floor - 0.12;
  scene.add(water.ribbon([fx + 4, waterY, fz, fallX, waterY, fz], 4.5));

  const fallTex = [makeNoiseTexture(128, 21, true), makeNoiseTexture(128, 22, true)];
  const fallH = waterY - poolY + 0.4;
  fallTex.forEach((tex, i) => {
    tex.repeat.set(2 + i, 1.5);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(9 - i * 1.2, fallH, 1, 1),
      new THREE.MeshBasicMaterial({
        color: i ? 0xffffff : 0xd6ecf2, map: tex, transparent: true, opacity: i ? 0.3 : 0.5,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    m.rotation.y = Math.PI / 2;
    m.position.set(fallX - i * 0.5, waterY - fallH / 2 + 0.1, fz);
    m.renderOrder = 3 + i;
    scene.add(m);
  });

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(HA.pool.r + 0.5, 24),
    new THREE.MeshLambertMaterial({ color: 0x6fa7b4, map: water.ripples, transparent: true, opacity: 0.82, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(HA.pool.x, poolY, HA.pool.z);
  pool.renderOrder = 1;
  scene.add(pool);

  const MIST = 48;
  const mistPos = new Float32Array(MIST * 3), mistSeed = [];
  for (let i = 0; i < MIST; i++) mistSeed.push([rand(), rand(), rand()]);
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const ctx = dot.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(dot), size: 5, transparent: true, opacity: 0.16, depthWrite: false, color: 0xffffff,
  }));
  mist.frustumCulled = false;
  mist.renderOrder = 6;
  scene.add(mist);

  // --- Boulders along the rim of the basin and the cut, so the edge is broken
  // and the pool cannot be seen until you stand over it. ---
  const rocks = new GeoBuilder(13, 0.08);
  const rim = (x, z, r) => {
    const y = heightAt(x, z);
    rocks.blob(r, x, y + r * 0.2, z, rand() < 0.4 ? 0x7d8762 : 0x8d8575, 1.2, 0.75, 1, 0);
    addCircle(x, z, r * 0.8);
  };
  const b = HA.basin, edge = b.halfZ + b.wall + 2;
  for (let x = b.minX - 8; x < fx + 4; x += 5.5) {
    if (rand() < 0.75) rim(x + rand() * 2, fz - edge - rand() * 2, 1.6 + rand() * 1.6);
    if (rand() < 0.75) rim(x + rand() * 2, fz + edge + rand() * 2, 1.6 + rand() * 1.6);
  }
  for (let z = fz - edge + 6; z < fz + edge - 5; z += 6) {
    if (Math.abs(z - fz) > HA.gorge.halfTop + 2) rim(b.minX - b.wall - 2.5, z, 1.8 + rand() * 1.4);
  }
  for (let x = 770; x < b.minX - 10; x += 9) {
    for (const s of [-1, 1]) if (rand() < 0.5) rim(x + rand() * 5, fz + s * (HA.gorge.halfTop + 2.5 + rand() * 2), 1.2 + rand() * 1.5);
  }
  for (let i = 0; i < 9; i++) { // fallen rock at the foot of the walls
    const x = b.minX + 2 + rand() * 26, z = fz - b.halfZ + 1.5 + rand() * 2.5;
    rocks.blob(0.8 + rand() * 1.2, x, heightAt(x, z) + 0.2, z, 0x6f6a5e, 1.2, 0.7, 1);
  }
  scene.add(rocks.mesh());

  return {
    floorY,
    faramir: { x: fx + 15.2, z: fz - 4.4, heading: -2.2 },
    eowyn: { x: fx + 8.5, z: fz + 3.2, heading: 1.3 },
    /** True inside the cave or its passages. */
    isInside: (p) => p.x > fx && p.x < fx + R.x1 && Math.abs(p.z - fz) < 22 && p.y < topY - 0.3,
    update(time) {
      fallTex[0].offset.y = time * 0.9;
      fallTex[1].offset.y = time * 1.3;
      for (let i = 0; i < MIST; i++) {
        const s = mistSeed[i];
        const life = (time * (0.12 + s[0] * 0.1) + s[1]) % 1;
        mistPos[i * 3] = fallX - 1 - life * 7 * s[2];
        mistPos[i * 3 + 1] = poolY + 0.4 + life * 5;
        mistPos[i * 3 + 2] = fz + (s[1] - 0.5) * 10 + Math.sin(time + i) * 0.4;
      }
      mistGeo.attributes.position.needsUpdate = true;
      flames.children.forEach((fl, i) => fl.scale.setScalar(0.9 + 0.18 * Math.sin(time * 9 + i * 2.1)));
      lamp.intensity = 60 + 6 * Math.sin(time * 7.3);
    },
  };
}

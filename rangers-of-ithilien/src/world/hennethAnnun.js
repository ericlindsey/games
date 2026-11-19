// Henneth Annûn, the Window of the Sunset. The stream crosses a shelf of rock
// and falls into a pool walled in by cliffs; the cave lies behind the fall.
// The terrain function cuts the basin and the gorge (see terrain.js); this
// builds the rock that holds the cave, the stair in the cut, and the water.
// Local coordinates below: X east from the cliff face, Z south from the stream.

import * as THREE from 'three';
import { HA, gorgeZ, stairTop } from './layout.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle, addHollow } from './collision.js';
import { GeoBuilder, rockDisplace, makeNoiseTexture, materials, SURF } from './build.js';
import { ATLAS, surfaceUniforms, TORCHES } from './surface.js';
const lighten = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
import { addRock, fbm3, noise3 } from './rocks.js';
import { rng } from '../util/noise.js';
import { STREAM_DEPTH, HA_POOL_PAD } from './water.js';

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
  const hall = { x0: 0, x1: 10, z0: 11, z1: 14, ceil: floorY + 3.9 }; // in from the stair (tall enough for the camera)
  const turn = { x0: 7, x1: 10, z0: 9, z1: 11, ceil: floorY + 3.9 };  // and round into the cave
  const R = { x0: 0, x1: 36, z0: -22, z1: 22 };
  // The hidden way up: the hall runs on east as a narrow stair in the rock,
  // climbing to a hole in the forest floor above the cave (HA.hatch).
  const ht = HA.hatch;
  const pass = { x0: hall.x1, x1: ht.exitX - fx, z0: 11.4, z1: hall.z1, hole: ht.x0 - fx };
  const passZ = fz + (pass.z0 + pass.z1) / 2;
  const exitY = heightAt(ht.exitX + 0.5, passZ);
  const passTop = (x) => floorY + (exitY - floorY) * Math.min(1, Math.max(0, (x - fx - pass.x0) / (pass.x1 - pass.x0)));
  let groundHi = -Infinity, groundLo = Infinity; // the forest floor over the stair
  for (let x = fx + pass.x0; x <= fx + pass.x1 + 4; x += 1) {
    for (let z = fz + pass.z0 - 3; z <= fz + pass.z1 + 3; z += 1) { const g = heightAt(x, z); groundHi = Math.max(groundHi, g); groundLo = Math.min(groundLo, g); }
  }
  // the lip of stone round the hole stands a little proud of the ground beside it
  const lip = (z0, z1) => { let h = -Infinity; for (let x = ht.x0; x <= ht.x1; x += 1) for (let z = z0; z <= z1; z += 0.5) h = Math.max(h, heightAt(x, z)); return h + 0.25; };
  // A ledge beside the fall: out of the window's north corner, through a notch in
  // the pier, onto a shelf hanging over the pool.
  const ledge = { x0: -2.6, notch: 1.6, z0: -11, z1: win.z0 };

  const box = (x0, x1, z0, z1, bottom, top, extra) =>
    ({ minX: fx + x0, maxX: fx + x1, minZ: fz + z0, maxZ: fz + z1, bottom, top, ...extra });
  // The top of the rock: just under the forest floor (and under the turf laid
  // over the cliff's slot in terrainMesh.js, whose lip hangs over its edge);
  // never lower than the stream bed over the fall. Well under it away from the
  // cliff, so the finer rock never pokes through the coarser turf.
  const rockTop = (x, z) => Math.max(topY, heightAt(Math.max(x, fx + 0.01), z) - (x < fx + 4.5 ? 0.3 : 1.0));
  const ROCK_TOP_MAX = HA.plateau + 6;
  const top = { topMax: ROCK_TOP_MAX };
  const rock = [
    box(R.x0, R.x1, R.z0, room.z0, base, rockTop, top),                 // north
    box(room.x1, R.x1, room.z0, pass.z0, base, rockTop, top),           // east, either side of the stair
    box(room.x1, R.x1, pass.z1, R.z1, base, rockTop, top),
    box(pass.x1, R.x1, pass.z0, pass.z1, base, rockTop, top),
    box(ledge.notch, room.x0, room.z0, win.z0, base, rockTop, top),     // piers either side of the window (the north one notched for the ledge)
    box(R.x0, room.x0, win.z1, room.z1, base, rockTop, top),
    box(R.x0, turn.x0, room.z1, hall.z0, base, rockTop, top),           // between the cave and the hall
    box(turn.x1, room.x1, room.z1, pass.z0, base, rockTop, top),        // between the cave and the stair
    box(R.x0, room.x1, hall.z1, R.z1, base, rockTop, top),              // south
    // floors
    box(room.x0, room.x1, room.z0, room.z1, base, floorY),
    box(win.x0, win.x1, win.z0, win.z1, base, floorY),
    box(hall.x0, hall.x1, hall.z0, hall.z1, base, floorY),
    box(turn.x0, turn.x1, turn.z0, turn.z1, base, floorY),
    // roofs
    box(room.x0, room.x1, room.z0, room.z1, ceilY, rockTop, top),
    box(win.x0, win.x1, win.z0, win.z1, win.ceil, rockTop, top),
    box(hall.x0, hall.x1, hall.z0, hall.z1, hall.ceil, rockTop, top),
    box(turn.x0, turn.x1, turn.z0, turn.z1, turn.ceil, rockTop, top),
    // the stair's walls, carried up from the top of the rock to just under the
    // forest floor, and as a lip of stone round the hole
    box(pass.x0, pass.hole, pass.z0 - 2, pass.z0, topY, groundLo - 0.15),
    box(pass.x0, pass.hole, pass.z1, pass.z1 + 2, topY, groundLo - 0.15),
    box(pass.hole, pass.x1, ht.z0 - fz, pass.z0, topY, lip(ht.z0, fz + pass.z0)),
    box(pass.hole, pass.x1, pass.z1, pass.z1 + 1.2, topY, lip(fz + pass.z1, fz + pass.z1 + 1.2)),
    box(pass.hole - 1.2, pass.hole, ht.z0 - fz, pass.z1 + 1.2, passTop(fx + pass.hole) + 2.4, lip(ht.z0, fz + pass.z1 + 1.2)),
  ];
  // its stepped roof, until it opens to the sky
  for (let x = pass.x0; x < pass.hole - 1.2; x += 1) {
    const x1 = Math.min(x + 1, pass.hole - 1.2), under = passTop(fx + x1) + 3.4;
    if (under < groundLo - 0.6) rock.push(box(x, x1, pass.z0, pass.z1, under, groundLo - 0.15));
  }
  // The stair: a ramp of worn steps along the foot of the south wall of the
  // basin, from the floor beside the pool up to the hidden door. The wall comes
  // in to meet it (terrain.js), and its outer edge runs on a little under the wall.
  const stairX0 = HA.stair.x0 - fx, stairX1 = HA.stair.x1 - fx, stairZ0 = HA.stair.z0, stairZ1 = HA.stair.z1;
  const stair = [
    box(stairX0, 0, stairZ0, stairZ1 + 0.3, base, stairTop, { topMax: floorY }),
    box(pass.x0, pass.x1, pass.z0, pass.z1, base, passTop, { topMax: exitY }),   // and the flight in the rock
    // the ledge, with a low parapet
    box(ledge.x0, ledge.notch, -9, ledge.z1, floorY - 1.4, floorY),
    box(ledge.x0, 0, ledge.z0, -9, floorY - 1.4, floorY),
    box(ledge.x0, ledge.x0 + 0.45, ledge.z0, ledge.z1, floorY - 1.4, floorY + 0.95),
    box(ledge.x0, 0, ledge.z0 - 0.4, ledge.z0, floorY - 1.4, floorY + 0.95),
    box(ledge.x0, -0.5, ledge.z1, ledge.z1 + 0.35, floorY - 1.4, floorY + 0.95),
  ];
  for (const s of [...rock, ...stair]) addSolid(s);
  // Inside the rock the terrain overhead is not the ground; nor along the stair, all the way up.
  addHollow({ minX: fx + R.x0, maxX: fx + R.x1, minZ: fz + R.z0, maxZ: fz + R.z1, ceiling: topY - 0.3 });
  addHollow({ minX: fx + pass.x0, maxX: fx + pass.x1, minZ: fz + pass.z0, maxZ: fz + pass.z1, ceiling: groundHi + 2 });
  const inPassage = (p) => p.x > fx + pass.x0 - 0.5 && p.x < fx + pass.x1 && p.z > fz + pass.z0 - 0.9 && p.z < fz + pass.z1 + 0.9 && p.y < passTop(p.x) + 3;

  // --- Rock: every solid drawn as a box with its faces roughened. ---
  const rand = rng(77);
  // Torches on the walls, all burning at once. Each lights what is round it
  // (the torchlight in surface.js, which every surface and figure takes); a
  // little of their warmth is also laid into the colour of the rock near them.
  const torches = [[10, -8.3], [25, -8.3], [14, 8.3], [27.5, 8.3], [5, 13.6], [13, 13.75]];
  if (torches.length !== TORCHES) throw new Error('the torchlight is reckoned for ' + TORCHES + ' torches');
  const torchPts = torches.map(([dx, dz]) => new THREE.Vector3(fx + dx, floorY + 2.55, fz + dz));
  // where each torch's light comes from: a little off the wall, into the room
  const lightPts = torchPts.map((t) => new THREE.Vector3(t.x + (t.x < fx + 6 ? 0.6 : 0), t.y - 0.1, t.z - Math.sign(t.z - fz) * 0.6));
  const warm = new THREE.Color(1.0, 0.62, 0.3);
  const bakeTorchlight = (b) => {
    for (let i = 0; i < b.p.length; i += 3) {
      const x = b.p[i], y = b.p[i + 1], z = b.p[i + 2];
      if (x < fx - 1 || x > fx + R.x1 || Math.abs(z - fz) > 22 || y < floorY - 1 || y > ceilY + 2) continue;
      let glow = 0;
      for (const t of torchPts) { const d2 = (x - t.x) ** 2 + (y - t.y) ** 2 + (z - t.z) ** 2; glow += 0.8 / (1 + d2 / 4); }
      glow = Math.min(1.1, glow);
      b.c[i] *= 1 + glow * warm.r; b.c[i + 1] *= 1 + glow * warm.g; b.c[i + 2] *= 1 + glow * warm.b;
    }
  };
  const within = (p, v, pad) => p.x > fx + v.x0 - pad && p.x < fx + v.x1 + pad && p.z > fz + v.z0 - pad && p.z < fz + v.z1 + pad;
  const inside = (p) => inPassage(p) || (p.x > fx + 1.4 && p.y > floorY - 0.6 && p.y < ceilY + 1.2 &&
    (within(p, room, 0.9) || within(p, win, 0.9) || within(p, hall, 0.9) || within(p, turn, 0.9)));
  const paintRock = (p, n) => {
    if (n.y > 0.6 && p.y > topY - 0.2 && p.x > ht.x0 - 2.5 && p.x < ht.x1 + 2.5 && p.z > ht.z0 - 2.5 && p.z < ht.z1 + 2.5) return 0x8a8470; // the lip round the hole
    if (inside(p)) return n.y > 0.6 ? 0x6f6657 : n.y < -0.6 ? 0x4a443c : 0x5d554a;
    if (n.y > 0.6) return p.y > topY + 0.5 ? 0x6f8a4a : 0x7c8a5c;
    return p.y < HA.floor + 5 ? 0x6b675c : 0x8d8575; // darker where the spray wets it
  };
  const paintStair = (p, n) => (n.y > 0.5 ? 0x857f70 : 0x777164); // cut from the same rock, worn paler on the treads

  const builder = new GeoBuilder(5, 0);
  builder.kind = SURF.rock;
  const segs = (len) => Math.max(1, Math.round(len / 0.85));
  // Rough the rock in layers: a smooth field, finer grain on top of it, and
  // bedding planes that step the face in and out every couple of metres.
  const cliffDisplace = (v, amp) => {
    rockDisplace(v, amp);
    if (amp < 0.3) return v;
    const f = fbm3(v.x * 0.35, v.y * 0.35, v.z * 0.35, 3, 41) * amp * 0.7;
    const bed = Math.pow(0.5 + 0.5 * Math.sin((v.y + noise3(v.x * 0.08, 0, v.z * 0.08, 5) * 5) * 2.3), 6) * amp * 0.25;
    v.x += f - bed; v.z += f * 0.8 - bed * 0.6; v.y += f * 0.3;
    return v;
  };
  // (not addRock: that name is the boulder builder from rocks.js, used below)
  const addBlock = (s, paint, amp) => {
    const topMax = s.topMax ?? s.top;
    const w = s.maxX - s.minX, h = topMax - s.bottom, d = s.maxZ - s.minZ;
    const geo = new THREE.BoxGeometry(w, h, d, segs(w), segs(h), segs(d)).toNonIndexed();
    const pos = geo.attributes.position;
    const cx = (s.minX + s.maxX) / 2, cy = s.bottom + h / 2, cz = (s.minZ + s.maxZ) / 2;
    const place = (i, out) => {
      out.set(pos.getX(i) + cx, pos.getY(i) + cy, pos.getZ(i) + cz);
      const isTop = Math.abs(out.y - topMax) < 1e-3;
      // A sloping top squeezes the whole column beneath it, sides included.
      // (Moving only the top row leaves the side faces standing to full height
      // as a shell that looks like a wall but stops nothing.)
      if (typeof s.top === 'function') out.y = s.bottom + (out.y - s.bottom) * ((s.top(out.x, out.z) - s.bottom) / h);
      const y = out.y;
      // The cliff face behind the fall is rougher than the walls within, but not
      // around the door and the stair, where what you see must match what stops you.
      const byLedge = out.x < fx + ledge.notch + 0.01 && out.z > fz + ledge.z0 - 1.5 && out.z < fz + ledge.z1 + 0.5 && out.y < floorY + 3;
      cliffDisplace(out, byLedge ? 0.1 : out.x < fx + 0.01 && out.z < fz + 8 && amp > 0.3 ? amp * 2 : amp > 0.3 && out.x < fx + 0.01 ? 0.12 : amp);
      if (isTop) out.y = y; // walkable tops stay true to the collision shape
      return out;
    };
    for (let i = 0; i < pos.count; i += 3) {
      place(i, _a); place(i + 1, _b); place(i + 2, _c);
      _n.copy(_b).sub(_a).cross(_v.copy(_c).sub(_a)).normalize();
      _v.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3);
      _col.set(paint(_v, _n));
      const k = 0.93 + rand() * 0.14;
      const was = builder.kind;
      if (was === SURF.rock && inside(_v)) builder.kind = SURF.cave; // no moss in the cave
      for (const p of [_a, _b, _c]) builder._push(p.x, p.y, p.z, _n.x, _n.y, _n.z, _col.r * k, _col.g * k, _col.b * k, 0.875, 0.5);
      builder.kind = was;
    }
  };
  for (const s of rock) addBlock(s, paintRock, 0.5);
  builder.kind = SURF.cave; // the stair and the ledge: bare cut rock, no moss
  for (const s of stair) addBlock(s, paintStair, 0.08);
  // Treads, so the two flights read as stairs.
  const treads = new GeoBuilder(21, 0.08);
  treads.kind = SURF.cave;
  for (let x = stairX0 + 0.6; x < stairX1; x += 0.9) treads.box(0.5, 0.13, stairZ1 - stairZ0 - 0.2, fx + x, stairTop(fx + x) - 0.02, fz + (stairZ0 + stairZ1) / 2, 0x8f897a, (rand() - 0.5) * 0.06);
  for (let x = pass.x0 + 0.5; x < pass.x1; x += 0.8) treads.box(0.45, 0.12, pass.z1 - pass.z0 - 0.2, fx + x, passTop(fx + x) - 0.02, passZ, 0x857f70, (rand() - 0.5) * 0.06);
  bakeTorchlight(treads);
  bakeTorchlight(builder);
  scene.add(treads.mesh(materials.rock));
  scene.add(builder.mesh(materials.rock));
  scene.add(cliffSkins(rand));

  // --- Furnishings of the refuge. ---
  const f = new GeoBuilder(9, 0.06);
  f.kind = SURF.wood;
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
  for (const [dx, dz] of torches) { // a bracket and a wrapped head on each torch
    f.box(0.12, 0.5, 0.12, fx + dx, floorY + 1.9, fz + dz, 0x3a3028);
    f.box(0.18, 0.12, 0.18, fx + dx, floorY + 2.35, fz + dz, 0x2a2018);
  }
  bakeTorchlight(f);
  scene.add(f.mesh());

  const flames = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false });
  for (const [dx, dz] of torches) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), flameMat);
    fl.position.set(fx + dx, floorY + 2.6, fz + dz);
    flames.add(fl);
  }
  scene.add(flames);
  const caveMid = new THREE.Vector3(fx + 16, floorY + 2, fz);

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

  const pool = new THREE.Mesh( // an oval, running in under the cliff: the fall drops into it
    new THREE.CircleGeometry(1, 40),
    water.rippledMaterial(fx - 1.9, fz),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(HA.pool.rx + HA_POOL_PAD, HA.pool.rz + HA_POOL_PAD, 1);
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
  let rockSeed = 300;
  const rim = (x, z, r) => {
    const y = Math.min(heightAt(x, z), heightAt(x + r * 0.6, z), heightAt(x - r * 0.6, z), heightAt(x, z + r * 0.6), heightAt(x, z - r * 0.6));
    addRock(rocks, x, y - 0.3, z, r * 2.3, rand() < 0.4 ? 0x868a72 : 0x8d8575, rockSeed++, { detail: 3, sy: 0.55 + rand() * 0.25, sx: 1.2, cuts: 7, strata: rand() });
    addCircle(x, z, r * 0.95);
  };
  const b = HA.basin, edge = b.halfZ + b.wall + 2;
  for (let x = b.minX - 8; x < fx + 4; x += 5.5) {
    if (rand() < 0.75) rim(x + rand() * 2, fz - edge - rand() * 2, 1.6 + rand() * 1.6);
    if (rand() < 0.75) rim(x + rand() * 2, fz + edge + 5 + rand() * 2, 1.6 + rand() * 1.6);
  }
  for (let z = fz - edge + 6; z < fz + edge - 5; z += 6) {
    if (Math.abs(z - fz) > HA.gorge.halfTop + 2) rim(b.minX - b.wall - 2.5, z, 1.8 + rand() * 1.4);
  }
  for (let x = HA.gorge.endX + 45; x < b.minX - 10; x += 9) {
    for (const s of [-1, 1]) if (rand() < 0.5) rim(x + rand() * 5, gorgeZ(x) + s * (HA.gorge.halfTop + 2.5 + rand() * 2), 1.2 + rand() * 1.5);
  }
  for (let i = 0; i < 14; i++) { // fallen rock at the foot of the walls
    const x = b.minX + 2 + rand() * 26, z = fz - b.halfZ + 1.2 + rand() * 2.5;
    addRock(rocks, x, heightAt(x, z) - 0.15, z, 1.0 + rand() * 1.8, 0x6f6a5e, rockSeed++, { detail: 2, sy: 0.6, cuts: 6 });
  }
  // Boulders and stones all round the pool, of the same grey, mossy stone as
  // those in the woods: big ones with smaller ones fallen beside them, some
  // standing in the shallows; clear of where the fall strikes, of the foot of
  // the stair, and of the way out down the cut.
  const pr = rng(9091), P = HA.pool, st = HA.stair;
  const STONE = [0x8a867c, 0x8f8a7e, 0x8d8879, 0x7f7c6c, 0x86827a];
  const placed = [];
  const keepClear = (x, z, r) =>
    (x > fx - 5 && Math.abs(z - fz) < 4.5 + r) ||                       // where the fall strikes
    (x < st.x0 + 6 && z > fz + st.z0 - 3.5 - r) ||                       // the foot of the stair
    (x < P.x - P.rx + 3 && z > fz - 3.5 - r && z < fz + 5 + r) ||        // the way out down the cut
    z > fz + st.z0 - 0.15 - r * 0.45 ||                                   // the stair itself (stones may lean on its side)
    x < b.minX + 0.6 + r * 0.4 || z < fz - b.halfZ - 0.6 + r * 0.3 || x > fx - r * 0.3 ||
    placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < (q[2] + r) * 0.42);
  const stone = (x, z, size, o) => {
    if (keepClear(x, z, size * 0.5)) return false;
    placed.push([x, z, size]);
    const lo = Math.min(heightAt(x, z), heightAt(x + size * 0.3, z), heightAt(x - size * 0.3, z), heightAt(x, z + size * 0.3), heightAt(x, z - size * 0.3));
    addRock(rocks, x, lo - size * 0.08, z, size, STONE[Math.floor(pr() * STONE.length)], rockSeed++, { detail: size > 2.2 ? 3 : size > 0.8 ? 2 : 1, sy: 0.5 + pr() * 0.35, sx: 0.8 + pr() * 0.4, cuts: 6 + Math.floor(pr() * 3), strata: pr() < 0.4 ? pr() : 0, flatTop: pr() < 0.3, ...o });
    if (size > 1.1) addCircle(x, z, size * 0.36);
    return true;
  };
  for (let i = 0; i < 150; i++) { // round the shore, from the shallows out to the walls
    const a = pr() * Math.PI * 2, q = 0.74 + pr() * 0.6;
    const x = P.x + Math.cos(a) * P.rx * q, z = P.z + Math.sin(a) * P.rz * q;
    const big = pr() < 0.45, size = big ? 2.0 + pr() * 2.4 : 0.6 + pr() * 1.3;
    if (stone(x, z, size) && big) { // and smaller ones fallen beside the big ones
      for (let k = 0; k < 3; k++) {
        const b2 = pr() * 6.283, d = size * (0.55 + pr() * 0.4);
        stone(x + Math.cos(b2) * d, z + Math.sin(b2) * d, size * (0.25 + pr() * 0.3));
      }
    }
  }
  for (let i = 0; i < 70; i++) { // pebbles and cobbles along the water's edge
    const a = pr() * Math.PI * 2, q = 0.9 + pr() * 0.25;
    stone(P.x + Math.cos(a) * P.rx * q, P.z + Math.sin(a) * P.rz * q, 0.2 + pr() * 0.35, { detail: 1, cuts: 4 });
  }
  for (let x = HA.gorge.endX + 30; x < b.minX - 6; x += 7 + rand() * 9) { // and blocks fallen into the cut, against its walls
    const side = rand() < 0.5 ? -1 : 1, sz = 0.9 + rand() * 1.5;
    const z = gorgeZ(x) + side * (HA.gorge.halfFloor - 0.35);
    addRock(rocks, x, heightAt(x, z) - 0.25, z, sz, 0x787266, rockSeed++, { detail: 2, sy: 0.6 + rand() * 0.3, cuts: 7, strata: rand() });
    addCircle(x, z, sz * 0.33);
  }
  for (let i = 0; i < 30; i++) { // and scree all along the foot of the cut
    const x = HA.gorge.endX + 40 + rand() * (b.minX - HA.gorge.endX - 40), side = rand() < 0.5 ? -1 : 1;
    const z = gorgeZ(x) + side * (HA.gorge.halfFloor - 0.2 - rand() * 0.6);
    addRock(rocks, x, heightAt(x, z) - 0.1, z, 0.4 + rand() * 0.9, 0x7a7466, rockSeed++, { detail: 1, sy: 0.6, cuts: 5 });
  }
  // outcrops on the shelf above, grey and mossed, so the rock shows through the turf
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = 26 + rand() * 40;
    const x = fx - 8 + Math.cos(a) * d * 0.9, z = fz + Math.sin(a) * d;
    if (x > b.minX - b.wall - 8 && x < fx + 40 && Math.abs(z - fz) < b.halfZ + b.wall + 9) continue; // not over the basin or the cave
    if (x < b.minX - 4 && Math.abs(z - gorgeZ(x)) < HA.gorge.halfTop + 7) continue;            // nor the cut
    if (x > ht.x0 - 6 && x < ht.x1 + 6 && z > ht.z0 - 6 && z < ht.z1 + 6) continue;          // nor the hidden way
    const y = heightAt(x, z), sz = 1.8 + rand() * 3.2;
    if (y < HA.plateau - 6) continue;
    addRock(rocks, x, y - sz * 0.22, z, sz, rand() < 0.5 ? 0x8a8a76 : 0x928b7a, rockSeed++, { detail: 2, sy: 0.45 + rand() * 0.2, sx: 1.3, cuts: 7, strata: 0.8, flatTop: rand() < 0.5 });
    addCircle(x, z, sz * 0.42);
  }
  scene.add(rocks.mesh(materials.rock));

  // Bushes crowd the hole where the hidden stair comes up, so it is seen only close to.
  const bush = new GeoBuilder(17, 0.12);
  const shrub = (x, z, r) => {
    const y = heightAt(x, z);
    for (let i = 0; i < 4; i++) {
      const a = rand() * 6.3, d = r * 0.45 * rand();
      bush.blob(r * (0.6 + rand() * 0.35), x + Math.cos(a) * d, y + r * (0.35 + rand() * 0.3), z + Math.sin(a) * d, [0x3f5a2e, 0x4a6634, 0x557040][i % 3], 1.15, 0.85, 1.1, 1);
    }
  };
  shrub(ht.x0 + 2.2, ht.z0 - 0.4, 2.1);
  shrub(ht.x0 - 1.2, ht.z1 - 0.6, 1.8);
  shrub(ht.x0 + 5.2, ht.z0 - 1.6, 1.4);
  shrub(ht.x1 - 1.5, ht.z1 + 1.8, 1.3);
  scene.add(bush.mesh());

  return {
    floorY,
    faramir: { x: fx + 15.2, z: fz - 4.4, heading: -2.2 },
    eowyn: { x: fx + 8.5, z: fz + 3.2, heading: 1.3 },
    mablung: { x: fx + 25.4, z: fz - 4.6, heading: -1.9 },
    /** The bedrolls along the south wall, where a ranger may rest. */
    beds: [0, 1, 2, 3, 4].map((i) => ({ x: fx + 14 + i * 1.5, z: fz + 7.4 })),
    /** True inside the cave or its passages. */
    /** The upper flight: from the landing by the cave door up to the forest. */
    /** The hidden stair: from the hall, east and up through the rock to the hole in the forest floor. */
    hiddenStair: { startX: fx + pass.x0 - 2, z: passZ, exitX: ht.exitX, exitY },
    /** The boulders and stones round the pool: { x, z, size }. */
    stones: placed.map(([x, z, size]) => ({ x, z, size })),
    /** How the cave's torchlight stands: how strongly it is on here, and how many torches burn. */
    torchlight: () => ({ on: surfaceUniforms.uTorchOn.value, burning: surfaceUniforms.uTorchI.value.filter((v) => v > 0).length, of: TORCHES }),
    /** The ledge beside the fall, looking out over the pool. */
    ledge: { x: fx + (ledge.x0 + 0.45) / 2, z: fz + (ledge.z0 + ledge.z1) / 2 },
    isInside: (p) => inPassage(p) || (p.x > fx && p.x < fx + R.x1 && Math.abs(p.z - fz) < 22 && p.y < topY - 0.3),
    update(time, who, camera) {
      // Torchlight, near the cave only: each torch flickers on its own.
      const tu = surfaceUniforms;
      const on = camera ? 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(caveMid), 45, 60) : 0;
      tu.uTorchOn.value = on;
      if (on > 0) {
        lightPts.forEach((p, i) => {
          tu.uTorchView.value[i].copy(p).applyMatrix4(camera.matrixWorldInverse);
          tu.uTorchI.value[i] = 24 * (1 + 0.12 * Math.sin(time * 7.3 + i * 1.7) + 0.08 * Math.sin(time * 13.1 + i * 2.9));
        });
      }
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
    },
  };
}

/**
 * The walls of the basin and of the cut are steep terrain; the terrain mesh is
 * too coarse to show them as rock. Over each wall lies a skin of stone that
 * follows the wall's own profile, sampled up its height rather than across the
 * ground, and stands a little proud of it in ledges and bulges (never at the
 * foot, where the ranger walks).
 * A wall is given by stations along it: each a point at the foot (fx, fz) and
 * a horizontal direction (dx, dz) pointing from the open floor into the rock.
 */
function cliffSkins(rand) {
  const b = new GeoBuilder(77, 0);
  b.kind = SURF.rock;
  const pos = [], nor = [], col = [], idx = [];
  const wet = new THREE.Color(0x5f5b52), dry = new THREE.Color(0x8e877a), pale = new THREE.Color(0xa29a8a), c = new THREE.Color();
  const wall = (stations, seed) => {
    const rows = [];
    let width = 0;
    stations.forEach((st, si) => {
      const u = si * 0.8 + seed * 50;
      // walk into the rock to find the top of the wall
      // (where people walk on a stair beside the wall, the skin starts at its treads)
      const y0 = st.walk === undefined ? heightAt(st.x, st.z) : Math.max(heightAt(st.x, st.z), st.walk - 0.25);
      const clear = st.walk === undefined ? 0.6 : st.walk - y0 + 2.1;
      let top = y0, reach = 0;
      for (let d = 0.5; d <= st.span; d += 0.5) {
        const h = heightAt(st.x + st.dx * d, st.z + st.dz * d);
        if (h > top) { top = h; reach = d; }
      }
      const depth = top - y0;
      const levels = [];
      if (depth > 1.5) {
        const n = Math.max(2, Math.round(depth / 0.65));
        for (let k = 0; k <= n; k++) {
          const y = y0 - 0.4 + (depth + 0.35) * (k / n);
          // where the terrain reaches this height along the section
          let lo = 0, hi = reach;
          for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (heightAt(st.x + st.dx * m, st.z + st.dz * m) < y) lo = m; else hi = m; }
          const t = k / n, above = y - y0;
          const ramp = Math.min(1, Math.max(0, (above - clear) / 2.2)) * Math.min(1, Math.max(0, (top - y) / 1.2));
          const px = st.x + st.dx * lo, pz = st.z + st.dz * lo;
          const n1 = fbm3(px * 0.22, y * 0.22, pz * 0.22, 3, seed);
          const fine = fbm3(px * 1.3, y * 1.3, pz * 1.3, 2, seed + 5);
          const bed = Math.pow(0.5 + 0.5 * Math.sin((y + noise3(u * 0.05, 0, 0, seed + 3) * 7) * 2.1), 8);
          // blocks: the face breaks along joints into slabs standing out by different amounts
          const q = noise3(u * 0.32, y * 0.14, 0.5, seed + 11) * 1.6;
          const step = Math.floor(q) + Math.min(1, Math.max(0, (q - Math.floor(q) - 0.8) * 5));
          const out = ramp * (0.4 + 0.65 * (n1 + 0.5) + 0.2 * step + 0.25 * bed + 0.18 * fine);
          const jx = noise3(px * 0.7, y * 0.7, pz * 0.7, seed + 7) * 0.18 * ramp;
          levels.push([px - st.dx * out + jx, y + noise3(px * 0.5, y * 0.5, pz * 0.5, seed + 9) * 0.15 * ramp, pz - st.dz * out + jx, t, above]);
        }
      }
      rows.push(levels);
      width = Math.max(width, levels.length);
    });
    // stitch neighbouring stations (each may have its own count of levels)
    for (let i = 0; i < rows.length - 1; i++) {
      const A = rows[i], B = rows[i + 1];
      if (A.length < 2 || B.length < 2) continue;
      const base = pos.length / 3;
      const n = Math.max(A.length, B.length);
      const pick = (L, k) => L[Math.min(L.length - 1, Math.round(k * (L.length - 1) / (n - 1)))];
      for (let k = 0; k < n; k++) {
        for (const L of [A, B]) {
          const [x, y, z, t, above] = pick(L, k);
          pos.push(x, y, z);
          c.copy(above < 3 ? wet : dry).lerp(pale, Math.max(0, Math.min(1, (t - 0.55) * 1.6)) * 0.5);
          const k2 = 0.9 + rand() * 0.18;
          col.push(c.r * k2, c.g * k2, c.b * k2);
        }
      }
      for (let k = 0; k < n - 1; k++) {
        const a = base + k * 2, bb = a + 1, cc = a + 2, d = a + 3;
        idx.push(a, cc, bb, bb, cc, d);
      }
    }
  };
  const g = HA.gorge, B = HA.basin;
  // the basin: north and south walls, and the west wall either side of the cut
  const north = [], south = [], westN = [], westS = [];
  for (let x = B.minX - 3; x <= HA.x + 0.5; x += 0.8) {
    north.push({ x, z: HA.z - B.halfZ + 0.5, dx: 0, dz: -1, span: B.wall + 3 });
    // the south wall rises from the stair's outer edge: from the treads up it is
    // flush with the stair, standing proud only above head height
    const onStair = x > HA.stair.x0 - 0.5;
    south.push({ x, z: HA.z + HA.stair.z1 - 0.3, dx: 0, dz: 1, span: B.wall + 4, walk: onStair ? stairTop(x) : undefined });
  }
  for (let z = HA.z - B.halfZ - 2; z <= HA.z - g.halfTop - 1; z += 0.8) westN.push({ x: B.minX + 0.5, z, dx: -1, dz: 0, span: B.wall + 3 });
  for (let z = HA.z + g.halfTop + 1; z <= HA.z + HA.stair.z1 + 2; z += 0.8) westS.push({ x: B.minX + 0.5, z, dx: -1, dz: 0, span: B.wall + 3 });
  wall(north, 1); wall(south, 2); wall(westN, 3); wall(westS, 4);
  // the cut, both sides, down to where it opens out
  const cutN = [], cutS = [];
  for (let x = B.minX + 2; x >= g.endX - 30; x -= 0.9) {
    const zc = gorgeZ(x);
    cutN.push({ x, z: zc - g.halfFloor + 0.3, dx: 0, dz: -1, span: g.halfTop - g.halfFloor + 3 });
    cutS.push({ x, z: zc + g.halfFloor - 0.3, dx: 0, dz: 1, span: g.halfTop - g.halfFloor + 3 });
  }
  wall(cutN.reverse(), 5); wall(cutS, 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('surf', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(SURF.rock), 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materials.rockDouble);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Ferns and tufts take hold on the ledges; ivy hangs down the faces.
  const gn = geo.attributes.normal, plants = new GeoBuilder(78, 0.15), pr = rng(4242);
  const greens = [0x4f8f3f, 0x5a9a48, 0x6f9e42, 0x3f7a34];
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], nx = gn.getX(i), ny = gn.getY(i), nz = gn.getZ(i);
    if (y < HA.floor + 1.2) continue;
    const roll = pr();
    if (ny > 0.45 && roll < 0.1) { // a ledge
      const s = 0.35 + pr() * 0.5, c = greens[Math.floor(pr() * 4)];
      plants.smooth = true;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + pr(), ca = Math.cos(a), sa = Math.sin(a);
        plants.tri(x - sa * 0.04, y, z + ca * 0.04, x + sa * 0.04, y, z - ca * 0.04, x + ca * s * 0.7, y + s * (0.5 + pr() * 0.5), z + sa * s * 0.7, c);
      }
      plants.smooth = false;
      if (pr() < 0.5) plants.card(x + nx * 0.1, y + s * 0.3, z + nz * 0.1, s * 1.6, s * 1.4, nx, 1, nz, lighten(c, 1.2), ATLAS.broad, pr() * 6, [nx, 1, nz]);
    } else if (Math.abs(ny) < 0.35 && roll < 0.008) { // a curtain of ivy down the face
      const len = 1.2 + pr() * 2.6, wd = 0.8 + pr() * 1.2;
      plants.card(x + nx * 0.12, y - len / 2, z + nz * 0.12, wd, len, nx, 0, nz, lighten(0x4f7a34, 0.9 + pr() * 0.3), ATLAS.ivy, (pr() - 0.5) * 0.4, [nx, 0.4, nz]);
    }
  }
  const group = new THREE.Group();
  // (not the swaying plant material: that sways by height above the mesh's
  // origin, which for these, built where they grow, is the whole cliff)
  group.add(mesh, plants.mesh(materials.still, false));
  void b;
  return group;
}

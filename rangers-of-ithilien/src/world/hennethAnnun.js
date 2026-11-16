// Henneth Annûn, the Window of the Sunset: a rock mass holding a cave, with the
// stream falling past its western window into a pool. A hand-built set piece,
// because a height field cannot make a cave.

import * as THREE from 'three';
import { HA } from './layout.js';
import { heightAt } from './terrain.js';
import { addSolid, addCircle } from './collision.js';
import { GeoBuilder, rockDisplace, makeNoiseTexture, materials } from './build.js';
import { rng } from '../util/noise.js';
import { STREAM_DEPTH } from './water.js';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _n = new THREE.Vector3(), _col = new THREE.Color();

export function buildHennethAnnun(scene, water) {
  const o = HA.outcrop;
  const topY = heightAt(o.maxX + 4, HA.z);   // the stream bed on the upper level
  const floorY = topY - 8.5;
  const ceilY = topY - 3;
  const base = HA.lowLevel - 14;

  const room = { minX: 1576, maxX: 1600, minZ: 1891, maxZ: 1909 };
  const win = { minX: o.minX, maxX: room.minX, minZ: 1895, maxZ: 1905, ceil: floorY + 4.6 };
  const door = { minX: 1588, maxX: 1592, minZ: room.maxZ, maxZ: o.maxZ, ceil: floorY + 3 };
  const ramp = { minX: 1552, maxX: 1586, minZ: o.maxZ, maxZ: o.maxZ + 4 };
  const rampFoot = heightAt(ramp.minX, ramp.minZ + 2) - 0.25;
  const rampTop = (x) => rampFoot + (floorY - rampFoot) * Math.min(1, Math.max(0, (x - ramp.minX) / (ramp.maxX - ramp.minX)));

  const box = (minX, maxX, minZ, maxZ, bottom, top, extra) => ({ minX, maxX, minZ, maxZ, bottom, top, ...extra });
  const rock = [
    // walls, from deep underground to the top of the outcrop
    box(o.minX, o.maxX, o.minZ, room.minZ, base, topY),
    box(o.minX, door.minX, room.maxZ, o.maxZ, base, topY),
    box(door.maxX, o.maxX, room.maxZ, o.maxZ, base, topY),
    box(room.maxX, o.maxX, room.minZ, room.maxZ, base, topY),
    box(o.minX, room.minX, room.minZ, win.minZ, base, topY),
    box(o.minX, room.minX, win.maxZ, room.maxZ, base, topY),
    // floors
    box(room.minX, room.maxX, room.minZ, room.maxZ, base, floorY),
    box(win.minX, win.maxX, win.minZ, win.maxZ, base, floorY),
    box(door.minX, door.maxX, door.minZ, door.maxZ, base, floorY),
    // roofs
    box(room.minX, room.maxX, room.minZ, room.maxZ, ceilY, topY),
    box(win.minX, win.maxX, win.minZ, win.maxZ, win.ceil, topY),
    box(door.minX, door.maxX, door.minZ, door.maxZ, door.ceil, topY),
  ];
  const stair = [
    box(ramp.minX, ramp.maxX, ramp.minZ, ramp.maxZ, base, (x) => rampTop(x), { topMax: floorY }),
    box(ramp.maxX, door.maxX + 2, ramp.minZ, ramp.maxZ, base, floorY),
  ];
  for (const s of [...rock, ...stair]) addSolid(s);

  // --- Rock: every solid drawn as a box with its faces roughened. ---
  const rand = rng(77);
  const inside = (p) =>
    p.y > floorY - 0.6 && p.y < ceilY + 1.2 &&
    ((p.x > room.minX - 0.9 && p.x < room.maxX + 0.9 && p.z > room.minZ - 0.9 && p.z < room.maxZ + 0.9) ||
     (p.x > win.minX + 1.5 && p.x < win.maxX + 1 && p.z > win.minZ - 0.9 && p.z < win.maxZ + 0.9) ||
     (p.x > door.minX - 0.9 && p.x < door.maxX + 0.9 && p.z > door.minZ - 1 && p.z < door.maxZ - 1.5));
  const paintRock = (p, n) => {
    if (inside(p)) return n.y > 0.6 ? 0x6f6657 : n.y < -0.6 ? 0x4a443c : 0x5d554a;
    if (n.y > 0.6) return p.y > topY - 0.5 ? 0x7c8a5c : 0x8a8672;
    return p.y < HA.lowLevel - 2 ? 0x6f6a5e : 0x8d8575;
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
      const outer = out.x < o.minX + 0.01 || out.z < o.minZ + 0.01 || (out.z > o.maxZ - 0.01 && out.x > o.minX + 0.01 && s.bottom === base && s.top === topY);
      rockDisplace(out, outer && amp > 0.3 ? amp * 2.2 : amp);
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
  for (const s of rock) addRock(s, paintRock, 0.55);
  for (const s of stair) addRock(s, paintStair, 0.22);
  scene.add(builder.mesh());

  // --- Furnishings of the refuge. ---
  const f = new GeoBuilder(9, 0.06);
  const WOOD = 0x6e5236, DARK_WOOD = 0x4d3a28;
  // table with a map on it
  const tx = 1590, tz = 1895.5;
  f.box(3, 0.12, 1.4, tx, floorY + 0.85, tz, WOOD);
  for (const [dx, dz] of [[-1.3, -0.55], [1.3, -0.55], [-1.3, 0.55], [1.3, 0.55]]) f.box(0.14, 0.85, 0.14, tx + dx, floorY, tz + dz, DARK_WOOD);
  f.box(1.3, 0.02, 0.9, tx - 0.3, floorY + 0.97, tz, 0xd9c99a, 0.2);
  f.box(0.5, 0.45, 0.5, tx - 1, floorY, tz + 1.3, DARK_WOOD);
  f.box(0.5, 0.45, 0.5, tx + 0.9, floorY, tz + 1.4, DARK_WOOD, 0.4);
  addSolid(box(tx - 1.5, tx + 1.5, tz - 0.7, tz + 0.7, floorY, floorY + 0.97));
  // barrels and crates in the north-east corner
  for (const [bx, bz, r] of [[1598, 1893, 0.55], [1596.7, 1892.6, 0.5], [1598.2, 1894.4, 0.5]]) {
    f.cyl(r * 0.9, r, 1.1, bx, floorY, bz, WOOD, 9);
    f.cyl(r * 0.93, r * 0.93, 0.08, bx, floorY + 0.75, bz, 0x3a3530, 9);
    addCircle(bx, bz, r);
  }
  f.box(1.1, 0.8, 1.1, 1594.6, floorY, 1892.4, DARK_WOOD, 0.2);
  f.box(0.9, 0.6, 0.9, 1594.5, floorY + 0.8, 1892.5, WOOD, 0.5);
  addCircle(1594.6, 1892.4, 0.8);
  // bedrolls along the south wall
  for (let i = 0; i < 4; i++) {
    f.box(0.8, 0.14, 1.9, 1578.5 + i * 1.5, floorY, 1907.4, [0x5c6b45, 0x6b5a45, 0x4f5f6b, 0x6b4f45][i]);
    f.box(0.6, 0.12, 0.4, 1578.5 + i * 1.5, floorY + 0.12, 1908, 0xcfc6ae);
  }
  // a stone basin by the window, fed by the spray
  f.cyl(0.9, 0.7, 0.7, 1578.2, floorY, 1893.6, 0x8f897a, 8);
  f.cyl(0.75, 0.75, 0.06, 1578.2, floorY + 0.66, 1893.6, 0x6fa3b0, 8);
  addCircle(1578.2, 1893.6, 0.9);
  // the banner of the Stewards' rangers on the east wall: a white tree on black
  const wx = room.maxX - 0.75;
  f.box(0.06, 3.4, 2.2, wx, floorY + 1.3, 1900, 0x16161a);
  f.box(0.04, 1.5, 0.16, wx - 0.05, floorY + 1.7, 1900, 0xf2f0e6);
  for (const [dy, dz, len] of [[2.5, 0.35, 0.8], [2.5, -0.35, 0.8], [3.0, 0.3, 0.7], [3.0, -0.3, 0.7], [3.5, 0, 0.5]]) {
    f.box(0.04, 0.14, len, wx - 0.05, floorY + dy + 0.5, 1900 + dz, 0xf2f0e6, 0, dz > 0 ? 0.5 : dz < 0 ? -0.5 : 0);
  }
  // torch brackets
  const torches = [[room.minX + 4, room.minZ + 0.7], [room.maxX - 5, room.minZ + 0.7], [room.minX + 5, room.maxZ - 0.7], [room.maxX - 2.5, room.maxZ - 0.7]];
  for (const [x, z] of torches) f.box(0.12, 0.5, 0.12, x, floorY + 1.9, z, 0x3a3028);
  scene.add(f.mesh());

  const flames = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false });
  for (const [x, z] of torches) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), flameMat);
    fl.position.set(x, floorY + 2.6, z);
    flames.add(fl);
  }
  scene.add(flames);
  const lamp = new THREE.PointLight(0xffb060, 45, 34, 1.6);
  lamp.position.set((room.minX + room.maxX) / 2 + 3, floorY + 3.4, HA.z);
  scene.add(lamp);

  // --- Water: the stream across the top, the fall, the pool, the mist. ---
  const waterY = topY + STREAM_DEPTH * 0.7;
  const fallX = o.minX - 1.7;
  const poolY = heightAt(HA.pool.x, HA.pool.z) + 1.25;
  scene.add(water.ribbon([o.maxX + 5, heightAt(o.maxX + 5, HA.z) + STREAM_DEPTH, HA.z, o.maxX, waterY, HA.z, fallX, waterY, HA.z], 5));

  const fallTex = [makeNoiseTexture(128, 21, true), makeNoiseTexture(128, 22, true)];
  const fallH = waterY - poolY + 0.6;
  const falls = [];
  fallTex.forEach((tex, i) => {
    tex.repeat.set(2 + i, 1.5);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(10 - i * 1.2, fallH, 1, 1),
      new THREE.MeshBasicMaterial({
        color: i ? 0xffffff : 0xd6ecf2, map: tex, transparent: true, opacity: i ? 0.3 : 0.5,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    m.rotation.y = Math.PI / 2;
    m.position.set(fallX - i * 0.5, waterY - fallH / 2 + 0.1, HA.z);
    m.renderOrder = 3 + i;
    scene.add(m);
    falls.push(tex);
  });

  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(HA.pool.r + 1.5, 24),
    new THREE.MeshLambertMaterial({ color: 0x6fa7b4, map: water.ripples, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(HA.pool.x, poolY, HA.pool.z);
  pool.renderOrder = 1;
  scene.add(pool);

  // mist at the foot of the fall
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

  // Boulders heaped against the rock so it sits in the land, and to screen the stair.
  const rocks = new GeoBuilder(13, 0.08);
  const heap = [
    [o.minX - 1, o.minZ - 2, 5.5], [o.minX + 9, o.minZ - 4, 6.5], [o.minX + 20, o.minZ - 4, 7], [o.minX + 31, o.minZ - 3, 6],
    [o.minX - 2.5, o.minZ + 6, 4], [o.minX - 2.5, o.maxZ - 5, 4.2], [o.minX + 4, o.maxZ + 8, 3.2],
    [o.maxX - 8, o.maxZ + 4, 4.5], [o.maxX - 14, o.maxZ + 8.5, 3.6], [o.maxX - 5, o.minZ - 3, 4],
  ];
  heap.forEach(([x, z, r], i) => {
    const gy = heightAt(x, z);
    rocks.blob(r, x, gy + r * 0.25 + (i % 3) * 1.4, z, i % 4 === 1 ? 0x7d8762 : 0x8d8575, 1.15, 0.85 + (i % 3) * 0.2, 1, 1);
    addCircle(x, z, r * 0.85);
  });
  for (const [x, z, r] of [[1550, 1929, 1.6], [1547.5, 1925.5, 1.2], [1556, 1930, 1.1], [1566, 1874, 1.8], [1563, 1927.5, 0.9]]) {
    rocks.blob(r, x, heightAt(x, z) + r * 0.3, z, 0x8a8474, 1, 0.7, 1);
    addCircle(x, z, r * 0.8);
  }
  scene.add(rocks.mesh(materials.flat));

  return {
    floorY,
    faramir: { x: 1589.2, z: 1897.6, heading: -2.2 },
    eowyn: { x: 1581, z: 1903.2, heading: 1.3 },
    update(time) {
      falls[0].offset.y = time * 0.9;
      falls[1].offset.y = time * 1.3;
      for (let i = 0; i < MIST; i++) {
        const s = mistSeed[i];
        const life = (time * (0.12 + s[0] * 0.1) + s[1]) % 1;
        mistPos[i * 3] = fallX - 1 - life * 7 * s[2];
        mistPos[i * 3 + 1] = poolY + 0.4 + life * 4.5;
        mistPos[i * 3 + 2] = HA.z + (s[1] - 0.5) * 11 + Math.sin(time + i) * 0.4;
      }
      mistGeo.attributes.position.needsUpdate = true;
      flames.children.forEach((fl, i) => fl.scale.setScalar(0.9 + 0.18 * Math.sin(time * 9 + i * 2.1)));
      lamp.intensity = 45 + 5 * Math.sin(time * 7.3);
    },
  };
}

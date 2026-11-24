// Boot, wiring and the frame loop.

import * as THREE from 'three';
import { PARAMS, BY_KEY, defaults, fromHash, toHash } from './params.js';
import { derive, moonlightRatio, EYE, EARTH_DIST } from './physics.js';
import { computeLayout, makeUniforms, applyLayout, buildStation, disposeGroup } from './station.js';
import { Sky } from './sky.js';
import { Controls } from './controls.js';
import { buildPanel, readoutHTML } from './ui.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SUN_I = 3.0;            // sunlight, in the shader's units (white surface facing the sun = 3)

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 1);
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

const start = fromHash(location.hash);
const params = start.params;
let mode = start.view.mode === 'outside' ? 'outside' : 'inside';

const uniforms = makeUniforms();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(params.fov, 1, 0.05, 20000);
const sky = new Sky();
let layout = null;
let stationGroup = null;

// "You are here" marker for the outside view
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(1, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0xff7a1a, stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp }),
);
scene.add(marker);

const player = { theta: -Math.PI / 2, z: 0, yaw: -30 * DEG, pitch: 14 * DEG };
const outside = { yaw: 35 * DEG, pitch: 30 * DEG, zoom: 1 };
let spin = 0;
let earthSpin = 0;

function rebuild() {
  layout = computeLayout(params);
  applyLayout(uniforms, layout);
  if (stationGroup) { scene.remove(stationGroup); disposeGroup(stationGroup); }
  stationGroup = buildStation(layout, uniforms);
  scene.add(stationGroup);
  player.z = Math.max(-layout.HW + 0.4, Math.min(layout.HW - 0.4, player.z));
}
rebuild();
// start midway between two spokes, where the skylight is open overhead
if (layout.spokeN) player.theta = -Math.PI / 2 + Math.PI / layout.spokeN;

// --- UI -------------------------------------------------------------------
const panelBody = document.getElementById('panel-body');
let rebuildTimer = 0;
let hashTimer = 0;
const panel = buildPanel(panelBody, params, (key, v) => {
  params[key] = v;
  if (BY_KEY[key].rebuild) { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 60); }
  saveHash();
});
function saveHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, '', location.pathname + location.search + toHash(params, mode)), 300);
}
document.getElementById('reset').addEventListener('click', () => {
  Object.assign(params, defaults());
  panel.setAll(params);
  rebuild();
  saveHash();
});
document.getElementById('copy').addEventListener('click', async (e) => {
  history.replaceState(null, '', location.pathname + location.search + toHash(params, mode));
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Link copied'; }
  catch { e.target.textContent = 'Copy from the address bar'; }
  setTimeout(() => { e.target.textContent = 'Copy link to this design'; }, 1800);
});
const panelEl = document.getElementById('panel');
document.getElementById('toggle').addEventListener('click', () => panelEl.classList.toggle('open'));
document.getElementById('close').addEventListener('click', () => panelEl.classList.remove('open'));
if (window.innerWidth >= 760) panelEl.classList.add('open');
const viewBtn = document.getElementById('view');
function setMode(m) {
  mode = m;
  viewBtn.textContent = mode === 'inside' ? 'Outside view' : 'Inside view';
  saveHash();
}
viewBtn.addEventListener('click', () => setMode(mode === 'inside' ? 'outside' : 'inside'));
setMode(mode);
for (const b of document.querySelectorAll('#aim button')) b.addEventListener('click', () => aim(b.dataset.target));
const readout = document.getElementById('readout');
const readoutTitle = document.getElementById('readout-toggle');
if (window.innerWidth < 600) readout.classList.add('collapsed');
document.getElementById('readout-toggle').addEventListener('click', () => readout.classList.toggle('collapsed'));

const controls = new Controls(canvas, document.getElementById('joy'), document.getElementById('knob'));

// --- Frame -----------------------------------------------------------------
const qAtt = new THREE.Quaternion();
const qSpin = new THREE.Quaternion();
const qStation = new THREE.Quaternion();
const qInv = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const stationPos = new THREE.Vector3();
const sunS = new THREE.Vector3(), moonS = new THREE.Vector3();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const live = { sunElev: 0, moonElev: 0 };
const earthS = new THREE.Vector3();

/** Station attitude, and the sun, moon and earth directions in the station frame, for a spin angle. */
function orient(spinAngle, orbitRadius) {
  attitude(params.tilt, params.roll);
  qSpin.setFromAxisAngle(Z, spinAngle);
  qStation.copy(qAtt).multiply(qSpin);
  qInv.copy(qStation).invert();
  const phi = params.orbit * DEG;
  stationPos.set(0, orbitRadius * Math.cos(phi), -orbitRadius * Math.sin(phi));
  sunS.copy(X).applyQuaternion(qInv);
  moonS.copy(stationPos).negate().normalize().applyQuaternion(qInv);
  earthS.set(0, 0, -EARTH_DIST).sub(stationPos).normalize().applyQuaternion(qInv);
}

/** Elevation (deg) of a body above the local floor at the player's position, for a spin angle. */
function elevationAt(target, spinAngle) {
  orient(spinAngle, derive(params).orbit.radius);
  const dir = target === 'sun' ? sunS : target === 'moon' ? moonS : earthS;
  return Math.asin(-(dir.x * Math.cos(player.theta) + dir.y * Math.sin(player.theta))) / DEG;
}

let pendingAim = null;
/** Turn the inside camera toward the Moon, Earth or Sun (on the next frame, once their directions are current). */
function aim(target) {
  if (mode !== 'inside') setMode('inside');
  pendingAim = target;
}
function applyAim(target) {
  const dir = target === 'sun' ? sunS : target === 'moon' ? moonS : earthS;
  const c = Math.cos(player.theta), s = Math.sin(player.theta);
  const upDot = -(dir.x * c + dir.y * s);
  const tDot = -dir.x * s + dir.y * c;
  player.pitch = Math.asin(Math.max(-1, Math.min(1, upDot)));
  player.yaw = Math.atan2(dir.z, tDot);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/** Station attitude from the two orientation sliders. Tilt 0 = spin axis at the sun. */
function attitude(tiltDeg, rollDeg) {
  qAtt.setFromAxisAngle(Y, Math.PI / 2);                               // axis +Z → +X (sunward)
  qAtt.premultiply(qTmp.setFromAxisAngle(Z, tiltDeg * DEG));           // tip it away from the sun
  qAtt.premultiply(qTmp.setFromAxisAngle(X, rollDeg * DEG));           // swing it round the sun line
  return qAtt;
}

let last = performance.now();
let readoutT = 0, sliderT = 0;
let slowFrames = 0, fastFrames = 0;
let frameMs = 16;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frameMs = frameMs * 0.95 + (dt * 1000) * 0.05;
  const d = derive(params);
  const w = params.warp;

  spin = (spin + d.omega * dt * w) % TAU;
  earthSpin = (earthSpin + (TAU / 86164) * dt * w) % TAU;
  if (w > 0) {
    params.orbit = (params.orbit + (360 * dt * w) / d.orbit.period) % 360;
    if (now - sliderT > 250) { panel.set('orbit', params.orbit); sliderT = now; }
  }

  // Attitude and where the sun and moon are, in the station's (rotating) frame
  orient(spin, d.orbit.radius);

  if (pendingAim) { applyAim(pendingAim); pendingAim = null; }

  // Walk and look
  const look = controls.takeLook();
  const it = controls.intent();
  const L = layout;
  const rHat = v1.set(Math.cos(player.theta), Math.sin(player.theta), 0);
  const up = v2.copy(rHat).negate();
  const tHat = v3.set(-Math.sin(player.theta), Math.cos(player.theta), 0);
  if (mode === 'inside') {
    player.yaw -= look.dx * 0.0042;
    player.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, player.pitch - look.dy * 0.0042));
    const speed = it.run ? 4.5 : 1.6;
    // horizontal forward and right in (tangent, axial) components
    const fT = Math.cos(player.yaw), fZ = Math.sin(player.yaw);
    const rT = fZ, rZ = -fT;
    const mT = (it.f * fT + it.r * rT) * speed * dt;
    const mZ = (it.f * fZ + it.r * rZ) * speed * dt;
    player.theta = (player.theta + mT / L.R) % TAU;
    player.z = Math.max(-L.HW + 0.4, Math.min(L.HW - 0.4, player.z + mZ));
  } else {
    outside.yaw -= look.dx * 0.005;
    outside.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, outside.pitch + look.dy * 0.005));
    outside.zoom *= Math.exp(-it.f * dt * 1.2 + controls.takeWheel() * 0.1);
    outside.zoom = Math.max(0.15, Math.min(6, outside.zoom));
  }
  rHat.set(Math.cos(player.theta), Math.sin(player.theta), 0);
  up.copy(rHat).negate();
  tHat.set(-Math.sin(player.theta), Math.cos(player.theta), 0);
  const head = v4.copy(rHat).multiplyScalar(L.R - EYE).addScaledVector(Z, player.z);

  camera.fov = params.fov;
  if (mode === 'inside') {
    const fH = new THREE.Vector3().copy(tHat).multiplyScalar(Math.cos(player.yaw)).addScaledVector(Z, Math.sin(player.yaw));
    const fwd = fH.multiplyScalar(Math.cos(player.pitch)).addScaledVector(up, Math.sin(player.pitch));
    camera.position.copy(head);
    camera.up.copy(up);
    camera.lookAt(head.x + fwd.x, head.y + fwd.y, head.z + fwd.z);
    camera.near = 0.05;
    camera.far = Math.max(2000, params.diameter * 1.6);
    marker.visible = false;
  } else {
    // orbit the station in its non-spinning frame, so you watch it turn
    const dist = (L.R * 2.6 + 40) * outside.zoom;
    const cp = Math.cos(outside.pitch);
    camera.position.set(dist * cp * Math.cos(outside.yaw), dist * cp * Math.sin(outside.yaw), dist * Math.sin(outside.pitch));
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    qTmp.copy(qSpin).invert();
    camera.position.applyQuaternion(qTmp);
    camera.quaternion.premultiply(qTmp);
    camera.near = Math.max(0.5, dist * 0.004);
    camera.far = dist * 4;
    marker.visible = true;
    marker.position.copy(head);
    marker.scale.setScalar(Math.max(0.6, dist * 0.006));
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // Lighting uniforms
  uniforms.uSunDir.value.copy(sunS);
  uniforms.uSunCol.value.set(1.0, 0.98, 0.95).multiplyScalar(SUN_I);
  uniforms.uMoonDir.value.copy(moonS);
  uniforms.uMoonCol.value.set(0.92, 0.94, 1.0).multiplyScalar(SUN_I * moonlightRatio(params.moonSize));
  uniforms.uCabin.value = (params.cabin / 100) * 0.6;
  // Rough bounce light from sun coming in through the glass near you
  const inCeil = Math.max(0, sunS.dot(up)) * L.glassArea.ceil;
  const inSide = Math.abs(sunS.z) * L.glassArea.side * (L.H / (2 * L.HW));
  uniforms.uBounce.value = Math.min(1, inCeil + inSide) * SUN_I * 0.08;
  renderer.toneMappingExposure = params.exposure;

  live.sunElev = Math.asin(Math.max(-1, Math.min(1, sunS.dot(up)))) / DEG;
  live.moonElev = Math.asin(Math.max(-1, Math.min(1, moonS.dot(up)))) / DEG;

  sky.update({ stationPos, invAttitude: qInv, sunI: SUN_I, pixelRatio, earthSpin });
  sky.syncCamera(camera);

  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(sky.scene, sky.camera);

  if (now - readoutT > 250) {
    document.getElementById('readout-body').innerHTML = readoutHTML(d, params, live);
    readoutTitle.textContent = `Ring Station · ${d.rpm.toFixed(2)} rpm · ${params.gravity.toFixed(2)} g`;
    readoutT = now;
  }

  // Keep a phone smooth: step the pixel ratio down while frames are slow
  if (frameMs > 26) { slowFrames++; fastFrames = 0; } else if (frameMs < 14) { fastFrames++; slowFrames = 0; }
  if (slowFrames > 90 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); resize(); slowFrames = 0; }
  if (fastFrames > 300 && pixelRatio < Math.min(window.devicePixelRatio || 1, 2)) { pixelRatio += 0.25; resize(); fastFrames = 0; }

  requestAnimationFrame(frame);
}
// Open on a moment with sunlight streaming in through the skylight
spin = (((elevationAtHighest('sun') - 0.6) % TAU) + TAU) % TAU;
requestAnimationFrame(frame);

function elevationAtHighest(target) {
  let best = 0, bestE = -1e9;
  for (let i = 0; i < 360; i++) { const a = (i * TAU) / 360, e = elevationAt(target, a); if (e > bestE) { bestE = e; best = a; } }
  return best;
}

// Console handle for testing and poking at things
window.station = {
  params, player, outside, PARAMS,
  get layout() { return layout; },
  set(key, v) { params[key] = v; panel.set(key, v); if (BY_KEY[key]?.rebuild) rebuild(); },
  setMode,
  aim,
  /** Spin angle (of 360 tries) at which `target` stands highest over the player. */
  spinForHighest: elevationAtHighest,
  get spin() { return spin; },
  set spin(v) { spin = v; },
  renderer,
};

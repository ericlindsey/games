// Boot, wiring and the game loop.

import * as THREE from 'three';
import { QUALITY, SAVE } from './config.js';
import { HA, LANDMARKS } from './world/layout.js';
import { CAMPS, blightAt } from './world/campSites.js';
import { SITES } from './world/oldworks.js';
import { forestDensity } from './world/forest.js';
import { buildFarms } from './world/farms.js';
import { Motes } from './world/motes.js';
import { heightAt } from './world/terrain.js';
import { regionName, dangerTier } from './world/regions.js';
import { Ground } from './world/terrainMesh.js';
import { Atmosphere } from './world/atmosphere.js';
import { Water } from './world/water.js';
import { buildHennethAnnun } from './world/hennethAnnun.js';
import { buildRuins } from './world/ruins.js';
import { Camps } from './world/camps.js';
import { Player, CameraRig } from './entities/player.js';
import { makeFigure, animateFigure, LOOKS } from './entities/figure.js';
import { Input } from './input/input.js';
import { SaveStore, newState } from './systems/save.js';
import { Hud } from './ui/hud.js';
import { DialoguePanel, MapPanel, MenuPanel } from './ui/panels.js';
import { DIALOGUE } from './data/dialogue.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

async function boot() {
  let storage = null;
  try { storage = window.localStorage; } catch { /* blocked: play without saving */ }
  const store = new SaveStore(storage ?? { getItem: () => null, setItem: () => { throw new Error('no storage'); }, removeItem() {} });
  const saved = store.load();
  const state = saved ?? newState();

  const coarse = matchMedia('(pointer: coarse)').matches;
  const qualityName = params.get('quality') ?? state.settings.quality ?? (coarse ? 'low' : 'high');
  const quality = QUALITY[qualityName] ?? QUALITY.medium;

  // ---- renderer ----
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualityName !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.pixelRatio));
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.25, 12000);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ---- world ----
  const loading = $('loading');
  const say = async (text) => { loading.textContent = text; await nextFrame(); };

  await say('Raising the mountains…');
  const atmosphere = new Atmosphere(scene, quality);
  const ground = new Ground(scene, quality);
  await say('Filling the river…');
  const water = new Water(scene);
  await say('Hollowing the cave…');
  const refuge = buildHennethAnnun(scene, water);
  buildRuins(scene);
  await say('Laying the old walls\u2026');
  buildFarms(scene, quality.shadows);
  const motes = new Motes(scene, quality.motes);
  const camps = new Camps(scene, (id) => state.cleared.includes(id));

  // ---- people ----
  const player = new Player(scene);
  const rig = new CameraRig(camera);
  const npcs = ['faramir', 'eowyn'].map((id) => {
    const spot = refuge[id];
    const figure = makeFigure(LOOKS[id]);
    figure.position.set(spot.x, refuge.floorY, spot.z);
    figure.rotation.y = spot.heading;
    figure.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(figure);
    return { id, figure, x: spot.x, z: spot.z, home: spot.heading };
  });

  const placePlayer = () => {
    const atSpawn = state.player.x === HA.spawn.x && state.player.z === HA.spawn.z;
    player.place(state.player.x, state.player.z, state.player.heading, state.player.y ?? (atSpawn ? refuge.floorY : undefined));
    rig.yaw = state.player.heading;
  };
  placePlayer();

  await say('Planting the woods…');
  while (ground.update(player.pos.x, player.pos.z, 3) > 0) await nextFrame();

  // ---- interface ----
  const input = new Input(canvas);
  const hud = new Hud();
  const ruinIds = LANDMARKS.filter((l) => l.kind && !['crossroads', 'osgiliath', 'morgul'].includes(l.kind)).map((l) => l.id);
  let started = false;
  const anyPanel = () => dialogue.open || map.open || menu.open;
  const resume = () => { input.enabled = started && !anyPanel(); document.body.classList.toggle('panel-open', anyPanel()); };
  const dialogue = new DialoguePanel(resume);
  const map = new MapPanel(resume);
  const save = () => {
    state.player.x = player.pos.x; state.player.y = player.pos.y; state.player.z = player.pos.z; state.player.heading = player.yaw;
    return store.save(state);
  };
  const menu = new MenuPanel({
    onClose: resume,
    onSave: save,
    onQuality: (name) => { state.settings.quality = name; save(); location.search = ''; },
    onNew: () => { store.clear(); saveOnExit = false; location.reload(); },
  });
  let saveOnExit = true;
  const openPanel = () => { input.enabled = false; input.releasePointer(); hud.setPrompt(null); document.body.classList.add('panel-open'); };

  player.onNotice = (text) => hud.toast('', text);

  // What the player can act on right now: { label, use } or null.
  let target = null;
  const findTarget = () => {
    const p = player.pos;
    for (const n of npcs) {
      if (Math.hypot(p.x - n.x, p.z - n.z) < 3 && Math.abs(p.y - refuge.floorY) < 2) {
        const who = DIALOGUE[n.id];
        return { label: `Speak with ${who.name}`, use: () => { openPanel(); dialogue.start(who, { cleared: state.cleared, discovered: state.discovered, ruinIds }); } };
      }
    }
    for (const c of camps.sites) {
      if (!c.isCleared && Math.hypot(p.x - c.x, p.z - c.z) < 4.5) {
        return {
          label: 'Break up the camp',
          use: () => {
            camps.clear(c.id);
            state.cleared.push(c.id);
            hud.toast('The camp is broken', 'Give it a little while. The land remembers how to be green.');
            save();
          },
        };
      }
    }
    return null;
  };

  const discover = () => {
    const p = player.pos;
    for (const l of LANDMARKS) {
      if (state.discovered.includes(l.id) || Math.hypot(p.x - l.x, p.z - l.z) > l.r) continue;
      state.discovered.push(l.id);
      hud.toast(l.name, l.blurb);
      save();
    }
    for (const st of SITES) {
      const id = 'site:' + st.id;
      if (state.discovered.includes(id) || Math.hypot(p.x - st.x, p.z - st.z) > 45) continue;
      state.discovered.push(id);
      if (st.kind === 'hamlet') hud.toast('A ruined village', 'Hearths cold these many lives of men, and the trees coming in at the doors.');
      else if (!state.discovered.some((d) => d.startsWith('site:farm') && d !== id)) hud.toast('An old farmstead', 'Someone ploughed here once. The walls remember the fields.');
      save();
    }
    for (const c of CAMPS) {
      const id = 'camp:' + c.id;
      if (state.discovered.includes(id) || Math.hypot(p.x - c.x, p.z - c.z) > 28) continue;
      state.discovered.push(id);
      hud.toast('An enemy camp', state.cleared.includes(c.id) ? 'Cleared, and mending.' : 'The fire is cold. Whoever laired here is not far.');
      save();
    }
  };

  input.onAction = (action) => {
    if (!started) return;
    if (action === 'debug') { hud.debug.hidden = !hud.debug.hidden; return; }
    if (action === 'menu') {
      if (dialogue.open) dialogue.close(); else if (map.open) map.close(); else if (menu.open) menu.close();
      else { openPanel(); menu.show(qualityName, storage ? '' : 'Saving is not available in this browser.'); }
      return;
    }
    if (action === 'map') {
      if (map.open) map.close(); else if (!anyPanel()) { openPanel(); map.show(state, player); }
      return;
    }
    if (action === 'interact' && input.enabled && target) target.use();
  };
  $('btn-map').onclick = () => input.onAction('map');
  $('btn-menu').onclick = () => input.onAction('menu');
  hud.prompt.onclick = () => input.onAction('interact');
  const jump = $('btn-jump');
  jump.addEventListener('pointerdown', () => { input.jumpButton = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jump.addEventListener(ev, () => { input.jumpButton = false; });

  addEventListener('visibilitychange', () => { if (document.hidden && started && saveOnExit) save(); });
  addEventListener('pagehide', () => { if (started && saveOnExit) save(); });

  // ---- title ----
  const begin = () => {
    started = true;
    $('title').classList.add('fade');
    setTimeout(() => { $('title').hidden = true; }, 900);
    hud.show();
    resume();
    if (!saved) hud.toast('Henneth Annûn', 'The Window of the Sunset. Faramir and Éowyn are within.');
    setTimeout(() => hud.hideHint(), 9000);
  };
  loading.hidden = true;
  const beginButton = $('begin');
  beginButton.textContent = saved ? 'Continue' : 'Begin';
  beginButton.hidden = false;
  beginButton.onclick = begin;
  if (saved) {
    const fresh = $('begin-new');
    fresh.hidden = false;
    fresh.onclick = () => {
      if (!confirm('Begin anew? Your discoveries and cleared camps will be forgotten.')) return;
      store.clear(); saveOnExit = false; location.reload();
    };
  }
  if (params.has('autostart')) begin();
  if (params.has('debug')) hud.debug.hidden = false;

  // ---- loop ----
  let last = performance.now(), time = 0, slow = 0, autosave = 0, fps = 60, shade = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const elapsed = (now - last) / 1000;
    const dt = Math.min(0.05, elapsed);
    last = now;
    time += dt;
    fps += (1 / Math.max(elapsed, 1e-3) - fps) * 0.1;

    input.update();
    player.update(dt, time, input, rig.yaw);
    rig.update(dt, input, player);
    if (input.enabled && (input.move.x || input.move.y)) hud.hideHint();

    ground.update(player.pos.x, player.pos.z, 1);
    camps.update(dt);
    const blight = blightAt(player.pos.x, player.pos.z, camps.strength);
    const inside = refuge.isInside(player.pos);
    shade += ((inside ? 0 : forestDensity(player.pos.x, player.pos.z)) - shade) * Math.min(1, dt * 1.5);
    atmosphere.update(camera, player.pos, blight, dt, shade, inside);
    motes.update(time, camera, player.pos.y, inside ? 0 : shade * (1 - blight));
    water.update(time);
    refuge.update(time);

    for (const n of npcs) {
      // turn to face the ranger when they come close
      const dx = player.pos.x - n.x, dz = player.pos.z - n.z;
      const want = Math.hypot(dx, dz) < 7 ? Math.atan2(dx, dz) : n.home;
      let turn = want - n.figure.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      n.figure.rotation.y += turn * Math.min(1, dt * 3);
      animateFigure(n.figure, 0, dt, time + n.x);
    }

    slow -= dt;
    if (slow <= 0 && started) {
      slow = 0.25;
      discover();
      target = input.enabled ? findTarget() : null;
      hud.setPrompt(target ? target.label : null, input.touch);
      hud.setPlace(Math.hypot(player.pos.x - HA.x, player.pos.z - HA.z) < 110 ? 'Henneth Annûn' : regionName(player.pos.x, player.pos.z));
      state.stats.playSeconds += 0.25;
      if (!hud.debug.hidden) {
        const i = renderer.info.render, p = player.pos;
        hud.debug.textContent =
          `fps ${fps.toFixed(0)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k  chunks ${ground.chunks.size}\n` +
          `pos ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  tier ${dangerTier(p.x, p.z)}  blight ${blight.toFixed(2)}\n` +
          `quality ${qualityName}${input.haste ? '  HASTE (G)' : ''}`;
      }
    }
    autosave += dt;
    if (autosave > SAVE.autosaveSeconds && started) { autosave = 0; save(); }

    hud.update(dt, rig.bearing(), player.pos);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  // For tests and for poking at the world from the console.
  window.roi = {
    ready: true, state, player, rig, input, camps, ground, renderer, heightAt, save, refuge,
    landmarks: LANDMARKS, sites: SITES,
    teleport(x, z, yaw = player.yaw, y = undefined) {
      player.place(x, z, yaw, y);
      rig.yaw = yaw;
      while (ground.update(x, z, 4) > 0) { /* build everything in range now */ }
    },
  };
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Something went wrong while loading. See the console for details.';
});

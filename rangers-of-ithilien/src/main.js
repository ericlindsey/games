// Boot, wiring and the game loop.

import * as THREE from 'three';
import { QUALITY, SAVE } from './config.js';
import { HA, LANDMARKS, haradRoadX } from './world/layout.js';
import { trunkAt, blockedBySolid } from './world/collision.js';
import { CAMPS, blightAt } from './world/campSites.js';
import { SITES } from './world/oldworks.js';
import { RELICS, RELIC_KINDS } from './world/relicSites.js';
import { forestDensity } from './world/forest.js';
import { heightAt, STREAMS } from './world/terrain.js';
import { regionName, dangerTier } from './world/regions.js';
import { Ground } from './world/terrainMesh.js';
import { Atmosphere } from './world/atmosphere.js';
import { Water } from './world/water.js';
import { buildHennethAnnun } from './world/hennethAnnun.js';
import { buildRuins } from './world/ruins.js';
import { buildFarms } from './world/farms.js';
import { buildRelics } from './world/relics.js';
import { Motes } from './world/motes.js';
import { Herbs } from './world/herbs.js';
import { Camps } from './world/camps.js';
import { Player, CameraRig } from './entities/player.js';
import { Enemies } from './entities/enemies.js';
import { makeFigure, animateFigure, LOOKS } from './entities/figure.js';
import { Input } from './input/input.js';
import { SaveStore, newState } from './systems/save.js';
import { Combat } from './systems/combat.js';
import * as inv from './systems/inventory.js';
import * as quests from './systems/quests.js';
import { rng } from './util/noise.js';
import { Hud } from './ui/hud.js';
import { DialoguePanel, MapPanel, MenuPanel, PackPanel, TradePanel } from './ui/panels.js';
import { DIALOGUE } from './data/dialogue.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

async function boot() {
  let storage = null;
  try { storage = window.localStorage; } catch { /* blocked: play without saving */ }
  const dev = params.has('dev'); // the testing page: its own save, and a panel of shortcuts
  const store = new SaveStore(storage ?? { getItem: () => null, setItem: () => { throw new Error('no storage'); }, removeItem() {} }, dev ? SAVE.key + '.dev' : SAVE.key);
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
  await say('Laying the old walls…');
  buildFarms(scene, quality.shadows);
  buildRelics(scene, quality.shadows);
  const motes = new Motes(scene, quality.motes);
  const herbs = new Herbs(scene, state.picked);
  const camps = new Camps(scene, (id) => state.cleared.includes(id));

  // ---- people ----
  const player = new Player(scene);
  const rig = new CameraRig(camera);
  const npcs = ['faramir', 'eowyn', 'mablung'].map((id) => {
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
  let started = false, saveOnExit = true;
  const anyPanel = () => dialogue.open || map.open || menu.open || pack.open || trade.open;
  const resume = () => { input.enabled = started && !anyPanel(); document.body.classList.toggle('panel-open', anyPanel()); };
  const openPanel = () => { input.enabled = false; input.releasePointer(); hud.setPrompt(null); document.body.classList.add('panel-open'); };
  const save = () => {
    state.player.x = player.pos.x; state.player.y = player.pos.y; state.player.z = player.pos.z; state.player.heading = player.yaw;
    return store.save(state);
  };
  const refreshHud = () => { hud.setHealth(state.health); hud.setWeapon(state); hud.setTracker(quests.trackers(state)); combat.syncWeapon(); };

  const dialogue = new DialoguePanel(resume);
  const map = new MapPanel(resume);
  const pack = new PackPanel({ onClose: resume, onChange: () => refreshHud() });
  const trade = new TradePanel({ onClose: resume, onChange: () => refreshHud() });
  const menu = new MenuPanel({
    onClose: resume,
    onSave: save,
    onQuality: (name) => { state.settings.quality = name; save(); location.search = ''; },
    onNew: () => { store.clear(); saveOnExit = false; location.reload(); },
    onTravel: () => { if (!enemies.inCombat()) { menu.close(); goHome('You slip away by the ways the rangers know, and are home before the light changes.'); } },
  });

  player.onNotice = (text) => hud.toast('', text);

  // ---- the enemy, and the fighting ----
  const lootRand = rng(4242);
  const enemies = new Enemies(scene, {
    isCleared: (id) => state.cleared.includes(id),
    hurtPlayer: (amount) => combat.hurt(amount),
    shoot: (from, to, damage) => combat.shoot(from, to, damage, 27, false),
    onKill: (e) => { state.stats.kills++; combat.dropLoot(e); },
    onHost: () => hud.toast('A host on the road', 'Too many for one bow. Get off the road and let them pass.'),
    onPatrolBeaten: () => hud.toast('', 'The road is quiet again.'),
    onCampCleared: (camp) => {
      camps.clear(camp.id);
      state.cleared.push(camp.id);
      if (!state.discovered.includes('camp:' + camp.id)) state.discovered.push('camp:' + camp.id);
      if (camp.size >= 3) { // a captain down is told of at Henneth Annûn
        state.renown++;
        hud.toast(camp.size === 4 ? 'The war-camp is broken' : 'The stockade is broken', 'Word of it will reach Henneth Ann\u00fbn. (Renown +1)');
      } else hud.toast('The camp is broken', 'Give it a little while. The land remembers how to be green.');
      combat.give(inv.stashLoot(camp, lootRand), 'From their stores');
      hud.setTracker(quests.trackers(state));
      save();
    },
  });
  const combat = new Combat({
    scene, camera, player, rig, input, state, enemies, hud,
    onFallen: () => { // carried home
      state.health = 100;
      goHome('You wake in the cave. Someone carried you home; no one will say who.');
    },
  });
  /**
   * The places the ranger can travel to from the map: home, and every old
   * place (ruin) they have found. Each has a spot to arrive at on open ground.
   */
  const RUINS = [
    ...LANDMARKS.filter((l) => l.kind && !['crossroads', 'osgiliath', 'morgul'].includes(l.kind)).map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z, ax: l.x, az: l.z + (l.flat ?? 10) + 6 })),
    ...RELICS.map((r) => ({ id: r.id, name: RELIC_KINDS[r.kind][0], x: r.x, z: r.z, ax: r.x, az: r.z + 11 })),
  ];
  const travelPlaces = () => [
    { id: 'home', name: 'Henneth Ann\u00fbn', x: HA.x - 14, z: HA.z, home: true },
    ...RUINS.filter((p) => state.discovered.includes(p.id)),
  ];
  const travelTo = (p) => {
    if (enemies.inCombat()) { hud.toast('', 'Not while the enemy has seen you.'); return; }
    map.close();
    if (p.home) { goHome('You go home by the hidden ways, and the falls are loud again.'); return; }
    enemies.reset();
    combat.reset();
    // arrive on open ground near the place, not inside a wall
    let ax = p.ax, az = p.az;
    for (let t = 0; t < 40; t++) {
      const a = t * 2.4, r = t * 0.6, x = p.ax + Math.cos(a) * r, z = p.az + Math.sin(a) * r;
      if (!blockedBySolid(x, z, heightAt(x, z), 0.6)) { ax = x; az = z; break; }
    }
    const yaw = Math.atan2(p.x - ax, p.z - az);
    player.place(ax, az, yaw);
    rig.yaw = yaw;
    while (ground.update(ax, az, 4) > 0) { /* build it all now */ }
    hud.toast(p.name, 'By the old roads, that are only paths now.');
    save();
  };
  map.onTravel = travelTo;

  /** Set the ranger down in the cave, with the field behind them forgotten. */
  const goHome = (words) => {
    enemies.reset();
    combat.reset();
    state.player = { x: HA.spawn.x, z: HA.spawn.z, heading: HA.spawn.heading };
    placePlayer();
    while (ground.update(player.pos.x, player.pos.z, 4) > 0) { /* build home at once */ }
    hud.setHealth(state.health);
    hud.toast('Henneth Annûn', words);
    save();
  };

  // ---- talk: what each of them has to say, with any tasks woven in ----
  const speakerFor = (id) => {
    const base = DIALOGUE[id];
    const nodes = { ...base.nodes };
    const extra = [];
    if (id === 'mablung') {
      const withTrade = (n) => ({ ...n, options: n.options.map((o) => (o.trade ? { ...o, do: () => setTimeout(() => { openPanel(); trade.show(state); }, 0) } : o)) });
      for (const k in nodes) nodes[k] = withTrade(nodes[k]);
      return { ...base, nodes };
    }
    for (const q of quests.activeFrom(id, state)) {
      if (quests.isComplete(q, state)) {
        nodes['done_' + q.id] = { text: () => q.done + (nodes['done_' + q.id].got ? `\n\nReceived: ${nodes['done_' + q.id].got}.` : ''), options: [{ label: 'Thank you.' }] };
        extra.push({
          label: `It is done. (${q.title})`, to: 'done_' + q.id,
          do: () => { const loot = quests.turnIn(state, q.id); nodes['done_' + q.id].got = loot?.length ? inv.describeLoot(loot) : ''; refreshHud(); save(); },
        });
      } else {
        const p = quests.progress(q.objective, state);
        nodes['remind_' + q.id] = { text: q.remind + (p.need > 1 ? ` (${Math.min(p.have, p.need)} of ${p.need} so far.)` : ''), options: [{ label: 'I will see to it.', to: 'hello' }] };
        extra.push({ label: `About my task… (${q.title})`, to: 'remind_' + q.id });
      }
    }
    const offer = quests.offerFrom(id, state);
    if (offer) {
      nodes['offer_' + offer.id] = {
        text: offer.offer, picture: offer.picture,
        options: [
          { label: 'I will do it.', do: () => { quests.accept(state, offer.id); refreshHud(); save(); hud.toast('New task', offer.title); } },
          { label: 'Not yet.', to: 'hello' },
        ],
      };
      extra.push({ label: 'Have you a task for me?', to: 'offer_' + offer.id });
    }
    if (id === 'eowyn' && state.quests.done.includes('e1') && inv.count(state, 'athelas') >= 2) {
      nodes.brew = { text: 'Give them here. … There: steeped, strained, and stoppered. Drink it when you must, not before.', options: [{ label: 'Thank you.' }] };
      extra.push({ label: 'Will you steep these? (2 kingsfoil)', to: 'brew', do: () => { inv.removeItem(state, 'athelas', 2); inv.addItem(state, 'draught'); refreshHud(); save(); } });
    }
    nodes.hello = { ...base.nodes.hello, options: [...extra, ...base.nodes.hello.options] };
    return { ...base, nodes };
  };
  const ruinIds = [...LANDMARKS.filter((l) => l.kind && !['crossroads', 'osgiliath', 'morgul'].includes(l.kind)).map((l) => l.id), ...RELICS.map((r) => r.id)];

  // What the player can act on right now: { label, use } or null.
  let target = null;
  const findTarget = () => {
    const p = player.pos;
    if (Math.abs(p.y - refuge.floorY) > 2) return null;
    for (const n of npcs) {
      if (Math.hypot(p.x - n.x, p.z - n.z) < 3) {
        const who = DIALOGUE[n.id];
        return { label: `Speak with ${who.name}`, use: () => { openPanel(); dialogue.start(speakerFor(n.id), { cleared: state.cleared, discovered: state.discovered, ruinIds }); } };
      }
    }
    return null;
  };

  const found = (id, title, blurb) => {
    state.discovered.push(id);
    if (title) hud.toast(title, blurb);
    hud.setTracker(quests.trackers(state));
    save();
  };
  const discover = () => {
    const p = player.pos, has = (id) => state.discovered.includes(id);
    for (const l of LANDMARKS) if (!has(l.id) && Math.hypot(p.x - l.x, p.z - l.z) < l.r) found(l.id, l.name, l.blurb);
    for (const st of SITES) {
      const id = 'site:' + st.id;
      if (has(id) || Math.hypot(p.x - st.x, p.z - st.z) > 45) continue;
      if (st.kind === 'hamlet') found(id, 'A ruined village', 'Hearths cold these many lives of men, and the trees coming in at the doors.');
      else if (!state.discovered.some((d) => d.startsWith('site:farm'))) found(id, 'An old farmstead', 'Someone ploughed here once. The walls remember the fields.');
      else found(id);
    }
    for (const r of RELICS) if (!has(r.id) && Math.hypot(p.x - r.x, p.z - r.z) < 26) found(r.id, ...RELIC_KINDS[r.kind]);
    for (const c of CAMPS) {
      const id = 'camp:' + c.id;
      if (has(id) || Math.hypot(p.x - c.x, p.z - c.z) > 45) continue;
      found(id, 'An enemy camp', state.cleared.includes(c.id) ? 'Cleared, and mending.' : c.size === 3 ? 'A stockade, and a captain within. Think before you go in.' : 'They have not seen you yet.');
    }
    const herb = herbs.gatherAt(p.x, p.z);
    if (herb) {
      state.picked.push(herb);
      inv.addItem(state, 'athelas');
      if (state.picked.length === 1) hud.toast('Kingsfoil', 'The low plant with white stars and a pale glimmer over it. Éowyn can steep it.');
      else hud.toast('', `Kingsfoil gathered (${inv.count(state, 'athelas')}).`);
      hud.setTracker(quests.trackers(state));
    }
  };

  input.onAction = (action) => {
    if (!started) return;
    if (action === 'debug') { hud.debug.hidden = !hud.debug.hidden; return; }
    if (action === 'menu') {
      const open = [dialogue, map, pack, trade, menu].find((p) => p.open);
      if (open) open.close();
      else { openPanel(); menu.show(qualityName, storage ? '' : 'Saving is not available in this browser.', { atHome: refuge.isInside(player.pos), inFight: enemies.inCombat() }); }
      return;
    }
    if (action === 'map') {
      if (map.open) map.close(); else if (!anyPanel()) { openPanel(); map.show(state, player, travelPlaces(), enemies.inCombat()); }
      return;
    }
    if (action === 'pack') {
      if (pack.open) pack.close(); else if (!anyPanel()) { openPanel(); pack.show(state); }
      return;
    }
    if (!input.enabled || combat.fallen > 0) return;
    if (action === 'interact' && target) target.use();
    else if (action === 'swap') combat.swap();
    else if (action === 'sword' || action === 'bow') combat.swap(action);
    else if (action === 'heal') combat.heal();
    else if (action === 'aim') combat.setAim(!combat.aim);
  };
  $('btn-map').onclick = () => input.onAction('map');
  $('btn-pack').onclick = () => input.onAction('pack');
  $('btn-menu').onclick = () => input.onAction('menu');
  $('btn-heal').onclick = () => input.onAction('heal');
  $('btn-aim').onclick = () => input.onAction('aim');
  hud.prompt.onclick = () => input.onAction('interact');
  const hold = (el, on) => {
    el.addEventListener('pointerdown', () => on(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => on(false));
  };
  hold($('btn-jump'), (v) => { input.jumpButton = v; });
  hold($('btn-attack'), (v) => { input.attackButton = v; });

  addEventListener('visibilitychange', () => { if (document.hidden && started && saveOnExit) save(); });
  addEventListener('pagehide', () => { if (started && saveOnExit) save(); });

  // ---- full screen ----
  // A phone's browser bars eat the screen. Where the page may go full screen
  // (Android, iPad) it does so on Begin; an iPhone cannot, so the menu tells how
  // to add the game to the home screen, where it opens with no bars at all.
  const root = document.documentElement;
  const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  const goFull = () => {
    if (!canFull || standalone || document.fullscreenElement || document.webkitFullscreenElement) return;
    try { (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.())?.catch?.(() => {}); } catch { /* refused: carry on */ }
  };
  $('menu-full').hidden = !canFull || standalone;
  $('menu-full').onclick = goFull;
  $('menu-install').hidden = canFull || standalone;

  // ---- title ----
  const begin = () => {
    if (document.body.classList.contains('touch')) goFull();
    started = true;
    $('title').classList.add('fade');
    setTimeout(() => { $('title').hidden = true; }, 900);
    hud.show();
    refreshHud();
    resume();
    if (!saved) hud.toast('Henneth Annûn', 'The Window of the Sunset. Faramir has work for you.');
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
      if (!confirm('Begin anew? Your discoveries, gear and cleared camps will be forgotten.')) return;
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
    const down = combat.fallen > 0;
    const fight = combat.update(dt, time, input.attack && !down);
    // Aim mode: toggled (R, or the Aim button), or held on the right mouse button.
    const aiming = (combat.aim || (input.aimMouse && input.enabled && state.weapon === 'bow')) && !down;
    $('btn-aim').classList.toggle('on', combat.aim);
    rig.aiming = state.weapon === 'bow' && (!input.touch || combat.aim) && rig.wantDist > 0.5;
    rig.zoomed = aiming;
    player.update(dt, time, input, rig.yaw, { pose: fight.pose, slow: fight.slow, still: fight.still, holdYaw: fight.slow || combat.swing > 0, down });
    rig.update(dt, input, player);
    hud.setCrosshair(started && state.weapon === 'bow' && (!input.touch || combat.aim) && !anyPanel(), combat.draw >= 0.8);
    if (input.enabled && (input.move.x || input.move.y)) hud.hideHint();

    ground.update(player.pos.x, player.pos.z, 1);
    camps.update(dt, time, player.pos.x, player.pos.z);
    herbs.update(time);
    camera.updateMatrixWorld();
    enemies.update(dt, time, player, input.walk, !down, camera);
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
      if (!down) discover();
      target = input.enabled && !down ? findTarget() : null;
      hud.setPrompt(target ? target.label : null, input.touch);
      hud.setPlace(Math.hypot(player.pos.x - (HA.x - 10), player.pos.z - HA.z) < 55 ? 'Henneth Annûn' : regionName(player.pos.x, player.pos.z));
      hud.setWeapon(state);
      state.stats.playSeconds += 0.25;
      if (!hud.debug.hidden) {
        const i = renderer.info.render, p = player.pos;
        hud.debug.textContent =
          `fps ${fps.toFixed(0)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k  chunks ${ground.chunks.size}  foes ${enemies.list.length}\n` +
          `pos ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  tier ${dangerTier(p.x, p.z)}  blight ${blight.toFixed(2)}\n` +
          `quality ${qualityName}${input.haste ? '  HASTE (G)' : ''}`;
      }
    }
    autosave += dt;
    if (autosave > SAVE.autosaveSeconds && started && !down) { autosave = 0; save(); }

    hud.update(dt, rig.bearing(), player.pos);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  // For tests and for poking at the world from the console.
  const api = {
    ready: true, state, player, rig, input, camps, ground, renderer, heightAt, save, refuge, enemies, combat, herbs, quests, inv,
    landmarks: LANDMARKS, sites: SITES, relics: RELICS,
    teleport(x, z, yaw = player.yaw, y = undefined) {
      player.place(x, z, yaw, y);
      rig.yaw = yaw;
      while (ground.update(x, z, 4) > 0) { /* build everything in range now */ }
    },
    hud, map, pack, trade, refreshHud, goHome, openPanel, store, trunkAt, haradRoadX, travelTo, travelPlaces, streams: STREAMS,
  };
  window.roi = api;
  if (dev) (await import('./dev.js')).attach(api);
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Something went wrong while loading. See the console for details.';
});

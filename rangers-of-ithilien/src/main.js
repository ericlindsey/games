// Boot, wiring and the game loop.

import * as THREE from 'three';
import { QUALITY, SAVE, WORLD } from './config.js';
import { HA, LANDMARKS, haradRoadX } from './world/layout.js';
import { trunkAt, blockedBySolid } from './world/collision.js';
import { CAMPS, blightAt } from './world/campSites.js';
import { SITES } from './world/oldworks.js';
import { RELICS, RELIC_KINDS } from './world/relicSites.js';
import { forestDensity } from './world/forest.js';
import { heightAt, STREAMS } from './world/terrain.js';
import { dangerTier } from './world/regions.js';
import { PROVINCES, PROVINCE_CAMPS, HOLDS, provinceAt, provinceById, fullName, CAMP_PROVINCE } from './world/provinces.js';
import { provinceStatus, statusLine } from './systems/provinces.js';
import { Ground } from './world/terrainMesh.js';
import { Atmosphere } from './world/atmosphere.js';
import { Water } from './world/water.js';
import { buildHennethAnnun } from './world/hennethAnnun.js';
import { buildRuins } from './world/ruins.js';
import { buildFarms } from './world/farms.js';
import { buildRelics } from './world/relics.js';
import { Motes } from './world/motes.js';
import { Grass } from './world/grass.js';
import { updateSurfaces, surfaceSettings } from './world/surface.js';
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
import { addHonour, HONOUR } from './systems/renown.js';
import { rng } from './util/noise.js';
import { Hud } from './ui/hud.js';
import { DialoguePanel, MapPanel, MenuPanel, PackPanel, TradePanel } from './ui/panels.js';
import { DIALOGUE } from './data/dialogue.js';
import { ITEMS } from './data/items.js';

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
  const qualityName = params.get('quality') ?? state.settings.quality ?? (coarse ? 'medium' : 'high');
  const quality = QUALITY[qualityName] ?? QUALITY.medium;
  surfaceSettings.lite = !!quality.liteSurfaces;

  // ---- renderer ----
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualityName !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.pixelRatio));
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Filmic tone mapping: bright sun without blown-out greens, deep but readable shade.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = Number(params.get('exposure') ?? 1.35);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.25, 12000);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
  // The resolution follows the frame rate: when the frame rate sags (the deep
  // woods on a phone, say) the picture is drawn a little coarser, down to
  // quality.minPixelRatio, and sharpened again once there is time to spare.
  const ratioMax = Math.min(devicePixelRatio || 1, quality.pixelRatio);
  const ratioMin = Math.min(ratioMax, quality.minPixelRatio ?? ratioMax);
  const sharpness = { ratio: ratioMax, frames: 0, time: 0, slowFor: 0, quickFor: 0 };
  const pace = (elapsed) => {
    const sp = sharpness;
    if (elapsed > 0.25) { sp.frames = sp.time = 0; return; } // a stall (loading, a hidden tab): not the frame rate
    sp.frames++; sp.time += elapsed;
    if (sp.time < 1) return;
    const rate = sp.frames / sp.time;
    sp.frames = sp.time = 0;
    sp.slowFor = rate < 40 ? sp.slowFor + 1 : 0;
    sp.quickFor = rate > 57 ? sp.quickFor + 1 : 0;
    let next = sp.ratio;
    if (sp.slowFor >= 2 && sp.ratio > ratioMin) next = Math.max(ratioMin, sp.ratio - 0.25);
    else if (sp.quickFor >= 10 && sp.ratio < ratioMax) next = Math.min(ratioMax, sp.ratio + 0.25);
    if (next !== sp.ratio) { sp.ratio = next; sp.slowFor = sp.quickFor = 0; renderer.setPixelRatio(next); resize(); }
  };

  // ---- world ----
  const loading = $('loading');
  const say = async (text) => { loading.textContent = text; await nextFrame(); };

  // (each part of the world names what it adds to the scene, so tools/perf.mjs can say what is drawn)
  let named = 0;
  const label = (name) => { for (; named < scene.children.length; named++) scene.children[named].name ||= name; };
  await say('Raising the mountains…');
  const atmosphere = new Atmosphere(scene, quality);
  label('sky');
  const ground = new Ground(scene, quality);
  await say('Filling the river…');
  const water = new Water(scene);
  label('water');
  await say('Hollowing the cave…');
  const refuge = buildHennethAnnun(scene, water);
  label('Henneth Annûn');
  buildRuins(scene);
  label('ruins');
  await say('Laying the old walls…');
  buildFarms(scene, quality.shadows);
  label('farms');
  buildRelics(scene, quality.shadows);
  label('lesser ruins and waymarks');
  const motes = new Motes(scene, quality.motes);
  const grass = new Grass(scene, quality);
  const herbs = new Herbs(scene, state.picked);
  label('herbs');
  const camps = new Camps(scene, (id) => state.cleared.includes(id));
  label('camps');

  // ---- people ----
  const player = new Player(scene);
  player.dress(state.equipped);
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
  grass.update(player.pos.x, player.pos.z, 1e3);

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
  let dressedAs = JSON.stringify(state.equipped);
  const refreshHud = () => {
    const gear = JSON.stringify(state.equipped);
    if (gear !== dressedAs) { dressedAs = gear; player.dress(state.equipped); } // what they wear shows
    hud.setHealth(state.health); hud.setWeapon(state); hud.setTracker(quests.trackers(state)); combat.syncWeapon();
  };
  /** Renown points for a deed; when the level rises, say so (after whatever else is being said). */
  const honour = (n) => {
    const rose = addHonour(state, n);
    if (rose) hud.toast('Your name grows', `Renown ${rose}. ${rose % 5 === 0 ? 'The enemy hears of you too, and gathers.' : 'Mablung may have more to show you.'}`);
    return rose;
  };

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
    onFps: () => { state.settings.fps = !state.settings.fps; $('fps').hidden = !state.settings.fps; save(); return state.settings.fps; },
  });
  $('fps').hidden = !state.settings.fps;

  player.onNotice = (text) => hud.toast('', text);

  // ---- the enemy, and the fighting ----
  const lootRand = rng(4242);
  const enemies = new Enemies(scene, {
    isCleared: (id) => state.cleared.includes(id),
    hurtPlayer: (amount) => combat.hurt(amount),
    shoot: (from, to, damage) => combat.shoot(from, to, damage, 27, false),
    onKill: (e) => { state.stats.kills++; combat.dropLoot(e); honour(HONOUR.kill[e.type] ?? 1); hud.callout(`${e.def.name} felled`, 'felled'); },
    onSpotted: (camp, how) => hud.callout(
      camp.patrol ? (camp.patrol.host ? 'The host has seen you!' : 'The band on the road has seen you!')
        : how === 'called' ? (camp.size >= 3 ? 'A stockade takes up the chase!' : 'Another camp takes up the chase!')
        : how === 'struck' ? (camp.size >= 3 ? 'The stockade is roused!' : 'The camp is roused!')
        : camp.size >= 3 ? 'The stockade has seen you!' : 'They have seen you!', 'seen'),
    renown: () => state.renown,
    onHost: () => hud.toast('A host on the road', 'Too many for one bow. Get off the road and let them pass.'),
    onPatrolBeaten: (camp) => {
      state.stats.bands = (state.stats.bands ?? 0) + 1;
      hud.toast('', camp?.patrol?.host ? 'The host is broken! That will be sung of.' : 'The road is quiet again.');
      honour(camp?.patrol?.host ? HONOUR.host : HONOUR.band);
      hud.setTracker(quests.trackers(state));
    },
    onCampCleared: (camp) => {
      const pid = CAMP_PROVINCE[camp.id], before = pid && provinceStatus(state, pid); // (a camp made up for a test has none)
      camps.clear(camp.id);
      state.cleared.push(camp.id);
      if (!state.discovered.includes('camp:' + camp.id)) state.discovered.push('camp:' + camp.id);
      if (camp.size >= 3) hud.toast(camp.size === 4 ? 'The war-camp is broken' : 'The stockade is broken', 'Word of it will reach Henneth Ann\u00fbn.');
      else hud.toast('The camp is broken', 'Give it a little while. The land remembers how to be green.');
      if (pid) provinceNews(pid, before, provinceStatus(state, pid));
      honour(HONOUR.camp[camp.size] ?? 3);
      combat.give(inv.stashLoot(camp, lootRand), 'From their stores');
      hud.setTracker(quests.trackers(state));
      save();
    },
  });
  /** What the ranger is told when a camp falls and its province moves on. */
  function provinceNews(pid, before, after) {
    const name = provinceById[pid].name;
    if (after.freed && !before.freed) {
      hud.toast(`${name} is free`, 'The hold is broken and the land is ours again. Faramir will want to hear it from you.');
    } else if (after.holdCleared && !before.holdCleared) {
      const left = after.need - after.cleared;
      hud.toast(`The hold of ${name} is broken`, `${left} more camp${left === 1 ? '' : 's'} broken here, and ${name} is free.`);
    } else if (!after.holdCleared && after.cleared >= after.need && before.cleared < before.need) {
      hud.toast(`${name} waits on its hold`, 'Enough of its camps are broken. Break the hold, and the province is free.');
    }
  }
  const combat = new Combat({
    scene, camera, player, rig, input, state, enemies, hud,
    onLoot: () => hud.setTracker(quests.trackers(state)), // trophies and the like count at once
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
    enemies.reset(false); // camps far behind mend on their own; near ones stay wounded
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
        const node = (nodes['done_' + q.id] = { text: () => q.done + (node.got ? `\n\nReceived: ${node.got}.` : '') + (node.rose ? `\n\nYour renown grows to ${node.rose}.` : ''), options: [{ label: 'Thank you.' }] });
        extra.push({
          label: `It is done. (${q.title})`, to: 'done_' + q.id,
          do: () => {
            const r = quests.turnIn(state, q.id);
            node.got = r?.loot.length ? inv.describeLoot(r.loot) : '';
            node.rose = r?.rose ?? 0;
            refreshHud(); save();
          },
        });
      } else {
        // asked again, they give a direction; asked a third time, they mark it on the map
        nodes['remind_' + q.id] = { text: () => { const t = quests.remindText(q, state); refreshHud(); save(); return t; }, options: [{ label: 'I will see to it.', to: 'hello' }] };
        extra.push({ label: `About my task\u2026 (${q.title})`, to: 'remind_' + q.id });
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
    const errand = quests.errandFrom(id, state);
    if (errand) {
      nodes.errand = {
        text: errand.offer,
        options: [
          { label: 'I will do it.', do: () => { quests.acceptErrand(state, errand); refreshHud(); save(); hud.toast('New task', errand.title); } },
          { label: 'Not now.', to: 'hello' },
        ],
      };
      extra.push({ label: offer ? 'Is there other work?' : 'Have you a task for me?', to: 'errand' });
    }
    if (id === 'faramir' && state.quests.done.includes('f1')) {
      // his map always has a few more camps on it than the ranger's
      const scouted = quests.scoutedCamps(state);
      nodes.map = {
        text: scouted.length ? `Here. The scouts bring me word of camps you have not found; there are ${scouted.length === 1 ? 'one' : scouted.length} on mine that are not on yours. Copy them, and welcome.` : 'My map has nothing yours does not. You have found every camp there is.',
        options: [{ label: 'Thank you.', do: () => {
          for (const c of scouted) if (!state.told.includes(c.id)) state.told.push(c.id);
          save();
          if (scouted.length) setTimeout(() => { openPanel(); map.show(state, player, [], false, { title: 'Faramir\u2019s map', scouted }); }, 0);
        } }],
      };
      extra.push({ label: 'May I see your map?', to: 'map' });
    }
    const pairs = Math.floor(inv.count(state, 'athelas') / 2); // two plants to a draught; an odd one is kept
    if (id === 'eowyn' && state.quests.done.includes('e1') && pairs > 0) {
      nodes.brew = {
        text: pairs === 1 ? 'Give them here. \u2026 There: steeped, strained, and stoppered. Drink it when you must, not before.'
          : `All of them? Then sit; this takes a while. \u2026 There: ${pairs} draughts, steeped, strained and stoppered. Drink them when you must, not before.`,
        options: [{ label: 'Thank you.' }],
      };
      extra.push({
        label: `Will you steep these? (${pairs * 2} kingsfoil for ${pairs === 1 ? 'a draught' : pairs + ' draughts'})`, to: 'brew',
        do: () => { inv.removeItem(state, 'athelas', pairs * 2); inv.addItem(state, 'draught', pairs); refreshHud(); save(); },
      });
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
    if (refuge.beds.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < 1.4)) return { label: 'Rest a while', use: rest };
    return null;
  };
  /** Lie down on the mats in the cave: an hour's sleep, and the ranger rises whole. */
  const rest = () => {
    if (state.health >= 100) { hud.toast('', 'You are not weary. There is work to do.'); return; }
    // the screen fades to black, the hour passes, and it fades back in
    const veil = document.getElementById('sleep');
    if (veil.classList.contains('dark')) return;
    veil.classList.add('dark');
    setTimeout(() => {
      state.health = 100;
      hud.setHealth(state.health);
      save();
      setTimeout(() => {
        veil.classList.remove('dark');
        hud.toast('You rest', 'An hour on the mats, with the falls loud outside the window. You rise whole.');
      }, 900);
    }, 1200);
  };

  const found = (id, title, blurb) => {
    state.discovered.push(id);
    if (ruinIds.includes(id)) honour(HONOUR.place);
    else if (id.startsWith('site:')) honour(HONOUR.village);
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
      const first = !state.picked.some((id) => quests.plantKind(id) === herb.kind);
      state.picked.push(herb.id);
      inv.addItem(state, herb.kind);
      const it = ITEMS[herb.kind];
      if (first && herb.kind === 'athelas') hud.toast('Kingsfoil', 'The low plant with white stars and a pale glimmer over it. Éowyn can steep it.');
      else if (first) hud.toast(it.name, it.text);
      else hud.toast('', `${it.name} gathered (${inv.count(state, herb.kind)}).`);
      hud.setTracker(quests.trackers(state));
    }
  };

  input.onAction = (action) => {
    if (!started) return;
    if (action === 'debug') { hud.debug.hidden = !hud.debug.hidden; return; }
    if (action === 'menu') {
      const open = [dialogue, map, pack, trade, menu].find((p) => p.open);
      if (open) open.close();
      else { openPanel(); menu.show(qualityName, storage ? '' : 'Saving is not available in this browser.', { atHome: refuge.isInside(player.pos), inFight: enemies.inCombat() }, state.settings.fps); }
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
  let last = performance.now(), time = 0, slow = 0, autosave = 0, fps = 60, shade = 0, fpsCount = 0, fpsTime = 0;
  const province = { id: null, next: null, since: 0 }; // the province the ranger is in, for the notice on crossing a border
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
    { // what the ranger holds: the bow drawn with an arrow on the string, or the sword; else slung and sheathed
      const hw = combat.handWeapons(player.speed > 4);
      player.figure.setWeapons(hw.sword, hw.bow);
      player.figure.setDraw(hw.draw, hw.nocked);
      player.figure.setArrows(state.arrows);
    }
    rig.update(dt, input, player);
    hud.setCrosshair(started && state.weapon === 'bow' && (!input.touch || combat.aim) && !anyPanel(), combat.draw >= 0.8);
    if (input.enabled && (input.move.x || input.move.y)) hud.hideHint();

    ground.update(player.pos.x, player.pos.z, 1);
    grass.update(player.pos.x, player.pos.z, 2);
    updateSurfaces(time);
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
    refuge.update(time, player.pos, camera);

    for (const n of npcs) {
      // turn to face the ranger when they come close
      const dx = player.pos.x - n.x, dz = player.pos.z - n.z;
      const want = Math.hypot(dx, dz) < 7 ? Math.atan2(dx, dz) : n.home;
      let turn = want - n.figure.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      n.figure.rotation.y += turn * Math.min(1, dt * 3);
      animateFigure(n.figure, 0, dt, time + n.x);
    }

    // the frame-rate counter: frames counted over each half second
    if (started) pace(elapsed);
    fpsCount++; fpsTime += elapsed;
    if (fpsTime >= 0.5) { if (state.settings.fps) $('fps').textContent = `${Math.round(fpsCount / fpsTime)} fps`; fpsCount = 0; fpsTime = 0; }
    slow -= dt;
    if (slow <= 0 && started) {
      slow = 0.25;
      if (!down) discover();
      target = input.enabled && !down ? findTarget() : null;
      hud.setPrompt(target ? target.label : null, input.touch);
      const here = provinceAt(player.pos.x, player.pos.z);
      province.id ??= here; // where the ranger wakes is not news
      hud.setPlace(Math.hypot(player.pos.x - (HA.x - 10), player.pos.z - HA.z) < 55 ? 'Henneth Annûn' : provinceById[here].name);
      // crossing into another province: told once the ranger has been over the border a moment (no flicker along a stream)
      if (here !== province.id) { province.since = province.next === here ? province.since + 0.25 : 0; province.next = here; }
      else province.since = 0;
      if (province.since >= 1) {
        province.id = here;
        if (!down) hud.toast(fullName(provinceById[here]), `${provinceById[here].blurb} ${statusLine(provinceStatus(state, here))}`);
      }
      hud.setWeapon(state);
      state.stats.playSeconds += 0.25;
      if (!hud.debug.hidden) {
        const i = renderer.info.render, p = player.pos;
        hud.debug.textContent =
          `fps ${fps.toFixed(0)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k  chunks ${ground.chunks.size}  foes ${enemies.list.length}\n` +
          `pos ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  tier ${dangerTier(p.x, p.z)}  blight ${blight.toFixed(2)}\n` +
          `quality ${qualityName}  resolution x${sharpness.ratio}${input.haste ? '  HASTE (G)' : ''}`;
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
    ready: true, state, player, rig, input, camps, ground, grass, renderer, heightAt, save, refuge, enemies, combat, herbs, quests, inv,
    landmarks: LANDMARKS, sites: SITES, relics: RELICS, HA, WORLD,
    provinces: { PROVINCES, PROVINCE_CAMPS, HOLDS, provinceAt, status: provinceStatus },
    teleport(x, z, yaw = player.yaw, y = undefined) {
      player.place(x, z, yaw, y);
      rig.yaw = yaw;
      while (ground.update(x, z, 4) > 0) { /* build everything in range now */ }
      grass.update(x, z, 1e3);
    },
    blocked: (x, z, y, r) => blockedBySolid(x, z, y, r),
    /** Hold the camera at (x, y, z) looking at (ax, ay, az); roi.lookFrom(null) lets it go. */
    lookFrom(x, y, z, ax, ay, az, fov) { rig.hold(x === null ? null : { from: [x, y, z], at: [ax, ay, az], fov }); },
    /** Hold the camera at an offset from the ranger, looking at them, as they move; roi.follow(null) lets it go. */
    follow(dx, dy, dz, fov) { rig.hold(dx === null ? null : { offset: [dx, dy, dz], fov }); },
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

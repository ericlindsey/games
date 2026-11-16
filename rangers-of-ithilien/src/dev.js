// The testing page (debug.html, or index.html?dev). It runs the real game with
// its own save and adds a panel of shortcuts: travel by clicking the map, set
// renown and silver, hand out gear, clear camps, call up enemies. Nothing here
// is loaded in the ordinary game.

import { ITEMS } from './data/items.js';
import { QUESTS } from './data/quests.js';
import { CAMPS } from './world/campSites.js';
import { LANDMARKS } from './world/layout.js';
import { RELICS } from './world/relicSites.js';
import { SITES } from './world/oldworks.js';

export function attach(g) {
  const { state } = g;
  const el = document.createElement('div');
  el.id = 'dev';
  el.innerHTML = `
    <style>
      #dev { position: fixed; left: 8px; bottom: 8px; z-index: 50; width: 250px; max-height: 70vh; overflow-y: auto; padding: 8px 10px;
        font: 12.5px/1.4 system-ui, sans-serif; color: #e8ffe0; background: rgba(10, 18, 10, 0.86); border: 1px solid #4d6238; border-radius: 6px; }
      #dev.shut { max-height: 30px; overflow: hidden; }
      #dev h4 { margin: 8px 0 3px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #9be07a; font-weight: normal; }
      #dev header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; }
      #dev button, #dev select { font: inherit; padding: 2px 7px; margin: 2px 2px 2px 0; border-radius: 3px; border: 1px solid #6b8a4e; background: #26331f; color: inherit; cursor: pointer; }
      #dev button.on { background: #9be07a; color: #10200c; }
      #dev select { max-width: 150px; }
      #dev .line { display: flex; flex-wrap: wrap; align-items: center; }
      #dev small { color: #a8b8a0; }
      body.touch #dev { bottom: auto; top: 78px; max-height: 45vh; }
    </style>
    <header><span>Testing</span><small>tap to fold</small></header>
    <h4>Travel</h4>
    <div class="line"><button data-a="mapgo">Open map: click to go</button><button data-a="home">Home</button></div>
    <div class="line"><select id="dev-place"></select><button data-a="goplace">Go</button></div>
    <div class="line"><button data-a="haste">Haste</button><button data-a="god">Unhurt</button><button data-a="reveal">Reveal map</button></div>
    <h4>The ranger</h4>
    <div class="line"><span id="dev-renown"></span>&nbsp;<button data-a="ren-">&minus;</button><button data-a="ren+">+</button>
      <button data-a="silver">+200 silver</button><button data-a="arrows">+50 arrows</button><button data-a="mend">Mend</button></div>
    <div class="line"><select id="dev-item"></select><button data-a="give">Give</button><button data-a="kit">Best kit</button></div>
    <h4>Tasks</h4>
    <div class="line"><select id="dev-quest"></select><button data-a="qtake">Take</button><button data-a="qdone">Finish</button></div>
    <h4>The enemy</h4>
    <div class="line"><button data-a="camp">Go to nearest camp</button><button data-a="slay">Slay all here</button></div>
    <div class="line"><button data-a="clearnorth">Clear the north</button><button data-a="clearall">Clear all</button></div>
    <div class="line"><button data-a="patrol">Band on the road</button><button data-a="host">Host on the road</button></div>
    <h4>Save</h4>
    <div class="line"><button data-a="wipe">Wipe testing save</button> <small>kept apart from your real game</small></div>`;
  document.body.appendChild(el);
  const $ = (id) => el.querySelector('#' + id);
  el.querySelector('header').onclick = () => el.classList.toggle('shut');

  const places = [
    ...LANDMARKS.map((l) => [l.name, l.x, l.z + (l.flat ?? 12) + 6]),
    ...SITES.filter((s) => s.kind === 'hamlet').map((s, i) => [`Village ${i + 1}`, s.x + 12, s.z + 3]),
    ...RELICS.map((r) => [`${r.kind} (${r.id})`, r.x + 8, r.z + 10]),
    ...CAMPS.filter((c) => c.size >= 3).map((c) => [`${c.kind === 'mine' ? 'Mine' : c.size === 4 ? 'War-camp' : 'Stockade'} ${c.id}`, c.x + 40, c.z]),
  ];
  $('dev-place').innerHTML = places.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
  $('dev-item').innerHTML = Object.entries(ITEMS).map(([id, it]) => `<option value="${id}">${it.name}</option>`).join('');
  $('dev-quest').innerHTML = QUESTS.map((q) => `<option value="${q.id}">${q.giver[0].toUpperCase()}: ${q.title}</option>`).join('');

  const refresh = () => {
    $('dev-renown').textContent = `Renown ${state.renown}`;
    el.querySelector('[data-a=haste]').classList.toggle('on', g.input.haste);
    el.querySelector('[data-a=god]').classList.toggle('on', g.combat.god);
    g.refreshHud();
  };
  const go = (x, z) => { g.enemies.reset(); g.combat.reset(); g.teleport(x, z); };
  const clear = (camp) => {
    if (state.cleared.includes(camp.id)) return;
    state.cleared.push(camp.id);
    g.camps.clear(camp.id);
  };

  const actions = {
    mapgo() {
      g.map.onPick = (x, z) => { g.map.close(); g.map.onPick = null; go(x, z); };
      g.openPanel(); g.map.show(state, g.player);
    },
    home() { g.goHome('Home, by the testing door.'); },
    goplace() { const p = places[$('dev-place').value]; go(p[1], p[2]); },
    haste() { g.input.haste = !g.input.haste; },
    god() { g.combat.god = !g.combat.god; },
    reveal() {
      for (const id of [...LANDMARKS.map((l) => l.id), ...RELICS.map((r) => r.id), ...SITES.map((s) => 'site:' + s.id), ...CAMPS.map((c) => 'camp:' + c.id)]) {
        if (!state.discovered.includes(id)) state.discovered.push(id);
      }
    },
    'ren-'() { state.renown = Math.max(0, state.renown - 1); },
    'ren+'() { state.renown++; },
    silver() { state.silver += 200; },
    arrows() { state.arrows += 50; },
    mend() { state.health = 100; },
    give() { g.inv.addItem(state, $('dev-item').value); },
    kit() {
      for (const id of ['gondorBlade', 'greatBow', 'ithilienMail']) { g.inv.addItem(state, id); g.inv.equip(state, id); }
      g.inv.addItem(state, 'draught', 5);
      state.arrows += 60;
    },
    qtake() { g.quests.accept(state, $('dev-quest').value); },
    qdone() { // finished and rewarded, whatever its objective
      const id = $('dev-quest').value, q = g.quests.byId[id];
      state.quests.active = state.quests.active.filter((a) => a !== id);
      if (!state.quests.done.includes(id)) {
        state.quests.done.push(id);
        state.silver += q.reward.silver ?? 0; state.arrows += q.reward.arrows ?? 0; state.renown += q.reward.renown ?? 0;
        for (const [item, n] of Object.entries(q.reward.items ?? {})) g.inv.addItem(state, item, n);
      }
    },
    camp() {
      const p = g.player.pos;
      const c = CAMPS.filter((k) => !state.cleared.includes(k.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (c) go(c.x + 30, c.z);
    },
    slay() { for (const e of [...g.enemies.list]) g.enemies.damage(e, 1e9); },
    clearnorth() { g.enemies.reset(); for (const c of CAMPS) if (c.tier === 1) clear(c); },
    clearall() { g.enemies.reset(); for (const c of CAMPS) clear(c); },
    patrol() { const p = g.player.pos; g.enemies.spawnPatrol(p.z - 60, 1, { list: ['snaga', 'snaga', 'archer'], host: false }); },
    host() { const p = g.player.pos; g.enemies.spawnPatrol(p.z - 90, 1, { list: ['chief', 'uruk', 'uruk', 'haradrim', 'archer', 'archer', 'snaga', 'snaga', 'snaga', 'snaga', 'snaga'], host: true }); },
    wipe() { g.store.clear(); addEventListener('pagehide', (e) => e.stopImmediatePropagation(), true); location.reload(); },
  };
  el.addEventListener('click', (e) => {
    const a = e.target.dataset?.a;
    if (!a) return;
    actions[a]();
    refresh();
    if (a !== 'wipe') g.save();
  });
  refresh();
}

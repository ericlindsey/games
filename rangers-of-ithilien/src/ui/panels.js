// Panels that sit over the world: dialogue, the map, the menu and the title.

import { WORLD } from '../config.js';
import { heightAt, STREAMS } from '../world/terrain.js';
import { groundColor } from '../world/groundColor.js';
import { LANDMARKS, haradRoadX, southRoadZ, bankX } from '../world/layout.js';
import { CAMPS } from '../world/campSites.js';
import { SITES } from '../world/oldworks.js';
import { PATHS } from '../world/paths.js';
import { RELICS } from '../world/relicSites.js';
import { ITEMS } from '../data/items.js';
import * as inv from '../systems/inventory.js';
import * as quests from '../systems/quests.js';

const $ = (id) => document.getElementById(id);

// Small drawings that a speaker may show. Our own artwork, drawn here in SVG.
const PICTURES = {
  kingsfoil: `<figure style="margin:0"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#4a3d28" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#8fb37a">${[0, 52, 104, 156, 208, 260, 312].map((a) => `<path transform="rotate(${a} 60 92)" d="M60 92 C52 78 52 62 60 50 C68 62 68 78 60 92 Z"/><path transform="rotate(${a} 60 92)" d="M60 90 L60 56" stroke-width="0.9"/>`).join('')}</g>
      ${[[60, 30, 58], [44, 40, 52], [77, 38, 54], [52, 22, 46], [70, 20, 44]].map(([x, y, top]) => `<path d="M${x} ${y + 8} Q${(x + 60) / 2} ${(top + 92) / 2 + 10} 60 88" stroke="#5f7a48"/>
        <g transform="translate(${x} ${y})" fill="#fffdf4">${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M0 0 L-2.6 -5 L0 -10 L2.6 -5 Z"/>`).join('')}<circle r="1.8" fill="#e8c95a"/></g>`).join('')}
    </g></svg><figcaption>Kingsfoil. Look for the glimmer.</figcaption></figure>`,
};

export class DialoguePanel {
  constructor(onClose) {
    this.root = $('dialogue');
    this.onClose = onClose;
    this.open = false;
  }
  /** @param speaker an entry from data/dialogue.js; ctx is passed to text functions */
  start(speaker, ctx) {
    this.speaker = speaker;
    this.ctx = ctx;
    $('dialogue-name').textContent = speaker.name;
    $('dialogue-title').textContent = speaker.title;
    this.root.hidden = false;
    this.open = true;
    this.go(speaker.start);
  }
  go(id) {
    const node = this.speaker.nodes[id];
    $('dialogue-text').textContent = typeof node.text === 'function' ? node.text(this.ctx) : node.text;
    const pic = $('dialogue-picture');
    pic.hidden = !node.picture;
    if (node.picture) pic.innerHTML = PICTURES[node.picture];
    const box = $('dialogue-options');
    box.replaceChildren();
    for (const opt of node.options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.onclick = () => { opt.do?.(); if (opt.to) this.go(opt.to); else this.close(); };
      box.appendChild(b);
    }
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.onClose();
  }
}

export class MapPanel {
  constructor(onClose) {
    this.root = $('map');
    this.canvas = $('map-canvas');
    this.open = false;
    this.base = null;
    this.onClose = onClose;
    $('map-close').onclick = () => this.close();
    /** If set, called with world (x, z) when the map is clicked (used by the testing page). */
    this.onPick = null;
    this.canvas.addEventListener('click', (e) => {
      if (!this.onPick) return;
      const r = this.canvas.getBoundingClientRect();
      this.onPick(((e.clientX - r.left) / r.width) * WORLD.width, ((e.clientY - r.top) / r.height) * WORLD.length);
    });
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }

  /** The land itself, drawn once: 20 m to the pixel, tinted like an old chart. */
  drawBase() {
    const step = 10, w = WORLD.width / step, h = WORLD.length / step;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const rgb = [0, 0, 0], paper = [0.93, 0.88, 0.76];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5) * step, z = (j + 0.5) * step;
        const y = heightAt(x, z);
        const gx = heightAt(x + 8, z) - y, gz = heightAt(x, z + 8) - y;
        if (y < 0) { rgb[0] = 0.55; rgb[1] = 0.7; rgb[2] = 0.75; }
        else groundColor(x, z, y, Math.hypot(gx, gz) / 8, rgb);
        const shade = Math.max(0.55, Math.min(1.15, 1 + (gx - gz * 0.4) * 0.05)); // lit from the west
        const o = (j * w + i) * 4;
        for (let k = 0; k < 3; k++) img.data[o + k] = 255 * Math.min(1, (rgb[k] * 0.62 + paper[k] * 0.38) * shade);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.base = c;
  }

  /** @param state the saved-game state; player has x, z, yaw */
  show(state, player) {
    if (!this.base) this.drawBase();
    const scale = 0.3; // canvas pixels per metre
    const cv = this.canvas, W = WORLD.width * scale, H = WORLD.length * scale;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, W, H);

    const line = (pts, color, width, dash = []) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(x * scale, z * scale) : ctx.moveTo(x * scale, z * scale)));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke();
      ctx.setLineDash([]);
    };
    for (const st of STREAMS) line(st.points.filter((p) => p.x > bankX(p.z)).map((p) => [p.x, p.z]), 'rgba(70,120,140,0.8)', 1.3);
    for (const pts of PATHS) line(pts, 'rgba(110,85,50,0.42)', 1, [2, 3]); // the old ways, faintly
    const harad = [], south = [];
    for (let z = 0; z <= WORLD.length; z += 40) harad.push([haradRoadX(z), z]);
    for (let x = bankX(3875); x <= WORLD.width; x += 40) south.push([x, southRoadZ(x)]);
    line(harad, 'rgba(90,60,30,0.75)', 1.5, [5, 3]);
    line(south, 'rgba(90,60,30,0.75)', 1.5, [5, 3]);

    ctx.font = 'italic 600 15px Palatino, Georgia, serif';
    ctx.textBaseline = 'middle';
    for (const l of LANDMARKS) {
      if (!state.discovered.includes(l.id)) continue;
      const x = l.x * scale, y = l.z * scale;
      ctx.fillStyle = '#3a2f1f';
      ctx.beginPath(); ctx.arc(x, y, l.id === 'henneth' ? 4 : 2.5, 0, 7); ctx.fill();
      const text = l.name, tw = ctx.measureText(text).width;
      const tx = x + 6 + tw > W - 4 ? x - 6 - tw : x + 6;
      ctx.strokeStyle = 'rgba(239,228,200,0.85)'; ctx.lineWidth = 3; ctx.strokeText(text, tx, y);
      ctx.fillText(text, tx, y);
    }
    // old farms and hamlets appear once you have walked near them
    ctx.fillStyle = 'rgba(90,70,45,0.85)';
    for (const st of SITES) {
      if (!state.discovered.includes('site:' + st.id)) continue;
      for (const h of st.houses) ctx.fillRect(h.x * scale - 1.5, h.z * scale - 1.5, 3, 3);
      ctx.strokeStyle = 'rgba(90,70,45,0.5)'; ctx.lineWidth = 1;
      for (const f of st.fields) ctx.strokeRect(f.minX * scale, f.minZ * scale, (f.maxX - f.minX) * scale, (f.maxZ - f.minZ) * scale);
    }
    ctx.fillStyle = '#5a4630';
    for (const r of RELICS) {
      if (!state.discovered.includes(r.id)) continue;
      ctx.beginPath(); ctx.moveTo(r.x * scale, r.z * scale - 3.5); ctx.lineTo(r.x * scale + 3, r.z * scale + 2.5); ctx.lineTo(r.x * scale - 3, r.z * scale + 2.5); ctx.fill();
    }
    const goal = quests.tracker(state)?.target; // where the present task points
    if (goal) {
      ctx.strokeStyle = '#2f6b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(goal.x * scale, goal.z * scale, 9, 0, 7); ctx.stroke();
    }
    for (const c of CAMPS) {
      if (!state.discovered.includes('camp:' + c.id)) continue;
      const x = c.x * scale, y = c.z * scale, done = state.cleared.includes(c.id);
      ctx.strokeStyle = done ? '#3f6b3a' : '#8a2a22'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (done) { ctx.arc(x, y, 4, 0, 7); } else { ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); }
      ctx.stroke();
    }
    // the ranger: an arrow pointing the way they face
    ctx.save();
    ctx.translate(player.pos.x * scale, player.pos.z * scale);
    ctx.rotate(Math.PI - player.yaw);
    ctx.fillStyle = '#b3261e'; ctx.strokeStyle = '#fff8e4'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    this.root.hidden = false;
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.onClose();
  }
}

export class MenuPanel {
  /** @param handlers { onClose, onQuality(name), onSave(), onNew() } */
  constructor(handlers) {
    this.root = $('menu');
    this.open = false;
    this.h = handlers;
    $('menu-resume').onclick = () => this.close();
    $('menu-save').onclick = () => { $('menu-status').textContent = handlers.onSave() ? 'Saved.' : 'Could not save in this browser.'; };
    $('menu-new').onclick = () => {
      if (confirm('Begin anew? Your discoveries and cleared camps will be forgotten.')) handlers.onNew();
    };
    $('menu-travel').onclick = () => handlers.onTravel();
    for (const b of this.root.querySelectorAll('[data-quality]')) b.onclick = () => handlers.onQuality(b.dataset.quality);
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  /**
   * @param where { atHome, inFight }: at home the game can be begun anew; abroad
   *   the ranger can instead go straight home, unless the enemy has seen them.
   */
  show(quality, status, where = { atHome: true, inFight: false }) {
    $('menu-new').hidden = !where.atHome;
    const travel = $('menu-travel');
    travel.hidden = where.atHome;
    travel.disabled = where.inFight;
    travel.textContent = where.inFight ? 'No slipping away while they have seen you' : 'Return to Henneth Ann\u00fbn';
    for (const b of this.root.querySelectorAll('[data-quality]')) b.classList.toggle('on', b.dataset.quality === quality);
    $('menu-status').textContent = status;
    this.root.hidden = false;
    this.open = true;
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.h.onClose();
  }
}

function row(parent, title, note, buttons = [], cls = '') {
  const el = document.createElement('div');
  el.className = 'row-item ' + cls;
  const what = document.createElement('div');
  what.className = 'what';
  const b = document.createElement('b');
  b.textContent = title;
  b.style.fontWeight = 'normal';
  const small = document.createElement('small');
  small.textContent = note;
  what.append(b, small);
  el.append(what);
  for (const [label, fn, disabled] of buttons) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = !!disabled;
    btn.onclick = fn;
    el.append(btn);
  }
  parent.append(el);
  return el;
}
function empty(parent, text) {
  const el = document.createElement('div');
  el.className = 'empty';
  el.textContent = text;
  parent.append(el);
}
const itemNote = (it) => (it.damage ? `Damage ${it.damage}. ` : it.defence ? `Turns ${Math.round(it.defence * 100)}% of each blow. ` : it.heal ? `Restores ${it.heal}. ` : '') + it.text;

/** The ranger's pack: tasks, gear and goods. */
export class PackPanel {
  /** @param h { onClose, onChange() } */
  constructor(h) {
    this.root = $('pack');
    this.open = false;
    this.h = h;
    $('pack-close').onclick = () => this.close();
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  show(state) {
    this.state = state;
    this.root.hidden = false;
    this.open = true;
    this.draw();
  }
  draw() {
    const st = this.state;
    $('pack-purse').textContent = `${st.silver} silver \u00b7 ${st.arrows} arrows \u00b7 health ${Math.round(st.health)} of 100 \u00b7 renown ${st.renown}`;
    const tasks = $('pack-tasks'); tasks.replaceChildren();
    for (const id of st.quests.active) {
      const q = quests.byId[id], p = quests.progress(q.objective, st), done = p.have >= p.need;
      const el = row(tasks, q.title, done ? `Done. Return to ${q.giver === 'faramir' ? 'Faramir' : '\u00c9owyn'}.` : q.remind, [], 'task' + (done ? ' done' : ''));
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('div'); fill.style.width = Math.min(100, (p.have / p.need) * 100) + '%';
      bar.append(fill); el.firstChild.append(bar);
    }
    if (!st.quests.active.length) empty(tasks, st.quests.done.length ? 'No task in hand. Faramir and \u00c9owyn may have more.' : 'No task yet. Speak with Faramir or \u00c9owyn.');
    if (st.quests.done.length) empty(tasks, `Done: ${st.quests.done.map((id) => quests.byId[id].title).join(', ')}.`);

    const gear = $('pack-gear'); gear.replaceChildren();
    for (const [slot, label] of [['sword', 'Sword'], ['bow', 'Bow'], ['armour', 'Armour']]) {
      const id = st.equipped[slot];
      row(gear, id ? ITEMS[id].name : `No ${label.toLowerCase()}`, id ? itemNote(ITEMS[id]) : 'Nothing worn.');
    }
    const items = $('pack-items'); items.replaceChildren();
    const ids = Object.keys(st.items);
    for (const id of ids) {
      const it = ITEMS[id], n = st.items[id], buttons = [];
      if (it.slot) buttons.push([it.slot === 'armour' ? 'Wear' : 'Wield', () => { inv.equip(st, id); this.h.onChange(); this.draw(); }]);
      if (it.kind === 'heal') buttons.push(['Use', () => { inv.useItem(st, id); this.h.onChange(); this.draw(); }, st.health >= 100]);
      row(items, n > 1 ? `${it.name} \u00d7${n}` : it.name, itemNote(it), buttons);
    }
    if (!ids.length) empty(items, 'Empty.');
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.h.onClose();
  }
}

/** Buying and selling with Mablung. */
export class TradePanel {
  constructor(h) {
    this.root = $('trade');
    this.open = false;
    this.h = h;
    $('trade-close').onclick = () => this.close();
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  show(state) {
    this.state = state;
    this.root.hidden = false;
    this.open = true;
    this.draw();
  }
  draw() {
    const st = this.state;
    $('trade-purse').textContent = `You have ${st.silver} silver. Renown ${st.renown}: finish tasks and he will bring out better things.`;
    const buy = $('trade-buy'); buy.replaceChildren();
    for (const e of inv.shopFor(st)) {
      const price = inv.buyPrice(e), it = ITEMS[e.item];
      row(buy, e.name ?? it.name, it ? itemNote(it) : 'For the bow.', [[`Buy \u00b7 ${price}`, () => { inv.buy(st, e); this.h.onChange(); this.draw(); }, st.silver < price]]);
    }
    const sell = $('trade-sell'); sell.replaceChildren();
    const ids = Object.keys(st.items);
    for (const id of ids) {
      const it = ITEMS[id];
      row(sell, st.items[id] > 1 ? `${it.name} \u00d7${st.items[id]}` : it.name, it.text, [[`Sell \u00b7 ${inv.sellPrice(id)}`, () => { inv.sell(st, id); this.h.onChange(); this.draw(); }]]);
    }
    if (!ids.length) empty(sell, 'You carry nothing he wants.');
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.h.onClose();
  }
}

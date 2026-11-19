// Panels that sit over the world: dialogue, the map, the menu and the title.

import { WORLD } from '../config.js';
import { heightAt, STREAMS, POOLS } from '../world/terrain.js';
import { groundColor } from '../world/groundColor.js';
import { LANDMARKS, haradRoadX, southRoadZ, bankX } from '../world/layout.js';
import { CAMPS } from '../world/campSites.js';
import { SITES } from '../world/oldworks.js';
import { PATHS } from '../world/paths.js';
import { RELICS } from '../world/relicSites.js';
import { ITEMS, SHOP, SLOTS, SLOT_NAMES, REPAIR } from '../data/items.js';
import { progressOf, MAX_RENOWN } from '../systems/renown.js';
import * as inv from '../systems/inventory.js';
import * as quests from '../systems/quests.js';
import { PROVINCES, provinceAt, provinceBorders, fullName } from '../world/provinces.js';
import { provinceStatus, statusLine, freeProgress } from '../systems/provinces.js';

const $ = (id) => document.getElementById(id);

// Small drawings that a speaker may show. Our own artwork, drawn here in SVG.
const PICTURES = {
  kingsfoil: `<figure style="margin:0"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#4a3d28" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#8fb37a">${[0, 52, 104, 156, 208, 260, 312].map((a) => `<path transform="rotate(${a} 60 92)" d="M60 92 C52 78 52 62 60 50 C68 62 68 78 60 92 Z"/><path transform="rotate(${a} 60 92)" d="M60 90 L60 56" stroke-width="0.9"/>`).join('')}</g>
      ${[[60, 30, 58], [44, 40, 52], [77, 38, 54], [52, 22, 46], [70, 20, 44]].map(([x, y, top]) => `<path d="M${x} ${y + 8} Q${(x + 60) / 2} ${(top + 92) / 2 + 10} 60 88" stroke="#5f7a48"/>
        <g transform="translate(${x} ${y})" fill="#fffdf4">${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M0 0 L-2.6 -5 L0 -10 L2.6 -5 Z"/>`).join('')}<circle r="1.8" fill="#e8c95a"/></g>`).join('')}
    </g></svg><figcaption>Kingsfoil. Look for the glimmer.</figcaption></figure>`,
  seeds: `<figure style="margin:0"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#4a3d28" stroke-width="1.4" stroke-linecap="round">
      <g transform="translate(30 34)"><path d="M0 18 L0 -4" stroke="#6a7a48"/>${[-8, -2, 4].map((y, i) => `<ellipse cx="${i % 2 ? 5 : -5}" cy="${y}" rx="5" ry="3.4" fill="#a784c4"/>`).join('')}</g>
      <g transform="translate(88 34)"><path d="M0 18 L0 0" stroke="#5a4030"/><ellipse cx="0" cy="-4" rx="13" ry="9" fill="#2f5a2a"/>${[[-6, 0], [4, -6], [7, 2], [-2, -9]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#2a1a30"/>`).join('')}</g>
      <g transform="translate(30 90)">${[-8, 0, 8].map((x, i) => `<path d="M${x} 16 Q${x + 2} 2 ${x} -${6 + i * 3}" fill="none" stroke="#5f8a42"/><ellipse cx="${x}" cy="-${8 + i * 3}" rx="4.6" ry="3.6" fill="#d8302a"/>`).join('')}</g>
      <g transform="translate(88 90)"><path d="M0 18 L0 2" stroke="#6a6050"/><ellipse cx="0" cy="-3" rx="15" ry="8" fill="#7a8a62"/>${[[-7, 1], [5, -4], [8, 3]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="3.2" fill="#3a3428"/>`).join('')}</g>
    </g>
    <g font-family="Georgia, serif" font-style="italic" font-size="9" fill="#4a3d28" text-anchor="middle">
      <text x="30" y="60">thyme</text><text x="88" y="60">bay</text><text x="30" y="116">poppy</text><text x="88" y="116">olive</text>
    </g></svg><figcaption>Seed for the gardens. Look for a gold glimmer.</figcaption></figure>`,
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
    /** Called with a travel place ({ name, x, z }) when one is clicked on the map. */
    this.onTravel = null;
    this.places = [];
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * WORLD.width, z = ((e.clientY - r.top) / r.height) * WORLD.length;
      if (this.onPick) { this.onPick(x, z); return; }
      const reach = 18 * (WORLD.length / r.height); // about 18 screen pixels
      let best = null, bd = reach;
      for (const p of this.places) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && this.onTravel) this.onTravel(best);
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
    // which province each cell lies in, for washing the freed ones green
    this.cells = new Uint8Array(w * h);
    const index = Object.fromEntries(PROVINCES.map((p, i) => [p.id, i]));
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5) * step, z = (j + 0.5) * step;
        this.cells[j * w + i] = x < bankX(z) ? 255 : index[provinceAt(x, z)]; // the river is no one's
      }
    }
    this.borders = provinceBorders();
  }

  /** A soft green wash over every freed province: drawn small, scaled up smooth. */
  freedWash(free) {
    const w = this.base.width, h = this.base.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let k = 0; k < w * h; k++) {
      if (!free[this.cells[k]]) continue;
      img.data[k * 4] = 70; img.data[k * 4 + 1] = 170; img.data[k * 4 + 2] = 50; img.data[k * 4 + 3] = 105;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /**
   * @param state the saved-game state; player has x, z, yaw
   * @param places old places the ranger may travel to: [{ id, name, x, z }]
   * @param inFight true if the enemy has seen the ranger (no travelling then)
   */
  show(state, player, places = [], inFight = false, opts = {}) {
    this.places = places;
    const hint = $('map-hint'), title = $('map-title');
    title.hidden = !opts.title;
    title.textContent = opts.title ?? '';
    hint.textContent = opts.scouted ? 'The red rings are camps his scouts have seen. They are copied onto your map.'
      : !places.length ? 'The old places you find are marked here. You can travel to them by the old ways.'
      : inFight ? 'Not while the enemy has seen you.' : 'Click an old place to travel there, or Henneth Ann\u00fbn to go home.';
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
    ctx.fillStyle = 'rgba(70,120,140,0.75)';
    for (const p of POOLS) { ctx.beginPath(); ctx.arc(p.x * scale, p.z * scale, Math.max(2, p.r * scale), 0, 7); ctx.fill(); }
    for (const st of STREAMS) line(st.points.filter((p) => p.x > bankX(p.z)).map((p) => [p.x, p.z]), 'rgba(70,120,140,0.8)', 1.3);
    for (const pts of PATHS) line(pts, 'rgba(110,85,50,0.42)', 1, [2, 3]); // the old ways, faintly
    const harad = [], south = [];
    for (let z = 0; z <= WORLD.length; z += 40) harad.push([haradRoadX(z), z]);
    for (let x = bankX(3875); x <= WORLD.width; x += 40) south.push([x, southRoadZ(x)]);
    line(harad, 'rgba(90,60,30,0.75)', 1.5, [5, 3]);
    line(south, 'rgba(90,60,30,0.75)', 1.5, [5, 3]);

    // the provinces: freed ones washed green, borders, and their names
    const status = PROVINCES.map((p) => provinceStatus(state, p.id));
    if (status.some((s) => s.freed)) ctx.drawImage(this.freedWash(status.map((s) => s.freed)), 0, 0, W, H);
    for (const b of this.borders) line(b, 'rgba(120,40,30,0.55)', 2.2, [1, 4, 7, 4]);

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
    for (const t of quests.trackers(state)) { // where each task in hand points
      if (!t.target) continue;
      ctx.strokeStyle = t.done ? '#b8902a' : '#2f6b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.target.x * scale, t.target.z * scale, 9, 0, 7); ctx.stroke();
    }
    // camps Faramir has told of and the ranger has not yet found: a red ring, a broken one if only told
    for (const c of CAMPS) {
      if (state.discovered.includes('camp:' + c.id) || state.cleared.includes(c.id)) continue;
      const fresh = opts.scouted?.includes(c);
      if (!fresh && !state.told.includes(c.id)) continue;
      ctx.strokeStyle = '#8a2a22'; ctx.lineWidth = fresh ? 2.5 : 1.5;
      ctx.setLineDash(fresh ? [] : [3, 2]);
      ctx.beginPath(); ctx.arc(c.x * scale, c.z * scale, fresh ? 8 : 6, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const c of CAMPS) {
      if (!state.discovered.includes('camp:' + c.id)) continue;
      const x = c.x * scale, y = c.z * scale, done = state.cleared.includes(c.id);
      ctx.strokeStyle = done ? '#3f6b3a' : '#8a2a22'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (done) { ctx.arc(x, y, 4, 0, 7); } else { ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); }
      ctx.stroke();
    }
    // the holds, once found: a square keep, red while it stands
    for (const s of status) {
      if (!s.holdFound) continue;
      const x = s.hold.x * scale, y = s.hold.z * scale;
      ctx.strokeStyle = s.holdCleared ? '#3f6b3a' : '#8a2a22'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    }
    // the provinces' names, over the marks, with how far each is from free
    ctx.textAlign = 'center';
    PROVINCES.forEach((p, i) => {
      const s = status[i], x = p.label.x * scale, y = p.label.z * scale, fell = p.id === 'gorse' || p.id === 'ash';
      ctx.font = `600 ${fell ? 11 : 14}px Palatino, Georgia, serif`;
      const words = fell ? p.name.replace(/^The /, '').toUpperCase().split(' ') : [p.name.toUpperCase()];
      ctx.fillStyle = s.freed ? 'rgba(40,90,30,0.9)' : 'rgba(110,40,28,0.8)';
      ctx.strokeStyle = 'rgba(239,228,200,0.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      words.forEach((wd, k) => { const ty = y + (k - (words.length - 1) / 2) * 13; ctx.strokeText(wd, x, ty); ctx.fillText(wd, x, ty); });
      ctx.font = 'italic 11px Palatino, Georgia, serif';
      const note = s.freed ? 'free' : `${s.cleared} of ${s.need}`;
      const ny = y + (words.length / 2) * 13 + 4;
      ctx.strokeText(note, x, ny); ctx.fillText(note, x, ny);
    });
    ctx.textAlign = 'start';
    // ways back by the old roads: a ring round each place the ranger can travel to
    ctx.strokeStyle = 'rgba(58,47,31,0.85)'; ctx.lineWidth = 1.4;
    for (const p of places) { ctx.beginPath(); ctx.arc(p.x * scale, p.z * scale, 6.5, 0, 7); ctx.stroke(); }

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
  /** @param handlers { onClose, onQuality(name), onSave(), onNew(), onTravel(), onFps() -> now on } */
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
    $('menu-fps').onclick = () => { const on = handlers.onFps(); $('menu-fps').textContent = on ? 'Hide frame rate' : 'Show frame rate'; };
    for (const b of this.root.querySelectorAll('[data-quality]')) b.onclick = () => handlers.onQuality(b.dataset.quality);
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  /**
   * @param where { atHome, inFight }: at home the game can be begun anew; abroad
   *   the ranger can instead go straight home, unless the enemy has seen them.
   */
  show(quality, status, where = { atHome: true, inFight: false }, fps = false) {
    $('menu-fps').textContent = fps ? 'Hide frame rate' : 'Show frame rate';
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
const itemNote = (it) => (it.damage ? `${SLOT_NAMES[it.slot]}, damage ${it.damage}. ` : it.defence ? `${SLOT_NAMES[it.slot]}: turns ${Math.round(it.defence * 100)}% of each blow. ` : it.heal ? `Restores ${it.heal}. ` : '') + it.text;
/** A little bar showing how sound a weapon is. */
function condBar(el, c) {
  const bar = document.createElement('span');
  bar.className = 'cond' + (c <= 0.5 ? ' low' : '');
  bar.title = `${Math.round(c * 100)}% sound`;
  const fill = document.createElement('div'); fill.style.width = Math.round(c * 100) + '%';
  bar.append(fill);
  el.querySelector('.what b').after(bar);
}

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
    $('pack-purse').textContent = `${st.silver} silver \u00b7 ${st.arrows} arrows \u00b7 health ${Math.round(st.health)} of 100`;
    const r = progressOf(st.honour ?? 0);
    $('renown-label').textContent = r.level >= MAX_RENOWN ? `Renown ${r.level}: there is no one in Ithilien whose name is better known.`
      : `Renown ${r.level} \u00b7 ${r.have} of ${r.need} toward ${r.level + 1}`;
    $('renown-fill').style.width = Math.round(r.frac * 100) + '%';
    const tasks = $('pack-tasks'); tasks.replaceChildren();
    for (const id of st.quests.active) {
      const q = quests.questOf(st, id);
      if (!q) continue;
      const p = quests.progress(q.objective, st), done = p.have >= p.need;
      const el = row(tasks, q.title, done ? `Done. Return to ${q.giver === 'faramir' ? 'Faramir' : '\u00c9owyn'}.` : q.remind, [], 'task' + (done ? ' done' : ''));
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('div'); fill.style.width = Math.max(0, Math.min(100, (p.have / p.need) * 100)) + '%';
      bar.append(fill); el.firstChild.append(bar);
    }
    if (!st.quests.active.length) empty(tasks, st.quests.done.length ? 'No task in hand. Faramir and \u00c9owyn may have more.' : 'No task yet. Speak with Faramir or \u00c9owyn.');
    if (st.quests.done.length) empty(tasks, `Done: ${st.quests.done.map((id) => quests.byId[id]?.title).filter(Boolean).join(', ')}.`);
    const errands = Object.values(st.quests.count ?? {}).reduce((a, b) => a + b, 0);
    if (errands) empty(tasks, `Errands run: ${errands}.`);

    const land = $('pack-provinces'); land.replaceChildren();
    for (const p of PROVINCES) {
      const s = provinceStatus(st, p.id);
      const note = statusLine(s) + (s.places ? ` ${s.found} of ${s.places} old places found.` : '');
      const el = row(land, fullName(p), note, [], 'task province' + (s.freed ? ' done' : ''));
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('div');
      const fp = freeProgress(s);
      fill.style.width = Math.round((fp.have / fp.need) * 100) + '%';
      bar.append(fill); el.firstChild.append(bar);
    }

    const gear = $('pack-gear'); gear.replaceChildren();
    for (const slot of SLOTS) {
      const id = st.equipped[slot], it = ITEMS[id];
      if (!it) { row(gear, `No ${SLOT_NAMES[slot].toLowerCase()}`, 'Nothing worn.'); continue; }
      const up = inv.honed(st, id);
      const buttons = slot === 'sword' || slot === 'bow' ? [] : [['Take off', () => { inv.unequip(st, slot); this.h.onChange(); this.draw(); }]];
      const el = row(gear, it.name + (up ? ` +${up}` : ''), itemNote(it), buttons);
      if (it.damage) condBar(el, inv.condition(st, id));
    }
    const items = $('pack-items'); items.replaceChildren();
    const ids = Object.keys(st.items);
    for (const id of ids) {
      const it = ITEMS[id], n = st.items[id], buttons = [];
      if (it.slot) buttons.push([it.slot === 'armour' ? 'Wear' : 'Wield', () => { inv.equip(st, id); this.h.onChange(); this.draw(); }]);
      if (it.kind === 'heal') buttons.push(['Use', () => { inv.useItem(st, id); this.h.onChange(); this.draw(); }, st.health >= 100]);
      if (it.kind === 'kit') {
        const target = st.equipped[it.mends];
        buttons.push([st.skills?.repair ? 'Use' : 'Not learnt', () => { inv.useKit(st, id); this.h.onChange(); this.draw(); }, !st.skills?.repair || !target || inv.condition(st, target) > 0.98]);
      }
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
    $('trade-purse').textContent = `You have ${st.silver} silver. Renown ${st.renown}: as your name grows he will bring out better things.`;
    const bench = $('trade-bench'); bench.replaceChildren();
    const redraw = () => { this.h.onChange(); this.draw(); };
    for (const slot of ['sword', 'bow']) {
      const id = st.equipped[slot], it = ITEMS[id];
      if (!it) continue;
      const price = inv.repairPrice(st, id), step = inv.honeStep(st, id), up = inv.honed(st, id);
      const buttons = [[price ? `Mend \u00b7 ${price}` : 'Sound', () => { inv.repair(st, id); redraw(); }, !price || st.silver < price]];
      if (step) buttons.push([`${slot === 'sword' ? 'Hone' : 'Restring'} +${up + 1} \u00b7 ${step.price}`, () => { inv.hone(st, id); redraw(); }, st.renown < step.renown || st.silver < step.price]);
      const note = `${Math.round(inv.condition(st, id) * 100)}% sound. ` + (step ? (st.renown < step.renown ? `He will ${slot === 'sword' ? 'hone it' : 'fit a better string'} when your renown reaches ${step.renown}.` : `${slot === 'sword' ? 'A finer edge' : 'A better string'}: +1 damage.`) : 'It is as good as he can make it.');
      const el = row(bench, it.name + (up ? ` +${up}` : ''), note, buttons);
      condBar(el, inv.condition(st, id));
    }
    if (!st.skills?.repair) {
      row(bench, 'Learn to mend your own gear', st.renown >= REPAIR.teachRenown ? 'He will show you how to use a whetstone and fit a string in the field. Then he will sell you the kits.' : `He will teach you when your renown reaches ${REPAIR.teachRenown}.`,
        [[`Learn \u00b7 ${REPAIR.teachPrice}`, () => { inv.learnRepair(st); redraw(); }, !inv.canLearnRepair(st) || st.silver < REPAIR.teachPrice]]);
    }
    const buy = $('trade-buy'); buy.replaceChildren();
    for (const e of inv.shopFor(st)) {
      const price = inv.buyPrice(e), it = ITEMS[e.item], owned = it?.slot && inv.owns(st, e.item);
      const el = row(buy, e.name ?? it.name, it ? itemNote(it) : 'For the bow.',
        [[owned ? 'You have one' : `Buy \u00b7 ${price}`, () => { inv.buy(st, e); this.h.onChange(); this.draw(); }, owned || st.silver < price]]);
      if (owned) el.classList.add('owned');
    }
    const next = SHOP.find((e) => e.renown > st.renown);
    if (next) empty(buy, `More when your renown reaches ${next.renown}.`);
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

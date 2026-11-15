// Panels that sit over the world: dialogue, the map, the menu and the title.

import { WORLD } from '../config.js';
import { heightAt } from '../world/terrain.js';
import { groundColor } from '../world/groundColor.js';
import { LANDMARKS, CAMPS, haradRoadX, southRoadZ, bankX, streamZ, STREAM_COUNT, STREAM_END_X } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

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
    const box = $('dialogue-options');
    box.replaceChildren();
    for (const opt of node.options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.onclick = () => (opt.to ? this.go(opt.to) : this.close());
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
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }

  /** The land itself, drawn once: 20 m to the pixel, tinted like an old chart. */
  drawBase() {
    const step = 20, w = WORLD.width / step, h = WORLD.length / step;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const rgb = [0, 0, 0], paper = [0.93, 0.88, 0.76];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5) * step, z = (j + 0.5) * step;
        const y = heightAt(x, z);
        const gx = heightAt(x + 12, z) - y, gz = heightAt(x, z + 12) - y;
        if (y < 0) { rgb[0] = 0.55; rgb[1] = 0.7; rgb[2] = 0.75; }
        else groundColor(x, z, y, Math.hypot(gx, gz) / 12, rgb);
        const shade = Math.max(0.55, Math.min(1.15, 1 + (gx - gz * 0.4) * 0.035)); // lit from the west
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
    const scale = 4 / 20; // canvas pixels per metre
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
    for (let i = 0; i < STREAM_COUNT; i++) {
      const pts = [];
      for (let x = STREAM_END_X - 100; x > bankX(streamZ(i, x)); x -= 25) pts.push([x, streamZ(i, x)]);
      line(pts, 'rgba(70,120,140,0.8)', 1.4);
    }
    const harad = [], south = [];
    for (let z = 0; z <= WORLD.length; z += 40) harad.push([haradRoadX(z), z]);
    for (let x = bankX(6200); x <= WORLD.width; x += 40) south.push([x, southRoadZ(x)]);
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
    for (const b of this.root.querySelectorAll('[data-quality]')) b.onclick = () => handlers.onQuality(b.dataset.quality);
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
  }
  show(quality, status) {
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

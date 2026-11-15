// The sparse heads-up display: compass, place name, notices, the action prompt.

import { HA } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.place = $('place');
    this.toastEl = $('toast');
    this.prompt = $('prompt');
    this.debug = $('debug');
    this.hint = $('hint');
    this.queue = [];
    this.toastTimer = 0;
    this.marks = [];
    const compass = $('compass');
    const labels = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    for (const [text, deg] of labels) {
      const el = document.createElement('span');
      el.textContent = text;
      if (text.length > 1) el.className = 'minor';
      compass.appendChild(el);
      this.marks.push({ el, deg });
    }
    this.home = document.createElement('span');
    this.home.className = 'home';
    this.home.textContent = '◆';
    this.home.title = 'Henneth Annûn';
    compass.appendChild(this.home);
    this.compassWidth = compass.clientWidth || 320;
    addEventListener('resize', () => { this.compassWidth = compass.clientWidth || 320; });
    this.promptText = null;
  }

  show() { this.root.hidden = false; this.compassWidth = $('compass').clientWidth || 320; }

  /** Queue a notice. `small` is an optional second line. */
  toast(big, small = '') {
    this.queue.push({ big, small });
  }

  setPrompt(text, touch) {
    if (text === this.promptText) return;
    this.promptText = text;
    this.prompt.hidden = !text;
    if (text) this.prompt.innerHTML = touch ? text : `<kbd>E</kbd>${text}`;
  }

  setPlace(name) {
    if (this.place.textContent !== name) this.place.textContent = name;
  }

  hideHint() { this.hint.classList.add('gone'); }

  /**
   * @param {number} bearing camera bearing, degrees clockwise from north
   * @param {{x:number,z:number}} pos player position, for the home marker
   */
  update(dt, bearing, pos) {
    const half = this.compassWidth / 2, span = 65; // degrees shown either side
    const set = (el, deg) => {
      let rel = ((deg - bearing + 540) % 360) - 180;
      el.style.display = Math.abs(rel) > span ? 'none' : '';
      el.style.transform = `translateX(${(rel / span) * half}px)`;
    };
    for (const m of this.marks) set(m.el, m.deg);
    const dx = HA.x - pos.x, dz = HA.z - pos.z;
    if (Math.hypot(dx, dz) > 60) set(this.home, (Math.atan2(dx, -dz) * 180) / Math.PI);
    else this.home.style.display = 'none';

    this.toastTimer -= dt;
    if (this.toastTimer <= 0) {
      const next = this.queue.shift();
      if (next) {
        this.toastEl.innerHTML = `<div class="big"></div><div class="small"></div>`;
        this.toastEl.firstChild.textContent = next.big;
        this.toastEl.lastChild.textContent = next.small;
        this.toastEl.classList.add('show');
        this.toastTimer = 4.2;
        this.showing = true;
      } else if (this.showing) {
        this.toastEl.classList.remove('show');
        this.showing = false;
        this.toastTimer = 0.7;
      }
    }
  }
}

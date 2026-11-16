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
    this.task = document.createElement('span');
    this.task.className = 'task';
    this.task.textContent = '\u25B2';
    this.task.style.display = 'none';
    compass.appendChild(this.task);
    this.taskTarget = null;
    this.healthFill = $('health-fill');
    this.weapon = $('weapon');
    this.tracker = $('tracker');
    this.crosshair = $('crosshair');
    this.hurt = $('hurt');
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

  setHealth(h) { this.healthFill.style.width = Math.max(0, Math.min(100, h)) + '%'; }

  setWeapon(state) {
    const text = (state.weapon === 'bow' ? `Bow \u00b7 ${state.arrows} arrows` : `Sword \u00b7 ${state.arrows} arrows`) + ` \u00b7 ${state.silver} silver`;
    if (this.weapon.textContent !== text) this.weapon.textContent = text;
  }

  /** @param t { text, target, done } from systems/quests.js tracker(), or null */
  setTracker(t) {
    const text = t ? t.text : '';
    if (this.tracker.textContent !== text) this.tracker.textContent = text;
    this.tracker.classList.toggle('done', !!t?.done);
    this.taskTarget = t?.target ?? null;
  }

  setCrosshair(show, drawn) {
    this.crosshair.hidden = !show;
    this.crosshair.classList.toggle('drawn', !!drawn);
  }

  flashHurt() {
    this.hurt.classList.add('on');
    clearTimeout(this.hurtTimer);
    this.hurtTimer = setTimeout(() => this.hurt.classList.remove('on'), 90);
  }

  /** A word by the aiming mark when a chosen shot tells. */
  hitMark(text) {
    const el = document.getElementById('hitmark');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the fade
    el.classList.add('show');
  }

  showFallen(on) { document.getElementById('fallen').hidden = !on; }

  /**
   * @param {number} bearing camera bearing, degrees clockwise from north
   * @param {{x:number,z:number}} pos player position, for the home marker
   */
  update(dt, bearing, pos) {
    const half = this.compassWidth / 2, span = 65; // degrees shown either side
    const set = (el, deg, pin = false) => {
      let rel = ((deg - bearing + 540) % 360) - 180;
      if (pin) rel = Math.max(-span * 0.8, Math.min(span * 0.8, rel)); // markers wait at the edge, pointing the way to turn
      el.style.display = Math.abs(rel) > span ? 'none' : '';
      el.style.transform = `translateX(${(rel / span) * half}px)`;
    };
    for (const m of this.marks) set(m.el, m.deg);
    const dx = HA.x - pos.x, dz = HA.z - pos.z;
    if (Math.hypot(dx, dz) > 60) set(this.home, (Math.atan2(dx, -dz) * 180) / Math.PI, true);
    else this.home.style.display = 'none';
    const tt = this.taskTarget;
    if (tt && Math.hypot(tt.x - pos.x, tt.z - pos.z) > 12) set(this.task, (Math.atan2(tt.x - pos.x, -(tt.z - pos.z)) * 180) / Math.PI, true);
    else this.task.style.display = 'none';

    this.toastTimer -= dt;
    if (this.toastTimer <= 0) {
      const next = this.queue.shift();
      if (next) {
        this.toastEl.innerHTML = `<div class="big"></div><div class="small"></div>`;
        this.toastEl.firstChild.textContent = next.big;
        this.toastEl.lastChild.textContent = next.small;
        this.toastEl.classList.add('show');
        this.toastTimer = this.queue.length ? 2.4 : 4.2; // hurry when more is waiting
        this.showing = true;
      } else if (this.showing) {
        this.toastEl.classList.remove('show');
        this.showing = false;
        this.toastTimer = 0.5;
      }
    }
  }
}

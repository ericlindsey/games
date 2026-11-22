// The sparse heads-up display: compass, place name, notices, the action prompt.

import { HA } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

/** The most notices on the screen at once. */
const MAX_NOTES = 10;

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

  /**
   * Queue a notice: `big` a few words in colour (optional), then `small`. Every
   * notice is the same size (since v0.7); `kind` only colours it: 'great' (a
   * province freed, a settlement grown), 'task', 'warn', and the fight's 'seen',
   * 'felled' and 'hurt'. `life` is how long it stays, in seconds.
   */
  toast(big, small = '', kind = '', life = 0) {
    if (!big && !small) return;
    this.queue.push({ big, small, kind, life });
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
    const c = state.wear?.[state.equipped[state.weapon]] ?? 1; // a worn weapon is marked, so it is mended in time
    const worn = c <= 0.2 ? ' (worn)' : c <= 0.5 ? (state.weapon === 'bow' ? ' (slack)' : ' (dull)') : '';
    const text = (state.weapon === 'bow' ? `Bow${worn} \u00b7 ${state.arrows} arrows` : `Sword${worn} \u00b7 ${state.arrows} arrows`) + ` \u00b7 ${state.silver} silver`;
    if (this.weapon.textContent !== text) this.weapon.textContent = text;
  }

  /** @param list [{ text, target, done }] from systems/quests.js trackers(): every task in hand */
  setTracker(list) {
    const key = list.map((t) => (t.done ? '+' : '-') + t.text).join('|');
    if (key !== this.trackerKey) {
      this.trackerKey = key;
      this.tracker.replaceChildren(...list.map((t) => {
        const el = document.createElement('div');
        el.textContent = t.text;
        if (t.done) el.className = 'done';
        return el;
      }));
    }
    // the compass points to the first task that has a place to go
    this.taskTarget = list.find((t) => t.target)?.target ?? null;
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

  /**
   * A short line of what happens in a fight ("Orc archer felled", "They have
   * seen you!"). The newest is at the bottom; each fades after a few seconds.
   */
  callout(text, kind = '') {
    // (since v0.7 these go up the same stack as every other notice, in their own colours)
    this.toast('', text, kind || 'fight', 3);
  }

  /** A word by the aiming mark when a chosen shot tells. */
  hitMark(text) {
    // Faded by hand in update() rather than by a CSS animation: restarting a
    // CSS animation is not reliably redrawn on every browser until something
    // else forces a repaint, which is why the word sometimes appeared late.
    this.hitEl ??= document.getElementById('hitmark');
    this.hitEl.textContent = text;
    this.hitT = 1.1;
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

    if (this.hitT > 0) {
      this.hitT -= dt;
      const t = 1 - Math.max(0, this.hitT) / 1.1;
      this.hitEl.style.opacity = String(1 - t);
      this.hitEl.style.transform = `translate(-50%, ${6 - 24 * t}px)`;
    }

    // Notices stack: each new one comes in below the others (a moment apart, so
    // a burst can be read), stays a while and fades; more than ten at once and
    // the oldest goes. All one size, close together; the kind sets the colour.
    this.notes ??= [];
    this.toastTimer -= dt;
    if (this.toastTimer <= 0 && this.queue.length) {
      const next = this.queue.shift(), el = document.createElement('div');
      el.className = 'note' + (next.kind ? ' ' + next.kind : '');
      if (next.big) { const b = document.createElement('span'); b.className = 'big'; b.textContent = next.big + (next.small && !/[.!?:]$/.test(next.big) ? '.' : ''); el.append(b); }
      if (next.big && next.small) el.append(' ');
      if (next.small) { const s = document.createElement('span'); s.className = 'small'; s.textContent = next.small; el.append(s); }
      this.toastEl.append(el);
      this.notes.push({ el, t: next.life || 5.5 + Math.min(3, (next.small.length + next.big.length) / 40) });
      this.toastTimer = 0.2;
      const live = this.notes.filter((n) => n.t > 0.6);
      for (const n of live.slice(0, Math.max(0, live.length - MAX_NOTES))) n.t = 0.6; // too many: the oldest fade now
    }
    for (const n of this.notes) {
      n.t -= dt;
      n.el.classList.toggle('old', n !== this.notes[this.notes.length - 1]);
      if (n.t < 0.6) n.el.classList.add('out');
      if (n.t <= 0) n.el.remove();
    }
    this.notes = this.notes.filter((n) => n.t > 0);
  }
}

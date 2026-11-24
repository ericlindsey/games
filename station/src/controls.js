// Input: a thumb joystick (left half of the screen) and drag-to-look (right half)
// on touch; WASD/arrows and mouse drag on a desktop.

export class Controls {
  constructor(canvas, joyBase, joyKnob) {
    this.canvas = canvas;
    this.joyBase = joyBase;
    this.joyKnob = joyKnob;
    this.joy = null;        // { id, x0, y0, x, y }
    this.lookId = null;
    this.lookLast = null;
    this.look = { dx: 0, dy: 0 };
    this.stick = { x: 0, y: 0 };   // -1..1, y forward
    this.keys = new Set();
    this.wheel = 0;

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      if (e.target instanceof HTMLInputElement) e.target.blur();   // WASD walks, not nudges a slider
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const touchLike = e.pointerType !== 'mouse';
    if (touchLike && e.clientX < window.innerWidth / 2 && !this.joy) {
      this.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      this.joyBase.style.display = 'block';
      this.joyBase.style.left = `${e.clientX}px`;
      this.joyBase.style.top = `${e.clientY}px`;
      this.updateKnob();
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-gone pointer */ }
  }

  move(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy.x = e.clientX; this.joy.y = e.clientY;
      this.updateKnob();
    } else if (e.pointerId === this.lookId) {
      this.look.dx += e.clientX - this.lookLast.x;
      this.look.dy += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy = null;
      this.stick = { x: 0, y: 0 };
      this.joyBase.style.display = 'none';
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }

  updateKnob() {
    const R = 55;
    let dx = this.joy.x - this.joy.x0, dy = this.joy.y - this.joy.y0;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.stick = { x: dx / R, y: -dy / R };
  }

  /** Look deltas in pixels since the last call. */
  takeLook() {
    const l = this.look;
    this.look = { dx: 0, dy: 0 };
    return l;
  }

  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  /** Movement intent: forward and right in -1..1, and whether running. */
  intent() {
    const k = this.keys;
    let f = this.stick.y, r = this.stick.x;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    return { f, r, run: k.has('ShiftLeft') || k.has('ShiftRight') };
  }
}

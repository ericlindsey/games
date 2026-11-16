// Keyboard, mouse and touch all write to one abstract input state.
// Game code reads the state; it never looks at devices directly.

export class Input {
  /** @param {HTMLElement} surface the element that receives look/move gestures */
  constructor(surface) {
    this.surface = surface;
    this.move = { x: 0, y: 0 };   // x: strafe right, y: forward; length <= 1
    this.lookX = 0; this.lookY = 0; // accumulated look deltas (pixels), consumed each frame
    this.zoom = 0;                 // accumulated zoom steps, consumed each frame
    this.walk = false;             // toggled: walk instead of run
    this.haste = false;            // debug: move very fast
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.enabled = false;          // false while a panel is open
    this.onAction = () => {};      // 'interact' | 'map' | 'menu' | 'jump' | 'debug'
    this.keys = new Set();
    this.stick = null;             // { id, x0, y0, dx, dy }
    this.lookPointers = new Map();
    this.pinch = 0;
    this.jumpHeld = false;
    this.attackKey = false; this.attackMouse = false; this.attackButton = false;
    this.aimMouse = false;         // right mouse button held
    this.attack = false;           // true while any attack control is held

    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.stick = null; this.lookPointers.clear(); this.attackKey = this.attackMouse = false; });
    surface.addEventListener('pointerdown', (e) => this.pointerDown(e));
    addEventListener('pointermove', (e) => this.pointerMove(e));
    addEventListener('pointerup', (e) => this.pointerUp(e));
    addEventListener('pointercancel', (e) => this.pointerUp(e));
    surface.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    // Mouse buttons are read from mouse events, which fire for each button
    // separately (pointer events do not, when two are held). The first click
    // only takes hold of the mouse; after that left is a blow, right takes aim.
    surface.addEventListener('mousedown', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.surface) return;
      if (e.button === 0) this.attackMouse = true;
      if (e.button === 2) this.aimMouse = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attackMouse = false;
      if (e.button === 2) this.aimMouse = false;
    });

    this.stickEl = document.getElementById('stick');
    this.knobEl = document.getElementById('stick-knob');
    document.body.classList.toggle('touch', this.touch);
  }

  key(e, down) {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.code;
    if (down && !e.repeat) {
      if (k === 'KeyE' || k === 'Enter') this.onAction('interact');
      else if (k === 'KeyM') this.onAction('map');
      else if (k === 'Escape') this.onAction('menu');
      else if (k === 'Backquote') this.onAction('debug');
      else if (k === 'ShiftLeft' || k === 'ShiftRight') this.walk = !this.walk;
      else if (k === 'KeyG') this.haste = !this.haste;
      else if (k === 'KeyQ') this.onAction('swap');
      else if (k === 'Digit1') this.onAction('sword');
      else if (k === 'Digit2') this.onAction('bow');
      else if (k === 'KeyH') this.onAction('heal');
      else if (k === 'KeyR') this.onAction('aim');
      else if (k === 'KeyI' || k === 'Tab') { this.onAction('pack'); e.preventDefault(); }
    }
    if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (k === 'KeyF') this.attackKey = down;
  }

  pointerDown(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'touch') {
      if (!this.touch) { this.touch = true; document.body.classList.add('touch'); }
      if (!this.stick && e.clientX < innerWidth * 0.45) {
        this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
        this.showStick();
      } else {
        this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.pinch = 0;
      }
    } else {
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (document.pointerLockElement !== this.surface) {
        // the first click only takes hold of the mouse; after that, a click is a blow
        try { this.surface.requestPointerLock()?.catch?.(() => {}); } catch { /* drag-look still works */ }
      }
    }
  }

  pointerMove(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick.dx = e.clientX - this.stick.x0;
      this.stick.dy = e.clientY - this.stick.y0;
      this.showStick();
      return;
    }
    if (e.pointerType !== 'touch' && document.pointerLockElement === this.surface) {
      if (this.enabled) { this.lookX += e.movementX; this.lookY += e.movementY; }
      return;
    }
    const p = this.lookPointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    if (this.lookPointers.size >= 2) { // pinch to zoom
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...this.lookPointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoom += (this.pinch - d) / 40;
      this.pinch = d;
      return;
    }
    const scale = e.pointerType === 'touch' ? 1.6 : 1;
    this.lookX += (e.clientX - p.x) * scale;
    this.lookY += (e.clientY - p.y) * scale;
    p.x = e.clientX; p.y = e.clientY;
  }

  pointerUp(e) {
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.showStick(); }
    this.lookPointers.delete(e.pointerId);
    this.pinch = 0;

  }

  showStick() {
    const s = this.stick;
    this.stickEl.style.display = s ? 'block' : 'none';
    if (!s) return;
    const R = 56, len = Math.hypot(s.dx, s.dy), k = len > R ? R / len : 1;
    this.stickEl.style.transform = `translate(${s.x0 - 70}px, ${s.y0 - 70}px)`;
    this.knobEl.style.transform = `translate(${s.dx * k}px, ${s.dy * k}px)`;
  }

  /** Refresh the movement vector. Call once per frame. */
  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (this.stick) {
        const R = 56;
        x += Math.max(-1, Math.min(1, this.stick.dx / R));
        y -= Math.max(-1, Math.min(1, this.stick.dy / R));
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.move.x = x; this.move.y = y;
    this.jumpHeld = this.enabled && (k.has('Space') || this.jumpButton === true);
    this.attack = this.enabled && (this.attackKey || this.attackMouse || this.attackButton);
  }

  /** Take and reset the accumulated look and zoom deltas. */
  consumeLook(out) {
    out.x = this.lookX; out.y = this.lookY; out.zoom = this.zoom;
    this.lookX = this.lookY = this.zoom = 0;
    return out;
  }

  releasePointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

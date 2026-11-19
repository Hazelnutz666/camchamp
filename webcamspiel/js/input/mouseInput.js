import { PointerTracker } from './pointerTracker.js';

// Mouse / touch / pen via Pointer Events, normalized to the target element.
export class MouseInput {
  constructor() {
    this.tracker = new PointerTracker('mouse', 'mouse', 0.2);
    this.rawX = 0.5; this.rawY = 0.5;
    this.hasMoved = false;
    this.el = null;
    this.onMove = (e) => this.handle(e);
    this.onDown = (e) => { this.handle(e); this.tracker.down = true; };
    this.onUp = () => { this.tracker.down = false; };
  }

  attach(el) {
    this.detach();
    this.el = el;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
  }

  detach() {
    if (!this.el) return;
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    this.el = null;
  }

  handle(e) {
    const r = this.el.getBoundingClientRect();
    this.rawX = (e.clientX - r.left) / r.width;
    this.rawY = (e.clientY - r.top) / r.height;
    this.hasMoved = true;
  }

  update(dt) {
    if (this.hasMoved) this.tracker.feed(this.rawX, this.rawY, dt);
    return this.hasMoved ? [this.tracker.snapshot()] : [];
  }
}

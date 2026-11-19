// Turns a stream of positions into smoothed position + velocity (normalized units / second).
// Shared by mouse and camera so games see the same motion semantics from both.
export class PointerTracker {
  constructor(id, source, smoothing = 0.5) {
    this.id = id;
    this.source = source;
    this.smoothing = smoothing;
    this.x = 0.5; this.y = 0.5; this.vx = 0; this.vy = 0;
    this.visible = false;
    this.down = false;
    this.initialized = false;
  }

  feed(x, y, dt) {
    if (!this.initialized) {
      this.x = x; this.y = y; this.initialized = true;
    }
    const a = this.smoothing;
    const nx = this.x * a + x * (1 - a);
    const ny = this.y * a + y * (1 - a);
    if (dt > 0) {
      this.vx = (nx - this.x) / dt;
      this.vy = (ny - this.y) / dt;
    }
    this.x = nx; this.y = ny;
    this.visible = true;
  }

  lose() { this.visible = false; this.initialized = false; this.vx = 0; this.vy = 0; }

  snapshot() {
    const { id, source, x, y, vx, vy, down } = this;
    return { id, source, x, y, vx, vy, down, speed: Math.hypot(vx, vy) };
  }
}

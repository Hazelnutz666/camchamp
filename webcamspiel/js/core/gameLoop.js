// requestAnimationFrame loop with clamped delta time (seconds).
const MAX_DT = 0.05;

export class GameLoop {
  constructor(tick) {
    this.tick = tick;
    this.running = false;
    this.last = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() { this.running = false; }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, MAX_DT);
    this.last = now;
    this.tick(dt);
    requestAnimationFrame(this.frame);
  }
}

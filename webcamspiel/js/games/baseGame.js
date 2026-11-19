/**
 * Contract for every game mode. A mode is a folder in js/games/<id>/ whose index.js
 * default-exports a subclass of BaseGame, registered in js/games/registry.js.
 *
 * Lifecycle (driven by js/core/app.js):
 *   new Game(env) → start() → [update(dt, input) → render(ctx)]* → destroy()
 *   Pause just stops calling update(); render() keeps running.
 *   Call this.finish({ score, stats }) when the round is over.
 *
 * env = {
 *   view:       CanvasView   (view.width / view.height in CSS px, view.toPx(normalizedPoint))
 *   hud:        Hud          (hud.set({ Punkte: 10, Zeit: '0:30' }))
 *   settings:   Settings
 *   difficulty: 'easy' | 'normal' | 'hard'   (chosen on the setup screen)
 *   options:    resolved values { key: value } for meta.options (chosen on the setup screen)
 *   onFinish:   (result) => void   — use this.finish() instead of calling directly
 * }
 */
export class BaseGame {
  static meta = {
    id: 'base',
    title: 'Base',
    description: '',
    color: '#ff3d7f',
    tracking: { hands: true, pose: false }, // which MediaPipe models the mode needs
    // Per-mode options shown on the setup screen:
    // { key: { label, default, choices: [[value, text], ...] } }
    options: {},
  };

  constructor(env) {
    this.env = env;
    this.view = env.view;
    this.hud = env.hud;
    this.finished = false;
  }

  start() {}
  update(dt, input) {}
  render(ctx) {}
  destroy() {}

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.env.onFinish(result);
  }

  // Shared debug/feedback helper: draws every active pointer.
  drawPointers(ctx, input) {
    for (const p of input?.pointers ?? []) {
      const { x, y } = this.view.toPx(p);
      ctx.beginPath();
      ctx.arc(x, y, p.source === 'camera' ? 14 : 8, 0, Math.PI * 2);
      ctx.fillStyle = p.source === 'camera' ? '#2de2e6' : '#ffffff';
      ctx.fill();
    }
  }
}

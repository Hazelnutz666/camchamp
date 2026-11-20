// Keeps a canvas sized to its CSS box at device pixel ratio.
// Drawing code works in CSS pixels: use `view.width` / `view.height`.
export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.layers = new Map(); // key → { id, canvas } for drawLayer()
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Static backgrounds: runs draw(layerCtx) once into an offscreen canvas (same CSS-pixel
   * coordinates) and afterwards only blits it. Redrawn automatically when the size changes.
   */
  drawLayer(ctx, key, draw) {
    const id = `${this.width}x${this.height}@${this.dpr}`;
    let layer = this.layers.get(key);
    if (!layer || layer.id !== id) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(this.width * this.dpr));
      canvas.height = Math.max(1, Math.round(this.height * this.dpr));
      const lctx = canvas.getContext('2d');
      lctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      draw(lctx);
      layer = { id, canvas };
      this.layers.set(key, layer);
    }
    ctx.drawImage(layer.canvas, 0, 0, this.width, this.height);
  }

  // Normalized (0..1) → CSS pixels
  toPx(p) { return { x: p.x * this.width, y: p.y * this.height }; }
}

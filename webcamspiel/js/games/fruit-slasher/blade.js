// Per-pointer blade: keeps a short trail and reports the cut segment of the current frame.
const TRAIL_SECONDS = 0.14;
const SPEED_WINDOW = 0.06;

export class Blades {
  constructor() { this.trails = new Map(); } // pointerId → [{ x, y, t }]

  /**
   * Feed this frame's pointers (already in px). Returns cut segments:
   * [{ id, x1, y1, x2, y2, speed }] with speed in px/s.
   */
  update(pointers, time) {
    const seen = new Set();
    const segments = [];
    for (const p of pointers) {
      seen.add(p.id);
      const trail = this.trails.get(p.id) ?? [];
      const prev = trail[trail.length - 1];
      trail.push({ x: p.x, y: p.y, t: time });
      while (trail.length && time - trail[0].t > TRAIL_SECONDS) trail.shift();
      this.trails.set(p.id, trail);
      if (prev) {
        // Speed over a ~60 ms window: camera updates at ~30 fps while we render at 60,
        // so frame-to-frame speed would flicker between 0 and double.
        let ref = trail.find((q) => time - q.t <= SPEED_WINDOW);
        if (!ref || ref.t === time) ref = prev;
        const dt = time - ref.t;
        const speed = dt > 0 ? Math.hypot(p.x - ref.x, p.y - ref.y) / dt : 0;
        segments.push({ id: p.id, x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, speed });
      }
    }
    for (const id of this.trails.keys()) if (!seen.has(id)) this.trails.delete(id);
    return segments;
  }

  render(ctx, time, fast) {
    for (const [id, trail] of this.trails) {
      if (trail.length < 2) continue;
      const hot = fast.has(id);
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const k = 1 - (time - b.t) / TRAIL_SECONDS; // 1 = newest
        ctx.strokeStyle = hot ? `rgba(180,250,255,${k})` : `rgba(255,255,255,${k * 0.35})`;
        ctx.lineWidth = (hot ? 12 : 5) * k + 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

// Shortest distance from circle center to segment ≤ r ?
export function segmentHitsCircle(s, cx, cy, r) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - s.x1) * dx + (cy - s.y1) * dy) / len2));
  const px = s.x1 + t * dx, py = s.y1 + t * dy;
  return (cx - px) ** 2 + (cy - py) ** 2 <= r * r;
}

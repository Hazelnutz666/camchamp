// Shared visual effects for all game modes. Everything works in CSS pixels.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(max = 800) {
    this.max = max;
    this.list = [];
  }

  /**
   * burst(x, y, { count, color | colors[], speed, size, life, gravity, angle, spread, drag })
   * angle/spread in radians: default full circle.
   */
  burst(x, y, opts = {}) {
    const {
      count = 20, color = '#fff', colors = null, speed = 300, size = 4, life = 0.6,
      gravity = 900, angle = 0, spread = TAU, drag = 0.98,
    } = opts;
    for (let i = 0; i < count && this.list.length < this.max; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = speed * rand(0.3, 1);
      const l = life * rand(0.6, 1.2);
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, drag,
        size: size * rand(0.6, 1.4), life: l, maxLife: l,
        color: colors ? colors[(Math.random() * colors.length) | 0] : color,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  render(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.list = []; }
}

export class FloatingTexts {
  constructor() { this.list = []; }

  add(x, y, text, { color = '#fff', size = 28, life = 0.9, rise = 70 } = {}) {
    this.list.push({ x, y, text, color, size, life, maxLife: life, rise });
  }

  update(dt) {
    for (const t of this.list) { t.y -= t.rise * dt; t.life -= dt; }
    this.list = this.list.filter((t) => t.life > 0);
  }

  render(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.list) {
      const k = t.life / t.maxLife;
      const pop = 1 + Math.max(0, k - 0.8) * 2; // short pop-in
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `800 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

// Screen shake: call kick(strength px), wrap rendering in apply()/restore.
export class Shake {
  constructor() { this.strength = 0; }
  kick(px) { this.strength = Math.max(this.strength, px); }
  update(dt) { this.strength = Math.max(0, this.strength - dt * 60); }
  apply(ctx) {
    ctx.save();
    if (this.strength > 0) ctx.translate(rand(-1, 1) * this.strength, rand(-1, 1) * this.strength);
  }
  restore(ctx) { ctx.restore(); }
}

// Big centered countdown / announcement text. Returns true while showing.
export function drawCenterText(ctx, view, text, { color = '#fff', size = 96, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.strokeText(text, view.width / 2, view.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, view.width / 2, view.height / 2);
  ctx.restore();
}

// Small instruction line near the bottom of the screen.
export function drawHint(ctx, view, text, y = 0.8) {
  ctx.save();
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.strokeText(text, view.width / 2, view.height * y);
  ctx.fillStyle = 'rgba(238,241,255,.9)';
  ctx.fillText(text, view.width / 2, view.height * y);
  ctx.restore();
}

// True when the camera is the input source but no tracked hand/pose is currently visible.
export function cameraLost(input, needPose = false) {
  if (input?.source !== 'camera') return false;
  return needPose ? !input.pose : !input.pointers.some((p) => p.source === 'camera');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

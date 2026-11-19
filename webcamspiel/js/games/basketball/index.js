import { BaseGame } from '../baseGame.js';
import { Particles, FloatingTexts, Shake, drawCenterText, drawHint, cameraLost, formatTime } from '../../fx/effects.js';
import { FLOOR, THREE_LINE, ballRadius, hoopGeometry, drawCourt, drawBoard, drawRimAndNet, drawBall } from './court.js';

// Speeds/accelerations are in screen heights (h) per second so the game scales with the window.
const DIFFICULTY = {
  easy: { rimFactor: 4.8, assist: 0.55, spawnEvery: 2.4, maxBalls: 3, moving: false, relocate: false },
  normal: { rimFactor: 4.0, assist: 0.25, spawnEvery: 1.9, maxBalls: 3, moving: false, relocate: true },
  hard: { rimFactor: 3.4, assist: 0, spawnEvery: 1.5, maxBalls: 4, moving: true, relocate: true },
};
const GRAVITY = 2.2;       // h/s²
const THROW_SPEED = 1.1;   // hand speed (h/s) upward that releases a held ball as a throw
const THROW_SCALE = 0.8;   // hand velocity → ball velocity
const MAX_THROW = 2.8;     // h/s
const CATCH_RADIUS = 1.8;  // × ball radius
const BOUNCE = { rim: 0.55, board: 0.6, floor: 0.55 };
const SUBSTEPS = 4;        // physics substeps per frame (prevents tunnelling through the rim)
const COUNTDOWN = 3;
const HOOP_HOME = { x: 0.8, y: 0.32 };
const rand = (a, b) => a + Math.random() * (b - a);

export default class Basketball extends BaseGame {
  static meta = {
    id: 'basketball',
    title: 'Basketball',
    description: 'Fang die Bälle mit der Hand und wirf sie mit einer Schwungbewegung nach oben in den Korb.',
    color: '#ff8c2d',
    tracking: { hands: true, pose: false },
    options: {
      duration: {
        label: 'Spielzeit', default: 60,
        choices: [[30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min'], [600, '10 min'], [1800, '30 min'], [3600, '60 min']],
      },
    },
  };

  start() {
    this.cfg = DIFFICULTY[this.env.difficulty] ?? DIFFICULTY.normal;
    this.duration = this.env.options.duration;
    this.remaining = this.duration;
    this.phase = 'countdown';
    this.countdown = COUNTDOWN;
    this.overTimer = 0;
    this.time = 0;
    this.spawnTimer = 0;

    this.hoopPos = { ...HOOP_HOME };
    this.hoopTarget = { ...HOOP_HOME };
    this.netSwing = 0;

    this.balls = [];
    this.particles = new Particles();
    this.texts = new FloatingTexts();
    this.shake = new Shake();

    this.score = 0;
    this.streak = 0;
    this.stats = { hits: 0, throws: 0, misses: 0, threes: 0, swishes: 0, bestStreak: 0 };
    this.input = null;
  }

  get hoop() { return hoopGeometry(this.view, this.hoopPos, this.cfg.rimFactor); }

  update(dt, input) {
    this.input = input;
    this.time += dt;
    this.particles.update(dt);
    this.texts.update(dt);
    this.shake.update(dt);
    this.netSwing *= Math.pow(0.02, dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'play';
    } else if (this.phase === 'play') {
      this.remaining -= dt;
      this.updateHoop(dt);
      this.updateSpawning(dt);
      this.handlePointers(input);
      this.updateBalls(dt);
      if (this.remaining <= 0) {
        this.phase = 'over';
        this.overTimer = 1.8;
      }
    } else if (this.phase === 'over') {
      this.updateBalls(dt);
      this.overTimer -= dt;
      if (this.overTimer <= 0) this.finish({ score: this.score, stats: this.stats });
    }

    const { hits, throws } = this.stats;
    this.hud.set({
      Punkte: this.score,
      Zeit: formatTime(this.remaining),
      Treffer: `${hits}/${throws}`,
      Quote: throws ? `${Math.round((hits / throws) * 100)} %` : '–',
      ...(this.streak >= 3 ? { Serie: `🔥 ${this.streak}` } : {}),
    });
  }

  // --- hoop & spawning -----------------------------------------------------

  updateHoop(dt) {
    const k = 1 - Math.pow(0.05, dt); // ease toward target
    this.hoopPos.x += (this.hoopTarget.x - this.hoopPos.x) * k;
    this.hoopPos.y += (this.hoopTarget.y - this.hoopPos.y) * k;
    if (this.cfg.moving) this.hoopPos.y = this.hoopTarget.y + Math.sin(this.time * 1.4) * 0.09;
  }

  relocateHoop() {
    if (!this.cfg.relocate) return;
    this.hoopTarget = { x: rand(0.7, 0.84), y: rand(0.24, 0.42) };
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    const waiting = this.balls.filter((b) => b.state !== 'thrown').length;
    if (this.spawnTimer > 0 || waiting >= this.cfg.maxBalls) return;
    this.spawnTimer = this.cfg.spawnEvery * rand(0.8, 1.2);
    const { width: w, height: h } = this.view;
    const r = ballRadius(this.view);
    this.balls.push({
      x: rand(0.08, 0.5) * w, y: -r, vx: rand(-0.05, 0.12) * w, vy: rand(0.05, 0.25) * h,
      r, rot: 0, state: 'free', holder: null, cooldown: 0, floorTime: 0, alpha: 1,
      rimHit: false, scored: false, points: 2,
    });
  }

  // --- catching & throwing -------------------------------------------------

  handlePointers(input) {
    const { width: w, height: h } = this.view;
    const pointers = input.pointers.map((p) => ({ id: p.id, x: p.x * w, y: p.y * h, vx: p.vx * w, vy: p.vy * h }));
    const byId = new Map(pointers.map((p) => [p.id, p]));

    for (const b of this.balls) {
      if (b.state !== 'held') continue;
      const p = byId.get(b.holder);
      if (!p) { this.release(b, 0, 0, false); continue; } // hand lost → drop
      b.x = p.x; b.y = p.y; b.vx = p.vx; b.vy = p.vy;
      if (p.vy < 0 && Math.hypot(p.vx, p.vy) >= THROW_SPEED * h) this.throwBall(b, p);
    }

    const holding = new Set(this.balls.filter((b) => b.state === 'held').map((b) => b.holder));
    for (const p of pointers) {
      if (holding.has(p.id)) continue;
      let best = null, bestD = Infinity;
      for (const b of this.balls) {
        if (b.state === 'held' || b.cooldown > 0 || b.scored) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < b.r * CATCH_RADIUS && d < bestD) { best = b; bestD = d; }
      }
      if (best) {
        if (best.state === 'thrown') this.registerMiss(best); // re-caught a throw that didn't score
        Object.assign(best, { state: 'held', holder: p.id, floorTime: 0, rimHit: false, alpha: 1 });
        holding.add(p.id);
      }
    }
  }

  throwBall(b, p) {
    const h = this.view.height;
    let vx = p.vx * THROW_SCALE;
    let vy = p.vy * THROW_SCALE;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_THROW * h) { vx *= (MAX_THROW * h) / speed; vy *= (MAX_THROW * h) / speed; }
    vx = this.aimAssist(b, vx, vy);
    this.release(b, vx, vy, true);
    b.points = b.x < THREE_LINE * this.view.width ? 3 : 2;
    this.stats.throws++;
  }

  // Blend vx toward the value that would drop the ball exactly into the hoop (given vy).
  aimAssist(b, vx, vy) {
    if (!this.cfg.assist) return vx;
    const g = GRAVITY * this.view.height;
    const hoop = this.hoop;
    const D = vy * vy + 2 * g * (hoop.y - b.y);
    if (D < 0) return vx; // too weak to reach rim height
    const t = (-vy + Math.sqrt(D)) / g; // descending crossing of rim height
    if (t <= 0.05) return vx;
    const ideal = (hoop.x - b.x) / t;
    if (Math.abs(ideal - vx) > Math.abs(ideal) * 0.8) return vx; // way off → no help
    return vx + (ideal - vx) * this.cfg.assist;
  }

  release(b, vx, vy, thrown) {
    Object.assign(b, { state: thrown ? 'thrown' : 'free', holder: null, vx, vy, cooldown: thrown ? 0.5 : 0.15 });
  }

  // --- physics -------------------------------------------------------------

  updateBalls(dt) {
    const hoop = this.hoop;
    const sdt = dt / SUBSTEPS;
    for (const b of this.balls) {
      b.cooldown -= dt;
      if (b.state === 'held') continue;
      for (let i = 0; i < SUBSTEPS; i++) this.step(b, sdt, hoop);
      b.rot += (b.vx / b.r) * dt;
      if (b.floorTime > 2.5) b.alpha -= dt * 2;
    }
    const { width: w } = this.view;
    for (const b of this.balls) {
      const gone = b.alpha <= 0 || b.x < -b.r * 3 || b.x > w + b.r * 3;
      if (!gone) continue;
      b.dead = true;
      if (b.state === 'thrown' && !b.scored) this.registerMiss(b);
    }
    this.balls = this.balls.filter((b) => !b.dead);
  }

  step(b, dt, hoop) {
    const g = GRAVITY * this.view.height;
    const prevY = b.y;
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // rim points
    for (const rim of [hoop.front, hoop.back]) {
      const dx = b.x - rim.x, dy = b.y - rim.y;
      const dist = Math.hypot(dx, dy);
      const min = b.r + hoop.rimR;
      if (dist < min && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        b.x = rim.x + nx * min;
        b.y = rim.y + ny * min;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + BOUNCE.rim) * vn * nx;
          b.vy -= (1 + BOUNCE.rim) * vn * ny;
          b.rimHit = true;
        }
      }
    }

    // backboard (front face)
    const bd = hoop.board;
    if (b.y > bd.top && b.y < bd.bottom && b.x + b.r > bd.x && b.x < bd.x && b.vx > 0) {
      b.x = bd.x - b.r;
      b.vx = -b.vx * BOUNCE.board;
      b.rimHit = true;
    }

    // score: center crosses rim height downward between the rim points
    if (b.state === 'thrown' && !b.scored && b.vy > 0 && prevY < hoop.y && b.y >= hoop.y
      && b.x > hoop.front.x + hoop.rimR && b.x < hoop.back.x - hoop.rimR) {
      this.registerHit(b, hoop);
    }

    // net slows the ball a little
    if (b.y > hoop.y && b.y < hoop.y + hoop.netDepth && b.x > hoop.front.x && b.x < hoop.back.x) {
      b.vx *= Math.pow(0.15, dt);
      b.vy *= Math.pow(0.5, dt);
    }

    // floor
    const fy = FLOOR * this.view.height;
    if (b.y + b.r > fy) {
      b.y = fy - b.r;
      b.vy = -Math.abs(b.vy) * BOUNCE.floor;
      b.vx *= 0.85;
      if (Math.abs(b.vy) < 60) b.vy = 0;
      b.floorTime += dt;
      if (b.state === 'thrown' && !b.scored) this.registerMiss(b);
    }
  }

  registerHit(b, hoop) {
    b.scored = true;
    const swish = !b.rimHit;
    this.streak++;
    let points = b.points + (swish ? 1 : 0) + (this.streak >= 3 ? 1 : 0);
    this.score += points;
    this.stats.hits++;
    if (b.points === 3) this.stats.threes++;
    if (swish) this.stats.swishes++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
    this.netSwing = 1;
    this.shake.kick(5);
    this.particles.burst(hoop.x, hoop.y, { count: 40, colors: ['#ffd23d', '#ff8c2d', '#2de2e6', '#ffffff'], speed: 420, size: 4, life: 1, gravity: 500 });
    const label = [b.points === 3 ? 'DREIER!' : 'TREFFER!', swish ? 'SWISH' : ''].filter(Boolean).join(' ');
    this.texts.add(hoop.x, hoop.y - hoop.netDepth, `${label} +${points}`, { color: swish ? '#2de2e6' : '#ffd23d', size: 34, life: 1.2 });
    this.relocateHoop();
  }

  registerMiss(b) {
    b.state = 'free';
    this.stats.misses++;
    if (this.streak >= 3) this.texts.add(b.x, b.y - b.r * 2, 'Serie gerissen', { color: '#ff6b6b', size: 22 });
    this.streak = 0;
  }

  // --- rendering -----------------------------------------------------------

  render(ctx) {
    const hoop = this.hoop;
    drawCourt(ctx, this.view);
    this.shake.apply(ctx);
    drawBoard(ctx, this.view, hoop);
    for (const b of this.balls) {
      drawBall(ctx, b);
      if (b.state === 'held') {
        ctx.strokeStyle = 'rgba(45,226,230,.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    drawRimAndNet(ctx, hoop, this.netSwing * Math.sin(this.time * 30));
    this.particles.render(ctx);
    this.texts.render(ctx);
    this.shake.restore(ctx);
    this.drawPointers(ctx, this.input);

    if (this.phase === 'countdown') {
      drawCenterText(ctx, this.view, String(Math.ceil(this.countdown)), { color: '#ff8c2d', size: 140 });
      drawHint(ctx, this.view, 'Ball mit der Hand berühren = fangen · schnell nach oben schwingen = werfen');
    } else if (this.phase === 'over') {
      drawCenterText(ctx, this.view, 'ABPFIFF!', { color: '#ffd23d', size: 120 });
    } else if (this.stats.throws === 0 && this.time < COUNTDOWN + 8) {
      drawHint(ctx, this.view, 'Ball berühren zum Fangen – Schwung nach oben zum Werfen', 0.86);
    }
    if (cameraLost(this.input)) drawHint(ctx, this.view, 'Hand nicht erkannt – zeig deine Hand der Kamera', 0.1);
  }
}

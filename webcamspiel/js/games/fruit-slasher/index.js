import { BaseGame } from '../baseGame.js';
import { Particles, FloatingTexts, Shake, drawCenterText, drawHint, cameraLost, formatTime } from '../../fx/effects.js';
import { FRUIT_TYPES, BOMB, drawFruit, drawHalf } from './fruits.js';
import { Blades, segmentHitsCircle } from './blade.js';

// Physics values are relative to screen height (h) so the game plays the same at any size.
const DIFFICULTY = {
  easy: { gravity: 0.30, spawnEvery: 1.15, maxWave: 2, bombChance: 0.08, lives: 5 },
  normal: { gravity: 0.40, spawnEvery: 0.85, maxWave: 3, bombChance: 0.15, lives: 3 },
  hard: { gravity: 0.52, spawnEvery: 0.60, maxWave: 4, bombChance: 0.22, lives: 2 },
};
const SLICE_SPEED = 0.9;   // blade must move ≥ 0.9 screen heights / s to cut
const COMBO_WINDOW = 0.35; // s between cuts to keep a combo going
const COUNTDOWN = 3;
const rand = (a, b) => a + Math.random() * (b - a);

export default class FruitSlasher extends BaseGame {
  static meta = {
    id: 'fruit-slasher',
    title: 'Fruit Slasher',
    description: 'Zerschneide Früchte mit schnellen Handbewegungen – aber Finger weg von Bomben!',
    color: '#ff3d7f',
    tracking: { hands: true, pose: false },
    options: {
      duration: { label: 'Zeitlimit', default: 60, choices: [[30, '30 s'], [60, '60 s'], [90, '90 s'], [120, '2 min'], [180, '3 min']] },
    },
  };

  start() {
    this.cfg = DIFFICULTY[this.env.difficulty] ?? DIFFICULTY.normal;
    this.duration = this.env.options.duration;
    this.remaining = this.duration;
    this.lives = this.cfg.lives;
    this.phase = 'countdown';
    this.countdown = COUNTDOWN;
    this.overTimer = 0;
    this.overText = '';
    this.time = 0;
    this.spawnTimer = 0.5;
    this.flash = 0;

    this.fruits = [];
    this.halves = [];
    this.particles = new Particles();
    this.texts = new FloatingTexts();
    this.shake = new Shake();
    this.blades = new Blades();
    this.fastBlades = new Set();

    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.stats = { sliced: 0, bombs: 0, missed: 0, bestCombo: 0 };
    this.input = null;
  }

  update(dt, input) {
    this.input = input;
    this.time += dt;
    const { height: h } = this.view;

    // Blades from every pointer (camera hands + mouse)
    const pts = input.pointers.map((p) => ({ id: p.id, ...this.view.toPx(p) }));
    const segments = this.blades.update(pts, this.time);
    const cutting = segments.filter((s) => s.speed >= SLICE_SPEED * h);
    this.fastBlades = new Set(cutting.map((s) => s.id));

    this.particles.update(dt);
    this.texts.update(dt);
    this.shake.update(dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.updateHalves(dt);

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'play';
    } else if (this.phase === 'play') {
      this.remaining -= dt;
      this.updateSpawning(dt);
      this.updateFruits(dt);
      for (const s of cutting) this.cut(s);
      this.updateCombo(dt);
      if (this.remaining <= 0) this.endRound('ZEIT!');
      else if (this.lives <= 0) this.endRound('BOOM!');
    } else if (this.phase === 'over') {
      this.updateFruits(dt);
      this.overTimer -= dt;
      if (this.overTimer <= 0) this.finish({ score: this.score, stats: this.stats });
    }

    this.hud.set({
      Punkte: this.score,
      Zeit: formatTime(this.remaining),
      Leben: '♥'.repeat(Math.max(0, this.lives)) || '–',
      ...(this.combo >= 2 ? { Combo: `x${this.combo}` } : {}),
    });
  }

  // --- spawning & physics -------------------------------------------------

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const progress = 1 - this.remaining / this.duration; // 0 → 1, game speeds up
    this.spawnTimer = this.cfg.spawnEvery * (1 - 0.35 * progress) * rand(0.8, 1.2);
    const waveSize = 1 + Math.floor(Math.random() * Math.min(this.cfg.maxWave, 1 + progress * this.cfg.maxWave));
    for (let i = 0; i < waveSize; i++) this.spawn(Math.random() < this.cfg.bombChance);
  }

  spawn(isBomb) {
    const { width: w, height: h } = this.view;
    const type = isBomb ? BOMB : FRUIT_TYPES[(Math.random() * FRUIT_TYPES.length) | 0];
    const r = Math.min(w, h) * 0.055 * type.scale;
    const x = rand(0.12, 0.88) * w;
    this.fruits.push({
      type, r, x, y: -r * 1.5 - rand(0, h * 0.15),
      vx: (w / 2 - x) * rand(0, 0.35),
      vy: rand(0, 0.12) * h,
      rot: rand(0, Math.PI * 2), vr: rand(-3, 3),
    });
  }

  updateFruits(dt) {
    const g = this.cfg.gravity * this.view.height;
    for (const f of this.fruits) {
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.y - f.r > this.view.height) {
        f.dead = true;
        if (!f.type.bomb && this.phase === 'play') { this.stats.missed++; this.breakCombo(); }
      }
    }
    this.fruits = this.fruits.filter((f) => !f.dead);
  }

  updateHalves(dt) {
    const g = (this.cfg?.gravity ?? 0.4) * this.view.height * 1.4;
    for (const hf of this.halves) {
      hf.vy += g * dt;
      hf.x += hf.vx * dt;
      hf.y += hf.vy * dt;
      hf.rot += hf.vr * dt;
    }
    this.halves = this.halves.filter((hf) => hf.y - hf.r < this.view.height + 50);
  }

  // --- cutting -------------------------------------------------------------

  cut(seg) {
    for (const f of this.fruits) {
      if (f.dead || !segmentHitsCircle(seg, f.x, f.y, f.r)) continue;
      f.dead = true;
      if (f.type.bomb) this.hitBomb(f);
      else this.sliceFruit(f, seg);
    }
    this.fruits = this.fruits.filter((f) => !f.dead);
  }

  sliceFruit(f, seg) {
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    // Cut normal = local +y axis of the half's rotated frame; side -1 is the half at local y < 0,
    // so each half moves along normal * side (apart from the cut).
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const push = this.view.height * 0.25;
    for (const side of [-1, 1]) {
      this.halves.push({
        type: f.type, r: f.r, x: f.x, y: f.y, rot: angle, side,
        vx: f.vx * 0.5 + nx * push * side, vy: Math.min(f.vy, 0) + ny * push * side - push * 0.3,
        vr: side * rand(2, 5),
      });
    }
    this.particles.burst(f.x, f.y, { count: 22, colors: [f.type.juice, f.type.flesh], speed: f.r * 9, size: f.r * 0.09, life: 0.7 });

    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.stats.sliced++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.score += f.type.points;
    this.texts.add(f.x, f.y - f.r, `+${f.type.points}`, { color: f.type.juice, size: 26 });
  }

  hitBomb(f) {
    this.lives--;
    this.stats.bombs++;
    this.breakCombo();
    this.shake.kick(18);
    this.flash = 1;
    this.particles.burst(f.x, f.y, { count: 60, colors: ['#ffb02e', '#ff5b2e', '#ffe66b', '#555'], speed: f.r * 16, size: f.r * 0.14, life: 0.9, gravity: 300 });
    this.texts.add(f.x, f.y, '-1 ♥', { color: '#ff4d4d', size: 40 });
  }

  updateCombo(dt) {
    if (this.combo === 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.breakCombo();
  }

  // Ends the current combo; 3+ cuts in a row pay a bonus.
  breakCombo() {
    if (this.combo >= 3) {
      const bonus = this.combo;
      this.score += bonus;
      this.texts.add(this.view.width / 2, this.view.height * 0.3, `COMBO x${this.combo}  +${bonus}`, { color: '#ffd23d', size: 44, life: 1.2 });
    }
    this.combo = 0;
  }

  endRound(text) {
    this.breakCombo();
    this.phase = 'over';
    this.overText = text;
    this.overTimer = 1.6;
  }

  // --- rendering -----------------------------------------------------------

  render(ctx) {
    const { width: w, height: h } = this.view;
    const bg = ctx.createRadialGradient(w / 2, h * 0.4, h * 0.1, w / 2, h / 2, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#2a1840');
    bg.addColorStop(1, '#0b0d17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.shake.apply(ctx);
    for (const hf of this.halves) drawHalf(ctx, hf);
    for (const f of this.fruits) drawFruit(ctx, f, this.time);
    this.particles.render(ctx);
    this.texts.render(ctx);
    this.shake.restore(ctx);

    this.blades.render(ctx, this.time, this.fastBlades);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,220,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.phase === 'countdown') {
      const n = Math.ceil(this.countdown);
      drawCenterText(ctx, this.view, String(n), { color: '#2de2e6', size: 140, alpha: this.countdown - Math.floor(this.countdown) || 1 });
      drawHint(ctx, this.view, 'Schnelle Wischbewegung schneidet – Bomben meiden!');
    } else if (this.phase === 'over') {
      drawCenterText(ctx, this.view, this.overText, { color: this.overText === 'BOOM!' ? '#ff4d4d' : '#ffd23d', size: 120 });
    }
    if (cameraLost(this.input)) drawHint(ctx, this.view, 'Hand nicht erkannt – zeig deine Hand der Kamera', 0.88);
  }
}

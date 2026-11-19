import { BaseGame } from '../baseGame.js';
import { Particles, FloatingTexts, drawCenterText, drawHint, cameraLost } from '../../fx/effects.js';
import { Projector, GOAL_Z, GOAL_W, GOAL_H, BALL_R, drawStadium, drawGoalBack, drawGoalFrame, drawBall, drawKeeper } from './scene.js';
import { Keeper, KEEPER_DIFFICULTY } from './keeper.js';
import { KickDetector, LEG_BONES } from './kickDetector.js';

const BALLS_PER_ROUND = 10;
const GRAVITY = 9.81;
const CHARGE_PERIOD = 1.4;  // s for the power bar to go 0 → 1 → 0
const KEY_AIM_SPEED = 3.5;  // m/s with arrow keys
const NOISE = { easy: 0.8, normal: 1, hard: 1.2 }; // shot spread multiplier
const RESULT_TIME = 1.6;
const COUNTDOWN = 2;
const POST = 0.06; // post/crossbar half thickness (m)

const RESULT_LABEL = {
  goal: ['TOR!', '#3ddc84'],
  saved: ['GEHALTEN!', '#ff4d4d'],
  post: ['PFOSTEN!', '#ff8c2d'],
  wide: ['DANEBEN!', '#ff8c2d'],
  high: ['DRÜBER!', '#ff8c2d'],
};

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default class Penalty extends BaseGame {
  static meta = {
    id: 'penalty',
    title: 'Elfmeterschießen',
    description: 'Schieß mit dem Fuß aufs Tor – der Torwart liest deine Bewegung und merkt sich deine Lieblingsecke.',
    color: '#3ddc84',
    tracking: { hands: false, pose: true }, // legs need the Pose Landmarker
    options: {
      rounds: { label: 'Runden (je 10 Bälle)', default: 1, choices: [[1, '1'], [2, '2'], [3, '3'], [5, '5']] },
    },
  };

  start() {
    this.P = new Projector(this.view);
    this.diff = this.env.difficulty in KEEPER_DIFFICULTY ? this.env.difficulty : 'normal';
    this.keeper = new Keeper(KEEPER_DIFFICULTY[this.diff]);
    this.kicks = new KickDetector();
    this.particles = new Particles();
    this.texts = new FloatingTexts();
    this.rounds = this.env.options.rounds;
    this.round = 1;
    this.results = []; // per ball of the current round: 'goal' | 'saved' | ...
    this.time = 0;
    this.phase = 'countdown';
    this.timer = COUNTDOWN;
    this.aim = { x: 0, y: 1.2 };
    this.aimSource = 'mouse';
    this.lastMouse = null;
    this.charging = null; // 'mouse' | 'key'
    this.chargeTime = 0;
    this.power = 0;
    this.score = 0;
    this.streak = 0;
    this.stats = { goals: 0, shots: 0, saved: 0, missed: 0, bestStreak: 0 };
    this.input = null;
    this.resetBall();
  }

  resetBall() {
    this.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
    this.outcome = null;
    this.keeper.reset();
  }

  get ballNumber() { return this.results.length + 1; }

  update(dt, input) {
    this.input = input;
    this.time += dt;
    this.particles.update(dt);
    this.texts.update(dt);
    this.keeper.update(dt, this.time);

    // kicks are detected continuously (rest level needs calibrating) but only fire when ready
    const kick = this.kicks.update(input.pose, this.time);

    switch (this.phase) {
      case 'countdown':
        this.timer -= dt;
        if (this.timer <= 0) this.phase = 'aim';
        break;
      case 'aim':
        this.updateAim(dt, input);
        if (kick) this.shootFromKick(kick);
        break;
      case 'flight':
        this.updateFlight(dt);
        break;
      case 'result':
        this.updateFlight(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.nextBall();
        break;
      case 'roundIntro':
        this.timer -= dt;
        if (this.timer <= 0) this.phase = 'aim';
        break;
      case 'over':
        this.timer -= dt;
        if (this.timer <= 0) this.finish({ score: this.score, stats: this.stats });
        break;
    }

    const { goals, shots } = this.stats;
    this.hud.set({
      Tore: `${goals}/${shots}`,
      Ball: `${Math.min(this.ballNumber, BALLS_PER_ROUND)}/${BALLS_PER_ROUND}`,
      ...(this.rounds > 1 ? { Runde: `${this.round}/${this.rounds}` } : {}),
      Quote: shots ? `${Math.round((goals / shots) * 100)} %` : '–',
      Punkte: this.score,
    });
  }

  debugEnd() { this.finish({ score: this.score, stats: this.stats }); }

  // --- aiming (mouse / keyboard) -------------------------------------------

  updateAim(dt, input) {
    const mouse = input.pointers.find((p) => p.source === 'mouse');
    if (mouse && (!this.lastMouse || mouse.x !== this.lastMouse.x || mouse.y !== this.lastMouse.y)) {
      this.aimSource = 'mouse';
      const w = this.P.unprojectGoal(mouse.x * this.view.width, mouse.y * this.view.height);
      this.aim = { x: clamp(w.x, -GOAL_W / 2 - 1, GOAL_W / 2 + 1), y: clamp(w.y, 0.1, GOAL_H + 1) };
    }
    this.lastMouse = mouse ? { x: mouse.x, y: mouse.y } : null;

    const { held, pressed } = input.keys;
    const kx = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
    const ky = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
    if (kx || ky) {
      this.aimSource = 'key';
      this.aim.x = clamp(this.aim.x + kx * KEY_AIM_SPEED * dt, -GOAL_W / 2 - 1, GOAL_W / 2 + 1);
      this.aim.y = clamp(this.aim.y + ky * KEY_AIM_SPEED * dt, 0.1, GOAL_H + 1);
    }

    // charge power: hold mouse button or Space, release to shoot
    if (!this.charging) {
      if (mouse?.down) this.charging = 'mouse';
      else if (pressed.has('Space')) this.charging = 'key';
      this.chargeTime = 0;
    }
    if (this.charging) {
      this.chargeTime += dt;
      const ph = (this.chargeTime % CHARGE_PERIOD) / CHARGE_PERIOD;
      this.power = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const released = this.charging === 'mouse' ? !mouse?.down : !held.has('Space');
      if (released) {
        this.charging = null;
        this.shoot({ ...this.aim }, Math.max(0.1, this.power));
      }
    }
  }

  shootFromKick(kick) {
    const target = { x: kick.dirX * (GOAL_W / 2 - 0.2), y: 0.15 + kick.height * (GOAL_H - 0.2) };
    this.aim = { ...target };
    this.shoot(target, kick.power);
  }

  // --- shooting & flight ---------------------------------------------------

  shoot(aim, power) {
    if (this.phase !== 'aim') return;
    const sigma = (0.12 + 0.55 * power * power) * NOISE[this.diff];
    const target = { x: aim.x + gauss() * sigma, y: Math.max(BALL_R, aim.y + gauss() * sigma * 0.6) };
    const speed = 17 + 15 * power; // m/s
    const T = GOAL_Z / speed;
    // ballistic launch that reaches `target` on the goal plane after T seconds
    Object.assign(this.ball, {
      vx: target.x / T,
      vz: GOAL_Z / T,
      vy: (target.y - BALL_R + 0.5 * GRAVITY * T * T) / T,
    });
    this.keeper.onShot(target, T);
    this.keeper.record(target.x);
    this.lastShot = { target, power };
    this.stats.shots++;
    this.power = 0;
    this.phase = 'flight';
  }

  updateFlight(dt) {
    const b = this.ball;
    const prevZ = b.z;
    b.vy -= GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.spin += dt * 12;
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.5; b.vx *= 0.8; b.vz *= 0.8; }

    if (!this.outcome && prevZ < GOAL_Z && b.z >= GOAL_Z) this.resolve();
    if (this.outcome === 'goal' && b.z > GOAL_Z + 1.8) { b.z = GOAL_Z + 1.8; b.vz = 0; b.vx *= 0.3; } // net
  }

  resolve() {
    const b = this.ball;
    const hw = GOAL_W / 2;
    const ax = Math.abs(b.x);
    let outcome;
    if (ax > hw + BALL_R + POST || b.y > GOAL_H + BALL_R + POST) outcome = ax > hw ? 'wide' : 'high';
    else if (ax > hw - BALL_R - POST || b.y > GOAL_H - BALL_R - POST) outcome = 'post';
    else if (this.keeper.saves(b)) outcome = 'saved';
    else outcome = 'goal';
    this.outcome = outcome;

    if (outcome === 'saved' || outcome === 'post') {
      b.vz = -b.vz * 0.35;
      b.vx = (b.x - this.keeper.x) * 2 + (Math.random() - 0.5) * 4;
      b.vy = Math.abs(b.vy) * 0.6 + 1;
    }

    const p = this.P.project(b.x, b.y, GOAL_Z);
    if (outcome === 'goal') {
      // precision bonus: corners and top are worth more
      const bonus = Math.round(60 * (ax / hw) ** 2 + 40 * clamp(b.y / GOAL_H, 0, 1));
      this.streak++;
      const streakBonus = this.streak >= 3 ? 25 * (this.streak - 2) : 0;
      const pts = 100 + bonus + streakBonus;
      this.score += pts;
      this.stats.goals++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
      this.particles.burst(p.x, p.y, { count: 70, colors: ['#3ddc84', '#ffd23d', '#ffffff', '#2de2e6'], speed: 500, size: 5, life: 1.3, gravity: 400 });
      this.texts.add(p.x, p.y - 40, `+${pts}`, { color: '#3ddc84', size: 36, life: 1.3 });
    } else {
      this.streak = 0;
      if (outcome === 'saved') this.stats.saved++;
      else this.stats.missed++;
    }
    this.results.push(outcome === 'goal' ? 'goal' : outcome === 'saved' ? 'saved' : 'miss');
    this.phase = 'result';
    this.timer = RESULT_TIME;
  }

  nextBall() {
    if (this.results.length >= BALLS_PER_ROUND) {
      if (this.round >= this.rounds) {
        this.phase = 'over';
        this.timer = 2;
        return;
      }
      this.round++;
      this.results = [];
      this.phase = 'roundIntro';
      this.timer = 1.6;
    } else {
      this.phase = 'aim';
    }
    this.resetBall();
  }

  // --- rendering -----------------------------------------------------------

  render(ctx) {
    const P = this.P;
    drawStadium(ctx, P, this.time);
    drawGoalBack(ctx, P);
    const behind = this.ball.z > GOAL_Z;
    if (behind) drawBall(ctx, P, this.ball, this.time);
    drawKeeper(ctx, P, { x: this.keeper.x, lift: this.keeper.lift, handL: this.keeper.handL, handR: this.keeper.handR, lean: this.keeper.lean });
    drawGoalFrame(ctx, P);
    if (!behind) drawBall(ctx, P, this.ball, this.time);
    this.particles.render(ctx);
    this.texts.render(ctx);

    if (this.phase === 'aim') this.drawAim(ctx);
    this.drawLegs(ctx);
    this.drawBallRow(ctx);

    if (this.phase === 'countdown') {
      drawCenterText(ctx, this.view, String(Math.ceil(this.timer)), { color: '#3ddc84', size: 140 });
    } else if (this.phase === 'result') {
      const [text, color] = RESULT_LABEL[this.outcome];
      drawCenterText(ctx, this.view, text, { color, size: 110 });
    } else if (this.phase === 'roundIntro') {
      drawCenterText(ctx, this.view, `RUNDE ${this.round}`, { color: '#ffd23d', size: 110 });
    } else if (this.phase === 'over') {
      drawCenterText(ctx, this.view, `${this.stats.goals} TORE`, { color: '#ffd23d', size: 110 });
    }

    if (this.phase === 'aim') {
      const cam = this.input?.source === 'camera';
      drawHint(ctx, this.view, cam
        ? 'Schieß mit dem Fuß! Seitlich = Richtung, hoch = hohe Ecke, schnell = hart (oder Maus: halten & loslassen)'
        : 'Zielen mit Maus/Pfeiltasten · Maustaste/Leertaste halten = Schusskraft, loslassen = Schuss', 0.94);
    }
    if (cameraLost(this.input, true)) drawHint(ctx, this.view, 'Körper nicht erkannt – stell dich so hin, dass deine Beine im Bild sind', 0.1);
  }

  drawAim(ctx) {
    const p = this.P.project(this.aim.x, this.aim.y, GOAL_Z);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.moveTo(p.x - 24, p.y); ctx.lineTo(p.x + 24, p.y);
    ctx.moveTo(p.x, p.y - 24); ctx.lineTo(p.x, p.y + 24);
    ctx.stroke();
    if (this.charging) {
      const bw = 220, bh = 14;
      const x = this.view.width / 2 - bw / 2, y = this.view.height * 0.86;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(x - 3, y - 3, bw + 6, bh + 6);
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, '#3ddc84');
      g.addColorStop(0.6, '#ffd23d');
      g.addColorStop(1, '#ff4d4d');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, bw * this.power, bh);
    }
  }

  // Tracked legs from the pose model, drawn where the camera sees them.
  drawLegs(ctx) {
    const pose = this.input?.pose;
    if (!pose) return;
    const { width: w, height: h } = this.view;
    ctx.strokeStyle = 'rgba(45,226,230,.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const [a, b] of LEG_BONES) {
      const p = pose[a], q = pose[b];
      if ((p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo(q.x * w, q.y * h);
      ctx.stroke();
    }
    for (const f of this.kicks.feet) {
      const lm = pose[f.idx.ankle];
      if ((lm.visibility ?? 1) < 0.5) continue;
      ctx.fillStyle = f.kick ? '#ffd23d' : f.armed ? '#2de2e6' : '#888';
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBallRow(ctx) {
    const r = 9, gap = 6;
    const x0 = 16, y = this.view.height - 22;
    for (let i = 0; i < BALLS_PER_ROUND; i++) {
      const res = this.results[i];
      ctx.fillStyle = res === 'goal' ? '#3ddc84' : res === 'saved' ? '#ff4d4d' : res === 'miss' ? '#ff8c2d'
        : i === this.results.length ? '#ffffff' : 'rgba(255,255,255,.3)';
      ctx.beginPath();
      ctx.arc(x0 + r + i * (2 * r + gap), y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

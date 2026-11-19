// Goalkeeper AI (world meters, goal plane). Two ways to beat the shooter:
//  - react: after a reaction delay, move toward the (noisily) perceived shot target
//  - anticipate: dive early toward the zone this player has shot at most often
import { GOAL_W, GOAL_H, BALL_R } from './scene.js';

export const KEEPER_DIFFICULTY = {
  easy: { delay: 0.32, speed: 3.5, handSpeed: 6, reach: 1.3, error: 0.7, anticipate: 0.15 },
  normal: { delay: 0.24, speed: 4.5, handSpeed: 8, reach: 1.45, error: 0.45, anticipate: 0.3 },
  hard: { delay: 0.16, speed: 5.5, handSpeed: 10, reach: 1.6, error: 0.25, anticipate: 0.45 },
};

const ZONES = [{ id: 'L', x: -2.4 }, { id: 'C', x: 0 }, { id: 'R', x: 2.4 }];
const BODY_Y = 0.95;
const SAVE_RADIUS = 0.26; // arm/body thickness

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export class Keeper {
  constructor(cfg) {
    this.cfg = cfg;
    this.history = { L: 0, C: 0, R: 0 };
    this.reset();
  }

  reset() {
    this.x = 0;
    this.lift = 0;
    this.handL = { x: -0.55, y: 1.25 };
    this.handR = { x: 0.55, y: 1.25 };
    this.target = null;
    this.misread = null;
    this.clock = 0;
    this.reactAt = 0;
    this.anticipated = false;
  }

  get lean() { return Math.max(-1.2, Math.min(1.2, ((this.handL.x + this.handR.x) / 2 - this.x) * 0.9)); }

  // Called at the moment of the shot with the ball's true target on the goal plane and flight time.
  // Reacting keepers misread the shot at first and correct as the ball comes closer;
  // anticipating keepers commit early to a guessed zone (and can be beaten by a shot elsewhere).
  onShot(target, flightTime) {
    this.clock = 0;
    this.flightTime = flightTime;
    this.trueTarget = target;
    this.anticipated = Math.random() < this.cfg.anticipate;
    if (this.anticipated) {
      const zone = this.favouriteZone();
      this.target = { x: zone.x + gauss() * 0.4, y: 0.6 + Math.random() * 1.2 };
      this.misread = null;
      this.reactAt = 0.05;
    } else {
      this.misread = { x: gauss() * this.cfg.error, y: gauss() * this.cfg.error * 0.6 };
      this.reactAt = this.cfg.delay;
      this.updatePerception();
    }
  }

  updatePerception() {
    if (!this.misread) return;
    const k = Math.max(0, 1 - (this.clock / this.flightTime) * 1.3); // misread shrinks to 0 before arrival
    this.target = {
      x: this.trueTarget.x + this.misread.x * k,
      y: Math.max(0.2, this.trueTarget.y + this.misread.y * k),
    };
  }

  // Remember where the player shoots (true target X) to anticipate next time.
  record(x) {
    this.history[x < -1.2 ? 'L' : x > 1.2 ? 'R' : 'C']++;
  }

  favouriteZone() {
    // weights ∝ (count + 1)², so a clear habit gets exploited, early guesses stay random
    const weights = ZONES.map((z) => (this.history[z.id] + 1) ** 2);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ZONES.length; i++) { r -= weights[i]; if (r <= 0) return ZONES[i]; }
    return ZONES[1];
  }

  update(dt, time) {
    this.clock += dt;
    if (this.target) this.updatePerception();
    if (!this.target || this.clock < this.reactAt) {
      // idle sway on the line
      if (!this.target) {
        this.x = Math.sin(time * 1.7) * 0.25;
        this.handL = { x: this.x - 0.55, y: 1.25 + Math.sin(time * 3) * 0.05 };
        this.handR = { x: this.x + 0.55, y: 1.25 + Math.cos(time * 3) * 0.05 };
      }
      return;
    }
    const t = this.target;
    const hw = GOAL_W / 2;
    // body travels part of the way, arms reach the rest
    const bodyGoal = Math.max(-hw + 0.4, Math.min(hw - 0.4, t.x * 0.55));
    this.x += clampStep(bodyGoal - this.x, this.cfg.speed * dt);
    this.lift = Math.min(0.5, Math.max(0, (t.y - 1.4) * 0.4));
    const dir = Math.sign(t.x - this.x) || 1;
    const want = { x: t.x, y: Math.min(GOAL_H + 0.1, t.y) };
    // limit to reach from body center
    const dx = want.x - this.x, dy = want.y - (BODY_Y + this.lift);
    const d = Math.hypot(dx, dy);
    const k = d > this.cfg.reach ? this.cfg.reach / d : 1;
    const reachPoint = { x: this.x + dx * k, y: BODY_Y + this.lift + dy * k };
    const step = this.cfg.handSpeed * dt;
    for (const [hand, off] of [[this.handL, -0.15 * dir], [this.handR, 0.15 * dir]]) {
      hand.x += clampStep(reachPoint.x + off * 0.3 - hand.x, step);
      hand.y += clampStep(reachPoint.y + Math.abs(off) * 0.2 - hand.y, step);
    }
  }

  // Ball at the goal plane: blocked by body or arms?
  saves(ball) {
    const body = { x: this.x, y: BODY_Y + this.lift };
    const r = SAVE_RADIUS + BALL_R;
    if (Math.abs(ball.x - body.x) < 0.3 + BALL_R && ball.y < 1.85 + this.lift && ball.y > this.lift) return true;
    return [this.handL, this.handR].some((h) => distToSegment(ball, body, h) < r);
  }
}

function clampStep(delta, max) {
  return Math.max(-max, Math.min(max, delta));
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

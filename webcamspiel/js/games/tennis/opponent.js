// Opponent AI: predicts where it can meet the ball, runs there after a reaction delay,
// and returns with a target chosen away from the player's racket. Makes unforced errors.
import { COURT_L, SINGLES_HW, NET_Z } from './scene.js';
import { predictIntercept } from './physics.js';

export const OPP_DIFFICULTY = {
  easy: { speed: 4.2, reach: 1.1, delay: 0.35, errorRate: 0.2, pace: 15, aimWidth: 2.2, depth: [5, 9], smart: 0.3 },
  normal: { speed: 5.6, reach: 1.25, delay: 0.25, errorRate: 0.11, pace: 19, aimWidth: 3.0, depth: [3, 9.5], smart: 0.55 },
  hard: { speed: 7, reach: 1.4, delay: 0.15, errorRate: 0.05, pace: 24, aimWidth: 3.4, depth: [2, 10], smart: 0.8 },
};

const HOME = { x: 0, z: COURT_L + 1 };
const rand = (a, b) => a + Math.random() * (b - a);

export class Opponent {
  constructor(cfg) {
    this.cfg = cfg;
    this.x = HOME.x;
    this.z = HOME.z;
    this.swing = 0;
    this.side = 1;
    this.plan = null;
    this.clock = 0;
  }

  reset(x = 0) {
    this.x = x;
    this.z = HOME.z;
    this.plan = null;
  }

  planIntercept(ball) {
    this.plan = predictIntercept(ball);
    this.clock = 0;
  }

  update(dt) {
    this.swing = Math.max(0, this.swing - dt * 3);
    this.clock += dt;
    const goal = this.plan && this.clock >= this.cfg.delay ? { x: this.plan.x - 0.5 * this.side, z: Math.max(this.plan.z, NET_Z + 1) } : HOME;
    const speed = this.plan ? this.cfg.speed : this.cfg.speed * 0.4;
    const dx = goal.x - this.x, dz = goal.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01) {
      const k = Math.min(1, (speed * dt) / d);
      this.x += dx * k;
      this.z += dz * k;
    }
    if (this.plan) this.side = this.plan.x >= this.x ? 1 : -1;
  }

  // Racket is ~0.5 m to the side of the body.
  canReach(ball) {
    return Math.abs(ball.x - (this.x + 0.5 * this.side)) < this.cfg.reach && ball.y < 2.8 && ball.y > 0.05;
  }

  // Returns { target: {x, z}, pace, clearNet } for the return shot.
  chooseShot(racketX, serve = false) {
    this.swing = 1;
    this.plan = null;
    const c = this.cfg;
    if (!serve && Math.random() < c.errorRate) {
      const kind = Math.random() < 0.5 ? 'out' : 'net';
      if (kind === 'net') return { target: { x: rand(-2, 2), z: NET_Z + rand(0.5, 2) }, pace: c.pace, clearNet: false };
      return Math.random() < 0.5
        ? { target: { x: Math.sign(Math.random() - 0.5) * rand(SINGLES_HW + 0.2, SINGLES_HW + 1.2), z: rand(3, 9) }, pace: c.pace, clearNet: true }
        : { target: { x: rand(-2, 2), z: -rand(0.4, 2) }, pace: c.pace, clearNet: true };
    }
    // smart: aim to the side away from the player's racket
    let x;
    if (Math.random() < c.smart) x = -Math.sign(racketX || (Math.random() - 0.5)) * rand(0.5, 1) * c.aimWidth;
    else x = rand(-c.aimWidth, c.aimWidth);
    const z = serve ? rand(7, NET_Z - 0.8) : rand(c.depth[0], c.depth[1]);
    return { target: { x, z }, pace: c.pace * (serve ? 1.15 : rand(0.85, 1.1)), clearNet: true };
  }
}

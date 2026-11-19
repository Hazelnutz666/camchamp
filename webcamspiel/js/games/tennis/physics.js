// Ball flight with gravity, spin (topspin dips faster, slice floats), bounce and net crossing.
import { NET_Z, NET_H, BALL_R, COURT_L } from './scene.js';

export const G = 9.81;
const SPIN_ACC = 5;       // extra downward m/s² at spin = 1 (topspin), negative spin floats
const BOUNCE = 0.72;
const NET_HALF_W = 6.4;

const gravity = (spin) => G + spin * SPIN_ACC;

// Advances the ball; returns { bounce: {x, z} | null, net: bool }.
export function stepBall(b, dt) {
  const prevZ = b.z;
  b.vy -= gravity(b.spin) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  let net = false, bounce = null;
  if ((prevZ - NET_Z) * (b.z - NET_Z) < 0 && b.y < NET_H + BALL_R && Math.abs(b.x) < NET_HALF_W) net = true;
  if (b.y <= BALL_R && b.vy < 0) {
    b.y = BALL_R;
    b.vy = -b.vy * BOUNCE;
    b.vx *= 0.9;
    b.vz *= 0.86 + b.spin * 0.08; // topspin kicks forward, slice skids/slows
    b.spin *= 0.5;
    bounce = { x: b.x, z: b.z };
  }
  return { bounce, net, prevZ };
}

// Launch velocity so the ball lands at target (y = ball radius) after T seconds.
export function launch(from, target, T, spin) {
  const g = gravity(spin);
  return {
    vx: (target.x - from.x) / T,
    vz: (target.z - from.z) / T,
    vy: (BALL_R - from.y + 0.5 * g * T * T) / T,
  };
}

export function heightAtNet(from, v, spin) {
  const t = (NET_Z - from.z) / v.vz;
  if (!(t > 0)) return Infinity;
  return from.y + v.vy * t - 0.5 * gravity(spin) * t * t;
}

/**
 * Where should the player meet a ball the opponent just hit? Normally at the baseline (Z = 0),
 * but a short ball would bounce twice before getting there, so the player "runs in" to meet it
 * between its first and second bounce.
 */
export function predictPlayerZ(ball) {
  const b = { ...ball };
  const dt = 1 / 120;
  let z1 = null;
  for (let t = 0; t < 4; t += dt) {
    const { bounce } = stepBall(b, dt);
    if (b.z <= 0) return 0;
    if (bounce && z1 === null) z1 = bounce.z;
    else if (bounce) return Math.min(NET_Z - 2, Math.max(0, (z1 + bounce.z) / 2));
  }
  return 0;
}

/**
 * Where can the opponent meet a ball the player just hit? Simulates the flight:
 * after the first bounce the opponent wants the ball ~2.5 m later (or at the 2nd bounce).
 */
export function predictIntercept(ball) {
  const b = { ...ball };
  const dt = 1 / 120;
  let bounceZ = null, interceptZ = null;
  for (let t = 0; t < 4; t += dt) {
    const prevZ = b.z;
    const { bounce } = stepBall(b, dt);
    if (bounce && bounceZ === null) {
      bounceZ = bounce.z;
      interceptZ = Math.min(COURT_L + 3, Math.max(NET_Z + 1.5, bounceZ + 2.5));
    } else if (bounce) {
      return { x: b.x, y: b.y, z: b.z, t, bounceZ };
    }
    if (interceptZ !== null && prevZ < interceptZ && b.z >= interceptZ) return { x: b.x, y: b.y, z: interceptZ, t, bounceZ };
  }
  return { x: b.x, y: b.y, z: Math.min(b.z, COURT_L + 3), t: 4, bounceZ };
}

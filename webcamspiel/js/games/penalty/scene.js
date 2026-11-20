// First-person penalty scene: world in meters, simple perspective projection.
// World axes: X lateral (right +), Y height (up +), Z distance from the penalty spot (toward goal +).
export const GOAL_Z = 11;
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const BALL_R = 0.11;
const NET_DEPTH = 2;
const CAM_H = 1.0;   // eye height
const CAM_BACK = 4;  // camera stands 4 m behind the ball
const TAU = Math.PI * 2;

export class Projector {
  constructor(view) { this.view = view; }

  get F() { return Math.min(1.23 * this.view.width, 2.2 * this.view.height); }
  get horizon() { return this.view.height * 0.36; }

  project(X, Y, Z) {
    const s = this.F / (Z + CAM_BACK);
    return { x: this.view.width / 2 + X * s, y: this.horizon + (CAM_H - Y) * s, s };
  }

  // Screen point → world point on the goal plane (Z = GOAL_Z).
  unprojectGoal(sx, sy) {
    const s = this.F / (GOAL_Z + CAM_BACK);
    return { x: (sx - this.view.width / 2) / s, y: CAM_H - (sy - this.horizon) / s };
  }
}

// Seeded so the crowd doesn't flicker between frames.
function crowdPattern(n) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const colors = ['#ff3d7f', '#2de2e6', '#ffd23d', '#ffffff', '#3ddc84', '#8e44ad'];
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), c: colors[(rnd() * colors.length) | 0] }));
}
// Grouped by color: one fill per color instead of 900 fillStyle switches per frame.
const CROWD = Object.entries(crowdPattern(900).reduce((groups, p) => {
  (groups[p.c] ??= []).push(p);
  return groups;
}, {}));

// Static parts are cached as layers (view.drawLayer); only the bobbing crowd is drawn per frame.
export function drawStadium(ctx, P, time) {
  P.view.drawLayer(ctx, 'penalty-sky', (lctx) => drawSky(lctx, P));
  drawCrowd(ctx, P, time);
  P.view.drawLayer(ctx, 'penalty-pitch', (lctx) => { drawPitch(lctx, P); drawGoalBack(lctx, P); });
}

const standTopOf = (P) => P.horizon * 0.35;

function drawSky(ctx, P) {
  const { width: w } = P.view;
  const hz = P.horizon;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#060814');
  sky.addColorStop(1, '#1a2340');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hz);
  const standTop = standTopOf(P);
  ctx.fillStyle = '#141a30';
  ctx.fillRect(0, standTop, w, hz - standTop);
}

function drawCrowd(ctx, P, time) {
  const { width: w } = P.view;
  const hz = P.horizon;
  const standTop = standTopOf(P);
  ctx.globalAlpha = 0.55;
  for (const [color, people] of CROWD) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const p of people) {
      const y = standTop + p.y * (hz - standTop - 4);
      ctx.rect(p.x * w, y + Math.sin(time * 6 + p.x * 40) * 1.2, 3, 3);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPitch(ctx, P) {
  const { width: w, height: h } = P.view;
  const hz = P.horizon;

  // floodlights
  for (const lx of [0.12, 0.88]) {
    const g = ctx.createRadialGradient(lx * w, hz * 0.15, 0, lx * w, hz * 0.15, w * 0.25);
    g.addColorStop(0, 'rgba(255,255,230,.35)');
    g.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // grass stripes in perspective
  for (let z = -CAM_BACK + 0.2, i = 0; z < 60; z += 2.5, i++) {
    const a = P.project(0, 0, z), b = P.project(0, 0, z + 2.5);
    ctx.fillStyle = i % 2 ? '#1f7a3a' : '#238a42';
    ctx.fillRect(0, b.y, w, a.y - b.y + 1);
  }
  ctx.fillStyle = '#1b6a33';
  ctx.fillRect(0, hz, w, P.project(0, 0, 60).y - hz + 1);

  // lines
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 2;
  line(ctx, P, [-30, 0, GOAL_Z], [30, 0, GOAL_Z]);                // goal line
  const box6 = [[-9.16, GOAL_Z], [-9.16, GOAL_Z - 5.5], [9.16, GOAL_Z - 5.5], [9.16, GOAL_Z]];
  poly(ctx, P, box6);
  const box16 = [[-20.16, GOAL_Z], [-20.16, GOAL_Z - 16.5], [20.16, GOAL_Z - 16.5], [20.16, GOAL_Z]];
  poly(ctx, P, box16);
  const spot = P.project(0, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(spot.x, spot.y + BALL_R * spot.s * 0.6, 0.11 * spot.s, 0.035 * spot.s, 0, 0, TAU);
  ctx.fill();
}

function drawGoalBack(ctx, P) {
  const hw = GOAL_W / 2;
  const back = GOAL_Z + NET_DEPTH;
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1;
  // back net
  for (let x = -hw; x <= hw + 0.01; x += 0.35) line(ctx, P, [x, 0, back], [x, GOAL_H * 0.8, back]);
  for (let y = 0; y <= GOAL_H * 0.8; y += 0.35) line(ctx, P, [-hw, y, back], [hw, y, back]);
  // side + roof nets
  for (let z = GOAL_Z; z <= back + 0.01; z += 0.35) {
    const yTop = GOAL_H - (GOAL_H * 0.2) * ((z - GOAL_Z) / NET_DEPTH);
    line(ctx, P, [-hw, 0, z], [-hw, yTop, z]);
    line(ctx, P, [hw, 0, z], [hw, yTop, z]);
    line(ctx, P, [-hw, yTop, z], [hw, yTop, z]);
  }
}

export function drawGoalFrame(ctx, P) {
  const hw = GOAL_W / 2;
  const s = P.project(0, 0, GOAL_Z).s;
  ctx.strokeStyle = '#f4f6ff';
  ctx.lineWidth = Math.max(3, 0.12 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const a = P.project(-hw, 0, GOAL_Z), b = P.project(-hw, GOAL_H, GOAL_Z);
  const c = P.project(hw, GOAL_H, GOAL_Z), d = P.project(hw, 0, GOAL_Z);
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.stroke();
}

export function drawBall(ctx, P, ball, time) {
  // shadow
  const sh = P.project(ball.x, 0, ball.z);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, BALL_R * sh.s * 1.1, BALL_R * sh.s * 0.35, 0, 0, TAU);
  ctx.fill();

  const p = P.project(ball.x, ball.y, ball.z);
  const r = Math.max(2, BALL_R * p.s);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ball.spin ?? 0);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#b9bfd0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1b1f2e';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    pentagon(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.22);
  }
  pentagon(ctx, 0, 0, r * 0.3);
  ctx.restore();
}

/**
 * Goalkeeper figure. k = { x, handL:{x,y}, handR:{x,y}, lean }
 */
export function drawKeeper(ctx, P, k) {
  const z = GOAL_Z - 0.3;
  const hip = P.project(k.x, 0.95 + k.lift, z);
  const s = hip.s;
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(k.lean);
  const u = s; // 1 m in px
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = '#1b1f2e';
  ctx.lineWidth = 0.16 * u;
  ctx.beginPath();
  ctx.moveTo(-0.12 * u, 0); ctx.lineTo(-0.22 * u, 0.9 * u);
  ctx.moveTo(0.12 * u, 0); ctx.lineTo(0.22 * u, 0.9 * u);
  ctx.stroke();
  // torso
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.roundRect(-0.25 * u, -0.7 * u, 0.5 * u, 0.75 * u, 0.1 * u);
  ctx.fill();
  ctx.fillStyle = '#1b1f2e';
  ctx.font = `800 ${Math.round(0.3 * u)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 0, -0.33 * u);
  // head
  ctx.fillStyle = '#e0ac80';
  ctx.beginPath();
  ctx.arc(0, -0.86 * u, 0.13 * u, 0, TAU);
  ctx.fill();
  ctx.restore();

  // arms (world-space hands so they reach where the save check says)
  const shoulder = (side) => {
    const local = { x: side * 0.25 * u, y: -0.62 * u };
    const c = Math.cos(k.lean), sn = Math.sin(k.lean);
    return { x: hip.x + local.x * c - local.y * sn, y: hip.y + local.x * sn + local.y * c };
  };
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 0.12 * u;
  for (const [side, hand] of [[-1, k.handL], [1, k.handR]]) {
    const sp = shoulder(side);
    const hp = P.project(hand.x, hand.y, z);
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y);
    ctx.lineTo(hp.x, hp.y);
    ctx.stroke();
    ctx.fillStyle = '#3ddc84';
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 0.1 * u, 0, TAU);
    ctx.fill();
  }
}

// Draws a world-space segment, clipped at the near plane (points behind the camera would flip).
function line(ctx, P, a, b) {
  const near = -CAM_BACK + 0.3;
  if (a[2] < near && b[2] < near) return;
  if (a[2] < near || b[2] < near) {
    const [front, back] = a[2] < near ? [b, a] : [a, b];
    const t = (front[2] - near) / (front[2] - back[2]);
    const clipped = front.map((v, i) => v + (back[i] - v) * t);
    a = front; b = clipped;
  }
  const p = P.project(...a), q = P.project(...b);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

// Ground polyline [[x, z], ...] at Y = 0.
function poly(ctx, P, pts) {
  for (let i = 1; i < pts.length; i++) {
    line(ctx, P, [pts[i - 1][0], 0, pts[i - 1][1]], [pts[i][0], 0, pts[i][1]]);
  }
}

function pentagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * TAU;
    i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.fill();
}

// First-person tennis court. World meters: X lateral, Y up, Z from the player's baseline (0)
// to the opponent's baseline (COURT_L).
export const COURT_L = 23.77;
export const NET_Z = COURT_L / 2;
export const NET_H = 0.914;
export const SINGLES_HW = 4.115;
const DOUBLES_HW = 5.485;
const SERVICE_OFF = 6.40; // service line distance from the net
export const BALL_R = 0.033;
const CAM_H = 4.5;   // elevated so the far court isn't squashed behind the net
const CAM_BACK = 12;
const TAU = Math.PI * 2;

export class Projector {
  constructor(view) { this.view = view; }
  get F() { return Math.min(1.25 * this.view.width, 2.4 * this.view.height); }
  get horizon() { return this.view.height * 0.08; }

  project(X, Y, Z) {
    const s = this.F / (Z + CAM_BACK);
    return { x: this.view.width / 2 + X * s, y: this.horizon + (CAM_H - Y) * s, s };
  }

  // Screen point → world point on the plane Z = z.
  unproject(sx, sy, z) {
    const s = this.F / (z + CAM_BACK);
    return { x: (sx - this.view.width / 2) / s, y: CAM_H - (sy - this.horizon) / s };
  }
}

export function drawCourt(ctx, P) {
  const { width: w, height: h } = P.view;
  const hz = P.horizon;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#0a0f24');
  sky.addColorStop(1, '#1d2a4d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hz);
  ctx.fillStyle = '#2b6b4a'; // surround
  ctx.fillRect(0, hz, w, h - hz);

  // back wall
  const wall = P.project(0, 0, COURT_L + 6);
  ctx.fillStyle = '#153a2b';
  ctx.fillRect(0, hz, w, wall.y - hz);

  // court surface (doubles area)
  quad(ctx, P, [[-DOUBLES_HW, 0], [DOUBLES_HW, 0], [DOUBLES_HW, COURT_L], [-DOUBLES_HW, COURT_L]], '#2f6fb5');
  quad(ctx, P, [[-SINGLES_HW, 0], [SINGLES_HW, 0], [SINGLES_HW, COURT_L], [-SINGLES_HW, COURT_L]], '#3479c4');

  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  for (const x of [-DOUBLES_HW, -SINGLES_HW, SINGLES_HW, DOUBLES_HW]) seg(ctx, P, [x, 0], [x, COURT_L]);
  seg(ctx, P, [-DOUBLES_HW, 0], [DOUBLES_HW, 0]);
  seg(ctx, P, [-DOUBLES_HW, COURT_L], [DOUBLES_HW, COURT_L]);
  for (const z of [NET_Z - SERVICE_OFF, NET_Z + SERVICE_OFF]) seg(ctx, P, [-SINGLES_HW, z], [SINGLES_HW, z]);
  seg(ctx, P, [0, NET_Z - SERVICE_OFF], [0, NET_Z + SERVICE_OFF]);
}

export function drawNet(ctx, P) {
  const hw = DOUBLES_HW + 0.9;
  const a = P.project(-hw, 0, NET_Z), b = P.project(-hw, 1.07, NET_Z);
  const c = P.project(0, NET_H, NET_Z), d = P.project(hw, 1.07, NET_Z), e = P.project(hw, 0, NET_Z);
  ctx.fillStyle = 'rgba(10,14,30,.55)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1;
  for (let x = -hw; x <= hw; x += 0.4) {
    const top = P.project(x, 1.07 - (1.07 - NET_H) * (1 - Math.abs(x) / hw), NET_Z), bot = P.project(x, 0, NET_Z);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
  }
  ctx.strokeStyle = '#f4f6ff';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  ctx.strokeStyle = '#c8ccd8';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(e.x, e.y); ctx.lineTo(d.x, d.y); ctx.stroke();
}

export function drawBall(ctx, P, ball) {
  const sh = P.project(ball.x, 0, ball.z);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, Math.max(2, BALL_R * sh.s * 1.4), Math.max(1, BALL_R * sh.s * 0.5), 0, 0, TAU);
  ctx.fill();
  const p = P.project(ball.x, ball.y, ball.z);
  const r = Math.max(3, BALL_R * p.s * 1.3); // slightly enlarged for readability
  ctx.fillStyle = '#e4ff3d';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = Math.max(1, r * 0.15);
  ctx.beginPath();
  ctx.arc(p.x - r * 0.9, p.y, r * 0.75, -0.9, 0.9);
  ctx.stroke();
}

// Opponent figure; swing 0..1 animates the racket.
export function drawOpponent(ctx, P, opp) {
  const feet = P.project(opp.x, 0, opp.z);
  const u = feet.s;
  ctx.save();
  ctx.translate(feet.x, feet.y);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b1f2e';
  ctx.lineWidth = 0.14 * u;
  ctx.beginPath();
  ctx.moveTo(-0.12 * u, 0); ctx.lineTo(-0.1 * u, -0.85 * u);
  ctx.moveTo(0.12 * u, 0); ctx.lineTo(0.1 * u, -0.85 * u);
  ctx.stroke();
  ctx.fillStyle = '#ff3d7f';
  ctx.beginPath();
  ctx.roundRect(-0.24 * u, -1.5 * u, 0.48 * u, 0.7 * u, 0.1 * u);
  ctx.fill();
  ctx.fillStyle = '#e0ac80';
  ctx.beginPath();
  ctx.arc(0, -1.68 * u, 0.13 * u, 0, TAU);
  ctx.fill();
  // racket arm
  const ang = -0.6 + opp.swing * 2.2 * (opp.side || 1);
  ctx.strokeStyle = '#ff3d7f';
  ctx.lineWidth = 0.1 * u;
  const sx = 0.24 * u, sy = -1.4 * u;
  const hx = sx + Math.cos(ang) * 0.55 * u, hy = sy + Math.sin(ang) * 0.55 * u;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.04 * u;
  ctx.beginPath();
  ctx.ellipse(hx + Math.cos(ang) * 0.3 * u, hy + Math.sin(ang) * 0.3 * u, 0.2 * u, 0.13 * u, ang, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// Player's racket on the hitting plane (Z = z), semi-transparent so the ball stays visible.
export function drawRacket(ctx, P, racket, reach, flash, z = 0) {
  const p = P.project(racket.x, racket.y, z);
  const r = 0.3 * p.s;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(racket.tilt ?? 0);
  // reach ring
  ctx.strokeStyle = `rgba(45,226,230,${0.15 + flash * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, reach * p.s, 0, TAU);
  ctx.stroke();
  // handle
  ctx.strokeStyle = 'rgba(40,40,50,.85)';
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, r * 1.05); ctx.lineTo(0, r * 2.2); ctx.stroke();
  // head
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.strokeStyle = flash > 0 ? '#ffd23d' : 'rgba(255,61,127,.9)';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.8, r, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1;
  ctx.save();
  ctx.clip();
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * r * 0.18, -r); ctx.lineTo(i * r * 0.18, r); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, i * r * 0.22); ctx.lineTo(r, i * r * 0.22); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function quad(ctx, P, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, z], i) => {
    const p = P.project(x, 0, z);
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

function seg(ctx, P, [x1, z1], [x2, z2]) {
  const a = P.project(x1, 0, z1), b = P.project(x2, 0, z2);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

// Court geometry and drawing for Basketball (side view, hoop on the right).
const TAU = Math.PI * 2;

export const FLOOR = 0.93;      // floor line (fraction of height)
export const THREE_LINE = 0.38; // throws released left of this (fraction of width) score 3

export function ballRadius(view) {
  return Math.min(view.width, view.height) * 0.035;
}

/**
 * Hoop geometry in px from a normalized position. rimFactor = inner rim width in ball radii.
 * Rim points are small circles the ball collides with; the board is a vertical segment.
 */
export function hoopGeometry(view, pos, rimFactor) {
  const R = ballRadius(view);
  const x = pos.x * view.width;
  const y = pos.y * view.height;
  const half = (rimFactor * R) / 2;
  const rimR = R * 0.16;
  return {
    x, y, rimR,
    front: { x: x - half, y },
    back: { x: x + half, y },
    board: { x: x + half + R * 0.45, top: y - R * 4.2, bottom: y + R * 0.9 },
    netDepth: R * 2.6,
  };
}

export function drawCourt(ctx, view) {
  const { width: w, height: h } = view;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#101a3a');
  bg.addColorStop(1, '#1d1235');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // spotlight
  const spot = ctx.createRadialGradient(w * 0.6, h * 0.1, 0, w * 0.6, h * 0.1, h);
  spot.addColorStop(0, 'rgba(255,255,255,.10)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  // floor
  const fy = FLOOR * h;
  const floor = ctx.createLinearGradient(0, fy, 0, h);
  floor.addColorStop(0, '#c98a4b');
  floor.addColorStop(1, '#8a5528');
  ctx.fillStyle = floor;
  ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(0, fy, w, 2);

  // 3-point zone marker
  const tx = THREE_LINE * w;
  ctx.fillStyle = 'rgba(255,140,45,.12)';
  ctx.fillRect(0, 0, tx, fy);
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = 'rgba(255,140,45,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, 0);
  ctx.lineTo(tx, fy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,140,45,.8)';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('3-PUNKTE-ZONE', tx / 2, fy - 14);
}

export function drawBoard(ctx, view, hoop) {
  const { board } = hoop;
  const bw = hoop.rimR * 3;
  // pole
  ctx.fillStyle = '#3a4466';
  ctx.fillRect(board.x + bw, board.top + (board.bottom - board.top) * 0.3, bw * 1.6, FLOOR * view.height - board.top);
  // board
  ctx.fillStyle = 'rgba(235,240,255,.9)';
  ctx.fillRect(board.x, board.top, bw, board.bottom - board.top);
  ctx.strokeStyle = '#ff5b2e';
  ctx.lineWidth = 2;
  ctx.strokeRect(board.x - 1, hoop.y - (board.bottom - board.top) * 0.35, bw + 2, (board.bottom - board.top) * 0.35);
}

export function drawRimAndNet(ctx, hoop, netSwing) {
  const { front, back, rimR, netDepth } = hoop;
  // net: lines from rim down to a narrower bottom, swinging after a score
  const bottomHalf = (back.x - front.x) * 0.3;
  const cx = (front.x + back.x) / 2 + netSwing * 6;
  const by = hoop.y + netDepth;
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1.5;
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const tx = front.x + ((back.x - front.x) * i) / n;
    const bx = cx - bottomHalf + (2 * bottomHalf * i) / n;
    ctx.beginPath();
    ctx.moveTo(tx, hoop.y);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    const t = k / 4;
    const y = hoop.y + netDepth * t;
    const l = front.x + (cx - bottomHalf - front.x) * t;
    const r = back.x + (cx + bottomHalf - back.x) * t;
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
    ctx.stroke();
  }
  // rim
  ctx.strokeStyle = '#ff5b2e';
  ctx.lineWidth = rimR * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(front.x, front.y);
  ctx.lineTo(back.x, back.y);
  ctx.stroke();
}

export function drawBall(ctx, b) {
  ctx.save();
  ctx.globalAlpha = b.alpha ?? 1;
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  const r = b.r;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffb066');
  g.addColorStop(0.7, '#e8701f');
  g.addColorStop(1, '#a3450c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,15,0,.8)';
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 1.25, 0, r * 0.95, -0.85, 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.85, Math.PI + 0.85);
  ctx.stroke();
  ctx.restore();
}

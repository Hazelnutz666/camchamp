// Fruit types and procedural drawing (no image assets).
const TAU = Math.PI * 2;

export const FRUIT_TYPES = [
  { name: 'apple', skin: '#e8303a', dark: '#9e1622', flesh: '#fff3d6', juice: '#ffe6a8', scale: 1, points: 1 },
  { name: 'orange', skin: '#ff9a1f', dark: '#c4620a', flesh: '#ffc65c', juice: '#ffb02e', scale: 1, points: 1 },
  { name: 'lime', skin: '#6ad13a', dark: '#3a8a1a', flesh: '#d9f7a1', juice: '#b6f05c', scale: 0.85, points: 1 },
  { name: 'plum', skin: '#8e44ad', dark: '#5b2370', flesh: '#f1c6ff', juice: '#c86bf0', scale: 0.8, points: 2 },
  { name: 'melon', skin: '#2f9e44', dark: '#1b5e28', flesh: '#ff4d6d', juice: '#ff4d6d', scale: 1.3, points: 3, stripes: true, seeds: true },
];

export const BOMB = { name: 'bomb', scale: 1, bomb: true };

export function drawFruit(ctx, f, time) {
  const { x, y, r, type } = f;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.rot);
  if (type.bomb) drawBomb(ctx, r, time);
  else drawSkin(ctx, r, type);
  ctx.restore();
}

function drawSkin(ctx, r, type) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, lighten(type.skin));
  g.addColorStop(0.6, type.skin);
  g.addColorStop(1, type.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  if (type.stripes) {
    ctx.strokeStyle = type.dark;
    ctx.lineWidth = r * 0.12;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * r * 0.38, 0, r * 0.12, r * 0.95, 0, 0, TAU);
      ctx.stroke();
    }
  }
  if (type.name === 'apple') {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-r * 0.05, -r * 1.15, r * 0.1, r * 0.35);
    ctx.fillStyle = '#3fae3f';
    ctx.beginPath();
    ctx.ellipse(r * 0.22, -r * 1.0, r * 0.25, r * 0.12, -0.5, 0, TAU);
    ctx.fill();
  }
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, TAU);
  ctx.fill();
}

function drawBomb(ctx, r, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 12);
  ctx.shadowColor = `rgba(255,40,40,${0.5 + pulse * 0.5})`;
  ctx.shadowBlur = r * 0.8;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#555');
  g.addColorStop(1, '#111');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  // fuse cap + fuse
  ctx.fillStyle = '#777';
  ctx.fillRect(-r * 0.22, -r * 1.1, r * 0.44, r * 0.25);
  ctx.strokeStyle = '#c9a26b';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.quadraticCurveTo(r * 0.3, -r * 1.5, r * 0.5, -r * 1.35);
  ctx.stroke();
  // spark
  ctx.fillStyle = `rgba(255,${200 + pulse * 55},80,1)`;
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 1.35, r * (0.12 + pulse * 0.1), 0, TAU);
  ctx.fill();
  // skull-ish mark
  ctx.fillStyle = 'rgba(255,60,60,.85)';
  ctx.font = `900 ${Math.round(r)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕', 0, r * 0.05);
}

// A sliced half: clipped to one side of the cut line, flesh visible.
export function drawHalf(ctx, h) {
  const { x, y, r, type } = h;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h.rot);
  ctx.beginPath();
  ctx.rect(-r * 1.6, h.side < 0 ? -r * 1.6 : 0, r * 3.2, r * 1.6);
  ctx.clip();
  ctx.fillStyle = type.skin;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = type.flesh;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, TAU);
  ctx.fill();
  if (type.seeds) {
    ctx.fillStyle = '#222';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.05, r * 0.09, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.min(255, ((n >> s) & 255) + 70);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

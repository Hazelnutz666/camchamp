// Calibration fit: finds settings.calibration so that CameraTracker.transform() maps the
// positions the player actually reaches onto the screen targets.
//
// transform(): screen = 0.5 + (raw - 0.5 + offset) * sensitivity * scale   (per axis, raw = mirrored)
// Rewritten as screen - 0.5 = k * (raw - 0.5) + b with k = sensitivity * scale, b = k * offset,
// which is a least-squares line fit with one shared slope k for both axes.

export const IDENTITY = Object.freeze({ offsetX: 0, offsetY: 0, scale: 1 });

/**
 * samples: [{ raw: { x, y }, target: { x, y } }]  (normalized 0..1)
 * Returns { offsetX, offsetY, scale } or null if the samples are unusable
 * (too close together, or an implausible result).
 */
export function fitCalibration(samples, sensitivity = 1) {
  const n = samples.length;
  if (n < 2) return null;
  const mean = (f) => samples.reduce((s, p) => s + f(p), 0) / n;
  const ux = mean((p) => p.raw.x - 0.5), uy = mean((p) => p.raw.y - 0.5);
  const tx = mean((p) => p.target.x - 0.5), ty = mean((p) => p.target.y - 0.5);
  let num = 0, den = 0;
  for (const p of samples) {
    const dx = p.raw.x - 0.5 - ux, dy = p.raw.y - 0.5 - uy;
    num += dx * (p.target.x - 0.5 - tx) + dy * (p.target.y - 0.5 - ty);
    den += dx * dx + dy * dy;
  }
  if (den < 0.005 * n) return null; // hand barely moved between targets
  const k = num / den;
  const scale = k / sensitivity;
  if (!(scale > 0.25 && scale < 5)) return null;
  const offsetX = (tx - k * ux) / k, offsetY = (ty - k * uy) / k;
  if (Math.abs(offsetX) > 0.6 || Math.abs(offsetY) > 0.6) return null;
  return { offsetX, offsetY, scale };
}

export function isIdentity(c) {
  return Math.abs(c.offsetX) < 1e-3 && Math.abs(c.offsetY) < 1e-3 && Math.abs(c.scale - 1) < 1e-3;
}

// Short German summary for the settings screen.
export function describeCalibration(c) {
  if (isIdentity(c)) return 'Standard (nicht kalibriert)';
  const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} %`;
  return `Versatz X ${pct(c.offsetX)}, Y ${pct(c.offsetY)} · Reichweite ×${c.scale.toFixed(2)}`;
}

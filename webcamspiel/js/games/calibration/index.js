import { BaseGame } from '../baseGame.js';
import { Particles, drawCenterText, drawHint } from '../../fx/effects.js';
import { fitCalibration, IDENTITY } from './fit.js';

// Screen targets (normalized), center first, then the four corners of the reachable area.
export const TARGETS = [
  { x: 0.5, y: 0.5 }, { x: 0.15, y: 0.18 }, { x: 0.85, y: 0.18 }, { x: 0.85, y: 0.82 }, { x: 0.15, y: 0.82 },
];
const HOLD = 1.0;          // s the hand must stay still per target
const STILL_RADIUS = 0.03; // normalized raw movement allowed while holding
const MOVE_ON = 0.08;      // hand must move this far from the last capture before the next one starts
const INTRO = 3;
const FAILED = 3;
const DONE = 6;

const TAU = Math.PI * 2;

/**
 * Calibration step (started from the settings screen, not listed in the menu).
 * The player holds the index finger still at a comfortable spot for each target; the
 * raw (mirrored) positions are fitted to the targets and saved as settings.calibration.
 * While collecting, calibration is temporarily reset to identity so the camera overlay
 * shows the raw image; leaving early restores the previous values.
 */
export default class Calibration extends BaseGame {
  static meta = {
    id: 'calibration',
    title: 'Kalibrierung',
    description: 'Zielpunkte mit dem Zeigefinger anzeigen',
    color: '#2de2e6',
    tracking: { hands: true, pose: false },
    options: {},
    utility: true, // no highscores/stats; app returns to the settings screen
  };

  start() {
    this.settings = this.env.settings;
    this.previous = { ...this.settings.get('calibration') };
    this.saved = false;
    this.settings.set('calibration', { ...IDENTITY });
    this.particles = new Particles(300);
    this.time = 0;
    this.resetCollection();
    this.setPhase('intro');
  }

  resetCollection() {
    this.index = 0;
    this.samples = [];
    this.hold = null; // { anchor, sumX, sumY, n, t }
    this.lastCapture = null;
  }

  setPhase(phase) { this.phase = phase; this.phaseTime = 0; }

  update(dt, input) {
    this.time += dt;
    this.phaseTime += dt;
    this.particles.update(dt);
    this.input = input;
    const hand = input.rawHands?.[0] ?? null;
    const confirm = input.keys.pressed.has('Space') || input.keys.pressed.has('Enter');

    if (this.phase === 'intro' && (this.phaseTime > INTRO || confirm)) this.setPhase('collect');
    else if (this.phase === 'failed' && this.phaseTime > FAILED) { this.resetCollection(); this.setPhase('collect'); }
    else if (this.phase === 'done' && (this.phaseTime > DONE || (confirm && this.phaseTime > 0.3))) this.finish({});
    else if (this.phase === 'collect') this.collect(dt, hand, confirm);

    this.hud.set({ Kalibrierung: `Punkt ${Math.min(this.index + 1, TARGETS.length)}/${TARGETS.length}` });
  }

  collect(dt, hand, confirm) {
    if (!hand) { this.hold = null; return; }
    if (this.lastCapture && Math.hypot(hand.x - this.lastCapture.x, hand.y - this.lastCapture.y) < MOVE_ON && !confirm) return;
    this.lastCapture = null;

    if (!this.hold || Math.hypot(hand.x - this.hold.anchor.x, hand.y - this.hold.anchor.y) > STILL_RADIUS) {
      this.hold = { anchor: { ...hand }, sumX: 0, sumY: 0, n: 0, t: 0 };
    }
    const h = this.hold;
    h.sumX += hand.x; h.sumY += hand.y; h.n++; h.t += dt;
    if (h.t >= HOLD || confirm) this.capture({ x: h.sumX / h.n, y: h.sumY / h.n });
  }

  capture(raw) {
    const target = TARGETS[this.index];
    this.samples.push({ raw, target });
    const { x, y } = this.view.toPx(target);
    this.particles.burst(x, y, { count: 30, colors: ['#2de2e6', '#3ddc84', '#fff'], speed: 320, gravity: 200, life: 0.7 });
    this.lastCapture = raw;
    this.hold = null;
    this.index++;
    if (this.index < TARGETS.length) return;

    const result = fitCalibration(this.samples, this.settings.get('sensitivity'));
    if (!result) { this.setPhase('failed'); return; }
    this.settings.set('calibration', result);
    this.saved = true;
    this.setPhase('done');
  }

  destroy() {
    if (!this.saved) this.settings.set('calibration', this.previous);
  }

  render(ctx) {
    const { width: w, height: h } = this.view;
    this.view.drawLayer(ctx, 'calibration-bg', (l) => {
      const bg = l.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#16203a');
      bg.addColorStop(1, '#0b0d17');
      l.fillStyle = bg;
      l.fillRect(0, 0, w, h);
    });

    const r = Math.max(22, Math.min(w, h) * 0.05);
    TARGETS.forEach((t, i) => this.drawTarget(ctx, t, i, r));
    this.particles.render(ctx);

    const hand = this.input?.rawHands?.[0];
    if (this.phase === 'intro') {
      drawCenterText(ctx, this.view, 'Kalibrierung', { size: Math.min(80, w / 10), color: '#2de2e6' });
      drawHint(ctx, this.view, 'Stell dich mittig vor die Kamera, Oberkörper und Arme im Bild.', 0.64);
      drawHint(ctx, this.view, 'Zeige mit dem Zeigefinger bequem auf jeden Kreis und halte kurz still.', 0.7);
    } else if (this.phase === 'collect') {
      drawHint(ctx, this.view, 'Zeige auf den leuchtenden Kreis – so weit, wie es dir bequem ist – und halte still.', 0.06);
      const status = !hand ? 'Keine Hand erkannt – Hand in die Kamera halten'
        : this.lastCapture ? 'Gut! Jetzt die Hand zum nächsten Kreis bewegen'
          : 'Hand erkannt ✓   (Leertaste: Punkt sofort übernehmen)';
      drawHint(ctx, this.view, status, 0.95);
    } else if (this.phase === 'failed') {
      drawCenterText(ctx, this.view, 'Nochmal', { size: Math.min(80, w / 10), color: '#ff6b6b' });
      drawHint(ctx, this.view, 'Die Punkte lagen zu nah beieinander. Bewege die Hand weiter zu den Kreisen.', 0.64);
    } else if (this.phase === 'done') {
      drawHint(ctx, this.view, 'Kalibrierung gespeichert! Teste den Zeiger an den Kreisen.', 0.06);
      drawHint(ctx, this.view, 'Enter/Leertaste: zurück zu den Einstellungen', 0.95);
      this.drawPointers(ctx, { pointers: (this.input?.pointers ?? []).filter((p) => p.source === 'camera') });
    }
  }

  drawTarget(ctx, t, i, r) {
    const { x, y } = this.view.toPx(t);
    const done = this.phase === 'done' || i < this.index;
    const current = this.phase === 'collect' && i === this.index;
    ctx.save();
    ctx.lineWidth = 4;
    if (current) {
      const pulse = 1 + 0.08 * Math.sin(this.time * 6);
      ctx.shadowColor = '#2de2e6';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#2de2e6';
      ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      const progress = this.hold ? Math.min(1, this.hold.t / HOLD) : 0;
      if (progress > 0) {
        ctx.fillStyle = 'rgba(45,226,230,.35)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.85, -Math.PI / 2, -Math.PI / 2 + progress * TAU); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#2de2e6';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
    } else if (done) {
      ctx.fillStyle = 'rgba(61,220,132,.25)';
      ctx.strokeStyle = '#3ddc84';
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y); ctx.lineTo(x - r * 0.05, y + r * 0.25); ctx.lineTo(x + r * 0.35, y - r * 0.25); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(138,147,184,.45)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

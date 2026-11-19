// Detects a kick from MediaPipe pose landmarks (normalized, already mirrored/calibrated).
// A kick = one foot rises quickly above its resting level. We then watch it for a short
// window and derive: direction (lateral foot travel), height (how high the foot got), power (peak speed).
// All distances are normalized by the player's leg length so it works at any camera distance.

const LEGS = [
  { hip: 23, knee: 25, ankle: 27, foot: 31 },
  { hip: 24, knee: 26, ankle: 28, foot: 32 },
];
const MIN_VISIBILITY = 0.5;
const SPEED_WINDOW = 0.1;   // s
const TRIGGER_RISE = 0.18;  // leg lengths above rest
const TRIGGER_SPEED = 1.8;  // leg lengths / s upward
const OBSERVE = 0.15;       // s after trigger to measure the kick
const REARM_RISE = 0.08;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Foot {
  constructor(idx) {
    this.idx = idx;
    this.history = [];
    this.rest = null;
    this.armed = true;
    this.kick = null;
    this.legLen = 0;
  }

  update(pose, time) {
    const { hip, knee, ankle, foot } = this.idx;
    const a = pose[foot]?.visibility >= MIN_VISIBILITY ? pose[foot] : pose[ankle];
    if (!a || (a.visibility ?? 1) < MIN_VISIBILITY || (pose[hip].visibility ?? 1) < MIN_VISIBILITY) return null;
    const legLen = dist(pose[hip], pose[knee]) + dist(pose[knee], pose[ankle]);
    if (legLen < 0.05) return null;
    this.legLen = legLen;

    this.history.push({ x: a.x, y: a.y, t: time });
    while (this.history.length > 2 && time - this.history[0].t > 0.3) this.history.shift();
    const ref = this.history.find((h) => time - h.t <= SPEED_WINDOW) ?? this.history[0];
    const dt = time - ref.t;
    const vx = dt > 0 ? (a.x - ref.x) / dt / legLen : 0;
    const vy = dt > 0 ? (a.y - ref.y) / dt / legLen : 0;
    const speed = Math.hypot(vx, vy);

    if (!this.kick && speed < 0.6) this.rest = this.rest == null ? a.y : this.rest + (a.y - this.rest) * 0.1;
    if (this.rest == null) return null;
    const rise = (this.rest - a.y) / legLen;
    this.rise = rise;

    if (this.armed && !this.kick && rise > TRIGGER_RISE && -vy > TRIGGER_SPEED) {
      this.kick = { t0: time, startX: ref.x, peakRise: rise, maxSpeed: speed, peakX: a.x };
    }
    let result = null;
    if (this.kick) {
      const k = this.kick;
      if (rise > k.peakRise) { k.peakRise = rise; k.peakX = a.x; }
      k.maxSpeed = Math.max(k.maxSpeed, speed);
      if (time - k.t0 >= OBSERVE) {
        result = {
          dirX: clamp(((k.peakX - k.startX) / legLen) * 1.6, -1, 1),
          height: clamp((k.peakRise - 0.25) / 0.55, 0, 1),
          power: clamp((k.maxSpeed - TRIGGER_SPEED) / 4, 0.1, 1),
        };
        this.kick = null;
        this.armed = false;
      }
    }
    if (!this.armed && rise < REARM_RISE) this.armed = true;
    return result;
  }
}

export class KickDetector {
  constructor() { this.feet = LEGS.map((l) => new Foot(l)); }

  // Returns { dirX -1..1, height 0..1, power 0..1 } once per kick, else null.
  update(pose, time) {
    if (!pose) return null;
    let shot = null;
    for (const f of this.feet) shot = f.update(pose, time) ?? shot;
    return shot;
  }

  get ready() { return this.feet.some((f) => f.rest != null); }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Leg skeleton for on-screen feedback: [[a, b], ...] landmark index pairs.
export const LEG_BONES = [[23, 24], [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32]];

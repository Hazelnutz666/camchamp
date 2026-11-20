import { PointerTracker } from './pointerTracker.js';

// MediaPipe Tasks Vision, pinned. Loaded lazily so the menu works without network/camera.
const MP_VERSION = '0.10.14';
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const INDEX_TIP = 8;

export class CameraError extends Error {
  // code: 'unsupported' | 'denied' | 'notfound' | 'load' | 'unknown'
  constructor(code, message) { super(message); this.code = code; }
}

export class CameraTracker {
  constructor(settings) {
    this.settings = settings;
    this.video = null;
    this.stream = null;
    this.vision = null;
    this.fileset = null;
    this.hands = null;
    this.pose = null;
    this.active = { hands: true, pose: false };
    this.lastVideoTime = -1;
    this.handTrackers = [new PointerTracker('hand-0', 'camera'), new PointerTracker('hand-1', 'camera')];
    this.rawHands = [null, null]; // index fingertip, mirrored only (no sensitivity/calibration) – for the calibration step
    this.poseLandmarks = null;
    this.running = false;
  }

  // Progress text for the UI while start() runs (permission prompt, downloads).
  setStage(text) {
    this.stage = text;
    this.onStage?.(text);
  }

  async start() {
    if (this.running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('unsupported', 'Browser unterstützt keinen Kamerazugriff (localhost oder https nötig).');
    }
    try {
      this.setStage('Warte auf Kamera-Freigabe im Browser …');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
      });
    } catch (err) {
      const code = err.name === 'NotAllowedError' ? 'denied' : err.name === 'NotFoundError' ? 'notfound' : 'unknown';
      throw new CameraError(code, code === 'denied' ? 'Kamerazugriff verweigert.' : code === 'notfound' ? 'Keine Kamera gefunden.' : err.message);
    }
    this.video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
    this.video.srcObject = this.stream;
    this.setStage('Starte Kamera …');
    await this.video.play();

    try {
      this.setStage('Lade MediaPipe …');
      this.vision = await import(MP_BUNDLE);
      this.fileset = await this.vision.FilesetResolver.forVisionTasks(MP_WASM);
    } catch (err) {
      this.stop();
      throw new CameraError('load', `MediaPipe konnte nicht geladen werden: ${err.message}`);
    }
    this.running = true;
    try {
      this.setStage('Lade Tracking-Modell …');
      await this.setActive(this.active);
      this.setStage('');
    } catch (err) {
      this.stop();
      throw new CameraError('load', `Tracking-Modell konnte nicht geladen werden: ${err.message}`);
    }
  }

  // Enable only the models a game needs (pose detection is expensive).
  async setActive({ hands = false, pose = false }) {
    this.active = { hands, pose };
    if (!this.running) return;
    const { HandLandmarker, PoseLandmarker } = this.vision;
    if (hands && !this.hands) {
      this.hands = await HandLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 2,
      });
    }
    if (pose && !this.pose) {
      this.pose = await PoseLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO', numPoses: 1,
      });
    }
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.hands?.close(); this.hands = null;
    this.pose?.close(); this.pose = null;
    this.video = null;
    this.handTrackers.forEach((t) => t.lose());
    this.rawHands = [null, null];
    this.poseLandmarks = null;
  }

  // Mirror only – the input space of the calibration fit (see js/games/calibration/fit.js).
  mirrored(lm) {
    return { x: this.settings.get('mirror') ? 1 - lm.x : lm.x, y: lm.y };
  }

  // Raw MediaPipe coords (0..1, camera space) → game coords with mirror/calibration/sensitivity.
  transform(lm) {
    const { offsetX, offsetY, scale } = this.settings.get('calibration');
    const s = this.settings.get('sensitivity') * scale;
    let { x, y } = this.mirrored(lm);
    x = 0.5 + (x - 0.5 + offsetX) * s;
    y = 0.5 + (y - 0.5 + offsetY) * s;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), z: lm.z, visibility: lm.visibility };
  }

  update(dt) {
    if (!this.running || this.video.readyState < 2) return { pointers: [], pose: null, rawHands: [] };
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const now = performance.now();
      if (this.active.hands && this.hands) this.updateHands(this.hands.detectForVideo(this.video, now), dt);
      if (this.active.pose && this.pose) this.updatePose(this.pose.detectForVideo(this.video, now));
    }
    return {
      pointers: this.handTrackers.filter((t) => t.visible).map((t) => t.snapshot()),
      pose: this.poseLandmarks,
      rawHands: this.rawHands.filter(Boolean),
    };
  }

  updateHands(result, dt) {
    const hands = result.landmarks ?? [];
    this.handTrackers.forEach((tracker, i) => {
      if (hands[i]) {
        const p = this.transform(hands[i][INDEX_TIP]);
        tracker.feed(p.x, p.y, dt);
        this.rawHands[i] = this.mirrored(hands[i][INDEX_TIP]);
      } else {
        tracker.lose();
        this.rawHands[i] = null;
      }
    });
  }

  updatePose(result) {
    const lms = result.landmarks?.[0];
    this.poseLandmarks = lms ? lms.map((lm) => this.transform(lm)) : null;
  }
}

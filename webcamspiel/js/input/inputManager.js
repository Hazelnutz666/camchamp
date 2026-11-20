import { MouseInput } from './mouseInput.js';
import { KeyboardInput } from './keyboardInput.js';
import { CameraTracker, CameraError } from './cameraTracker.js';

/**
 * Single entry point for all input. Games only ever read the InputState returned by update():
 *
 * InputState = {
 *   source:   'camera' | 'mouse',
 *   pointers: [{ id, source, x, y, vx, vy, speed, down }],  // normalized 0..1, velocity in units/s
 *   pose:     null | Array<{ x, y, z, visibility }>,        // 33 MediaPipe pose landmarks, normalized
 *   keys:     { held: Set<code>, pressed: Set<code> },     // KeyboardEvent.code
 *   rawHands: [{ x, y }],  // camera index fingertips, mirrored only – used by the calibration step
 * }
 *
 * In camera mode, mouse pointers are still merged in so the mouse always works as a fallback.
 */
export class InputManager {
  constructor(settings) {
    this.settings = settings;
    this.mouse = new MouseInput();
    this.keyboard = new KeyboardInput();
    this.camera = new CameraTracker(settings);
    this.source = 'mouse';
    this.listeners = new Set();
  }

  onSourceChange(fn) { this.listeners.add(fn); }
  setSource(source, error = null) {
    this.source = source;
    this.listeners.forEach((fn) => fn(source, error));
  }

  attach(el) { this.mouse.attach(el); }

  // Returns null on success or a CameraError; on failure we stay on mouse.
  async enableCamera() {
    try {
      await this.camera.start();
      this.setSource('camera');
      return null;
    } catch (err) {
      const error = err instanceof CameraError ? err : new CameraError('unknown', err.message);
      this.setSource('mouse', error);
      return error;
    }
  }

  disableCamera() {
    this.camera.stop();
    this.setSource('mouse');
  }

  // Called by the app before a game starts, from the game's `tracking` metadata.
  setTracking(features) { return this.camera.setActive(features); }

  get videoElement() { return this.camera.video; }

  update(dt) {
    const mousePointers = this.mouse.update(dt);
    const cam = this.source === 'camera' ? this.camera.update(dt) : { pointers: [], pose: null, rawHands: [] };
    return {
      source: this.source,
      pointers: [...cam.pointers, ...mousePointers],
      pose: cam.pose,
      rawHands: cam.rawHands,
      keys: this.keyboard.update(),
    };
  }
}

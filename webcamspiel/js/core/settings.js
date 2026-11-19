import { load, save } from './storage.js';

const DEFAULTS = {
  useCamera: false,
  mirror: true,
  cameraView: 'overlay', // 'overlay' (semi-transparent full screen) | 'corner' | 'off'
  cameraOpacity: 0.35,
  sensitivity: 1.0,
  difficulty: 'normal',
  gameConfigs: {}, // last setup per game: { [gameId]: { difficulty, options } }
  // Set by the calibration step (not implemented yet); used by CameraTracker.
  calibration: { offsetX: 0, offsetY: 0, scale: 1 },
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS, ...load('settings', {}) };
    delete this.values.showPreview; // replaced by cameraView
    this.listeners = new Set();
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    this.values[key] = value;
    save('settings', this.values);
    this.listeners.forEach((fn) => fn(key, value));
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

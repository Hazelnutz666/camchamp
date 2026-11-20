import { $ } from './screens.js';
import { describeCalibration, isIdentity, IDENTITY } from '../games/calibration/fit.js';

// Binds the settings form to Settings. Camera on/off goes through the shared setCamera callback.
export class SettingsScreen {
  constructor({ settings, setCamera, onCalibrate, onBack }) {
    this.settings = settings;

    const mirror = $('set-mirror');
    mirror.checked = settings.get('mirror');
    mirror.addEventListener('change', () => settings.set('mirror', mirror.checked));

    this.bindRange('set-sensitivity', 'out-sensitivity', 'sensitivity', (v) => v.toFixed(2));
    this.bindRange('set-camera-opacity', 'out-camera-opacity', 'cameraOpacity', (v) => `${Math.round(v * 100)} %`);

    for (const [id, key] of [['set-difficulty', 'difficulty'], ['set-camera-view', 'cameraView']]) {
      const el = $(id);
      el.value = settings.get(key);
      el.addEventListener('change', () => settings.set(key, el.value));
    }

    const cam = $('set-camera');
    cam.checked = settings.get('useCamera');
    cam.addEventListener('change', () => setCamera(cam.checked));

    $('btn-calibrate').addEventListener('click', onCalibrate);
    $('btn-calibration-reset').addEventListener('click', () => settings.set('calibration', { ...IDENTITY }));
    settings.onChange((key) => { if (key === 'calibration') this.renderCalibration(); });
    this.renderCalibration();
    this.syncSource('mouse', null);

    $('btn-settings-back').addEventListener('click', onBack);
  }

  renderCalibration() {
    const c = this.settings.get('calibration');
    $('out-calibration').textContent = describeCalibration(c);
    $('btn-calibration-reset').disabled = isIdentity(c);
  }

  bindRange(inputId, outputId, key, format) {
    const el = $(inputId);
    const out = $(outputId);
    el.value = this.settings.get(key);
    out.textContent = format(Number(el.value));
    el.addEventListener('input', () => {
      this.settings.set(key, Number(el.value));
      out.textContent = format(Number(el.value));
    });
  }

  // Called whenever the input source changes (incl. failed camera start) or a request is pending.
  syncSource(source, error, pending = false) {
    const cam = $('set-camera');
    cam.checked = pending || source === 'camera';
    cam.disabled = pending;
    const ready = source === 'camera' && !pending;
    $('btn-calibrate').disabled = !ready;
    $('calibration-hint').hidden = ready;
    const el = $('camera-error');
    el.hidden = !error;
    el.textContent = error ? `${error.message} – Maussteuerung aktiv.` : '';
  }
}

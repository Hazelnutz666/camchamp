import { Settings } from './settings.js';
import { Profiles } from './profiles.js';
import { Highscores } from './highscores.js';
import { GameLoop } from './gameLoop.js';
import { CanvasView } from './canvas.js';
import { InputManager } from '../input/inputManager.js';
import { Hud } from '../ui/hud.js';
import { Menu } from '../ui/menu.js';
import { SettingsScreen } from '../ui/settingsScreen.js';
import { SetupScreen } from '../ui/setupScreen.js';
import { show, $ } from '../ui/screens.js';

// meta.options = { key: { label, default, choices } } → { key: value }
function resolveOptions(defs = {}, chosen = {}) {
  return Object.fromEntries(Object.entries(defs).map(([k, def]) => [k, chosen[k] ?? def.default]));
}

// Owns all services, screen flow and the active game session.
export class App {
  constructor() {
    this.settings = new Settings();
    this.profiles = new Profiles();
    this.highscores = new Highscores();
    this.input = new InputManager(this.settings);
    this.view = new CanvasView($('game-canvas'));
    this.hud = new Hud($('hud'));
    this.loop = new GameLoop((dt) => this.tick(dt));

    this.GameClass = null;
    this.game = null;
    this.paused = false;
    this.screen = 'menu';
    this.cameraPending = false;

    this.menu = new Menu({
      profiles: this.profiles,
      highscores: this.highscores,
      onStart: (Game) => { this.setupScreen.open(Game); this.showScreen('setup'); },
      onSettings: () => this.showScreen('settings'),
      setCamera: (on) => this.setCamera(on),
    });
    this.setupScreen = new SetupScreen({
      settings: this.settings,
      highscores: this.highscores,
      onStart: (Game, config) => this.startGame(Game, config),
      onBack: () => this.showScreen('menu'),
    });
    this.settingsScreen = new SettingsScreen({
      settings: this.settings,
      setCamera: (on) => this.setCamera(on),
      onBack: () => this.showScreen('menu'),
    });
  }

  // Single place to switch camera/mouse (menu "Spielmodi" switch and settings checkbox).
  // Enabling triggers the browser permission prompt; on failure we stay on mouse.
  async setCamera(on) {
    if (on === (this.input.source === 'camera') || this.cameraPending) return;
    this.settings.set('useCamera', on);
    if (!on) { this.input.disableCamera(); return; }
    this.cameraPending = true;
    this.syncSource(this.input.source, null);
    const err = await this.input.enableCamera(); // fires onSourceChange → syncSource
    this.cameraPending = false;
    if (err) this.settings.set('useCamera', false);
    this.syncSource(this.input.source, err);
  }

  syncSource(source, error) {
    this.menu.syncSource(source, error, this.cameraPending && (this.input.camera.stage || 'Starte Kamera …'));
    this.settingsScreen.syncSource(source, error, this.cameraPending);
    this.updateCameraView();
  }

  async init() {
    this.input.attach($('game-canvas'));
    this.input.onSourceChange((source, error) => this.syncSource(source, error));
    this.input.camera.onStage = () => { if (this.cameraPending) this.syncSource(this.input.source, null); };
    this.settings.onChange(() => this.updateCameraView());
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => this.startGame(this.GameClass, this.config));
    $('btn-menu').addEventListener('click', () => this.exitToMenu());

    this.showScreen('menu');
    this.syncSource(this.input.source, null);
    if (this.settings.get('useCamera')) {
      this.settings.set('useCamera', false); // setCamera() re-sets it on success
      await this.setCamera(true);
    }
  }

  showScreen(name) {
    this.screen = name;
    show(name);
    if (name === 'menu') this.menu.render();
    this.updateCameraView();
  }

  /**
   * Places the single <video> element:
   * - game + cameraView 'overlay': full-screen layer above the canvas, semi-transparent,
   *   transformed exactly like CameraTracker.transform() so the image lines up with the tracked points
   * - game + 'corner', and the settings screen: small preview bottom right
   */
  updateCameraView() {
    const video = this.input.videoElement;
    const overlay = $('camera-overlay');
    const corner = $('camera-preview');
    const active = !!video && this.input.source === 'camera';
    const mode = this.settings.get('cameraView');
    const showOverlay = active && this.screen === 'game' && mode === 'overlay';
    const showCorner = active && (this.screen === 'settings' || (this.screen === 'game' && mode === 'corner'));

    overlay.hidden = !showOverlay;
    corner.hidden = !showCorner;
    corner.classList.toggle('mirrored', this.settings.get('mirror'));

    if (showOverlay) {
      if (video.parentElement !== overlay) overlay.replaceChildren(video);
      const { offsetX, offsetY, scale } = this.settings.get('calibration');
      const s = this.settings.get('sensitivity') * scale;
      const mirror = this.settings.get('mirror') ? ' scaleX(-1)' : '';
      // CSS applies right to left: mirror → offset → scale around the center (= transform()).
      video.style.transform = `scale(${s}) translate(${offsetX * 100}%, ${offsetY * 100}%)${mirror}`;
      overlay.style.opacity = this.settings.get('cameraOpacity');
    } else if (showCorner) {
      if (video.parentElement !== corner) corner.replaceChildren(video);
      video.style.transform = '';
    }
  }

  // config = { difficulty, options } from the setup screen.
  async startGame(GameClass, config) {
    this.game?.destroy();
    this.game = null;
    this.GameClass = GameClass;
    this.config = config;
    this.showScreen('game');
    this.view.resize();
    this.hud.clear();
    this.hideOverlay();
    this.paused = false;
    try {
      await this.input.setTracking(GameClass.meta.tracking);
    } catch (err) {
      console.error('tracking model failed, falling back to mouse', err);
      this.input.disableCamera();
    }

    this.game = new GameClass({
      view: this.view,
      hud: this.hud,
      settings: this.settings,
      difficulty: config.difficulty,
      options: resolveOptions(GameClass.meta.options, config.options),
      onFinish: (result) => this.onFinish(result),
    });
    this.game.start();
    this.loop.start();
  }

  tick(dt) {
    if (!this.game) return;
    const state = this.input.update(dt);
    if (state.keys.pressed.has('Escape') || state.keys.pressed.has('KeyP')) {
      this.paused ? this.resume() : this.pause();
    }
    if (!this.paused && !this.game.finished) this.game.update(dt, state);
    this.game.render(this.view.ctx);
  }

  pause() {
    if (!this.game || this.game.finished) return;
    this.paused = true;
    this.showOverlay('Pause', '', true);
  }

  resume() {
    this.paused = false;
    this.hideOverlay();
  }

  onFinish({ score = 0, stats = {} } = {}) {
    const id = this.GameClass.meta.id;
    const rank = this.highscores.submit(id, {
      score, profileName: this.profiles.active.name, difficulty: this.config.difficulty,
    });
    this.profiles.recordStats(id, stats);
    this.showOverlay('Spiel vorbei', `Punkte: ${score}${rank ? ` · Platz ${rank} der Bestenliste` : ''}`, false);
  }

  exitToMenu() {
    this.loop.stop();
    this.game?.destroy();
    this.game = null;
    this.hideOverlay();
    this.showScreen('menu');
  }

  showOverlay(title, text, canResume) {
    $('overlay-title').textContent = title;
    $('overlay-text').textContent = text;
    $('btn-resume').hidden = !canResume;
    $('overlay').hidden = false;
  }

  hideOverlay() { $('overlay').hidden = true; }
}

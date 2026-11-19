import { GAMES } from '../games/registry.js';
import { $ } from './screens.js';

// Renders game tiles and the profile bar. Re-render after scores/profiles change.
export class Menu {
  constructor({ profiles, highscores, onStart, onSettings, setCamera }) {
    this.profiles = profiles;
    this.highscores = highscores;
    this.onStart = onStart;

    // "Spielmodi" switch: clicking Kamera triggers the browser permission prompt right away.
    $('btn-mode-camera').addEventListener('click', () => setCamera(true));
    $('btn-mode-mouse').addEventListener('click', () => setCamera(false));

    $('btn-settings').addEventListener('click', onSettings);
    $('btn-new-profile').addEventListener('click', () => {
      const name = prompt('Name des neuen Profils:')?.trim();
      if (name) { this.profiles.create(name); this.render(); }
    });
    $('profile-select').addEventListener('change', (e) => { this.profiles.select(e.target.value); this.render(); });
  }

  // pending: false or the current camera start-up stage text
  syncSource(source, error, pending = false) {
    const cam = $('btn-mode-camera');
    const mouse = $('btn-mode-mouse');
    cam.classList.toggle('active', source === 'camera');
    mouse.classList.toggle('active', source !== 'camera' && !pending);
    cam.disabled = mouse.disabled = !!pending;
    const status = $('mode-status');
    status.classList.toggle('error', !!error);
    status.textContent = pending
      ? pending
      : error
        ? `${error.message} – Maussteuerung aktiv.`
        : source === 'camera'
          ? 'Du spielst mit Körperbewegungen über die Webcam.'
          : 'Du spielst mit Maus/Touch. Wähle „Kamera“, um mit der Webcam zu spielen.';
  }

  render() {
    const select = $('profile-select');
    select.replaceChildren(...this.profiles.all.map((p) => new Option(p.name, p.id, false, p.id === this.profiles.active.id)));

    const stats = this.profiles.active.stats;
    $('game-tiles').replaceChildren(...GAMES.map((Game) => {
      const { id, title, description, color } = Game.meta;
      const best = this.highscores.best(id);
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.style.setProperty('--tile-color', color);
      tile.innerHTML = '<h3></h3><p></p><div class="best"></div>';
      tile.querySelector('h3').textContent = title;
      tile.querySelector('p').textContent = description;
      tile.querySelector('.best').textContent =
        `Highscore: ${best ? `${best.score} (${best.profileName})` : '–'} · Gespielt: ${stats[id]?.plays ?? 0}`;
      tile.addEventListener('click', () => this.onStart(Game));
      return tile;
    }));
  }
}

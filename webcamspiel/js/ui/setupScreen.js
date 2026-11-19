import { $ } from './screens.js';

const DIFFICULTIES = [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']];

/**
 * Pre-game screen: difficulty + the mode's option choices (from meta.options) + top scores.
 * Last chosen config per game is remembered in settings.gameConfigs[gameId].
 */
export class SetupScreen {
  constructor({ settings, highscores, onStart, onBack }) {
    this.settings = settings;
    this.highscores = highscores;
    this.Game = null;
    $('btn-setup-start').addEventListener('click', () => onStart(this.Game, this.readConfig()));
    $('btn-setup-back').addEventListener('click', onBack);
  }

  open(Game) {
    this.Game = Game;
    const { id, title, description, color, options = {} } = Game.meta;
    const saved = this.settings.get('gameConfigs')?.[id] ?? {};
    $('screen-setup').style.setProperty('--tile-color', color);
    $('setup-title').textContent = title;
    $('setup-description').textContent = description;

    const fields = [this.select('difficulty', 'Schwierigkeit', DIFFICULTIES, saved.difficulty ?? this.settings.get('difficulty'))];
    for (const [key, def] of Object.entries(options)) {
      fields.push(this.select(key, def.label, def.choices, saved.options?.[key] ?? def.default));
    }
    $('setup-options').replaceChildren(...fields);
    this.renderScores(id);
  }

  select(key, label, choices, value) {
    const wrap = document.createElement('label');
    wrap.textContent = label + ' ';
    const sel = document.createElement('select');
    sel.dataset.key = key;
    for (const [v, text] of choices) sel.add(new Option(text, String(v), false, String(v) === String(value)));
    wrap.append(sel);
    return wrap;
  }

  readConfig() {
    const { id, options = {} } = this.Game.meta;
    const config = { difficulty: 'normal', options: {} };
    for (const sel of $('setup-options').querySelectorAll('select')) {
      const key = sel.dataset.key;
      if (key === 'difficulty') { config.difficulty = sel.value; continue; }
      const def = options[key];
      config.options[key] = typeof def.default === 'number' ? Number(sel.value) : sel.value;
    }
    this.settings.set('gameConfigs', { ...this.settings.get('gameConfigs'), [id]: config });
    return config;
  }

  renderScores(id) {
    const list = this.highscores.list(id).slice(0, 5);
    const box = $('setup-scores');
    if (!list.length) { box.replaceChildren(); return; }
    const h = document.createElement('h4');
    h.textContent = 'Bestenliste';
    const ol = document.createElement('ol');
    for (const e of list) {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = e.score;
      li.append(strong, ` – ${e.profileName} (${e.difficulty})`);
      ol.append(li);
    }
    box.replaceChildren(h, ol);
  }
}

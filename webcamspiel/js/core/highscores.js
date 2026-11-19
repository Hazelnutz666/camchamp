import { load, save } from './storage.js';

const MAX_ENTRIES = 10;

// Highscores per game: { [gameId]: [{ score, profileName, difficulty, date }] } sorted desc.
export class Highscores {
  constructor() { this.data = load('highscores', {}); }

  list(gameId) { return this.data[gameId] ?? []; }
  best(gameId) { return this.list(gameId)[0] ?? null; }

  // Returns the rank (1-based) if the score made the table, else null.
  submit(gameId, entry) {
    const record = { ...entry, date: Date.now() };
    const list = [...this.list(gameId), record]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
    this.data[gameId] = list;
    save('highscores', this.data);
    const rank = list.indexOf(record);
    return rank >= 0 ? rank + 1 : null;
  }
}

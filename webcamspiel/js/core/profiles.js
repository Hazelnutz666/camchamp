import { load, save } from './storage.js';

// Profiles hold per-game cumulative stats: { [gameId]: { plays, ...gameSpecificCounters } }
export class Profiles {
  constructor() {
    this.data = load('profiles', { activeId: null, list: [] });
    if (this.data.list.length === 0) this.create('Spieler 1');
  }

  get all() { return this.data.list; }
  get active() { return this.data.list.find((p) => p.id === this.data.activeId) ?? this.data.list[0]; }

  create(name) {
    const profile = { id: crypto.randomUUID(), name, stats: {} };
    this.data.list.push(profile);
    this.data.activeId = profile.id;
    this.persist();
    return profile;
  }

  select(id) { this.data.activeId = id; this.persist(); }

  // Merges numeric `stats` into the active profile: keys starting with "best" keep the
  // maximum (e.g. bestCombo), all others are summed (e.g. goals, misses).
  recordStats(gameId, stats) {
    const target = (this.active.stats[gameId] ??= { plays: 0 });
    target.plays += 1;
    for (const [k, v] of Object.entries(stats)) {
      if (typeof v !== 'number') continue;
      target[k] = k.startsWith('best') ? Math.max(target[k] ?? 0, v) : (target[k] ?? 0) + v;
    }
    this.persist();
  }

  persist() { save('profiles', this.data); }
}

// Tennis scoring: points (0/15/30/40/deuce/advantage) → games → sets (with tiebreak) → match.
// Index 0 = player, 1 = opponent.
const NAMES = ['0', '15', '30', '40'];

export class TennisScore {
  constructor({ setsToWin, gamesPerSet }) {
    this.setsToWin = setsToWin;
    this.gamesPerSet = gamesPerSet;
    this.sets = [0, 0];
    this.games = [0, 0];
    this.points = [0, 0];
    this.tiebreak = false;
    this.tbPlayed = 0;
    this.server = 0;
    this.history = [];   // finished sets [[g0, g1], ...]
    this.winner = null;
  }

  // Returns which units were completed by this point: { game, set, match }.
  point(who) {
    const other = 1 - who;
    const ev = { game: false, set: false, match: false };
    this.points[who]++;

    if (this.tiebreak) {
      this.tbPlayed++;
      if (this.tbPlayed % 2 === 1) this.server = 1 - this.server; // serve changes after 1st point, then every 2
      if (this.points[who] >= 7 && this.points[who] - this.points[other] >= 2) {
        this.games[who]++;
        return this.winSet(who, ev);
      }
      return ev;
    }

    if (this.points[who] >= 4 && this.points[who] - this.points[other] >= 2) {
      ev.game = true;
      this.games[who]++;
      this.points = [0, 0];
      this.server = 1 - this.server;
      const n = this.gamesPerSet;
      if (this.games[who] >= n && this.games[who] - this.games[other] >= 2) return this.winSet(who, ev);
      if (this.games[0] === n && this.games[1] === n) { this.tiebreak = true; this.tbPlayed = 0; }
    }
    return ev;
  }

  winSet(who, ev) {
    ev.game = ev.set = true;
    this.history.push([...this.games]);
    this.sets[who]++;
    this.games = [0, 0];
    this.points = [0, 0];
    this.tiebreak = false;
    if (this.sets[who] >= this.setsToWin) { ev.match = true; this.winner = who; }
    return ev;
  }

  pointText() {
    const [a, b] = this.points;
    if (this.tiebreak) return `TB ${a}:${b}`;
    if (a >= 3 && b >= 3) {
      if (a === b) return 'Einstand';
      return a > b ? 'Vorteil Du' : 'Vorteil Gegner';
    }
    return `${NAMES[a]}:${NAMES[b]}`;
  }
}

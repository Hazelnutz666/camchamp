import { BaseGame } from '../baseGame.js';
import { Particles, FloatingTexts, drawCenterText, drawHint, cameraLost } from '../../fx/effects.js';
import { Projector, COURT_L, NET_Z, NET_H, SINGLES_HW, BALL_R, drawCourt, drawNet, drawBall, drawOpponent, drawRacket } from './scene.js';
import { stepBall, launch, heightAtNet, predictPlayerZ } from './physics.js';
import { Opponent, OPP_DIFFICULTY } from './opponent.js';
import { TennisScore } from './score.js';

const PLAYER = 0, OPP = 1;
const REACH = { easy: 0.75, normal: 0.6, hard: 0.5 };      // racket reach (m) around its center
const NOISE = { easy: 0.6, normal: 0.9, hard: 1.1 };       // player shot spread
const NET_ASSIST = { easy: 1, normal: 0.3, hard: 0 };      // m of missing net clearance we silently fix
const KEY_SPEED = 4;     // m/s racket movement with arrow keys
const SUBSTEPS = 3;
const LINE_TOL = 0.03;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export default class Tennis extends BaseGame {
  static meta = {
    id: 'tennis',
    title: 'Tennis',
    description: 'Schwing den Schläger mit dem Arm: Richtung, Tempo und Spin kommen aus deiner Bewegung.',
    color: '#2de2e6',
    tracking: { hands: true, pose: false },
    options: {
      sets: { label: 'Match', default: 1, choices: [[1, '1 Satz'], [3, 'Best of 3'], [5, 'Best of 5']] },
      games: { label: 'Spiele pro Satz', default: 4, choices: [[2, 'Kurz (2)'], [4, 'Mittel (4)'], [6, 'Standard (6)']] },
    },
  };

  start() {
    this.P = new Projector(this.view);
    this.diff = this.env.difficulty in OPP_DIFFICULTY ? this.env.difficulty : 'normal';
    this.opp = new Opponent(OPP_DIFFICULTY[this.diff]);
    this.reach = REACH[this.diff];
    this.tscore = new TennisScore({ setsToWin: Math.ceil(this.env.options.sets / 2), gamesPerSet: this.env.options.games });
    this.particles = new Particles();
    this.texts = new FloatingTexts();
    this.time = 0;
    this.phase = 'countdown';
    this.timer = 2;
    this.racket = { x: 0, y: 1.0, vx: 0, vy: 0, tilt: 0 };
    this.hitZ = 0;        // player's hitting plane; moves forward for short balls ("running in")
    this.hitZTarget = 0;
    this.racketSource = 'pointer';
    this.flash = 0;
    this.ball = null;
    this.rally = 0;
    this.faults = 0;
    this.message = null;
    this.stats = { pointsWon: 0, pointsLost: 0, winners: 0, errors: 0, gamesWon: 0, setsWon: 0, bestRally: 0 };
    this.score = 0;
    this.input = null;
  }

  update(dt, input) {
    this.input = input;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.particles.update(dt);
    this.texts.update(dt);
    this.opp.update(dt);
    this.hitZ += (this.hitZTarget - this.hitZ) * (1 - Math.pow(0.0005, dt));
    this.updateRacket(dt, input);

    switch (this.phase) {
      case 'countdown':
        this.timer -= dt;
        if (this.timer <= 0) this.startPoint();
        break;
      case 'serve':
        this.timer -= dt;
        if (this.timer <= 0) this.serve();
        break;
      case 'rally':
        for (let i = 0; i < SUBSTEPS && this.phase === 'rally'; i++) this.stepRally(dt / SUBSTEPS);
        break;
      case 'point':
        if (this.ball) stepBall(this.ball, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.tscore.winner !== null) { this.phase = 'over'; this.timer = 2.5; }
          else this.startPoint();
        }
        break;
      case 'over':
        this.timer -= dt;
        if (this.timer <= 0) this.finish({ score: this.computeScore(), stats: this.stats });
        break;
    }

    const t = this.tscore;
    this.hud.set({
      Sätze: `${t.sets[0]}:${t.sets[1]}`,
      Spiele: `${t.games[0]}:${t.games[1]}`,
      Punkte: t.pointText(),
      Aufschlag: t.server === PLAYER ? 'Du' : 'Gegner',
      ...(this.rally >= 3 ? { Ballwechsel: this.rally } : {}),
    });
  }

  computeScore() {
    const s = this.stats;
    return s.pointsWon * 10 + s.gamesWon * 50 + s.setsWon * 200 + (this.tscore.winner === PLAYER ? 1000 : 0);
  }

  debugEnd() { this.finish({ score: this.computeScore(), stats: this.stats }); }

  // --- racket --------------------------------------------------------------

  updateRacket(dt, input) {
    const p = input.pointers.find((q) => q.source === 'camera') ?? input.pointers.find((q) => q.source === 'mouse');
    const { held } = input.keys;
    const kx = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
    const ky = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
    if (kx || ky) this.racketSource = 'key';
    else if (p && (Math.abs(p.vx) + Math.abs(p.vy) > 0.05)) this.racketSource = 'pointer';

    const r = this.racket;
    if (this.racketSource === 'key') {
      r.x = clamp(r.x + kx * KEY_SPEED * dt, -5.5, 5.5);
      r.y = clamp(r.y + ky * KEY_SPEED * dt, 0.1, 3);
      r.vx = kx; r.vy = -ky;
    } else if (p) {
      const w = this.P.unproject(p.x * this.view.width, p.y * this.view.height, this.hitZ);
      r.x = clamp(w.x, -6, 6);
      r.y = clamp(w.y, 0.05, 3.4);
      r.vx = p.vx; r.vy = p.vy; // screen units / s → swing
    }
    r.tilt = clamp(r.vx * 0.25, -0.6, 0.6);
  }

  // Swing from the racket motion: { speed 0..1, dirX -1..1, spin -1..1, lob }
  swing() {
    const r = this.racket;
    if (this.racketSource === 'key') {
      const power = this.input.keys.held.has('Space');
      return { speed: power ? 0.85 : 0.4, dirX: r.vx * 0.7, spin: r.vy < 0 ? 0.6 : 0.1, lob: false };
    }
    const sp = Math.hypot(r.vx, r.vy);
    return {
      speed: clamp(sp / 2.5, 0, 1),
      dirX: clamp(r.vx / 2, -1, 1),
      spin: clamp(-r.vy / 2, -1, 1),
      lob: r.vy < -1.8 && Math.abs(r.vx) < 1,
    };
  }

  // --- points & serve --------------------------------------------------------

  startPoint() {
    this.phase = 'serve';
    this.timer = 1.1;
    this.ball = null;
    this.rally = 0;
    this.message = null;
    this.hitZTarget = 0;
    const right = (this.tscore.points[0] + this.tscore.points[1]) % 2 === 0;
    this.opp.reset(this.tscore.server === OPP ? (right ? -1.2 : 1.2) : 0);
  }

  serve() {
    this.phase = 'rally';
    if (this.tscore.server === PLAYER) {
      // the ball is tossed/fed to the player's hitting zone
      this.ball = { x: clamp(this.racket.x, -2.5, 2.5) * 0.5 + 0.4, y: 1.0, z: 4.5, vx: 0, vy: 3.2, vz: -7.5, spin: 0, hitter: 'feed', bounces: 0 };
    } else {
      const from = { x: this.opp.x, y: 2.6, z: COURT_L };
      this.ball = { ...from, vx: 0, vy: 0, vz: 0, spin: 0.2, hitter: 'opp', bounces: 0 };
      this.oppHit(true);
    }
  }

  stepRally(dt) {
    const b = this.ball;
    const { bounce, net, prevZ } = stepBall(b, dt);

    if (net && b.hitter !== 'feed') {
      b.vz *= -0.1; b.vx *= 0.2;
      return this.pointTo(b.hitter === 'player' ? OPP : PLAYER, 'NETZ!', b.hitter === 'player');
    }

    if (bounce && b.hitter !== 'feed') {
      b.bounces++;
      const playerHit = b.hitter === 'player';
      if (b.bounces === 1) {
        const inX = Math.abs(bounce.x) <= SINGLES_HW + LINE_TOL;
        const inZ = playerHit ? bounce.z >= NET_Z && bounce.z <= COURT_L + LINE_TOL : bounce.z >= -LINE_TOL && bounce.z <= NET_Z;
        if (!inX || !inZ) {
          const ownSide = playerHit ? bounce.z < NET_Z : bounce.z > NET_Z;
          this.splash(bounce, '#ff4d4d');
          return this.pointTo(playerHit ? OPP : PLAYER, ownSide ? 'NETZ!' : 'AUS!', playerHit);
        }
        this.splash(bounce, '#e4ff3d');
      } else if (b.bounces === 2) {
        return playerHit ? this.pointTo(PLAYER, 'WINNER!', false, true) : this.pointTo(OPP, 'NICHT ERREICHT', false);
      }
    }

    // player hits when the ball crosses the hitting plane
    if ((b.hitter === 'opp' || b.hitter === 'feed') && prevZ > this.hitZ && b.z <= this.hitZ) {
      if (Math.hypot(b.x - this.racket.x, b.y - this.racket.y) <= this.reach + BALL_R) this.playerHit();
    }
    // opponent meets the ball at its planned spot
    const plan = this.opp.plan;
    if (b.hitter === 'player' && plan && b.bounces === 1 && prevZ < plan.z && b.z >= plan.z) {
      if (this.opp.canReach(b)) this.oppHit(false);
      else this.opp.plan = null; // too late – let it go
    }

    if (b.hitter === 'feed' && b.z < -3) return this.serveFault();
    if (b.hitter === 'opp' && b.z < -3 && b.bounces >= 1) return this.pointTo(OPP, 'NICHT ERREICHT', false);
    if (b.hitter === 'player' && b.z > COURT_L + 8 && b.bounces >= 1) return this.pointTo(PLAYER, 'WINNER!', false, true);
  }

  serveFault() {
    this.faults++;
    if (this.faults >= 2) { this.faults = 0; return this.pointTo(OPP, 'DOPPELFEHLER', true); }
    this.message = 'FEHLER – 2. Aufschlag';
    this.phase = 'serve';
    this.timer = 1.0;
    this.ball = null;
  }

  playerHit() {
    const b = this.ball;
    const sw = this.swing();
    const sigma = (0.25 + 0.9 * sw.speed * sw.speed) * NOISE[this.diff];
    const target = {
      x: sw.dirX * 3.6 + this.racket.x * 0.15 + gauss() * sigma,
      z: (sw.lob ? 21 : 15.5 + 6 * sw.speed) + gauss() * sigma * 1.3,
    };
    const from = { x: b.x, y: Math.max(0.3, b.y), z: this.hitZ };
    const pace = 11 + 22 * sw.speed;
    let T = Math.hypot(target.x - from.x, target.z - from.z) / pace;
    if (sw.lob) T = Math.max(T * 1.9, 1.4);
    let v = launch(from, target, T, sw.spin);
    // forgiving net clearance on easier levels
    const missing = NET_H + 0.15 - heightAtNet(from, v, sw.spin);
    if (missing > 0 && missing <= NET_ASSIST[this.diff]) {
      for (let i = 0; i < 12 && heightAtNet(from, v, sw.spin) < NET_H + 0.15; i++) { T *= 1.1; v = launch(from, target, T, sw.spin); }
    }
    Object.assign(b, from, v, { spin: sw.spin, hitter: 'player', bounces: 0 });
    this.faults = 0;
    this.rally++;
    this.flash = 1;
    this.hitZTarget = 0; // back to the baseline
    const p = this.P.project(b.x, b.y, from.z);
    this.particles.burst(p.x, p.y, { count: 14, color: '#e4ff3d', speed: 260, size: 3, life: 0.35, gravity: 0 });
    if (sw.speed > 0.75) this.texts.add(p.x, p.y - 40, sw.spin > 0.5 ? 'TOPSPIN!' : sw.spin < -0.5 ? 'SLICE!' : 'POWER!', { color: '#2de2e6', size: 26 });
    this.opp.planIntercept(b);
  }

  oppHit(serve) {
    const b = this.ball;
    const shot = this.opp.chooseShot(this.racket.x, serve);
    const from = { x: b.x, y: clamp(b.y, 0.4, 2.6), z: serve ? COURT_L : b.z };
    const spin = rand(0, 0.4);
    let T = Math.hypot(shot.target.x - from.x, shot.target.z - from.z) / shot.pace;
    let v = launch(from, shot.target, T, spin);
    if (shot.clearNet) {
      for (let i = 0; i < 20 && heightAtNet(from, v, spin) < NET_H + 0.25; i++) { T *= 1.08; v = launch(from, shot.target, T, spin); }
    }
    Object.assign(b, from, v, { spin, hitter: 'opp', bounces: 0 });
    this.hitZTarget = predictPlayerZ(b);
  }

  // who = point winner. ownError: the loser made an unforced error. winner: player hit an outright winner.
  pointTo(who, label, ownError, winner = false) {
    this.phase = 'point';
    this.timer = 1.6;
    const ev = this.tscore.point(who);
    if (who === PLAYER) this.stats.pointsWon++;
    else this.stats.pointsLost++;
    if (winner) this.stats.winners++;
    if (ownError && who === OPP) this.stats.errors++;
    if (ev.game && who === PLAYER) this.stats.gamesWon++;
    if (ev.set && who === PLAYER) this.stats.setsWon++;
    this.stats.bestRally = Math.max(this.stats.bestRally, this.rally);

    let sub = this.tscore.pointText();
    if (ev.match) sub = who === PLAYER ? 'MATCHGEWINN!' : 'MATCH VERLOREN';
    else if (ev.set) sub = `Satz ${who === PLAYER ? 'gewonnen' : 'verloren'} · ${this.tscore.history.at(-1).join(':')}`;
    else if (ev.game) sub = `Spiel ${who === PLAYER ? 'Du' : 'Gegner'} · ${this.tscore.games.join(':')}`;
    this.message = { label, sub, color: who === PLAYER ? '#3ddc84' : '#ff4d4d' };
  }

  splash(at, color) {
    const p = this.P.project(at.x, 0, at.z);
    this.particles.burst(p.x, p.y, { count: 8, color, speed: 90, size: 2, life: 0.4, gravity: 200 });
  }

  // --- rendering -----------------------------------------------------------

  render(ctx) {
    const P = this.P;
    drawCourt(ctx, P);
    drawOpponent(ctx, P, this.opp);
    const b = this.ball;
    if (b && b.z > NET_Z) drawBall(ctx, P, b);
    drawNet(ctx, P);
    if (b && b.z <= NET_Z) drawBall(ctx, P, b);
    this.particles.render(ctx);
    drawRacket(ctx, P, this.racket, this.reach, this.flash, this.hitZ);
    this.texts.render(ctx);

    if (this.phase === 'countdown') {
      drawCenterText(ctx, this.view, String(Math.ceil(this.timer)), { color: '#2de2e6', size: 140 });
    } else if (this.phase === 'serve') {
      const who = this.tscore.server === PLAYER ? 'Dein Aufschlag' : 'Aufschlag Gegner';
      drawCenterText(ctx, this.view, typeof this.message === 'string' ? this.message : who, { color: '#ffffff', size: 54 });
    } else if (this.phase === 'point' && this.message) {
      drawCenterText(ctx, this.view, this.message.label, { color: this.message.color, size: 90 });
      drawHint(ctx, this.view, this.message.sub, 0.64);
    } else if (this.phase === 'over') {
      const won = this.tscore.winner === PLAYER;
      drawCenterText(ctx, this.view, won ? 'SIEG!' : 'NIEDERLAGE', { color: won ? '#ffd23d' : '#ff4d4d', size: 110 });
      drawHint(ctx, this.view, `Sätze ${this.tscore.history.map((s) => s.join(':')).join('  ')}`, 0.64);
    }
    if (this.phase === 'serve' || (this.phase === 'rally' && this.rally === 0)) {
      drawHint(ctx, this.view, 'Schläger zum Ball bewegen und durchschwingen · seitlich = Richtung, nach oben = Topspin', 0.95);
    }
    if (cameraLost(this.input)) drawHint(ctx, this.view, 'Hand nicht erkannt – zeig deine Schlaghand der Kamera', 0.1);
  }
}

// Automated smoke test, loaded only via index.html?smoke (see js/main.js).
// Runs every game mode with simulated mouse swipes, forces the round to end and
// writes a JSON report into <pre id="smoke-result">. Run headless with dev/smoke.ps1.
import { GAMES } from '../js/games/registry.js';
import { ballRadius } from '../js/games/basketball/court.js';
import { stepBall } from '../js/games/tennis/physics.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DT = 1 / 60;
let simTime = 0;

// Mode-specific mechanics checks, run mid-game (phase 'play'). step(frames) advances the app.
const CHECKS = {
  basketball(game, step) {
    // A ball thrown on the exact ballistic arc into the hoop must score.
    const { width: w, height: h } = game.view;
    const hoop = game.hoop;
    const g = 2.2 * h;
    const x = 0.3 * w, y = 0.7 * h, vy = -1.8 * h;
    const t = (-vy + Math.sqrt(vy * vy + 2 * g * (hoop.y - y))) / g;
    const before = game.stats.hits;
    game.balls.push({
      x, y, vx: (hoop.x - x) / t, vy, r: ballRadius(game.view), rot: 0, state: 'thrown', holder: null,
      cooldown: 10, floorTime: 0, alpha: 1, rimHit: false, scored: false, points: 3,
    });
    step(150);
    return { idealThrowScored: game.stats.hits > before };
  },

  penalty(game, step) {
    // Center shots should mostly be saved, top-corner shots mostly go in.
    const shootAndWait = (x, y) => {
      for (let i = 0; i < 300 && game.phase !== 'aim'; i++) step(1);
      game.shoot({ x, y }, 0.3);
      const outcomeFrames = 60;
      step(outcomeFrames);
      return game.outcome;
    };
    const center = Array.from({ length: 5 }, () => shootAndWait(0, 0.8));
    const corner = Array.from({ length: 5 }, () => shootAndWait(3.1, 2.0));
    return { center, corner };
  },

  tennis(game, step, { canvas }) {
    // Autoplayer: put the mouse where the incoming ball will cross the hitting plane (Z = 0).
    const r = canvas.getBoundingClientRect();
    let playerHits = 0, lastRally = 0, lastPhase = null;
    const reasons = [];
    for (let f = 0; f < 60 * 60 && game.phase !== 'over' && !game.finished; f++) {
      if (game.phase === 'point' && lastPhase !== 'point') reasons.push(`${game.message.color === '#3ddc84' ? '+' : '-'}${game.message.label}`);
      lastPhase = game.phase;
      const b = game.ball;
      if (b && (b.hitter === 'opp' || b.hitter === 'feed') && b.vz < 0) {
        const c = { ...b };
        for (let k = 0; k < 600 && c.z > game.hitZTarget; k++) stepBall(c, 1 / 120);
        const sp = game.P.project(c.x, c.y, game.hitZ);
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + sp.x, clientY: r.top + sp.y, bubbles: true }));
      }
      step(1);
      if (game.rally > lastRally) playerHits++;
      lastRally = game.rally;
    }
    const t = game.tscore;
    return { playerHits, reasons: reasons.join(', '), sets: t.sets, games: t.games, points: t.pointText() };
  },
};

export async function run(app) {
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
  const canvas = document.getElementById('game-canvas');
  const report = { games: {}, errors };
  const params = new URLSearchParams(location.search);


  // ?smoke=<gameId> → only that mode, and stop mid-game (for screenshots).
  const only = params.get('smoke');
  for (const Game of only ? GAMES.filter((g) => g.meta.id === only) : GAMES) {
    const id = Game.meta.id;
    const options = Object.fromEntries(Object.entries(Game.meta.options ?? {}).map(([k, d]) => [k, d.choices[0][0]]));
    try {
      await app.startGame(Game, { difficulty: 'easy', options });
      // Headless Chrome doesn't run requestAnimationFrame, so step the app manually at 60 fps.
      app.loop.stop();
      const step = (frames, swipe) => {
        for (let i = 0; i < frames; i++) {
          simTime += DT;
          if (swipe) {
            const r = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new PointerEvent('pointermove', {
              clientX: r.left + r.width * (0.5 + 0.42 * Math.sin(simTime * 9)),
              clientY: r.top + r.height * (0.45 + 0.3 * Math.sin(simTime * 2.3)),
              bubbles: true,
            }));
          }
          app.tick(DT);
        }
      };
      step(60 * 12, true); // 12 s of swiping
      const game = app.game;
      const check = CHECKS[id]?.(game, (frames) => step(frames, false), { canvas, app });
      const px = app.view.ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      const snapshot = {
        phase: game.phase, score: game.score, stats: game.stats, check,
        canvas: `${canvas.width}x${canvas.height}`, centerPixel: Array.from(px).join(','),
      };
      if (only) { report.games[id] = snapshot; report.image = canvas.toDataURL('image/png'); break; }
      // force end of round: timed modes run out the clock, others implement debugEnd()
      if ('remaining' in game) game.remaining = 0.01;
      else game.debugEnd?.();
      step(60 * 3, false);
      await sleep(0);
      report.games[id] = { ...snapshot, finishedOverlay: !document.getElementById('overlay').hidden, highscore: app.highscores.best(id) };
    } catch (err) {
      errors.push(`${id}: ${err.stack ?? err}`);
    }
    app.exitToMenu();
  }

  const pre = document.createElement('pre');
  pre.id = 'smoke-result';
  pre.textContent = JSON.stringify(report);
  document.body.append(pre);
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

`claudestuff/` is its own git repo (remote `origin` = GitHub `Hazelnutz666/camchamp`, branch `main`). It currently contains one project, `webcamspiel/`. Its requirements are in `webcamspiel/GAME DEVELOPMENT PROMPT.md` (German) — the source of truth; progress checklist is in `webcamspiel/README.md`. UI text is German.

## webcamspiel — webcam motion-control multisport game

Vanilla JS ES modules, no build step, no package manager, no game engine, no test suite. Only Python is available on this machine (no Node).

### Running

```powershell
cd webcamspiel; .\start-dev.ps1        # or: python dev/serve.py 8000
```

**Verify every change with the smoke test** (headless Chrome, no Node needed):

```powershell
.\dev\smoke.ps1                                    # all modes; exits 1 on JS errors
.\dev\smoke.ps1 -Game <id> -Screenshot <path.png>  # one mode, PNG of the last frame (read it to check visuals)
```

`index.html?smoke[=<id>]` loads `dev/smoke.js`, which steps `app.tick()` manually (headless Chrome doesn't fire `requestAnimationFrame`), simulates mouse swipes, forces the round to end via `game.remaining`, and reports phase/score/stats/highscore as JSON. Chrome's own `--screenshot` shows a blank canvas, so the page exports the canvas itself.

Serve over `http://localhost` (secure context for `getUserMedia`). For LAN/phone testing use `.\start-dev.ps1 -Https` (`serve.py --https`): it binds 0.0.0.0 and generates a self-signed cert with openssl into the git-ignored `dev/certs/`. Use `dev/serve.py` rather than `python -m http.server`: it forces `text/javascript` for `.js` (the Windows registry can map it to `text/plain`, which breaks module loading) and disables caching. MediaPipe (`@mediapipe/tasks-vision`, version pinned in `js/input/cameraTracker.js`) and its models load from CDN only when the webcam is enabled. `window.__app` exposes the App instance in the browser console.

### Architecture

- `js/core/app.js` owns every service and the screen flow (menu → settings → game + pause/finish overlay). It runs the `GameLoop`, calls `input.update(dt)` once per frame, and passes the resulting **InputState** to the active game. Esc/P toggles pause. On `finish()` it writes highscores and profile stats.
- `js/input/inputManager.js` is the only input API games may use. InputState = `{ source, pointers[], pose, keys }`, with pointers normalized to 0..1 and velocities in units/s via the shared `PointerTracker`, so mouse and camera behave the same. Mouse pointers are always merged in as a fallback. If the camera fails (denied, not found, or MediaPipe load error), it switches to mouse automatically and reports a `CameraError` with a `code`.
- `CameraTracker.transform()` is the one place where mirror mode, sensitivity, and `settings.calibration` are applied to landmarks. Hand pointers use the index fingertip (landmark 8). The pose (33 landmarks) is only computed when a game's `meta.tracking.pose` is true. The Pose Landmarker is expensive and only needed for the penalty shootout.
- Game modes: `js/games/<id>/index.js` default-exports a `BaseGame` subclass with `static meta` (id, title, description, color, tracking, options), registered in `js/games/registry.js`. The menu tiles, highscores, and stats derive from the registry. The lifecycle contract is documented in `js/games/baseGame.js`. Games draw in CSS pixels via `env.view` (`CanvasView`, DPR-aware) and show scores through `env.hud.set({...})`.
- Flow: menu tile → `SetupScreen` (difficulty plus `meta.options`, given as `{ key: { label, default, choices } }`; the last choice per game is saved in `settings.gameConfigs`) → `app.startGame(Game, config)`. The game receives the resolved values as `env.options` and the difficulty as `env.difficulty`.
- Calibration (`js/games/calibration/`) is a `BaseGame` with `meta.utility: true`, so it is not in the registry. The settings screen starts it via `app.startGame`. On finish, the app skips highscores and returns to settings. While collecting, it sets `settings.calibration` to identity. It reads `InputState.rawHands` (mirrored only) and least-squares fits `{offsetX, offsetY, scale}` in `fit.js`. If it is left early, `destroy()` restores the previous values.
- `Profiles.recordStats` sums numeric stats, except keys that start with `best`, which keep the maximum.
- Static backgrounds go through `view.drawLayer(ctx, key, draw)` (`CanvasView`), which renders once to an offscreen canvas and redraws on resize. Only cache what depends solely on view size; per-frame animation (e.g. the penalty crowd) stays outside the layer.
- `js/fx/effects.js` holds the shared particles, floating texts, screen shake, center text, and `formatTime`. Fruit Slasher (`js/games/fruit-slasher/`) is the reference implementation: a countdown → play → over phase machine, physics relative to screen height, a `DIFFICULTY` table, and blade speed measured over a ~60 ms window because the camera delivers ~30 fps while rendering runs at 60.
- Penalty and Tennis are pseudo-3D: each `scene.js` has a `Projector` (world meters → screen) with near-plane clipping where needed. Mouse and hand input is mapped into the world via `unproject` onto a plane (Penalty: the goal plane; Tennis: the moving hitting plane `hitZ`, which moves forward for short balls).
- Penalty: `kickDetector.js` turns pose landmarks into `{ dirX, height, power }` (normalized by leg length). `keeper.js` reacts with delay and noise and anticipates the player's favourite corner.
- Tennis: `physics.js` covers spin, bounce, net, ballistic `launch()`, and intercept prediction. `score.js` covers tennis scoring, including tiebreak.
- `dev/smoke.js` `CHECKS` holds the per-mode mechanics tests (Basketball: an ideal throw scores; Penalty: center shots are saved and corner shots go in; Tennis: an autoplayer rallies). Keep them passing when tuning gameplay.
- Camera display: `app.updateCameraView()` puts the single `<video>` either into `#camera-overlay` (full screen, semi-transparent, CSS-transformed exactly like `CameraTracker.transform()` so the image lines up with the tracked points) or into the corner preview. `app.setCamera()` is the single on/off path, used by both the menu "Spielmodi" switch and the settings screen.
- Headless Chrome's fake webcam doesn't work on this machine, so camera code paths can only be verified manually in a real browser.
- Persistence: all LocalStorage access goes through `js/core/storage.js` (namespaced `webcamspiel:v1:`); `Settings`, `Profiles`, and `Highscores` sit on top of it.

### Constraints from the spec

No placeholder or decorative-only buttons in finished features; every mode must stay playable with mouse/keyboard; handle camera denial explicitly; keep dependencies minimal; don't rewrite working code unnecessarily; check for errors after each step.

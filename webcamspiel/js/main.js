import { App } from './core/app.js';

const app = new App();
await app.init();
window.__app = app; // dev convenience: inspect state from the browser console

// Dev only: index.html?smoke runs the automated smoke test (dev/smoke.ps1).
if (new URLSearchParams(location.search).has('smoke')) {
  const { run } = await import('../dev/smoke.js');
  run(app);
}

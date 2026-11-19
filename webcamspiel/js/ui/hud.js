// DOM HUD over the canvas. Only touches the DOM when a value actually changes.
export class Hud {
  constructor(el) {
    this.el = el;
    this.last = '';
  }

  set(items) {
    const key = JSON.stringify(items);
    if (key === this.last) return;
    this.last = key;
    this.el.replaceChildren(...Object.entries(items).map(([label, value]) => {
      const span = document.createElement('span');
      span.textContent = `${label}: ${value}`;
      return span;
    }));
  }

  clear() { this.last = ''; this.el.replaceChildren(); }
}

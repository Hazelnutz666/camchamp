// Tracks held keys and keys pressed since the last update (by KeyboardEvent.code).
export class KeyboardInput {
  constructor() {
    this.held = new Set();
    this.pressedBuffer = new Set();
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressedBuffer.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  update() {
    const pressed = this.pressedBuffer;
    this.pressedBuffer = new Set();
    return { held: new Set(this.held), pressed };
  }
}

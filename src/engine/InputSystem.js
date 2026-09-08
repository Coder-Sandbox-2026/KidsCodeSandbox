/**
 * InputSystem.js – Keyboard and mouse input for movement / camera controllers.
 * Does not decide how an actor moves; it only reports current input.
 */
export class InputSystem {
  constructor() {
    this.enabled = true;
    this.keys = Object.create(null);
    this._mouseDx = 0;
    this._mouseDy = 0;
    this._jumpQueued = false;

    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this._jumpQueued = true;
      }
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this._onMouse = (e) => {
      if (!this.enabled || !document.pointerLockElement) return;
      this._mouseDx += e.movementX;
      this._mouseDy += e.movementY;
    };
    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement && e.button === 0) {
        this._jumpQueued = true;
      }
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('mousedown', this._onMouseDown);
  }

  isDown(code) {
    return !!this.keys[code];
  }

  consumeLookDelta() {
    const dx = this._mouseDx;
    const dy = this._mouseDy;
    this._mouseDx = 0;
    this._mouseDy = 0;
    return { x: dx, y: dy };
  }

  consumeJump() {
    const jump = this._jumpQueued;
    this._jumpQueued = false;
    return jump;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys = Object.create(null);
      this._jumpQueued = false;
      this._mouseDx = 0;
      this._mouseDy = 0;
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('mousedown', this._onMouseDown);
  }
}

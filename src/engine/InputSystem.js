import { appSettings } from '../settings/appSettings.js';

const SIMPLE_TURN_SPEED = Math.PI / 2; // 90 degrees per second.

/**
 * InputSystem.js – Keyboard and mouse input for movement / camera controllers.
 * Does not decide how an actor moves; it only reports current input.
 */
export class InputSystem {
  constructor(settings = appSettings) {
    this.controlStyle = settings.get('controlStyle') === 'simple' ? 'simple' : 'experienced';
    this._unsubscribe = settings.subscribe((values, key) => {
      if (key !== 'controlStyle') return;
      this.controlStyle = values.controlStyle === 'simple' ? 'simple' : 'experienced';
      this.clear();
    });
    this.enabled = true;
    this.keys = Object.create(null);
    this._mouseDx = 0;
    this._mouseDy = 0;
    this._jumpQueued = false;

    this._onKeyDown = (e) => {
      if (!this.active) return;
      if (e.repeat && !this.keys[e.code]) return;
      this.keys[e.code] = true;
      if (this.controlStyle === 'simple' && e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'Space') {
        e.preventDefault();
        this._jumpQueued = true;
      }
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this._onMouse = (e) => {
      if (!this.active || this.controlStyle === 'simple') return;
      this._mouseDx += e.movementX;
      this._mouseDy += e.movementY;
    };
    this._onMouseDown = (e) => {
      if (!this.active) return;
      if (document.pointerLockElement && e.button === 0) {
        this._jumpQueued = true;
      }
    };

    this._onCaptureChange = () => this.clear();
    document.addEventListener('pointerlockchange', this._onCaptureChange);
    document.addEventListener('blur', this._onCaptureChange, true);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('mousedown', this._onMouseDown);
  }

  get active() {
    return this.enabled && !!document.pointerLockElement;
  }

  isDown(code) {
    if (this.controlStyle === 'simple') {
      if (code === 'KeyA' || code === 'KeyD') return false;
      code = ({ KeyW: 'ArrowUp', KeyS: 'ArrowDown' })[code] || code;
    }
    return this.active && !!this.keys[code];
  }

  consumeLookDelta(dt = 0) {
    const dx = this._mouseDx;
    const dy = this._mouseDy;
    this._mouseDx = 0;
    this._mouseDy = 0;
    if (!this.active) return { x: 0, y: 0 };
    if (this.controlStyle === 'simple') {
      const direction = Number(this.isDown('ArrowRight')) - Number(this.isDown('ArrowLeft'));
      return { x: 0, y: 0, turnRadians: direction * SIMPLE_TURN_SPEED * dt };
    }
    return { x: dx, y: dy };
  }

  consumeJump() {
    const jump = this._jumpQueued;
    this._jumpQueued = false;
    return this.active && jump;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  clear() {
    this.keys = Object.create(null);
    this._jumpQueued = false;
    this._mouseDx = 0;
    this._mouseDy = 0;
  }

  dispose() {
    this._unsubscribe();
    document.removeEventListener('pointerlockchange', this._onCaptureChange);
    document.removeEventListener('blur', this._onCaptureChange, true);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('mousedown', this._onMouseDown);
  }
}

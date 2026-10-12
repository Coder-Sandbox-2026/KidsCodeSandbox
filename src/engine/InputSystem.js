import { appSettings } from '../settings/appSettings.js';

const ARROW_MOVEMENT = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight' };
const UI_TARGET = 'input, textarea, select, button, [contenteditable], .monaco-editor, dialog, [role=combobox], [role=menu]';

const SIMPLE_TURN_SPEED = Math.PI / 2; // 90 degrees per second.
const TOUCH_LOOK_SPEED = Math.PI * 0.65;

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
    this._virtualActive = false;
    this._virtualMoveX = 0;
    this._virtualMoveY = 0;
    this._virtualLookX = 0;
    this._virtualLookY = 0;

    this._onKeyDown = (e) => {
      if (!this.active || e.target?.closest?.(UI_TARGET)) return;
      if (e.repeat && !this.keys[e.code]) return;
      this.keys[e.code] = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
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
    this._onFocus = () => { if (document.activeElement?.closest?.(UI_TARGET)) this.clear(); };
    document.addEventListener('focusin', this._onFocus);
    document.addEventListener('pointerlockchange', this._onCaptureChange);
    document.addEventListener('blur', this._onCaptureChange, true);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('mousedown', this._onMouseDown);
  }

  get active() {
    return this.enabled && !!document.pointerLockElement
      && !document.activeElement?.closest?.(UI_TARGET);
  }

  get virtualActive() {
    const uiOwner = document.activeElement?.closest?.(UI_TARGET);
    return this.enabled && this._virtualActive
      && (!uiOwner || !!uiOwner.closest?.('.mobile-controls'));
  }

  setVirtualActive(active) {
    this._virtualActive = !!active;
    if (!active) this.clearVirtual();
  }

  setVirtualMove(x, y) {
    if (!this.virtualActive) return;
    const length = Math.hypot(x, y);
    const scale = length > 1 ? 1 / length : 1;
    this._virtualMoveX = x * scale;
    this._virtualMoveY = y * scale;
  }

  getMoveAxes() {
    if (this.virtualActive) return { x: this._virtualMoveX, y: this._virtualMoveY };
    let x = Number(this.isDown('KeyD')) - Number(this.isDown('KeyA'));
    let y = Number(this.isDown('KeyW')) - Number(this.isDown('KeyS'));
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  setVirtualLook(x, y) {
    if (!this.virtualActive) return;
    this._virtualLookX = Math.max(-1, Math.min(1, x));
    this._virtualLookY = Math.max(-1, Math.min(1, y));
  }

  queueVirtualJump() {
    if (this.virtualActive) this._jumpQueued = true;
  }

  clearVirtual() {
    this._virtualMoveX = 0;
    this._virtualMoveY = 0;
    this._virtualLookX = 0;
    this._virtualLookY = 0;
    this._jumpQueued = false;
  }

  isDown(code) {
    if (this.controlStyle === 'simple') {
      if (code === 'KeyA' || code === 'KeyD') return false;
      code = ({ KeyW: 'ArrowUp', KeyS: 'ArrowDown' })[code] || code;
    }
    return this.active && (!!this.keys[code]
      || (this.controlStyle === 'experienced' && !!this.keys[ARROW_MOVEMENT[code]]));
  }

  consumeLookDelta(dt = 0) {
    const dx = this._mouseDx;
    const dy = this._mouseDy;
    this._mouseDx = 0;
    this._mouseDy = 0;
    if (this.virtualActive) {
      return {
        x: 0,
        y: 0,
        turnRadians: this._virtualLookX * TOUCH_LOOK_SPEED * dt,
        pitchRadians: this._virtualLookY * TOUCH_LOOK_SPEED * dt,
      };
    }
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
    return (this.active || this.virtualActive) && jump;
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
    this.clearVirtual();
  }

  dispose() {
    this._unsubscribe();
    document.removeEventListener('focusin', this._onFocus);
    document.removeEventListener('pointerlockchange', this._onCaptureChange);
    document.removeEventListener('blur', this._onCaptureChange, true);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('mousedown', this._onMouseDown);
  }
}

const DEAD_ZONE = 0.14;

export function hasMobileControlCapability(win = window) {
  const touch = (win.navigator?.maxTouchPoints || 0) > 0 || 'ontouchstart' in win;
  return touch && !!win.matchMedia?.('(pointer: coarse)').matches;
}

export function shouldShowMobileControls({ capable, landscape, gameActive, inputAllowed, blocked }) {
  return capable && landscape && gameActive && inputAllowed && !blocked;
}

export function joystickAxes(dx, dy, radius, deadZone = DEAD_ZONE) {
  if (!(radius > 0)) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  if (distance <= radius * deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (distance / radius - deadZone) / (1 - deadZone));
  return { x: dx / distance * magnitude, y: -dy / distance * magnitude };
}

function isShown(element) {
  return !!element && !element.classList.contains('hidden') && element.getAttribute('aria-hidden') !== 'true';
}

export function runEscapeAction(action) {
  action();
}

export function runReleasedAction(action) {
  action();
}

export class MobileControls {
  constructor({ host, getInput, isGameActive, escapeAction, primaryAction, secondaryAction }) {
    this.host = host;
    this.getInput = getInput;
    this.isGameActive = isGameActive;
    this.escapeAction = escapeAction;
    this.capable = hasMobileControlCapability();
    this.sessionActive = false;
    this.disposed = false;
    this._activeInput = null;

    this.element = document.createElement('div');
    this.element.className = 'mobile-controls hidden';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <button class="mobile-exit" type="button" aria-label="Exit game">X</button>
      <div class="mobile-stick mobile-move" aria-label="Move"><span></span></div>
      <div class="mobile-actions">
        <button class="mobile-action mobile-action-a" type="button" aria-label="Create red cube">A</button>
        <button class="mobile-jump" type="button" aria-label="Jump">JUMP</button>
        <button class="mobile-action mobile-action-b" type="button" aria-label="Play explosion">B</button>
      </div>
      <div class="mobile-stick mobile-look" aria-label="Look"><span></span></div>`;
    host.appendChild(this.element);

    this._cleanups = [];
    this._bindStick(this.element.querySelector('.mobile-move'), (x, y) => this.getInput()?.setVirtualMove(x, y));
    this._bindStick(this.element.querySelector('.mobile-look'), (x, y) => this.getInput()?.setVirtualLook(x, -y));
    this._bindJump(this.element.querySelector('.mobile-jump'));
    this._bindReleasedButton(this.element.querySelector('.mobile-action-a'), primaryAction);
    this._bindReleasedButton(this.element.querySelector('.mobile-action-b'), secondaryAction);
    const exit = this.element.querySelector('.mobile-exit');
    this._listen(exit, 'pointerdown', event => {
      event.preventDefault();
      runEscapeAction(this.escapeAction);
    });
    this._listen(this.element, 'contextmenu', event => event.preventDefault());
    this._listen(window, 'blur', () => this.clear());
    this._listen(window, 'resize', () => this.refresh());
    this._listen(window, 'orientationchange', () => { this.clear(); this.refresh(); });
    this._listen(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
    this._tick = () => { this.refresh(); if (!this.disposed) this._frame = requestAnimationFrame(this._tick); };
    this._frame = requestAnimationFrame(this._tick);
  }

  get supported() { return this.capable; }

  setSessionActive(active) {
    this.sessionActive = !!active;
    if (!active) this.clear();
    this.refresh();
  }

  _blocked() {
    return isShown(document.getElementById('play-overlay'))
      || isShown(document.getElementById('settings-backdrop'))
      || [...this.host.querySelectorAll('.challenge-briefing')].some(isShown)
      || !!document.querySelector('.success-dialog[open]');
  }

  refresh() {
    const input = this.getInput();
    const visible = shouldShowMobileControls({
      capable: this.capable,
      landscape: window.innerWidth > window.innerHeight,
      gameActive: this.sessionActive && this.isGameActive(),
      inputAllowed: !!input?.enabled,
      blocked: this._blocked(),
    });
    if (input !== this._activeInput) {
      this._activeInput?.setVirtualActive(false);
      this._activeInput = input;
      input?.setVirtualActive(visible);
    }
    if (visible === !this.element.classList.contains('hidden')) return;
    this.element.classList.toggle('hidden', !visible);
    this.element.setAttribute('aria-hidden', String(!visible));
    input?.setVirtualActive(visible);
    if (!visible) this.clear();
  }

  clear() {
    this.getInput()?.clearVirtual();
    for (const reset of this._controlResets || []) reset();
    this.element.querySelector('.mobile-jump')?.classList.remove('active');
  }

  _listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  _bindStick(stick, update) {
    this._controlResets ||= [];
    const thumb = stick.querySelector('span');
    let pointerId = null;
    const reset = () => {
      pointerId = null;
      thumb.style.transform = '';
      stick.classList.remove('active');
      update(0, 0);
    };
    this._controlResets.push(reset);
    const move = event => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      const rect = stick.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = event.clientX - (rect.left + radius);
      const dy = event.clientY - (rect.top + radius);
      const distance = Math.hypot(dx, dy);
      const scale = distance > radius ? radius / distance : 1;
      thumb.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      const axes = joystickAxes(dx, dy, radius);
      update(axes.x, axes.y);
    };
    this._listen(stick, 'pointerdown', event => {
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      stick.setPointerCapture?.(pointerId);
      stick.classList.add('active');
      move(event);
    });
    this._listen(stick, 'pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this._listen(stick, type, event => { if (event.pointerId === pointerId) reset(); });
    }
  }

  _bindJump(button) {
    let pointerId = null;
    const reset = event => {
      if (event && event.pointerId !== pointerId) return;
      pointerId = null;
      button.classList.remove('active');
    };
    this._controlResets ||= [];
    this._controlResets.push(() => reset());
    this._listen(button, 'pointerdown', event => {
      if (pointerId !== null) return;
      event.preventDefault();
      pointerId = event.pointerId;
      button.setPointerCapture?.(pointerId);
      button.classList.add('active');
      this.getInput()?.queueVirtualJump();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this._listen(button, type, reset);
  }

  _bindReleasedButton(button, action) {
    let pointerId = null;
    const reset = event => {
      if (event && event.pointerId !== pointerId) return false;
      pointerId = null;
      button.classList.remove('active');
      return true;
    };
    this._controlResets ||= [];
    this._controlResets.push(() => reset());
    this._listen(button, 'pointerdown', event => {
      if (pointerId !== null) return;
      event.preventDefault();
      pointerId = event.pointerId;
      button.setPointerCapture?.(pointerId);
      button.classList.add('active');
    });
    this._listen(button, 'pointerup', event => {
      if (!reset(event)) return;
      runReleasedAction(action);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) this._listen(button, type, reset);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._frame);
    this.clear();
    this.getInput()?.setVirtualActive(false);
    this._cleanups.forEach(cleanup => cleanup());
    this.element.remove();
  }
}

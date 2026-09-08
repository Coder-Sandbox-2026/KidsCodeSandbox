/**
 * HUD.js – Screen text for print(), setText(), clearText().
 *
 * print() lines last 10 seconds by default (override with options.duration).
 * Lines that share the same x/y origin form a stack. When a line expires,
 * it is removed and the remaining lines in that stack close the gap.
 */
const DEFAULT_DURATION_SEC = 10;
const STACK_GAP_PX = 4;

function stackKey(x, y) {
  const sx = x === undefined ? 'default' : Number(x);
  const sy = y === undefined ? 'default' : Number(y);
  return `${sx}:${sy}`;
}

export class HUD {
  constructor(overlayEl) {
    this.overlay = overlayEl;
    /** @type {Map<string, HTMLElement>} named setText elements */
    this.namedTexts = new Map();
    /** @type {Map<string, { originX: number|null, originY: number|null, lines: object[] }>} */
    this.stacks = new Map();
  }

  /**
   * print(message, opts)
   * opts: { x, y, color, size, duration }  duration is seconds (default 10)
   */
  print(text, opts = {}) {
    const durationSec = opts.duration === undefined ? DEFAULT_DURATION_SEC : Number(opts.duration);
    const key = stackKey(opts.x, opts.y);
    let stack = this.stacks.get(key);
    if (!stack) {
      stack = {
        originX: opts.x === undefined ? null : Number(opts.x),
        originY: opts.y === undefined ? null : Number(opts.y),
        lines: [],
      };
      this.stacks.set(key, stack);
    }

    const el = document.createElement('div');
    el.className = 'hud-text';
    el.textContent = String(text);
    if (opts.color) el.style.color = opts.color;
    if (opts.size) el.style.fontSize = opts.size + 'px';
    this.overlay.appendChild(el);

    const line = { el, timeoutId: null };
    stack.lines.push(line);
    this._layoutStack(stack);

    if (Number.isFinite(durationSec) && durationSec > 0) {
      line.timeoutId = setTimeout(() => this._removeLine(stack, line), durationSec * 1000);
    }

    return el;
  }

  /** setText(id, text, opts) – persistent named text (does not auto-expire) */
  setText(id, text, opts = {}) {
    let el = this.namedTexts.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hud-text';
      this.overlay.appendChild(el);
      this.namedTexts.set(id, el);
    }
    el.textContent = String(text);
    if (opts.color) el.style.color = opts.color;
    if (opts.size) el.style.fontSize = opts.size + 'px';
    if (opts.x !== undefined || opts.y !== undefined) {
      el.style.position = 'absolute';
      if (opts.x !== undefined) el.style.left = opts.x + 'px';
      if (opts.y !== undefined) el.style.top = opts.y + 'px';
    }
    return el;
  }

  /** clearText() – remove all HUD text and cancel timers */
  clear() {
    for (const stack of this.stacks.values()) {
      for (const line of stack.lines) {
        if (line.timeoutId) clearTimeout(line.timeoutId);
      }
    }
    this.stacks.clear();
    this.namedTexts.clear();
    this.overlay.innerHTML = '';
  }

  _removeLine(stack, line) {
    if (line.timeoutId) {
      clearTimeout(line.timeoutId);
      line.timeoutId = null;
    }
    const idx = stack.lines.indexOf(line);
    if (idx !== -1) stack.lines.splice(idx, 1);
    if (line.el.parentNode) line.el.remove();

    if (stack.lines.length === 0) {
      for (const [key, s] of this.stacks) {
        if (s === stack) this.stacks.delete(key);
      }
      return;
    }

    this._layoutStack(stack);
  }

  /** Pack remaining lines in this stack so there are no vertical gaps. */
  _layoutStack(stack) {
    const left = stack.originX === null ? 16 : stack.originX;
    let top = stack.originY === null ? 16 : stack.originY;

    for (const line of stack.lines) {
      line.el.style.position = 'absolute';
      line.el.style.left = left + 'px';
      line.el.style.top = top + 'px';
      line.el.style.marginBottom = '0';
      top += line.el.offsetHeight + STACK_GAP_PX;
    }
  }
}

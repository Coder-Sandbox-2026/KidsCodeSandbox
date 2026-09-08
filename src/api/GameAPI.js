/**
 * GameAPI.js – Builds the global API object injected into the user's code scope.
 * All kid-friendly functions (createCube, print, etc.) live here.
 */
import { createShapeFactories } from './ShapeFactory.js';
import { createModelFactories } from './ModelFactory.js';
import { GameObject } from './GameObject.js';
import { HUD } from './HUD.js';
import { Actor } from '../engine/Actor.js';

const MAX_FORMAT_DEPTH = 8;

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Turn values into plain text, similar to console.log, without exposing
 * functions or engine / Three.js internals.
 */
function formatValue(value, seen = new Set(), depth = 0, quoteStrings = false) {
  if (value === null || value === undefined) return String(value);

  const t = typeof value;
  if (t === 'string') return quoteStrings ? JSON.stringify(value) : value;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
  if (t === 'function') return '[function]';
  if (t === 'symbol') return '[symbol]';
  if (t !== 'object') return String(value);

  if (depth > MAX_FORMAT_DEPTH) return '[...]';

  // Three.js scene-graph nodes (meshes, cameras, groups, …)
  if (value.isObject3D) return '[3D object]';

  // Kid-facing actors: public fields only, never mesh/engine/physics
  if (value instanceof Actor) {
    const summary = {};
    try { summary.name = value.name; } catch { /* ignore */ }
    try { if (value instanceof GameObject) summary.color = value.color; } catch { /* ignore */ }
    try {
      const p = value.position;
      if (p) summary.position = { x: p.x, y: p.y, z: p.z };
    } catch { /* ignore */ }
    try { summary.isPlayer = value.isPlayer(); } catch { /* ignore */ }
    return formatValue(summary, seen, depth, quoteStrings);
  }

  if (value.isVector2) return `{ x: ${value.x}, y: ${value.y} }`;
  if (value.isVector3 || value.isEuler) {
    return `{ x: ${value.x}, y: ${value.y}, z: ${value.z} }`;
  }

  if (seen.has(value)) return '[Circular]';

  if (Array.isArray(value)) {
    seen.add(value);
    const inner = value.map((item) => formatValue(item, seen, depth + 1, true));
    seen.delete(value);
    return `[${inner.join(', ')}]`;
  }

  if (!isPlainObject(value)) {
    const name = value.constructor && value.constructor.name;
    return name ? `[${name}]` : '[object]';
  }

  seen.add(value);
  const parts = Object.keys(value).map((key) => {
    let inner;
    try {
      inner = formatValue(value[key], seen, depth + 1, true);
    } catch {
      inner = '[object]';
    }
    return `${key}: ${inner}`;
  });
  seen.delete(value);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

function formatArgs(args) {
  return Array.from(args, (arg) => formatValue(arg)).join(' ');
}

export class GameAPI {
  constructor(engine, hudOverlay, consoleFn, clearConsoleFn) {
    this.engine = engine;
    this.hud = new HUD(hudOverlay);
    this._consoleFn = consoleFn;
    this._clearConsoleFn = clearConsoleFn || (() => {});

    this._objects = [];
    this.shapes = createShapeFactories(engine);
    this.models = createModelFactories(engine);
    this._keysDown = new Set();
    this._keyHandlers = [];

    this._groupDepth = 0;
    this._timers = new Map();
    this._counts = new Map();

    document.addEventListener('keydown', (e) => {
      this._keysDown.add(e.code);
      this._emitKey(e, 'down');
      if (!e.repeat) this._emitKey(e, 'pressed');
    });
    document.addEventListener('keyup', (e) => {
      this._keysDown.delete(e.code);
      this._emitKey(e, 'released');
    });
  }

  _emitKey(event, type) {
    for (const handler of this._keyHandlers) {
      if ((handler.type || 'down') !== type) continue;
      if (handler.key === event.code || handler.key === event.key) {
        handler.fn();
      }
    }
  }

  _write(type, args) {
    const indent = '  '.repeat(this._groupDepth);
    this._consoleFn(indent + formatArgs(args), type);
  }

  /** Safe console used by kid code — not the real browser console. */
  _createConsole() {
    const self = this;
    return Object.freeze({
      log: (...args) => self._write('info', args),
      info: (...args) => self._write('info', args),
      debug: (...args) => self._write('info', args),
      warn: (...args) => self._write('warn', args),
      error: (...args) => self._write('error', args),

      clear: () => {
        self._clearConsoleFn();
        self._groupDepth = 0;
      },

      assert: (ok, ...args) => {
        if (!ok) self._write('error', ['Assertion failed:', ...args]);
      },

      table: (data) => {
        if (data == null) {
          self._write('info', [data]);
          return;
        }
        if (Array.isArray(data)) {
          data.forEach((row, i) => self._write('info', [`[${i}]`, row]));
          return;
        }
        if (typeof data === 'object') {
          for (const [key, val] of Object.entries(data)) {
            self._write('info', [`${key}:`, val]);
          }
          return;
        }
        self._write('info', [data]);
      },

      time: (label = 'default') => {
        self._timers.set(String(label), performance.now());
      },
      timeLog: (label = 'default', ...args) => {
        const start = self._timers.get(String(label));
        if (start === undefined) {
          self._write('warn', [`Timer "${label}" does not exist`]);
          return;
        }
        self._write('info', [`${label}: ${Math.round(performance.now() - start)}ms`, ...args]);
      },
      timeEnd: (label = 'default') => {
        const key = String(label);
        const start = self._timers.get(key);
        if (start === undefined) {
          self._write('warn', [`Timer "${key}" does not exist`]);
          return;
        }
        self._write('info', [`${key}: ${Math.round(performance.now() - start)}ms`]);
        self._timers.delete(key);
      },

      count: (label = 'default') => {
        const key = String(label);
        const n = (self._counts.get(key) || 0) + 1;
        self._counts.set(key, n);
        self._write('info', [`${key}: ${n}`]);
      },
      countReset: (label = 'default') => {
        self._counts.set(String(label), 0);
      },

      group: (...args) => {
        if (args.length) self._write('info', args);
        self._groupDepth += 1;
      },
      groupCollapsed: (...args) => {
        if (args.length) self._write('info', args);
        self._groupDepth += 1;
      },
      groupEnd: () => {
        self._groupDepth = Math.max(0, self._groupDepth - 1);
      },
    });
  }

  /** Build the flat API dictionary injected as globals into user code */
  buildScope() {
    const self = this;
    const engine = this.engine;
    const kidConsole = this._createConsole();

    const wrapCreate = (fn) => (opts) => {
      const obj = fn(opts);
      self._objects.push(obj);
      return obj;
    };

    return {
      createCube: wrapCreate(this.shapes.createCube),
      createSphere: wrapCreate(this.shapes.createSphere),
      createCone: wrapCreate(this.shapes.createCone),
      createCylinder: wrapCreate(this.shapes.createCylinder),
      createPlane: wrapCreate(this.shapes.createPlane),
      createGoldCoin: wrapCreate(this.models.createGoldCoin),
      createCake: wrapCreate(this.models.createCake),

      print: (text, opts) => {
        this.hud.print(text, opts);
        this._consoleFn(String(text), 'info');
      },
      setText: (id, text, opts) => this.hud.setText(id, text, opts),
      clearText: () => this.hud.clear(),

      update: (fn) => { engine.userUpdateCallbacks.push(fn); },
      onUpdate: (fn) => { engine.userUpdateCallbacks.push(fn); },

      wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      random: (min = 0, max = 1) => min + Math.random() * (max - min),
      distance: (a, b) => {
        const pa = a.position || a;
        const pb = b.position || b;
        return Math.sqrt(
          (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2 + (pa.z - pb.z) ** 2
        );
      },

      destroy: (obj) => { if (obj && obj.destroy) obj.destroy(); },
      findObject: (name) => self._objects.find(o => o.name === name) || null,
      getPlayer: () => engine.getPlayer(),

      isKeyDown: (key) => self._keysDown.has(key),
      onKeyDown: (key, fn) => {
        self._keyHandlers.push({ key, fn, type: 'down' });
      },
      onKeyPressed: (key, fn) => {
        self._keyHandlers.push({ key, fn, type: 'pressed' });
      },
      onKeyReleased: (key, fn) => {
        self._keyHandlers.push({ key, fn, type: 'released' });
      },

      log: (...args) => kidConsole.log(...args),
      Math,
      console: kidConsole,
    };
  }

  reset() {
    this._objects = [];
    this._keyHandlers = [];
    this._groupDepth = 0;
    this._timers.clear();
    this._counts.clear();
    this.hud.clear();
  }
}

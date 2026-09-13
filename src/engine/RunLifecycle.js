/** Application-owned generations. This guards the game API, not browser globals. */
export class RunCancelledError extends Error {
  constructor() {
    super('This student run is no longer active.');
    this.name = 'RunCancelledError';
  }
}

export class RunLifecycle {
  constructor() {
    this.generation = 0;
    this.current = null;
  }

  begin() {
    this.invalidate();
    this.current = new StudentRun(this, this.generation);
    return this.current;
  }

  invalidate() {
    const previous = this.current;
    this.current = null;
    this.generation += 1;
    previous?.cancelWaits();
  }
}

class StudentRun {
  constructor(owner, id) {
    this.owner = owner;
    this.id = id;
    this.waits = new Set();
    this.views = new WeakMap();
    this.targets = new WeakMap();
    this.callbacks = new WeakMap();
  }

  get active() { return this.owner.current === this; }

  assertActive() {
    if (!this.active) throw new RunCancelledError();
  }

  wait(ms) {
    this.assertActive();
    const promise = new Promise((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer);
        reject(new RunCancelledError());
      };
      const timer = setTimeout(() => {
        this.waits.delete(cancel);
        if (this.active) resolve();
        else reject(new RunCancelledError());
      }, ms);
      this.waits.add(cancel);
    });
    // An unused wait() should not cause an unhandled cancellation rejection.
    // Awaiting the original promise still receives cancellation.
    promise.catch(() => {});
    return promise;
  }

  cancelWaits() {
    for (const cancel of this.waits) cancel();
    this.waits.clear();
  }

  callback(fn) {
    if (typeof fn !== 'function') return fn; // Keep existing API validation.
    if (this.callbacks.has(fn)) return this.callbacks.get(fn);
    const run = this;
    const guarded = function (...args) {
      if (!run.active) return;
      try {
        const result = fn.apply(run.view(this), args.map(value => run.view(value)));
        if (result && typeof result.then === 'function') {
          return Promise.resolve(result).catch(error => {
            if (run.active && !(error instanceof RunCancelledError)) throw error;
          });
        }
        return result;
      } catch (error) {
        if (run.active && !(error instanceof RunCancelledError)) throw error;
      }
    };
    this.callbacks.set(fn, guarded);
    return guarded;
  }

  argument(value) {
    if (typeof value === 'function') return this.callback(value);
    return this.targets.get(value) || value;
  }

  bind(fn, receiver) {
    return (...args) => {
      this.assertActive();
      return this.view(fn.apply(receiver, args.map(value => this.argument(value))));
    };
  }

  /**
   * Stable run-specific views also protect retained players, vectors, methods,
   * and callback payloads after an arbitrary await. Engine internals keep raw
   * objects, so rendering, physics synchronization and cleanup are unchanged.
   */
  view(value) {
    if (value === null || typeof value !== 'object' || value instanceof Promise) return value;
    if (this.targets.has(value)) return value;
    if (this.views.has(value)) return this.views.get(value);
    const methods = new Map();
    const proxy = new Proxy(value, {
      get: (target, key) => {
        this.assertActive();
        const member = Reflect.get(target, key, target);
        if (typeof member !== 'function') return this.view(member);
        if (!methods.has(member)) methods.set(member, this.bind(member, target));
        return methods.get(member);
      },
      set: (target, key, next) => {
        this.assertActive();
        return Reflect.set(target, key, this.argument(next), target);
      },
      defineProperty: (target, key, descriptor) => {
        this.assertActive();
        return Reflect.defineProperty(target, key, descriptor);
      },
      deleteProperty: (target, key) => {
        this.assertActive();
        return Reflect.deleteProperty(target, key);
      },
    });
    this.views.set(value, proxy);
    this.targets.set(proxy, value);
    return proxy;
  }

  /** Retain the existing async wrapper and report only this run's outcome. */
  async execute(code, scope, { success, error } = {}) {
    try {
      this.assertActive();
      const execute = new Function(
        ...Object.keys(scope),
        `"use strict"; return (async () => {\n${code}\n})();`
      );
      await execute(...Object.values(scope));
      if (this.active) success?.();
    } catch (cause) {
      if (this.active && !(cause instanceof RunCancelledError)) error?.(cause);
    }
  }
}

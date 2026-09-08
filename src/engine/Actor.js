/**
 * Actor.js – Shared identity for gameplay entities (GameObjects, Player).
 *
 * This is intentionally small: a stable kind/tag plus collision hooks.
 * Movement and camera stay on interchangeable controllers, not here.
 */
export const ACTOR_KIND = {
  OBJECT: 'object',
  PLAYER: 'player',
};

export class Actor {
  constructor({ kind = ACTOR_KIND.OBJECT } = {}) {
    this._actorKind = kind;
    this._tags = new Set([kind]);
    this._destroyed = false;
    this._onCollision = null;
    this._onCollisionEnd = null;
  }

  /** True only for the active player actor. */
  isPlayer() {
    return this._actorKind === ACTOR_KIND.PLAYER || this._tags.has(ACTOR_KIND.PLAYER);
  }

  onCollision(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onCollision() expects a function');
    }
    this._onCollision = fn;
    return this;
  }

  /** Engine-only: contact just began. */
  _triggerCollision(other) {
    if (this._destroyed) return;
    this._onCollision?.(other);
  }

  /** Engine-only: reserved for a future onCollisionEnd API. */
  _triggerCollisionEnd(other) {
    if (this._destroyed) return;
    this._onCollisionEnd?.(other);
  }
}

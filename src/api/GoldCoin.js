import { GameObject } from './GameObject.js';

export class GoldCoin extends GameObject {
  constructor(...args) {
    super(...args);
    this._spinMultiplier = 1;
    this._collectionArmed = !this._overlapsPlayer();
    this.engine.goldCoins ??= new Set();
    this.engine.goldCoins.add(this);
  }
  getSpinRate() { return this._spinMultiplier; }
  setSpinRate(rate) {
    if (!Number.isFinite(rate)) throw new TypeError('setSpinRate() expects a finite number');
    this._spinMultiplier = rate;
    return this;
  }
  _overlapsPlayer() {
    const player = this.engine.getPlayer?.() ?? this.engine.player;
    if (!player?.collider) return false;
    const info = this._physicsInfo ?? this._kinematicInfo;
    this.engine.physics.world.propagateModifiedBodyPositionsToColliders();
    return (info?.colliders ?? (info?.collider ? [info.collider] : []))
      .some(collider => !!collider.contactCollider(player.collider, 0.05));
  }
  updateCoin(dt) {
    this.mesh.rotation.y += dt * 0.6 * this._spinMultiplier;
    if (!this._collectionArmed && !this._overlapsPlayer()) this._collectionArmed = true;
  }
  _triggerCollision(other) {
    if (this._destroyed || this._collected) return;
    if (!other?.isPlayer()) return super._triggerCollision(other);
    if (!this._collectionArmed) return;
    this._collected = true;
    try {
      this.engine.audio?.playSfx('coin');
      super._triggerCollision(other);
    } finally { this.destroy(); }
  }
  destroy() {
    this.engine.goldCoins?.delete(this);
    super.destroy();
  }
}

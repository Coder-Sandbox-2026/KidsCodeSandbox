import * as THREE from 'three';
import { GameObject } from './GameObject.js';

export class RedKey extends GameObject {
  constructor(...args) {
    super(...args);
    this.keyColor = this._keyColor ?? 'red';
    this._collectionArmed = !this._overlapsPlayer();
    if (this.keyColor === 'red') {
      this.engine.redKeys ??= new Set();
      this.engine.redKeys.add(this);
    }
    this.engine.keys ??= new Map();
    if (!this.engine.keys.has(this.keyColor)) this.engine.keys.set(this.keyColor, new Set());
    this.engine.keys.get(this.keyColor).add(this);
    if (this._stageOwned) console.info('[RedKeyDebug] Stage-owned Red Key registered in the active world.');
  }

  _overlapsPlayer() {
    const player = this.engine.getPlayer?.() ?? this.engine.player;
    if (!player?.collider) return false;
    const info = this._physicsInfo ?? this._kinematicInfo;
    this.engine.physics.world.propagateModifiedBodyPositionsToColliders();
    return (info?.colliders ?? (info?.collider ? [info.collider] : []))
      .some(collider => !!collider.contactCollider(player.collider, 0.05));
  }

  updateRedKey(dt) {
    if (this._destroyed) return;
    this.mesh.rotation.y += dt * 0.6;
    if (!this._collectionArmed && !this._overlapsPlayer()) this._collectionArmed = true;
  }

  _triggerCollision(other) {
    if (this._destroyed || this._collected) return;
    if (this.ignorePlayer && other?.isPlayer?.()) return;
    if (!other?.isPlayer()) return super._triggerCollision(other);
    if (!this._collectionArmed) return;
    this._collected = true;
    let callbackError;
    try { super._triggerCollision(other); }
    catch (error) { callbackError = error; }
    finally {
      if (!this._destroyed) {
        try { this.engine.audio?.playSfx('coin'); }
        finally { this.destroy(); }
      }
    }
    if (callbackError) throw callbackError;
  }

  destroy() {
    if (this.keyColor === 'red') this.engine.redKeys?.delete(this);
    this.engine.keys?.get(this.keyColor)?.delete(this);
    super.destroy();
  }
}

/**
 * VFXManager.js – Owns live visual effects, ticks them in the engine loop,
 * and wraps the bundled ember explosion so kid code can call playExplosion().
 */
import * as THREE from 'three';
import { playEmberExplosion } from '../vfx/ember-explosion-vfx/index.js';

const _forward = new THREE.Vector3();

/** Defaults sized for the first-person playground (the bundled cinematic defaults are huge). */
const PLAYGROUND_DEFAULTS = {
  emberCount: 360,
  spawnRadius: 10,
  convergenceDuration: 3.0,
  chargeDuration: 1.2,
  explosionRadius: 8,
  explosionDuration: 2.0,
};

const MAX_ACTIVE = 3;

export class VFXManager {
  constructor(engine) {
    this.engine = engine;
    this._effects = new Set();
  }

  /**
   * Play the ember explosion. Position can be omitted (in front of the camera),
   * a [x, y, z] array, a Vector3, a { x, y, z } object, or a game object.
   * Extra options are passed through to the VFX module (emberCount, debug, …).
   */
  playEmberExplosion(options) {
    const scene = this.engine.scene;
    if (!scene) return null;

    const config = normalizePlayOptions(options);
    const position = toVector3(config.position) || inFrontOfCamera(this.engine.camera);

    while (this._effects.size >= MAX_ACTIVE) {
      const oldest = this._effects.values().next().value;
      this._disposeEffect(oldest);
    }

    const effect = playEmberExplosion(scene, {
      ...PLAYGROUND_DEFAULTS,
      ...config,
      position,
    });

    this._effects.add(effect);
    effect.on('finished', () => {
      if (!effect.config?.loop) this._disposeEffect(effect);
    });
    return effect;
  }

  update(dt) {
    const camera = this.engine.camera;
    for (const effect of this._effects) {
      effect.update(dt, camera);
    }
  }

  clear() {
    for (const effect of [...this._effects]) {
      this._disposeEffect(effect);
    }
  }

  _disposeEffect(effect) {
    this._effects.delete(effect);
    try { effect.dispose(); } catch { /* already gone */ }
  }
}

function normalizePlayOptions(options) {
  if (options == null) return {};
  if (isVec3Like(options)) return { position: options };
  if (typeof options !== 'object') return {};
  if (isGameActor(options)) return { position: options.position };
  return { ...options };
}

function isGameActor(value) {
  return !!(value && value.position && (
    typeof value.isPlayer === 'function'
    || typeof value.destroy === 'function'
    || value.rotation
  ));
}

function isVec3Like(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.isVector3 || Array.isArray(value)) return true;
  return typeof value.x === 'number'
    && typeof value.y === 'number'
    && typeof value.z === 'number'
    && value.position == null
    && value.emberCount == null;
}

function toVector3(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  }
  if (typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number') {
    return new THREE.Vector3(value.x, value.y, value.z);
  }
  return null;
}

function inFrontOfCamera(camera, distance = 10) {
  if (!camera) return new THREE.Vector3(0, 2, -6);
  camera.getWorldDirection(_forward);
  const pos = camera.position.clone().addScaledVector(_forward, distance);
  pos.y = Math.max(pos.y, 1.25);
  return pos;
}

/**
 * VFXManager.js – Owns live visual effects, ticks them in the engine loop,
 * and wraps the bundled ember explosion so kid code can call playExplosion().
 */
import * as THREE from 'three';
import {
  EMBER_EXPLOSION_PHASES,
  loadVfxTextures,
  playEmberExplosion,
} from '../vfx/ember-explosion-vfx/index.js';

const _forward = new THREE.Vector3();

/** Internal timing / density defaults sized for the first-person playground. */
const PLAYGROUND_DEFAULTS = {
  emberCount: 360,
  convergenceDuration: 3.0,
  chargeDuration: 1.2,
  explosionDuration: 2.0,
};

const DEFAULT_RADIUS = 3;
const MAX_RADIUS = 10;
const MAX_ACTIVE = 3;

export class VFXManager {
  constructor(engine) {
    this.engine = engine;
    this._effects = new Set();
    this._texturesPromise = loadVfxTextures().catch((err) => {
      console.warn('[vfx] Could not load explosion textures:', err);
      return null;
    });
  }

  /**
   * Play the ember explosion. Position can be omitted (in front of the camera),
   * a [x, y, z] array, a Vector3, a { x, y, z } object, or a game object / player.
   * Options objects only use position and radius (default 3, max 10).
   */
  async playEmberExplosion(options) {
    const scene = this.engine.scene;
    if (!scene) return null;

    const config = normalizePlayOptions(options);
    const position = toVector3(config.position) || inFrontOfCamera(this.engine.camera);
    const explosionRadius = resolveRadius(config.radius);
    const spawnRadius =10;//explosionRadius * 1.2;
    const textures = await this._texturesPromise;

    let effect;
    try {
      effect = await playEmberExplosion(scene, {
        ...PLAYGROUND_DEFAULTS,
        explosionRadius,
        spawnRadius,
        position,
        ...(textures ? { textures } : {}),
      });
    } catch (err) {
      console.warn('[vfx] Could not play ember explosion:', err);
      return null;
    }

    while (this._effects.size >= MAX_ACTIVE) {
      const oldest = this._effects.values().next().value;
      this._disposeEffect(oldest);
    }

    this._effects.add(effect);
    effect.on('finished', () => {
      if (!effect.config?.loop) this._disposeEffect(effect);
    });
    effect.on('phase', ({ phase }) => {
      this._handleExplosionPhase(phase);
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

  _handleExplosionPhase(phase) {
    switch (phase) {
      case EMBER_EXPLOSION_PHASES.CONVERGING:
        break;
      case EMBER_EXPLOSION_PHASES.CHARGING:
        break;
      case EMBER_EXPLOSION_PHASES.EXPLODING:
        break;
      case EMBER_EXPLOSION_PHASES.FADING:
        break;
      case EMBER_EXPLOSION_PHASES.COMPLETE:
        break;
      default:
        break;
    }
  }
}

function normalizePlayOptions(options) {
  if (options == null) return {};
  if (isVec3Like(options)) return { position: options };
  if (typeof options !== 'object') return {};
  if (isGameActor(options)) return { position: options.position };
  return {
    position: options.position,
    radius: options.radius,
  };
}

function resolveRadius(radius) {
  if (radius == null || radius === '') return DEFAULT_RADIUS;
  const value = Number(radius);
  if (!Number.isFinite(value)) return DEFAULT_RADIUS;
  return Math.min(MAX_RADIUS, Math.max(0, value));
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
    && value.radius == null;
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

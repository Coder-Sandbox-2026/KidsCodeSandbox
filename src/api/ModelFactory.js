/**
 * ModelFactory.js – Kid-friendly helpers that place preloaded GLB models
 * in the scene, just like createCube / createSphere.
 */
import { GameObject } from './GameObject.js';
import { CAKE_MODEL, GOLD_COIN_MODEL } from '../engine/ModelLoader.js';

function applyCommonOptions(root, opts = {}) {
  if (opts.position) {
    const p = opts.position;
    root.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  }
  if (opts.scale !== undefined) {
    const s = opts.scale;
    if (Array.isArray(s)) root.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
    else root.scale.set(s, s, s);
  }
  if (opts.name) root.name = opts.name;
}

function spawnCollectible(engine, modelId, defaultName, opts = {}) {
  if (!engine.models?.has(modelId)) {
    const extra = engine.modelLoadError?.message
      ? ` ${engine.modelLoadError.message}`
      : '';
    throw new Error(`The ${defaultName} model could not be loaded.` + extra);
  }

  const { root, colliderParts } = engine.models.clone(modelId);
  applyCommonOptions(root, opts);
  if (!opts.name) root.name = defaultName;

  engine.scene.add(root);

  const wantPhysics = !!opts.physics;
  // Collectibles are detectable by default so onCollision works without extra setup.
  const wantCollision = opts.collision !== false;

  const obj = new GameObject(root, engine, null, {
    collision: wantCollision && !wantPhysics,
    colliderParts,
    ownsGeometry: false,
  });
  if (opts.name) obj.name = opts.name;
  if (opts.color) obj.setColor(opts.color);

  if (wantPhysics) {
    obj.enablePhysics({
      mass: opts.mass,
      restitution: opts.bounciness ?? 0.12,
      friction: opts.friction ?? 0.9,
    });
    if (wantCollision) obj.enableCollision();
  }

  return obj;
}

export function createModelFactories(engine) {
  /**
   * Place a gold coin. It can be collected (collision on) but it does not
   * fall or get pushed unless you call enablePhysics().
   */
  function createGoldCoin(opts = {}) {
    return spawnCollectible(engine, GOLD_COIN_MODEL, 'goldCoin', opts);
  }

  /**
   * Place a cake. Same collectible rules as the gold coin:
   * collision on, physics off, unless you change them.
   */
  function createCake(opts = {}) {
    return spawnCollectible(engine, CAKE_MODEL, 'cake', opts);
  }

  return { createGoldCoin, createCake };
}

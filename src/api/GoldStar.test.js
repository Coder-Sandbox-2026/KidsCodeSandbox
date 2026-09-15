import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

// Match Vite's development flag and asset URL imports without a browser.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) return {
      url: `data:text/javascript,export default ${JSON.stringify(new URL(specifier, context.parentURL).href)}`,
      shortCircuit: true,
    };
    return next(specifier, context);
  },
  load(url, context, next) {
    const result = next(url, context);
    if (url.endsWith('/debugGoldStarConfig.js')) return {
      ...result, source: String(result.source).replace('import.meta.env?.DEV === true', 'false'),
    };
    return result;
  },
});
const { ModelLoader } = await import('../engine/ModelLoader.js');
const { createModelFactories } = await import('../api/ModelFactory.js');
const { PhysicsManager } = await import('../engine/PhysicsManager.js');
const { updateGoldStars, clearGoldStars } = await import('../api/GoldStar.js');
hooks.deregister();

test('actual GoldStar uses authored shadows, ITEM collider, and owned materials', async t => {
  const loader = new ModelLoader();
  const bytes = await readFile(new URL('../assets/model/GoldStar.glb', import.meta.url));
  const gltf = await loader._gltf.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  loader._gltf.loadAsync = async () => gltf;
  await loader._loadCollectible({ id: 'goldStar', defaultName: 'goldStar', fileName: 'GoldStar.glb', materialStyle: 'goldStar' });
  const first = loader.clone('goldStar');
  const second = loader.clone('goldStar');
  assert(first.colliderParts.some(part => part.role === 'item'));
  const meshes = [];
  first.root.traverse(node => { if (node.isMesh) meshes.push(node); });
  assert.equal(meshes.length, 6);
  assert.equal(meshes.filter(node => node.castShadow).length, 1);
  assert.equal(meshes.find(node => node.castShadow).userData.name, 'Gold Star');
  for (const mesh of meshes) {
    const other = second.root.getObjectByName(mesh.name);
    assert.notEqual(mesh.material, other.material);
    assert.equal(mesh.geometry, other.geometry);
  }

  const scene = new THREE.Scene();
  const physics = new PhysicsManager();
  await physics.init();
  t.after(() => { physics.world.free(); physics._eventQueue.free(); });
  const engine = { models: loader, scene, sceneManager: { scene }, userMeshes: [], physics, RAPIER: physics.RAPIER };
  const star = createModelFactories(engine).createGoldStar({ collision: false, position: [1, 2, 3], scale: 2 });
  assert.deepEqual(star.position.toArray(), [1, 2, 3]);
  assert.equal(star.scale.x, 2);
  assert.equal(typeof star.enablePhysics, 'function');
  assert.equal(typeof star.onCollision, 'function');
  star.setSpinRate(0); // Isolate scale-dependent glitter bounds from rotation.
  updateGoldStars(engine, 0.12);
  const particle = scene.children.find(node => node.isSprite);
  assert(particle);
  const position = particle.position.clone();
  const initialSize = particle.scale.x;
  star.position.x += 100;
  star.setScale(4);
  updateGoldStars(engine, 0.12);
  assert(particle.position.equals(position));
  const latest = scene.children.filter(node => node.isSprite).at(-1);
  assert(Math.abs(latest.scale.x / initialSize - 2) < 0.001);
  updateGoldStars(engine, 0.81);
  assert.equal(particle.parent, null);
  for (let i = 0; i < 100; i++) updateGoldStars(engine, 0.05);
  assert(scene.children.filter(node => node.isSprite).length <= 8);
  star.destroy();
  assert.equal(scene.children.length, 0);
  clearGoldStars(engine);
  const collectible = createModelFactories(engine).createGoldStar();
  assert(collectible._kinematicInfo.colliders.every(collider => collider.isSensor()));
  assert.equal(collectible.scale.x, 0.20);
  assert.equal(collectible.getSpinRate(), 0.01);
  const rotation = collectible.rotation.y;
  updateGoldStars(engine, 0.001);
  updateGoldStars(engine, 0.05);
  assert(Math.abs(collectible.rotation.y - rotation - 0.02) < 1e-10);
  assert.equal(collectible.setSpinRate(-0.03), collectible);
  updateGoldStars(engine, 0.01);
  assert(Math.abs(collectible.rotation.y - rotation + 0.01) < 1e-10);
  collectible.setSpinRate(0);
  const stopped = collectible.rotation.y;
  updateGoldStars(engine, 0.01);
  assert.equal(collectible.rotation.y, stopped);
  assert.throws(() => collectible.setSpinRate(NaN), TypeError);
  collectible._triggerCollision(null);
  collectible._triggerCollision({ isPlayer: () => false });
  assert.equal(collectible._destroyed, false);
  let collections = 0;
  engine.onGoldStarCollected = star => {
    collections++;
    assert.equal(star._destroyed, false);
    // Reentrant collision notifications must not collect the same item twice.
    star._triggerCollision({ isPlayer: () => true });
  };
  let called = false;
  collectible.onCollision(() => { called = true; });
  collectible._triggerCollision({ isPlayer: () => true });
  assert(called);
  assert(collectible._destroyed);
  collectible._triggerCollision({ isPlayer: () => true });
  assert.equal(collections, 1);
  updateGoldStars(engine, 0.12);
  assert.equal(collectible.rotation.y, stopped);
  collectible.destroy();
  const physical = createModelFactories(engine).createGoldStar({ physics: true });
  assert(physical._physicsInfo);
  physical.destroy();
  assert.equal(scene.children.length, 0);
});

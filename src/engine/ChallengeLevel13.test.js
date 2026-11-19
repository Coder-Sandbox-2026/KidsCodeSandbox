import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';

// Resolve Vite's ?url imports to stable module values for Node's test loader.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) return {
      url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(new URL(specifier, context.parentURL).href)}`)}`,
      shortCircuit: true,
    };
    return next(specifier, context);
  },
});
const { isPlayerStartNode, playerDirectionFromMarker } = await import('./ChallengeLevel13.js');
const { isRedKeyPlaceholder, spawnRedKeyPlaceholders } = await import('./GLBStageProcessor.js');
const { stripAndBakeCollisionMeshes } = await import('./collisionMeshes.js');
const { RedKey } = await import('../api/RedKey.js');
hook.deregister();

test('PLAYER_START classification is exact and supports authored glTF names', () => {
  assert.equal(isPlayerStartNode({ name: 'PLAYER_START' }), true);
  assert.equal(isPlayerStartNode({ name: 'PlayerStart' }), false);
  assert.equal(isPlayerStartNode({ name: 'PLAYER_START_extra' }), false);
  assert.equal(isPlayerStartNode({ name: 'sanitized', userData: { name: 'PLAYER_START' } }), true);
});

test('PLAYER_START facing uses its final inherited world orientation', () => {
  const root = new THREE.Group();
  root.rotation.y = Math.PI / 2;
  const marker = new THREE.Object3D();
  marker.name = 'PLAYER_START';
  marker.rotation.y = Math.PI / 2;
  root.add(marker);

  const direction = playerDirectionFromMarker(marker);
  assert.ok(Math.abs(direction[0]) < 1e-12);
  assert.ok(Math.abs(direction[1]) < 1e-12);
  assert.ok(Math.abs(direction[2] - 1) < 1e-12);
});

test('Red Key placeholder replacement does not skip adjacent COL_ geometry', () => {
  const root = new THREE.Group();
  const parent = new THREE.Group();
  parent.position.set(10, 2, -4);
  root.add(parent);

  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  placeholder.name = 'PH_KeyRed';
  placeholder.position.set(2, 3, 5);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8));
  floor.name = 'COL_Floor';
  // Put the placeholder first to reproduce live-array sibling skipping.
  parent.add(placeholder, floor);
  root.updateMatrixWorld(true);

  const spawned = [];
  assert.equal(isRedKeyPlaceholder(placeholder), true);
  assert.equal(spawnRedKeyPlaceholders(root, {
    modelFactories: { createRedKey: options => spawned.push(options) },
  }), 1);
  const parts = stripAndBakeCollisionMeshes(root, { worldSpace: true });

  assert.equal(spawned.length, 1);
  assert.deepEqual(spawned[0].position, [12, 5, 1]);
  assert.equal(parts.filter(part => part.role === 'col').length, 1);
  assert.equal(root.getObjectByName('PH_KeyRed'), undefined);
  assert.equal(root.getObjectByName('COL_Floor'), undefined);
});

test('colored keys register independently and expose collision callbacks', () => {
  const engine = { userMeshes: [], findPlayer: () => null };
  for (const color of ['red', 'green', 'yellow', 'blue']) {
    const mesh = new THREE.Group();
    mesh.name = `key${color}`;
    const key = new RedKey(mesh, engine, null, { collision: false, keyColor: color });
    assert.equal(engine.keys.get(color).has(key), true);
    assert.equal(typeof key.onCollision, 'function');
    assert.equal(key.keyColor, color);
  }
  assert.equal(engine.keys.size, 4);
  assert.equal(engine.redKeys.size, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { Player } from './Player.js';
import { PhysicsManager } from '../engine/PhysicsManager.js';
import { RunLifecycle } from '../engine/RunLifecycle.js';
import { API_DOCS } from '../editor/apiCompletions.js';
import { registerAutocomplete } from '../editor/AutocompleteProvider.js';

// Use the existing Node test convention for Vite asset URL imports.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) return {
      url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(new URL(specifier, context.parentURL).href)}`)}`,
      shortCircuit: true,
    };
    return next(specifier, context);
  },
});
const { GameAPI } = await import('./GameAPI.js');
hook.deregister();

test('player transform APIs synchronize physics and first-person view safely', async t => {
  const savedDocument = globalThis.document;
  globalThis.document = new EventTarget();
  const physics = new PhysicsManager();
  await physics.init();
  const camera = new THREE.PerspectiveCamera();
  const player = new Player(camera, physics);
  t.after(() => {
    player.dispose();
    physics.world.free();
    physics._eventQueue.free();
    if (savedDocument === undefined) delete globalThis.document;
    else globalThis.document = savedDocument;
  });
  const api = Object.assign(Object.create(GameAPI.prototype), {
    engine: { player, getPlayer: () => player }, shapes: {}, models: {},
    _consoleFn() {}, _groupDepth: 0,
  });
  const scope = api.buildScope(new RunLifecycle().begin());
  player.cameraController.pitch = 0.4;
  player.movementController.velocity.set(0, -30, 0);
  player.movementController.horizVelocity.set(10, 0, 0);
  const input = [10, 3, 5];
  scope.setPlayerPosition(input);
  input[0] = 999;
  assert.deepEqual([...scope.getPlayerPosition()], [10, 3, 5]);
  assert.deepEqual({ ...player.body.nextTranslation() }, { x: 10, y: 3, z: 5 });
  assert.deepEqual(camera.position.toArray(), [10, 3.8, 5]);
  assert.equal(player.movementController.velocity.length(), 0);
  assert.equal(player.movementController.horizVelocity.length(), 0);
  physics.world.step();
  assert.deepEqual([...scope.getPlayerPosition()], [10, 3, 5]);
  player.update(0);
  physics.world.step();
  assert.deepEqual([...scope.getPlayerPosition()], [10, 3, 5]);
  const copy = scope.getPlayerPosition();
  copy[0] = 999;
  assert.equal(scope.getPlayerPosition()[0], 10);

  scope.setPlayerDirection([5, 8, 0]);
  const direction = scope.getPlayerDirection();
  assert.ok(Math.abs(direction[0] - 1) < 1e-12);
  assert.equal(direction[1], 0);
  assert.ok(Math.abs(direction[2]) < 1e-12);
  assert.equal(player.cameraController.pitch, 0.4);
  const look = camera.getWorldDirection(new THREE.Vector3());
  assert.ok(look.x > 0.9);
  assert.ok(Math.abs(look.z) < 1e-12);
  assert.ok(Math.abs(new THREE.Vector3(...direction).length() - 1) < 1e-12);
  player.cameraController.pitch = 0.4;
  player.cameraController.applyToActor(player.position);
  const lookDirection = scope.getPlayerLookDirection();
  assert.ok(lookDirection[1] > 0.3);
  assert.ok(Math.abs(new THREE.Vector3(...lookDirection).length() - 1) < 1e-12);
  lookDirection[1] = 999;
  assert.ok(scope.getPlayerLookDirection()[1] < 1);
  direction[0] = 999;
  assert.ok(scope.getPlayerDirection()[0] <= 1);
  scope.setPlayerDirection([0, 0, -1]);
  assert.ok(Math.abs(player.cameraController.yaw) < 1e-12);
  for (const value of [null, ['x', 2, 3], [Infinity, 0, 0], Array(3)]) {
    assert.throws(() => scope.setPlayerPosition(value), /three numbers/);
    assert.throws(() => scope.setPlayerDirection(value), /three numbers/);
  }
  assert.throws(() => scope.setPlayerDirection([0, 0, 0]), /horizontally/);
  assert.throws(() => scope.setPlayerDirection([0, 5, 0]), /horizontally/);
  assert.deepEqual([...scope.getPlayerPosition()], [10, 3, 5]);
  assert.ok(Math.abs(player.cameraController.yaw) < 1e-12);

  // Controllers own camera relationships; Player does not write raw camera coordinates.
  camera.position.set(50, 20, 30);
  const origins = [];
  const firstPerson = player.cameraController;
  player.cameraController = { yaw: firstPerson.yaw, applyToActor: p => origins.push([p.x, p.y, p.z]) };
  scope.setPlayerPosition([2, 4, 6]);
  scope.setPlayerDirection([1, 0, 0]);
  assert.deepEqual(camera.position.toArray(), [50, 20, 30]);
  assert.deepEqual(origins, [[2, 4, 6], [2, 4, 6]]);
  firstPerson.yaw = player.cameraController.yaw;
  player.cameraController = firstPerson;
  firstPerson.applyToActor(player.position);
  assert.deepEqual(camera.position.toArray(), [2, 4.8, 6]);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).x > 0.9);

  await t.test('editor execution exposes all four transform globals', async () => {
    const output = [];
    api.hud = { print: value => output.push([...value]) };
    const run = new RunLifecycle().begin();
    let failure;
    let succeeded = false;
    await run.execute(`
      const pos = getPlayerPosition();
      print(pos);
      setPlayerPosition([10, 3, 10]);
      setPlayerDirection([1, 0, 0]);
      const dir = getPlayerDirection();
      print(dir);
    `, api.buildScope(run), {
      success: () => { succeeded = true; },
      error: error => { failure = error; },
    });
    assert.equal(failure, undefined);
    assert.equal(succeeded, true);
    assert.deepEqual(output[0], [2, 4, 6]);
    assert.ok(Math.abs(output[1][0] - 1) < 1e-12);
    assert.deepEqual(player.getPlayerPosition(), [10, 3, 10]);
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).x > 0.9);
  });
});

test('all player transform APIs have function metadata and autocomplete', () => {
  let provider;
  registerAutocomplete({ languages: {
    CompletionItemKind: { Function: 1, Method: 2, Property: 3 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    registerCompletionItemProvider(_language, value) { provider = value; },
    registerHoverProvider() {},
  } });
  for (const name of ['getPlayerPosition', 'setPlayerPosition', 'getPlayerDirection', 'getPlayerLookDirection', 'setPlayerDirection']) {
    assert.equal(API_DOCS.find(item => item.label === name)?.kind, 'Function');
    const result = provider.provideCompletionItems({
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: name.length + 1 }),
      getLineContent: () => name, getValueInRange: () => name,
    }, { lineNumber: 1, column: name.length + 1 });
    assert.equal(result.suggestions.find(item => item.label === name)?.kind, 1);
  }
});

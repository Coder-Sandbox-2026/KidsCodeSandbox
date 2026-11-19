import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from '../api/Player.js';
import { PlayerDetection, DRONE_DETECTION_STATES } from './PlayerDetection.js';

if (!globalThis.document) {
  globalThis.document = {
    pointerLockElement: null,
    addEventListener() {},
    removeEventListener() {},
  };
}

async function fixture() {
  const physics = new PhysicsManager();
  await physics.init();
  const player = new Player(new THREE.PerspectiveCamera(), physics);
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.position.set(0, 1.4, 0);
  scene.add(root);
  scene.updateMatrixWorld(true);
  const messages = [];
  const config = {
    playerDetectionEnabled: true,
    detectionRange: 10,
    detectionHorizontalFOV: 90,
    detectionVerticalFOV: 60,
    detectionUpdateRate: 10,
    detectionMinimumVisibleRatio: 0.4,
    detectionAcquireDuration: 0.2,
    detectionLostDuration: 0.5,
    detectionOcclusionEnabled: true,
    detectionEyeOffset: [0, 0.35, 0.55],
    detectionDebug: false,
  };
  const detector = new PlayerDetection({
    root,
    physics,
    playerProvider: () => player,
    config,
    onDetected: () => messages.push('detected'),
  });
  return { physics, player, root, detector, config, messages, scene };
}

function addFixedBox(physics, { x = 0, y = 1.4, z = 2, hx = 1, hy = 1, hz = 0.1 } = {}) {
  const body = physics.world.createRigidBody(physics.RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(
    physics.RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z), body,
  );
  return body;
}

function addDynamicBox(physics, { x = 0, y = 1.4, z = 2 } = {}) {
  const mesh = new THREE.Object3D();
  mesh.position.set(x, y, z);
  const { body } = physics.addDynamic(mesh, physics.RAPIER.ColliderDesc.cuboid(1, 1, 0.1));
  body.recomputeMassPropertiesFromColliders();
  return body;
}

function check(fixture, dt = 0.1) {
  fixture.physics.world.step();
  fixture.detector.update(dt, null);
}

function cleanup(fixture) {
  fixture.detector.dispose();
  fixture.player.dispose();
  fixture.physics.world.free();
  fixture.physics._eventQueue.free();
}

test('player detection respects forward direction, range, FOV, and hysteresis', async t => {
  const f = await fixture();
  t.after(() => cleanup(f));
  f.player.setPlayerPosition([0, 1.4, 4]);
  check(f); check(f); check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.DETECTED);
  assert.deepEqual(f.messages, ['detected']);

  f.player.setPlayerPosition([0, 1.4, -4]);
  for (let i = 0; i < 6; i++) check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.UNAWARE);

  f.player.setPlayerPosition([0, 1.4, 11]);
  for (let i = 0; i < 6; i++) check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.UNAWARE);
});

test('solid fixed and dynamic bodies occlude the player, and moving them away reveals it', async t => {
  const f = await fixture();
  t.after(() => cleanup(f));
  f.player.setPlayerPosition([0, 1.4, 4]);
  const wall = addFixedBox(f.physics);
  for (let i = 0; i < 5; i++) check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.UNAWARE);
  f.physics.world.removeRigidBody(wall);

  const dynamic = addDynamicBox(f.physics);
  for (let i = 0; i < 5; i++) check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.UNAWARE);
  dynamic.setTranslation({ x: 0, y: 1.4, z: -3 }, true);
  for (let i = 0; i < 5; i++) check(f);
  assert.equal(f.detector.detectionState, DRONE_DETECTION_STATES.DETECTED);
});

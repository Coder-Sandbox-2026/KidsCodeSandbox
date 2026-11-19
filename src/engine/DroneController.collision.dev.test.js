import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from '../api/Player.js';
import { DroneController } from './DroneController.js';

if (!globalThis.document) {
  globalThis.document = {
    pointerLockElement: null,
    activeElement: { closest: () => null },
    addEventListener() {},
    removeEventListener() {},
  };
}

function addFloor(physics) {
  const body = physics.world.createRigidBody(physics.RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(
    physics.RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0),
    body,
  );
}

function addWall(physics, x) {
  const body = physics.world.createRigidBody(physics.RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(
    physics.RAPIER.ColliderDesc.cuboid(0.1, 2, 3).setTranslation(x, 1.4, 0),
    body,
  );
}

async function makeScenario({
  wall = false,
  droneY = 9,
  playerX = 2,
  playerY = 1.4,
  playerZ = 0,
} = {}) {
  const physics = new PhysicsManager();
  await physics.init();
  addFloor(physics);
  if (wall) addWall(physics, 3.2);

  const player = new Player(new THREE.PerspectiveCamera(), physics);
  player.setPlayerPosition([playerX, playerY, playerZ]);
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'DroneA';
  root.position.set(0, 1.4, 0);
  const waypointRoot = new THREE.Group();
  const first = new THREE.Object3D();
  first.name = 'PATH_DroneA_001';
  first.position.set(0, droneY, 0);
  const second = new THREE.Object3D();
  second.name = 'PATH_DroneA_002';
  second.position.set(10, droneY, 0);
  waypointRoot.add(first, second);
  scene.add(waypointRoot, root);
  scene.updateMatrixWorld(true);

  const drone = new DroneController(root, {
    waypointRoot,
    engine: { physics, player },
    physics,
    config: {
      navigationEnabled: false,
      hoveringEnabled: false,
      hoverHeight: 1.4,
      movementSpeed: 2,
      cornerRadius: 0,
    },
  });
  drone.reset();
  return { physics, player, drone, root };
}

function sphereCapsuleSpineDistance(drone, player) {
  const sphere = drone.collisionInfo.collider.translation();
  const capsule = player.collider;
  const shape = capsule.shape;
  const centerRaw = capsule.translation();
  const center = new THREE.Vector3(centerRaw.x, centerRaw.y, centerRaw.z);
  const rotation = capsule.rotation();
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(
    new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
  );
  const start = center.clone().addScaledVector(axis, -shape.halfHeight);
  const end = center.clone().addScaledVector(axis, shape.halfHeight);
  const segment = end.sub(start);
  const t = THREE.MathUtils.clamp(
    new THREE.Vector3(sphere.x, sphere.y, sphere.z).sub(start).dot(segment) / segment.lengthSq(),
    0,
    1,
  );
  return new THREE.Vector3(sphere.x, sphere.y, sphere.z)
    .distanceTo(start.addScaledVector(segment, t));
}

function runFrames(scenario, seconds = 5) {
  const frames = Math.round(seconds * 60);
  let positiveMovementFrames = 0;
  let previousX = scenario.root.getWorldPosition(new THREE.Vector3()).x;
  for (let i = 0; i < frames; i++) {
    scenario.drone.update(1 / 60);
    scenario.physics.step(1 / 60);
    const x = scenario.root.getWorldPosition(new THREE.Vector3()).x;
    if (x > previousX + 1e-7) positiveMovementFrames += 1;
    previousX = x;
  }
  return { positiveMovementFrames };
}

function runContinuousPlayerInput(
  scenario,
  seconds = 5,
  fps = 60,
  axes = { x: -1, y: 0 },
  { jumpFrame = -1 } = {},
) {
  const dt = 1 / fps;
  let frame = -1;
  let jumpConsumed = false;
  const input = {
    getMoveAxes: () => typeof axes === 'function' ? axes(frame) : axes,
    isDown: () => false,
    consumeJump: () => {
      if (frame !== jumpFrame || jumpConsumed) return false;
      jumpConsumed = true;
      return true;
    },
  };
  let positiveMovementFrames = 0;
  let inwardContactFrames = 0;
  let previousX = scenario.root.getWorldPosition(new THREE.Vector3()).x;
  const frameCount = Math.round(seconds * fps);
  for (let i = 0; i < frameCount; i++) {
    frame = i;
    jumpConsumed = false;
    const newPlayerPosition = scenario.player.movementController.update(dt, input, 0);
    scenario.player.cameraController.applyToActor(newPlayerPosition);
    scenario.player._position.set(
      newPlayerPosition.x,
      newPlayerPosition.y,
      newPlayerPosition.z,
    );
    scenario.physics.step(dt);
    scenario.drone.update(dt);
    const movementController = scenario.player.movementController;
    if (movementController.droneContactActive
      && movementController.lastInputMovement.dot(movementController.droneContactNormal) < -1e-4
      && movementController.lastFilteredInputMovement.dot(movementController.droneContactNormal) >= -1e-4) {
      inwardContactFrames += 1;
    }
    const x = scenario.root.getWorldPosition(new THREE.Vector3()).x;
    if (x > previousX + 1e-7) positiveMovementFrames += 1;
    previousX = x;
  }
  return { positiveMovementFrames, inwardContactFrames, frameCount };
}

function cleanup({ physics, player, drone }) {
  drone.clear();
  player.dispose();
  physics.world.free();
}

test('DroneA and player maintain coordinated, non-penetrating open-floor motion', async () => {
  const scenario = await makeScenario();
  const startPlayer = scenario.player.position.clone();
  const { positiveMovementFrames } = runFrames(scenario);
  const geometry = scenario.drone.collisionInfo.collider.shape;
  const playerShape = scenario.player.collider.shape;
  const separation = sphereCapsuleSpineDistance(scenario.drone, scenario.player);
  const required = geometry.radius + playerShape.radius
    + scenario.drone._droneControllerOffset
    + scenario.player.movementController.characterControllerOffset;

  assert.ok(scenario.root.position.x > 7.5, `drone advanced only ${scenario.root.position.x}`);
  assert.ok(
    scenario.player.position.distanceTo(startPlayer) > 0.5,
    `player was not displaced by sustained contact: ${scenario.player.position.toArray()}`,
  );
  assert.ok(scenario.player.position.x < 5, 'player was carried along DroneA\'s patrol path');
  assert.ok(positiveMovementFrames > 250, 'drone repeatedly stopped while pushing');
  assert.ok(separation >= required - 1e-3, `sphere/capsule separation ${separation} < ${required}`);
  assert.equal(scenario.physics.world.intersectionPair(
    scenario.drone.collisionInfo.collider,
    scenario.player.collider,
  ), false);
  cleanup(scenario);
});

test('DroneA stops safely at a wall behind the player without moving the player through it', async () => {
  const scenario = await makeScenario({ wall: true });
  const { positiveMovementFrames } = runFrames(scenario);
  const playerX = scenario.player.position.x;
  const separation = sphereCapsuleSpineDistance(scenario.drone, scenario.player);

  assert.ok(scenario.root.position.x < 2.2, `drone advanced through the blocked route to ${scenario.root.position.x}`);
  assert.ok(playerX < 2.9, `player moved through the wall to ${playerX}`);
  assert.ok(positiveMovementFrames > 50, 'drone never made committed forward progress before the wall');
  assert.equal(scenario.physics.world.intersectionPair(
    scenario.drone.collisionInfo.collider,
    scenario.player.collider,
  ), false);
  assert.ok(separation >= 0.45 + 0.35 - 1e-3, 'drone and player geometry penetrated');
  cleanup(scenario);
});

test('Vertical separation does not trigger a false player push', async () => {
  const scenario = await makeScenario({ droneY: 3, playerY: 3 });
  const startPlayer = scenario.player.position.clone();
  runFrames(scenario, 2);
  assert.ok(scenario.player.position.distanceTo(startPlayer) < 1e-5);
  cleanup(scenario);
});

test('Continuous inward player input does not deadlock or jitter DroneA', async () => {
  for (const fps of [30, 60, 120]) {
    const scenario = await makeScenario();
    const startPlayer = scenario.player.position.clone();
    const { positiveMovementFrames, inwardContactFrames, frameCount } = runContinuousPlayerInput(scenario, 5, fps);
    const separation = sphereCapsuleSpineDistance(scenario.drone, scenario.player);
    const required = scenario.drone.collisionInfo.collider.shape.radius
      + scenario.player.collider.shape.radius
      + scenario.drone._droneControllerOffset
      + scenario.player.movementController.characterControllerOffset;

    assert.ok(scenario.root.position.x > 7.5, `${fps} FPS drone advanced only ${scenario.root.position.x}`);
    assert.ok(
      scenario.player.position.distanceTo(startPlayer) > 0.5,
      `${fps} FPS player was not displaced from contact`,
    );
    assert.ok(
      positiveMovementFrames > frameCount * 0.85,
      `${fps} FPS drone repeatedly stopped under inward input`,
    );
    assert.ok(separation >= required - 1e-3, `${fps} FPS sphere/capsule separation ${separation} < ${required}`);
    assert.ok(inwardContactFrames > 10, `${fps} FPS inward input was not filtered during contact`);
    cleanup(scenario);
  }
});

test('Player running, moving diagonally, escaping, and jumping cannot cancel DroneA', async () => {
  const running = await makeScenario();
  running.player.setWalkSpeed(6);
  const runningResult = runContinuousPlayerInput(running, 5, 60);
  assert.ok(running.root.position.x > 7.5, `running player stopped DroneA at ${running.root.position.x}`);
  assert.ok(runningResult.positiveMovementFrames > 250, 'running input caused repeated DroneA stops');
  cleanup(running);

  const diagonal = await makeScenario();
  runContinuousPlayerInput(diagonal, 5, 60, { x: -1, y: 1 });
  assert.ok(diagonal.root.position.x > 7, 'diagonal input stopped DroneA');
  assert.ok(diagonal.player.position.z < -0.5, 'diagonal tangential movement was removed');
  cleanup(diagonal);

  const escape = await makeScenario();
  runContinuousPlayerInput(
    escape,
    5,
    60,
    frame => frame < 90 ? { x: -1, y: 0 } : { x: 0, y: 1 },
  );
  assert.ok(escape.root.position.x > 7, 'sideways escape caused DroneA to stop');
  assert.ok(escape.player.position.z < -0.5, 'sideways escape was not preserved');
  assert.equal(escape.player.movementController.droneContactActive, false);
  cleanup(escape);

  const jumping = await makeScenario();
  const jumpResult = runContinuousPlayerInput(jumping, 5, 60, { x: -1, y: 0 }, { jumpFrame: 90 });
  assert.ok(jumping.root.position.x > 7, 'jumping input stopped DroneA');
  assert.ok(jumpResult.positiveMovementFrames > 250, 'jumping input caused repeated DroneA stops');
  cleanup(jumping);
});

test('Near-side contact does not unnecessarily reduce DroneA patrol speed', async () => {
  const scenario = await makeScenario({ playerX: 0.4, playerZ: 0.75 });
  const { positiveMovementFrames } = runFrames(scenario, 5);
  assert.ok(scenario.root.position.x > 8.8, `side contact reduced DroneA movement to ${scenario.root.position.x}`);
  assert.ok(positiveMovementFrames > 280, 'side contact caused unexpected stopped frames');
  cleanup(scenario);
});

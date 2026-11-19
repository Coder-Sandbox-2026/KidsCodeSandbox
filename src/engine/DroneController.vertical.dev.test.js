import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from '../api/Player.js';
import { DroneController, DRONE_VERTICAL_STATES } from './DroneController.js';

if (!globalThis.document) {
  globalThis.document = {
    pointerLockElement: null,
    activeElement: { closest: () => null },
    addEventListener() {},
    removeEventListener() {},
  };
}

function addBox(physics, { x = 0, y = 0, z = 0, hx = 20, hy = 0.1, hz = 20, rotation = null } = {}) {
  const body = physics.world.createRigidBody(
    physics.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation(rotation ?? { x: 0, y: 0, z: 0, w: 1 }),
  );
  physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
  return body;
}

function addDroneStage(physics, {
  floor = true,
  rootY = 1.1,
  waypointY = 50,
  hoverHeight = 1.1,
  hoveringEnabled = false,
  movementEnabled = true,
} = {}) {
  if (floor) addBox(physics);
  const player = new Player(new THREE.PerspectiveCamera(), physics);
  player.setPlayerPosition([100, 1.4, 100]);
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'DroneA';
  root.position.set(0, rootY, 0);
  const waypointRoot = new THREE.Group();
  const first = new THREE.Object3D();
  first.name = 'PATH_DroneA_001';
  first.position.set(0, waypointY, 0);
  const second = new THREE.Object3D();
  second.name = 'PATH_DroneA_002';
  second.position.set(8, waypointY, 0);
  waypointRoot.add(first, second);
  scene.add(waypointRoot, root);
  scene.updateMatrixWorld(true);
  const drone = new DroneController(root, {
    waypointRoot,
    engine: { physics, player },
    physics,
    config: {
      navigationEnabled: false,
      hoverHeight,
      hoveringEnabled,
      movementEnabled,
      movementSpeed: 2,
      cornerRadius: 0,
    },
  });
  drone.reset();
  return { physics, player, drone, root };
}

function step(scenario, frames, dt = 1 / 60) {
  for (let i = 0; i < frames; i++) {
    // Level 16 updates DroneA after the physics step. This also ensures the
    // Rapier broad phase is ready for the ground cast on the first frame.
    scenario.physics.step(dt);
    scenario.drone.update(dt);
  }
}

function cleanup(scenario) {
  scenario.drone.clear();
  scenario.player.dispose();
  scenario.physics.world.free();
}

test('ground-relative hover ignores incorrect waypoint elevation', async () => {
  const physics = new PhysicsManager();
  await physics.init();
  const scenario = addDroneStage(physics, { waypointY: 50 });
  step(scenario, 120);

  assert.equal(scenario.drone.verticalState, DRONE_VERTICAL_STATES.GROUNDED);
  assert.ok(Math.abs(scenario.drone.virtualFeetWorld.y - 0.1) < 0.01,
    `feet=${scenario.drone.virtualFeetWorld.y}`);
  assert.ok(Math.abs(scenario.root.position.y - 1.2) < 0.02, `root=${scenario.root.position.y}`);
  cleanup(scenario);
});

test('stationary DroneA keeps its feet planted while bobbing visually', async () => {
  const physics = new PhysicsManager();
  await physics.init();
  const scenario = addDroneStage(physics, { waypointY: -40, hoveringEnabled: true, movementEnabled: false });
  let minimumRoot = Infinity;
  let maximumRoot = -Infinity;
  step(scenario, 120);
  for (let i = 0; i < 120; i++) {
    scenario.physics.step(1 / 60);
    scenario.drone.update(1 / 60);
    minimumRoot = Math.min(minimumRoot, scenario.root.position.y);
    maximumRoot = Math.max(maximumRoot, scenario.root.position.y);
  }
  assert.ok(maximumRoot - minimumRoot > 0.06, `bobbing range=${maximumRoot - minimumRoot}`);
  assert.ok(Math.abs(scenario.drone.virtualFeetWorld.y - 0.1) < 0.02);
  cleanup(scenario);
});

test('DroneA follows a walkable slope while remaining upright', async () => {
  const physics = new PhysicsManager();
  await physics.init();
  const angle = Math.atan(0.2);
  addBox(physics, {
    x: 4,
    y: 0.9,
    hx: 5,
    hy: 0.1,
    hz: 3,
    rotation: { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) },
  });
  const scenario = addDroneStage(physics, { floor: false, rootY: 2.1, waypointY: 30, hoverHeight: 1.1 });
  const startY = scenario.drone.virtualFeetWorld.y;
  step(scenario, 180);

  assert.equal(scenario.drone.verticalState, DRONE_VERTICAL_STATES.GROUNDED);
  assert.ok(scenario.drone.virtualFeetWorld.y > startY + 0.3,
    `start=${startY} end=${scenario.drone.virtualFeetWorld.y} state=${scenario.drone.verticalState}`);
  assert.ok(Math.abs(scenario.root.rotation.x) < 1e-6);
  assert.ok(Math.abs(scenario.root.rotation.z) < 1e-6);
  cleanup(scenario);
});

test('DroneA falls from a ledge and lands without tunneling', async () => {
  const physics = new PhysicsManager();
  await physics.init();
  addBox(physics, { x: -0.5, hx: 1.5 });
  addBox(physics, { x: 4, y: -1.1, hx: 4.5 });
  const scenario = addDroneStage(physics, { floor: false, waypointY: 20 });
  let sawFalling = false;
  let sawLanding = false;
  let minimumFeet = Infinity;
  for (let i = 0; i < 240; i++) {
    scenario.physics.step(1 / 60);
    scenario.drone.update(1 / 60);
    sawFalling ||= scenario.drone.verticalState === DRONE_VERTICAL_STATES.FALLING;
    sawLanding ||= scenario.drone.verticalState === DRONE_VERTICAL_STATES.LANDING;
    minimumFeet = Math.min(minimumFeet, scenario.drone.virtualFeetWorld.y);
  }

  assert.equal(sawFalling, true);
  assert.equal(sawLanding, true);
  assert.ok(minimumFeet > -1.3, `virtual feet tunneled to ${minimumFeet}`);
  cleanup(scenario);
});

test('oversized steps do not become vertical wall climbs', async () => {
  const physics = new PhysicsManager();
  await physics.init();
  addBox(physics, { x: 1.5, y: 0.75, hx: 0.15, hy: 0.75, hz: 2 });
  const scenario = addDroneStage(physics, { waypointY: 20 });
  step(scenario, 180);

  assert.ok(scenario.root.position.x < 1.4, `DroneA climbed through the wall to ${scenario.root.position.x}`);
  cleanup(scenario);
});

test('ground following remains stable at 30, 60, and 120 FPS', async () => {
  for (const fps of [30, 60, 120]) {
    const physics = new PhysicsManager();
    await physics.init();
    const scenario = addDroneStage(physics, { waypointY: 80 });
    const dt = 1 / fps;
    step(scenario, fps, dt);
    assert.ok(Math.abs(scenario.root.position.x - 2) < 0.08, `fps=${fps} x=${scenario.root.position.x}`);
    assert.ok(Math.abs(scenario.drone.virtualFeetWorld.y - 0.1) < 0.02,
      `fps=${fps} feet=${scenario.drone.virtualFeetWorld.y}`);
    cleanup(scenario);
  }
});

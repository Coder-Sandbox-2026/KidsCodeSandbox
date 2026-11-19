import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from '../api/Player.js';
import { DroneController, DRONE_STATES } from './DroneController.js';

if (!globalThis.document) {
  globalThis.document = { pointerLockElement: null, addEventListener() {}, removeEventListener() {} };
}

test('numbered DroneA placeholders and waypoint paths stay independently associated', async t => {
  const physics = new PhysicsManager();
  await physics.init();
  const player = new Player(new THREE.PerspectiveCamera(), physics);
  player.setPlayerPosition([100, 1.4, 100]);
  const scene = new THREE.Scene();
  const waypointRoot = new THREE.Group();
  const makeWaypoint = (name, x, z) => {
    const marker = new THREE.Object3D();
    marker.name = name;
    marker.position.set(x, 1.4, z);
    waypointRoot.add(marker);
  };
  makeWaypoint('PATH_DroneA01_002', -3, 0);
  makeWaypoint('PATH_DroneA01_001', -5, 0);
  makeWaypoint('PATH_DroneA02_002', 5, 0);
  makeWaypoint('PATH_DroneA02_001', 3, 0);
  const roots = [
    new THREE.Group(),
    new THREE.Group(),
  ];
  roots[0].position.set(-5, 1.4, 0);
  roots[1].position.set(3, 1.4, 0);
  scene.add(waypointRoot, ...roots);
  scene.updateMatrixWorld(true);

  const drones = roots.map((root, index) => new DroneController(root, {
    waypointRoot,
    droneId: `DroneA0${index + 1}`,
    engine: { physics, player },
    physics,
    config: {
      navigationEnabled: false,
      movementEnabled: false,
      hoveringEnabled: false,
      collisionDebug: false,
    },
  }));
  t.after(() => {
    for (const drone of drones) drone.clear();
    player.dispose();
    physics.world.free();
    physics._eventQueue.free();
  });

  assert.deepEqual(drones.map(drone => drone.droneId), ['DroneA01', 'DroneA02']);
  assert.deepEqual(drones[0].waypoints.map(item => item.name), [
    'PATH_DroneA01_001',
    'PATH_DroneA01_002',
  ]);
  assert.deepEqual(drones[1].waypoints.map(item => item.name), [
    'PATH_DroneA02_001',
    'PATH_DroneA02_002',
  ]);
  assert.notEqual(drones[0].detection, drones[1].detection);
  assert.notEqual(drones[0].collisionInfo.id, drones[1].collisionInfo.id);

});

test('unreachable recovery enters stranded scanning and can escape when a route appears', async t => {
  const physics = new PhysicsManager();
  await physics.init();
  const scene = new THREE.Scene();
  const waypointRoot = new THREE.Group();
  const first = new THREE.Object3D(); first.name = 'PATH_DroneA_001'; first.position.set(-5, 0, 0);
  const second = new THREE.Object3D(); second.name = 'PATH_DroneA_002'; second.position.set(5, 0, 0);
  waypointRoot.add(first, second);
  const root = new THREE.Group(); root.position.set(0, 1.4, 0);
  scene.add(waypointRoot, root);
  scene.updateMatrixWorld(true);

  let routeAvailable = false;
  const navigation = {
    findPath(start, target) { return routeAvailable ? [start.clone(), target.clone()] : null; },
    isRouteNavigable: () => routeAvailable,
    isPositionNavigable: () => routeAvailable,
  };
  const drone = new DroneController(root, {
    waypointRoot,
    navigationManager: navigation,
    engine: { physics },
    physics,
    config: {
      strandedRetryInterval: 0.5,
      strandedRotationSpeed: 0.5,
      recoveryStuckTimeout: 0.1,
      recoveryMinimumProgress: 0.1,
      movementEnabled: false,
      hoveringEnabled: false,
      playerDetectionEnabled: false,
      collisionDebug: false,
    },
  });
  t.after(() => {
    drone.clear();
    physics.world.free();
    physics._eventQueue.free();
  });

  assert.equal(drone.state, DRONE_STATES.STRANDED);
  const beforeRotation = root.quaternion.clone();
  const beforePosition = root.position.clone();
  drone.update(1);
  assert.equal(drone.state, DRONE_STATES.STRANDED);
  assert.ok(beforeRotation.angleTo(root.quaternion) > 0.1, 'stranded drone did not scan by rotating');
  assert.ok(Math.hypot(root.position.x - beforePosition.x, root.position.z - beforePosition.z) < 1e-5,
    'stranded drone moved horizontally');

  drone.engine.player = { position: new THREE.Vector3(5, 1.4, 0) };
  drone.detection = { detectionState: 'DETECTED', update() {}, dispose() {} };
  drone.update(0.1);
  const trackedForward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
  assert.ok(trackedForward.x > 0.05, 'stranded drone did not track the detected player');

  routeAvailable = true;
  drone.update(0.5);
  assert.equal(drone.state, DRONE_STATES.RECOVER);

  routeAvailable = false;
  drone._applyPosition = () => 0;
  drone.update(0.11);
  drone.update(0.11);
  assert.equal(drone.state, DRONE_STATES.STRANDED);
});

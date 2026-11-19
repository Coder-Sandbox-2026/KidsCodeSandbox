import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from '../api/Player.js';
import { DroneController, DRONE_VERTICAL_STATES } from './DroneController.js';

if (!globalThis.document) {
  globalThis.document = { pointerLockElement: null, addEventListener() {}, removeEventListener() {} };
}

async function scenario({ navigationManager = null, navigationEnabled = false } = {}) {
  const physics = new PhysicsManager();
  await physics.init();
  const floor = physics.world.createRigidBody(physics.RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(physics.RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0), floor);
  const player = new Player(new THREE.PerspectiveCamera(), physics);
  player.setPlayerPosition([100, 1.4, 100]);
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.position.set(0, 1.4, 0);
  const waypoints = new THREE.Group();
  const first = new THREE.Object3D(); first.name = 'PATH_DroneA_001';
  const second = new THREE.Object3D(); second.name = 'PATH_DroneA_002'; second.position.set(10, 1.4, 0);
  waypoints.add(first, second); scene.add(waypoints, root); scene.updateMatrixWorld(true);
  const drone = new DroneController(root, {
    waypointRoot: waypoints,
    engine: { physics, player },
    physics,
    navigationManager,
    config: {
      navigationEnabled,
      hoveringEnabled: false,
      movementEnabled: false,
      collisionDebug: false,
      playerDetectionEnabled: true,
      injuredRestitution: 0,
      injuredLinearDamping: 2,
      injuredAngularDamping: 2,
      injuredMinimumDuration: 0.1,
      injuredSettleDuration: 0.1,
      injuredRestoreDelay: 0.05,
      injuredRestoreDuration: 0.2,
    },
  });
  drone.reset();
  return { physics, player, drone };
}

function cleanup(s) {
  s.drone.clear();
  s.player.dispose();
  s.physics.world.free();
  s.physics._eventQueue.free();
}

test('injured DroneA reuses one body, launches dynamically, tumbles, and can restore', async t => {
  const s = await scenario();
  t.after(() => cleanup(s));
  const id = s.drone.collisionInfo.id;
  const beforeBodies = s.physics.world.bodies.len();
  assert.equal(s.drone.triggerInjuredFall({
    linearImpulse: { x: 0, y: 250, z: 10 },
    angularImpulse: { x: 40, y: 20, z: 10 },
  }), true);
  assert.equal(s.drone.verticalState, DRONE_VERTICAL_STATES.INJURED);
  assert.equal(s.drone.collisionInfo.body.isDynamic(), true);
  assert.equal(s.physics.world.bodies.len(), beforeBodies);
  assert.equal(s.physics.bodies.has(id), true);
  assert.equal(s.physics.kinematics.has(id), false);

  let maxY = -Infinity;
  let rotated = false;
  for (let i = 0; i < 360; i++) {
    s.physics.step(1 / 60);
    s.drone.update(1 / 60);
    maxY = Math.max(maxY, s.drone.collisionInfo.body.translation().y);
    const r = s.drone.collisionInfo.body.rotation();
    rotated ||= Math.abs(r.x) > 0.05 || Math.abs(r.z) > 0.05;
  }
  assert.ok(Math.abs(s.drone.collisionInfo.body.mass() - 25) < 0.05);
  assert.ok(maxY > 2, `launch did not produce upward motion: ${maxY}`);
  assert.equal(rotated, true);
  assert.equal(s.drone.verticalState, DRONE_VERTICAL_STATES.GROUNDED);
});

test('injury recovery anchors navigation to the restored world position without a jump', async t => {
  const recoveryStarts = [];
  const navigation = {
    findPath(start, target) {
      recoveryStarts.push({ start: start.clone(), target: target.clone() });
      return [start.clone(), target.clone()];
    },
    isRouteNavigable: () => true,
    isPositionNavigable: () => true,
  };
  const s = await scenario({ navigationManager: navigation, navigationEnabled: true });
  t.after(() => cleanup(s));

  assert.equal(s.drone.triggerInjuredFall({
    linearImpulse: { x: 0, y: 250, z: 10 },
    angularImpulse: { x: 40, y: 20, z: 10 },
  }), true);

  let previous = s.drone.root.getWorldPosition(new THREE.Vector3());
  let wasDynamic = s.drone.collisionInfo.body.isDynamic();
  let restorationStarted = false;
  let recoveryStarted = false;
  let maxPostInjuryStep = 0;
  let restoredPosition = null;
  let recoveryAnchor = null;

  for (let i = 0; i < 480; i++) {
    s.physics.step(1 / 60);
    s.drone.update(1 / 60);
    const current = s.drone.root.getWorldPosition(new THREE.Vector3());
    const bodyIsDynamic = s.drone.collisionInfo.body.isDynamic();
    if (restorationStarted) maxPostInjuryStep = Math.max(maxPostInjuryStep, current.distanceTo(previous));
    if (s.drone.verticalState === DRONE_VERTICAL_STATES.RESTORING) restorationStarted = true;
    if (recoveryStarted === false
      && (s.drone.state === 'LOCAL_RECOVER' || s.drone.state === 'RECOVER')) {
      recoveryStarted = true;
      restoredPosition = previous.clone();
      recoveryAnchor = s.drone._injuryRecoveryAnchor.clone();
    }
    if (wasDynamic && !bodyIsDynamic) {
      assert.ok(current.distanceTo(previous) < 0.12, `dynamic-to-kinematic jump=${current.distanceTo(previous)}`);
    }
    wasDynamic = bodyIsDynamic;
    previous.copy(current);
  }

  assert.equal(restorationStarted, true);
  assert.equal(recoveryStarted, true);
  assert.ok(recoveryAnchor.distanceTo(restoredPosition) < 0.12,
    `recovery anchor jumped by ${recoveryAnchor.distanceTo(restoredPosition)}`);
  assert.ok(maxPostInjuryStep < 0.2, `post-injury position jump=${maxPostInjuryStep}`);
  assert.equal(s.drone.detection?.detectionState, 'UNAWARE');
  assert.ok(recoveryStarts.length >= 1);
});

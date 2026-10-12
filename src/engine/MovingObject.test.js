import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MovingObject } from './MovingObject.js';
import { PhysicsManager } from './PhysicsManager.js';

async function physicsFixture() {
  const physics = new PhysicsManager();
  await physics.init();
  return physics;
}

function colliderPart({ y = 1.9, z = 0 } = {}) {
  return {
    name: 'MOVCOL_TestDoor',
    shape: 'cuboid',
    hx: 3,
    hy: 2,
    hz: 0.25,
    tx: 0,
    ty: y,
    tz: z,
    rotation: [0, 0, 0, 1],
  };
}

function createMovingObject(physics, part = colliderPart(), travel = new THREE.Vector3(0, -4, 0)) {
  const object = new THREE.Group();
  object.position.set(part.tx, part.ty, part.tz);
  return new MovingObject({ physics, object, colliderPart: part, travel });
}

test('MOVCOL uses one fixed non-sensor cuboid and synchronizes animation poses', async () => {
  const physics = await physicsFixture();
  try {
    const moving = createMovingObject(physics);
    assert.equal(moving.body.isFixed(), true);
    assert.equal(moving.collider.isSensor(), false);
    assert.equal(physics.world.colliders.len(), 1);
    assert.equal(physics.movingSolids.size, 1);

    assert.equal(moving.setOpen(true), true);
    moving.update(0.75);
    assert.ok(Math.abs(moving.body.translation().y - (-0.1)) < 1e-5);
    assert.ok(Math.abs(moving.object.position.y - (-0.1)) < 1e-5);

    moving.update(0.75);
    assert.ok(Math.abs(moving.body.translation().y - (-2.1)) < 1e-5);
    assert.ok(Math.abs(moving.object.position.y - (-2.1)) < 1e-5);
    assert.equal(moving.setOpen(false, () => false), false);
    assert.equal(moving.value, 1);
    assert.equal(moving.setOpen(false, () => true), true);
    moving.update(1.5);
    assert.ok(Math.abs(moving.body.translation().y - 1.9) < 1e-5);
    assert.ok(Math.abs(moving.object.position.y - 1.9) < 1e-5);
    moving.dispose();
    assert.equal(physics.movingSolids.size, 0);
    assert.equal(physics.world.colliders.len(), 0);
  } finally {
    physics.world.free();
  }
});

test('a fixed MOVCOL cuboid preserves tangential character movement', async () => {
  const physics = await physicsFixture();
  try {
    const moving = createMovingObject(physics, colliderPart());
    const RAPIER = physics.RAPIER;
    let position = { x: -4, y: 1.9, z: -8 };
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x, position.y, position.z
      )
    );
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.35), body
    );
    const controller = physics.createCharacterController(0.05);
    controller.setSlideEnabled(true);
    physics.world.step();

    let firstContactX = null;
    for (let frame = 0; frame < 100; frame++) {
      const requested = { x: 0.035, y: 0, z: 0.1113 };
      controller.computeColliderMovement(collider, requested);
      const corrected = controller.computedMovement();
      const contactsDoor = Array.from({ length: controller.numComputedCollisions() })
        .some((_, index) => controller.computedCollision(index).collider.handle === moving.collider.handle);
      if (contactsDoor && firstContactX === null) firstContactX = position.x;

      position = {
        x: position.x + corrected.x,
        y: position.y + corrected.y,
        z: position.z + corrected.z,
      };
      body.setNextKinematicTranslation(position);
      body.setTranslation(position, true);
      physics.world.step();
    }

    assert.notEqual(firstContactX, null);
    assert.ok(position.x > firstContactX + 0.5,
      `expected tangential slide, contact x=${firstContactX}, final x=${position.x}`);
    moving.dispose();
  } finally {
    physics.world.free();
  }
});

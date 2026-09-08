/**
 * FirstPersonMovementController.js – WASD walk, jump, gravity, and wall slide
 * for a kinematic capsule via Rapier's KinematicCharacterController.
 *
 * Also pushes dynamic objects on contact. Does not own the actor or camera.
 */
import * as THREE from 'three';

const PUSH_ACCEL = 12;

export class FirstPersonMovementController {
  /**
   * @param {object} opts
   * @param {import('./PhysicsManager.js').PhysicsManager} opts.physics
   * @param {*} opts.body  Rapier kinematic rigid body
   * @param {*} opts.collider
   * @param {() => object} opts.getSettings
   */
  constructor({ physics, body, collider, getSettings }) {
    this.physics = physics;
    this.body = body;
    this.collider = collider;
    this.getSettings = getSettings;

    this.velocity = new THREE.Vector3();
    this.horizVelocity = new THREE.Vector3();
    this.grounded = false;
    this._jumpsUsed = 0;
    this._justJumped = false;
    this._contactHandles = new Set();
    this._newContactHandles = [];

    this.controller = physics.createCharacterController(0.05);
    this.controller.enableAutostep(0.4, 0.2, true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.35);
  }

  /**
   * @param {number} dt
   * @param {{ isDown: (code: string) => boolean, consumeJump: () => boolean }} input
   * @param {number} yaw  Camera yaw so movement is look-relative
   */
  update(dt, input, yaw) {
    const settings = this.getSettings();
    const moveAllowed = settings.movementEnabled !== false;

    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const euler = new THREE.Euler(0, yaw, 0, 'YXZ');
    forward.applyEuler(euler);
    right.applyEuler(euler);

    const wish = new THREE.Vector3();
    if (moveAllowed) {
      if (input.isDown('KeyW')) wish.add(forward);
      if (input.isDown('KeyS')) wish.sub(forward);
      if (input.isDown('KeyD')) wish.add(right);
      if (input.isDown('KeyA')) wish.sub(right);
    }
    if (wish.lengthSq() > 0) wish.normalize();

    const moveDir = wish.clone();
    const walkSpeed = settings.walkSpeed;
    const targetHoriz = wish.multiplyScalar(walkSpeed);
    if (!this.grounded) {
      targetHoriz.multiplyScalar(settings.airControl);
    }

    const hasWish = moveDir.lengthSq() > 0.0001;
    const rate = (hasWish ? settings.acceleration : settings.deceleration) * dt;
    const t = rate >= 1 ? 1 : Math.max(0, rate);
    this.horizVelocity.lerp(targetHoriz, t);

    const move = this.horizVelocity.clone().multiplyScalar(dt);

    this.velocity.y += -settings.gravity * dt;
    if (this.velocity.y < -settings.maxFallSpeed) {
      this.velocity.y = -settings.maxFallSpeed;
    }
    move.y = this.velocity.y * dt;

    // Walk through sensors (collectibles) so they detect the player without blocking.
    const filter = this.physics.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
    this.controller.computeColliderMovement(
      this.collider,
      { x: move.x, y: move.y, z: move.z },
      filter
    );
    const corrected = this.controller.computedMovement();

    this._collectCharacterContacts();
    this._pushDynamicBodies(moveDir, dt, walkSpeed);

    const pos = this.body.translation();
    const newPos = {
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    };
    this.body.setNextKinematicTranslation(newPos);

    this.grounded = this.controller.computedGrounded();
    if (this.grounded && !this._justJumped) {
      this._jumpsUsed = 0;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    this._justJumped = false;

    if (moveAllowed && input.consumeJump()) {
      this._tryJump(settings);
    } else {
      input.consumeJump();
    }

    return newPos;
  }

  _tryJump(settings) {
    const maxJumps = Math.max(0, settings.jumpCount);
    if (this._jumpsUsed >= maxJumps) return;
    if (this._jumpsUsed === 0 && !this.grounded) return;

    this.velocity.y = settings.jumpForce;
    this.grounded = false;
    this._jumpsUsed += 1;
    this._justJumped = true;
  }

  _collectCharacterContacts() {
    const current = new Set();
    const num = this.controller.numComputedCollisions();
    for (let i = 0; i < num; i++) {
      const collision = this.controller.computedCollision(i);
      if (!collision || !collision.collider) continue;
      current.add(collision.collider.handle);
    }

    this._newContactHandles = [];
    for (const handle of current) {
      if (!this._contactHandles.has(handle)) {
        this._newContactHandles.push(handle);
      }
    }
    this._contactHandles = current;
  }

  consumeNewContactHandles() {
    const handles = this._newContactHandles;
    this._newContactHandles = [];
    return handles;
  }

  _pushDynamicBodies(moveDir, dt, walkSpeed) {
    const walking = moveDir.lengthSq() > 0.01;
    const numCollisions = this.controller.numComputedCollisions();

    for (let i = 0; i < numCollisions; i++) {
      const collision = this.controller.computedCollision(i);
      if (!collision || !collision.collider) continue;

      const hitBody = collision.collider.parent();
      if (!hitBody || !hitBody.isDynamic()) continue;

      const n = collision.normal1;
      if (!n) continue;

      if (Math.abs(n.y) > 0.55) {
        const v = hitBody.linvel();
        if (v.y > 0.2) {
          hitBody.setLinvel({ x: v.x, y: v.y * 0.25, z: v.z }, true);
        }
        continue;
      }

      if (!walking) continue;

      let px = -n.x;
      let pz = -n.z;
      const plen = Math.hypot(px, pz);
      if (plen < 0.15) continue;
      px /= plen;
      pz /= plen;

      const into = moveDir.x * px + moveDir.z * pz;
      if (into <= 0.05) continue;

      const objVel = hitBody.linvel();
      const objAlong = objVel.x * px + objVel.z * pz;
      const targetAlong = walkSpeed * into;
      const deltaV = targetAlong - objAlong;
      if (deltaV <= 0) continue;

      const mass = Math.max(hitBody.mass(), 0.2);
      const impulse = mass * deltaV * Math.min(1, PUSH_ACCEL * dt);

      hitBody.applyImpulse({ x: px * impulse, y: 0, z: pz * impulse }, true);

      const after = hitBody.linvel();
      if (after.y > 0.15) {
        hitBody.setLinvel({ x: after.x, y: Math.min(after.y, 0.15), z: after.z }, true);
      }
    }
  }

  reset(spawn) {
    this.body.setNextKinematicTranslation(spawn);
    this.velocity.set(0, 0, 0);
    this.horizVelocity.set(0, 0, 0);
    this.grounded = false;
    this._jumpsUsed = 0;
    this._justJumped = false;
    this._contactHandles.clear();
    this._newContactHandles = [];
  }
}

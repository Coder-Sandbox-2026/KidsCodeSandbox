/**
 * PlayerController.js – First-person player with Rapier capsule collider,
 * WASD movement, mouse look (pointer lock), jumping, and wall sliding
 * using Rapier's KinematicCharacterController.
 *
 * Also pushes dynamic objects on contact by applying impulses based on
 * the character controller's computed collisions.
 */
import * as THREE from 'three';

const MOVE_SPEED = 7;
const JUMP_IMPULSE = 7;
const GRAVITY = -25;
const MOUSE_SENSITIVITY = 0.002;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.35;
const CAPSULE_HALF_HEIGHT = PLAYER_HEIGHT / 2 - PLAYER_RADIUS;
/** How quickly a pushed object is brought up to the player's walk speed (1/s). */
const PUSH_ACCEL = 12;

export class PlayerController {
  constructor(camera, physics, viewportPane) {
    this.camera = camera;
    this.physics = physics;
    // viewportPane is the #viewport-pane div that wraps the canvas
    this.viewportPane = viewportPane;

    // Euler for look
    this.yaw = 0;
    this.pitch = 0;

    // Velocity
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.keys = {};
    this.enabled = true;

    // Rapier character controller (slide-enabled)
    this.controller = physics.createCharacterController(0.05);
    this.controller.enableAutostep(0.4, 0.2, true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.35);

    // Capsule rigid body (kinematic position-based)
    const RAPIER = physics.RAPIER;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, PLAYER_HEIGHT / 2 + 0.5, 5);
    this.body = physics.world.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER_RADIUS)
      .setMass(70)
      .setFriction(0.8);
    this.collider = physics.world.createCollider(colDesc, this.body);

    // --- Input listeners ---
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this._tryJump();
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };

    this._onMouse = (e) => {
      if (!this.enabled || !document.pointerLockElement) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    };

    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement && e.button === 0) {
        this._tryJump();
      }
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('mousedown', this._onMouseDown);
  }

  _tryJump() {
    if (this.grounded) {
      this.velocity.y = JUMP_IMPULSE;
      this.grounded = false;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.keys = {};
  }

  /** Call every frame with delta time */
  update(dt) {
    if (!this.enabled) return;
    // Build desired movement direction (relative to camera yaw)
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const euler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
    forward.applyEuler(euler);
    right.applyEuler(euler);

    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(forward);
    if (this.keys['KeyS']) move.sub(forward);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    // Store horizontal movement direction for pushing
    const moveDir = move.clone();

    move.multiplyScalar(MOVE_SPEED * dt);

    // Apply gravity
    this.velocity.y += GRAVITY * dt;
    move.y = this.velocity.y * dt;

    // Use Rapier character controller for sliding collision
    this.controller.computeColliderMovement(this.collider, { x: move.x, y: move.y, z: move.z });
    const corrected = this.controller.computedMovement();

    // Push dynamic objects that the character controller collided with
    this._pushDynamicBodies(moveDir, dt);

    // Apply movement
    const pos = this.body.translation();
    const newPos = {
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    };
    this.body.setNextKinematicTranslation(newPos);

    // Ground check
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocity.y < 0) {
      this.velocity.y = 0;
    }

    // Update camera
    this.camera.position.set(newPos.x, newPos.y + CAPSULE_HALF_HEIGHT + PLAYER_RADIUS - 0.1, newPos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /**
   * Push dynamic bodies with a force that matches how hard the player is walking into them.
   * No extra upward kick — standing on or bumping an object should not launch it.
   */
  _pushDynamicBodies(moveDir, dt) {
    const walking = moveDir.lengthSq() > 0.01;
    const numCollisions = this.controller.numComputedCollisions();

    for (let i = 0; i < numCollisions; i++) {
      const collision = this.controller.computedCollision(i);
      if (!collision || !collision.collider) continue;

      const hitBody = collision.collider.parent();
      if (!hitBody || !hitBody.isDynamic()) continue;

      const n = collision.normal1;
      if (!n) continue;

      // Mostly vertical contact (standing on / under an object): don't shove it.
      if (Math.abs(n.y) > 0.55) {
        const v = hitBody.linvel();
        if (v.y > 0.2) {
          hitBody.setLinvel({ x: v.x, y: v.y * 0.25, z: v.z }, true);
        }
        continue;
      }

      if (!walking) continue;

      // normal1 is outward from the object, so -normal is the push direction.
      let px = -n.x;
      let pz = -n.z;
      const plen = Math.hypot(px, pz);
      if (plen < 0.15) continue;
      px /= plen;
      pz /= plen;

      // Only push if the player is actually walking into this face.
      const into = moveDir.x * px + moveDir.z * pz;
      if (into <= 0.05) continue;

      const objVel = hitBody.linvel();
      const objAlong = objVel.x * px + objVel.z * pz;
      const targetAlong = MOVE_SPEED * into;
      const deltaV = targetAlong - objAlong;
      if (deltaV <= 0) continue;

      const mass = Math.max(hitBody.mass(), 0.2);
      const impulse = mass * deltaV * Math.min(1, PUSH_ACCEL * dt);

      hitBody.applyImpulse({ x: px * impulse, y: 0, z: pz * impulse }, true);

      // Kill leftover pop-up from the physics solver.
      const after = hitBody.linvel();
      if (after.y > 0.15) {
        hitBody.setLinvel({ x: after.x, y: Math.min(after.y, 0.15), z: after.z }, true);
      }
    }
  }

  /** Reset player to spawn position */
  resetPosition() {
    this.body.setNextKinematicTranslation({ x: 0, y: PLAYER_HEIGHT / 2 + 0.5, z: 5 });
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('mousedown', this._onMouseDown);
  }
}

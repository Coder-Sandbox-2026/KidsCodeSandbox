/**
 * Player.js – First-class gameplay actor for the active player.
 *
 * Kids talk to this object. Movement and camera are swappable controllers.
 */
import * as THREE from 'three';
import { Actor, ACTOR_KIND } from '../engine/Actor.js';
import { InputSystem } from '../engine/InputSystem.js';
import { FirstPersonMovementController } from '../engine/FirstPersonMovementController.js';
import { FirstPersonCameraController } from '../engine/FirstPersonCameraController.js';
import {
  applyPlayerSettings,
  createPlayerSettings,
  validatePlayerSetting,
} from '../engine/playerSettings.js';

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.35;
export const CAPSULE_HALF_HEIGHT = PLAYER_HEIGHT / 2 - PLAYER_RADIUS;
const SPAWN = { x: 0, y: PLAYER_HEIGHT / 2 + 0.5, z: 5 };
const EYE_HEIGHT = CAPSULE_HALF_HEIGHT + PLAYER_RADIUS - 0.1;

export class Player extends Actor {
  constructor(camera, physics) {
    super({ kind: ACTOR_KIND.PLAYER });
    this.engine = null;
    this.physics = physics;
    this._name = 'player';
    this._settings = createPlayerSettings();
    this._position = new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z);

    const RAPIER = physics.RAPIER;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(SPAWN.x, SPAWN.y, SPAWN.z);
    this.body = physics.world.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, PLAYER_RADIUS)
      .setMass(70)
      .setFriction(0.8);
    this.collider = physics.world.createCollider(colDesc, this.body);
    this.collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
    physics.registerActorCollider(this.collider, this);

    this.input = new InputSystem();
    this.movementController = new FirstPersonMovementController({
      physics,
      body: this.body,
      collider: this.collider,
      getSettings: () => this._settings,
    });
    this.cameraController = new FirstPersonCameraController(camera, {
      eyeHeight: EYE_HEIGHT,
    });
    this._overlapHandles = new Set();
  }

  get name() { return this._name; }
  set name(v) { this._name = String(v); }

  /** Live position of the player's physics body (for distance() and game logic). */
  get position() {
    const t = this.body.translation();
    this._position.set(t.x, t.y, t.z);
    return this._position;
  }

  isGrounded() {
    return !!this.movementController.grounded;
  }

  setWalkSpeed(speed) {
    this._settings.walkSpeed = validatePlayerSetting('walkSpeed', speed);
    return this;
  }
  getWalkSpeed() { return this._settings.walkSpeed; }

  setJumpForce(force) {
    this._settings.jumpForce = validatePlayerSetting('jumpForce', force);
    return this;
  }
  getJumpForce() { return this._settings.jumpForce; }

  setGravity(gravity) {
    this._settings.gravity = validatePlayerSetting('gravity', gravity);
    return this;
  }
  getGravity() { return this._settings.gravity; }

  setAirControl(value) {
    this._settings.airControl = validatePlayerSetting('airControl', value);
    return this;
  }
  getAirControl() { return this._settings.airControl; }

  setMaxFallSpeed(speed) {
    this._settings.maxFallSpeed = validatePlayerSetting('maxFallSpeed', speed);
    return this;
  }
  getMaxFallSpeed() { return this._settings.maxFallSpeed; }

  setAcceleration(value) {
    this._settings.acceleration = validatePlayerSetting('acceleration', value);
    return this;
  }
  getAcceleration() { return this._settings.acceleration; }

  setDeceleration(value) {
    this._settings.deceleration = validatePlayerSetting('deceleration', value);
    return this;
  }
  getDeceleration() { return this._settings.deceleration; }

  setJumpCount(count) {
    this._settings.jumpCount = validatePlayerSetting('jumpCount', count);
    return this;
  }
  getJumpCount() { return this._settings.jumpCount; }

  setMovementEnabled(enabled) {
    this._settings.movementEnabled = validatePlayerSetting('movementEnabled', enabled);
    return this;
  }
  getMovementEnabled() { return this._settings.movementEnabled; }

  setSettings(settings) {
    this._settings = applyPlayerSettings(this._settings, settings);
    return this;
  }

  getSettings() {
    return { ...this._settings };
  }

  /** Engine pause / resume — also used when the viewport is not focused. */
  setEnabled(enabled) {
    this.input.setEnabled(enabled);
  }

  update(dt) {
    if (!this.input.enabled) return;
    this.cameraController.applyLook(this.input.consumeLookDelta());
    const newPos = this.movementController.update(dt, this.input, this.cameraController.yaw);
    this.cameraController.applyToActor(newPos);
    this._position.set(newPos.x, newPos.y, newPos.z);
  }

  consumeCharacterCollisionStarts() {
    return this.movementController.consumeNewContactHandles();
  }

  /**
   * Sensor / overlap starts after the physics step (walk-through collectibles).
   * Only reports a handle the first frame it intersects the player capsule.
   * ITEM_* and enableCollision() sensors are included; COL_* solids are not.
   */
  consumeIntersectionStarts() {
    const current = new Set();
    const world = this.physics.world;

    world.intersectionPairsWith(this.collider, (other) => {
      if (other) current.add(other.handle);
    });

    // Sensors + kinematic player are easy for Rapier to miss in the contact graph.
    // A shape query still uses the physics world, not a distance hack.
    const t = this.body.translation();
    const r = this.body.rotation();
    world.intersectionsWithShape(t, r, this.collider.shape, (other) => {
      if (other && other.handle !== this.collider.handle) {
        current.add(other.handle);
      }
      return true;
    });

    for (const collider of this.physics.getSensorColliders()) {
      if (collider && world.intersectionPair(this.collider, collider)) {
        current.add(collider.handle);
      }
    }

    const started = [];
    for (const handle of current) {
      if (!this._overlapHandles.has(handle)) started.push(handle);
    }
    this._overlapHandles = current;
    return started;
  }

  getColliderHandle() {
    return this.collider?.handle;
  }

  resetPosition() {
    this.movementController.reset(SPAWN);
    this.cameraController.reset();
    this.input.keys = Object.create(null);
    this._overlapHandles.clear();
    this._position.set(SPAWN.x, SPAWN.y, SPAWN.z);
    this.cameraController.applyToActor(SPAWN);
  }

  dispose() {
    this.input.dispose();
    if (this.collider) {
      this.physics.unregisterActorCollider(this.collider);
    }
  }
}

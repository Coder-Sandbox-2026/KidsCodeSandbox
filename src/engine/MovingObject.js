import * as THREE from 'three';

const DEFAULT_DURATION = 1.5;

/**
 * A reusable scripted moving solid: visual animation plus one persistent
 * Rapier cuboid on a manually moved fixed body. Fixed MOVCOL_ bodies preserve
 * the character-controller sliding behavior of authored fixed COL_ walls.
 * This does not provide moving-platform carrying or velocity transfer.
 */
export class MovingObject {
  constructor({ physics, object, colliderPart, travel, duration = DEFAULT_DURATION }) {
    this.physics = physics;
    this.object = object;
    this.colliderPart = colliderPart;
    this.travel = travel.clone();
    this.duration = duration;
    this.value = 0;
    this.target = 0;
    this._animationStart = 0;
    this._animationElapsed = 0;
    this._animationDuration = 0;
    object.updateWorldMatrix(true, false);
    this.baseObjectWorldPosition = object.getWorldPosition(new THREE.Vector3());
    this.colliderHalfExtents = new THREE.Vector3(colliderPart.hx, colliderPart.hy, colliderPart.hz);
    this.baseColliderPosition = new THREE.Vector3(colliderPart.tx, colliderPart.ty, colliderPart.tz);
    this.baseColliderRotation = new THREE.Quaternion().fromArray(colliderPart.rotation ?? [0, 0, 0, 1]);
    this.colliderProxy = new THREE.Object3D();
    this.colliderProxy.name = colliderPart.name || 'MOVCOL_fixed';
    this.colliderProxy.userData.collisionRole = 'movcol';
    this.colliderProxy.userData.collisionSource = colliderPart.name || 'MOVCOL_';
    this.colliderProxy.position.copy(this.baseColliderPosition);
    this.colliderProxy.quaternion.copy(this.baseColliderRotation);

    const RAPIER = physics.RAPIER;
    if (colliderPart.shape && colliderPart.shape !== 'cuboid') {
      throw new Error(`[physics] Unsupported MOVCOL shape: ${colliderPart.shape}`);
    }
    const descriptor = RAPIER.ColliderDesc.cuboid(
      this.colliderHalfExtents.x, this.colliderHalfExtents.y, this.colliderHalfExtents.z
    );
    const fixed = physics.addFixedSolid(this.colliderProxy, descriptor);
    this.physicsId = fixed.id;
    this.body = fixed.body;
    this.collider = fixed.collider;
    this._applyValue();
  }

  setOpen(open, canMove = null) {
    const target = open ? 1 : 0;
    if (target === this.target && this._animationDuration === 0) return false;
    if (!open && canMove && !canMove(this)) return false;
    if (target === this.target && this._animationDuration > 0) return false;

    this._animationStart = this.value;
    this.target = target;
    this._animationElapsed = 0;
    this._animationDuration = Math.max(Math.abs(target - this._animationStart) * this.duration, 0.001);
    return true;
  }

  update(dt) {
    if (this._animationDuration === 0) return;
    this._animationElapsed = Math.min(this._animationElapsed + Math.max(dt, 0), this._animationDuration);
    const t = this._animationElapsed / this._animationDuration;
    const eased = t * t * (3 - 2 * t);
    this.value = THREE.MathUtils.lerp(this._animationStart, this.target, eased);
    this._applyValue();
    if (t >= 1) {
      this.value = this.target;
      this._animationDuration = 0;
      this._applyValue();
    }
  }

  containsPlayerAtClosedPosition(player, marginX = 0.35, marginY = 0.9, marginZ = 0.35) {
    const position = player.position;
    const local = new THREE.Vector3(position.x, position.y, position.z)
      .sub(this.baseColliderPosition)
      .applyQuaternion(this.baseColliderRotation.clone().invert());
    return Math.abs(local.x) <= this.colliderHalfExtents.x + marginX
      && Math.abs(local.y) <= this.colliderHalfExtents.y + marginY
      && Math.abs(local.z) <= this.colliderHalfExtents.z + marginZ;
  }

  _applyValue() {
    const objectWorldPosition = this.baseObjectWorldPosition.clone()
      .addScaledVector(this.travel, this.value);
    if (this.object.parent) {
      this.object.parent.updateWorldMatrix(true, false);
      this.object.position.copy(this.object.parent.worldToLocal(objectWorldPosition));
    } else {
      this.object.position.copy(objectWorldPosition);
    }
    this.colliderProxy.position.copy(this.baseColliderPosition).addScaledVector(this.travel, this.value);
    this.physics.syncFixedTransform?.(this.physicsId);
  }

  dispose() {
    this.physics.removeFixedSolid?.(this.physicsId);
    this.colliderProxy = null;
  }
}

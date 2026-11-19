import * as THREE from 'three';

export const DRONE_DETECTION_STATES = Object.freeze({
  UNAWARE: 'UNAWARE',
  DETECTED: 'DETECTED',
});

const DEFAULT_EYE_OFFSET = Object.freeze([0, 0.35, 0.55]);
const SAMPLE_COUNT = 5;

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/**
 * Reusable, physics-backed player visibility detector for NPCs.
 * It only reports acquisition; callers decide what gameplay response to use.
 */
export class PlayerDetection {
  constructor({ root, physics, playerProvider, config, onDetected, initialDelay = 0 }) {
    this.root = root;
    this.physics = physics;
    this.playerProvider = playerProvider;
    this.config = config;
    this.onDetected = onDetected;

    this.state = DRONE_DETECTION_STATES.UNAWARE;
    this.visibleRatio = 0;
    this.initialDelay = Math.max(0, finiteNumber(initialDelay, 0));
    this.elapsedSinceCheck = -this.initialDelay;
    this.acquireElapsed = 0;
    this.lostElapsed = 0;
    this._debugRoot = null;
    this._debugLines = [];
    this._debugSamples = [];
    this._debugSampleGeometry = null;
    this._debugRayPositions = null;
    this._debugMarker = null;
    this._debugLabel = null;

    this._eye = new THREE.Vector3();
    this._rootWorldPosition = new THREE.Vector3();
    this._rootWorldQuaternion = new THREE.Quaternion();
    this._forward = new THREE.Vector3();
    this._forwardHorizontal = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._toSample = new THREE.Vector3();
    this._sampleCenter = new THREE.Vector3();
    this._playerAxis = new THREE.Vector3(0, 1, 0);
    this._playerCenter = new THREE.Vector3();
    this._samplePoints = Array.from({ length: SAMPLE_COUNT }, () => new THREE.Vector3());
    this._sampleInView = Array(SAMPLE_COUNT).fill(false);
    this._sampleVisible = Array(SAMPLE_COUNT).fill(false);
    this._ray = null;

    root?.traverse?.(object => {
      if (!this._debugMarker && authoredName(object).toLowerCase() === 'eye_dronea') {
        this._debugMarker = object;
      }
    });
  }

  get detectionState() { return this.state; }

  reset() {
    this.state = DRONE_DETECTION_STATES.UNAWARE;
    this.visibleRatio = 0;
    this.elapsedSinceCheck = -this.initialDelay;
    this.acquireElapsed = 0;
    this.lostElapsed = 0;
    this._sampleInView.fill(false);
    this._sampleVisible.fill(false);
    this._updateDebugGeometry();
  }

  setDebug(enabled) {
    this.config.detectionDebug = Boolean(enabled);
    if (this.config.detectionDebug) this._ensureDebugGeometry();
    else this._clearDebugGeometry();
    this._updateDebugGeometry();
  }

  toggleDebug() { this.setDebug(!this.config.detectionDebug); }

  update(dt, droneCollider = null) {
    const safeDt = Math.max(0, finiteNumber(dt, 0));
    if (!this.config.playerDetectionEnabled) {
      this._clearDebugGeometry();
      this.reset();
      return;
    }

    this.elapsedSinceCheck += safeDt;
    const rate = Math.max(0.1, finiteNumber(this.config.detectionUpdateRate, 10));
    const interval = 1 / rate;
    if (this.elapsedSinceCheck >= interval) {
      const checkDt = this.elapsedSinceCheck;
      this.elapsedSinceCheck = 0;
      this._check(checkDt, droneCollider);
    }
    this._updateDebugGeometry();
  }

  _findPlayer() {
    return this.playerProvider?.() ?? null;
  }

  _updateEye() {
    if (this._debugMarker) {
      this._debugMarker.getWorldPosition(this._eye);
      return;
    }
    const offset = Array.isArray(this.config.detectionEyeOffset)
      ? this.config.detectionEyeOffset : DEFAULT_EYE_OFFSET;
    this._eye.set(
      finiteNumber(offset[0], DEFAULT_EYE_OFFSET[0]),
      finiteNumber(offset[1], DEFAULT_EYE_OFFSET[1]),
      finiteNumber(offset[2], DEFAULT_EYE_OFFSET[2]),
    );
    this.root.localToWorld(this._eye);
  }

  _updateOrientation() {
    this.root.getWorldPosition(this._rootWorldPosition);
    this.root.getWorldQuaternion(this._rootWorldQuaternion);
    this._forward.set(0, 0, 1).applyQuaternion(this._rootWorldQuaternion).normalize();
    this._forwardHorizontal.copy(this._forward).setY(0);
    if (this._forwardHorizontal.lengthSq() < 1e-8) this._forwardHorizontal.set(0, 0, 1);
    else this._forwardHorizontal.normalize();
    // For local +Z forward, world right is (+Z, 0, -X).
    this._right.set(this._forwardHorizontal.z, 0, -this._forwardHorizontal.x).normalize();
  }

  _playerSamples(player) {
    const collider = player?.collider;
    const shape = collider?.shape;
    if (!collider || !shape) return false;
    const translation = collider.translation();
    const rotation = collider.rotation();
    const radius = Math.max(0, finiteNumber(shape.radius, 0));
    const halfHeight = Math.max(0, finiteNumber(shape.halfHeight, 0));
    this._playerCenter.set(translation.x, translation.y, translation.z);
    this._playerAxis.set(0, 1, 0).applyQuaternion(
      new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    ).normalize();

    const sideOffset = radius * 0.85;
    this._samplePoints[0].copy(this._playerCenter)
      .addScaledVector(this._playerAxis, halfHeight + radius * 0.75);
    this._samplePoints[1].copy(this._playerCenter)
      .addScaledVector(this._playerAxis, halfHeight * 0.55)
      .addScaledVector(this._right, sideOffset);
    this._samplePoints[2].copy(this._playerCenter)
      .addScaledVector(this._playerAxis, halfHeight * 0.55)
      .addScaledVector(this._right, -sideOffset);
    this._samplePoints[3].copy(this._playerCenter);
    this._samplePoints[4].copy(this._playerCenter)
      .addScaledVector(this._playerAxis, -(halfHeight * 0.65 + radius * 0.35));
    return true;
  }

  _withinView(point) {
    this._toSample.copy(point).sub(this._eye);
    const distance = this._toSample.length();
    const range = Math.max(0, finiteNumber(this.config.detectionRange, 10));
    if (distance > range || distance < 1e-8) return false;

    const horizontal = Math.hypot(this._toSample.x, this._toSample.z);
    const horizontalCos = Math.cos(
      THREE.MathUtils.degToRad(Math.max(0, finiteNumber(this.config.detectionHorizontalFOV, 90)) / 2),
    );
    if (horizontal < 1e-8) {
      if (horizontalCos > 0) return false;
    } else if ((this._toSample.x * this._forwardHorizontal.x
      + this._toSample.z * this._forwardHorizontal.z) / horizontal < horizontalCos) {
      return false;
    }

    const verticalAngle = Math.abs(Math.atan2(this._toSample.y, horizontal));
    const verticalHalfAngle = THREE.MathUtils.degToRad(
      Math.max(0, finiteNumber(this.config.detectionVerticalFOV, 60)) / 2,
    );
    return verticalAngle <= verticalHalfAngle;
  }

  _rayIsClear(point, player, droneCollider) {
    if (!this.config.detectionOcclusionEnabled) return true;
    const world = this.physics?.world;
    const RAPIER = this.physics?.RAPIER;
    if (!world || !RAPIER?.Ray) return true;
    this._toSample.copy(point).sub(this._eye);
    const distance = this._toSample.length();
    if (distance < 1e-8) return true;
    this._toSample.multiplyScalar(1 / distance);
    if (!this._ray) {
      this._ray = new RAPIER.Ray(
        { x: this._eye.x, y: this._eye.y, z: this._eye.z },
        { x: this._toSample.x, y: this._toSample.y, z: this._toSample.z },
      );
    } else {
      this._ray.origin.x = this._eye.x;
      this._ray.origin.y = this._eye.y;
      this._ray.origin.z = this._eye.z;
      this._ray.dir.x = this._toSample.x;
      this._ray.dir.y = this._toSample.y;
      this._ray.dir.z = this._toSample.z;
    }
    const flags = RAPIER.QueryFilterFlags?.EXCLUDE_SENSORS;
    const playerCollider = player?.collider ?? null;
    const playerBody = player?.body ?? null;
    const droneBody = droneCollider?.parent?.() ?? null;
    const predicate = collider => {
      if (!collider || collider.isSensor?.()) return false;
      const body = collider.parent?.();
      return body !== droneBody && body !== playerBody;
    };
    const hit = world.castRay(
      this._ray,
      distance,
      true,
      flags,
      undefined,
      droneCollider,
      playerBody,
      predicate,
    );
    return !hit;
  }

  _check(elapsed, droneCollider) {
    this._updateEye();
    this._updateOrientation();
    const player = this._findPlayer();
    const hasSamples = this._playerSamples(player);
    let visibleCount = 0;
    if (hasSamples) {
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const inView = this._withinView(this._samplePoints[i]);
        this._sampleInView[i] = inView;
        const visible = inView && this._rayIsClear(this._samplePoints[i], player, droneCollider);
        this._sampleVisible[i] = visible;
        if (visible) visibleCount++;
      }
    } else {
      this._sampleInView.fill(false);
      this._sampleVisible.fill(false);
    }

    this.visibleRatio = visibleCount / SAMPLE_COUNT;
    const minimumRatio = THREE.MathUtils.clamp(
      finiteNumber(this.config.detectionMinimumVisibleRatio, 0.4), 0, 1,
    );
    const detectable = hasSamples && this.visibleRatio >= minimumRatio;
    if (detectable) {
      this.acquireElapsed += elapsed;
      this.lostElapsed = 0;
      if (this.state === DRONE_DETECTION_STATES.UNAWARE
        && this.acquireElapsed >= Math.max(0, finiteNumber(this.config.detectionAcquireDuration, 0.2))) {
        this.state = DRONE_DETECTION_STATES.DETECTED;
        this.onDetected?.();
      }
    } else {
      this.acquireElapsed = 0;
      this.lostElapsed += elapsed;
      if (this.state === DRONE_DETECTION_STATES.DETECTED
        && this.lostElapsed >= Math.max(0, finiteNumber(this.config.detectionLostDuration, 0.5))) {
        this.state = DRONE_DETECTION_STATES.UNAWARE;
      }
    }
  }

  _ensureDebugGeometry() {
    if (this._debugRoot || !this.root?.parent) return;
    const group = new THREE.Group();
    group.name = 'DroneA_DetectionDebug';
    group.userData.ignoreDetection = true;
    group.userData.ignoreNavigation = true;
    group.userData.ignoreShadows = true;
    const material = new THREE.LineBasicMaterial({ color: 0x20d060, transparent: true, opacity: 0.8 });
    const range = Math.max(0.1, finiteNumber(this.config.detectionRange, 10));
    const h = THREE.MathUtils.degToRad(Math.max(0, finiteNumber(this.config.detectionHorizontalFOV, 90)) / 2);
    const v = THREE.MathUtils.degToRad(Math.max(0, finiteNumber(this.config.detectionVerticalFOV, 60)) / 2);
    const points = [
      [0, 0, 0, Math.sin(-h) * Math.cos(v) * range, Math.sin(v) * range, Math.cos(h) * Math.cos(v) * range],
      [0, 0, 0, Math.sin(h) * Math.cos(v) * range, Math.sin(v) * range, Math.cos(h) * Math.cos(v) * range],
      [0, 0, 0, Math.sin(-h) * Math.cos(v) * range, -Math.sin(v) * range, Math.cos(h) * Math.cos(v) * range],
      [0, 0, 0, Math.sin(h) * Math.cos(v) * range, -Math.sin(v) * range, Math.cos(h) * Math.cos(v) * range],
    ];
    for (const values of points) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(values[0], values[1], values[2]),
        new THREE.Vector3(values[3], values[4], values[5]),
      ]);
      group.add(new THREE.Line(geometry, material.clone()));
    }
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    eye.userData.ignoreDetection = true;
    group.add(eye);
    this._debugSamples = Array.from({ length: SAMPLE_COUNT }, () => {
      const sample = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x888888 }),
      );
      sample.userData.ignoreDetection = true;
      group.add(sample);
      return sample;
    });
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 80;
      const texture = new THREE.CanvasTexture(canvas);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      label.scale.set(2.4, 0.38, 1);
      label.userData.canvas = canvas;
      label.userData.texture = texture;
      group.add(label);
      this._debugLabel = label;
    }
    this._debugRoot = group;
    this._debugRoot.traverse(object => { object.castShadow = false; object.receiveShadow = false; });
    this.root.add(group);
  }

  _updateDebugGeometry() {
    if (!this.config.detectionDebug) return;
    this._ensureDebugGeometry();
    if (!this._debugRoot) return;
    this._updateEye();
    const localEye = this.root.worldToLocal(this._eye.clone());
    this._debugRoot.children.find(child => child.isMesh && child.geometry?.type === 'SphereGeometry')?.position.copy(localEye);
    const detected = this.state === DRONE_DETECTION_STATES.DETECTED;
    for (const child of this._debugRoot.children) {
      if (child.isLine) child.material.color.set(detected ? 0xe03030 : 0x20d060);
    }
    for (let i = 0; i < this._debugSamples.length; i++) {
      const sample = this._debugSamples[i];
      if (!this._samplePoints[i]) continue;
      sample.position.copy(this.root.worldToLocal(this._samplePoints[i].clone()));
      sample.material.color.set(!this._sampleInView[i] ? 0x888888 : this._sampleVisible[i] ? 0x20d060 : 0xe03030);
    }
    if (this._debugLabel) {
      this._debugLabel.position.copy(localEye).add(new THREE.Vector3(0, 0.25, 0));
      const canvas = this._debugLabel.userData.canvas;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = 'bold 30px monospace';
      context.fillStyle = detected ? '#ff4040' : '#40e878';
      context.fillText(`${this.state}  ${(this.visibleRatio * 100).toFixed(0)}%`, 8, 38);
      this._debugLabel.userData.texture.needsUpdate = true;
    }
  }

  _clearDebugGeometry() {
    if (!this._debugRoot) return;
    this._debugRoot.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
    this._debugRoot.removeFromParent();
    this._debugRoot = null;
    this._debugSamples = [];
    this._debugLabel = null;
  }

  dispose() {
    this._clearDebugGeometry();
    this.root = null;
    this.physics = null;
    this.playerProvider = null;
    this.onDetected = null;
  }
}

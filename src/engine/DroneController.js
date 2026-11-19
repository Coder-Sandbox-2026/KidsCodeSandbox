import * as THREE from 'three';
import { DroneA } from './DroneA.js';
import { PlayerDetection, DRONE_DETECTION_STATES } from './PlayerDetection.js';

export { DRONE_DETECTION_STATES } from './PlayerDetection.js';

export const DRONE_STATES = Object.freeze({
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  LOCAL_RECOVER: 'LOCAL_RECOVER',
  RECOVER: 'RECOVER',
  STRANDED: 'STRANDED',
});

export const DRONE_VERTICAL_STATES = Object.freeze({
  GROUNDED: 'GROUNDED',
  FALLING: 'FALLING',
  LANDING: 'LANDING',
  INJURED: 'INJURED',
  SETTLED: 'SETTLED',
  RESTORING: 'RESTORING',
});

export const DRONE_CONFIG = Object.freeze({
  movementSpeed: 2,
  hoverHeight: 1.10,
  bobbingAmplitude: 0.04,
  bobbingFrequency: 1,
  rotationSpeed: 5.0,
  // DroneA's authored mesh faces local +Z. Change this only if the imported
  // model variant uses a different forward axis/orientation.
  forwardYawOffset: 0,
  cornerRadius: 0.5,
  pathArcLengthDivisions: 1000,
  loopPath: true,
  movementEnabled: true,
  hoveringEnabled: true,
  groundDetectionEnabled: true,
  groundDetectionRadius: 0.25,
  groundSnapDistance: 0.15,
  maxStepHeight: 0.25,
  maxGroundSlopeDegrees: 50,
  groundFollowSpeed: 4.0,
  gravity: 9.81,
  terminalFallSpeed: 25.0,
  airMovementMultiplier: 1.0,
  landingBobAmplitude: 0.12,
  landingBobDuration: 0.4,
  landingImpactThreshold: 0.5,
  landingImpactScale: 0.08,
  groundDebug: false,
  navigationEnabled: true,
  recoverySpeed: 2.0,
  displacementThreshold: 0.15,
  waypointArrivalTolerance: 0.1,
  repathCooldown: 0.5,
  strandedRetryInterval: 5.0,
  strandedDisplacementThreshold: 0.15,
  strandedRotationSpeed: 0.5,
  strandedPlayerTrackingEnabled: true,
  recoveryStuckTimeout: 5.0,
  recoveryMinimumProgress: 0.1,
  navigationDebug: false,
  localRecoveryEnabled: true,
  localRecoveryDistance: 1.5,
  localRecoveryLookAhead: 0.75,
  localRecoverySpeed: 2.0,
  localRecoveryArrivalTolerance: 0.05,
  collisionEnabled: true,
  collisionRadius: 0.45,
  canPushPlayer: true,
  playerCanPushDrone: false,
  playerPushSpeedMultiplier: 1.0,
  playerPushMovementMultiplier: 0.8,
  playerPushSpeedTransition: 0.2,
  // Player detection. Angles are full horizontal/vertical viewing angles.
  playerDetectionEnabled: true,
  detectionRange: 10.0,
  detectionHorizontalFOV: 90,
  detectionVerticalFOV: 60,
  detectionUpdateRate: 10,
  detectionMinimumVisibleRatio: 0.4,
  detectionAcquireDuration: 0.2,
  detectionLostDuration: 0.5,
  detectionOcclusionEnabled: true,
  detectionEyeOffset: [0, 0.35, 0.55],
  detectionDebug: false,
  caughtCameraRotationDuration: 0.8,
  caughtRedEffectDuration: 4.0,
  caughtPostEffectDelay: 1.0,
  caughtRedFadeInDuration: 0.4,
  caughtRedFadeOutDuration: 0.4,
  caughtRedOverlayOpacity: 0.45,
  caughtDroneTrackingSpeed: 5.0,
  caughtSirenVolume: 0.8,
  caughtMusicVolumeMultiplier: 0.2,
  caughtDroneAudioMultiplier: 0.0,
  caughtAudioFadeDuration: 0.3,
  droneAudioEnabled: true,
  droneAudioVolume: 0.6,
  droneAudioRefDistance: 2.0,
  droneAudioMaxDistance: 15.0,
  droneAudioRolloffFactor: 1.5,
  droneAudioFadeDuration: 0.25,
  droneAudioDirectionalAttenuationEnabled: false,
  droneAudioRearVolumeMultiplier: 0.7,
  // Injured dynamic physics. These are independent of normal falling.
  injuredFallingEnabled: true,
  injuredMass: 25.0,
  injuredRestitution: 0.4,
  injuredFriction: 0.6,
  injuredLinearDamping: 0.3,
  injuredAngularDamping: 0.5,
  injuredTestLaunchSpeed: 8.0,
  injuredTestUpwardSpeed: 10.0,
  injuredTestAngularSpeed: 6.0,
  injuredMinimumDuration: 1.0,
  injuredSettleLinearThreshold: 0.15,
  injuredSettleAngularThreshold: 0.15,
  injuredSettleDuration: 1.0,
  injuredRestoreDuration: 1.5,
  injuredRestoreDelay: 0.5,
  injuredDebug: false,
  // DroneA-specific dynamic-body interaction. These values affect only the
  // kinematic DroneA controller; they do not alter the public object physics.
  dynamicObjectPushingEnabled: true,
  dynamicObjectPushMass: 250.0,
  dynamicObjectMaxPushForce: 500.0,
  dynamicObjectMinMovementMultiplier: 0.25,
  dynamicObjectPushSpeedTransition: 0.2,
  // Keeps the player's inward input suppressed while the two kinematic
  // actors remain in contact. This is deliberately small so it does not
  // change normal movement or prevent the player from walking away.
  playerContactSeparationTolerance: 0.02,
  // Small lateral bias used only for a centered frontal contact. It lets the
  // player gradually leave DroneA's travel corridor instead of being carried
  // along the entire patrol route.
  playerLateralSeparationPreference: 0.35,
  stopWhenPlayerBlocked: true,
  collisionDebug: false,
  debug: false,
});

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

function sameRapierHandle(first, second) {
  if (!first || !second) return false;
  const firstHandle = typeof first === 'number' ? first : first.handle;
  const secondHandle = typeof second === 'number' ? second : second.handle;
  return firstHandle !== undefined && secondHandle !== undefined
    && firstHandle === secondHandle;
}

function sameRapierCollider(first, second) {
  if (!first || !second) return false;
  if (sameRapierHandle(first, second)) return true;
  return sameRapierHandle(first.parent?.(), second.parent?.());
}

function discoverWaypoints(root, prefix = 'PATH_DroneA_') {
  const prefixPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(\\d+)$`, 'i');
  const found = [];
  root?.traverse(object => {
    const name = authoredName(object);
    const match = name.match(prefixPattern);
    if (!match) return;
    object.visible = false;
    // Empty nodes do not produce meshes/colliders, but this also protects a
    // future authored marker from accidentally becoming visible or physical.
    object.userData ??= {};
    object.userData.noRender = true;
    object.userData.noCollision = true;
    found.push({ object, name, index: Number(match[1]) });
  });
  found.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
  return found;
}

function visualBounds(root) {
  const box = new THREE.Box3();
  let hasMesh = false;
  root.traverse(object => {
    if (!object.isMesh) return;
    object.geometry?.computeBoundingBox?.();
    if (!object.geometry?.boundingBox) return;
    const meshBox = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    box.union(meshBox);
    hasMesh = true;
  });
  if (!hasMesh) return null;
  // The root's local Y origin is the reference needed for the hover offset.
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  return box.applyMatrix4(inverse);
}

export class DroneController {
  constructor(root, {
    waypointRoot = root.parent,
    prefix = null,
    droneId = null,
    detectionIndex = 0,
    config = {},
    debug = false,
    navigationManager = null,
    engine = null,
    physics = engine?.physics ?? null,
  } = {}) {
    this.root = root;
    const inferredDroneId = String(prefix ?? '').match(/^PATH_(DroneA\d*)_$/i)?.[1];
    this.droneId = String(droneId ?? inferredDroneId ?? 'DroneA');
    const waypointPrefix = prefix ?? `PATH_${this.droneId}_`;
    this.config = { ...DRONE_CONFIG, ...config, debug: debug || config.debug === true };
    this.engine = engine;
    this.physics = physics;
    this.visual = new DroneA(root);
    this.droneAudio = engine?.audio?.attachDroneAudio?.(root, {
      ...this.config,
      isInjured: () => this._isInjuredState(),
      isCaught: () => this.caughtSequenceActive,
    });
    this.debugRoot = null;
    this.elapsed = 0;
    this.distance = 0;
    this.moving = Boolean(this.config.movementEnabled);
    this.valid = false;
    this.path = null;
    this.pathLength = 0;
    this._pathHorizontalSamples = [];
    this._pathHorizontalLength = 0;
    this.navigationManager = navigationManager;
    this.collisionInfo = null;
    this.collisionDebugRoot = null;
    this._collisionOffsetLocal = new THREE.Vector3();
    this._collisionCenterWorld = new THREE.Vector3();
    this._collisionDesiredCenterWorld = new THREE.Vector3();
    this._collisionPlayerPosition = new THREE.Vector3();
    this._droneCharacterController = null;
    this._droneControllerOffset = 0.03;
    this._droneRadius = 0;
    this._playerBlocked = false;
    this._playerContactActive = false;
    this._playerDisplacementActive = false;
    this._playerSeparationSide = 0;
    this._playerContactNormal = new THREE.Vector3();
    this._playerContactCurrentNormal = new THREE.Vector3();
    this._pushSpeedScale = 1;
    this._dynamicPushSpeedScale = 1;
    this._dynamicPushTargetScale = 1;
    this._collisionDiagnosticAt = -Infinity;
    this.state = DRONE_STATES.IDLE;
    this.caughtSequenceActive = false;
    this._caughtMovementBefore = false;
    this.recoveryRoute = null;
    this.recoveryDistances = null;
    this.strandedRetryElapsed = 0;
    this.recoveryStuckElapsed = 0;
    this.recoveryProgressReference = 0;
    this.recoveryStuckAttempts = 0;
    this.recoveryDistance = 0;
    this.recoveryTargetIndex = -1;
    this.recoverySegmentIndex = 1;
    this.lastRecoveryAt = -Infinity;
    this.retryRecoveryAt = 0;
    this.recoveryDestinationSelections = 0;
    this.recoveryRouteCalculations = 0;
    this.recoveryRecalculations = 0;
    this._worldPosition = new THREE.Vector3();
    this._lastAppliedWorldPosition = new THREE.Vector3();
    this._desiredWorldPosition = new THREE.Vector3();
    this._verticalPlan = null;
    this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
    this.virtualFeetWorld = new THREE.Vector3();
    this.groundElevation = 0;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.groundSupported = false;
    this.verticalVelocity = 0;
    this.fallDuration = 0;
    this.landingElapsed = 0;
    this.landingAmplitude = 0;
    this._verticalLandedThisFrame = false;
    this._neutralBaseWorldOffsetY = 0;
    this._neutralBaseLocalY = 0;
    this._groundCastShape = null;
    this._groundCastRotation = { x: 0, y: 0, z: 0, w: 1 };
    this._groundCastStart = new THREE.Vector3();
    this._groundCastDirection = new THREE.Vector3(0, -1, 0);
    this._groundSupport = null;
    this._groundDebugRoot = null;
    this._groundDebugFeet = null;
    this._groundDebugSupport = null;
    this._groundDebugCast = null;
    this._groundDebugLine = null;
    this._groundDebugNormal = null;
    this._groundDebugLabel = null;
    this._groundDebugLastLabel = '';
    this._groundDebugLastLabelAt = -Infinity;
    this._idleGroundPoint = new THREE.Vector3();
    this._recoverySample = new THREE.Vector3();
    this._recoveryLookahead = new THREE.Vector3();
    this.recoveryDebugRoot = null;
    this.localRecoveryPath = null;
    this.localRecoverySamples = [];
    this.localRecoveryLength = 0;
    this.localRecoveryDistance = 0;
    this.localRecoveryTargetDistance = 0;
    this.localRecoveryDebugRoot = null;
    this.waypoints = discoverWaypoints(waypointRoot, waypointPrefix);
    this._originOffsetY = 0;
    this._targetQuaternion = new THREE.Quaternion();
    this._rootWorldQuaternion = new THREE.Quaternion();
    this._restoreTargetLocalQuaternion = new THREE.Quaternion();
    this._restoreTargetWorldQuaternion = new THREE.Quaternion();
    this._restoreHeading = new THREE.Vector3(0, 0, 1);
    this._injuryRecoveryAnchor = new THREE.Vector3();
    this._injuryRecoveryFirstMovementReported = false;
    this.injuredElapsed = 0;
    this.injuredSettleElapsed = 0;
    this.injuredRestoreDelayElapsed = 0;
    this.injuredRestoreElapsed = 0;
    this._injuredStateBefore = DRONE_STATES.PATROL;
    this._injuredSupport = null;
    this._pendingInjuredLinearImpulse = null;
    this._pendingInjuredAngularImpulse = null;
    this._pendingInjuredLaunch = null;
    this.detection = new PlayerDetection({
      root: this.root,
      physics: this.physics,
      playerProvider: () => this.engine?.findPlayer?.() ?? this.engine?.player,
      config: this.config,
      initialDelay: detectionIndex > 0
        ? (detectionIndex % 4) / Math.max(0.1, Number(this.config.detectionUpdateRate) || 10) / 4
        : 0,
      onDetected: () => this.engine?.caughtSequence?.start?.(this),
    });

    this._log('info', 'Drone object found:', authoredName(root) || root.name);
    this._log('info', 'Waypoints discovered:', this.waypoints.length);
    this._log('info', 'Sorted waypoint names:', this.waypoints.map(item => item.name));

    waypointRoot?.updateMatrixWorld(true);
    this.points = this.waypoints.map(({ object, name }) => {
      const position = object.getWorldPosition(new THREE.Vector3());
      this._log('info', `${name} world coordinates:`, position.toArray());
      return position;
    });

    if (this.points.length >= 2 && this.points.every(point => point.x !== undefined && point.y !== undefined && point.z !== undefined)) {
      this.path = this._buildPatrolPath(this.points);
      this._buildHorizontalPathLookup();
      this.pathLength = this._pathHorizontalLength;
      this.valid = Number.isFinite(this.pathLength) && this.pathLength > 0.001;
      this._log('info', 'Total horizontal patrol path length:', this.pathLength);
      if (!this.valid) this._log('warn', 'Generated patrol path is invalid; remaining stationary.');
    } else {
      this._log('warn', 'Missing or invalid waypoints; remaining at authored spawn.');
    }

    root.updateMatrixWorld(true);
    const bounds = visualBounds(root);
    this._originOffsetY = bounds?.min.y ?? 0;
    this._neutralBaseLocalY = this._originOffsetY;
    this._captureNeutralBaseOffset();
    this._resetVerticalStateFromRoot();
    if (this.config.collisionEnabled) this._createCollisionBody(bounds);
    if (this.collisionInfo) this._resetVerticalStateFromRoot();
    this._createGroundCastShape();
    if (this.valid) {
      if (this.config.navigationEnabled && this.navigationManager) {
        this._setIdleGroundPointFromCurrentPosition();
        this._beginRecovery('initial spawn', true);
      } else if (this.config.navigationEnabled) {
        this._log('warn', 'Navigation is enabled but no NavigationManager is available; remaining idle.');
        this._setIdleGroundPointFromCurrentPosition();
      } else {
        this.reset();
      }
      if (this.config.debug) this._createDebugVisualization();
      if (this.config.navigationDebug) this.setNavigationDebug(true);
      if (this.config.groundDebug) this.setGroundDebug(true);
      if (this.config.detectionDebug) this.setDetectionDebug(true);
      this._log('info', 'Successful controller initialization.');
    }
  }

  _captureNeutralBaseOffset() {
    if (!this.root) return;
    this.root.updateMatrixWorld(true);
    const rootWorld = this.root.getWorldPosition(new THREE.Vector3());
    const baseWorld = this.root.localToWorld(new THREE.Vector3(0, this._neutralBaseLocalY, 0));
    this._neutralBaseWorldOffsetY = baseWorld.y - rootWorld.y;
  }

  _resetVerticalStateFromRoot() {
    if (!this.root) return;
    this.root.getWorldPosition(this._worldPosition);
    const physicalPosition = this.collisionInfo?.collider?.translation?.();
    this.virtualFeetWorld.set(
      physicalPosition?.x ?? this._worldPosition.x,
      this._worldPosition.y + this._neutralBaseWorldOffsetY - this.config.hoverHeight,
      physicalPosition?.z ?? this._worldPosition.z,
    );
    this.groundElevation = this.virtualFeetWorld.y;
    this.groundNormal.set(0, 1, 0);
    this.groundSupported = false;
    this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
    this.verticalVelocity = 0;
    this.fallDuration = 0;
    this.landingElapsed = 0;
    this.landingAmplitude = 0;
    this._verticalPlan = null;
  }

  _buildHorizontalPathLookup() {
    this._pathHorizontalSamples = [];
    this._pathHorizontalLength = 0;
    if (!this.path) return;
    const divisions = Math.max(32, Number(this.config.pathArcLengthDivisions) || 1000);
    let previous = this.path.getPointAt(0, new THREE.Vector3());
    this._pathHorizontalSamples.push({ u: 0, distance: 0, point: previous.clone() });
    for (let i = 1; i <= divisions; i++) {
      const u = i / divisions;
      const point = this.path.getPointAt(u, new THREE.Vector3());
      this._pathHorizontalLength += Math.hypot(point.x - previous.x, point.z - previous.z);
      this._pathHorizontalSamples.push({ u, distance: this._pathHorizontalLength, point: point.clone() });
      previous = point;
    }
  }

  _patrolPointAtDistance(distance, target = new THREE.Vector3()) {
    const samples = this._pathHorizontalSamples;
    if (!samples.length) return target.set(0, 0, 0);
    if (this._pathHorizontalLength <= 1e-7) return target.copy(samples[0].point);
    const clamped = this.config.loopPath
      ? ((distance % this._pathHorizontalLength) + this._pathHorizontalLength) % this._pathHorizontalLength
      : THREE.MathUtils.clamp(distance, 0, this._pathHorizontalLength);
    let high = 1;
    while (high < samples.length && samples[high].distance < clamped) high++;
    if (high >= samples.length) return target.copy(samples[samples.length - 1].point);
    const low = samples[high - 1];
    const span = samples[high].distance - low.distance;
    const t = span > 1e-7 ? (clamped - low.distance) / span : 0;
    return target.copy(low.point).lerp(samples[high].point, t);
  }

  _patrolTangentAtDistance(distance, target = new THREE.Vector3()) {
    const epsilon = Math.max(0.01, this._pathHorizontalLength * 0.001);
    const before = this._patrolPointAtDistance(distance - epsilon, new THREE.Vector3());
    const after = this._patrolPointAtDistance(distance + epsilon, new THREE.Vector3());
    return target.copy(after).sub(before).normalize();
  }

  _buildHorizontalCurveLookup(curve, divisions = 64) {
    const samples = [];
    let total = 0;
    let previous = curve.getPointAt(0, new THREE.Vector3());
    samples.push({ u: 0, distance: 0, point: previous.clone() });
    for (let i = 1; i <= divisions; i++) {
      const u = i / divisions;
      const point = curve.getPointAt(u, new THREE.Vector3());
      total += Math.hypot(point.x - previous.x, point.z - previous.z);
      samples.push({ u, distance: total, point: point.clone() });
      previous = point;
    }
    return { samples, length: total };
  }

  _sampleHorizontalLookup(lookup, distance, target = new THREE.Vector3()) {
    if (!lookup?.samples?.length) return target.set(0, 0, 0);
    if (lookup.length <= 1e-7) return target.copy(lookup.samples[0].point);
    const clamped = THREE.MathUtils.clamp(distance, 0, lookup.length);
    let high = 1;
    while (high < lookup.samples.length && lookup.samples[high].distance < clamped) high++;
    if (high >= lookup.samples.length) return target.copy(lookup.samples[lookup.samples.length - 1].point);
    const low = lookup.samples[high - 1];
    const span = lookup.samples[high].distance - low.distance;
    const t = span > 1e-7 ? (clamped - low.distance) / span : 0;
    return target.copy(low.point).lerp(lookup.samples[high].point, t);
  }

  _buildPatrolPath(points) {
    const path = new THREE.CurvePath();
    const divisions = Number(this.config.pathArcLengthDivisions);
    path.arcLengthDivisions = Number.isFinite(divisions) ? Math.max(1, Math.floor(divisions)) : 1000;

    // Remove consecutive duplicates before calculating directions. The authored
    // points remain the source of every coordinate; duplicates simply cannot
    // form a usable line or corner.
    const cleanPoints = [];
    for (const point of points) {
      if (!cleanPoints.length || cleanPoints[cleanPoints.length - 1].distanceToSquared(point) > 1e-10) {
        cleanPoints.push(point.clone());
      }
    }
    if (this.config.loopPath && cleanPoints.length > 1
      && cleanPoints[0].distanceToSquared(cleanPoints[cleanPoints.length - 1]) <= 1e-10) {
      cleanPoints.pop();
    }
    if (cleanPoints.length < 2) return path;

    const count = cleanPoints.length;
    const closed = Boolean(this.config.loopPath);
    const corners = cleanPoints.map(() => null);
    const cornerRadius = Math.max(0, Number(this.config.cornerRadius) || 0);
    const isCorner = (previous, current, next) => {
      const incoming = current.clone().sub(previous);
      const outgoing = next.clone().sub(current);
      if (incoming.lengthSq() <= 1e-10 || outgoing.lengthSq() <= 1e-10) return false;
      incoming.normalize();
      outgoing.normalize();
      // Parallel directions, including a 180-degree reversal, are collinear.
      return Math.abs(incoming.cross(outgoing).length()) > 1e-5;
    };

    const firstCorner = closed ? 0 : 1;
    const lastCorner = closed ? count : count - 1;
    for (let index = firstCorner; index < lastCorner; index++) {
      const previousIndex = (index - 1 + count) % count;
      const nextIndex = (index + 1) % count;
      const previous = cleanPoints[previousIndex];
      const current = cleanPoints[index];
      const next = cleanPoints[nextIndex];
      if (!isCorner(previous, current, next) || cornerRadius <= 0) continue;

      const incomingLength = current.distanceTo(previous);
      const outgoingLength = next.distanceTo(current);
      const distance = Math.min(cornerRadius, incomingLength * 0.5, outgoingLength * 0.5);
      if (distance <= 1e-5) continue;

      const incomingDirection = current.clone().sub(previous).normalize();
      const outgoingDirection = next.clone().sub(current).normalize();
      corners[index] = {
        entry: current.clone().addScaledVector(incomingDirection, -distance),
        control: current.clone(),
        exit: current.clone().addScaledVector(outgoingDirection, distance),
      };
    }

    const entryPoint = index => corners[index]?.entry ?? cleanPoints[index];
    const exitPoint = index => corners[index]?.exit ?? cleanPoints[index];
    const addLine = (start, end) => {
      if (start.distanceToSquared(end) > 1e-10) {
        const curve = new THREE.LineCurve3(start, end);
        curve.arcLengthDivisions = path.arcLengthDivisions;
        path.add(curve);
      }
    };
    const addCorner = index => {
      const corner = corners[index];
      if (corner) {
        const curve = new THREE.QuadraticBezierCurve3(corner.entry, corner.control, corner.exit);
        curve.arcLengthDivisions = path.arcLengthDivisions;
        path.add(curve);
      }
    };

    if (closed) {
      // Start at the first waypoint's outgoing segment. If waypoint 001 is
      // rounded, this is its corner exit, making reset seamless into 002.
      const start = exitPoint(0);
      let previousExit = start;
      for (let step = 1; step < count; step++) {
        const index = step % count;
        addLine(previousExit, entryPoint(index));
        addCorner(index);
        previousExit = exitPoint(index);
      }
      addLine(previousExit, entryPoint(0));
      addCorner(0);
    } else {
      addLine(cleanPoints[0], entryPoint(1));
      addCorner(1);
      for (let index = 2; index < count; index++) {
        addLine(exitPoint(index - 1), entryPoint(index));
        addCorner(index);
      }
      addLine(exitPoint(count - 1), cleanPoints[count - 1]);
    }

    return path;
  }

  _createDebugVisualization() {
    const scene = this.root.parent;
    if (!scene || !this.path) return;
    this.debugRoot = new THREE.Group();
    this.debugRoot.name = 'DroneA_DebugPath';
    const samples = Math.max(32, this.points.length * 16);
    const positions = this.path.getPoints(samples).flatMap(point => point.toArray());
    const line = this.config.loopPath ? new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
      new THREE.LineBasicMaterial({ color: 0x36e6ff }),
    ) : new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
      new THREE.LineBasicMaterial({ color: 0x36e6ff }),
    );
    this.debugRoot.add(line);
    for (const point of this.points) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffc107 }),
      );
      marker.position.copy(point);
      this.debugRoot.add(marker);
    }
    this.directionArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, 0xff3d00);
    this.debugRoot.add(this.directionArrow);
    scene.add(this.debugRoot);
  }

  _setState(nextState) {
    if (this.state === nextState) return;
    this._log('info', `State transition: ${this.state} -> ${nextState}`);
    this.state = nextState;
  }

  _log(level, message, ...args) {
    console[level]?.(`[DroneController][${this.droneId}] ${message}`, ...args);
  }

  _setRootWorldPosition(position) {
    if (!this.root) return;
    if (this.root.parent) {
      this.root.parent.updateMatrixWorld(true);
      this.root.position.copy(this.root.parent.worldToLocal(position.clone()));
    } else this.root.position.copy(position);
  }

  _setRootWorldQuaternion(quaternion) {
    if (!this.root || !quaternion) return;
    if (this.root.parent) {
      const parentWorld = this.root.parent.getWorldQuaternion(new THREE.Quaternion());
      this.root.quaternion.copy(parentWorld).invert().multiply(quaternion);
    } else this.root.quaternion.copy(quaternion);
  }

  _isInjuredState() {
    return this.verticalState === DRONE_VERTICAL_STATES.INJURED
      || this.verticalState === DRONE_VERTICAL_STATES.SETTLED
      || this.verticalState === DRONE_VERTICAL_STATES.RESTORING;
  }

  _captureRecoveryHeading() {
    this.root.getWorldQuaternion(this._rootWorldQuaternion);
    this._restoreHeading.set(0, 0, 1).applyQuaternion(this._rootWorldQuaternion).setY(0);
    if (this._restoreHeading.lengthSq() < 1e-8) this._restoreHeading.set(0, 0, 1);
    else this._restoreHeading.normalize();
  }

  _configureRestoreTarget() {
    const yaw = Math.atan2(this._restoreHeading.x, this._restoreHeading.z);
    this._restoreTargetWorldQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    if (this.root.parent) {
      const parentWorld = this.root.parent.getWorldQuaternion(new THREE.Quaternion());
      this._restoreTargetLocalQuaternion.copy(parentWorld).invert()
        .multiply(this._restoreTargetWorldQuaternion);
    } else this._restoreTargetLocalQuaternion.copy(this._restoreTargetWorldQuaternion);
  }

  _injuredBody() { return this.collisionInfo?.body ?? null; }

  _promoteToInjuredBody() {
    const id = this.collisionInfo?.id;
    if (id === undefined || !this.physics?.promoteKinematicToDynamic) return false;
    const entry = this.physics.bodies.get(id) ?? this.physics.promoteKinematicToDynamic(id, {
      mass: Math.max(0.01, Number(this.config.injuredMass) || 25),
      restitution: THREE.MathUtils.clamp(Number(this.config.injuredRestitution) || 0.4, 0, 1),
      friction: Math.max(0, Number(this.config.injuredFriction) || 0.6),
      linearDamping: Math.max(0, Number(this.config.injuredLinearDamping) || 0.3),
      angularDamping: Math.max(0, Number(this.config.injuredAngularDamping) || 0.5),
      ccd: true,
    });
    return Boolean(entry);
  }

  _demoteFromInjuredBody() {
    const id = this.collisionInfo?.id;
    if (id === undefined || !this.physics?.demoteDynamicToKinematic) return false;
    const demoted = Boolean(this.physics.demoteDynamicToKinematic(id));
    if (demoted) {
      this._pendingInjuredLinearImpulse = null;
      this._pendingInjuredAngularImpulse = null;
      this._pendingInjuredLaunch = null;
    }
    return demoted;
  }

  _applyPendingInjuredImpulse() {
    const body = this._injuredBody();
    if (!body?.isDynamic?.()) return false;
    const targetMass = Math.max(0.01, Number(this.config.injuredMass) || 25);
    const mass = Math.max(0, Number(body.mass?.()) || 0);
    // setAdditionalMass is committed by Rapier at the next physics step. Do
    // not apply a launch impulse against the temporary collider-only mass.
    if (mass + 1e-3 < targetMass) return false;

    if (this._pendingInjuredLaunch) {
      const { angle, horizontal, upward, spin } = this._pendingInjuredLaunch;
      body.applyImpulse?.({
        x: Math.cos(angle) * horizontal * mass,
        y: upward * mass,
        z: Math.sin(angle) * horizontal * mass,
      }, true);
      body.applyTorqueImpulse?.({
        x: (Math.random() - 0.5) * spin * mass,
        y: (Math.random() - 0.5) * spin * mass,
        z: (Math.random() - 0.5) * spin * mass,
      }, true);
    } else {
      if (this._pendingInjuredLinearImpulse) body.applyImpulse?.(this._pendingInjuredLinearImpulse, true);
      if (this._pendingInjuredAngularImpulse) body.applyTorqueImpulse?.(this._pendingInjuredAngularImpulse, true);
    }
    this._pendingInjuredLinearImpulse = null;
    this._pendingInjuredAngularImpulse = null;
    this._pendingInjuredLaunch = null;
    return true;
  }

  /** Internal reusable entry point for explosions, impacts, and scripted attacks. */
  triggerInjuredFall({ linearImpulse = null, angularImpulse = null } = {}) {
    if (!this.config.injuredFallingEnabled || !this.collisionInfo?.body) return false;
    const wasInjured = this._isInjuredState();
    if (!wasInjured) {
      this._injuredStateBefore = this.state;
      this._clearNavigationRecoveryState();
      this._captureRecoveryHeading();
      this._setState(DRONE_STATES.IDLE);
      this.verticalState = DRONE_VERTICAL_STATES.INJURED;
      this.injuredElapsed = 0;
    } else if (this.verticalState === DRONE_VERTICAL_STATES.RESTORING) {
      this.verticalState = DRONE_VERTICAL_STATES.INJURED;
      this.injuredElapsed = 0;
      this.injuredSettleElapsed = 0;
      this.injuredRestoreDelayElapsed = 0;
      this.injuredRestoreElapsed = 0;
      this._promoteToInjuredBody();
    } else if (this.verticalState === DRONE_VERTICAL_STATES.SETTLED) {
      this.verticalState = DRONE_VERTICAL_STATES.INJURED;
      this.injuredSettleElapsed = 0;
      this.injuredRestoreDelayElapsed = 0;
    }
    if (!this._promoteToInjuredBody() && !this.physics.bodies.has(this.collisionInfo.id)) return false;

    const body = this._injuredBody();
    body.wakeUp?.();
    this._pendingInjuredLaunch = null;
    this._pendingInjuredLinearImpulse = linearImpulse
      ? { x: Number(linearImpulse.x) || 0, y: Number(linearImpulse.y) || 0, z: Number(linearImpulse.z) || 0 }
      : null;
    this._pendingInjuredAngularImpulse = angularImpulse
      ? { x: Number(angularImpulse.x) || 0, y: Number(angularImpulse.y) || 0, z: Number(angularImpulse.z) || 0 }
      : null;
    this._applyPendingInjuredImpulse();
    this.injuredSettleElapsed = 0;
    this.injuredRestoreDelayElapsed = 0;
    this.injuredRestoreElapsed = 0;
    this.detection?.reset();
    return true;
  }

  triggerTestInjuredFall() {
    if (!this.config.injuredFallingEnabled) return false;
    if (!this.triggerInjuredFall()) return false;
    const angle = Math.random() * Math.PI * 2;
    const horizontal = Math.max(0, Number(this.config.injuredTestLaunchSpeed) || 8);
    const upward = Math.max(0, Number(this.config.injuredTestUpwardSpeed) || 10);
    const spin = Math.max(0, Number(this.config.injuredTestAngularSpeed) || 6);
    this._pendingInjuredLinearImpulse = null;
    this._pendingInjuredAngularImpulse = null;
    this._pendingInjuredLaunch = { angle, horizontal, upward, spin };
    this._applyPendingInjuredImpulse();
    return true;
  }

  _injuredGroundSupport() {
    const collider = this.collisionInfo?.collider;
    if (!collider) return null;
    const center = collider.translation();
    const radius = Math.max(0.05, Number(collider.shape?.radius) || this._droneRadius || 0.45);
    return this._queryGround(center.x, center.z, center.y - radius, 20, 1);
  }

  _updateInjuredPhysics(dt) {
    const body = this._injuredBody();
    if (!body || !body.isDynamic?.()) return;
    this._applyPendingInjuredImpulse();
    const safeDt = Math.max(0, Number(dt) || 0);
    this.injuredElapsed += safeDt;
    const linear = body.linvel?.() ?? { x: 0, y: 0, z: 0 };
    const angular = body.angvel?.() ?? { x: 0, y: 0, z: 0 };
    const linearSpeed = Math.hypot(linear.x, linear.y, linear.z);
    const angularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    this._injuredSupport = this._injuredGroundSupport();
    const linearThreshold = Math.max(0, Number(this.config.injuredSettleLinearThreshold) || 0.15);
    const angularThreshold = Math.max(0, Number(this.config.injuredSettleAngularThreshold) || 0.15);
    const quiet = Boolean(this._injuredSupport)
      && linearSpeed <= linearThreshold && angularSpeed <= angularThreshold;

    if (this.verticalState === DRONE_VERTICAL_STATES.INJURED) {
      if (quiet && this.injuredElapsed >= Math.max(0, Number(this.config.injuredMinimumDuration) || 1)) {
        this.injuredSettleElapsed += safeDt;
        if (this.injuredSettleElapsed >= Math.max(0, Number(this.config.injuredSettleDuration) || 1)) {
          this.verticalState = DRONE_VERTICAL_STATES.SETTLED;
          this.injuredRestoreDelayElapsed = 0;
        }
      } else this.injuredSettleElapsed = 0;
      return;
    }

    if (this.verticalState !== DRONE_VERTICAL_STATES.SETTLED) return;
    if (!quiet) {
      this.verticalState = DRONE_VERTICAL_STATES.INJURED;
      this.injuredSettleElapsed = 0;
      this.injuredRestoreDelayElapsed = 0;
      return;
    }
    this.injuredRestoreDelayElapsed += safeDt;
    if (this.injuredRestoreDelayElapsed >= Math.max(0, Number(this.config.injuredRestoreDelay) || 0.5)) {
      this._beginInjuredRestoration();
    }
  }

  _beginInjuredRestoration() {
    if (this.verticalState !== DRONE_VERTICAL_STATES.SETTLED) return false;
    const body = this.collisionInfo?.body;
    if (!body) return false;
    const translation = body.translation();
    const rotation = body.rotation();
    const dynamicPosition = new THREE.Vector3(translation.x, translation.y, translation.z);
    const dynamicRotation = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    this._configureRestoreTarget();
    if (!this._demoteFromInjuredBody()) return false;
    // The dynamic body's final pose is authoritative. Preserve both parts of
    // the pose before any navigation state is rebuilt from the new location.
    this._setRootWorldPosition(dynamicPosition);
    this._setRootWorldQuaternion(dynamicRotation);
    this._syncCollisionBody();
    this._desiredWorldPosition.copy(dynamicPosition);
    this._lastAppliedWorldPosition.copy(dynamicPosition);
    this._reportInjuryRecoveryDiagnostic('initial restoration position', {
      position: dynamicPosition.toArray(),
      rotation: dynamicRotation.toArray(),
    });
    this.verticalState = DRONE_VERTICAL_STATES.RESTORING;
    this.injuredRestoreElapsed = 0;
    this.groundSupported = false;
    this._verticalPlan = null;
    return true;
  }

  _finishInjuredRestoration() {
    this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
    this.injuredRestoreElapsed = 0;
    this.injuredRestoreDelayElapsed = 0;
    this.injuredSettleElapsed = 0;
    this._injuredSupport = null;
    this.root.getWorldPosition(this._worldPosition);
    const support = this._injuredGroundSupport();
    if (support) {
      this.virtualFeetWorld.set(this._worldPosition.x, support.elevation, this._worldPosition.z);
      this.groundElevation = support.elevation;
      this.groundNormal.copy(support.normal);
      this.groundSupported = true;
    } else {
      this._resetVerticalStateFromRoot();
    }
    this._reportInjuryRecoveryDiagnostic('final restored position', {
      position: this._worldPosition.toArray(),
      virtualFeet: this.virtualFeetWorld.toArray(),
    });
    this.detection?.reset();
    this._setState(DRONE_STATES.IDLE);
    this._prepareInjuryNavigationRecovery();
    if (this.navigationManager && this.config.navigationEnabled) {
      if (!this._beginLocalRecovery('injured restoration', { fromInjury: true })) {
        this._beginRecovery('injured restoration', true);
      }
    } else {
      // Without a navigation manager, remain at the recovered location. A
      // normal patrol update would otherwise consume stale path coordinates.
      this._setIdleGroundPointFromCurrentPosition();
    }
  }

  _updateInjuredRestoration(dt) {
    if (this.verticalState !== DRONE_VERTICAL_STATES.RESTORING) return;
    const support = this._injuredGroundSupport();
    if (!support) {
      this.verticalState = DRONE_VERTICAL_STATES.INJURED;
      this.injuredElapsed = 0;
      this.injuredSettleElapsed = 0;
      this._promoteToInjuredBody();
      return;
    }
    const current = this.root.getWorldPosition(this._worldPosition);
    const target = this._collisionDesiredCenterWorld.set(
      current.x,
      support.elevation + this.config.hoverHeight - this._neutralBaseWorldOffsetY,
      current.z,
    );
    const duration = Math.max(0.001, Number(this.config.injuredRestoreDuration) || 1.5);
    const alpha = THREE.MathUtils.clamp((Math.max(0, Number(dt) || 0)) / duration, 0, 1);
    const step = target.clone().sub(current).multiplyScalar(alpha);
    const query = this._computeDroneMovement(step, null);
    const accepted = this._constrainEnvironmentalMovement(step, query.movement);
    const upwardBlocked = step.y > 1e-5 && accepted.y < step.y - 1e-5;
    if (upwardBlocked) return;
    this._setRootWorldPosition(current.clone().add(accepted));
    this._syncCollisionBody();
    this.injuredRestoreElapsed += Math.max(0, Number(dt) || 0);
    const progress = THREE.MathUtils.clamp(this.injuredRestoreElapsed / duration, 0, 1);
    this.root.quaternion.slerp(this._restoreTargetLocalQuaternion, progress);
    const physical = this.collisionInfo.collider.translation();
    const targetPhysicalY = support.elevation
      + this.config.hoverHeight
      - this._neutralBaseWorldOffsetY
      + this._collisionOffsetLocal.y;
    const closeEnough = Math.abs(physical.y - targetPhysicalY) < 0.12;
    if (progress >= 1 && closeEnough) this._finishInjuredRestoration();
  }

  _setIdleGroundPointFromCurrentPosition() {
    this.root.getWorldPosition(this._worldPosition);
    this._idleGroundPoint.copy(this._worldPosition);
    this._idleGroundPoint.y = this.virtualFeetWorld.y;
    this._lastAppliedWorldPosition.copy(this._worldPosition);
  }

  _createGroundCastShape() {
    if (!this.physics?.RAPIER || this._groundCastShape) return;
    const radius = Math.max(0.01, Number(this.config.groundDetectionRadius) || 0.25);
    this._groundCastShape = this.physics.RAPIER.ColliderDesc.ball(radius).shape;
  }

  _groundQueryFilter(collider) {
    if (!collider || collider.isSensor?.()) return false;
    if (sameRapierCollider(collider, this.collisionInfo?.collider)) return false;
    const player = this.engine?.player;
    if (sameRapierCollider(collider, player?.collider)
      || sameRapierHandle(collider.parent?.(), player?.body)) return false;
    const mesh = this.physics?.meshFromColliderHandle?.(collider.handle);
    if (mesh?.userData?.noCollision || mesh?.userData?.noRender) return false;
    return true;
  }

  _queryGround(x, z, feetY, downwardDistance, upwardDistance = 0) {
    this._groundSupport = null;
    if (!this.config.groundDetectionEnabled || !this.physics?.world || !this._groundCastShape) return null;
    const radius = Math.max(0.01, Number(this.config.groundDetectionRadius) || 0.25);
    const up = Math.max(0, upwardDistance);
    const down = Math.max(0, downwardDistance);
    const maxToi = up + down;
    if (maxToi <= 1e-7) return null;

    this._groundCastStart.set(x, feetY + up + radius, z);
    const hit = this.physics.world.castShape(
      this._groundCastStart,
      this._groundCastRotation,
      this._groundCastDirection,
      this._groundCastShape,
      0,
      maxToi,
      true,
      this.physics.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      collider => this._groundQueryFilter(collider),
    );
    if (!hit?.collider || !hit.normal1 || hit.normal1.y < Math.cos(
      THREE.MathUtils.degToRad(Math.max(0, Number(this.config.maxGroundSlopeDegrees) || 50)),
    )) return null;

    const surfaceY = this._groundCastStart.y - hit.time_of_impact - radius;
    if (!Number.isFinite(surfaceY)
      || surfaceY > feetY + up + 1e-4
      || surfaceY < feetY - down - 1e-4) return null;

    this._groundSupport = {
      elevation: surfaceY,
      normal: new THREE.Vector3(hit.normal1.x, hit.normal1.y, hit.normal1.z).normalize(),
      collider: hit.collider,
      colliderHandle: hit.collider.handle,
      bodyHandle: hit.collider.parent?.()?.handle,
      distance: hit.time_of_impact,
    };
    return this._groundSupport;
  }

  _landingOffset() {
    if (this.verticalState !== DRONE_VERTICAL_STATES.LANDING) return 0;
    const duration = Math.max(1e-4, Number(this.config.landingBobDuration) || 0.4);
    const progress = THREE.MathUtils.clamp(this.landingElapsed / duration, 0, 1);
    return -this.landingAmplitude * Math.sin(progress * Math.PI * 2) * Math.exp(-2 * progress);
  }

  _verticalVisualOffset() {
    if (this.verticalState === DRONE_VERTICAL_STATES.FALLING) return 0;
    if (this.verticalState === DRONE_VERTICAL_STATES.LANDING) return this._landingOffset();
    if (!this.config.hoveringEnabled) return 0;
    return Math.sin(this.elapsed * Math.PI * 2 * this.config.bobbingFrequency)
      * this.config.bobbingAmplitude;
  }

  _groundProbeTarget(point) {
    const target = { x: point.x, z: point.z };
    if (!this.collisionInfo || !this._droneCharacterController) return target;
    this.root.getWorldPosition(this._worldPosition);
    const delta = new THREE.Vector3(point.x - this._worldPosition.x, 0, point.z - this._worldPosition.z);
    if (delta.lengthSq() <= 1e-12) return target;
    this._syncCollisionBody();
    const playerCollider = this.engine?.player?.collider ?? null;
    const environmental = this._computeDroneMovement(delta, playerCollider);
    const accepted = this._constrainEnvironmentalMovement(delta, environmental.movement);
    target.x = this._worldPosition.x + accepted.x;
    target.z = this._worldPosition.z + accepted.z;
    return target;
  }

  _physicalGroundTarget(rootTarget) {
    if (!this.collisionInfo?.collider) return rootTarget;
    this.root.getWorldPosition(this._worldPosition);
    const physical = this.collisionInfo.collider.translation();
    return {
      x: rootTarget.x + physical.x - this._worldPosition.x,
      z: rootTarget.z + physical.z - this._worldPosition.z,
    };
  }

  _updateVertical(dt, targetX, targetZ, referenceY) {
    const safeDt = Math.max(0, Number(dt) || 0);
    this._verticalLandedThisFrame = false;
    const currentFeetY = this.virtualFeetWorld.y;
    let feetY = currentFeetY;
    let support = null;
    const groundEnabled = Boolean(this.config.groundDetectionEnabled);
    const maxStepHeight = Math.max(0, Number(this.config.maxStepHeight) || 0.25);
    const snapDistance = Math.max(0, Number(this.config.groundSnapDistance) || 0.15);
    const gravity = Math.max(0, Number(this.config.gravity) || 9.81);
    const terminalFallSpeed = Math.max(0, Number(this.config.terminalFallSpeed) || 25);

    if (!groundEnabled) {
      this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
      this.groundSupported = true;
      this.verticalVelocity = 0;
      this.groundElevation = currentFeetY;
    } else if (this.verticalState === DRONE_VERTICAL_STATES.FALLING) {
      this.verticalVelocity = Math.max(
        this.verticalVelocity - gravity * safeDt,
        -terminalFallSpeed,
      );
      this.fallDuration += safeDt;
      const fallDistance = Math.max(snapDistance, -this.verticalVelocity * safeDt);
      support = this._queryGround(targetX, targetZ, currentFeetY, fallDistance, 0);
      if (support && this.verticalVelocity <= 0) {
        this._verticalLandedThisFrame = true;
        feetY = support.elevation;
        this.groundElevation = support.elevation;
        this.groundNormal.copy(support.normal);
        this.groundSupported = true;
        const impactSpeed = Math.abs(this.verticalVelocity);
        this.verticalVelocity = 0;
        if (impactSpeed >= Math.max(0, Number(this.config.landingImpactThreshold) || 0.5)) {
          this.verticalState = DRONE_VERTICAL_STATES.LANDING;
          this.landingElapsed = 0;
          this.landingAmplitude = Math.min(
            Math.max(0, Number(this.config.landingBobAmplitude) || 0.12),
            impactSpeed * Math.max(0, Number(this.config.landingImpactScale) || 0.08),
          );
        } else {
          this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
          this.landingAmplitude = 0;
        }
      } else {
        feetY = currentFeetY + this.verticalVelocity * safeDt;
        this.groundSupported = false;
      }
    } else {
      support = this._queryGround(targetX, targetZ, currentFeetY, snapDistance, maxStepHeight);
      if (!support) {
        this.verticalState = DRONE_VERTICAL_STATES.FALLING;
        this.verticalVelocity = 0;
        this.fallDuration = 0;
        this.groundSupported = false;
        this.landingElapsed = 0;
        this.landingAmplitude = 0;
        this.verticalVelocity = Math.max(this.verticalVelocity - gravity * safeDt, -terminalFallSpeed);
        this.fallDuration += safeDt;
        feetY = currentFeetY + this.verticalVelocity * safeDt;
      } else {
        const difference = support.elevation - currentFeetY;
        const followSpeed = Math.max(0, Number(this.config.groundFollowSpeed) || 4);
        const followAlpha = 1 - Math.exp(-followSpeed * safeDt);
        // Small upward steps need to be included in the same movement query
        // so the spherical controller can climb them instead of hitting the
        // vertical riser. Slopes and descents are smoothed independently.
        feetY = difference > 0 && difference <= maxStepHeight + 1e-4
          ? support.elevation
          : THREE.MathUtils.lerp(currentFeetY, support.elevation, followAlpha);
        if (Math.abs(feetY - support.elevation) < 1e-4) feetY = support.elevation;
        this.groundElevation = support.elevation;
        this.groundNormal.copy(support.normal);
        this.groundSupported = true;
        this.verticalVelocity = 0;
        this.fallDuration = 0;
        if (this.verticalState === DRONE_VERTICAL_STATES.LANDING) {
          this.landingElapsed += safeDt;
          if (this.landingElapsed >= Math.max(0, Number(this.config.landingBobDuration) || 0.4)) {
            this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
            this.landingAmplitude = 0;
            this.landingElapsed = 0;
          }
        } else {
          this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
        }
      }
    }

    this.virtualFeetWorld.y = feetY;
    this._verticalPlan = {
      feetY,
      referenceY,
      visualOffset: this._verticalVisualOffset(),
      supported: this.groundSupported,
      state: this.verticalState,
    };
    return this._verticalPlan;
  }

  _isDisplaced(threshold = this.config.displacementThreshold) {
    if (!this.root) return false;
    this.root.getWorldPosition(this._worldPosition);
    return Math.hypot(
      this._worldPosition.x - this._lastAppliedWorldPosition.x,
      this._worldPosition.z - this._lastAppliedWorldPosition.z,
    ) > Math.max(0, Number(threshold) || 0);
  }

  _isVerticallyDisplaced() {
    if (!this.root) return false;
    this.root.getWorldPosition(this._worldPosition);
    return Math.abs(this._worldPosition.y - this._lastAppliedWorldPosition.y)
      > Math.max(0, this.config.displacementThreshold);
  }

  _updatePushSpeed(dt) {
    const target = this._playerDisplacementActive
      ? THREE.MathUtils.clamp(Number(this.config.playerPushMovementMultiplier) || 0.8, 0, 1)
      : 1;
    const transition = Math.max(0, Number(this.config.playerPushSpeedTransition) || 0);
    if (transition <= 1e-6) this._pushSpeedScale = target;
    else this._pushSpeedScale = THREE.MathUtils.lerp(this._pushSpeedScale, target, Math.min(1, dt / transition));
  }

  _movementSpeed(baseSpeed, dt) {
    this._updatePushSpeed(dt);
    this._updateDynamicPushSpeed(dt);
    return Math.max(0, baseSpeed) * this._pushSpeedScale * this._dynamicPushSpeedScale;
  }

  _updateDynamicPushSpeed(dt, contacts = null, requestedDelta = null) {
    if (!this.config.dynamicObjectPushingEnabled) {
      this._dynamicPushTargetScale = 1;
    } else if (contacts) {
      let target = 1;
      const minMultiplier = THREE.MathUtils.clamp(
        Number(this.config.dynamicObjectMinMovementMultiplier) || 0.25, 0, 1,
      );
      const pushMass = Math.max(0, Number(this.config.dynamicObjectPushMass) || 0);
      const requestedLength = requestedDelta
        ? Math.hypot(requestedDelta.x, requestedDelta.z) : 0;
      for (const collision of contacts) {
        const body = collision?.collider?.parent?.();
        if (!body?.isDynamic?.()) continue;
        const normal = collision.normal1;
        if (!normal || Math.abs(normal.y) > 0.55 || requestedLength <= 1e-8) continue;
        const into = (-normal.x * requestedDelta.x - normal.z * requestedDelta.z) / requestedLength;
        if (into <= 0.05) continue;
        const mass = Math.max(0, Number(body.mass?.()) || 0);
        const ratio = pushMass > 0 ? pushMass / (pushMass + mass) : 0;
        target = Math.min(target, minMultiplier + (1 - minMultiplier) * ratio);
      }
      this._dynamicPushTargetScale = target;
    }
    const transition = Math.max(0, Number(this.config.dynamicObjectPushSpeedTransition) || 0);
    if (transition <= 1e-6) this._dynamicPushSpeedScale = this._dynamicPushTargetScale;
    else {
      this._dynamicPushSpeedScale = THREE.MathUtils.lerp(
        this._dynamicPushSpeedScale,
        this._dynamicPushTargetScale,
        Math.min(1, Math.max(0, Number(dt) || 0) / transition),
      );
    }
  }

  /**
   * Apply one bounded, timestep-scaled force to each contacted dynamic body.
   * The target mass is used only to select resistance; it is never multiplied
   * into the impulse to manufacture equal acceleration.
   */
  _pushDynamicObjects(collisions, requestedDelta, dt) {
    if (!this.config.dynamicObjectPushingEnabled || !this.physics?.RAPIER) return;
    const safeDt = Math.max(1 / 240, Number(dt) || 0);
    const pushMass = Math.max(0, Number(this.config.dynamicObjectPushMass) || 0);
    const maxForce = Math.max(0, Number(this.config.dynamicObjectMaxPushForce) || 0);
    if (pushMass <= 0 || maxForce <= 0) return;
    const requestedLength = Math.hypot(requestedDelta.x, requestedDelta.z);
    if (requestedLength <= 1e-8) return;
    const requestedDirection = new THREE.Vector3(
      requestedDelta.x / requestedLength, 0, requestedDelta.z / requestedLength,
    );

    const seen = new Set();
    for (const collision of collisions || []) {
      const collider = collision?.collider;
      const body = collider?.parent?.();
      if (!body?.isDynamic?.() || seen.has(body.handle)) continue;
      seen.add(body.handle);
      const normal = collision.normal1;
      if (!normal || Math.abs(normal.y) > 0.55) continue;

      // Rapier's normal1 points out of the contacted body in this query path.
      const direction = new THREE.Vector3(-normal.x, 0, -normal.z);
      if (direction.lengthSq() <= 1e-8) continue;
      direction.normalize();
      if (direction.dot(requestedDirection) <= 0.05) continue;

      const mass = Math.max(0, Number(body.mass?.()) || 0);
      const velocity = body.linvel?.() ?? { x: 0, y: 0, z: 0 };
      const outwardSpeed = velocity.x * direction.x + velocity.z * direction.z;
      const desiredSpeed = requestedLength / safeDt;
      const speedError = Math.max(0, desiredSpeed - outwardSpeed);
      if (speedError <= 1e-5) continue;

      // This is a real force over the frame, capped independently of target
      // mass. The target's actual mass remains in Rapier's impulse response.
      const force = Math.min(maxForce, pushMass * speedError);
      const impulse = force * safeDt;
      const impulseVector = {
        x: direction.x * impulse,
        y: 0,
        z: direction.z * impulse,
      };
      const point = collision.point1 || collision.point2 || body.translation?.();
      if (point && typeof body.applyImpulseAtPoint === 'function') {
        body.applyImpulseAtPoint(impulseVector, point, true);
      } else {
        body.applyImpulse?.(impulseVector, true);
      }
    }
  }

  _createCollisionBody(bounds) {
    if (!this.physics?.world || !this.physics.RAPIER || this.collisionInfo) return;
    const center = bounds
      ? bounds.min.clone().add(bounds.max).multiplyScalar(0.5)
      : new THREE.Vector3(0, 0, 0);
    this._collisionOffsetLocal.set(
      center.x * this.root.scale.x,
      center.y * this.root.scale.y,
      center.z * this.root.scale.z,
    );
    const collider = this.physics.RAPIER.ColliderDesc
      .ball(Math.max(0.05, Number(this.config.collisionRadius) || 0.45))
      .setTranslation(...this._collisionOffsetLocal.toArray());
    this.collisionInfo = this.physics.addKinematic(
      this.root,
      [{ desc: collider, sensor: false }],
      { worldSpace: true },
    );
    this._droneRadius = Number(this.collisionInfo.collider.shape?.radius) || 0;
    this._createGroundCastShape();
    this._droneCharacterController = this.physics.createCharacterController(this._droneControllerOffset);
    this._droneCharacterController.setSlideEnabled(true);
    // DroneA owns the only dynamic-body impulse path for this controller.
    // Keep Rapier's optional automatic kinematic push disabled if available.
    this._droneCharacterController.setApplyImpulsesToDynamicBodies?.(false);
    this._droneCharacterController.setMaxSlopeClimbAngle(Math.PI * 0.5);
    this._log('info', 'Drone collider created.');
    if (this.config.collisionDebug && this.root.parent) {
      this.collisionDebugRoot = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(this.config.collisionRadius, 16, 10)),
        new THREE.LineBasicMaterial({ color: 0xff3030 }),
      );
      this.collisionDebugRoot.position.copy(this._collisionOffsetLocal);
      this.root.add(this.collisionDebugRoot);
    }
  }

  _syncCollisionBody() {
    if (this.collisionInfo?.id !== undefined) this.physics?.syncKinematicTransform(this.collisionInfo.id, true);
  }

  _computeDroneMovement(delta, excludeCollider = null) {
    const predicate = excludeCollider
      ? collider => !sameRapierCollider(collider, excludeCollider)
      : undefined;
    this._droneCharacterController.computeColliderMovement(
      this.collisionInfo.collider,
      { x: delta.x, y: delta.y, z: delta.z },
      this.physics.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      predicate,
    );
    const collisions = Array.from({ length: this._droneCharacterController.numComputedCollisions() }, (_, i) =>
      this._droneCharacterController.computedCollision(i)
    ).filter(Boolean);
    return { movement: this._droneCharacterController.computedMovement(), collisions };
  }

  _constrainEnvironmentalMovement(requested, accepted) {
    const constrained = new THREE.Vector3(accepted.x, accepted.y, accepted.z);
    const requestedLength = Math.hypot(requested.x, requested.z);
    if (requestedLength > 1e-7) {
      const directionX = requested.x / requestedLength;
      const directionZ = requested.z / requestedLength;
      const along = constrained.x * directionX + constrained.z * directionZ;
      const forward = THREE.MathUtils.clamp(along, 0, requestedLength);
      // A wall may make Rapier return a tangential slide. DroneA must stay on
      // its authored route, so retain only the forward portion and reduce it
      // when the environment blocks advancement.
      constrained.x = directionX * forward;
      constrained.z = directionZ * forward;
    } else if (Math.abs(requested.y) > 1e-7) {
      const direction = Math.sign(requested.y);
      const along = constrained.y * direction;
      constrained.y = direction * THREE.MathUtils.clamp(along, 0, Math.abs(requested.y));
    }
    return constrained;
  }

  _playerCapsule(player) {
    const collider = player?.collider;
    const shape = collider?.shape;
    const radius = Number(shape?.radius);
    const halfHeight = Number(shape?.halfHeight);
    if (!collider || !Number.isFinite(radius) || !Number.isFinite(halfHeight)) return null;

    const translation = collider.translation();
    const rotation = collider.rotation();
    const axis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
      .normalize();
    const center = new THREE.Vector3(translation.x, translation.y, translation.z);
    return {
      collider,
      body: collider.parent?.(),
      center,
      axis,
      start: center.clone().addScaledVector(axis, -halfHeight),
      end: center.clone().addScaledVector(axis, halfHeight),
      radius,
      halfHeight,
    };
  }

  _sphereCapsuleDistance(sphereCenter, capsule, playerOffset = null) {
    const offset = playerOffset ?? new THREE.Vector3();
    const start = capsule.start.clone().add(offset);
    const end = capsule.end.clone().add(offset);
    const segment = end.clone().sub(start);
    const lengthSq = segment.lengthSq();
    const t = lengthSq > 1e-12
      ? THREE.MathUtils.clamp(sphereCenter.clone().sub(start).dot(segment) / lengthSq, 0, 1)
      : 0;
    const closest = start.clone().addScaledVector(segment, t);
    return {
      distance: sphereCenter.distanceTo(closest),
      closest,
    };
  }

  _collisionGeometry(player, capsule) {
    const playerOffset = Math.max(0, Number(player?.movementController?.characterControllerOffset) || 0);
    const droneRadius = Math.max(0, Number(this.collisionInfo?.collider?.shape?.radius) || this._droneRadius);
    const droneOffset = Math.max(0, Number(this._droneControllerOffset) || 0);
    return {
      droneRadius,
      playerRadius: capsule.radius,
      droneOffset,
      playerOffset,
      tolerance: 1e-4,
      clearance: droneRadius + capsule.radius + droneOffset + playerOffset + 1e-4,
    };
  }

  _publishPlayerContact(player, active, normal) {
    player?.movementController?.setDroneContact?.(active, normal);
  }

  _refreshPlayerContact() {
    const player = this.engine?.player;
    const capsule = this._playerCapsule(player);
    const sphere = this.collisionInfo?.collider;
    if (!player || !capsule || !sphere) {
      this._playerContactActive = false;
      this._playerDisplacementActive = false;
      this._playerSeparationSide = 0;
      this._playerContactNormal.set(0, 0, 0);
      this._publishPlayerContact(player, false, this._playerContactNormal);
      return false;
    }

    const translation = sphere.translation();
    const center = this._collisionCenterWorld.set(
      translation.x,
      translation.y,
      translation.z,
    );
    const geometry = this._collisionGeometry(player, capsule);
    const separation = this._sphereCapsuleDistance(center, capsule).distance;
    const tolerance = Math.max(
      0,
      Number(this.config.playerContactSeparationTolerance) || 0,
    );
    const active = separation <= geometry.clearance + tolerance;
    const wasActive = this._playerContactActive;
    this._playerContactActive = active;
    const currentNormal = this._playerContactCurrentNormal.set(
      capsule.center.x - center.x,
      0,
      capsule.center.z - center.z,
    );
    if (currentNormal.lengthSq() > 1e-10) currentNormal.normalize();
    else currentNormal.set(0, 0, 0);

    // During sustained inward input, retain the contact normal from the
    // beginning of that contact. The Rapier capsule controller can otherwise
    // turn a blocked inward request into a tangential slide; using that new
    // tangent as the next frame's normal lets the player keep walking around
    // the sphere instead of being filtered. As soon as the player stops
    // pressing inward, refresh the normal from the current world-space pose.
    const rawInput = player.movementController?.lastInputMovement;
    const holdingInward = wasActive
      && this._playerContactNormal.lengthSq() > 1e-10
      && rawInput
      && rawInput.dot(this._playerContactNormal) < -1e-4;
    if (active && (!holdingInward || this._playerContactNormal.lengthSq() <= 1e-10)) {
      this._playerContactNormal.copy(currentNormal);
    } else if (!active) {
      this._playerContactNormal.set(0, 0, 0);
      this._playerDisplacementActive = false;
      this._playerSeparationSide = 0;
    }
    this._publishPlayerContact(player, active, this._playerContactNormal);
    if (active && !wasActive) this._log('info', 'Pushing player.');
    if (!active && wasActive) this._log('info', 'Resumes movement.');
    return active;
  }

  _requiredPlayerPush(sphereCenter, capsule, clearance, direction) {
    const current = this._sphereCapsuleDistance(sphereCenter, capsule).distance;
    if (current >= clearance - 1e-7) return 0;

    const distanceAt = amount => this._sphereCapsuleDistance(
      sphereCenter,
      capsule,
      direction.clone().multiplyScalar(amount),
    ).distance;
    let high = Math.max(1, clearance + current);
    while (distanceAt(high) < clearance && high < 32) high *= 2;
    if (distanceAt(high) < clearance) return Infinity;
    let low = 0;
    for (let i = 0; i < 16; i++) {
      const middle = (low + high) * 0.5;
      if (distanceAt(middle) >= clearance) high = middle;
      else low = middle;
    }
    return high;
  }

  _isPlayerCollision(collision, player) {
    const collider = collision?.collider;
    if (!collider || !player) return false;
    return sameRapierCollider(collider, player.collider)
      || sameRapierHandle(collider.parent?.(), player.body);
  }

  _reportCollisionDiagnostics(data) {
    if (!this.config.collisionDebug || this.elapsed < this._collisionDiagnosticAt + 0.5) return;
    this._collisionDiagnosticAt = this.elapsed;
    this._log('info', '[collision]', data);
  }

  _horizontalSeparationDirection(sphereCenter, separation, capsule, fallback) {
    const direction = separation.closest.clone().sub(sphereCenter);
    direction.y = 0;
    if (direction.lengthSq() < 1e-10) {
      direction.copy(capsule.center).sub(sphereCenter);
      direction.y = 0;
    }
    if (direction.lengthSq() < 1e-10) direction.copy(fallback);
    if (direction.lengthSq() < 1e-10) direction.set(1, 0, 0);
    return direction.normalize();
  }

  _resolveCollision(startRoot, desiredRoot, dt = 0) {
    const delta = desiredRoot.clone().sub(startRoot);
    if (!this.collisionInfo || !this._droneCharacterController || delta.lengthSq() <= 1e-14) {
      this._playerDisplacementActive = false;
      return { position: desiredRoot, fraction: 1 };
    }
    this._syncCollisionBody();
    const player = this.engine?.player;
    const playerCapsule = this._playerCapsule(player);
    // Rapier is authoritative for the current collider pose. This avoids
    // confusing the visual origin, imported scale, or parent hierarchy with
    // the actual sphere center used by the collision query.
    const colliderPosition = this.collisionInfo.collider.translation();
    const startCenter = this._collisionCenterWorld.set(
      colliderPosition.x,
      colliderPosition.y,
      colliderPosition.z,
    );
    const playerCollider = playerCapsule?.collider ?? null;
    // The first query is environmental only. It must exclude the player, but
    // never DroneA's own collider, so Rapier can validate the authored motion
    // before either actor is committed.
    const environmentalQuery = this._computeDroneMovement(delta, playerCollider);
    // The character controller still resolves dynamic bodies as obstacles,
    // which preserves environmental safety. DroneA separately applies one
    // bounded physical impulse so the body can move on the next physics step.
    this._updateDynamicPushSpeed(dt, environmentalQuery.collisions, delta);
    this._pushDynamicObjects(environmentalQuery.collisions, delta, dt);
    const environmentalMovement = this._constrainEnvironmentalMovement(
      delta,
      environmentalQuery.movement,
    );
    const geometry = playerCapsule ? this._collisionGeometry(player, playerCapsule) : null;
    const horizontalDelta = new THREE.Vector3(delta.x, 0, delta.z);
    const intendedLength = horizontalDelta.length();
    const intendedDirection = intendedLength > 1e-7
      ? horizontalDelta.clone().normalize()
      : new THREE.Vector3();
    const currentSeparation = playerCapsule
      ? this._sphereCapsuleDistance(startCenter, playerCapsule)
      : null;
    const currentContact = !!playerCapsule && !!geometry
      && currentSeparation.distance <= geometry.clearance + geometry.tolerance;

    let selectedMovement = environmentalMovement.clone();
    let selectedPlayerQuery = null;
    let selectedPlayerRequested = new THREE.Vector3();
    let selectedPlayerAccepted = new THREE.Vector3();
    let selectedSeparation = null;
    let selectedPlayerContact = currentContact;
    let selectedSeparationSide = 0;

    const evaluateCandidate = scale => {
      const candidateMovement = environmentalMovement.clone().multiplyScalar(scale);
      const candidateCenter = startCenter.clone().add(candidateMovement);
      if (!playerCapsule || !geometry) {
        return {
          safe: true,
          movement: candidateMovement,
          playerQuery: null,
          playerRequested: new THREE.Vector3(),
          playerAccepted: new THREE.Vector3(),
          separation: null,
          playerContact: false,
          separationSide: 0,
        };
      }

      const separation = this._sphereCapsuleDistance(candidateCenter, playerCapsule);
      const playerContact = currentContact
        || separation.distance <= geometry.clearance + geometry.tolerance;
      const approaching = separation.distance < currentSeparation.distance - 1e-7;
      const candidateHasHorizontalMovement = candidateMovement.clone().setY(0).lengthSq() > 1e-12;
      const needsSeparation = candidateHasHorizontalMovement
        && approaching
        && separation.distance < geometry.clearance - geometry.tolerance;
      if (!needsSeparation) {
        return {
          safe: true,
          movement: candidateMovement,
          playerQuery: null,
          playerRequested: new THREE.Vector3(),
          playerAccepted: new THREE.Vector3(),
          separation: separation.distance,
          playerContact,
          separationSide: 0,
        };
      }

      if (!this.config.canPushPlayer) {
        return {
          safe: false,
          movement: candidateMovement,
          playerQuery: null,
          playerRequested: new THREE.Vector3(),
          playerAccepted: new THREE.Vector3(),
          separation: separation.distance,
          playerContact,
          separationSide: 0,
        };
      }

      const radialDirection = this._horizontalSeparationDirection(
        candidateCenter,
        separation,
        playerCapsule,
        intendedDirection,
      );
      const frontalContact = intendedLength > 1e-7
        && radialDirection.dot(intendedDirection) > 0.82;
      const lateralPreference = THREE.MathUtils.clamp(
        Number(this.config.playerLateralSeparationPreference) || 0,
        0,
        0.9,
      );
      const lateralAxis = new THREE.Vector3(
        -intendedDirection.z,
        0,
        intendedDirection.x,
      );
      const directionForSide = side => {
        if (!frontalContact || lateralPreference <= 1e-6) {
          return { direction: radialDirection.clone(), side: 0 };
        }
        const direction = radialDirection.clone().multiplyScalar(1 - lateralPreference)
          .addScaledVector(lateralAxis, side * lateralPreference);
        return {
          direction: direction.normalize(),
          side,
        };
      };
      const sideOrder = this._playerSeparationSide
        ? [this._playerSeparationSide, -this._playerSeparationSide]
        : [1, -1];
      const directions = frontalContact
        ? sideOrder.map(directionForSide).concat([{ direction: radialDirection.clone(), side: 0 }])
        : [{ direction: radialDirection.clone(), side: 0 }];

      const evaluateDirection = ({ direction, side }) => {
        const needed = this._requiredPlayerPush(
          candidateCenter,
          playerCapsule,
          geometry.clearance,
          direction,
        );
        if (!Number.isFinite(needed)) return null;
        const requested = direction.clone().multiplyScalar(
          needed * Math.max(0, Number(this.config.playerPushSpeedMultiplier) || 0),
        );
        const query = requested.lengthSq() > 1e-14
          ? player.movementController.computeExternalMovement(requested, {
            // The player may be pushed through DroneA's current pose; the
            // candidate drone pose is validated independently below.
            excludeCollider: this.collisionInfo.collider,
          })
          : { movement: new THREE.Vector3(), snapshot: null };
        const acceptedPlayer = query.movement;
        const postSeparation = this._sphereCapsuleDistance(
          candidateCenter,
          playerCapsule,
          acceptedPlayer,
        ).distance;
        return {
          safe: postSeparation >= geometry.clearance - geometry.tolerance,
          query,
          requested,
          accepted: acceptedPlayer,
          separation: postSeparation,
          side,
          needed,
        };
      };

      let chosen = null;
      if (frontalContact && this._playerSeparationSide) {
        chosen = evaluateDirection(directions[0]);
        if (!chosen?.safe) chosen = null;
      }
      if (!chosen && frontalContact) {
        const sideResults = directions
          .filter(candidate => candidate.side !== 0)
          .map(evaluateDirection)
          .filter(Boolean)
          .filter(result => result.safe);
        sideResults.sort((first, second) => first.needed - second.needed);
        chosen = sideResults[0] ?? null;
      }
      if (!chosen) chosen = evaluateDirection({ direction: radialDirection, side: 0 });
      if (!chosen) {
        return {
          safe: false,
          movement: candidateMovement,
          playerQuery: null,
          playerRequested: new THREE.Vector3(),
          playerAccepted: new THREE.Vector3(),
          separation: separation.distance,
          playerContact,
          separationSide: 0,
        };
      }
      return {
        safe: chosen.safe,
        movement: candidateMovement,
        playerQuery: chosen.query,
        playerRequested: chosen.requested,
        playerAccepted: chosen.accepted,
        separation: chosen.separation,
        playerContact,
        separationSide: chosen.side,
      };
    };

    let evaluation = evaluateCandidate(1);
    if (!evaluation.safe) {
      let low = 0;
      let high = 1;
      let best = null;
      for (let i = 0; i < 12; i++) {
        const middle = (low + high) * 0.5;
        const candidate = evaluateCandidate(middle);
        if (candidate.safe) {
          low = middle;
          best = candidate;
        } else high = middle;
      }
      evaluation = best ?? evaluateCandidate(0);
    }

    if (evaluation.safe) {
      selectedMovement = evaluation.movement;
      selectedPlayerQuery = evaluation.playerQuery;
      selectedPlayerRequested = evaluation.playerRequested;
      selectedPlayerAccepted = evaluation.playerAccepted;
      selectedSeparation = evaluation.separation;
      selectedPlayerContact = evaluation.playerContact;
      selectedSeparationSide = evaluation.separationSide;
    } else {
      selectedMovement.set(0, 0, 0);
      selectedSeparation = evaluation.separation;
      selectedPlayerContact = evaluation.playerContact;
      selectedSeparationSide = 0;
    }

    // Commit only after both character-controller queries have selected a
    // mutually safe pair of movements.
    if (selectedPlayerAccepted.lengthSq() > 1e-14) {
      if (typeof player.commitExternalMovement === 'function') {
        player.commitExternalMovement(selectedPlayerAccepted);
      } else {
        player.movementController.commitExternalMovement(selectedPlayerAccepted);
        player.cameraController?.applyToActor?.(player.body.translation());
      }
    }
    this._playerDisplacementActive = selectedPlayerAccepted.lengthSq() > 1e-14;
    if (selectedSeparationSide) this._playerSeparationSide = selectedSeparationSide;
    const accepted = new THREE.Vector3(
      startRoot.x + selectedMovement.x,
      startRoot.y + selectedMovement.y,
      startRoot.z + selectedMovement.z,
    );
    const horizontalLength = Math.hypot(delta.x, delta.z);
    const fraction = horizontalLength > 1e-7
      ? THREE.MathUtils.clamp(
        (selectedMovement.x * delta.x + selectedMovement.z * delta.z)
          / (horizontalLength * horizontalLength),
        0, 1,
      )
      : Math.abs(delta.y) > 1e-7
        ? THREE.MathUtils.clamp(selectedMovement.y / delta.y, 0, 1)
        : 1;
    const blocked = fraction < 0.999;
    if (blocked && !this._playerBlocked) this._log('info', 'Blocked by player or solid geometry.');
    if (!blocked && this._playerBlocked) this._log('info', 'Resumes movement.');
    this._playerBlocked = blocked;
    const finalContacts = [
      ...environmentalQuery.collisions.map(collision => ({
        handle: collision.collider?.handle,
        bodyHandle: collision.collider?.parent?.()?.handle,
        normal: collision.normal1
          ? [collision.normal1.x, collision.normal1.y, collision.normal1.z]
          : null,
      })),
      ...(selectedPlayerQuery?.snapshot?.contacts ?? []),
    ];
    this._reportCollisionDiagnostics({
      desiredDisplacement: delta.toArray(),
      acceptedDisplacement: selectedMovement.toArray(),
      requestedPlayerDisplacement: selectedPlayerRequested.toArray(),
      acceptedPlayerDisplacement: selectedPlayerAccepted.toArray(),
      playerInput: player?.movementController?.lastInputMovement?.toArray?.() ?? [0, 0, 0],
      correctedPlayerMovement: selectedPlayerQuery?.snapshot?.corrected ?? null,
      droneColliderHandle: this.collisionInfo.collider?.handle,
      droneBodyHandle: this.collisionInfo.body?.handle,
      playerColliderHandle: playerCapsule?.collider?.handle,
      playerBodyHandle: playerCapsule?.body?.handle,
      excludedColliderHandle: playerCollider?.handle,
      excludedBodyHandle: playerCapsule?.body?.handle,
      dimensions: geometry ? {
        droneRadius: geometry.droneRadius,
        playerRadius: geometry.playerRadius,
        playerHalfHeight: playerCapsule.halfHeight,
        droneControllerOffset: geometry.droneOffset,
        playerControllerOffset: geometry.playerOffset,
        requiredClearance: geometry.clearance,
      } : null,
      playerWorldPosition: playerCapsule?.center?.toArray?.() ?? null,
      blockingColliders: finalContacts,
      separation: selectedSeparation,
      reason: environmentalQuery.collisions.length > 0 && fraction < 0.999
        ? 'environment-blocked'
        : selectedPlayerContact && selectedPlayerAccepted.lengthSq() <= 1e-14
          ? 'player-displacement-blocked'
          : 'accepted',
    });
    return { position: accepted, fraction };
  }

  _advancePatrolDistance(distance, amount) {
    const next = distance + amount;
    return this.config.loopPath ? ((next % this.pathLength) + this.pathLength) % this.pathLength
      : THREE.MathUtils.clamp(next, 0, this.pathLength);
  }

  _nearestPatrolDistance(worldPosition) {
    if (!this._pathHorizontalSamples.length) return 0;
    let bestDistance = this._pathHorizontalSamples[0].distance;
    let bestDistanceSq = Infinity;
    for (const sample of this._pathHorizontalSamples) {
      const distanceSq = (sample.point.x - worldPosition.x) ** 2
        + (sample.point.z - worldPosition.z) ** 2;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestDistance = sample.distance;
      }
    }
    return bestDistance;
  }

  _distanceToPatrolPath(worldPosition) {
    if (!this._pathHorizontalSamples.length) return Infinity;
    let bestDistanceSq = Infinity;
    for (const sample of this._pathHorizontalSamples) {
      bestDistanceSq = Math.min(
        bestDistanceSq,
        (sample.point.x - worldPosition.x) ** 2
          + (sample.point.z - worldPosition.z) ** 2,
      );
    }
    return Math.sqrt(bestDistanceSq);
  }

  _clearNavigationRecoveryState() {
    this.recoveryRoute = null;
    this.recoveryDistances = null;
    this.recoveryDistance = 0;
    this.recoveryTargetIndex = -1;
    this.recoverySegmentIndex = 1;
    this.retryRecoveryAt = 0;
    this.recoveryStuckElapsed = 0;
    this.recoveryProgressReference = 0;
    this.recoveryStuckAttempts = 0;
    this._clearLocalRecovery();
    this._clearRecoveryDebug();
  }

  _reportInjuryRecoveryDiagnostic(event, data = {}) {
    if (!this.config.injuredDebug) return;
    this._log('info', `[injured] ${event}`, data);
  }

  _prepareInjuryNavigationRecovery() {
    this.root.getWorldPosition(this._injuryRecoveryAnchor);
    this._lastAppliedWorldPosition.copy(this._injuryRecoveryAnchor);
    this._idleGroundPoint.set(
      this.virtualFeetWorld.x,
      this.virtualFeetWorld.y,
      this.virtualFeetWorld.z,
    );
    this._desiredWorldPosition.copy(this._injuryRecoveryAnchor);
    this.distance = this._nearestPatrolDistance(this.virtualFeetWorld);
    this._clearNavigationRecoveryState();
    this._injuryRecoveryFirstMovementReported = false;
    this._reportInjuryRecoveryDiagnostic('navigation recovery start', {
      position: this._injuryRecoveryAnchor.toArray(),
      virtualFeet: this.virtualFeetWorld.toArray(),
      nearestPatrolDistance: this.distance,
    });
  }

  _clearLocalRecovery() {
    this.localRecoveryPath = null;
    this.localRecoverySamples = [];
    this.localRecoveryLength = 0;
    this.localRecoveryDistance = 0;
    this.localRecoveryTargetDistance = 0;
    this._clearLocalRecoveryDebug();
  }

  _clearLocalRecoveryDebug() {
    this.localRecoveryDebugRoot?.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
    this.localRecoveryDebugRoot?.removeFromParent();
    this.localRecoveryDebugRoot = null;
  }

  _beginLocalRecovery(reason, { fromInjury = false } = {}) {
    if (!this.navigationManager || !this.config.localRecoveryEnabled || !this.pathLength) return false;
    this.root.getWorldPosition(this._worldPosition);
    const displacement = fromInjury
      ? this._distanceToPatrolPath(this._worldPosition)
      : Math.hypot(
        this._worldPosition.x - this._lastAppliedWorldPosition.x,
        this._worldPosition.z - this._lastAppliedWorldPosition.z,
      );
    if (displacement > this.config.localRecoveryDistance) {
      this._log('info', 'Local recovery fallback:', { reason, displacement, cause: 'distance' });
      return false;
    }

    const targetDistance = this._advancePatrolDistance(this.distance, Math.max(0, this.config.localRecoveryLookAhead));
    const target = this._patrolPointAtDistance(targetDistance, new THREE.Vector3());
    const start = this._worldPosition.clone();
    start.y = this.virtualFeetWorld.y;
    const startTangent = this._patrolTangentAtDistance(this.distance, new THREE.Vector3());
    startTangent.y = 0;
    if (startTangent.lengthSq() > 1e-8) startTangent.normalize();
    const targetTangent = this._patrolTangentAtDistance(targetDistance, new THREE.Vector3());
    targetTangent.y = 0;
    if (targetTangent.lengthSq() > 1e-8) targetTangent.normalize();
    const span = Math.max(start.distanceTo(target), this.config.localRecoveryLookAhead);
    const control = start.clone().addScaledVector(startTangent, span * 0.5)
      .add(target.clone().addScaledVector(targetTangent, -span * 0.5)).multiplyScalar(0.5);
    const curved = new THREE.QuadraticBezierCurve3(start, control, target);
    curved.arcLengthDivisions = 64;
    const direct = new THREE.LineCurve3(start, target);
    direct.arcLengthDivisions = 32;
    const selected = this.navigationManager.isRouteNavigable(curved, 32) ? curved
      : this.navigationManager.isRouteNavigable(direct, 16) ? direct : null;
    if (!selected) {
      this._log('info', 'Local recovery fallback:', { reason, displacement, cause: 'route-invalid' });
      return false;
    }

    this._clearLocalRecovery();
    this.localRecoveryPath = selected;
    const localLookup = this._buildHorizontalCurveLookup(selected, 64);
    this.localRecoverySamples = localLookup.samples;
    this.localRecoveryLength = localLookup.length;
    this.localRecoveryDistance = 0;
    this.localRecoveryTargetDistance = targetDistance;
    this._setState(DRONE_STATES.LOCAL_RECOVER);
    this._log('info', 'Local recovery selected:', {
      reason,
      displacement,
      targetDistance,
      routeLength: this.localRecoveryLength,
    });
    this._updateLocalRecoveryDebug(target);
    return true;
  }

  _updateLocalRecoveryDebug(target) {
    if (!this.config.navigationDebug || !this.root?.parent || !this.localRecoveryPath) return;
    this._clearLocalRecoveryDebug();
    this.localRecoveryDebugRoot = new THREE.Group();
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(this.localRecoveryPath.getPoints(24)),
      new THREE.LineBasicMaterial({ color: 0x308cff }),
    );
    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    targetMarker.position.copy(target);
    this.localRecoveryDebugRoot.add(line, targetMarker);
    this.root.parent.add(this.localRecoveryDebugRoot);
  }

  _updateLocalRecovery(dt) {
    if (!this.localRecoveryPath || this.localRecoveryLength <= 1e-6) {
      this._clearLocalRecovery();
      this._setState(DRONE_STATES.PATROL);
      return;
    }
    const previousDistance = this.localRecoveryDistance;
    const attemptedDistance = dt * this._movementSpeed(this.config.localRecoverySpeed, dt);
    this.localRecoveryDistance = Math.min(
      this.localRecoveryLength,
      this.localRecoveryDistance + attemptedDistance,
    );
    this._sampleHorizontalLookup(
      { samples: this.localRecoverySamples, length: this.localRecoveryLength },
      this.localRecoveryDistance,
      this._recoverySample,
    );
    const point = this._recoverySample;
    const acceptedFraction = this._applyPosition(point, dt);
    if (acceptedFraction < 1) this.localRecoveryDistance = previousDistance + attemptedDistance * acceptedFraction;
    if (!this._injuryRecoveryFirstMovementReported && this.localRecoveryDistance > 1e-6) {
      this._injuryRecoveryFirstMovementReported = true;
      this._reportInjuryRecoveryDiagnostic('first accepted recovery movement', {
        position: this.root.getWorldPosition(new THREE.Vector3()).toArray(),
        distance: this.localRecoveryDistance,
      });
    }
    this._sampleHorizontalLookup(
      { samples: this.localRecoverySamples, length: this.localRecoveryLength },
      Math.min(this.localRecoveryLength, this.localRecoveryDistance + 0.05),
      this._recoveryLookahead,
    );
    const lookAhead = this._recoveryLookahead;
    this._faceDirection(lookAhead.clone().sub(point), dt);
    if (this.directionArrow) this.directionArrow.position.copy(this._worldPosition);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
    if (this.localRecoveryDistance >= this.localRecoveryLength - this.config.localRecoveryArrivalTolerance) {
      this.distance = this.localRecoveryTargetDistance;
      this._clearLocalRecovery();
      this._setState(DRONE_STATES.PATROL);
      this.root.getWorldPosition(this._lastAppliedWorldPosition);
      this._log('info', 'Successful local recovery.');
    }
  }

  _patrolDistanceForWaypoint(index) {
    if (!this.path || !this.points[index]) return 0;
    let bestDistanceAlongPath = 0;
    let bestDistance = Infinity;
    for (const sample of this._pathHorizontalSamples) {
      const distance = (sample.point.x - this.points[index].x) ** 2
        + (sample.point.z - this.points[index].z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestDistanceAlongPath = sample.distance;
      }
    }
    return bestDistanceAlongPath;
  }

  _beginRecovery(reason, force = false) {
    if (!this.navigationManager || !this.valid) return false;
    if (!force && this.elapsed < this.lastRecoveryAt + Math.max(0, this.config.repathCooldown)) {
      this.recoveryRoute = null;
      this._setState(DRONE_STATES.IDLE);
      this.retryRecoveryAt = this.lastRecoveryAt + Math.max(0, this.config.repathCooldown);
      return false;
    }

    this.root.getWorldPosition(this._worldPosition);
    this._worldPosition.y = this.virtualFeetWorld.y;
    const lockedIndex = this.state === DRONE_STATES.RECOVER ? this.recoveryTargetIndex : -1;
    const indices = lockedIndex >= 0
      ? [lockedIndex, ...this.points.map((_, index) => index).filter(index => index !== lockedIndex)]
      : this.points.map((_, index) => index);
    const candidates = [];
    for (const index of indices) {
      const candidate = { point: this.points[index], index };
      const route = this.navigationManager.findPath(this._worldPosition, candidate.point);
      if (!route) continue;
      let length = 0;
      for (let i = 1; i < route.length; i++) {
        length += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
      }
      if (lockedIndex === index && route.length >= 2) {
        this._commitRecoveryRoute({ ...candidate, route, length }, reason, true);
        return true;
      }
      if (route.length < 2) {
        if (this._worldPosition.distanceTo(candidate.point) <= Math.max(0, this.config.waypointArrivalTolerance)) {
          candidates.push({ ...candidate, route, length: 0 });
        }
        continue;
      }
      candidates.push({ ...candidate, route, length });
    }

    if (candidates.length) {
      const shortest = candidates.reduce((best, candidate) => {
        const equalLength = Math.abs(candidate.length - best.length) <= 1e-4;
        const lowerSuffix = (this.waypoints[candidate.index]?.index ?? candidate.index)
          < (this.waypoints[best.index]?.index ?? best.index);
        return candidate.length < best.length - 1e-4 || equalLength && lowerSuffix ? candidate : best;
      });
      this._commitRecoveryRoute(shortest, reason, lockedIndex >= 0 && shortest.index === lockedIndex);
      return true;
    }

    this._log('warn', 'No reachable patrol waypoint found.', { reason });
    this._enterStranded(reason);
    return false;
  }

  _enterStranded(reason) {
    this.recoveryRoute = null;
    this.recoveryDistances = null;
    this.recoveryDistance = 0;
    this.recoveryTargetIndex = -1;
    this.recoverySegmentIndex = 1;
    this._clearLocalRecovery();
    this._setIdleGroundPointFromCurrentPosition();
    this.strandedRetryElapsed = 0;
    this.recoveryStuckElapsed = 0;
    this.recoveryProgressReference = 0;
    this.recoveryStuckAttempts = 0;
    this._setState(DRONE_STATES.STRANDED);
    this._log('warn', 'Entered stranded state; scanning for the player.', { reason });
  }

  _commitRecoveryRoute(candidate, reason, destinationWasLocked = false) {
    const previousTargetIndex = this.recoveryTargetIndex;
    this.recoveryRoute = candidate.route;
    this.recoveryDistances = [0];
    for (let i = 1; i < candidate.route.length; i++) {
      this.recoveryDistances.push(
        this.recoveryDistances[i - 1]
        + Math.hypot(
          candidate.route[i].x - candidate.route[i - 1].x,
          candidate.route[i].z - candidate.route[i - 1].z,
        ),
      );
    }
    this.recoveryDistance = 0;
    this.recoverySegmentIndex = 1;
    this.recoveryStuckElapsed = 0;
    this.recoveryProgressReference = 0;
    const destinationChanged = previousTargetIndex >= 0 && previousTargetIndex !== candidate.index;
    this.recoveryTargetIndex = candidate.index;
    this.lastRecoveryAt = this.elapsed;
    this.retryRecoveryAt = 0;
    this.recoveryDestinationSelections += 1;
    this.recoveryRouteCalculations += 1;
    if (reason !== 'initial spawn') this.recoveryRecalculations += 1;
    this._setState(DRONE_STATES.RECOVER);
    this._log('info', 'Selected recovery waypoint:', this.waypoints[candidate.index]?.name ?? candidate.index);
    if (destinationChanged) this._log('info', 'Recovery destination changed:', {
      previous: this.waypoints[previousTargetIndex]?.name,
      next: this.waypoints[candidate.index]?.name,
    });
    this._log('info', 'Recovery route calculated:', {
      reason, locked: destinationWasLocked, points: candidate.route.length,
      distance: this.recoveryDistances[this.recoveryDistances.length - 1],
      routeCalculations: this.recoveryRouteCalculations,
    });
    this._reportInjuryRecoveryDiagnostic('selected recovery route', {
      waypoint: this.waypoints[candidate.index]?.name ?? candidate.index,
      routeLength: this.recoveryDistances[this.recoveryDistances.length - 1],
      points: candidate.route.length,
    });
    this._updateRecoveryDebug();
  }

  _sampleRecoveryRoute(distance, target, advanceSegment = true) {
    if (!this.recoveryRoute?.length || !this.recoveryDistances?.length) return null;
    const total = this.recoveryDistances[this.recoveryDistances.length - 1];
    if (total <= 1e-6) return target.copy(this.recoveryRoute[this.recoveryRoute.length - 1]);
    const clamped = THREE.MathUtils.clamp(distance, 0, total);
    let segment = Math.max(1, this.recoverySegmentIndex);
    while (segment < this.recoveryDistances.length && this.recoveryDistances[segment] < clamped) segment++;
    const startDistance = this.recoveryDistances[segment - 1];
    const span = this.recoveryDistances[segment] - startDistance;
    if (advanceSegment) this.recoverySegmentIndex = segment;
    return target.copy(this.recoveryRoute[segment - 1]).lerp(
      this.recoveryRoute[segment], span > 1e-6 ? (clamped - startDistance) / span : 0,
    );
  }

  _updateRecoveryDebug() {
    if (!this.config.navigationDebug || !this.root?.parent || !this.recoveryRoute) return;
    this._clearRecoveryDebug();
    this.recoveryDebugRoot = new THREE.Group();
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.recoveryRoute), new THREE.LineBasicMaterial({ color: 0xff8c00 }));
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    target.position.copy(this.recoveryRoute[this.recoveryRoute.length - 1]);
    this.recoveryDebugRoot.add(line, target);
    this.root.parent.add(this.recoveryDebugRoot);
  }

  _clearRecoveryDebug() {
    this.recoveryDebugRoot?.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
    this.recoveryDebugRoot?.removeFromParent();
    this.recoveryDebugRoot = null;
  }

  _finishRecovery() {
    const targetIndex = this.recoveryTargetIndex;
    this._setState(DRONE_STATES.PATROL);
    this.distance = this._patrolDistanceForWaypoint(targetIndex);
    this.recoveryRoute = null;
    this.recoveryDistances = null;
    this.recoveryTargetIndex = -1;
    this._clearRecoveryDebug();
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
    this._log('info', 'Successful return to patrol.');
  }

  _updateRecovery(dt) {
    const total = this.recoveryDistances?.[this.recoveryDistances.length - 1] ?? 0;
    if (!this.recoveryRoute || total <= 1e-6) return this._finishRecovery();
    const previousDistance = this.recoveryDistance;
    const attemptedDistance = dt * this._movementSpeed(this.config.recoverySpeed, dt);
    this.recoveryDistance = Math.min(total, this.recoveryDistance + attemptedDistance);
    const previousSegment = this.recoverySegmentIndex;
    this._sampleRecoveryRoute(this.recoveryDistance, this._recoverySample);
    if (this.recoverySegmentIndex !== previousSegment) this._log('info', 'Recovery segment:', this.recoverySegmentIndex);
    const acceptedFraction = this._applyPosition(this._recoverySample, dt);
    if (acceptedFraction < 1) this.recoveryDistance = previousDistance + attemptedDistance * acceptedFraction;
    const minimumProgress = Math.max(0, Number(this.config.recoveryMinimumProgress) || 0.1);
    if (this.recoveryDistance - this.recoveryProgressReference >= minimumProgress) {
      this.recoveryProgressReference = this.recoveryDistance;
      this.recoveryStuckElapsed = 0;
      this.recoveryStuckAttempts = 0;
    } else {
      this.recoveryStuckElapsed += Math.max(0, Number(dt) || 0);
    }
    if (this.recoveryStuckElapsed >= Math.max(0, Number(this.config.recoveryStuckTimeout) || 5)) {
      this.recoveryStuckAttempts += 1;
      if (this.recoveryStuckAttempts >= 3 || !this._beginRecovery('recovery route physically blocked', true)) return;
      return;
    }
    if (!this._injuryRecoveryFirstMovementReported && this.recoveryDistance > 1e-6) {
      this._injuryRecoveryFirstMovementReported = true;
      this._reportInjuryRecoveryDiagnostic('first accepted recovery movement', {
        position: this.root.getWorldPosition(new THREE.Vector3()).toArray(),
        distance: this.recoveryDistance,
      });
    }
    this._sampleRecoveryRoute(Math.min(total, this.recoveryDistance + 0.05), this._recoveryLookahead, false);
    this._faceDirection(this._recoveryLookahead.clone().sub(this._recoverySample), dt);
    if (this.directionArrow) this.directionArrow.position.copy(this._worldPosition);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
    if (this.recoveryDistance >= total - Math.max(0, this.config.waypointArrivalTolerance)) this._finishRecovery();
  }

  _createGroundDebugVisualization() {
    if (this._groundDebugRoot || !this.root?.parent) return;
    const root = new THREE.Group();
    root.name = 'DroneA_GroundDebug';

    this._groundDebugFeet = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 6),
      new THREE.MeshBasicMaterial({ color: 0x2cff57 }),
    );
    this._groundDebugSupport = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd21f }),
    );
    this._groundDebugCast = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.01, Number(this.config.groundDetectionRadius) || 0.25), 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x287bff, wireframe: true }),
    );
    const lineGeometry = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(6), 3),
    );
    this._groundDebugLine = new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0x24e8ff }),
    );
    this._groundDebugNormal = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      0.5,
      0x24e8ff,
    );
    root.add(
      this._groundDebugFeet,
      this._groundDebugSupport,
      this._groundDebugCast,
      this._groundDebugLine,
      this._groundDebugNormal,
    );

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      label.scale.set(1.8, 0.34, 1);
      label.userData.canvas = canvas;
      label.userData.texture = texture;
      this._groundDebugLabel = label;
      root.add(label);
    }
    this.root.parent.add(root);
    this._groundDebugRoot = root;
    this._updateGroundDebug();
  }

  _updateGroundDebug() {
    if (!this._groundDebugRoot) return;
    const feet = this.virtualFeetWorld;
    this._groundDebugFeet.position.copy(feet);
    this._groundDebugFeet.material.color.set(
      this.verticalState === DRONE_VERTICAL_STATES.FALLING ? 0xff3030 : 0x2cff57,
    );
    this._groundDebugSupport.visible = Boolean(this._groundSupport);
    this._groundDebugNormal.visible = Boolean(this._groundSupport);
    if (this._groundSupport) {
      this._groundDebugSupport.position.set(feet.x, this._groundSupport.elevation, feet.z);
      this._groundDebugNormal.position.copy(this._groundDebugSupport.position);
      this._groundDebugNormal.setDirection(this._groundSupport.normal);
    }
    this._groundDebugCast.position.copy(this._groundCastStart);
    const positions = this._groundDebugLine.geometry.getAttribute('position');
    positions.setXYZ(0, feet.x, feet.y, feet.z);
    positions.setXYZ(1, feet.x, feet.y + this.config.hoverHeight, feet.z);
    positions.needsUpdate = true;
    this._groundDebugRoot.userData.verticalState = this.verticalState;
    this._groundDebugRoot.userData.verticalVelocity = this.verticalVelocity;
    this._groundDebugRoot.userData.groundElevation = this.groundElevation;

    if (this._groundDebugLabel && this.elapsed >= this._groundDebugLastLabelAt + 0.1) {
      const label = this._groundDebugLabel;
      const canvas = label.userData.canvas;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = 'bold 30px monospace';
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#08202b';
      context.lineWidth = 8;
      const injured = this.config.injuredDebug && this._isInjuredState()
        ? this.getInjuredDebugState()
        : null;
      const text = injured
        ? `${injured.verticalState}  v=${Math.hypot(...injured.linearVelocity).toFixed(2)} w=${Math.hypot(...injured.angularVelocity).toFixed(2)} r=${Math.min(1, injured.restorationProgress).toFixed(2)}`
        : `${this.verticalState}  vy=${this.verticalVelocity.toFixed(2)}`;
      context.strokeText(text, 8, 36);
      context.fillText(text, 8, 36);
      label.position.set(feet.x, feet.y + this.config.hoverHeight + 0.55, feet.z);
      label.userData.texture.needsUpdate = true;
      this._groundDebugLastLabel = text;
      this._groundDebugLastLabelAt = this.elapsed;
    }
  }

  setGroundDebug(enabled) {
    this.config.groundDebug = Boolean(enabled);
    if (this.config.groundDebug) {
      this._createGroundDebugVisualization();
      this._updateGroundDebug();
    } else if (this._groundDebugRoot) {
      this._groundDebugRoot.traverse(object => {
        object.geometry?.dispose?.();
        object.material?.map?.dispose?.();
        object.material?.dispose?.();
      });
      this._groundDebugRoot.removeFromParent();
      this._groundDebugRoot = null;
      this._groundDebugFeet = null;
      this._groundDebugSupport = null;
      this._groundDebugCast = null;
      this._groundDebugLine = null;
      this._groundDebugNormal = null;
      this._groundDebugLabel = null;
    }
  }

  toggleGroundDebug() { this.setGroundDebug(!this.config.groundDebug); }

  start() { this.moving = true; }
  stop() { this.moving = false; }

  getNavigationState() { return this.state; }
  getVerticalState() { return this.verticalState; }
  getInjuredDebugState() {
    const body = this._injuredBody();
    const linear = body?.linvel?.() ?? { x: 0, y: 0, z: 0 };
    const angular = body?.angvel?.() ?? { x: 0, y: 0, z: 0 };
    return {
      droneId: this.droneId,
      verticalState: this.verticalState,
      rigidBodyType: body?.bodyType?.()?.toString?.() ?? 'unknown',
      linearVelocity: [linear.x, linear.y, linear.z],
      angularVelocity: [angular.x, angular.y, angular.z],
      settlingTime: this.injuredSettleElapsed,
      restorationProgress: this.injuredRestoreElapsed
        / Math.max(0.001, Number(this.config.injuredRestoreDuration) || 1.5),
      playerDetectionEnabled: !this._isInjuredState() && this.config.playerDetectionEnabled,
    };
  }
  forceRecover() { return this._beginRecovery('manual request', true); }
  displaceTo(worldPosition) {
    const position = worldPosition?.isVector3 ? worldPosition : new THREE.Vector3().fromArray(worldPosition);
    this._setRootWorldPosition(position);
    this._resetVerticalStateFromRoot();
  }
  setNavigationDebug(enabled) {
    this.config.navigationDebug = Boolean(enabled);
    this.navigationManager?.setDebugEnabled(this.config.navigationDebug);
    if (this.config.navigationDebug) {
      if (!this.debugRoot) this._createDebugVisualization();
      this._updateRecoveryDebug();
    } else {
      this._clearRecoveryDebug();
      this._clearLocalRecoveryDebug();
      if (!this.config.debug) {
        this.debugRoot?.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
        this.debugRoot?.removeFromParent();
        this.debugRoot = null;
        this.directionArrow = null;
      }
    }
  }
  toggleNavigationDebug() { this.setNavigationDebug(!this.config.navigationDebug); }

  setCollisionDebug(enabled) {
    this.config.collisionDebug = Boolean(enabled);
    if (this.config.collisionDebug && !this.collisionDebugRoot && this.root?.parent) {
      this.collisionDebugRoot = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(this.config.collisionRadius, 16, 10)),
        new THREE.LineBasicMaterial({ color: 0xff3030 }),
      );
      this.collisionDebugRoot.position.copy(this._collisionOffsetLocal);
      this.root.add(this.collisionDebugRoot);
    } else if (!this.config.collisionDebug && this.collisionDebugRoot) {
      this.collisionDebugRoot.geometry?.dispose?.();
      this.collisionDebugRoot.material?.dispose?.();
      this.collisionDebugRoot.removeFromParent();
      this.collisionDebugRoot = null;
    }
  }

  toggleCollisionDebug() { this.setCollisionDebug(!this.config.collisionDebug); }

  getDetectionState() { return this.detection?.detectionState ?? DRONE_DETECTION_STATES.UNAWARE; }
  getDetectionVisibleRatio() { return this.detection?.visibleRatio ?? 0; }
  setDetectionDebug(enabled) { this.detection?.setDebug(enabled); }
  toggleDetectionDebug() { this.detection?.toggleDebug(); }

  reset() {
    this.endCaughtSequence();
    if (this._isInjuredState()) {
      this._demoteFromInjuredBody();
      this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
      this.injuredElapsed = 0;
      this.injuredSettleElapsed = 0;
      this.injuredRestoreDelayElapsed = 0;
      this.injuredRestoreElapsed = 0;
    }
    this.distance = 0;
    this.elapsed = 0;
    this.detection?.reset();
    this.recoveryRoute = null;
    this.recoveryDistances = null;
    this.strandedRetryElapsed = 0;
    this.recoveryStuckElapsed = 0;
    this.recoveryProgressReference = 0;
    this.recoveryStuckAttempts = 0;
    this._clearLocalRecovery();
    this._clearRecoveryDebug();
    if (!this.valid) return;
    this._resetVerticalStateFromRoot();
    const point = this._patrolPointAtDistance(0, new THREE.Vector3());
    this._applyPosition(point, 0, { reset: true });
    // Reset is an explicit repositioning operation, so the initial heading
    // should be correct immediately rather than easing from the old heading.
    this._faceDirection(this._patrolTangentAtDistance(0, new THREE.Vector3()), 0, true);
    this._setState(DRONE_STATES.PATROL);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
  }

  _applyPosition(point, dt = 0, { reset = false } = {}) {
    const groundTarget = this._groundProbeTarget(point);
    const physicalGroundTarget = this._physicalGroundTarget(groundTarget);
    if (reset) {
      this.virtualFeetWorld.x = point.x;
      this.virtualFeetWorld.z = point.z;
      this.groundElevation = this.virtualFeetWorld.y;
      this.groundSupported = false;
      this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
      this.verticalVelocity = 0;
      this._verticalPlan = {
        feetY: this.virtualFeetWorld.y,
        referenceY: point.y,
        visualOffset: 0,
        supported: false,
        state: this.verticalState,
      };
    } else {
      this._updateVertical(dt, physicalGroundTarget.x, physicalGroundTarget.z, point.y);
    }
    const plan = this._verticalPlan ?? this._updateVertical(
      dt,
      physicalGroundTarget.x,
      physicalGroundTarget.z,
      point.y,
    );
    this._desiredWorldPosition.set(
      point.x,
      plan.feetY + this.config.hoverHeight + plan.visualOffset - this._neutralBaseWorldOffsetY,
      point.z,
    );
    this.root.getWorldPosition(this._worldPosition);
    const resolved = this._resolveCollision(this._worldPosition, this._desiredWorldPosition, dt);
    this._setRootWorldPosition(resolved.position);
    this._syncCollisionBody();
    this._refreshPlayerContact();
    this.root.getWorldPosition(this._worldPosition);
    const physicalPosition = this.collisionInfo?.collider?.translation?.();
    this.virtualFeetWorld.set(
      physicalPosition?.x ?? this._worldPosition.x,
      this._worldPosition.y + this._neutralBaseWorldOffsetY
        - this.config.hoverHeight - plan.visualOffset,
      physicalPosition?.z ?? this._worldPosition.z,
    );
    if (this._verticalLandedThisFrame
      && this.navigationManager
      && this.config.navigationEnabled
      && !this.navigationManager.isPositionNavigable?.(this.virtualFeetWorld)) {
      this._beginRecovery('post-landing outside NavMesh', true);
    }
    this._updateGroundDebug();
    return resolved.fraction;
  }

  _faceDirection(direction, dt, snap = false, rotationSpeed = this.config.rotationSpeed) {
    const horizontal = new THREE.Vector3(direction.x, 0, direction.z);
    if (horizontal.lengthSq() < 1e-8) return;
    horizontal.normalize();
    // Three.js yaw rotates the local +Z axis as (sin(yaw), 0, cos(yaw)).
    // The imported DroneA mesh was inspected and is authored facing +Z, so
    // there is no implicit 180-degree -Z correction here.
    const desiredYaw = Math.atan2(horizontal.x, horizontal.z) + this.config.forwardYawOffset;
    const worldTarget = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      desiredYaw,
    );
    // The path is in world space. Convert the world-facing target into the
    // drone parent's local space so rotated/scaled stage parents are handled.
    if (this.root.parent) {
      const parentWorld = this.root.parent.getWorldQuaternion(new THREE.Quaternion());
      this._targetQuaternion.copy(parentWorld).invert().multiply(worldTarget);
    } else {
      this._targetQuaternion.copy(worldTarget);
    }
    const amount = 1 - Math.exp(-Math.max(0, dt) * Math.max(0, Number(rotationSpeed) || 0));
    if (snap) this.root.quaternion.copy(this._targetQuaternion);
    else this.root.quaternion.slerp(this._targetQuaternion, amount);
    this.directionArrow?.setDirection(horizontal);
  }

  _rotateWorldYaw(angle) {
    if (!this.root || !Number.isFinite(angle) || Math.abs(angle) <= 1e-8) return;
    this.root.getWorldQuaternion(this._rootWorldQuaternion);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this._rootWorldQuaternion.premultiply(yaw);
    this._setRootWorldQuaternion(this._rootWorldQuaternion);
  }

  beginCaughtSequence() {
    if (this._isInjuredState() || this.caughtSequenceActive) return false;
    this.caughtSequenceActive = true;
    this._caughtMovementBefore = this.moving;
    this.moving = false;
    return true;
  }

  endCaughtSequence() {
    if (!this.caughtSequenceActive) return;
    this.caughtSequenceActive = false;
    this.moving = this._caughtMovementBefore;
  }

  updateCaughtSequencePose(dt = 0) {
    if (!this.caughtSequenceActive || this._isInjuredState()) return;
    this.root.getWorldPosition(this._worldPosition);
    this._idleGroundPoint.set(this._worldPosition.x, this.virtualFeetWorld.y, this._worldPosition.z);
    this._applyPosition(this._idleGroundPoint, dt);
    const player = this.engine?.findPlayer?.() ?? this.engine?.player;
    const playerPosition = player?.position ?? player?.getPlayerPosition?.();
    if (!playerPosition) return;
    const playerX = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
    const playerZ = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;
    this.root.getWorldPosition(this._worldPosition);
    this._faceDirection({
      x: playerX - this._worldPosition.x,
      y: 0,
      z: playerZ - this._worldPosition.z,
    }, dt, false, this.config.caughtDroneTrackingSpeed);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
  }

  _updateStranded(dt) {
    this._applyPosition(this._idleGroundPoint, dt);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
    this.detection?.update(dt, this.collisionInfo?.collider);

    const tracking = this.config.strandedPlayerTrackingEnabled
      && this.detection?.detectionState === DRONE_DETECTION_STATES.DETECTED;
    const player = this.engine?.findPlayer?.() ?? this.engine?.player;
    if (tracking && player) {
      const playerPosition = player.position ?? player.getPlayerPosition?.();
      if (playerPosition) {
        const playerX = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
        const playerZ = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;
        this.root.getWorldPosition(this._worldPosition);
        this._faceDirection(
          new THREE.Vector3(
            playerX - this._worldPosition.x,
            0,
            playerZ - this._worldPosition.z,
          ),
          dt,
          false,
          this.config.rotationSpeed,
        );
      }
    } else {
      this._rotateWorldYaw(Math.max(0, Number(this.config.strandedRotationSpeed) || 0) * dt);
    }

    this.strandedRetryElapsed += Math.max(0, Number(dt) || 0);
    if (this.strandedRetryElapsed >= Math.max(0, Number(this.config.strandedRetryInterval) || 5)) {
      this._beginRecovery('stranded periodic retry', true);
    }
  }

  update(dt = 0) {
    const safeDt = Math.max(0, Number(dt) || 0);
    this.elapsed += safeDt;
    if (!this.valid) return;

    if (this._isInjuredState()) {
      if (this.verticalState === DRONE_VERTICAL_STATES.RESTORING) this._updateInjuredRestoration(safeDt);
      else this._updateInjuredPhysics(safeDt);
      return;
    }
    this.visual.update(safeDt);

    if (this.caughtSequenceActive) {
      this.updateCaughtSequencePose(safeDt);
      return;
    }

    if (this._isVerticallyDisplaced()) this._resetVerticalStateFromRoot();
    if ((this.state === DRONE_STATES.PATROL || this.state === DRONE_STATES.LOCAL_RECOVER) && this._isDisplaced()) {
      const previousState = this.state;
      if (previousState === DRONE_STATES.LOCAL_RECOVER) this._clearLocalRecovery();
      if (!this._beginLocalRecovery('external displacement')) {
        this._log('info', 'Falling back to full recovery:', { previousState });
        this._beginRecovery('local recovery unavailable', true);
      }
    } else if (this.state === DRONE_STATES.RECOVER && this._isDisplaced()) {
      this._beginRecovery('external displacement');
    } else if (this.state === DRONE_STATES.STRANDED
      && this._isDisplaced(this.config.strandedDisplacementThreshold)) {
      this._beginRecovery('stranded external displacement', true);
    }
    if (this.state === DRONE_STATES.IDLE && this.navigationManager && this.elapsed >= this.retryRecoveryAt) {
      this._beginRecovery('periodic retry');
    }
    if (this.state === DRONE_STATES.LOCAL_RECOVER) {
      this._updateLocalRecovery(safeDt);
      this.detection?.update(safeDt, this.collisionInfo?.collider);
      return;
    }
    if (this.state === DRONE_STATES.RECOVER) {
      this._updateRecovery(safeDt);
      this.detection?.update(safeDt, this.collisionInfo?.collider);
      return;
    }
    if (this.state === DRONE_STATES.IDLE) {
      this._applyPosition(this._idleGroundPoint, safeDt);
      this.root.getWorldPosition(this._lastAppliedWorldPosition);
      this.detection?.update(safeDt, this.collisionInfo?.collider);
      return;
    }
    if (this.state === DRONE_STATES.STRANDED) {
      this._updateStranded(safeDt);
      return;
    }

    const previousDistance = this.distance;
    const movementSpeed = this._movementSpeed(this.config.movementSpeed, safeDt)
      * (this.verticalState === DRONE_VERTICAL_STATES.FALLING
        ? Math.max(0, Number(this.config.airMovementMultiplier) || 1)
        : 1);
    if (this.moving && this.config.movementEnabled && this.pathLength > 0) {
      const nextDistance = this.distance + safeDt * movementSpeed;
      this.distance = this.config.loopPath
        ? nextDistance % this.pathLength
        : Math.min(nextDistance, this.pathLength);
    }
    const point = this._patrolPointAtDistance(this.distance, new THREE.Vector3());
    const attemptedDistance = safeDt * movementSpeed;
    const acceptedFraction = this._applyPosition(point, safeDt);
    if (acceptedFraction < 1) {
      this.distance = this._advancePatrolDistance(previousDistance, attemptedDistance * acceptedFraction);
    }
    this._faceDirection(this._patrolTangentAtDistance(this.distance, new THREE.Vector3()), safeDt);
    if (this.directionArrow) this.directionArrow.position.copy(this._worldPosition);
    this.root.getWorldPosition(this._lastAppliedWorldPosition);
    this.detection?.update(safeDt, this.collisionInfo?.collider);
  }

  clear() {
    this.endCaughtSequence();
    this.engine?.audio?.detachDroneAudio?.(this.droneAudio);
    this.droneAudio = null;
    this.debugRoot?.traverse(object => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
    this.debugRoot?.removeFromParent();
    this.debugRoot = null;
    this.setGroundDebug(false);
    this._clearRecoveryDebug();
    this._clearLocalRecovery();
    if (this.collisionInfo?.id !== undefined) {
      if (this.physics?.bodies?.has(this.collisionInfo.id)) this.physics.removeDynamic(this.collisionInfo.id);
      else this.physics?.removeKinematic(this.collisionInfo.id);
    }
    this.collisionInfo = null;
    this._droneCharacterController = null;
    this._groundCastShape = null;
    this._playerContactActive = false;
    this._playerDisplacementActive = false;
    this._playerSeparationSide = 0;
    this._playerContactNormal.set(0, 0, 0);
    this.detection?.dispose();
    this.detection = null;
    this._publishPlayerContact(this.engine?.player, false, this._playerContactNormal);
    this._verticalPlan = null;
    this.verticalState = DRONE_VERTICAL_STATES.GROUNDED;
    this.verticalVelocity = 0;
    this.groundSupported = false;
    if (this.collisionDebugRoot) {
      this.collisionDebugRoot.geometry?.dispose?.();
      this.collisionDebugRoot.material?.dispose?.();
      this.collisionDebugRoot.removeFromParent();
      this.collisionDebugRoot = null;
    }
    if (this.config.collisionEnabled) this._log('info', 'Drone collider destroyed.');
    this.navigationManager = null;
    this.visual?.clear();
    this.visual = null;
    this.path = null;
    this._pathHorizontalSamples = [];
    this._pathHorizontalLength = 0;
    this.waypoints = [];
    this.points = [];
    this.root = null;
  }
}

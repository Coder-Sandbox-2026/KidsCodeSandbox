import * as THREE from 'three';
import { stripAndBakeCollisionMeshes } from './collisionMeshes.js';
import { configureImportedShadows } from './importedShadows.js';
import { DRONE_A_MODEL } from './ModelLoader.js';
import { DroneA } from './DroneA.js';
import { DroneController } from './DroneController.js';
import { NavigationManager } from './NavigationManager.js';
import { StageDoorSystem } from './StageDoorSystem.js';

const DRONE_SHADOW_FALLBACKS = Object.freeze({
  castShadow: true,
  receiveShadow: false,
  shadowMode: 'REAL',
});

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

/** Exact authored placeholder classification. Groups with this name are not markers. */
export function keyPlaceholderColor(object) {
  if (!object?.isMesh) return null;
  const match = authoredName(object).match(/^PH_Key(Red|Green|Yellow|Blue)$/i);
  return match ? match[1].toLowerCase() : null;
}

export function isRedKeyPlaceholder(object) { return keyPlaceholderColor(object) === 'red'; }

/** Replace all red-key markers without mutating the hierarchy during traversal. */
export function spawnKeyPlaceholders(root, engine) {
  root.updateMatrixWorld(true);
  const placeholders = [];
  root.traverse(object => {
    const color = keyPlaceholderColor(object);
    if (color) placeholders.push({ object, color });
  });

  if (!placeholders.length) return 0;
  const positions = [];
  for (const { object: placeholder, color } of placeholders) {
    const position = placeholder.getWorldPosition(new THREE.Vector3()).toArray();
    positions.push(position);
    placeholder.visible = false;
    placeholder.removeFromParent();
    const name = `create${color[0].toUpperCase()}${color.slice(1)}Key`;
    const createKey = engine?.modelFactories?.[name] ?? engine?.models?.[name];
    if (typeof createKey !== 'function') {
      console.warn(`[KeyDebug] ${name} factory is unavailable; placeholder removed.`);
      continue;
    }
    try {
      createKey({ position, stageOwned: true });
    } catch (error) {
      console.warn(`[KeyDebug] Could not spawn ${color} key:`, error);
    }
  }
  return positions.length;
}

export const spawnRedKeyPlaceholders = spawnKeyPlaceholders;

const DRONE_PLACEHOLDER_PATTERN = /^PH_(DroneA\d+)$/i;
const LEGACY_DRONE_PLACEHOLDER_PATTERN = /^PH_DroneA$/i;

export function droneAIdentifierFromPlaceholder(object) {
  const names = [object?.userData?.name, object?.name];
  for (const value of names) {
    const name = String(value ?? '').trim();
    const numbered = name.match(DRONE_PLACEHOLDER_PATTERN);
    if (numbered) return numbered[1];
    if (LEGACY_DRONE_PLACEHOLDER_PATTERN.test(name)) return 'DroneA';
  }
  return null;
}

export function isDroneAPlaceholder(object) {
  return Boolean(droneAIdentifierFromPlaceholder(object));
}

/** Replace numbered DroneA placeholders with instances that preserve authored materials. */
export function spawnDroneAPlaceholders(root, engine, { patrol = false, patrolOptions = {}, navigationManager = null } = {}) {
  root.updateMatrixWorld(true);
  const placeholders = [];
  root.traverse(object => {
    const droneId = droneAIdentifierFromPlaceholder(object);
    if (droneId) placeholders.push({ object, droneId });
  });
  placeholders.sort((first, second) => first.droneId.localeCompare(second.droneId, undefined, { numeric: true }));
  console.info('[GLBStageProcessor][DroneA] placeholders found:', placeholders.length,
    placeholders.map(({ object, droneId }) => ({ droneId, name: object.name, authoredName: object.userData?.name, type: object.type })));
  const drones = [];
  const scene = root.parent ?? root;
  const seenIds = new Set();
  for (const { object: placeholder, droneId } of placeholders) {
    if (seenIds.has(droneId.toLowerCase())) {
      console.warn(`[GLBStageProcessor][${droneId}] Duplicate placeholder skipped.`);
      continue;
    }
    seenIds.add(droneId.toLowerCase());
    const position = placeholder.getWorldPosition(new THREE.Vector3());
    const quaternion = placeholder.getWorldQuaternion(new THREE.Quaternion());
    const scale = placeholder.getWorldScale(new THREE.Vector3());
    placeholder.visible = false;
    placeholder.removeFromParent();
    const modelLoader = engine?.models;
    if (!modelLoader?.has?.(DRONE_A_MODEL)) {
      console.warn(`[GLBStageProcessor][${droneId}] DroneA model is unavailable; placeholder removed.`);
      continue;
    }
    try {
      const { root: droneRoot } = modelLoader.clone(DRONE_A_MODEL);
      droneRoot.name = droneId;
      scene.add(droneRoot);
      scene.updateMatrixWorld(true);
      droneRoot.position.copy(scene.worldToLocal(position.clone()));
      const sceneWorldQuaternion = scene.getWorldQuaternion(new THREE.Quaternion());
      droneRoot.quaternion.copy(sceneWorldQuaternion).invert().multiply(quaternion);
      const sceneWorldScale = scene.getWorldScale(new THREE.Vector3());
      droneRoot.scale.set(
        scale.x / Math.max(1e-8, sceneWorldScale.x),
        scale.y / Math.max(1e-8, sceneWorldScale.y),
        scale.z / Math.max(1e-8, sceneWorldScale.z),
      );
      droneRoot.updateMatrixWorld(true);
      for (const [key, value] of Object.entries(DRONE_SHADOW_FALLBACKS)) {
        if (!Object.prototype.hasOwnProperty.call(droneRoot.userData, key)) {
          droneRoot.userData[key] = value;
        }
      }
      configureImportedShadows(droneRoot, { scene });
      console.info(`[GLBStageProcessor][${droneId}] spawned:`, {
        droneId,
        position: position.toArray(),
        scale: scale.toArray(),
        rootName: droneRoot.name,
        meshCount: (() => {
          let count = 0;
          droneRoot.traverse(object => { if (object.isMesh) count += 1; });
          return count;
        })(),
      });
      drones.push({
        root: droneRoot,
        controller: patrol
          ? new DroneController(droneRoot, {
            waypointRoot: root,
            droneId,
            detectionIndex: drones.length,
            navigationManager,
            engine,
            physics: engine?.physics,
            ...patrolOptions,
          })
          : new DroneA(droneRoot),
      });
    } catch (error) {
      console.warn(`[GLBStageProcessor][${droneId}] Could not spawn DroneA:`, error);
    }
  }
  return drones;
}

/**
 * Process a scene after it has its final scene parent and world transform.
 * COL_ bodies are created here; MOVCOL_/TRIGGER_ recipes are returned for the
 * owning level's existing MovingObject/interaction behavior.
 */
export function processGLBStage(root, {
  engine,
  physics,
  physicsBodies = [],
  spawnDrones = true,
  patrolDrones = false,
  patrolOptions = {},
  buildNavigation = false,
  buildDoors = true,
} = {}) {
  if (!root) return { bakedParts: [], stageColliderParts: [], stageInteractionParts: [], redKeyCount: 0, drones: [], navigation: null, doors: null };

  configureImportedShadows(root, { scene: root.parent ?? engine?.scene });
  const redKeyCount = spawnKeyPlaceholders(root, engine);
  const navigation = buildNavigation
    ? new NavigationManager(root, { debug: patrolOptions.navigationDebug === true })
    : null;
  const drones = spawnDrones
    ? spawnDroneAPlaceholders(root, engine, { patrol: patrolDrones, patrolOptions, navigationManager: navigation })
    : [];
  const bakedParts = stripAndBakeCollisionMeshes(root, { worldSpace: true });
  const stageColliderParts = bakedParts.filter(part => part.role === 'col');
  const stageInteractionParts = bakedParts.filter(part => part.role === 'trigger' || part.role === 'movcol');
  const doors = buildDoors
    ? new StageDoorSystem({
      root,
      stageInteractionParts,
      physics,
      engine,
      isActive: () => engine?.level?.stageRoot === root,
      promptHost: typeof document === 'undefined' ? null : document.getElementById('viewport-pane'),
    })
    : null;

  if (!stageColliderParts.length) {
    console.warn('[GLBStageProcessor] Stage contains no usable COL_ collision meshes.');
  }

  const RAPIER = physics?.RAPIER;
  if (!physics?.world || !RAPIER) {
    throw new Error('[GLBStageProcessor] Physics is required to process COL_ stage geometry.');
  }

  for (const part of stageColliderParts) {
    if (!part.vertices?.length || !part.indices?.length) {
      console.warn(`[GLBStageProcessor] COL_ object "${part.name}" has no usable triangle mesh.`);
      continue;
    }
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const collider = RAPIER.ColliderDesc.trimesh(part.vertices, part.indices)
      .setFriction(0.9)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max);
    physics.world.createCollider(collider, body);
    physicsBodies.push(body);
  }

  return { bakedParts, stageColliderParts, stageInteractionParts, redKeyCount, drones, navigation, doors };
}

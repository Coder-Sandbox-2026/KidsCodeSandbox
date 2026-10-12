import * as THREE from 'three';
import { stripAndBakeCollisionMeshes } from './collisionMeshes.js';
import { configureImportedShadows } from './importedShadows.js';

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

/** Exact authored placeholder classification. Groups with this name are not markers. */
export function isRedKeyPlaceholder(object) {
  return !!object?.isMesh && authoredName(object) === 'PH_KeyRed';
}

/** Replace all red-key markers without mutating the hierarchy during traversal. */
export function spawnRedKeyPlaceholders(root, engine) {
  root.updateMatrixWorld(true);
  const placeholders = [];
  root.traverse(object => {
    if (isRedKeyPlaceholder(object)) placeholders.push(object);
  });

  if (!placeholders.length) return 0;
  console.info(`[RedKeyDebug] Found ${placeholders.length} PH_KeyRed placeholder(s).`);

  const createRedKey = engine?.modelFactories?.createRedKey ?? engine?.models?.createRedKey;
  if (typeof createRedKey !== 'function') {
    console.warn('[RedKeyDebug] Red Key factory is unavailable; placeholders were removed without spawning keys.');
    const positions = placeholders.map(placeholder => placeholder.getWorldPosition(new THREE.Vector3()).toArray());
    for (const placeholder of placeholders) {
      placeholder.visible = false;
      placeholder.removeFromParent();
    }
    return positions.length;
  }

  const positions = [];
  for (const [index, placeholder] of placeholders.entries()) {
    const position = placeholder.getWorldPosition(new THREE.Vector3()).toArray();
    positions.push(position);
    placeholder.visible = false;
    placeholder.removeFromParent();
    try {
      const key = createRedKey({ position, stageOwned: true });
      if (!key) throw new Error('factory returned no object');
      console.info(`[RedKeyDebug] Spawned and registered Red Key ${index + 1}/${placeholders.length} at ${position.join(', ')}.`);
    } catch (error) {
      console.warn(`[RedKeyDebug] Could not spawn Red Key ${index + 1}/${placeholders.length}:`, error);
    }
  }
  return positions.length;
}

/**
 * Process a scene after it has its final scene parent and world transform.
 * COL_ bodies are created here; MOVCOL_/TRIGGER_ recipes are returned for the
 * owning level's existing MovingObject/interaction behavior.
 */
export function processGLBStage(root, { engine, physics, physicsBodies = [] } = {}) {
  if (!root) return { bakedParts: [], stageColliderParts: [], stageInteractionParts: [], redKeyCount: 0 };

  configureImportedShadows(root, { scene: root.parent ?? engine?.scene });
  const redKeyCount = spawnRedKeyPlaceholders(root, engine);
  const bakedParts = stripAndBakeCollisionMeshes(root, { worldSpace: true });
  const stageColliderParts = bakedParts.filter(part => part.role === 'col');
  const stageInteractionParts = bakedParts.filter(part => part.role === 'trigger' || part.role === 'movcol');

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

  return { bakedParts, stageColliderParts, stageInteractionParts, redKeyCount };
}

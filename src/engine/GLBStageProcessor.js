import * as THREE from 'three';
import { stripAndBakeCollisionMeshes } from './collisionMeshes.js';
import { configureImportedShadows } from './importedShadows.js';

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

/**
 * Process a scene after it has its final scene parent and world transform.
 * COL_ bodies are created here; MOVCOL_/TRIGGER_ recipes are returned for the
 * owning level's existing MovingObject/interaction behavior.
 */
export function processGLBStage(root, { engine, physics, physicsBodies = [] } = {}) {
  if (!root) return { bakedParts: [], stageColliderParts: [], stageInteractionParts: [], redKeyCount: 0 };

  configureImportedShadows(root, { scene: root.parent ?? engine?.scene });
  const redKeyCount = spawnKeyPlaceholders(root, engine);
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

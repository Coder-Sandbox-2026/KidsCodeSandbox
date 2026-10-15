import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER_HEIGHT } from '../api/Player.js';
import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { authoredAssociationKey } from './collisionMeshes.js';
import { processGLBStage } from './GLBStageProcessor.js';
import { InteractionSystem, boundsFromPart, INTERACTION_KEY_LABEL } from './InteractionSystem.js';
import { Door } from './Door.js';
import { cleanupImportedShadows } from './importedShadows.js';

const PLAYER_START_NAME = 'PLAYER_START';
const stage13Url = new URL('../assets/Levels/First Person/stage13.gltf', import.meta.url).href;
const stage13FallbackUrl = new URL('../assets/Levels/First Person/stage13.glb', import.meta.url).href;
const stage13BinUrl = new URL('../assets/Levels/First Person/stage13.bin', import.meta.url).href;
const platformerTextureUrl = new URL('../assets/textures/platformer_texture3.ktx2', import.meta.url).href;
const floorNormalTextureUrl = new URL('../assets/textures/floor_tiles_20_normal_gl_1k.ktx2', import.meta.url).href;
const floorBaseColorTextureUrl = new URL('../assets/textures/floor_tiles_20_basecolor_1k.ktx2', import.meta.url).href;
const floorMetalRoughnessTextureUrl = new URL('../assets/textures/floor_tiles_20_metallic_1k-floor_tiles_20_roughness_1k.ktx2', import.meta.url).href;

const STAGE13_EXTERNAL_RESOURCES = new Map([
  ['stage13.bin', stage13BinUrl],
  ['textures/platformer_texture3.ktx2', platformerTextureUrl],
  ['textures/floor_tiles_20_normal_gl_1k.ktx2', floorNormalTextureUrl],
  ['textures/floor_tiles_20_basecolor_1k.ktx2', floorBaseColorTextureUrl],
  ['textures/floor_tiles_20_metallic_1k-floor_tiles_20_roughness_1k.ktx2', floorMetalRoughnessTextureUrl],
]);
let stageTemplate = null;
let stageSpawn = null;
let stageLoadError = null;

function stage13LoadingManager() {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    const normalized = decodeURIComponent(url).replaceAll('\\', '/');
    for (const [uri, resolvedUrl] of STAGE13_EXTERNAL_RESOURCES) {
      if (normalized === uri || normalized.endsWith(`/${uri}`)) return resolvedUrl;
    }
    return url;
  });
  return manager;
}

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

export { isRedKeyPlaceholder, spawnRedKeyPlaceholders } from './GLBStageProcessor.js';

/**
 * Keep shallow-angle stage textures from undersampling on lower-cost GPUs.
 * GLTFLoader already assigns each map's correct color space and mip filter;
 * only add a modest anisotropic cap, shared across the GLB's small texture set.
 */
function configureStageTextureFiltering(root, renderer) {
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
  const anisotropy = Math.min(maxAnisotropy, 4);
  if (anisotropy <= 1) return;

  const textures = new Set();
  root.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) {
        const texture = material?.[key];
        if (!texture || textures.has(texture)) continue;
        textures.add(texture);
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
      }
    }
  });
}

export function isPlayerStartNode(object) {
  return authoredName(object) === PLAYER_START_NAME;
}

/** Convert a marker's final world orientation into the controller's look vector. */
export function playerDirectionFromMarker(marker) {
  marker.updateWorldMatrix(true, false);
  const quaternion = marker.getWorldQuaternion(new THREE.Quaternion());
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  direction.y = 0;
  if (direction.lengthSq() < 1e-8) {
    throw new Error('[level-13] PLAYER_START has no usable horizontal facing direction.');
  }
  return direction.normalize().toArray();
}

function extractSpawn(root) {
  root.updateMatrixWorld(true);
  const markers = [];
  root.traverse(object => { if (isPlayerStartNode(object)) markers.push(object); });
  if (!markers.length) throw new Error('[level-13] stage13.glb is missing PLAYER_START.');
  if (markers.length > 1) {
    console.warn(`[level-13] stage13.glb contains ${markers.length} PLAYER_START objects; using the first in scene traversal order.`);
  }
  const marker = markers[0];
  const worldPosition = marker.getWorldPosition(new THREE.Vector3());
  const direction = playerDirectionFromMarker(marker);
  // PLAYER_START is authored on the walking surface; Rapier stores the capsule center.
  const position = [worldPosition.x, worldPosition.y + PLAYER_HEIGHT / 2, worldPosition.z];
  for (const item of markers) item.removeFromParent();
  return Object.freeze({ position: Object.freeze(position), direction: Object.freeze(direction) });
}

/** Load once during engine initialization so the established synchronous build API stays intact. */
export async function prepareChallengeLevel13({ modelLoader } = {}) {
  if (stageTemplate || stageLoadError) return;
  const loaderFactory = modelLoader?.createGLTFLoader?.bind(modelLoader)
    ?? (manager => new GLTFLoader(manager));
  const sources = [
    { name: 'stage13.gltf', url: stage13Url, manager: stage13LoadingManager() },
    { name: 'stage13.glb', url: stage13FallbackUrl, manager: new THREE.LoadingManager() },
  ];

  for (const source of sources) {
    try {
      const gltf = await loaderFactory(source.manager).loadAsync(source.url);
      stageTemplate = gltf.scene;
      stageTemplate.updateMatrixWorld(true);
      stageSpawn = extractSpawn(stageTemplate);
      return;
    } catch (error) {
      stageLoadError = error;
      if (source === sources[0]) {
        console.warn('[level-13] Could not load stage13.gltf; trying stage13.glb fallback:', error);
      }
    }
  }
  console.error('[level-13] Could not load stage13.gltf or stage13.glb fallback:', stageLoadError);
}

export class ChallengeLevel13 extends ChallengeLevel1 {
  constructor(...args) {
    super(...args);
    this.stageRoot = null;
    this.playerSpawn = null;
    this.door = null;
    this.doors = new Map();
    this.interactionSystem = null;
    this._onDoorTestKeyDown = null;
    this._doorDiagnosticSamples = 0;
    this._doorDiagnosticSignature = '';
  }

  build() {
    if (this.stageRoot) return;
    if (!stageTemplate) {
      throw new Error('[level-13] stage13.gltf and stage13.glb fallback are unavailable.', { cause: stageLoadError });
    }

    this.stageRoot = stageTemplate.clone(true);
    this.stageRoot.name = 'stage13';
    configureStageTextureFiltering(this.stageRoot, this.engine?.renderer?.renderer);
    this.scene.add(this.stageRoot);
    this.meshes.push(this.stageRoot);
    this.stageRoot.updateMatrixWorld(true);

    const { stageInteractionParts } = processGLBStage(this.stageRoot, {
      engine: this.engine,
      physics: this.physics,
      physicsBodies: this.physicsBodies,
    });

    this._buildDoorInteractions(stageInteractionParts);
    console.info(`[RedKeyDebug] Active Red Keys after Level 13 initialization: ${this.engine?.redKeys?.size ?? 0}.`);

    this.playerSpawn = stageSpawn;
    this._buildClouds();
  }

  _buildDoorInteractions(stageInteractionParts) {
    const colors = ['Red', 'Green', 'Yellow', 'Blue'];
    for (const color of colors) this._buildDoorInteraction(color, stageInteractionParts);
    this.door = this.doors.get('red') ?? null;
  }

  _buildDoorInteraction(color, stageInteractionParts) {
    const association = authoredAssociationKey(`Door${color}`);
    const triggerPart = stageInteractionParts.find(part => part.role === 'trigger' && part.associationKey === association);
    const colliderPart = stageInteractionParts.find(part => part.role === 'movcol' && part.associationKey === association);
    if (!triggerPart || !colliderPart) {
      return;
    }

    let doorObject = null;
    this.stageRoot.traverse(object => {
      if (doorObject || object === this.stageRoot) return;
      if (authoredAssociationKey(object.name) !== colliderPart.associationKey) return;
      let hasVisibleMesh = false;
      object.traverse(child => { if (child.isMesh && child.visible) hasVisibleMesh = true; });
      if (hasVisibleMesh) doorObject = object;
    });
    if (!doorObject) {
      console.warn(`[level-13] Could not find the visible object for ${colliderPart.name}.`);
      return;
    }

    this.stageRoot.updateMatrixWorld(true);
    const doorBounds = new THREE.Box3().setFromObject(doorObject);
    const floorY = colliderPart.ty - colliderPart.hy;
    const travelDistance = Math.max(colliderPart.hy * 2 + 0.25, doorBounds.max.y - floorY + 0.25);
    const door = new Door({
      physics: this.physics,
      object: doorObject,
      colliderPart,
      travel: new THREE.Vector3(0, -travelDistance, 0),
      locked: true,
      keyColor: color.toLowerCase(),
    });
    if (this.engine?.player?.movementController) {
      this.engine.player.movementController.contactDiagnosticEnabled = true;
    }
    const promptHost = typeof document === 'undefined'
      ? null
      : document.getElementById('viewport-pane');
    this.doors.set(color.toLowerCase(), door);
    this.interactionSystem ??= new InteractionSystem({
      getPlayer: () => this.engine?.player,
      isActive: () => this.engine?.level === this && this.engine?.levelId === 'challenge-13',
      promptHost,
    });
    this.interactionSystem.register({
      bounds: boundsFromPart(triggerPart),
      object: doorObject,
      label: `${INTERACTION_KEY_LABEL} Open Door`,
      isAvailable: () => door.target === 0 && door.value === 0,
      onInteract: () => {
        if (door.target !== 0 || door.value !== 0) return false;
        if (door.locked && door.target === 0 && door.value === 0) {
          this.interactionSystem.notify('This door is locked.');
          return false;
        }
        if (door.target === 0 && door.value === 0) return door.setOpen(true);
        return false;
      },
    });

    this._onDoorTestKeyDown = event => {
      if (event.code !== 'Digit1' || event.repeat || !this.engine
        || this.engine.level !== this || this.engine.levelId !== 'challenge-13') return;
      if (event.target?.closest?.('input, textarea, select, button, [contenteditable], .monaco-editor, dialog')) return;
      if (!this.engine.player?.input?.active) return;
      if (door.setOpen(false, moving => !moving.containsPlayerAtClosedPosition(this.engine.player))) {
        event.preventDefault();
      }
    };
    if (!this._onDoorTestKeyDown && typeof document !== 'undefined') document.addEventListener('keydown', this._onDoorTestKeyDown);
  }

  updateBeforePhysics(dt) {
    for (const door of this.doors.values()) door.update(dt);
  }

  update() {
    this._diagnoseDoorContact();
    this.interactionSystem?.update();
  }

  /** Temporary bounded diagnostic for the reported Level 13 sticking case. */
  _diagnoseDoorContact() {
    if (this._doorDiagnosticSamples >= 6 || !this.door || this.engine?.level !== this) return;
    const movement = this.engine?.player?.movementController?.lastMovementContactSnapshot;
    if (!movement) return;
    if (Math.hypot(movement.requested.x, movement.requested.z) < 0.001) return;

    const doorHandle = this.door.collider?.handle;
    const doorContacts = movement.contacts.filter(contact => contact.handle === doorHandle);
    const horizontalFixedContacts = movement.contacts.filter(contact => contact.bodyType === 'fixed'
      && Math.abs(contact.normal[1]) < 0.5);
    if (!doorContacts.length && !horizontalFixedContacts.length) return;

    const signature = [...doorContacts, ...horizontalFixedContacts]
      .map(contact => `${contact.handle}:${contact.normal.map(value => Math.round(value * 100) / 100).join(',')}`)
      .join('|');
    if (signature === this._doorDiagnosticSignature) return;
    this._doorDiagnosticSignature = signature;

    const inverseDoorRotation = this.door.baseColliderRotation.clone().invert();
    const classify = contact => {
      const localNormal = new THREE.Vector3(...contact.normal).applyQuaternion(inverseDoorRotation);
      return {
        normal: contact.normal,
        localNormal: localNormal.toArray(),
        region: Math.abs(localNormal.z) >= Math.max(Math.abs(localNormal.x), Math.abs(localNormal.y))
          ? 'broad-face'
          : 'edge',
      };
    };

    this._doorDiagnosticSamples += 1;
    console.info('[level-13][movement-contact]', {
      sample: this._doorDiagnosticSamples,
      playerPosition: this.engine.player.position.toArray(),
      requestedHorizontal: [movement.requested.x, movement.requested.z],
      correctedMovement: movement.corrected,
      doorColliderHandle: doorHandle,
      doorContacts: doorContacts.map(classify),
      otherContacts: movement.contacts
        .filter(contact => contact.handle !== doorHandle)
        .map(contact => ({
          handle: contact.handle,
          bodyType: contact.bodyType,
          normal: contact.normal,
        })),
    });
  }

  clear() {
    if (typeof document !== 'undefined' && this._onDoorTestKeyDown) {
      document.removeEventListener('keydown', this._onDoorTestKeyDown);
    }
    this.interactionSystem?.dispose();
    for (const door of this.doors.values()) door.dispose();
    if (this.engine?.player?.movementController) {
      this.engine.player.movementController.contactDiagnosticEnabled = false;
      this.engine.player.movementController.lastMovementContactSnapshot = null;
    }
    this.interactionSystem = null;
    this.door = null;
    this.doors.clear();
    this._onDoorTestKeyDown = null;
    this._doorDiagnosticSamples = 0;
    this._doorDiagnosticSignature = '';
    cleanupImportedShadows(this.stageRoot);
    super.clear();
    this.stageRoot = null;
    this.playerSpawn = null;
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { extractPlayerSpawn } from './ChallengeLevel13.js';
import { processGLBStage } from './GLBStageProcessor.js';
import { cleanupImportedShadows } from './importedShadows.js';
import { platformerTextureUrl } from '../assets/assetSource.js';

const STAGE_DEFINITIONS = Object.freeze({
  16: Object.freeze({ gltf: 'stage16.gltf', bin: 'stage16.bin' }),
  17: Object.freeze({ gltf: 'stage17.gltf', bin: 'stage17.bin' }),
  18: Object.freeze({ gltf: 'stage18.gltf', bin: 'stage18.bin' }),
});

const STAGE_TEMPLATES = new Map();
const STAGE_SPAWNS = new Map();
const STAGE_ERRORS = new Map();

function stageUrl(stageNumber, extension) {
  return new URL(`../assets/Levels/First Person/stage${stageNumber}.${extension}`, import.meta.url).href;
}

function stageLoadingManager(stageNumber) {
  const definition = STAGE_DEFINITIONS[stageNumber];
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    const normalized = decodeURIComponent(url).replaceAll('\\', '/');
    if (normalized === definition.bin || normalized.endsWith(`/${definition.bin}`)) return stageUrl(stageNumber, 'bin');
    if (normalized === 'textures/platformer_texture3.ktx2'
      || normalized.endsWith('/textures/platformer_texture3.ktx2')) return platformerTextureUrl;
    return url;
  });
  return manager;
}

export async function prepareImportedStageLevels({ modelLoader } = {}) {
  for (const stageNumber of Object.keys(STAGE_DEFINITIONS).map(Number)) {
    if (STAGE_TEMPLATES.has(stageNumber) || STAGE_ERRORS.has(stageNumber)) continue;
    try {
      const manager = stageLoadingManager(stageNumber);
      const loader = modelLoader?.createGLTFLoader?.(manager) ?? new GLTFLoader(manager);
      const gltf = await loader.loadAsync(stageUrl(stageNumber, 'gltf'));
      const template = gltf.scene;
      template.updateMatrixWorld(true);
      STAGE_TEMPLATES.set(stageNumber, template);
      STAGE_SPAWNS.set(stageNumber, extractPlayerSpawn(template, `level-${stageNumber}`));
    } catch (error) {
      STAGE_ERRORS.set(stageNumber, error);
      console.error(`[level-${stageNumber}] Could not load stage${stageNumber}.gltf:`, error);
    }
  }
}

export class ImportedStageLevel extends ChallengeLevel1 {
  constructor(stageNumber, ...args) {
    super(...args);
    this.stageNumber = stageNumber;
    this.stageRoot = null;
    this.playerSpawn = null;
    this.drones = [];
    this.doors = new Map();
    this._doorSystem = null;
    this.navigation = null;
  }

  build() {
    if (this.stageRoot) return;
    const template = STAGE_TEMPLATES.get(this.stageNumber);
    if (!template) {
      throw new Error(`[level-${this.stageNumber}] stage${this.stageNumber}.gltf is unavailable.`, {
        cause: STAGE_ERRORS.get(this.stageNumber),
      });
    }

    this.stageRoot = template.clone(true);
    this.stageRoot.name = `stage${this.stageNumber}`;
    this.scene.add(this.stageRoot);
    this.meshes.push(this.stageRoot);
    this.stageRoot.updateMatrixWorld(true);

    const processed = processGLBStage(this.stageRoot, {
      engine: this.engine,
      physics: this.physics,
      physicsBodies: this.physicsBodies,
      spawnDrones: true,
      patrolDrones: true,
      buildNavigation: true,
    });

    this.drones = processed.drones;
    this.navigation = processed.navigation;
    this._doorSystem = processed.doors;
    this.doors = processed.doors?.doors ?? new Map();
    for (const drone of this.drones) this.meshes.push(drone.root);
    this.playerSpawn = STAGE_SPAWNS.get(this.stageNumber);
  }

  updateBeforePhysics(dt) {
    this._doorSystem?.update(dt);
  }

  update(dt, frameId) {
    if (this.engine?.level !== this) return;
    for (const drone of this.drones) drone.controller.update(dt, frameId);
  }

  clear() {
    this._doorSystem?.clear();
    this._doorSystem = null;
    for (const drone of this.drones) {
      cleanupImportedShadows(drone.root);
      drone.controller.clear();
    }
    this.drones = [];
    this.navigation?.clear();
    this.navigation = null;
    this.doors.clear();
    cleanupImportedShadows(this.stageRoot);
    this.stageRoot = null;
    this.playerSpawn = null;
    super.clear();
  }
}

export class ChallengeLevel16 extends ImportedStageLevel {
  constructor(...args) { super(16, ...args); }
}

export class ChallengeLevel17 extends ImportedStageLevel {
  constructor(...args) { super(17, ...args); }
}

export class ChallengeLevel18 extends ImportedStageLevel {
  constructor(...args) { super(18, ...args); }
}

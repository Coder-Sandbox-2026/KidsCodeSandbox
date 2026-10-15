/**
 * ModelLoader.js – Loads GLB models once, then clones them for the scene.
 *
 * Kids call createGoldCoin() / createCake(); this class does the Three.js / KTX2 work.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  basisTranscoderPath, cakeUrl, goldCoinUrl, goldStarUrl, redKeyUrl, greenKeyUrl, yellowKeyUrl, blueKeyUrl, platformerTextureUrl,
} from '../assets/assetSource.js';
import {
  stripAndBakeCollisionMeshes,
  visualBoundsInRootSpace,
} from './collisionMeshes.js';

export const GOLD_COIN_MODEL = 'goldCoin';
export const CAKE_MODEL = 'cake';
export const GOLD_STAR_MODEL = 'goldStar';
export const RED_KEY_MODEL = 'redKey';
export const GREEN_KEY_MODEL = 'greenKey';
export const YELLOW_KEY_MODEL = 'yellowKey';
export const BLUE_KEY_MODEL = 'blueKey';

const KTX2_ATTEMPTS = [
  { label: 'relative basis/', path: basisTranscoderPath() },
];

/** Collectible GLBs under src/assets/model/ */
const COLLECTIBLE_DEFS = [
  {
    id: GOLD_STAR_MODEL,
    url: goldStarUrl,
    fileName: 'GoldStar.glb',
    defaultName: GOLD_STAR_MODEL,
    materialStyle: GOLD_STAR_MODEL,
    shadowCasterNames: ['Gold Star'],
  },
  {
    id: RED_KEY_MODEL,
    url: redKeyUrl,
    fileName: 'keyRed.gltf',
    defaultName: RED_KEY_MODEL,
    materialStyle: RED_KEY_MODEL,
  },
  { id: GREEN_KEY_MODEL, url: greenKeyUrl, fileName: 'keyGreen.gltf', defaultName: GREEN_KEY_MODEL, materialStyle: RED_KEY_MODEL },
  { id: YELLOW_KEY_MODEL, url: yellowKeyUrl, fileName: 'keyYellow.gltf', defaultName: YELLOW_KEY_MODEL, materialStyle: RED_KEY_MODEL },
  { id: BLUE_KEY_MODEL, url: blueKeyUrl, fileName: 'keyBlue.gltf', defaultName: BLUE_KEY_MODEL, materialStyle: RED_KEY_MODEL },
  {
    id: GOLD_COIN_MODEL,
    url: goldCoinUrl,
    fileName: 'goldCoin.glb',
    defaultName: 'goldCoin',
    rotationY: Math.PI / 2,
    materialStyle: 'gold',
  },
  {
    id: CAKE_MODEL,
    url: cakeUrl,
    fileName: 'Cake.glb',
    defaultName: 'cake',
    rotationY: 0,
    materialStyle: 'palette',
  },
];

export class ModelLoader {
  constructor() {
    this._gltf = new GLTFLoader();
    this._gltf.manager.setURLModifier((url) => {
      const normalized = decodeURIComponent(url).replaceAll('\\', '/');
      return normalized.endsWith('/textures/platformer_texture3.ktx2')
        ? platformerTextureUrl
        : url;
    });
    this._ktx2 = null;
    this._envMap = null;
    /** @type {Map<string, { template: THREE.Object3D, colliderParts: object[], materialStyle: string }>} */
    this._models = new Map();
    this.ready = false;
    this.lastError = null;
  }

  /**
   * Must run after the WebGL renderer exists (KTX2 needs GPU support info).
   * @param {import('three').WebGLRenderer} renderer
   */
  async init(renderer) {
    this._ktx2 = await this._createKtx2(renderer);
    this._gltf.setKTX2Loader(this._ktx2);
    this._envMap = this._makeCollectibleEnvMap(renderer);

    const errors = [];
    for (const def of COLLECTIBLE_DEFS) {
      try {
        await this._loadCollectible(def);
      } catch (err) {
        errors.push(err);
        console.warn(`[models] Could not load ${def.fileName}:`, err);
      }
    }

    if (this._models.size === 0 && errors.length) {
      throw errors[0];
    }
    if (errors.length) this.lastError = errors[0];
    this.ready = true;
  }

  /** Create a GLTFLoader using the KTX2 decoder initialized for this renderer. */
  createGLTFLoader(manager) {
    const loader = new GLTFLoader(manager);
    if (this._ktx2) {
      // KTX2Loader performs its own FileLoader requests through its manager.
      // Keep it on the same manager as GLTFLoader so URL modifiers also apply
      // to external KTX2 images referenced by the glTF.
      if (manager) this._ktx2.manager = manager;
      loader.setKTX2Loader(this._ktx2);
    }
    return loader;
  }

  async _createKtx2(renderer) {
    let lastError = null;

    for (const attempt of KTX2_ATTEMPTS) {
      const loader = new KTX2Loader();
      loader.detectSupport(renderer);
      if (attempt.path) loader.setTranscoderPath(attempt.path);

      try {
        await loader.init();
        console.info('[models] KTX2 decoder ready:', attempt.label);
        return loader;
      } catch (err) {
        lastError = err;
        console.warn('[models] KTX2 decoder failed (' + attempt.label + '):', err);
        try { loader.dispose(); } catch { /* ignore */ }
      }
    }

    throw lastError || new Error('Could not start the KTX2 texture decoder');
  }

  /**
   * Tiny studio HDR used only on collectible materials (gold shine, cake glaze).
   * Do not assign this to scene.environment — that makes the playground bloom.
   */
  _makeCollectibleEnvMap(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return envMap;
  }

  _usePaletteTextures(mat) {
    const maps = [mat.map, mat.metalnessMap, mat.roughnessMap, mat.normalMap];
    const seen = new Set();
    for (const tex of maps) {
      if (!tex || seen.has(tex)) continue;
      seen.add(tex);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }
  }

  _prepareMaterial(mat, style) {
    if (!mat) return mat;
    const copy = mat.clone();
    if (!copy.isMeshStandardMaterial && !copy.isMeshPhysicalMaterial) return copy;

    if (style === GOLD_STAR_MODEL) {
      copy.envMap = this._envMap;
      copy.envMapIntensity = 0.02;
      return copy;
    }
    copy.emissiveIntensity = 0;

    if (style === 'gold') {
      copy.envMap = this._envMap;
      copy.envMapIntensity = 0.28;//0.45;
      copy.metalnessMap = null;
      copy.roughnessMap = null;
      copy.metalness = 0.30;//0.58;
      copy.roughness = 0.42;//0.32;
      copy.emissive.set(0x000000);
      // Keep a visible gold glint. Only cap the sun hotspot so bloom
      // does not turn the coin white — do not dim the whole reflection.
      copy.customProgramCacheKey = () => 'goldCoinSoftSpecV2';
      copy.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
          `vec3 outgoingLight = totalDiffuse + totalSpecular * 0.85 + totalEmissiveRadiance;
           outgoingLight = min(outgoingLight, vec3(1.45));`
        );
      };
    } else if (style === 'palette') {
      // Cake atlas is a tiny color palette. Linear mipmaps bleed neighboring
      // swatches (and the black padding) into every face.
      this._usePaletteTextures(copy);
      copy.transparent = false;
      copy.opacity = 1;
      copy.depthWrite = true;
      copy.side = THREE.FrontSide;
      copy.normalMap = null;
      // IBL at 0.9 blew the cream sides out white (and tripped bloom).
      // A tiny env is enough for a hint of glaze; gold keeps its own values.
      copy.envMap = this._envMap;
      copy.envMapIntensity = 0.7;
      copy.metalnessMap = null;
      copy.metalness = 0.38;
      copy.roughness = (copy.roughness ?? 1) * 1;
    }

    copy.needsUpdate = true;
    return copy;
  }

  async _loadCollectible(def) {
    const gltf = await this._gltf.loadAsync(def.url);
    const template = gltf.scene;
    template.name = template.name || def.defaultName;

    if (def.rotationY) {
      template.rotation.y = def.rotationY;
    }
    template.updateMatrixWorld(true);

    const colliderParts = stripAndBakeCollisionMeshes(template);
    const hasItem = colliderParts.some((part) => part.role === 'item');
    if (!hasItem) {
      const bounds = visualBoundsInRootSpace(template);
      if (bounds) colliderParts.push(bounds);
      console.info(`[models] ${def.fileName} has no ITEM_* child yet; using the visible mesh as the collect volume.`);
    }

    this._models.set(def.id, {
      template,
      colliderParts,
      materialStyle: def.materialStyle,
      shadowCasterNames: def.shadowCasterNames
        ?? (def.id === GOLD_STAR_MODEL ? ['Gold Star'] : []),
    });
  }

  /**
   * Make a new copy of a preloaded model (unique materials, shared geometry).
   * @param {string} name
   * @returns {{ root: THREE.Object3D, colliderParts: object[] }}
   */
  clone(name) {
    const entry = this._models.get(name);
    if (!entry) {
      throw new Error(`The 3D model "${name}" is not loaded yet.`);
    }

    const root = entry.template.clone(true);
    root.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = entry.shadowCasterNames.includes(child.userData.name ?? child.name);
      // GLTFLoader sanitizes spaces in .name; userData.name retains the authored name.
      if (!child.material) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((mat) => this._prepareMaterial(mat, entry.materialStyle))
        : this._prepareMaterial(child.material, entry.materialStyle);
    });

    return { root, colliderParts: entry.colliderParts };
  }

  has(name) {
    return this._models.has(name);
  }
}

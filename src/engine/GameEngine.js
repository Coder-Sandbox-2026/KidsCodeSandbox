/**
 * GameEngine.js – The main orchestrator. Owns the render loop, scene, physics,
 * player, and default level. Provides hooks for user code execution.
 */
import { Renderer } from './Renderer.js';
import { SceneManager } from './SceneManager.js';
import { PhysicsManager } from './PhysicsManager.js';
import { ModelLoader } from './ModelLoader.js';
import { Player } from '../api/Player.js';
import { DefaultLevel } from './DefaultLevel.js';
import { CHALLENGE_LEVEL_CLASSES } from './challengeLevelRegistry.js';
import { EnvironmentResources } from './EnvironmentResources.js';
import { VFXManager } from './VFXManager.js';
import { RunLifecycle } from './RunLifecycle.js';
import { AudioManager } from '../audio/AudioManager.js';
import { CHALLENGE_LEVEL_CONFIG } from '../challenges/challengeLevelConfig.js';
import { updateGoldStars, clearGoldStars } from '../api/GoldStar.js';
import * as THREE from 'three';
import { appSettings } from '../settings/appSettings.js';
import { GRAPHICS_PROFILES } from '../settings/graphicsProfiles.js';

export class GameEngine {
  constructor(container, { fpsDebug = false } = {}) {
    this.container = container;
    this.fpsDebug = fpsDebug;
    this.fpsDisplay = null;
    this.fpsElapsed = 0;
    this.fpsFrames = 0;
    this.runs = new RunLifecycle();
    this.audio = new AudioManager();

    // Subsystems (initialized in init())
    this.renderer = null;
    this.sceneManager = null;
    this.physics = null;
    this.models = null;
    this.player = null;
    this.level = null;
    this.levelId = 'default';
    this.environmentResources = new EnvironmentResources();
    this.vfx = null;

    // State
    this.running = false;
    this.clock = new THREE.Clock();
    this._animId = null;
    this.levelLoaded = false;

    /** User update callbacks – cleared between runs */
    this.userUpdateCallbacks = [];
    /** User-created meshes – cleaned between runs */
    this.userMeshes = [];

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._onCanvasClick = (event) => this._handleClick(event);
    appSettings.subscribe((_values, key) => {
      if (key === 'graphicsProfile') this._applyWaterQuality();
    });
  }

  async init() {
    // Renderer
    this.renderer = new Renderer(this.container);

    // Scene + camera + lights + sky
    this.sceneManager = new SceneManager(this.renderer);

    // Physics
    this.physics = new PhysicsManager();
    await this.physics.init();

    // 3D models (gold coin, cake, …) — loaded from the local assets folder
    this.models = new ModelLoader();
    this.modelLoadError = null;
    try {
      await this.models.init(this.renderer.renderer);
      this.modelLoadError = this.models.lastError;
    } catch (err) {
      this.modelLoadError = err;
      console.warn('[models] Could not load 3D models from src/assets:', err);
    }

    // Player is a first-class actor (movement + camera are swappable controllers)
    this.player = new Player(this.sceneManager.camera, this.physics);
    this.player.engine = this;

    // Post-processing (bloom)
    this.renderer.setupPostProcessing(this.sceneManager.scene, this.sceneManager.camera);

    // Default level
    this.level = new DefaultLevel(this.sceneManager.scene, this.physics, this.environmentResources);

    // Visual effects (ember explosion, typhoon, …)
    this.vfx = new VFXManager(this);

    // Crosshair
    const ch = document.createElement('div');
    ch.id = 'crosshair';
    this.container.appendChild(ch);
    this._createFpsDisplay();

    // Object clicks: browser click → raycaster → GameObject._triggerClick
    this.container.addEventListener('click', this._onCanvasClick);

    // Start the loop
    this.running = true;
    this.clock.start();
    this._loop();
  }

  /**
   * Find the GameObject attached to a mesh (or one of its parents).
   * @param {THREE.Object3D} object
   * @returns {import('../api/GameObject.js').GameObject | null}
   */
  _gameObjectFromMesh(object) {
    let node = object;
    while (node) {
      const gameObject = node.userData?.gameObject;
      if (gameObject) return gameObject;
      node = node.parent;
    }
    return null;
  }

  /** Raycast from a browser click and notify the hit GameObject. */
  _handleClick(event) {
    if (!this.running || !this.sceneManager) return;

    const camera = this.sceneManager.camera;

    if (document.pointerLockElement) {
      // First-person: click aims from the crosshair (screen center)
      this._pointer.set(0, 0);
    } else {
      const rect = this.container.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      this._pointer.x = ((event.clientX - rect.left) / w) * 2 - 1;
      this._pointer.y = -((event.clientY - rect.top) / h) * 2 + 1;
    }

    this._raycaster.setFromCamera(this._pointer, camera);
    const hits = this._raycaster.intersectObjects(this.userMeshes, true);

    for (const intersection of hits) {
      const gameObject = this._gameObjectFromMesh(intersection.object);
      if (!gameObject || gameObject._destroyed) continue;
      gameObject._triggerClick({
        gameObject,
        point: intersection.point,
        distance: intersection.distance,
        object: intersection.object,
      });
      break;
    }
  }

  _actorFromColliderHandle(handle) {
    const actor = this.physics.actorFromColliderHandle(handle);
    if (actor && !actor._destroyed) return actor;
    const mesh = this.physics.meshFromColliderHandle(handle);
    return mesh ? this._gameObjectFromMesh(mesh) : null;
  }

  _notifyCollisionPair(a, b) {
    const otherA = b && !b._destroyed ? b : null;
    const otherB = a && !a._destroyed ? a : null;
    try { a?._triggerCollision(otherA); } catch { /* keep the loop going */ }
    try { b?._triggerCollision(otherB); } catch { /* keep the loop going */ }
  }

  /**
   * Notify actors that just started overlapping.
   * `other` is the other Actor (GameObject or Player), or null for ground / level props.
   * Character-controller contacts are merged in so walking into objects counts
   * even when the capsule does not generate a Rapier overlap event.
   */
  _dispatchCollisions() {
    const seen = new Set();
    const pairKey = (h1, h2) => (h1 < h2 ? `${h1}:${h2}` : `${h2}:${h1}`);

    const pairs = this.physics.consumeCollisionStarts();
    for (const [h1, h2] of pairs) {
      seen.add(pairKey(h1, h2));
      const a = this._actorFromColliderHandle(h1);
      const b = this._actorFromColliderHandle(h2);
      this._notifyCollisionPair(a, b);
    }

    const player = this.player;
    if (!player || player._destroyed) return;
    const playerHandle = player.getColliderHandle();
    const extraHandles = [
      ...player.consumeCharacterCollisionStarts(),
      ...player.consumeIntersectionStarts(),
    ];
    for (const otherHandle of extraHandles) {
      const key = pairKey(playerHandle, otherHandle);
      if (seen.has(key)) continue;
      seen.add(key);
      const other = this._actorFromColliderHandle(otherHandle);
      this._notifyCollisionPair(player, other);
    }
  }

  /** The active player actor. */
  getPlayer() {
    return this.player;
  }

  /** Logical gameplay water volumes supplied by the active level. */
  getWaterVolumes() {
    return this.level?.waterVolumes ?? [];
  }

  /** The single render/physics loop. Stops scheduling frames when paused. */
  _loop() {
    if (!this.running) {
      this._animId = null;
      return;
    }

    this._animId = requestAnimationFrame(() => this._loop());

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._updateFpsDisplay(dt);

    this.player.update(dt);
    this.physics.step(dt);
    this._dispatchCollisions();

    for (const cb of this.userUpdateCallbacks) {
      try { cb(dt); } catch (e) { /* swallow per-frame errors once */ }
    }

    this.vfx?.update(dt);
    this.level?.update?.(dt);
    updateGoldStars(this, dt);
    for (const coin of this.goldCoins ?? []) coin.updateCoin(dt);

    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
  }

  _createFpsDisplay() {
    if (!this.fpsDebug) return;
    const host = document.getElementById('viewport-pane');
    if (!host) return;
    const display = document.createElement('div');
    display.dataset.gameFps = '';
    display.textContent = 'FPS: --';
    display.style.cssText = 'position:absolute;left:10px;top:10px;z-index:10000;padding:5px 8px;color:#dff;font:bold 13px/1 monospace;background:rgba(5,24,38,.78);border:1px solid rgba(130,225,255,.4);border-radius:4px;pointer-events:none;';
    host.appendChild(display);
    this.fpsDisplay = display;
  }

  _updateFpsDisplay(dt) {
    if (!this.fpsDisplay || !Number.isFinite(dt) || dt <= 0) return;
    this.fpsElapsed += dt;
    this.fpsFrames += 1;
    if (this.fpsElapsed < 0.5) return;
    this.fpsDisplay.textContent = `FPS: ${Math.round(this.fpsFrames / this.fpsElapsed)}`;
    this.fpsElapsed = 0;
    this.fpsFrames = 0;
  }

  /** Get the Three.js scene */
  get scene() { return this.sceneManager.scene; }
  get camera() { return this.sceneManager.camera; }
  get RAPIER() { return this.physics.RAPIER; }

  // --- Lifecycle controls ---

  beginStudentRun() {
    const run = this.runs.begin();
    this.clearUserObjects();
    return run;
  }

  /** Load the selected environment, retaining shared resources across switches. */
  loadLevel(levelId = this.levelId) {
    this._validateLevelId(levelId);
    if (levelId !== this.levelId) {
      this.reset(levelId);
      return;
    }
    if (this.levelLoaded) return;
    this._applyWaterQuality();
    this.level.build();
    this.sceneManager.applyEnvironment?.(this.level.environment ?? 'day');
    const config = CHALLENGE_LEVEL_CONFIG[this.levelId.replace('challenge-', '')];
    if (config) {
      this.player.setPlayerPosition(config.playerPosition);
      this.player.setPlayerDirection(config.playerDirection);
    }
    this.levelLoaded = true;
    this.vfx?.retainTyphoonTextures();
  }

  _applyWaterQuality() {
    const profile = GRAPHICS_PROFILES[appSettings.get('graphicsProfile')]
      || GRAPHICS_PROFILES.medium;
    this.level?.setWaterQuality?.(profile.waterQuality);
  }

  _validateLevelId(levelId) {
    if (levelId !== 'default' && !Object.hasOwn(CHALLENGE_LEVEL_CLASSES, levelId)) throw new Error(`Unknown level: ${levelId}`);
  }

  /** Clear everything user-created but keep the level */
  clearUserObjects() {
    this.audio.stopSfx();
    clearGoldStars(this);
    const roots = [...this.userMeshes];
    for (const obj of roots) {
      const gameObject = obj.userData?.gameObject;
      if (gameObject && !gameObject._destroyed) {
        gameObject.destroy();
        continue;
      }
      if (obj._physicsId !== undefined) {
        this.physics.removeDynamic(obj._physicsId);
      }
      if (obj._kinematicId !== undefined) {
        this.physics.removeKinematic(obj._kinematicId);
      } else if (obj._sensorId !== undefined) {
        this.physics.removeSensor(obj._sensorId);
      }
      this.sceneManager.scene.remove(obj);
    }
    this.userMeshes = [];
    this.userUpdateCallbacks = [];
    this.vfx?.clear();
  }

  /** Full reset – clears user objects, rebuilds level, resets player */
  reset(levelId = this.levelId) {
    this._validateLevelId(levelId);
    this.runs.invalidate();
    this.clearUserObjects();
    this.vfx?.releaseTyphoonTextures();
    this.level.clear();
    this.player.dispose();
    this.physics.reset();
    if (levelId !== this.levelId) {
      const Level = levelId === 'default' ? DefaultLevel : CHALLENGE_LEVEL_CLASSES[levelId];
      this.level = new Level(this.scene, this.physics, this.environmentResources, {
        sunWorldPosition: this.sceneManager.sunMesh?.position,
      });
      this.levelId = levelId;
    }
    this.player = new Player(this.sceneManager.camera, this.physics);
    this.player.engine = this;
    this.levelLoaded = false;
    this.loadLevel();
    this.resume();
  }

  /** Clear the entire scene (including level) */
  clearScene() {
    this.runs.invalidate();
    this.clearUserObjects();
    this.vfx?.releaseTyphoonTextures();
    this.level.clear();
    this.sceneManager.applyEnvironment?.('day');
    this.player.dispose();
    this.physics.reset();
    this.player = new Player(this.sceneManager.camera, this.physics);
    this.player.engine = this;
    this.levelLoaded = false;
    this.resume();
  }

  /** Fully halt simulation, input, and rendering. Last frame stays on screen. */
  stop() {
    this.audio.stopSfx();
    this.running = false;
    this.userUpdateCallbacks = [];
    this.player?.setEnabled(false);
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  resume() {
    this.player?.setEnabled(true);
    if (this.running && this._animId) return;
    this.running = true;
    this.clock.getDelta();
    this._loop();
  }
}

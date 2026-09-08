/**
 * GameObject.js – Beginner-friendly wrapper around a Three.js object + Rapier body.
 *
 * Physics and collision are separate on purpose:
 *   enablePhysics()  – gravity, bouncing, being pushed around
 *   enableCollision() – notice when something touches this object
 *
 * Collectibles (gold coin, cake) use collision (so you can collect them)
 * without physics (so they do not fall or get knocked away).
 */
import * as THREE from 'three';
import { Actor } from '../engine/Actor.js';

function firstMesh(root) {
  if (root?.isMesh) return root;
  let found = null;
  root?.traverse?.((child) => {
    if (!found && child.isMesh) found = child;
  });
  return found;
}

function forEachMaterial(root, fn) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (mat) fn(mat);
    }
  });
}

export class GameObject extends Actor {
  /**
   * @param {THREE.Object3D} mesh  A single mesh or a whole GLB group
   * @param {import('../engine/GameEngine.js').GameEngine} engine
   * @param {object} [physicsInfo] – { id, body, collider } if physics-enabled
   * @param {object} [opts]
   */
  constructor(mesh, engine, physicsInfo = null, opts = {}) {
    super();
    this.mesh = mesh;
    this.engine = engine;
    this._physicsInfo = physicsInfo;
    this._kinematicInfo = null;
    this._name = mesh.name || '';
    this._onClick = null;
    this._ownsGeometry = opts.ownsGeometry !== false;
    this._colliderParts = opts.colliderParts || null;
    // Collision detection is its own switch — not tied to gravity.
    this._collisionEnabled = !!opts.collision;

    // Let the engine's raycaster find this GameObject from the mesh
    mesh.userData.gameObject = this;

    if (physicsInfo) {
      mesh._physicsId = physicsInfo.id;
      this._registerColliders(physicsInfo);
    }

    engine.userMeshes.push(mesh);

    if (!physicsInfo && this._collisionEnabled) {
      this._ensureKinematicColliders();
    }
  }

  _registerColliders(info) {
    const cols = info.colliders || (info.collider ? [info.collider] : []);
    for (const col of cols) {
      this.engine.physics.registerActorCollider(col, this);
    }
  }

  _unregisterColliders(info) {
    if (!info) return;
    const cols = info.colliders || (info.collider ? [info.collider] : []);
    for (const col of cols) {
      this.engine.physics.unregisterActorCollider(col);
    }
  }

  // --- Position (proxy to mesh.position) ---
  get position() { return this.mesh.position; }

  // --- Rotation (proxy to mesh.rotation) ---
  get rotation() { return this.mesh.rotation; }

  // --- Scale (proxy to mesh.scale) ---
  get scale() { return this.mesh.scale; }

  // --- Name ---
  get name() { return this._name; }
  set name(v) { this._name = v; this.mesh.name = v; }

  // --- Color ---
  get color() {
    let hex = null;
    forEachMaterial(this.mesh, (mat) => {
      if (hex == null && mat.color) hex = '#' + mat.color.getHexString();
    });
    return hex || '#ffffff';
  }
  set color(val) {
    forEachMaterial(this.mesh, (mat) => {
      if (mat.color) mat.color.set(val);
    });
  }
  setColor(val) {
    this.color = val;
    return this;
  }

  // --- Scale helpers ---
  setScale(x, y, z) {
    if (y === undefined) { y = x; z = x; }
    this.mesh.scale.set(x, y, z);
    this._rebuildColliders();
    return this;
  }

  // --- Rotation in degrees ---
  rotate(x, y, z) {
    const d = Math.PI / 180;
    this.mesh.rotation.x += x * d;
    this.mesh.rotation.y += y * d;
    this.mesh.rotation.z += z * d;
    return this;
  }

  // --- Physics (gravity + being pushed) ---
  get physicsEnabled() {
    return !!this._physicsInfo;
  }

  get collisionEnabled() {
    return this._collisionEnabled;
  }

  get mass() {
    return this._physicsInfo ? this._physicsInfo.body.mass() : 0;
  }
  set mass(val) {
    if (this._physicsInfo) this._physicsInfo.body.setAdditionalMass(val);
  }
  set bounciness(val) {
    if (!this._physicsInfo) return;
    for (const col of this._physicsInfo.colliders || [this._physicsInfo.collider]) {
      col?.setRestitution(val);
    }
  }
  set friction(val) {
    if (!this._physicsInfo) return;
    for (const col of this._physicsInfo.colliders || [this._physicsInfo.collider]) {
      col?.setFriction(val);
    }
  }

  _scaledCuboidDesc(part, pad = 1) {
    const RAPIER = this.engine.RAPIER;
    const s = this.mesh.scale;
    const hx = Math.max(part.hx * Math.abs(s.x) * pad, 0.05);
    const hy = Math.max(part.hy * Math.abs(s.y) * pad, 0.05);
    const hz = Math.max(part.hz * Math.abs(s.z) * pad, 0.05);
    return RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(part.tx * s.x, part.ty * s.y, part.tz * s.z);
  }

  _scaledTrimeshDesc(part) {
    const RAPIER = this.engine.RAPIER;
    if (!part.vertices || !part.indices) return null;
    const s = this.mesh.scale;
    const vertices = new Float32Array(part.vertices.length);
    for (let i = 0; i < part.vertices.length; i += 3) {
      vertices[i] = part.vertices[i] * s.x;
      vertices[i + 1] = part.vertices[i + 1] * s.y;
      vertices[i + 2] = part.vertices[i + 2] * s.z;
    }
    return RAPIER.ColliderDesc.trimesh(vertices, part.indices);
  }

  /**
   * Build Rapier collider descriptions for this object.
   * asSensors: true  → ITEM_* / visual bounds detect only (player walks through)
   * asSensors: false → used with enablePhysics (object can fall and be solid)
   * COL_* is always solid and never a sensor.
   */
  _buildColliderSetups({ asSensors }) {
    const parts = this._colliderParts;
    if (parts && parts.length) {
      const setups = [];
      for (const part of parts) {
        const isCol = part.role === 'col';
        // ITEM_* / visual bounds: skip when collision detection is off
        if (!isCol && asSensors && !this._collisionEnabled) continue;
        const sensor = isCol ? false : asSensors;
        let desc = null;
        if (isCol && asSensors) {
          desc = this._scaledTrimeshDesc(part) || this._scaledCuboidDesc(part);
        } else {
          desc = this._scaledCuboidDesc(part);
        }
        if (desc) setups.push({ desc, sensor });
      }
      return setups;
    }
    return [{ desc: this._colliderDescFromMesh(asSensors ? 1 : 1), sensor: asSensors }];
  }

  _colliderDescFromMesh(pad = 1) {
    const RAPIER = this.engine.RAPIER;
    const visual = firstMesh(this.mesh);
    const geo = visual?.geometry;
    if (geo?.type === 'SphereGeometry') {
      const r = geo.parameters.radius * this.mesh.scale.x * pad;
      return RAPIER.ColliderDesc.ball(Math.max(r, 0.05));
    }
    if (geo?.type === 'CylinderGeometry') {
      const r = geo.parameters.radiusTop * this.mesh.scale.x * pad;
      const h = geo.parameters.height * this.mesh.scale.y / 2 * pad;
      return RAPIER.ColliderDesc.cylinder(Math.max(h, 0.05), Math.max(r, 0.05));
    }
    if (geo?.type === 'ConeGeometry') {
      const r = geo.parameters.radius * this.mesh.scale.x * pad;
      const h = geo.parameters.height * this.mesh.scale.y / 2 * pad;
      return RAPIER.ColliderDesc.cone(Math.max(h, 0.05), Math.max(r, 0.05));
    }
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return RAPIER.ColliderDesc.cuboid(
      Math.max(size.x / 2 * pad, 0.05),
      Math.max(size.y / 2 * pad, 0.05),
      Math.max(size.z / 2 * pad, 0.05)
    );
  }

  /** Hidden colliders that follow the object: ITEM_* children (detect-only) and COL_* children (solid). */
  _ensureKinematicColliders() {
    if (this._physicsInfo || this._kinematicInfo || this._destroyed) return;
    if (!this._collisionEnabled && !this._hasColParts()) return;

    const setups = this._buildColliderSetups({ asSensors: true });
    if (!setups.length) return;

    const info = this.engine.physics.addKinematic(this.mesh, setups);
    this._kinematicInfo = info;
    this.mesh._kinematicId = info.id;
    this.mesh._sensorId = info.id;
    this._registerColliders(info);
  }

  _hasColParts() {
    return !!(this._colliderParts && this._colliderParts.some((part) => part.role === 'col'));
  }

  _removeKinematicColliders() {
    if (!this._kinematicInfo) return;
    this._unregisterColliders(this._kinematicInfo);
    this.engine.physics.removeKinematic(this._kinematicInfo.id);
    this._kinematicInfo = null;
    delete this.mesh._kinematicId;
    delete this.mesh._sensorId;
  }

  _rebuildColliders() {
    if (this._destroyed) return;
    if (this._physicsInfo) {
      this.enablePhysics({ mass: this._physicsInfo.body.mass() });
      return;
    }
    if (this._kinematicInfo || this._collisionEnabled || this._hasColParts()) {
      this._removeKinematicColliders();
      this._ensureKinematicColliders();
    }
  }

  /**
   * Start noticing when something touches this object.
   * Does NOT make the object fall. The player can walk through ITEM_ volumes.
   */
  enableCollision() {
    if (this._destroyed) return this;
    this._collisionEnabled = true;
    if (!this._physicsInfo) this._ensureKinematicColliders();
    return this;
  }

  /**
   * Stop noticing touches. Physics (falling) is unchanged.
   * COL_* helper meshes stay solid so authored walls still block.
   */
  disableCollision() {
    if (this._destroyed) return this;
    this._collisionEnabled = false;
    if (this._physicsInfo) return this;
    this._removeKinematicColliders();
    if (this._hasColParts()) this._ensureKinematicColliders();
    return this;
  }

  /**
   * Turn collision detection on or off.
   * Example: coin.setCollision({ enabled: true })
   */
  setCollision(opts) {
    if (opts === true) return this.enableCollision();
    if (opts === false) return this.disableCollision();
    if (!opts || typeof opts !== 'object') return this;
    if (opts.enabled === false) return this.disableCollision();
    if (opts.enabled === true) return this.enableCollision();
    return this;
  }

  /**
   * Make this object fall, bounce, and get pushed.
   * Also makes it solid (the player cannot walk through it).
   */
  enablePhysics(opts = {}) {
    if (this._destroyed) return this;
    this._removeKinematicColliders();
    if (this._physicsInfo) {
      this._unregisterColliders(this._physicsInfo);
      this.engine.physics.removeDynamic(this._physicsInfo.id);
      this._physicsInfo = null;
      delete this.mesh._physicsId;
    }

    const setups = this._buildColliderSetups({ asSensors: false });
    if (!setups.length) {
      setups.push({ desc: this._colliderDescFromMesh(), sensor: false });
    }
    const visual = firstMesh(this.mesh);
    const geoType = visual?.geometry?.type;
    const info = this.engine.physics.addDynamic(this.mesh, setups[0].desc, {
      mass: opts.mass,
      restitution: opts.restitution ?? opts.bounciness ?? 0.12,
      friction: opts.friction ?? 0.9,
      linearDamping: opts.linearDamping ?? (geoType === 'SphereGeometry' ? 0.6 : 0.5),
      angularDamping: opts.angularDamping ?? (geoType === 'SphereGeometry' ? 2.2 : 1.0),
      extraColliders: setups.slice(1),
    });
    this._physicsInfo = info;
    this.mesh._physicsId = info.id;
    this._registerColliders(info);
    return this;
  }

  /**
   * Stop gravity and being pushed. Collision detection stays on if you
   * already called enableCollision() or onCollision().
   */
  disablePhysics() {
    if (!this._physicsInfo) return this;
    this._unregisterColliders(this._physicsInfo);
    this.engine.physics.removeDynamic(this._physicsInfo.id);
    this._physicsInfo = null;
    delete this.mesh._physicsId;
    if (this._collisionEnabled || this._hasColParts()) this._ensureKinematicColliders();
    return this;
  }

  setPhysics(opts) {
    if (opts === false) return this.disablePhysics();
    if (opts === true) return this.enablePhysics();
    if (!opts || typeof opts !== 'object') return this;
    if (opts.enabled === false) return this.disablePhysics();
    this.enablePhysics(opts);
    if (opts.mass !== undefined) this.mass = opts.mass;
    if (opts.bounciness !== undefined) this.bounciness = opts.bounciness;
    if (opts.friction !== undefined) this.friction = opts.friction;
    return this;
  }

  // --- Events ---
  onClick(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onClick() expects a function');
    }
    this._onClick = fn;
    return this;
  }

  /** Engine-only: invoke the stored click callback. */
  _triggerClick(event) {
    if (this._destroyed) return;
    this._onClick?.(event);
  }

  onCollision(fn) {
    super.onCollision(fn);
    this.enableCollision();
    return this;
  }

  // --- Destroy ---
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._onClick = null;
    this._onCollision = null;
    if (this.mesh.userData) delete this.mesh.userData.gameObject;
    if (this._physicsInfo) {
      this._unregisterColliders(this._physicsInfo);
      this.engine.physics.removeDynamic(this._physicsInfo.id);
      this._physicsInfo = null;
    }
    this._removeKinematicColliders();
    this.engine.sceneManager.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (!child.isMesh) return;
      if (this._ownsGeometry && child.geometry) child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat?.dispose?.();
    });
    const idx = this.engine.userMeshes.indexOf(this.mesh);
    if (idx !== -1) this.engine.userMeshes.splice(idx, 1);
  }
}

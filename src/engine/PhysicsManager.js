/**
 * PhysicsManager.js – Initializes Rapier physics world and synchronizes
 * physics bodies with Three.js meshes every frame.
 *
 * Two kinds of moving colliders:
 *   Dynamic   – gravity, bouncing, being pushed (enablePhysics).
 *   Kinematic – follows the mesh. Can be a sensor (detect only, like ITEM_)
 *               or solid (stops the player, like COL_).
 */
import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsManager {
  constructor() {
    this.world = null;
    this.ready = false;
    /** @type {Map<number, {body: any, mesh: import('three').Object3D, collider: any, colliders: any[]}>} */
    this.bodies = new Map();
    this._nextId = 0;
    /** @type {Map<number, import('three').Object3D>} */
    this._colliderToMesh = new Map();
    /** @type {Map<number, import('./Actor.js').Actor>} */
    this._colliderToActor = new Map();
    /** @type {Map<number, {body: any, mesh: import('three').Object3D, collider: any, colliders: any[]}>} */
    this.kinematics = new Map();
    /** @type {Array<[number, number]>} collider-handle pairs that started contact this step */
    this._pendingCollisionStarts = [];
    this._eventQueue = null;
  }

  /** @deprecated use kinematics – kept so older loops still work */
  get sensors() {
    return this.kinematics;
  }

  /** Must be called before use – initializes WASM */
  async init() {
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this._eventQueue = new RAPIER.EventQueue(true);
    this.ready = true;
  }

  /** Create a static cuboid collider (no rigid body motion) */
  addStaticBox(hx, hy, hz, px, py, pz) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(0.9)
      .setFrictionCombineRule(this.RAPIER.CoefficientCombineRule.Max);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  _createColliderOnBody(body, colliderDesc, { sensor = false, friction, restitution } = {}) {
    if (sensor) colliderDesc.setSensor(true);
    if (friction !== undefined) {
      colliderDesc
        .setFriction(friction)
        .setFrictionCombineRule(this.RAPIER.CoefficientCombineRule.Max);
    }
    if (restitution !== undefined) colliderDesc.setRestitution(restitution);
    const col = this.world.createCollider(colliderDesc, body);
    this._enableGameplayCollisions(col);
    return col;
  }

  /**
   * Add a dynamic body tied to a Three.js mesh. Returns an id for cleanup.
   * @param {import('three').Object3D} mesh
   * @param {any} colliderDesc  Rapier ColliderDesc, or the first of several
   * @param {object} [opts]
   * @param {Array<{ desc: any, sensor?: boolean }>} [opts.extraColliders]
   */
  addDynamic(mesh, colliderDesc, opts = {}) {
    const p = mesh.position;
    const friction = opts.friction ?? 0.9;
    const restitution = opts.restitution ?? 0.12;
    const linearDamping = opts.linearDamping ?? 0.5;
    const angularDamping = opts.angularDamping ?? 1.2;

    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z)
      .setLinearDamping(linearDamping)
      .setAngularDamping(angularDamping)
      .setCanSleep(true);
    const body = this.world.createRigidBody(bodyDesc);

    if (opts.mass !== undefined) body.setAdditionalMass(opts.mass);

    const q = mesh.quaternion;
    body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);

    const colliders = [];
    const first = this._createColliderOnBody(body, colliderDesc, {
      sensor: false,
      friction,
      restitution,
    });
    colliders.push(first);
    this._colliderToMesh.set(first.handle, mesh);

    for (const extra of opts.extraColliders || []) {
      const col = this._createColliderOnBody(body, extra.desc, {
        sensor: !!extra.sensor,
        friction,
        restitution,
      });
      colliders.push(col);
      this._colliderToMesh.set(col.handle, mesh);
    }

    const id = this._nextId++;
    this.bodies.set(id, { body, mesh, collider: colliders[0], colliders });
    return { id, body, collider: colliders[0], colliders };
  }

  /**
   * Mesh-following body. Sensors detect touches without blocking.
   * Solid kinematic colliders (COL_*) stop the player but ignore gravity.
   * @param {import('three').Object3D} mesh
   * @param {Array<{ desc: any, sensor?: boolean }>} setups
   */
  addKinematic(mesh, setups) {
    const list = Array.isArray(setups) ? setups : [{ desc: setups, sensor: true }];
    const p = mesh.position;
    const q = mesh.quaternion;
    const bodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(p.x, p.y, p.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = this.world.createRigidBody(bodyDesc);

    const colliders = [];
    for (const setup of list) {
      const col = this._createColliderOnBody(body, setup.desc, {
        sensor: setup.sensor !== false,
      });
      colliders.push(col);
      this._colliderToMesh.set(col.handle, mesh);
    }

    const id = this._nextId++;
    const entry = { body, mesh, collider: colliders[0], colliders };
    this.kinematics.set(id, entry);
    return { id, body, collider: colliders[0], colliders };
  }

  /**
   * Non-blocking sensor collider tied to a mesh. Used so onCollision works
   * without making the object a falling physics body.
   */
  addSensor(mesh, colliderDesc) {
    return this.addKinematic(mesh, [{ desc: colliderDesc, sensor: true }]);
  }

  removeKinematic(id) {
    const entry = this.kinematics.get(id);
    if (!entry) return;
    for (const col of entry.colliders || [entry.collider]) {
      if (!col) continue;
      this._colliderToMesh.delete(col.handle);
      this._colliderToActor.delete(col.handle);
    }
    this.world.removeRigidBody(entry.body);
    this.kinematics.delete(id);
  }

  removeSensor(id) {
    this.removeKinematic(id);
  }

  /** Sensor colliders (ITEM_* / enableCollision) for overlap checks. */
  getSensorColliders() {
    const list = [];
    for (const entry of this.kinematics.values()) {
      for (const col of entry.colliders || [entry.collider]) {
        if (col && col.isSensor()) list.push(col);
      }
    }
    return list;
  }

  /**
   * Rapier's default collision types skip kinematic↔kinematic and kinematic↔fixed.
   * The player is kinematic, so collectible sensors would never generate events
   * without enabling all body-type pairs.
   */
  _enableGameplayCollisions(collider) {
    collider.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);
    collider.setActiveCollisionTypes(this.RAPIER.ActiveCollisionTypes.ALL);
  }

  registerActorCollider(collider, actor) {
    if (!collider || !actor) return;
    this._colliderToActor.set(collider.handle, actor);
  }

  unregisterActorCollider(collider) {
    if (!collider) return;
    this._colliderToActor.delete(collider.handle);
  }

  /** Mesh attached to a Rapier collider, if any. */
  meshFromColliderHandle(handle) {
    return this._colliderToMesh.get(handle) ?? null;
  }

  /** Gameplay actor (GameObject or Player) attached to a collider, if any. */
  actorFromColliderHandle(handle) {
    return this._colliderToActor.get(handle) ?? null;
  }

  /** Collision-start pairs from the last step: [handleA, handleB]. */
  consumeCollisionStarts() {
    const pairs = this._pendingCollisionStarts;
    this._pendingCollisionStarts = [];
    return pairs;
  }

  /** Remove a dynamic body by its id */
  removeDynamic(id) {
    const entry = this.bodies.get(id);
    if (!entry) return;
    for (const col of entry.colliders || [entry.collider]) {
      if (!col) continue;
      this._colliderToMesh.delete(col.handle);
      this._colliderToActor.delete(col.handle);
    }
    this.world.removeRigidBody(entry.body);
    this.bodies.delete(id);
  }

  /** Step physics and sync meshes */
  step(dt) {
    if (!this.ready) return;

    // Kinematic bodies (sensors + COL_* solids) follow their mesh
    for (const { body, mesh } of this.kinematics.values()) {
      const p = mesh.position;
      const q = mesh.quaternion;
      body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step(this._eventQueue);

    this._pendingCollisionStarts = [];
    this._eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started) this._pendingCollisionStarts.push([handle1, handle2]);
    });

    // Sync mesh transforms from physics bodies
    for (const { body, mesh } of this.bodies.values()) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Remove ALL dynamic + kinematic bodies (but keep statics for the level) */
  clearDynamics() {
    for (const [id] of this.bodies) {
      this.removeDynamic(id);
    }
    for (const [id] of this.kinematics) {
      this.removeKinematic(id);
    }
  }

  /** Full reset – rebuilds the world */
  reset() {
    if (this.world) {
      this.world.free();
    }
    this.world = new this.RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.bodies.clear();
    this.kinematics.clear();
    this._colliderToMesh.clear();
    this._colliderToActor.clear();
    this._pendingCollisionStarts = [];
    this._eventQueue?.clear();
    this._nextId = 0;
  }

  /** Create a character controller for the player */
  createCharacterController(offset) {
    return this.world.createCharacterController(offset);
  }
}

/**
 * DefaultLevel.js – Builds the default playground: ground, platforms, ramps,
 * steps, and some scattered physics objects for kids to push around.
 */
import * as THREE from 'three';
import { createToyBoxGeometry, createToySphereGeometry, createPrimitiveMaterial } from './primitiveStyle.js';
import { EnvironmentResources } from './EnvironmentResources.js';

// 140² versus the original 200²: 51% less ground area, with full-size obstacles.
const LEVEL_SIZE = 140;
const PALETTE = {
  ground: 0x52b86c,
  wall: 0x326d99,
  teal: 0x12b8b0,
  blue: 0x3284e8,
  lavender: 0x9155d9,
  coral: 0xf06449,
  yellow: 0xf4bd28,
};

export class DefaultLevel {
  constructor(scene, physics, resources = new EnvironmentResources()) {
    this.scene = scene;
    this.physics = physics;
    this.resources = resources;
    /** Meshes owned by the level (for cleanup) */
    this.meshes = [];
    this.physicsBodies = [];
    this.dynamicIds = [];
    this.privateMeshes = new Set();
  }

  /** Build everything and add to scene + physics world */
  build() {
    if (this.meshes.length) return;
    this._buildGround();
    this._buildPlatforms();
    this._buildSteps();
    this._buildRamp();
    this._buildWalls();
    this._buildPhysicsObjects();
  }

  /** Remove all level meshes from scene */
  clear() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (this.privateMeshes.has(m)) {
        m.geometry.dispose();
        m.material.dispose();
      }
    }
    for (const id of this.dynamicIds) this.physics.removeDynamic(id);
    for (const body of this.physicsBodies) this.physics.world.removeRigidBody(body);
    this.meshes = [];
    this.physicsBodies = [];
    this.dynamicIds = [];
    this.privateMeshes.clear();
  }

  // --- Private builders ---

  _addBox(w, h, d, x, y, z, color, isStatic = true, rounded = true) {
    const geo = this.resources.box(w, h, d, rounded);
    const mat = this.resources.material(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    if (isStatic) {
      this.physicsBodies.push(this.physics.addStaticBox(w / 2, h / 2, d / 2, x, y, z));
    }
    return mesh;
  }

  _buildGround() {
    this._addBox(LEVEL_SIZE, 1, LEVEL_SIZE, 0, -0.5, 0, PALETTE.ground, true, false);
  }

  _buildPlatforms() {
    // Floating platforms at various heights
    this._addBox(4, 0.5, 4, -7, 2, -7, PALETTE.blue);
    this._addBox(3, 0.5, 3, -3.5, 4, -10.5, PALETTE.lavender);
    this._addBox(5, 0.5, 2, 0, 6, -14, PALETTE.coral);
    this._addBox(3, 0.5, 3, 5.5, 3, -9, PALETTE.teal);
    this._addBox(6, 0.5, 6, 11, 1.5, -5, PALETTE.yellow);
    // High platform
    this._addBox(4, 0.5, 4, -9, 8, -16, PALETTE.coral);
  }

  _buildSteps() {
    // Staircase leading up
    for (let i = 0; i < 6; i++) {
      this._addBox(2, 0.5, 2, -12 + i * 1.2, i * 0.6 + 0.3, -3, PALETTE.blue);
    }
  }

  _buildRamp() {
    // Simple wedge ramp using a thin rotated box
    const geo = this.resources.box(3, 0.3, 8);
    const mat = this.resources.material(PALETTE.yellow);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(8, 1.5, -12);
    mesh.rotation.x = -Math.PI * 0.12;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    // Approximate ramp collider as a static box (slightly tilted)
    const RAPIER = this.physics.RAPIER;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(8, 1.5, -12)
      .setRotation({ x: Math.sin(-Math.PI * 0.06), y: 0, z: 0, w: Math.cos(-Math.PI * 0.06) });
    const body = this.physics.world.createRigidBody(bodyDesc);
    this.physicsBodies.push(body);
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, 0.15, 4)
        .setFriction(0.9)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body
    );
  }

  _buildWalls() {
    // Border walls so kids don't fall off the edge easily
    const edge = LEVEL_SIZE / 2;
    this._addBox(LEVEL_SIZE, 3, 1, 0, 1.5, -edge, PALETTE.wall, true, false);
    this._addBox(LEVEL_SIZE, 3, 1, 0, 1.5, edge, PALETTE.wall, true, false);
    this._addBox(1, 3, LEVEL_SIZE, -edge, 1.5, 0, PALETTE.wall, true, false);
    this._addBox(1, 3, LEVEL_SIZE, edge, 1.5, 0, PALETTE.wall, true, false);
  }

  _buildPhysicsObjects() {
    // Scatter some dynamic cubes and spheres around the playground
    const RAPIER = this.physics.RAPIER;
    const colors = [PALETTE.coral, PALETTE.teal, PALETTE.blue, PALETTE.yellow, PALETTE.lavender];

    // Cubes
    for (let i = 0; i < 6; i++) {
      const size = 0.5 + Math.random() * 0.5;
      const geo = createToyBoxGeometry(size, size, size);
      const mat = createPrimitiveMaterial(colors[i % colors.length]);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-3 + i * 1.5, 1 + Math.random() * 2, -5 + Math.random() * 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.privateMeshes.add(mesh);
      const info = this.physics.addDynamic(mesh, RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2), {
        restitution: 0.12, friction: 0.9, linearDamping: 0.5, angularDamping: 1.0,
      });
      this.dynamicIds.push(info.id);
    }

    // Spheres
    for (let i = 0; i < 4; i++) {
      const r = 0.3 + Math.random() * 0.3;
      const geo = createToySphereGeometry(r);
      const mat = createPrimitiveMaterial(colors[(i + 3) % colors.length], 0.38);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(2 + i * 1.5, 2, -7);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.privateMeshes.add(mesh);
      const info = this.physics.addDynamic(mesh, RAPIER.ColliderDesc.ball(r), {
        restitution: 0.15, friction: 1.0, linearDamping: 0.6, angularDamping: 2.2,
      });
      this.dynamicIds.push(info.id);
    }
  }
}

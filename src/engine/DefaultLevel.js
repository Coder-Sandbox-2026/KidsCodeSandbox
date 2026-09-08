/**
 * DefaultLevel.js – Builds the default playground: ground, platforms, ramps,
 * steps, and some scattered physics objects for kids to push around.
 */
import * as THREE from 'three';

export class DefaultLevel {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    /** Meshes owned by the level (for cleanup) */
    this.meshes = [];
  }

  /** Build everything and add to scene + physics world */
  build() {
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
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    this.meshes = [];
  }

  // --- Private builders ---

  _addBox(w, h, d, x, y, z, color, isStatic = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    if (isStatic) {
      this.physics.addStaticBox(w / 2, h / 2, d / 2, x, y, z);
    }
    return mesh;
  }

  _buildGround() {
    // Big green ground
    this._addBox(200, 1, 200, 0, -0.5, 0, 0x44aa44);

    // Grid helper on top
    const grid = new THREE.GridHelper(200, 100, 0x338833, 0x338833);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    this.scene.add(grid);
    this.meshes.push(grid);
  }

  _buildPlatforms() {
    // Floating platforms at various heights
    this._addBox(4, 0.5, 4, -8, 2, -8, 0x6699cc);
    this._addBox(3, 0.5, 3, -4, 4, -12, 0x9966cc);
    this._addBox(5, 0.5, 2, 0, 6, -15, 0xcc6699);
    this._addBox(3, 0.5, 3, 6, 3, -10, 0x66cccc);
    this._addBox(6, 0.5, 6, 12, 1.5, -6, 0xccaa66);
    // High platform
    this._addBox(4, 0.5, 4, -10, 8, -18, 0xee8866);
  }

  _buildSteps() {
    // Staircase leading up
    for (let i = 0; i < 6; i++) {
      this._addBox(2, 0.5, 2, -14 + i * 1.2, i * 0.6 + 0.3, -4, 0x88aacc);
    }
  }

  _buildRamp() {
    // Simple wedge ramp using a thin rotated box
    const geo = new THREE.BoxGeometry(3, 0.3, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccc66, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(8, 1.5, -14);
    mesh.rotation.x = -Math.PI * 0.12;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    // Approximate ramp collider as a static box (slightly tilted)
    const RAPIER = this.physics.RAPIER;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(8, 1.5, -14)
      .setRotation({ x: Math.sin(-Math.PI * 0.06), y: 0, z: 0, w: Math.cos(-Math.PI * 0.06) });
    const body = this.physics.world.createRigidBody(bodyDesc);
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, 0.15, 4)
        .setFriction(0.9)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body
    );
  }

  _buildWalls() {
    // Border walls so kids don't fall off the edge easily
    this._addBox(200, 3, 1, 0, 1.5, -100, 0x555555);
    this._addBox(200, 3, 1, 0, 1.5, 100, 0x555555);
    this._addBox(1, 3, 200, -100, 1.5, 0, 0x555555);
    this._addBox(1, 3, 200, 100, 1.5, 0, 0x555555);
  }

  _buildPhysicsObjects() {
    // Scatter some dynamic cubes and spheres around the playground
    const RAPIER = this.physics.RAPIER;
    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffaa00, 0xff44ff, 0x44ffff];

    // Cubes
    for (let i = 0; i < 6; i++) {
      const size = 0.5 + Math.random() * 0.5;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-3 + i * 1.5, 1 + Math.random() * 2, -6 + Math.random() * 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.physics.addDynamic(mesh, RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2), {
        restitution: 0.12, friction: 0.9, linearDamping: 0.5, angularDamping: 1.0,
      });
    }

    // Spheres
    for (let i = 0; i < 4; i++) {
      const r = 0.3 + Math.random() * 0.3;
      const geo = new THREE.SphereGeometry(r, 20, 20);
      const mat = new THREE.MeshStandardMaterial({ color: colors[(i + 3) % colors.length], roughness: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(2 + i * 1.5, 2, -8);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.physics.addDynamic(mesh, RAPIER.ColliderDesc.ball(r), {
        restitution: 0.15, friction: 1.0, linearDamping: 0.6, angularDamping: 2.2,
      });
    }
  }
}

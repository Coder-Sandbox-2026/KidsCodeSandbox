import * as THREE from 'three';
import { EnvironmentResources } from './EnvironmentResources.js';

const SIZE = 140;
const COLORS = {
  grass: 0x52b86c, border: 0x326d99, trunk: 0x9e5b24,
  foliage: 0x239951, foliageLight: 0x38b869, rock: 0x8396ae,
  cliff: 0x7186aa, teal: 0x00bed3, yellow: 0xffca28,
};

export class ChallengeLevel1 {
  constructor(scene, physics, resources = new EnvironmentResources(), { sunWorldPosition } = {}) {
    this.scene = scene;
    this.physics = physics;
    this.resources = resources;
    this.sunWorldPosition = sunWorldPosition;
    this.environment = 'day';
    this.meshes = [];
    this.physicsBodies = [];
  }

  _mesh(geometry, material, x, y, z, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  _box(w, h, d, x, y, z, color, rounded = true) {
    const mesh = this._mesh(this.resources.box(w, h, d, rounded), this.resources.material(color), x, y, z);
    this.physicsBodies.push(this.physics.addStaticBox(w / 2, h / 2, d / 2, x, y, z));
    return mesh;
  }

  /** Checker grass supplies the visible top; retain box sides and collision. */
  _checkerBase(w, h, d, x, y, z, color) {
    const mesh = this._box(w, h, d, x, y, z, color, false);
    mesh.geometry = this.resources.boxWithoutTop(w, h, d);
    return mesh;
  }

  _terrainInstances(name, material, placements, geometry = this.resources.box(1, 1, 1, false)) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const transform = new THREE.Object3D();
    placements.forEach(([x, y, z, w, h, d, angle = 0], i) => {
      transform.position.set(x, y, z);
      transform.scale.set(w, h, d);
      transform.rotation.y = angle;
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.name = name;
    mesh.receiveShadow = true;
    // Decorative only: no shadow-map draw and no additional physics bodies.
    this.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  _terrainDetails(cap) {
    const rock = this.resources.terrainMaterial('cliffRock');
    // Box groups: +X, -X, +Y, -Y, +Z, -Z. Only +Y is grass.
    cap.material = [rock, rock, this.resources.terrainMaterial('grassDark'), rock, rock, rock];
    cap.name = 'cliffGrassCap';
    this._terrainInstances('cliffGrassRim', this.resources.terrainMaterial('grassEdge'), [
      [15.4, 4.0125, -23, 0.6, 0.025, 13.8],
      [32.6, 4.0125, -23, 0.6, 0.025, 13.8],
      [24, 4.0125, -16.4, 17.2, 0.025, 0.6],
      [24, 4.0125, -29.6, 17.2, 0.025, 0.6],
    ]);
    this._terrainInstances('cliffRockSections', this.resources.vertexMaterial('rock'), [
      [19, 1.55, -15.99, 4.5, 2.4, 0.04],
      [33.01, 1.7, -24, 0.04, 2.7, 5],
      [14.99, 1.4, -25, 0.04, 2.1, 4],
    ], this.resources.scenery('rock'));

    const grass = this._mesh(this.resources.checkerGrass(24, -23, 18, 14), this.resources.vertexMaterial(), 0, 4.002, 0);
    grass.name = 'cliffCheckerGrass';
    grass.castShadow = false;
  }

  _sceneryDetails(anchors = [[-30, -28, 0], [-38, 18, 0], [32, 24, 0], [-31, -18, 0], [38, 20, 0], [34, -14, 0], [26, -25, 4], [30, -17, 4]]) {
    const tufts = [], flowers = [];
    for (const [x, z, y] of anchors) {
      tufts.push([x + 1.8, y, z + 0.7, 0.9, 0.9, 0.9, 0.3], [x - 1.5, y, z + 1, 0.7, 0.7, 0.7, 1.4]);
      if (flowers.length < 6) flowers.push([x - 1.8, y, z + 1.4, 0.65, 0.65, 0.65, 0.7]);
    }
    this._terrainInstances('grassTufts', this.resources.vertexMaterial('sprout'), tufts, this.resources.scenery('grassTuft'));
    this._terrainInstances('sceneryFlowers', this.resources.vertexMaterial('sprout'), flowers, this.resources.scenery('flower'));

    // Four clouds, five shared rounded lobes each, batched into one draw.
    const lobes = [];
    const cloudCenters = [[-55, 35, -100, 1.1], [0, 30, -125, 0.8], [75, 40, -100, 1.3], [-95, 38, 35, 1]];
    const centers = this.environment === 'earlyDawn'
      ? [...cloudCenters, [105, 32, 65, 0.9]]
      : this.environment === 'night' ? cloudCenters.slice(0, 2) : cloudCenters;
    for (const [x, y, z, size] of centers) {
      const angle = Math.atan2(x, z);
      for (const [dx, dy, w, h] of [[-6, 0, 5, 3], [-2, 1, 5, 4], [1, 4, 5.5, 6], [5, 0.5, 5, 3.5], [0, -1, 8, 2.5]]) {
        lobes.push([x + dx * size * Math.cos(angle), y + dy * size, z - dx * size * Math.sin(angle), w * size, h * size, 3 * size, angle]);
      }
    }
    const clouds = this._terrainInstances('distantClouds', this.resources.cloudMaterial(this.environment), lobes, this.resources.scenery('cloud'));
    clouds.receiveShadow = false;
    clouds.userData.cloudCount = centers.length;
  }

  build() {
    if (this.meshes.length) return;
    this._checkerBase(SIZE, 1, SIZE, 0, -0.5, 0, COLORS.grass);
    const grass = this._mesh(this.resources.checkerGrass(0, 0, SIZE, SIZE), this.resources.vertexMaterial(), 0, 0.002, 0);
    grass.name = 'groundCheckerGrass';
    grass.castShadow = false;
    const edge = SIZE / 2;
    this._box(SIZE, 3, 1, 0, 1.5, -edge, COLORS.border, false);
    this._box(SIZE, 3, 1, 0, 1.5, edge, COLORS.border, false);
    this._box(1, 3, SIZE, -edge, 1.5, 0, COLORS.border, false);
    this._box(1, 3, SIZE, edge, 1.5, 0, COLORS.border, false);

    // A modest northeast bluff with a grassy cap. The center/spawn stays open.
    this._box(18, 3.6, 14, 24, 1.8, -23, COLORS.cliff);
    const cap = this._checkerBase(18, 0.4, 14, 24, 3.8, -23, COLORS.cliff);
    this._terrainDetails(cap);
    // Broad 0.25-high steps are below the player's existing autostep limit.
    // Each touches the next, giving a walkable route up to the 4-high grass top.
    for (let i = 0; i < 16; i++) {
      const height = (i + 1) * 0.25;
      this._box(4, height, 1.25, 24, height / 2, 3.375 - i * 1.25, COLORS.teal);
    }

    this._box(4, 0.5, 4, -18, 0.75, -14, COLORS.teal);
    this._box(4, 0.5, 4, -22, 1.5, -18, COLORS.yellow);
    this._box(4, 0.5, 4, -25, 2.25, -22, COLORS.teal);

    for (const [x, z, size] of [[-30, -28, 1], [-38, 18, 1.15], [32, 24, 0.9], [26, -25, 0.85]]) {
      this._tree(x, z, size, x === 26 ? 4 : 0);
    }
    const bushes = [];
    for (const [x, z, size] of [[-26, -25, 1], [-35, -22, 0.8], [-34, 21, 1.2], [29, 27, 1], [36, 22, 0.8], [35, -25, 1]]) {
      for (const [dx, dz, s] of [[0, 0, 1], [1, 0.3, 0.65], [-0.8, 0.5, 0.7]]) bushes.push([x + dx * size, s * size * 0.65, z + dz * size, s * size * 1.4, s * size * 0.8, s * size, x * 0.1]);
    }
    const bushMesh = this._terrainInstances('bushClusters', this.resources.vertexMaterial('foliage'), bushes, this.resources.scenery('bush'));
    bushMesh.castShadow = true;
    for (const [x, z, size, rotation] of [[-31, -18, 1.5, 0.3], [-40, 24, 1, 1.1], [38, 20, 1.8, 0.8], [34, -14, 2, 0.5], [38, -22, 0.8, 1.5]]) {
      const mesh = this._mesh(this.resources.scenery('rock'), this.resources.vertexMaterial('rock'), x, size * 0.55, z, [size * 1.25, size * 0.8, size]);
      mesh.rotation.y = rotation;
      if (size >= 1.5) {
        // Match the faceted silhouette with a cheap fixed convex collider.
        const vertices = Float32Array.from(mesh.geometry.attributes.position.array, (v, i) => v * mesh.scale.getComponent(i % 3));
        const RAPIER = this.physics.RAPIER;
        const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, mesh.position.y, z).setRotation(mesh.quaternion));
        this.physics.world.createCollider(RAPIER.ColliderDesc.convexHull(vertices).setFriction(0.9), body);
        this.physicsBodies.push(body);
      }
    }
    this._sceneryDetails();
  }

  _tree(x, z, size, groundY) {
    const trunk = this._mesh(this.resources.scenery('trunk'), this.resources.material(COLORS.trunk), x, groundY + 1.5 * size, z, [size, size, size]);
    trunk.name = 'treeTrunk';
    const canopy = this._mesh(this.resources.scenery('canopy'), this.resources.vertexMaterial('foliage'), x, groundY + 4 * size, z, [2.3 * size, 2.6 * size, 2.1 * size]);
    canopy.rotation.y = x * 0.13;
    const branch = this._mesh(this.resources.scenery('trunk'), this.resources.material(COLORS.trunk), x + 0.3 * size, groundY + 2.1 * size, z, [0.45 * size, 0.35 * size, 0.45 * size]);
    branch.rotation.z = -0.7;
    // Only the trunk is solid; foliage and bushes have no physics bodies.
    const RAPIER = this.physics.RAPIER;
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, groundY + 1.5 * size, z));
    this.physics.world.createCollider(RAPIER.ColliderDesc.cylinder(1.5 * size, 0.4 * size).setFriction(0.9), body);
    this.physicsBodies.push(body);
  }

  clear() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      // Per-level instance buffers are private; geometry/materials stay cached.
      if (mesh.isInstancedMesh) mesh.dispose();
    }
    for (const body of this.physicsBodies) this.physics.world.removeRigidBody(body);
    this.meshes = [];
    this.physicsBodies = [];
    // All geometry/materials belong to EnvironmentResources and survive unload.
  }
}

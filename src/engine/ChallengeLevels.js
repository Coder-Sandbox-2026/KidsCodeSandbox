import * as THREE from 'three';
import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { Level12Water } from './Level12Water.js';

const COLORS = [0x00bed3, 0xffca28, 0xf06449, 0x9155d9, 0x3284e8];

// Shared construction/lifetime helpers; each named level below defines its own
// composition. Immutable GPU resources remain owned by EnvironmentResources.
class ChallengeEnvironment extends ChallengeLevel1 {
  constructor(...args) {
    super(...args);
    this.hills = [];
    this.structures = [];
    this.routes = [];
    this.bridges = [];
  }

  _begin() {
    if (this.meshes.length) return false;
    this._checkerBase(140, 1, 140, 0, -0.5, 0, 0x52b86c);
    const grass = this._mesh(this.resources.checkerGrass(0, 0, 140, 140), this.resources.vertexMaterial(this.environment === 'night' ? 'nightGrass' : 'grass'), 0, 0.002, 0);
    grass.name = 'groundCheckerGrass';
    grass.castShadow = false;
    this._box(140, 3, 1, 0, 1.5, -70, 0x326d99, false);
    this._box(140, 3, 1, 0, 1.5, 70, 0x326d99, false);
    this._box(1, 3, 140, -70, 1.5, 0, 0x326d99, false);
    this._box(1, 3, 140, 70, 1.5, 0, 0x326d99, false);
    return true;
  }

  _fixed(mesh, collider) {
    const RAPIER = this.physics.RAPIER;
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...mesh.position.toArray()).setRotation(mesh.quaternion));
    this.physics.world.createCollider(collider.setFriction(0.9).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max), body);
    this.physicsBodies.push(body);
    return body;
  }

  _hill(x, z, w, d, height, accessible = false) {
    const rock = this.resources.terrainMaterial('cliffRock');
    this._box(w, height - 0.4, d, x, (height - 0.4) / 2, z, rock.color.getHex());
    const cap = this._checkerBase(w, 0.4, d, x, height - 0.2, z, rock.color.getHex());
    cap.name = 'hillGrassCap';
    cap.material = [rock, rock, this.resources.terrainMaterial('grassDark'), rock, rock, rock];
    const grass = this._mesh(this.resources.checkerGrass(x, z, w, d), this.resources.vertexMaterial(this.environment === 'night' ? 'nightGrass' : 'grass'), 0, height + 0.002, 0);
    grass.name = 'hillCheckerGrass';
    grass.castShadow = false;
    this._terrainInstances('hillGrassRim', this.resources.terrainMaterial('grassEdge'), [
      [x - w / 2 + 0.4, height + 0.0125, z, 0.6, 0.025, d - 0.2],
      [x + w / 2 - 0.4, height + 0.0125, z, 0.6, 0.025, d - 0.2],
      [x, height + 0.0125, z - d / 2 + 0.4, w - 0.8, 0.025, 0.6],
      [x, height + 0.0125, z + d / 2 - 0.4, w - 0.8, 0.025, 0.6],
    ]);
    this._terrainInstances('hillRockFacets', this.resources.vertexMaterial('rock'), [
      [x - w * 0.25, height * 0.45, z + d / 2 + 0.01, w * 0.2, height * 0.4, 0.04],
      [x + w / 2 + 0.01, height * 0.4, z, 0.04, height * 0.35, d * 0.25],
    ], this.resources.scenery('rock'));
    this.hills.push({ x, z, w, d, height, accessible });
    if (accessible) this._ramp(x, z + d / 2, height);
  }

  _ramp(x, hillFront, height) {
    const run = 20, thickness = 0.25;
    const angle = Math.atan2(height, run), length = Math.hypot(height, run);
    const mesh = this._mesh(this.resources.box(1, 1, 1, false), this.resources.material(COLORS[0]), x, height / 2 - thickness / 2 * Math.cos(angle), hillFront + run / 2 - thickness / 2 * Math.sin(angle), [4, thickness, length]);
    mesh.rotation.x = angle;
    mesh.name = 'hillAccessRamp';
    this._fixed(mesh, this.physics.RAPIER.ColliderDesc.cuboid(2, thickness / 2, length / 2));
    this.routes.push(mesh);
  }

  _tower(kind, x, z, w, h, colorIndex, d = w) {
    const geometry = kind === 'cube' ? this.resources.box(1, 1, 1) : this.resources.scenery(kind === 'cone' ? 'structureCone' : 'structureCylinder');
    const mesh = this._mesh(geometry, this.resources.material(COLORS[colorIndex % COLORS.length], 0.45), x, h / 2, z, [w, h, kind === 'cube' ? d : w]);
    mesh.name = `${kind}Structure`;
    const RAPIER = this.physics.RAPIER;
    const collider = kind === 'cube' ? RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2) : kind === 'cone' ? RAPIER.ColliderDesc.cone(h / 2, w) : RAPIER.ColliderDesc.cylinder(h / 2, w);
    const body = this._fixed(mesh, collider);
    this.structures.push({ kind, mesh, body });
    return mesh;
  }

  _platform(x, z, height, colorIndex = 0, w = 4, d = 4) {
    const mesh = this._box(w, 0.5, d, x, height - 0.25, z, COLORS[colorIndex]);
    mesh.name = 'explorationPlatform';
    return mesh;
  }

  _arch(x, z, height, colorIndex) {
    this._tower('cube', x - 4, z, 2, height, colorIndex, 2);
    this._tower('cube', x + 4, z, 2, height, colorIndex, 2);
    const lintel = this._box(10, 1.4, 2, x, height - 0.7, z, COLORS[colorIndex]);
    lintel.name = 'archLintel';
  }

  _finish(trees) {
    const bushes = [], anchors = [];
    for (const [x, z, size = 1] of trees) {
      this._tree(x, z, size, 0);
      anchors.push([x, z, 0]);
      for (const [dx, dz, scale] of [[3, 1, 1], [4, 1.5, 0.7], [2.4, 2, 0.6]]) bushes.push([x + dx, scale * 0.65, z + dz, scale * 1.4, scale * 0.8, scale, x * 0.1]);
      const boulder = this._mesh(this.resources.scenery('rock'), this.resources.vertexMaterial('rock'), x - 3, 0.5, z + 2, [1.4, 0.8, 1]);
      boulder.rotation.y = z * 0.15; // Small decorative rocks need no colliders.
    }
    const bushMesh = this._terrainInstances('bushClusters', this.resources.vertexMaterial('foliage'), bushes, this.resources.scenery('bush'));
    bushMesh.castShadow = true;
    this._sceneryDetails(anchors);
    if (this.environment !== 'day') {
      const night = this.environment === 'night';
      const dawn = this.environment === 'earlyDawn';
      const mesh = this._mesh(this.resources.scenery('celestial'), this.resources.celestialMaterial(dawn ? 'dawnSun' : night ? 'moon' : 'sun'), dawn ? -170 : night ? -95 : -130, dawn ? 28 : night ? 105 : 70, -150, [night ? 10 : 13, night ? 10 : 13, night ? 10 : 13]);
      mesh.name = night ? 'distantMoon' : 'distantSun';
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (night) {
        const stars = this.resources.starField();
        this.scene.add(stars);
        this.meshes.push(stars);
      }
    }
  }

  clear() {
    super.clear();
    this.hills = [];
    this.structures = [];
    this.routes = [];
    this.bridges = [];
  }
}

// Dawn temples share unit geometry, batched tiers, and simple fixed colliders.
class DawnTempleEnvironment extends ChallengeEnvironment {
  environment = 'earlyDawn';

  _pyramid(x, z, width, tierCount, tierHeight, color = 0xe1bd7b) {
    const tiers = [];
    const height = tierCount * tierHeight;
    const topWidth = width - (tierCount - 1) * 5;
    for (let i = 0; i < tierCount; i++) {
      const size = width - i * 5;
      const y = (i + 0.5) * tierHeight;
      tiers.push([x, y, z, size, tierHeight, size]);
      this.physicsBodies.push(this.physics.addStaticBox(size / 2, tierHeight / 2, size / 2, x, y, z));
    }
    const mesh = this._terrainInstances('steppedPyramid', this.resources.templeMaterial(color), tiers,
      this.resources.templeTierGeometry());
    mesh.castShadow = true;
    // Ramp -> two-unit external landing -> top: adjoining edges, no overlapping tops.
    const end = z + topWidth / 2 + 2;
    const start = z + width / 2 + 22;
    const run = start - end, thickness = 0.3;
    const angle = Math.atan2(height, run), length = Math.hypot(height, run);
    const ramp = this._mesh(this.resources.box(1, 1, 1, false), this.resources.material(0xd8bd8e),
      x, height / 2 - thickness / 2 * Math.cos(angle), (start + end) / 2 - thickness / 2 * Math.sin(angle), [5, thickness, length]);
    ramp.rotation.x = angle;
    ramp.name = 'templeAccessRamp';
    this._fixed(ramp, this.physics.RAPIER.ColliderDesc.cuboid(2.5, thickness / 2, length / 2));
    const landing = this._mesh(this.resources.box(1, 1, 1, false), this.resources.material(0xd8bd8e),
      x, height - 0.15, z + topWidth / 2 + 1, [5, 0.3, 2]);
    landing.name = 'templeLanding';
    this._fixed(landing, this.physics.RAPIER.ColliderDesc.cuboid(2.5, 0.15, 1));
    this.routes.push(ramp);
    this.structures.push({ kind: 'pyramid', mesh, x, z, height, topWidth, rampStart: start, ramp, landing });
  }

  _floating(x, z, height, colorIndex, width = 6) {
    const mesh = this._mesh(this.resources.box(1, 1, 1), this.resources.material(COLORS[colorIndex]),
      x, height, z, [width, 0.6, width]);
    mesh.name = 'floatingTemplePlatform';
    const body = this._fixed(mesh, this.physics.RAPIER.ColliderDesc.cuboid(width / 2, 0.3, width / 2));
    this.structures.push({ kind: 'floatingPlatform', mesh, body, groundHeight: 0 });
  }
}

export class ChallengeLevel10 extends DawnTempleEnvironment {
  build() {
    if (!this._begin()) return;
    this._pyramid(-28, -30, 34, 4, 2);
    this._pyramid(32, 22, 22, 3, 1.5, 0xefdaa2);
    for (const [x, z, height, color] of [[-48, 18, 13, 1], [15, -40, 17, 0], [45, -15, 21, 3]]) {
      this._floating(x, z, height, color);
    }
    this._finish([[-53, -48], [-52, 43], [52, 42], [51, -47], [12, 48]]);
  }
}

export class ChallengeLevel11 extends DawnTempleEnvironment {
  build() {
    if (!this._begin()) return;
    this._pyramid(32, -32, 36, 5, 2, 0xe1bd7b);
    this._pyramid(-35, -24, 26, 4, 1.8, 0xefdaa2);
    this._pyramid(-32, 32, 20, 3, 1.6, 0xe1bd7b);
    for (const [x, z, height, color] of [[5, -45, 14, 0], [50, 18, 19, 1], [24, 42, 24, 3], [-52, 5, 16, 2]]) {
      this._floating(x, z, height, color);
    }
    this._finish([[-55, -50], [53, -53], [52, 45], [-53, 49], [0, 52]]);
  }
}

export class ChallengeLevel12 extends ChallengeEnvironment {
  build() {
    if (!this._begin()) return;

    const centerX = 0, centerZ = -22, width = 34, depth = 24, surfaceY = 1.05;
    this.waterRegion = Object.freeze({
      minX: centerX - width / 2, maxX: centerX + width / 2,
      minZ: centerZ - depth / 2, maxZ: centerZ + depth / 2,
      surfaceY,
      containsPosition(position) {
        return position.x >= this.minX && position.x <= this.maxX
          && position.z >= this.minZ && position.z <= this.maxZ
          && position.y <= this.surfaceY;
      },
    });

    // One low-poly bowl replaces visible shelf bands: pale shallows slope smoothly
    // to a lower, warmer center while a hidden box provides simple collision.
    this._box(width, 0.12, depth, centerX, 0.06, centerZ, 0xd8bd7c, false).name = 'poolBottom';
    this.basinGeometry = new THREE.PlaneGeometry(width, depth, 12, 8);
    const basinPositions = this.basinGeometry.attributes.position;
    const basinColors = [];
    const basinHeightAt = (x, z) => {
      const nx = Math.abs(x) / (width / 2);
      const nz = Math.abs(z) / (depth / 2);
      return 0.12 + THREE.MathUtils.smoothstep(Math.pow(nx ** 4 + nz ** 4, 0.25), 0.48, 1.0) * 0.70;
    };
    for (let i = 0; i < basinPositions.count; i++) {
      const x = basinPositions.getX(i), z = basinPositions.getY(i);
      basinPositions.setZ(i, basinHeightAt(x, z));
      const broadPatch = Math.sin(x * 0.24 + z * 0.17) * Math.sin(z * 0.29 - x * 0.11);
      const finePatch = Math.sin(x * 0.73 - z * 0.51) * Math.sin(z * 0.91 + x * 0.38);
      const variation = THREE.MathUtils.clamp(0.5 + broadPatch * 0.30 + finePatch * 0.20, 0, 1);
      const sand = new THREE.Color(0xc99652).lerp(new THREE.Color(0xffdda0), variation);
      basinColors.push(sand.r, sand.g, sand.b);
    }
    this.basinGeometry.setAttribute('color', new THREE.Float32BufferAttribute(basinColors, 3));
    this.basinGeometry.computeVertexNormals();
    const basin = this._mesh(this.basinGeometry, this.resources.vertexMaterial('sand'), centerX, 0, centerZ);
    basin.rotation.x = -Math.PI / 2;
    basin.name = 'poolBasin';
    const rockGeometry = this.resources.scenery('rock');
    const rockMaterial = this.resources.vertexMaterial('rock');
    this.underwaterRockMaterial = rockMaterial.clone();
    this.underwaterRockMaterial.color.set(0xb9aa94);
    const rockPlacement = (x, z, sx, sy, sz, rotation) =>
      [centerX + x, basinHeightAt(x, z) + sy * 0.72, centerZ + z, sx, sy, sz, rotation];
    this._terrainInstances('underwaterRocks', this.underwaterRockMaterial, [
      rockPlacement(-12.4, -7.8, 0.55, 0.32, 0.45, 0.4),
      rockPlacement(-8.1, 5.4, 0.42, 0.26, 0.50, 1.7),
      rockPlacement(-5.7, -2.8, 0.70, 0.38, 0.55, 2.4),
      rockPlacement(-2.2, 7.1, 0.38, 0.22, 0.34, 0.9),
      rockPlacement(1.8, -6.9, 0.48, 0.30, 0.62, 1.3),
      rockPlacement(4.6, 3.8, 0.62, 0.34, 0.48, 2.8),
      rockPlacement(7.9, -1.4, 0.35, 0.24, 0.42, 0.2),
      rockPlacement(10.8, 7.0, 0.58, 0.31, 0.46, 2.0),
      rockPlacement(12.5, -6.3, 0.44, 0.28, 0.56, 1.0),
      rockPlacement(0.2, 1.1, 0.52, 0.27, 0.40, 2.5),
    ], rockGeometry);
    const emergentRocks = this._terrainInstances('emergentPoolRocks', rockMaterial, [
      rockPlacement(-13.8, 2.0, 1.35, 1.05, 1.10, 0.5),
      rockPlacement(12.8, -2.7, 1.15, 0.92, 1.35, 2.1),
      rockPlacement(-9.6, -8.8, 0.95, 0.82, 1.05, 1.4),
    ], rockGeometry);
    emergentRocks.castShadow = true;
    const bank = this.resources.material(0xdab66e, 0.88);
    for (const [x, z, w, d] of [
      [centerX, centerZ - depth / 2 - 1.5, width + 6, 3],
      [centerX, centerZ + depth / 2 + 1.5, width + 6, 3],
      [centerX - width / 2 - 1.5, centerZ, 3, depth],
      [centerX + width / 2 + 1.5, centerZ, 3, depth],
    ]) {
      const edge = this._box(w, 1.20, d, x, 0.60, z, bank.color.getHex(), false);
      edge.name = 'poolBank';
    }

    this.water = new Level12Water({
      createMesh: (...args) => this._mesh(...args),
      centerX, centerZ, width, depth, surfaceY,
      sunWorldPosition: this.sunWorldPosition,
      rippleCenters: [[-13.8, 2.0], [12.8, -2.7], [-9.6, -8.8]],
    });
    this.waterSurface = this.water.object3D;

    this._finish([[-38, -32], [39, -31], [-38, 26], [39, 27]]);
  }

  update(dt) {
    this.water?.update(dt);
  }

  clear() {
    super.clear();
    this.water?.dispose();
    this.basinGeometry?.dispose();
    this.underwaterRockMaterial?.dispose();
    this.water = null;
    this.basinGeometry = null;
    this.underwaterRockMaterial = null;
    this.waterSurface = null;
    this.waterRegion = null;
  }
}

export class ChallengeLevel2 extends ChallengeEnvironment {
  build() {
    if (!this._begin()) return;
    this._hill(-14, -20, 14, 14, 6, true);
    this._hill(10, -20, 14, 14, 6);
    const bridge = this._box(10, 0.5, 4, -2, 5.75, -20, 0xc78b45);
    bridge.name = 'hillBridge';
    this.bridges.push(bridge);
    [[-36, -30, 3, 13], [-40, 10, 2, 9], [36, -32, 4, 17], [34, 20, 3, 12], [-22, 28, 2, 6], [14, 32, 3, 10]].forEach(([x,z,w,h], i) => this._tower('cube', x,z,w,h,i));
    this._finish([[-44,-38], [-42,30,1.1], [43,35], [40,-12,0.9]]);
  }
}

export class ChallengeLevel3 extends ChallengeEnvironment {
  build() {
    if (!this._begin()) return;
    this._hill(-30,-30,14,12,8);
    this._hill(28,-32,18,14,10);
    this._hill(30,28,12,16,7);
    [[-42,-10,3,14], [-22,25,4,18], [15,-18,2.5,11], [42,8,3.5,17], [-38,36,2,9], [12,35,3,13]].forEach(([x,z,r,h], i) => this._tower('cone',x,z,r,h,i));
    this._finish([[-44,-40], [-45,18], [42,-40,1.15], [44,37,0.9]]);
  }
}

export class ChallengeLevel4 extends ChallengeEnvironment {
  environment = 'sunset';
  build() {
    if (!this._begin()) return;
    this._hill(-28,-28,20,12,4,true);
    this._hill(32,25,12,18,6);
    [[-42,14,2,12], [-29,23,3,18], [-15,30,2.5,9], [25,-20,2,16], [36,-26,3,20], [43,-8,1.5,11]].forEach(([x,z,r,h], i) => this._tower('cylinder',x,z,r,h,i));
    this._finish([[-43,-38], [-42,35], [46,35], [46,-38]]);
  }
}

export class ChallengeLevel5 extends ChallengeEnvironment {
  environment = 'sunset';
  build() {
    if (!this._begin()) return;
    this._hill(28,-28,18,14,4,true);
    this._hill(-34,26,14,12,5);
    this._arch(-26,-22,9,0);
    this._arch(30,22,12,2);
    this._arch(-28,12,7,4);
    this._platform(-20,-14,1,0);
    this._platform(-23,-18,1.75,1);
    this._platform(-26,-22,2.5,0);
    this._platform(22,20,1,1);
    this._finish([[-44,-35], [-44,38], [43,34], [43,-39]]);
  }
}

export class ChallengeLevel6 extends ChallengeEnvironment {
  environment = 'sunsetStrong';
  build() {
    if (!this._begin()) return;
    this._hill(0,-38,24,12,5,true);
    this._hill(38,28,12,12,7);
    for (const [x,z] of [[-30,-20], [30,-18], [-26,28]]) {
      this._tower('cube',x-4,z,2,18,3);
      this._tower('cylinder',x+3,z+2,1.7,12,0);
      this._tower('cone',x,z-4,2.2,22,1);
    }
    this._finish([[-45,-35], [-44,38], [46,-36], [48,38]]);
  }
}

export class ChallengeLevel7 extends ChallengeEnvironment {
  environment = 'night';
  build() {
    if (!this._begin()) return;
    this._hill(-34,-32,16,14,4,true);
    this._hill(34,30,14,12,5);
    this._arch(28,-24,10,4);
    this._tower('cube',-30,20,4,12,3);
    this._tower('cube',-23,20,3,7,0);
    this._tower('cube',-34,28,5,4,1);
    this._tower('cube',35,-20,3,6,2);
    this._platform(22,22,1.25,0);
    this._finish([[-48,-42], [-45,36], [44,-36], [48,38]]);
  }
}

export class ChallengeLevel8 extends ChallengeEnvironment {
  environment = 'night';
  build() {
    if (!this._begin()) return;
    this._hill(-36,0,12,22,4,true);
    this._hill(0,-40,20,10,6);
    for (const [x,z] of [[-26,28], [28,22], [30,-24]]) {
      this._tower('cylinder',x-4,z,2,10,0);
      this._tower('cylinder',x+3,z+3,2.5,17,3);
      this._tower('cylinder',x+3,z-4,1.5,7,1);
    }
    this._finish([[-48,-28], [-44,40], [45,38], [46,-38]]);
  }
}

export class ChallengeLevel9 extends ChallengeEnvironment {
  environment = 'night';
  build() {
    if (!this._begin()) return;
    this._hill(-28,26,20,16,5,true);
    this._hill(32,-32,14,14,7);
    this._arch(-28,-26,12,0);
    this._tower('cube',-38,-22,3,17,3);
    this._tower('cone',24,24,3,18,1);
    this._tower('cone',32,30,2,12,2);
    this._tower('cylinder',36,-12,2.5,16,4);
    this._tower('cylinder',44,-18,2,10,0);
    this._platform(-18,15,1,0);
    this._platform(-23,17,2,1);
    this._platform(-28,19,3,0);
    this._finish([[-46,-38], [-44,42], [46,40], [48,-40]]);
  }
}

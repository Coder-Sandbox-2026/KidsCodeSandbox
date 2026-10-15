import * as THREE from 'three';
import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { PoolWater } from './PoolWater.js';

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
    const centerX = 0, centerZ = -22, width = 34, depth = 24, surfaceY = 1.05;
    if (!this._beginPoolGround(centerX, centerZ, width, depth)) return;
    const shallowBottomY = 0.12, deepBottomY = -3;
    const shelfWidth = 3.5, transitionWidth = 4;
    const halfWidth = width / 2, halfDepth = depth / 2;
    const basinHeightAt = (x, z) => {
      const inset = Math.min(halfWidth - Math.abs(x), halfDepth - Math.abs(z));
      const t = THREE.MathUtils.smoothstep(inset, shelfWidth, shelfWidth + transitionWidth);
      return THREE.MathUtils.lerp(shallowBottomY, deepBottomY, t);
    };
    const waterVolume = Object.freeze({
      id: 'challenge-12-pool',
      minX: centerX - width / 2, maxX: centerX + width / 2,
      minZ: centerZ - depth / 2, maxZ: centerZ + depth / 2,
      surfaceY,
      containsHorizontalPosition(x, z, margin = 0) {
        return x >= this.minX - margin && x <= this.maxX + margin
          && z >= this.minZ - margin && z <= this.maxZ + margin;
      },
      containsPosition(position) {
        return this.containsHorizontalPosition(position.x, position.z)
          && position.y <= this.surfaceY;
      },
      getSurfaceHeight() { return this.surfaceY; },
      getBottomHeight(x, z) { return basinHeightAt(x - centerX, z - centerZ); },
    });
    this.waterVolumes = Object.freeze([waterVolume]);
    this.waterRegion = waterVolume;

    // A single modest-resolution basin mesh supplies both the visible bottom and
    // the static collision surface, keeping the shelf, slope and center aligned.
    this.basinGeometry = new THREE.PlaneGeometry(width, depth, 16, 12);
    const basinPositions = this.basinGeometry.attributes.position;
    const basinColors = [];
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
    const basinCollider = this.physics.RAPIER.ColliderDesc.trimesh(
      Float32Array.from(basinPositions.array),
      Uint32Array.from(this.basinGeometry.index.array)
    );
    this._fixed(basin, basinCollider);
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
      const edge = this._box(w, 4.40, d, x, -1.00, z, bank.color.getHex(), false);
      edge.name = 'poolBank';
    }

    this.water = new PoolWater({
      createMesh: (...args) => this._mesh(...args),
      centerX, centerZ, width, depth, surfaceY,
      sunlight: {
        position: this.sunWorldPosition,
        reflection: true,
        waveLighting: true,
      },
      skyReflection: true,
      cloudReflection: {
        enabled: true,
        clouds: this._getCloudDescriptors(),
      },
      caustics: true,
      rippleCenters: [[-13.8, 2.0], [12.8, -2.7], [-9.6, -8.8]],
      quality: this.waterQuality,
      debug: true,
    });
    this.waterSurface = this.water.object3D;

    this._finish([[-38, -32], [39, -31], [-38, 26], [39, 27]]);
  }

  _beginPoolGround(centerX, centerZ, width, depth) {
    if (this.meshes.length) return false;
    const edge = 70;
    const minX = centerX - width / 2, maxX = centerX + width / 2;
    const minZ = centerZ - depth / 2, maxZ = centerZ + depth / 2;
    const slabs = [
      [140, minZ + edge, 0, (minZ - edge) / 2],
      [140, edge - maxZ, 0, (maxZ + edge) / 2],
      [minX + edge, depth, (minX - edge) / 2, centerZ],
      [edge - maxX, depth, (maxX + edge) / 2, centerZ],
    ];
    for (const [w, d, x, z] of slabs) {
      this._checkerBase(w, 1, d, x, -0.5, z, 0x52b86c);
      const grass = this._mesh(
        this.resources.checkerGrass(x, z, w, d),
        this.resources.vertexMaterial('grass'), 0, 0.002, 0
      );
      grass.name = 'groundCheckerGrass';
      grass.castShadow = false;
    }
    this._box(140, 3, 1, 0, 1.5, -edge, 0x326d99, false);
    this._box(140, 3, 1, 0, 1.5, edge, 0x326d99, false);
    this._box(1, 3, 140, -edge, 1.5, 0, 0x326d99, false);
    this._box(1, 3, 140, edge, 1.5, 0, 0x326d99, false);
    return true;
  }

  update(dt) {
    this.water?.update(dt);
  }

  setWaterQuality(quality) {
    this.waterQuality = quality;
    this.water?.setQuality(quality);
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
    this.waterVolumes = [];
  }
}

/** Public Level 12: a lightweight, colorful snow playground. */
export class SnowValleyLevel extends ChallengeLevel1 {
  build() {
    if (this.meshes.length) return;
    const snowDiagnostic = typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('snowDiag');
    const snow = 0xeaf6ff;
    const snowBlue = 0xc8e4f4;
    const ice = 0x32c6d8;
    const lavender = 0x7185d8;
    const coral = 0xf27f91;
    const edge = 70;

    this._checkerBase(140, 1, 140, 0, -0.5, 0, snowBlue);
    const ground = this._mesh(this.resources.snowChecker(0, 0, 140, 140),
      this.resources.vertexMaterial('snowChecker'), 0, 0.002, 0);
    ground.name = 'snowCheckerGround';
    ground.castShadow = false;
    this._box(140, 3, 1, 0, 1.5, -edge, lavender, false);
    this._box(140, 3, 1, 0, 1.5, edge, lavender, false);
    this._box(1, 3, 140, -edge, 1.5, 0, lavender, false);
    this._box(1, 3, 140, edge, 1.5, 0, lavender, false);

    // Broad, ordinary-collision steps lead from the meadow to the lookout.
    for (let i = 0; i < 7; i++) {
      const height = (i + 1) * 0.55;
      this._box(8, height, 3.2, 18, height / 2, -8 - i * 3.2, ice);
      const snowThickness = 0.16;
      const cap = this._mesh(this.resources.box(8, snowThickness, 3.2, true), this.resources.material(snow),
        18, height + snowThickness / 2, -8 - i * 3.2);
      cap.name = 'snowStepCap';
      this._applySnowSurface(cap, 18, -8 - i * 3.2, 8, 3.2, snowThickness, 1.6);
      this._applySnowDiagnostic(cap, 'caps', snowDiagnostic, {
        geometry: this.resources.box(8, snowThickness, 3.2, false),
        material: this.resources.material(snow),
      });
      this._applySnowDiagnostic(cap, `cap-${i}`, snowDiagnostic);
      this._applySnowDiagnostic(this.meshes[this.meshes.length - 2], 'steps', snowDiagnostic);
    }

    // Lookout: solid sides with a broad snow top.
    const lookoutBodyHeight = 0.8;
    const lookoutBodyY = 4.0;
    const lookoutBodyTop = lookoutBodyY + lookoutBodyHeight / 2;
    this._box(18, lookoutBodyHeight, 14, 18, lookoutBodyY, -31, lavender);
    const lookoutSnowThickness = 0.16;
    const lookoutSnowSink = 0.08;
    const lookoutTop = this._mesh(this.resources.box(18, lookoutSnowThickness, 14, true), this.resources.material(snow),
      18, lookoutBodyTop + lookoutSnowThickness / 2 - lookoutSnowSink, -31);
    lookoutTop.name = 'snowLookoutTop';
    this._applySnowSurface(lookoutTop, 18, -31, 18, 14, lookoutSnowThickness, 2.5);
    this._applySnowDiagnostic(lookoutTop, 'lookout-surface', snowDiagnostic);
    this._applySnowDiagnostic(this.meshes[this.meshes.length - 2], 'lookout-body', snowDiagnostic);
    this._tree(25, -33, 0.9, lookoutBodyTop + lookoutSnowThickness);
    this._rock(10, -27, 1.4, snowBlue);
    this._rock(27, -25, 0.9, coral);

    // A simple ice arch landmark in the opposite side of the valley.
    this._box(2.8, 5.5, 2.8, -25, 2.75, 18, ice);
    this._box(2.8, 5.5, 2.8, -15, 2.75, 18, ice);
    this._box(12.8, 1.0, 2.8, -20, 6.25, 18, lavender);
    this._box(3.2, 0.25, 3.2, -25, 5.625, 18, snow);
    this._box(3.2, 0.25, 3.2, -15, 5.625, 18, snow);
    for (const mesh of this.meshes) {
      if (mesh.name === 'snowStepCap' || mesh.name === 'snowLookoutTop') continue;
      if (mesh.position.x < -10 && mesh.position.x > -35 && mesh.position.z > 10 && mesh.position.z < 26) {
        this._applySnowDiagnostic(mesh, 'ice-arch', snowDiagnostic);
      }
    }
    for (const [x, z, size] of [[-32, 13, 1.1], [-10, 23, 0.8], [-31, 27, 0.9], [3, 8, 0.7]]) {
      this._rock(x, z, size, snowBlue);
    }

    for (const [x, z, size] of [[-34, -28, 1], [-42, -8, 0.8], [-34, 36, 1.1], [5, 35, 0.9], [43, 25, 0.8]]) {
      this._tree(x, z, size, 0);
    }
    this._snowDrifts([[-28, -12, 1.4], [-7, -22, 1.1], [35, 4, 1.25], [38, -12, 0.9], [-39, 7, 1.1]]);
    this._buildClouds();
  }

  _rock(x, z, size, color) {
    const rock = this._mesh(this.resources.scenery('rock'), this.resources.material(color), x, size * 0.55, z,
      [size * 1.25, size * 0.8, size]);
    rock.name = 'snowRock';
    rock.rotation.y = x * 0.13;
  }

  _applySnowSurface(mesh, centerX, centerZ, width, depth, thickness, tileSize) {
    mesh.geometry = this.resources.snowCheckerBox(centerX, centerZ, width, depth, thickness, tileSize);
    mesh.material = this.resources.vertexMaterial('snowChecker');
    // The underlying step/platform is the only collision and shadow caster.
    // Keeping this thin visual cap out of the shadow map prevents coplanar
    // cap/body depth from becoming a moving black shadow across the camera.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }

  _applySnowDiagnostic(mesh, group, mode, alternatives = {}) {
    if (!mode || !mesh) return;
    const hide = mode === `hide-${group}`;
    const noShadows = mode === `${group}-no-shadows`;
    if (mode === 'caps-simple-material' && group === 'caps' && alternatives.material) {
      mesh.material = alternatives.material;
    }
    if (mode === 'caps-simple-geometry' && group === 'caps' && alternatives.geometry) {
      mesh.geometry = alternatives.geometry;
      mesh.material = alternatives.material;
    }
    if (hide) mesh.visible = false;
    if (noShadows) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  }

  _snowDrifts(positions) {
    this._terrainInstances('snowDrifts', this.resources.material(0xf8fdff),
      positions.map(([x, z, size]) => [x, size * 0.28, z, size * 2.2, size * 0.55, size, x * 0.1]),
      this.resources.scenery('cloud'));
  }

  _tree(x, z, size, groundY) {
    const trunk = this._mesh(this.resources.scenery('trunk'), this.resources.material(0x8a5638), x,
      groundY + 1.5 * size, z, [size, size, size]);
    trunk.name = 'snowTreeTrunk';
    const canopy = this._mesh(this.resources.scenery('canopy'), this.resources.material(0x168b83), x,
      groundY + 4 * size, z, [2.3 * size, 2.6 * size, 2.1 * size]);
    canopy.name = 'snowPine';
    canopy.rotation.y = x * 0.13;
    const body = this.physics.world.createRigidBody(this.physics.RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, groundY + 1.5 * size, z));
    this.physics.world.createCollider(this.physics.RAPIER.ColliderDesc.cylinder(1.5 * size, 0.4 * size)
      .setFriction(0.9), body);
    this.physicsBodies.push(body);
  }
}

/** Public Level 13: a compact, beginner-friendly snowy maze. */
export class SnowMazeLevel extends SnowValleyLevel {
  build() {
    if (this.meshes.length) return;
    const snow = 0xeaf6ff;
    const snowBlue = 0xc8e4f4;
    const ice = 0x32c6d8;
    const lavender = 0x7185d8;
    const wallHeight = 4.5;
    const wallThickness = 1;
    const cellSize = 5;
    const originX = -28;
    const originZ = -14;
    const rows = 5;
    const columns = 5;

    this._checkerBase(140, 1, 140, 0, -0.5, 0, snowBlue);
    const ground = this._mesh(this.resources.snowChecker(0, 0, 140, 140),
      this.resources.vertexMaterial('snowChecker'), 0, 0.002, 0);
    ground.name = 'snowMazeCheckerGround';
    ground.castShadow = false;

    // Keep the surrounding meadow contained while leaving the maze itself open.
    this._mazeWall(140, 1, 0, -70, wallHeight, lavender, snow, false);
    this._mazeWall(140, 1, 0, 70, wallHeight, lavender, snow, false);
    this._mazeWall(1, 140, -70, 0, wallHeight, lavender, snow, false);
    this._mazeWall(1, 140, 70, 0, wallHeight, lavender, snow, false);

    // A deliberate route from the south entrance to the north exit, with
    // short branches that create readable dead ends for new players.
    const route = [
      [0, 4], [0, 3], [1, 3], [1, 2], [2, 2],
      [2, 1], [3, 1], [3, 0], [4, 0],
    ];
    const branches = [
      [[0, 3], [0, 2], [0, 1]],
      [[1, 2], [1, 1]],
      [[2, 2], [2, 3], [3, 3], [3, 4]],
      [[2, 1], [2, 0]],
      [[3, 1], [4, 1], [4, 2]],
    ];
    const openEdges = new Set();
    const edgeKey = (a, b) => {
      const first = `${a[0]},${a[1]}`;
      const second = `${b[0]},${b[1]}`;
      return first < second ? `${first}|${second}` : `${second}|${first}`;
    };
    const openPath = path => {
      for (let i = 1; i < path.length; i++) openEdges.add(edgeKey(path[i - 1], path[i]));
    };
    openPath(route);
    branches.forEach(openPath);

    const vertical = new Map();
    const horizontal = new Map();
    const addSegment = (map, boundary, index) => {
      if (!map.has(boundary)) map.set(boundary, []);
      map.get(boundary).push(index);
    };
    const isOpen = (a, b) => openEdges.has(edgeKey(a, b));

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = [column, row];
        if (column === 0) addSegment(vertical, 0, row);
        if (column === columns - 1) addSegment(vertical, columns, row);
        if (column < columns - 1 && !isOpen(cell, [column + 1, row])) {
          addSegment(vertical, column + 1, row);
        }
        if (row === 0 && !(column === 4 && row === 0)) addSegment(horizontal, 0, column);
        if (row === rows - 1 && !(column === 0 && row === rows - 1)) {
          addSegment(horizontal, rows, column);
        }
        if (row < rows - 1 && !isOpen(cell, [column, row + 1])) {
          addSegment(horizontal, row + 1, column);
        }
      }
    }

    for (const [boundary, indices] of vertical) {
      this._addMazeRuns(indices, run => {
        const x = originX + boundary * cellSize;
        const z = originZ + (run.start + run.length / 2) * cellSize;
        this._mazeWall(wallThickness, run.length * cellSize, x, z, wallHeight, lavender, snow);
      });
    }
    for (const [boundary, indices] of horizontal) {
      this._addMazeRuns(indices, run => {
        const x = originX + (run.start + run.length / 2) * cellSize;
        const z = originZ + boundary * cellSize;
        this._mazeWall(run.length * cellSize, wallThickness, x, z, wallHeight, ice, snow);
      });
    }

    const entranceZ = originZ + rows * cellSize;
    const exitZ = originZ;
    this._mazeMarker(originX, entranceZ, ice);
    this._mazeMarker(originX + cellSize, entranceZ, ice);
    this._mazeMarker(originX + 4 * cellSize, exitZ, lavender);
    this._mazeMarker(originX + 5 * cellSize, exitZ, lavender);

    // The surrounding meadow remains open so the player approaches the maze
    // from outside and can leave again after reaching the exit.
    for (const [x, z, size] of [[-43, -31, 1], [22, -28, 0.9], [-42, 22, 1.1], [30, 20, 0.8], [35, -5, 1]]) {
      this._tree(x, z, size, 0);
    }
    for (const [x, z, size] of [[-38, -4, 1.2], [19, 3, 0.9], [-5, 27, 1.1], [38, 30, 0.8]]) {
      this._rock(x, z, size, snowBlue);
    }
    this._snowDrifts([[-44, 8, 1.2], [18, -16, 1], [31, 5, 1.3], [-5, 31, 0.9]]);
    this._buildClouds();
  }

  _addMazeRuns(indices, callback) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (!sorted.length) return;
    let start = sorted[0];
    let previous = start;
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] !== previous + 1) {
        callback({ start, length: previous - start + 1 });
        start = sorted[i];
      }
      previous = sorted[i];
    }
  }

  _mazeWall(width, depth, x, z, height, color, snow, rounded = true) {
    // Keep each wall's assigned hue while adding depth through vertex colors.
    // The midpoint remains the original color so the existing wall grouping is
    // still immediately recognizable in both maze levels.
    const geometry = this.resources.box(width, height, depth, rounded).clone();
    const base = new THREE.Color(color);
    const hsl = {};
    base.getHSL(hsl);
    const bottom = new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l - 0.2, 0, 1));
    const top = new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + 0.2, 0, 1));
    const positions = geometry.attributes.position;
    const colors = [];
    const smoothstep = value => value * value * (3 - 2 * value);
    for (let i = 0; i < positions.count; i++) {
      const heightT = THREE.MathUtils.clamp(positions.getY(i) / height + 0.5, 0, 1);
      const colorAtHeight = heightT < 0.5
        ? bottom.clone().lerp(base, smoothstep(heightT * 2))
        : base.clone().lerp(top, smoothstep((heightT - 0.5) * 2));
      // A restrained deterministic shift along the wall avoids a uniform,
      // painted look without changing the wall's assigned color family.
      const along = width >= depth ? positions.getX(i) / width + 0.5 : positions.getZ(i) / depth + 0.5;
      const edgeShift = Math.sin(THREE.MathUtils.clamp(along, 0, 1) * Math.PI) * Math.abs(heightT - 0.5) * 0.08;
      colorAtHeight.multiplyScalar(1 + edgeShift);
      colors.push(colorAtHeight.r, colorAtHeight.g, colorAtHeight.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const wall = this._mesh(geometry, this.resources.vertexMaterial('mazeWall'), x, height / 2, z);
    wall.name = 'snowMazeWall';
    this.physicsBodies.push(this.physics.addStaticBox(width / 2, height / 2, depth / 2, x, height / 2, z));
    const capHeight = 0.14;
    const cap = this._mesh(this.resources.box(width, capHeight, depth, rounded), this.resources.material(snow),
      x, height + capHeight / 2, z);
    cap.name = 'snowMazeWallCap';
    cap.castShadow = false;
    cap.receiveShadow = false;
  }

  _mazeMarker(x, z, color) {
    this._box(0.8, 4.8, 0.8, x, 2.4, z, color, true);
  }
}

/** Public Level 14: a roof-covered, beginner-friendly frozen labyrinth. */
export class FrozenLabyrinthLevel extends SnowMazeLevel {
  build() {
    if (this.meshes.length) return;
    const snow = 0xeaf6ff;
    const snowBlue = 0xc8e4f4;
    const ice = 0x32c6d8;
    const lavender = 0x7185d8;
    const roofBlue = 0x4d6094;
    const wallHeight = 4.8;
    const wallThickness = 1;
    const cellSize = 5;
    const originX = -17.5;
    const originZ = -17.5;
    const rows = 7;
    const columns = 7;

    this._checkerBase(140, 1, 140, 0, -0.5, 0, snowBlue);
    const ground = this._mesh(this.resources.snowChecker(0, 0, 140, 140),
      this.resources.vertexMaterial('snowChecker'), 0, 0.002, 0);
    ground.name = 'frozenLabyrinthCheckerGround';
    ground.castShadow = false;

    // The perimeter keeps the outdoor play area contained, including the corners.
    this._mazeWall(140, 1, 0, -70, wallHeight, lavender, snow, false);
    this._mazeWall(140, 1, 0, 70, wallHeight, lavender, snow, false);
    this._mazeWall(1, 140, -70, 0, wallHeight, lavender, snow, false);
    this._mazeWall(1, 140, 70, 0, wallHeight, lavender, snow, false);

    // Main route: long straight sections connect the south entrance to the north exit.
    const route = [
      [0, 6], [0, 5], [0, 4], [1, 4], [2, 4], [3, 4],
      [3, 3], [3, 2], [4, 2], [5, 2], [6, 2], [6, 1], [6, 0],
    ];
    // This branch rejoins the route to form an intentional western/central loop.
    const branches = [
      [[0, 4], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [4, 1], [4, 2]],
      [[1, 4], [1, 5], [2, 5], [2, 6]],
      [[5, 2], [5, 3], [5, 4], [4, 4]],
      [[6, 1], [5, 1]],
    ];
    const openEdges = new Set();
    const edgeKey = (a, b) => {
      const first = `${a[0]},${a[1]}`;
      const second = `${b[0]},${b[1]}`;
      return first < second ? `${first}|${second}` : `${second}|${first}`;
    };
    const openPath = path => {
      for (let i = 1; i < path.length; i++) openEdges.add(edgeKey(path[i - 1], path[i]));
    };
    openPath(route);
    branches.forEach(openPath);

    const vertical = new Map();
    const horizontal = new Map();
    const addSegment = (map, boundary, index) => {
      if (!map.has(boundary)) map.set(boundary, []);
      map.get(boundary).push(index);
    };
    const isOpen = (a, b) => openEdges.has(edgeKey(a, b));
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = [column, row];
        if (column === 0) addSegment(vertical, 0, row);
        if (column === columns - 1) addSegment(vertical, columns, row);
        if (column < columns - 1 && !isOpen(cell, [column + 1, row])) {
          addSegment(vertical, column + 1, row);
        }
        if (row === 0 && !(column === columns - 1 && row === 0)) addSegment(horizontal, 0, column);
        if (row === rows - 1 && !(column === 0 && row === rows - 1)) {
          addSegment(horizontal, rows, column);
        }
        if (row < rows - 1 && !isOpen(cell, [column, row + 1])) {
          addSegment(horizontal, row + 1, column);
        }
      }
    }
    for (const [boundary, indices] of vertical) {
      this._addMazeRuns(indices, run => {
        this._mazeWall(wallThickness, run.length * cellSize,
          originX + boundary * cellSize,
          originZ + (run.start + run.length / 2) * cellSize,
          wallHeight, lavender, snow);
      });
    }
    for (const [boundary, indices] of horizontal) {
      this._addMazeRuns(indices, run => {
        this._mazeWall(run.length * cellSize, wallThickness,
          originX + (run.start + run.length / 2) * cellSize,
          originZ + boundary * cellSize,
          wallHeight, ice, snow);
      });
    }

    // A single fixed roof slab encloses the maze without adding corridor obstacles.
    const roof = this._box(38, 0.35, 38, 0, 5.0, 0, roofBlue, false);
    roof.name = 'frozenLabyrinthRoof';
    const snowRoof = this._mesh(this.resources.box(39, 0.14, 39, false), this.resources.material(snow), 0, 5.245, 0);
    snowRoof.name = 'frozenLabyrinthSnowRoof';
    snowRoof.castShadow = false;
    snowRoof.receiveShadow = false;

    const entranceZ = originZ + rows * cellSize;
    const exitZ = originZ;
    this._mazeMarker(originX, entranceZ, ice);
    this._mazeMarker(originX + cellSize, entranceZ, ice);
    this._mazeMarker(originX + 6 * cellSize, exitZ, lavender);
    this._mazeMarker(originX + 7 * cellSize, exitZ, lavender);

    // The surrounding snowfield stays open for exploration outside the fortress.
    for (const [x, z, size] of [[-43, -31, 1], [28, -30, 0.9], [-43, 25, 1.1], [35, 24, 0.8], [42, -4, 1]]) {
      this._tree(x, z, size, 0);
    }
    for (const [x, z, size] of [[-38, -5, 1.2], [30, 4, 0.9], [-6, 31, 1.1], [42, 34, 0.8]]) {
      this._rock(x, z, size, snowBlue);
    }
    this._snowDrifts([[-44, 8, 1.2], [27, -16, 1], [39, 10, 1.3], [-7, 34, 0.9]]);
    this._buildClouds();
  }
}

/** Public Level 15: an open winter playground with elevated ice routes. */
export class FrozenHighlandsLevel extends SnowValleyLevel {
  build() {
    if (this.meshes.length) return;
    const snow = 0xeaf6ff;
    const snowBlue = 0xc8e4f4;
    const ice = 0x32c6d8;
    const lavender = 0x7185d8;
    const deepIce = 0x326aa8;

    this._checkerBase(140, 1, 140, 0, -0.5, 0, snowBlue);
    const ground = this._mesh(this.resources.snowChecker(0, 0, 140, 140),
      this.resources.vertexMaterial('snowChecker'), 0, 0.002, 0);
    ground.name = 'frozenHighlandsCheckerGround';
    ground.castShadow = false;

    // Keep the large outdoor play area contained without narrowing the routes.
    this._box(140, 3, 1, 0, 1.5, -70, lavender, false);
    this._box(140, 3, 1, 0, 1.5, 70, lavender, false);
    this._box(1, 3, 140, -70, 1.5, 0, lavender, false);
    this._box(1, 3, 140, 70, 1.5, 0, lavender, false);

    // A connected vertical route: ground -> low -> medium -> high lookout.
    this._highlandPlatform(0, 20, 12, 10, 2, ice);
    this._highlandPlatform(0, -12, 8, 10, 6, deepIce);
    this._highlandPlatform(24, -12, 8, 10, 6, lavender);
    this._highlandRamp(0, 25, 14, 8, 0, 2, ice);
    this._highlandRamp(0, 6, 9, 8, 2, 4, lavender);
    this._highlandRamp(0, -7, 13, 8, 4, 6, deepIce);

    // Three broad overpasses leave clear ground-level routes underneath.
    this._highlandBridge(0, 4, 28, 4, 4, ice, 'mainIceOverpass');
    this._highlandBridge(12, -12, 16, 4, 6, lavender, 'crossingIceOverpass');
    this._highlandBridge(-22, -6, 4, 20, 4, deepIce, 'optionalIceOverpass');
    this._highlandPlatform(-22, -20, 8, 8, 4, ice);
    this._highlandRamp(-22, 4, 14, 6, 0, 4, ice);

    // Cylindrical towers form a separate district around the connected routes.
    for (const [x, z, radius, height, color] of [
      [-34, 28, 3, 8, ice], [34, 25, 3.5, 11, lavender],
      [32, -12, 3, 8, deepIce], [-34, -30, 2.7, 7, ice],
    ]) this._highlandTower(x, z, radius, height, color);

    // Large low-poly crystal formations provide silhouettes without blocking paths.
    for (const [x, z, radius, height, color, rotation] of [
      [-45, 3, 2.8, 8, ice, 0.2], [45, 2, 3.2, 10, lavender, -0.3],
      [-43, -22, 2.4, 6, deepIce, 0.4], [43, -28, 2.8, 7, ice, -0.2],
      [14, 27, 2.2, 5, lavender, 0.1],
    ]) this._highlandCrystal(x, z, radius, height, color, rotation);

    for (const [x, z, size] of [[-52, 24, 1], [52, 28, 0.9], [-52, -2, 1.1], [51, -4, 0.8], [8, 34, 0.9]]) {
      this._tree(x, z, size, 0);
    }
    for (const [x, z, size] of [[-48, 15, 1.2], [48, 15, 0.9], [-47, -12, 1], [47, -20, 1.1], [10, -31, 0.8]]) {
      this._rock(x, z, size, snowBlue);
    }
    this._snowDrifts([[-55, 35, 1.2], [55, 35, 1], [-55, -35, 1.1], [52, -35, 0.9], [15, 35, 0.8]]);
    this._buildClouds();
    // Highest accessible destination on the eastern high platform.
  }

  _highlandGradientGeometry(geometry, color) {
    const result = geometry.clone();
    const positions = result.attributes.position;
    result.computeBoundingBox();
    const minY = result.boundingBox.min.y;
    const height = Math.max(result.boundingBox.max.y - minY, 0.001);
    const base = new THREE.Color(color);
    const hsl = {};
    base.getHSL(hsl);
    const bottom = new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l - 0.18, 0, 1));
    const top = new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + 0.18, 0, 1));
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
      const t = THREE.MathUtils.clamp((positions.getY(i) - minY) / height, 0, 1);
      const value = bottom.clone().lerp(top, t * t * (3 - 2 * t));
      colors.push(value.r, value.g, value.b);
    }
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return result;
  }

  _highlandFixed(mesh, collider) {
    const RAPIER = this.physics.RAPIER;
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
      .setTranslation(...mesh.position.toArray()).setRotation(mesh.quaternion));
    this.physics.world.createCollider(collider.setFriction(0.9)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max), body);
    this.physicsBodies.push(body);
    return body;
  }

  _highlandMesh(geometry, color, x, y, z, scale, name) {
    const mesh = this._mesh(this._highlandGradientGeometry(geometry, color),
      this.resources.vertexMaterial('highlandIce'), x, y, z, scale);
    mesh.name = name;
    return mesh;
  }

  _highlandPlatform(x, z, width, depth, height, color) {
    const body = this._highlandMesh(this.resources.box(width, 0.7, depth, false), color,
      x, height - 0.35, z, [1, 1, 1], 'highlandPlatformBody');
    this._highlandFixed(body, this.physics.RAPIER.ColliderDesc.cuboid(width / 2, 0.35, depth / 2));
    const snow = this._mesh(this.resources.box(width - 0.12, 0.12, depth - 0.12, false),
      this.resources.material(0xeaf6ff), x, height + 0.06, z);
    snow.name = 'highlandPlatformSnow';
    snow.castShadow = false;
    snow.receiveShadow = false;
  }

  _highlandRamp(x, highZ, run, width, lowY, highY, color) {
    const thickness = 0.28;
    const rise = highY - lowY;
    const angle = Math.atan2(rise, run);
    const length = Math.hypot(run, rise);
    const mesh = this._highlandMesh(this.resources.box(1, 1, 1, false), color,
      x, lowY + rise / 2 - thickness * 0.5 * Math.cos(angle),
      highZ + run / 2 - thickness * 0.5 * Math.sin(angle),
      [width, thickness, length], 'highlandWalkableRamp');
    mesh.rotation.x = angle;
    this._highlandFixed(mesh, this.physics.RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2, length / 2));
  }

  _highlandBridge(x, z, width, depth, height, color, name) {
    const body = this._highlandMesh(this.resources.box(width, 0.7, depth, false), color,
      x, height - 0.35, z, [1, 1, 1], name);
    this._highlandFixed(body, this.physics.RAPIER.ColliderDesc.cuboid(width / 2, 0.35, depth / 2));
    const snow = this._mesh(this.resources.box(width - 0.12, 0.12, depth - 0.12, false),
      this.resources.material(0xeaf6ff), x, height + 0.06, z);
    snow.name = `${name}Snow`;
    snow.castShadow = false;
    snow.receiveShadow = false;
    for (const supportX of [x - width / 2 + 2, x + width / 2 - 2]) {
      this._box(1.2, height - 0.35, depth - 0.4, supportX, (height - 0.35) / 2, z, color, true);
    }
  }

  _highlandTower(x, z, radius, height, color) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 12, 3);
    const tower = this._highlandMesh(geometry, color, x, height / 2, z, [1, 1, 1], 'highlandIceTower');
    this._highlandFixed(tower, this.physics.RAPIER.ColliderDesc.cylinder(height / 2, radius));
    const cap = this._mesh(new THREE.CylinderGeometry(radius + 0.12, radius + 0.12, 0.16, 12),
      this.resources.material(0xeaf6ff), x, height + 0.08, z);
    cap.name = 'highlandTowerSnowCap';
    cap.castShadow = false;
    cap.receiveShadow = false;
  }

  _highlandCrystal(x, z, radius, height, color, rotation) {
    const crystal = this._highlandMesh(new THREE.ConeGeometry(radius, height, 6, 2),
      color, x, height / 2, z, [1, 1, 1], 'highlandIceCrystal');
    crystal.rotation.y = rotation;
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

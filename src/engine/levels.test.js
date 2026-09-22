import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { PhysicsManager } from './PhysicsManager.js';
import { DefaultLevel } from './DefaultLevel.js';
import { ChallengeLevel1 } from './ChallengeLevel1.js';
import { Player } from '../api/Player.js';
import { SceneManager } from './SceneManager.js';
import { CHALLENGE_LEVEL_CLASSES } from './challengeLevelRegistry.js';
import { CHALLENGE_LEVEL_CONFIG } from '../challenges/challengeLevelConfig.js';

// Match the existing engine tests: replace Vite asset URLs only, not gameplay.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) {
      const url = new URL(specifier, context.parentURL).href;
      return { url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(url)}`)}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { GameEngine } = await import('./GameEngine.js');
hook.deregister();

async function fixture(t) {
  const saved = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = Object.assign(new EventTarget(), { pointerLockElement: null });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const engine = new GameEngine({});
  engine.sceneManager = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), environment: 'day', applyEnvironment(name) { this.environment = name; } };
  engine.renderer = { render() {} };
  engine.physics = new PhysicsManager();
  await engine.physics.init();
  engine.player = new Player(engine.camera, engine.physics);
  engine.player.engine = engine;
  engine.level = new DefaultLevel(engine.scene, engine.physics, engine.environmentResources);
  t.after(() => {
    engine.stop();
    engine.runs.invalidate();
    engine.clearUserObjects();
    engine.level.clear();
    engine.player.dispose();
    engine.environmentResources.dispose();
    engine.physics.world.free();
    engine.physics._eventQueue.free();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  return engine;
}

test('challenge environment is open, contained, static, and has a walkable cliff route', async t => {
  const engine = await fixture(t);
  engine.loadLevel('challenge-1');
  const { level, physics } = engine;
  assert.ok(level instanceof ChallengeLevel1);
  assert.equal(level.meshes[0].geometry.parameters.width, 140);
  assert.equal(level.meshes[0].geometry.parameters.depth, 140);
  assert.equal(physics.bodies.size, 0); // No loose dynamic demonstration objects.
  assert.equal(level.physicsBodies.length, 33);
  assert.equal(level.meshes.filter(m => m.name === 'treeTrunk').length, 4);
  assert.equal(level.meshes.find(m => m.name === 'bushClusters').count, 18);
  assert.equal(level.meshes.filter(m => !m.isInstancedMesh && m.geometry === engine.environmentResources.scenery('rock')).length, 5);
  const cap = level.meshes.find(m => m.name === 'cliffGrassCap');
  const rock = engine.environmentResources.terrainMaterial('cliffRock');
  for (const face of [0, 1, 3, 4, 5]) assert.equal(cap.material[face], rock);
  assert.notEqual(cap.material[2].color.getHex(), level.meshes[0].material.color.getHex());
  const rim = level.meshes.find(m => m.name === 'cliffGrassRim');
  assert.equal(rim.count, 4);
  assert.equal(rim.material, engine.environmentResources.terrainMaterial('grassEdge'));
  assert.ok(rim.material.color.g > cap.material[2].color.g);
  const surfaces = level.meshes.filter(m => m.name.endsWith('CheckerGrass'));
  assert.equal(surfaces.length, 2);
  assert.equal(surfaces[0].material, surfaces[1].material);
  assert.equal(surfaces[0].material.vertexColors, true);
  assert.equal(surfaces[0].geometry, engine.environmentResources.checkerGrass(0, 0, 140, 140));
  for (const surface of surfaces) {
    const positions = surface.geometry.attributes.position;
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    assert.equal(surface.geometry.attributes.color.count, positions.count);
    assert.ok(Array.from(surface.geometry.attributes.normal.array).filter((_, i) => i % 3 === 1).every(y => y > 0.99));
    const heights = new Set(Array.from(positions.array).filter((_, i) => i % 3 === 1));
    assert.equal(heights.size, 1); // Checker and embedded motifs share one tessellated surface.
    assert.equal(surface.castShadow, false);
  }
  assert.equal(level.meshes.find(m => m.name === 'grassTufts').count, 16);
  assert.equal(level.meshes.find(m => m.name === 'sceneryFlowers').count, 6);
  const clouds = level.meshes.find(m => m.name === 'distantClouds');
  assert.equal(clouds.count, 20);
  assert.equal(clouds.castShadow, false);
  // From above, rays encounter a contrasting rim before the lower grass.
  const raycaster = new THREE.Raycaster();
  engine.scene.updateMatrixWorld(true);
  for (const point of [[15.24, -20], [32.76, -20], [20, -16.24], [20, -29.76]]) {
    raycaster.set(new THREE.Vector3(point[0], 8, point[1]), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(level.meshes)[0];
    assert.equal(hit.object, rim);
    assert.ok(hit.point.y > 4);
  }
  engine.scene.updateMatrixWorld(true);
  for (const mesh of level.meshes) {
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (mesh.name !== 'distantClouds') {
      assert.ok(bounds.min.x >= -70.501 && bounds.max.x <= 70.501);
      assert.ok(bounds.min.z >= -70.501 && bounds.max.z <= 70.501);
    }
    if (mesh !== level.meshes[0] && mesh.name !== 'groundCheckerGrass') {
      const openArea = new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 6, 12));
      if (mesh.isInstancedMesh) {
        mesh.geometry.computeBoundingBox();
        for (let i = 0; i < mesh.count; i++) {
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(i, matrix);
          assert.ok(!mesh.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld).intersectsBox(openArea));
        }
      } else assert.ok(!bounds.intersectsBox(openArea));
    }
  }
  // Move the real existing capsule/controller up the staircase without jumping.
  engine.player.body.setTranslation({ x: 24, y: 1, z: 5 }, true);
  const input = { isDown: key => key === 'KeyW', consumeJump: () => false };
  for (let frame = 0; frame < 420; frame++) {
    engine.player.movementController.update(1 / 60, input, 0);
    physics.step(1 / 60);
    if (engine.player.position.z < -20) break;
  }
  assert.ok(engine.player.position.z < -16, `Reached z=${engine.player.position.z}`);
  assert.ok(engine.player.position.y > 4.8, `Reached y=${engine.player.position.y}`);
  const bodies = physics.world.bodies.len();
  level.build();
  assert.equal(physics.world.bodies.len(), bodies); // Repeated build does not duplicate.
  level.clear();
  assert.equal(engine.scene.children.length, 0);
  assert.equal(physics.world.bodies.len(), 1); // Only the player remains.
});

test('levels 1–9 map correctly, remain open/static, and reuse resources across switching', async t => {
  const engine = await fixture(t);
  const counts = new Map();
  let groundGeometry;
  for (let pass = 0; pass < 2; pass++) {
    for (let id = 1; id <= 9; id++) {
      const key = `challenge-${id}`;
      const oldMeshes = [...engine.level.meshes];
      engine.loadLevel(key);
      assert.ok(engine.level instanceof CHALLENGE_LEVEL_CLASSES[key]);
      assert.equal(engine.level.constructor.name, `ChallengeLevel${id}`);
      const config = CHALLENGE_LEVEL_CONFIG[id];
      engine.player.getPlayerPosition().forEach((value, i) => assert.ok(Math.abs(value - config.playerPosition[i]) < 0.00001));
      const expectedDirection = new THREE.Vector3(...config.playerDirection).normalize();
      engine.player.getPlayerDirection().forEach((value, i) => assert.ok(Math.abs(value - expectedDirection.toArray()[i]) < 1e-12));
      // Capsule extends 0.9 below its center: supplied starts leave about 0.05 clearance.
      engine.physics.world.step();
      let embedded = false;
      engine.physics.world.intersectionsWithShape(engine.player.body.translation(), engine.player.body.rotation(),
        engine.player.collider.shape, collider => {
          if (collider.handle !== engine.player.collider.handle && !collider.isSensor()) embedded = true;
          return true;
        });
      assert.equal(embedded, false, `challenge-${id} start intersects terrain`);
      if (oldMeshes.length && oldMeshes[0] !== engine.level.meshes[0]) assert.ok(oldMeshes.every(m => m.parent === null));
      const ground = engine.level.meshes[0];
      assert.equal(ground.geometry.parameters.width, 140);
      assert.equal(ground.geometry.parameters.depth, 140);
      const grass = engine.level.meshes.find(m => m.name === 'groundCheckerGrass');
      groundGeometry ??= grass.geometry;
      assert.equal(grass.geometry, groundGeometry);
      assert.equal(engine.physics.bodies.size, 0);
      const expectedEnvironment = id <= 3 ? 'day' : id === 6 ? 'sunsetStrong' : id <= 6 ? 'sunset' : 'night';
      assert.equal(engine.sceneManager.environment, expectedEnvironment);
      const celestial = engine.level.meshes.filter(m => m.name === 'distantSun' || m.name === 'distantMoon');
      assert.equal(celestial.length, id <= 3 ? 0 : 1);
      for (const mesh of celestial) {
        assert.equal(mesh.material.toneMapped, false);
        const color = mesh.material.color;
        assert.ok(color.r * 0.299 + color.g * 0.587 + color.b * 0.114 > 0.85);
      }
      const stars = engine.level.meshes.filter(m => m.name === 'distantStars');
      assert.equal(stars.length, id >= 7 ? 1 : 0);
      assert.equal(engine.scene.children.filter(m => m.name === 'distantStars').length, stars.length);
      if (stars.length) {
        const shared = engine.environmentResources.starField();
        assert.equal(stars[0].geometry, shared.geometry);
        assert.equal(stars[0].material, shared.material);
        assert.equal(stars[0].isPoints, true);
        assert.equal(stars[0].geometry.attributes.position.count, 220);
      }
      if (id > 1) {
        assert.ok(engine.level.structures.every(s => s.body.isFixed()));
        assert.ok(engine.level.hills.every(h => h.height > 0));
        if (id === 2) {
          assert.equal(engine.level.hills.length, 2);
          assert.equal(engine.level.hills.filter(h => h.accessible).length, 1);
          assert.equal(engine.level.routes.length, 1);
          assert.equal(engine.level.bridges.length, 1);
          assert.equal(engine.level.structures.filter(s => s.kind === 'cube').length, 6);
        }
        if (id === 3) {
          assert.equal(engine.level.hills.length, 3);
          assert.equal(engine.level.routes.length, 0);
          assert.ok(engine.level.hills.every(h => !h.accessible));
          assert.equal(engine.level.structures.filter(s => s.kind === 'cone').length, 6);
        }
        const openArea = new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 6, 12));
        engine.scene.updateMatrixWorld(true);
        for (const mesh of engine.level.meshes) {
          if (mesh === ground || mesh === grass || mesh.name.startsWith('distant')) continue;
          mesh.geometry.computeBoundingBox();
          const transforms = mesh.isInstancedMesh ? Array.from({ length: mesh.count }, (_, i) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); return matrix; }) : [new THREE.Matrix4()];
          for (const transform of transforms) {
            const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(transform).applyMatrix4(mesh.matrixWorld);
            assert.ok(bounds.min.x >= -70.501 && bounds.max.x <= 70.501 && bounds.min.z >= -70.501 && bounds.max.z <= 70.501);
            assert.ok(!bounds.intersectsBox(openArea), `${key}: ${mesh.name} intrudes into spawn space`);
          }
        }
      }
      const currentCounts = [engine.level.meshes.length, engine.physics.world.bodies.len()];
      if (pass === 0) counts.set(key, currentCounts);
      else assert.deepEqual(currentCounts, counts.get(key));
      const sharedCounts = [engine.environmentResources.geometries.size, engine.environmentResources.materials.size];
      engine.reset();
      assert.deepEqual([engine.level.meshes.length, engine.physics.world.bodies.len()], currentCounts);
      assert.deepEqual([engine.environmentResources.geometries.size, engine.environmentResources.materials.size], sharedCounts);
      engine.stop();
      assert.equal(engine.running, false);
      engine.resume();
      assert.equal(engine.running, true);
    }
  }
  engine.loadLevel('default');
  assert.equal(engine.sceneManager.environment, 'day');
  assert.ok(engine.level instanceof DefaultLevel);
  engine.loadLevel('challenge-9');
  engine.clearScene();
  assert.equal(engine.sceneManager.environment, 'day');
  assert.equal(engine.scene.children.length, 0);
  engine.loadLevel();
  assert.equal(engine.sceneManager.environment, 'night');
  const cloud = engine.environmentResources.cloudMaterial();
  assert.ok(cloud.isMeshLambertMaterial);
  assert.ok(cloud.emissiveIntensity <= 0.45);
  assert.ok(cloud.emissive.b * cloud.emissiveIntensity < 0.4);
  assert.equal(cloud, engine.environmentResources.cloudMaterial());
});

test('level 2 player can walk up hill A and cross the bridge to hill B', async t => {
  const engine = await fixture(t);
  engine.loadLevel('challenge-2');
  engine.player.body.setTranslation({ x: -14, y: 1, z: 9 }, true);
  const walk = (key, done) => {
    const input = { isDown: code => code === key, consumeJump: () => false };
    for (let frame = 0; frame < 600; frame++) {
      engine.player.movementController.update(1 / 60, input, 0);
      engine.physics.step(1 / 60);
      if (done(engine.player.position)) break;
    }
  };
  walk('KeyW', p => p.z < -20);
  assert.ok(engine.player.position.y > 6.8, `Hill A y=${engine.player.position.y}`);
  assert.ok(engine.player.position.z < -20);
  engine.player.movementController.horizVelocity.set(0, 0, 0);
  walk('KeyD', p => p.x > 10);
  assert.ok(engine.player.position.x > 10, `Hill B x=${engine.player.position.x}`);
  assert.ok(engine.player.position.y > 6.8, `Bridge crossing y=${engine.player.position.y}`);
});

test('time presets reuse one readable shadow light and restore day settings', t => {
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener() {} };
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; });
  const manager = new SceneManager({ aspect: 1 });
  const day = { background: manager.scene.background.getHex(), sun: manager.sun.color.getHex(), intensity: manager.sun.intensity, position: manager.sun.position.toArray() };
  for (const preset of ['sunset', 'sunsetStrong', 'night', 'earlyDawn', 'day']) {
    manager.applyEnvironment(preset);
    assert.equal(manager.scene.children.filter(o => o.isLight && o.castShadow).length, 1);
    assert.equal(manager.sun.shadow.mapSize.x, 2048);
    assert.equal(manager.scene.background.getHex(), manager.scene.fog.color.getHex());
    assert.equal(manager.sunMesh.visible, preset === 'day');
    if (preset === 'night') {
      assert.ok(manager.ambient.intensity >= 0.4);
      assert.ok(manager.hemisphere.intensity >= 0.9);
      assert.ok(manager.sun.intensity >= 1.2);
    }
  }
  assert.deepEqual({ background: manager.scene.background.getHex(), sun: manager.sun.color.getHex(), intensity: manager.sun.intensity, position: manager.sun.position.toArray() }, day);
});

test('dawn stages build five shared clouds, climbable temples and high fixed platforms', async t => {
  const engine = await fixture(t);
  let cloudGeometry, cloudMaterial;
  engine.loadLevel('challenge-9');
  for (const id of [10, 11, 10]) {
    const previous = [...engine.level.meshes];
    engine.loadLevel(`challenge-${id}`);
    assert.ok(previous.every(mesh => mesh.parent === null));
    assert.equal(engine.level.constructor.name, `ChallengeLevel${id}`);
    assert.equal(engine.sceneManager.environment, 'earlyDawn');
    assert.equal(engine.scene.children.some(mesh => ['distantStars', 'distantMoon'].includes(mesh.name)), false);
    assert.equal(engine.level.meshes.filter(mesh => mesh.name === 'distantSun').length, 1);
    const clouds = engine.level.meshes.find(mesh => mesh.name === 'distantClouds');
    assert.equal(clouds.userData.cloudCount, 5);
    assert.equal(clouds.count, 25);
    cloudGeometry ??= clouds.geometry;
    cloudMaterial ??= clouds.material;
    assert.equal(clouds.geometry, cloudGeometry);
    assert.equal(clouds.material, cloudMaterial);
    const pyramids = engine.level.structures.filter(s => s.kind === 'pyramid');
    assert.equal(pyramids.length, id === 10 ? 2 : 3);
    const platforms = engine.level.structures.filter(s => s.kind === 'floatingPlatform');
    assert.equal(platforms.length, id === 10 ? 3 : 4);
    for (const platform of platforms) {
      assert.ok(platform.mesh.position.y - 0.3 - platform.groundHeight >= 12);
      assert.ok(platform.body.isFixed());
    }
    // Walk every ramp onto its flat upper surface using the actual controller.
    for (const pyramid of pyramids) {
      const { landing, ramp, mesh } = pyramid;
      const topFront = pyramid.z + pyramid.topWidth / 2;
      assert.ok(Math.abs(landing.position.z - landing.scale.z / 2 - topFront) < 1e-12,
        'landing must terminate at the top edge instead of overlapping it');
      const rampEnd = ramp.localToWorld(new THREE.Vector3(0, 0.5, -0.5));
      assert.ok(Math.abs(rampEnd.z - landing.position.z - landing.scale.z / 2) < 1e-10);
      assert.ok(Math.abs(rampEnd.y - pyramid.height) < 1e-10);
      assert.equal(mesh.geometry, engine.environmentResources.templeTierGeometry());
      assert.equal(mesh.material.vertexColors, true);
      assert.equal(landing.material, ramp.material);
      const normals = mesh.geometry.attributes.normal;
      for (let i = 0; i < normals.count; i++) {
        assert.ok(normals.getY(i) >= 0, 'hidden coplanar undersides must be omitted');
      }
      engine.player.setPlayerPosition([pyramid.x, 0.95, pyramid.rampStart + 1]);
      const input = { isDown: key => key === 'KeyW', consumeJump: () => false };
      for (let frame = 0; frame < 900; frame++) {
        engine.player.movementController.update(1 / 60, input, 0);
        engine.physics.step(1 / 60);
        if (engine.player.position.z <= pyramid.z) break;
      }
      assert.ok(engine.player.position.z <= pyramid.z, `Level ${id} temple ramp blocked`);
      assert.ok(Math.abs(engine.player.position.y - pyramid.height - 0.95) < 0.15,
        `Level ${id} temple top y=${engine.player.position.y}`);
    }
    engine.reset();
    assert.equal(engine.scene.children.filter(mesh => mesh.name === 'distantClouds').length, 1);
  }
  engine.loadLevel('challenge-1');
  assert.equal(engine.sceneManager.environment, 'day');
  assert.equal(engine.level.meshes.find(mesh => mesh.name === 'distantClouds').userData.cloudCount, 4);
});

test('switch/reset/clear retains shared resources and cleans meshes, bodies, and runs', async t => {
  const engine = await fixture(t);
  engine.loadLevel();
  const ground = engine.level.meshes[0];
  let sharedDisposals = 0;
  ground.geometry.addEventListener('dispose', () => sharedDisposals++);
  ground.material.addEventListener('dispose', () => sharedDisposals++);
  const privateMesh = engine.level.meshes.find(m => engine.level.privateMeshes.has(m));
  let privateDisposals = 0;
  privateMesh.geometry.addEventListener('dispose', () => privateDisposals++);
  privateMesh.material.addEventListener('dispose', () => privateDisposals++);
  const run = engine.beginStudentRun();
  engine.loadLevel('challenge-1');
  assert.equal(run.active, false);
  assert.equal(privateDisposals, 2);
  assert.equal(sharedDisposals, 0);
  assert.equal(ground.parent, null);
  const challengeGroundGeometry = engine.level.meshes[0].geometry;
  assert.equal(challengeGroundGeometry, engine.environmentResources.boxWithoutTop(140, 1, 140));
  assert.equal(engine.level.meshes[0].material, ground.material);
  const meshCount = engine.scene.children.length;
  const bodyCount = engine.physics.world.bodies.len();
  const cacheCounts = [engine.environmentResources.geometries.size, engine.environmentResources.materials.size];
  for (let i = 0; i < 3; i++) {
    engine.reset();
    assert.equal(engine.levelId, 'challenge-1');
    assert.equal(engine.level.meshes[0].geometry, challengeGroundGeometry);
    assert.equal(engine.scene.children.length, meshCount);
    assert.equal(engine.physics.world.bodies.len(), bodyCount);
    assert.deepEqual([engine.environmentResources.geometries.size, engine.environmentResources.materials.size], cacheCounts);
  }
  engine.clearScene();
  assert.equal(engine.levelLoaded, false);
  assert.equal(engine.scene.children.length, 0);
  assert.equal(engine.physics.world.bodies.len(), 1);
  engine.loadLevel();
  assert.ok(engine.level instanceof ChallengeLevel1);
  assert.equal(engine.scene.children.length, meshCount);
  engine.loadLevel('default');
  assert.ok(engine.level instanceof DefaultLevel);
  assert.equal(engine.scene.children.length, 28);
  assert.equal(engine.physics.bodies.size, 10);
  assert.equal(engine.level.meshes[0].geometry, ground.geometry);
  assert.equal(sharedDisposals, 0);
  assert.throws(() => engine.loadLevel('missing'), /Unknown level/);
  assert.equal(engine.levelId, 'default');
  engine.level.clear();
  engine.environmentResources.dispose();
  assert.equal(sharedDisposals, 2); // Released only at permanent teardown.
  assert.equal(engine.environmentResources.geometries.size, 0);
  assert.equal(engine.environmentResources.materials.size, 0);
});

test('all eleven challenge stages have one tessellated checker surface without covered box tops', async t => {
  const engine = await fixture(t);
  for (let id = 1; id <= 11; id++) {
    engine.loadLevel(`challenge-${id}`);
    const ground = engine.level.meshes[0];
    for (const mesh of [ground, ...engine.level.meshes.filter(m => /^(?:cliff|hill)GrassCap$/.test(m.name))]) {
      for (const index of mesh.geometry.index.array) {
        assert.ok(mesh.geometry.attributes.normal.getY(index) < 0.99, 'covered box top must not render');
      }
    }
    const surfaces = engine.level.meshes.filter(mesh => mesh.name.endsWith('CheckerGrass'));
    assert.equal(surfaces.filter(mesh => mesh.name === 'groundCheckerGrass').length, 1);
    for (const surface of surfaces) {
      const positions = surface.geometry.attributes.position;
      let area = 0;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < positions.count; i += 3) {
        a.fromBufferAttribute(positions, i);
        b.fromBufferAttribute(positions, i + 1);
        c.fromBufferAttribute(positions, i + 2);
        assert.equal(a.y, 0);
        area += b.sub(a).cross(c.sub(a)).length() / 2;
      }
      surface.geometry.computeBoundingBox();
      const size = surface.geometry.boundingBox.getSize(new THREE.Vector3());
      assert.ok(Math.abs(area - size.x * size.z) < 0.01,
        'motifs must replace grass triangles, retaining full coverage without extra overdraw');
      if (surface.name === 'groundCheckerGrass') {
        assert.ok(new Set(surface.geometry.attributes.color.array).size > 6, 'retain checker colors and motif tints');
      }
    }
    if (id >= 10) {
      engine.player.getPlayerPosition().forEach((value, i) => {
        assert.ok(Math.abs(value - CHALLENGE_LEVEL_CONFIG[id].playerPosition[i]) < 0.00001);
      });
    }
  }
});


test('Create reuses stages 1, 7, 11 and 12 and starts without enabling Challenge systems', async t => {
  const { selectedStage, CREATE_LEVEL_CHOICES } = await import('./stageSelection.js');
  const engine = await fixture(t);
  assert.deepEqual(CREATE_LEVEL_CHOICES.map(choice => choice.label),
    Array.from({ length: 12 }, (_, i) => `Level ${i + 1}`));
  for (const level of [1, 7, 11, 12]) {
    const stage = selectedStage({ mode: 'create', level, challengeLevel: 2 });
    assert.equal(stage.challenge, false);
    assert.equal(stage.levelId, `challenge-${level}`);
    engine.loadLevel(stage.levelId);
    assert.ok(engine.level instanceof CHALLENGE_LEVEL_CLASSES[stage.levelId]);
    engine.player.getPlayerPosition().forEach((value, index) =>
      assert.ok(Math.abs(value - CHALLENGE_LEVEL_CONFIG[level].playerPosition[index]) < 1e-4));
    assert.equal(engine.userMeshes.length, 0);
    const challenge = selectedStage({ mode: 'challenge', level: 2, challengeLevel: level });
    assert.equal(challenge.challenge, true);
    assert.equal(challenge.levelId, stage.levelId);
  }
});

test('level 12 water animates and releases its private GPU resources', async t => {
  const engine = await fixture(t);
  engine.loadLevel('challenge-12');
  const { level } = engine;
  const water = level.meshes.find(mesh => mesh.name === 'waterSurface');
  assert.ok(water?.material.isShaderMaterial);
  assert.equal(water.geometry.attributes.position.count, 33 * 25);
  assert.equal(level.waterRegion.surfaceY, water.position.y);
  assert.equal(level.waterRegion.containsPosition(new THREE.Vector3(0, 0.2, -22)), true);
  assert.equal(level.waterRegion.containsPosition(new THREE.Vector3(30, 0.2, -22)), false);
  assert.equal(engine.getWaterVolumes().length, 1);
  assert.equal(level.waterRegion.getBottomHeight(16, -22), 0.12);
  assert.equal(level.waterRegion.getBottomHeight(0, -22), -3);
  assert.ok(Math.abs(level.waterRegion.getBottomHeight(11.5, -22) + 1.44) < 1e-12);
  const basin = level.meshes.find(mesh => mesh.name === 'poolBasin');
  assert.equal(basin.geometry.attributes.position.count, 17 * 13);
  const heights = basin.geometry.attributes.position;
  assert.ok(Math.abs(heights.getZ(0) - 0.12) < 1e-6);
  assert.ok(Array.from(heights.array).filter((_, i) => i % 3 === 2).some(y => y === -3));
  const groundSurfaces = level.meshes.filter(mesh => mesh.name === 'groundCheckerGrass');
  assert.equal(groundSurfaces.length, 4);
  for (const ground of groundSurfaces) {
    ground.geometry.computeBoundingBox();
    assert.equal(ground.geometry.boundingBox.containsPoint(new THREE.Vector3(0, 0, -22)), false,
      'surrounding ground must leave the basin opening unobstructed');
  }
  const banks = level.meshes.filter(mesh => mesh.name === 'poolBank');
  assert.equal(banks.length, 4);
  for (const bank of banks) {
    assert.ok(Math.abs(bank.position.y + bank.geometry.parameters.height / 2 - 1.2) < 1e-12);
    assert.ok(Math.abs(bank.position.y - bank.geometry.parameters.height / 2 + 3.2) < 1e-12);
  }
  assert.ok(level.physicsBodies.some(body => body.translation().y === 0
    && body.translation().z === -22), 'basin collision mesh is registered');
  const time = water.material.uniforms.time.value;
  level.update(0.25);
  assert.equal(water.material.uniforms.time.value, time + 0.25);
  let geometryDisposed = false, materialDisposed = false;
  water.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  water.material.addEventListener('dispose', () => { materialDisposed = true; });
  engine.loadLevel('challenge-1');
  assert.equal(water.parent, null);
  assert.equal(geometryDisposed, true);
  assert.equal(materialDisposed, true);
});

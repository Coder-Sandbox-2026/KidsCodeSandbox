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
    assert.equal(heights.size, 2); // Checker + sparse raised motifs in one batch.
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
  for (const preset of ['sunset', 'sunsetStrong', 'night', 'day']) {
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
  assert.equal(engine.level.meshes[0].geometry, ground.geometry);
  assert.equal(engine.level.meshes[0].material, ground.material);
  const meshCount = engine.scene.children.length;
  const bodyCount = engine.physics.world.bodies.len();
  const cacheCounts = [engine.environmentResources.geometries.size, engine.environmentResources.materials.size];
  for (let i = 0; i < 3; i++) {
    engine.reset();
    assert.equal(engine.levelId, 'challenge-1');
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

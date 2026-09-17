import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { studentCreationOptions } from './studentTransforms.js';
import { Player } from './Player.js';
import { PhysicsManager } from '../engine/PhysicsManager.js';
import { RunLifecycle } from '../engine/RunLifecycle.js';
import { API_DOCS } from '../editor/apiCompletions.js';
import { GAME_API_DTS } from '../editor/gameApiTypes.js';
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith('?url')) return {
    url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(new URL(specifier, context.parentURL).href)}`)}`,
    shortCircuit: true,
  };
  return next(specifier, context);
} });
const { GameAPI } = await import('./GameAPI.js');
const { createShapeFactories } = await import('./ShapeFactory.js');
const { createModelFactories } = await import('./ModelFactory.js');
const { AudioManager } = await import('../audio/AudioManager.js');
const { VFXManager } = await import('../engine/VFXManager.js');
const { EMBER_EXPLOSION_PHASES } = await import('../vfx/ember-explosion-vfx/index.js');
hook.deregister();

test('student transform units and coin lifecycle use real API and physics', async t => {
  const saved = globalThis.document;
  globalThis.document = new EventTarget();
  const physics = new PhysicsManager();
  await physics.init();
  const scene = new THREE.Scene(), sounds = [];
  const engine = { scene, sceneManager: { scene }, physics, RAPIER: physics.RAPIER, userMeshes: [],
    audio: { playSfx: name => sounds.push(name) },
    models: { has: () => true, clone: () => ({ root: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()) }) } };
  engine.player = new Player(new THREE.PerspectiveCamera(), physics);
  engine.player.engine = engine;
  engine.getPlayer = () => engine.player;
  const api = Object.assign(Object.create(GameAPI.prototype), { engine, _objects: [],
    shapes: createShapeFactories(engine), models: createModelFactories(engine), _createConsole: () => ({}) });
  const run = new RunLifecycle().begin(), scope = api.buildScope(run);
  t.after(() => {
    for (const object of [...api._objects]) object.destroy();
    engine.player.dispose(); physics.world.free(); physics._eventQueue.free();
    if (saved === undefined) delete globalThis.document; else globalThis.document = saved;
  });
  for (const scale of [50, 100, 200]) {
    scope.createCube({ scale, rotation: [45, 90, 180] });
    const raw = api._objects.at(-1);
    assert.equal(raw.scale.x, scale / 100);
    assert.equal(raw.rotation.y, Math.PI / 2);
    raw.destroy();
  }
  const options = studentCreationOptions({ scale: [100, 50, 200], rotation: [-90, 1, -45] });
  assert.deepEqual(options.scale, [1, 0.5, 2]);
  assert.equal(options.rotation[0], -Math.PI / 2);
  assert.equal(options.rotation[1], Math.PI / 180);
  const cube = scope.createCube({ scale: [100, 50, 200] });
  cube.setScale(50); assert.equal(api._objects.at(-1).scale.x, 0.5);
  cube.rotation.y = 90; assert.equal(api._objects.at(-1).rotation.y, Math.PI / 2);
  cube.scale.x = 200; assert.equal(api._objects.at(-1).scale.x, 2);
  cube.destroy();
  engine.player.setPlayerPosition([0, 2, 0]);
  scope.createGoldCoin({ scale: 70 });
  const coin = api._objects.at(-1);
  assert.deepEqual(coin.position.toArray(), [0, 2.5, 0]);
  assert.equal(coin.scale.x, 0.7);
  assert.equal(coin._collectionArmed, false);
  coin.updateCoin(1); assert.equal(coin.rotation.y, 0.6);
  coin.setSpinRate(2); coin.updateCoin(1); assert.ok(Math.abs(coin.rotation.y - 1.8) < 1e-12);
  coin.setSpinRate(0); coin.updateCoin(1); assert.ok(Math.abs(coin.rotation.y - 1.8) < 1e-12);
  coin._triggerCollision(engine.player); assert.equal(coin._destroyed, false);
  assert.deepEqual(sounds, []);
  engine.player.setPlayerPosition([10, 2, 0]); coin.updateCoin(0);
  assert.equal(coin._collectionArmed, true);
  engine.player.setPlayerPosition([0, 2, 0]);
  coin._triggerCollision(engine.player); coin._triggerCollision(engine.player);
  assert.deepEqual(sounds, ['coin']);
  assert.equal(engine.goldCoins.size, 0); assert.equal(api._objects.length, 0);
  assert.equal(coin._kinematicInfo, null);
  const explicit = api.models.createGoldCoin({ position: [20, 3, 4], scale: 1 });
  assert.deepEqual(explicit.position.toArray(), [20, 3, 4]);
  assert.equal(explicit.scale.x, 1); assert.equal(explicit._collectionArmed, true); explicit.destroy();
  const movement = engine.player.movementController;
  movement.grounded = false; movement._tryJump(engine.player.getSettings()); assert.equal(sounds.length, 1);
  movement.grounded = true; movement._tryJump(engine.player.getSettings()); assert.equal(sounds.at(-1), 'jump');
  movement._tryJump(engine.player.getSettings()); assert.equal(sounds.length, 2);
  assert.equal('playTyphoon' in scope, false);
  assert.equal(typeof scope.playExplosion, 'function');
  assert.equal(typeof VFXManager.prototype.createTyphoon, 'function');
  let typhoonError;
  await run.execute('playTyphoon();', scope, { error: cause => { typhoonError = cause; } });
  assert.ok(typhoonError instanceof ReferenceError);
  assert.equal(API_DOCS.some(item => item.label === 'playTyphoon'), false);
  assert.equal(GAME_API_DTS.includes('Typhoon'), false);
  assert.equal('playEmberExplosion' in scope, false);
  let error;
  await run.execute('playEmberExplosion();', scope, { error: cause => { error = cause; } });
  assert.ok(error instanceof ReferenceError);
  assert.equal(API_DOCS.some(item => item.label === 'playEmberExplosion'), false);
  assert.equal(GAME_API_DTS.includes('declare function playEmberExplosion'), false);
  assert.ok(API_DOCS.find(item => item.label === 'createGoldCoin').options.some(option => option.name === 'scale'));
});

test('music is looping, idempotent across Run/Reset calls, and stopped by Stop', () => {
  const instances = [];
  const audio = new AudioManager(url => {
    const sound = { url, currentTime: 0, plays: 0, play() { this.plays++; return Promise.resolve(); }, pause() { this.paused = true; } };
    instances.push(sound); return sound;
  });
  audio.playMusic(); const music = instances[0];
  assert.equal(music.loop, true); assert.equal(music.volume, 0.2);
  music.currentTime = 12; audio.playMusic(); audio.playMusic();
  audio.setMusicVolume(0.5); assert.equal(music.volume, 0.5);
  audio.setMusicVolume(0.2); assert.equal(music.volume, 0.2);
  assert.equal(music.currentTime, 12); assert.equal(music.plays, 1); assert.equal(instances.length, 1);
  audio.stopMusic(); assert.equal(music.currentTime, 0); assert.equal(music.paused, true);
});

test('explosion start plays charging immediately and later events do not replay it', async () => {
  const events = new Map(), sounds = [], impulses = [];
  const effect = { object3D: new THREE.Group(), config: {}, dispose() {},
    on(name, callback) { events.set(name, callback); } };
  const vfx = new VFXManager({ scene: new THREE.Scene(), audio: { playSfx: name => sounds.push(name) },
    physics: { bodies: new Map([[1, { body: { isDynamic: () => true, translation: () => ({ x: 1, y: 0, z: 0 }), mass: () => 1, applyImpulse: impulse => impulses.push(impulse) } }]]) } }, {
    loadVfxTextures: async () => ({}), playEmberExplosion: async () => ({ ...effect, object3D: new THREE.Group() }),
  });
  await vfx.playEmberExplosion({ position: [0, 0, 0] });
  assert.deepEqual(sounds, ['charging']);
  assert.equal(impulses.length, 0);
  for (let i = 0; i < 2; i++) {
    events.get('phase')({ phase: EMBER_EXPLOSION_PHASES.CHARGING });
    assert.equal(impulses.length, i === 0 ? 0 : 1);
    events.get('explode')();
  }
  assert.deepEqual(sounds, ['charging', 'explosion']);
  assert.equal(impulses.length, 1);
  assert.ok(impulses[0].x > 0);
  const firstExplode = events.get('explode');
  vfx.clear();
  firstExplode(); assert.equal(impulses.length, 1);
  await vfx.playEmberExplosion({ position: [0, 0, 0], radius: 5 });
  events.get('explode')(); events.get('explode')();
  assert.equal(impulses.length, 2);
  assert.ok(Math.abs(impulses[1].x - 40 * (1 - 1 / 5)) < 1e-8);
  await vfx.playEmberExplosion({ position: [0, 0, 0] });
  const disposedExplode = events.get('explode');
  vfx.clear(); disposedExplode();
  assert.equal(impulses.length, 2);
});


test('spherical blast uses real Rapier bodies, falloff, sleeping wakeup and upright player momentum', async t => {
  const { applyExplosionBlast } = await import('../engine/explosionBlast.js');
  const saved = globalThis.document;
  globalThis.document = new EventTarget();
  const physics = new PhysicsManager();
  await physics.init();
  const camera = new THREE.PerspectiveCamera();
  const player = new Player(camera, physics);
  t.after(() => {
    player.dispose(); physics.world.free(); physics._eventQueue.free();
    globalThis.document = saved;
  });
  const bodies = [[1, 0, 0], [4, 0, 0], [6, 0, 0], [0, 0, 0], [0, -2, 0], [1, 1, 1]].map(position => {
    const mesh = new THREE.Object3D(); mesh.position.fromArray(position);
    const { body } = physics.addDynamic(mesh, physics.RAPIER.ColliderDesc.ball(.1));
    body.recomputeMassPropertiesFromColliders(); return body;
  });
  const fixed = physics.addStaticBox(1, 0, 0, 1, 1, 1);
  physics.bodies.set('fixed-test', { body: fixed }); // Body capability is authoritative.
  const visual = new THREE.Object3D();
  const beforeCount = physics.bodies.size;
  player.setPlayerPosition([2, 0, 0]);
  const orientation = camera.quaternion.clone(), rotation = player.body.rotation();
  bodies[0].sleep();
  applyExplosionBlast({ physics, player }, new THREE.Vector3(), 5);
  assert.equal(bodies[0].isSleeping(), false);
  assert.ok(bodies[0].linvel().x > bodies[1].linvel().x);
  assert.equal(bodies[2].linvel().x, 0);
  assert.ok(bodies[4].linvel().y < 0);
  assert.ok(bodies[5].linvel().x > 0 && bodies[5].linvel().y > 0 && bodies[5].linvel().z > 0);
  assert.ok(Object.values(bodies[3].linvel()).every(Number.isFinite));
  assert.ok(bodies[3].linvel().y > 0);
  assert.equal(fixed.translation().x, 1);
  assert.equal(physics.bodies.size, beforeCount);
  assert.equal(visual.userData.gameObject, undefined);
  const movement = player.movementController;
  const initialKick = movement.knockbackVelocity.x;
  assert.ok(initialKick > 0);
  movement.update(1 / 60, { isDown: () => false, consumeJump: () => false }, 0);
  assert.ok(movement.knockbackVelocity.x > 0 && movement.knockbackVelocity.x < initialKick);
  assert.deepEqual(player.body.rotation(), rotation);
  assert.ok(camera.quaternion.equals(orientation));
  movement.knockbackVelocity.set(0, 0, 0);
  player.setPlayerPosition([20, 0, 0]);
  applyExplosionBlast({ physics, player }, new THREE.Vector3(), 5);
  assert.equal(movement.knockbackVelocity.length(), 0);
});

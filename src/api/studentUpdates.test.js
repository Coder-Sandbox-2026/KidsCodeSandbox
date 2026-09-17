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
  const events = new Map(), sounds = [];
  const effect = { object3D: new THREE.Group(), config: {}, dispose() {},
    on(name, callback) { events.set(name, callback); } };
  const vfx = new VFXManager({ scene: new THREE.Scene(), audio: { playSfx: name => sounds.push(name) } }, {
    loadVfxTextures: async () => ({}), playEmberExplosion: async () => effect,
  });
  await vfx.playEmberExplosion({ position: [0, 0, 0] });
  assert.deepEqual(sounds, ['charging']);
  for (let i = 0; i < 2; i++) {
    events.get('phase')({ phase: EMBER_EXPLOSION_PHASES.CHARGING });
    events.get('explode')();
  }
  assert.deepEqual(sounds, ['charging', 'explosion']);
  vfx.clear();
});

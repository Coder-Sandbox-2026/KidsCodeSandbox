import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { RunCancelledError } from './RunLifecycle.js';

// Node does not implement Vite's ?url imports. Only asset URL resolution is
// substituted; the API, engine, player, shapes and Rapier remain real modules.
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('?url')) {
      const asset = new URL(specifier, context.parentURL).href;
      return { url: `data:text/javascript,${encodeURIComponent(`export default ${JSON.stringify(asset)}`)}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { GameEngine } = await import('./GameEngine.js');
const { GameAPI } = await import('../api/GameAPI.js');
const { PhysicsManager } = await import('./PhysicsManager.js');
const { Player } = await import('../api/Player.js');
const { VFXManager } = await import('./VFXManager.js');
hook.deregister();

class Element {
  constructor() { this.children = []; this.style = {}; this.offsetHeight = 16; }
  appendChild(child) { child.parentNode = this; this.children.push(child); }
  remove() { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  set innerHTML(value) { for (const child of this.children) child.parentNode = null; this.children = []; }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(t) {
  const saved = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = Object.assign(new EventTarget(), { createElement: () => new Element(), pointerLockElement: null });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const engine = new GameEngine({});
  engine.sceneManager = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() };
  engine.renderer = { render() {} };
  engine.physics = new PhysicsManager();
  await engine.physics.init();
  engine.player = new Player(engine.camera, engine.physics);
  engine.player.engine = engine;
  engine.level = { build() {}, clear() {} };
  engine.levelLoaded = true;
  engine.running = true;
  engine._animId = 1;
  engine.vfx = { clear() {}, update() {}, releaseTyphoonTextures() {}, retainTyphoonTextures() {} };
  const output = [];
  const hud = new Element();
  const api = new GameAPI(engine, hud, message => output.push(message), () => { output.length = 0; });
  const begin = () => {
    const run = engine.beginStudentRun();
    api.reset();
    return { run, scope: api.buildScope(run) };
  };
  const invalidate = action => {
    if (action === 'Run') return begin();
    if (action === 'Reset') engine.reset();
    else engine.clearScene();
    api.reset();
  };
  t.after(() => {
    engine.runs.invalidate();
    engine.stop();
    engine.clearUserObjects();
    engine.player.dispose();
    engine.physics.world.free();
    engine.physics._eventQueue.free();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  return { engine, api, hud, output, begin, invalidate };
}

test('print observer detects successful runtime calls only', async t => {
  const h = await harness(t);
  const { run } = h.begin();
  let prints = 0;
  const scope = h.api.buildScope(run, { onPrint: () => prints++ });
  await run.execute('// print("comment");\nconst text = "print";', scope);
  assert.equal(prints, 0);
  await run.execute('const say = print; say("hello");', scope);
  assert.equal(prints, 1);
  h.api.hud.print = () => { throw new Error('print failed'); };
  assert.throws(() => scope.print('failure'), /print failed/);
  assert.equal(prints, 1);
});

test('old print observers cannot report after a new run or reset', async t => {
  const h = await harness(t);
  const { run } = h.begin();
  let prints = 0;
  const oldScope = h.api.buildScope(run, { onPrint: () => prints++ });
  const gate = deferred();
  const pending = run.execute('await gate; print("late");', { ...oldScope, gate: gate.promise });
  const next = h.begin();
  gate.resolve();
  await pending;
  assert.equal(prints, 0);
  assert.throws(() => oldScope.print('stale'), RunCancelledError);
  const nextScope = h.api.buildScope(next.run, { onPrint: () => prints++ });
  h.engine.reset();
  assert.throws(() => nextScope.print('reset'), RunCancelledError);
  assert.equal(prints, 0);
});

for (const action of ['Run', 'Reset', 'Clear']) {
  test(`${action} cancels old wait before createCube (A/B/C)`, async t => {
    const h = await harness(t);
    const { run, scope } = h.begin();
    const reports = [];
    const pending = run.execute('await wait(60000); createCube(); print("old");', scope, {
      success: () => reports.push('success'), error: e => reports.push(e),
    });
    assert.equal(run.waits.size, 1);
    h.invalidate(action);
    await pending;
    assert.equal(h.engine.userMeshes.length, 0);
    assert.equal(h.hud.children.length, 0);
    assert.deepEqual(h.output, []);
    assert.deepEqual(reports, []);
    assert.equal(run.waits.size, 0);
  });

  test(`${action} guards arbitrary await and retained player/object references`, async t => {
    const h = await harness(t);
    const { run, scope } = h.begin();
    const cube = scope.createCube();
    const player = scope.getPlayer();
    const setSpeed = player.setWalkSpeed;
    const position = cube.position;
    const gate = deferred();
    let resumed = false;
    const pending = run.execute('await gate; resumed(); createCube();', {
      ...scope, gate: gate.promise, resumed: () => { resumed = true; },
    });
    h.invalidate(action);
    gate.resolve();
    await pending;
    assert.equal(resumed, true, 'native promises can resume; API access must still be denied');
    assert.equal(h.engine.userMeshes.length, 0);
    assert.throws(() => setSpeed(99), RunCancelledError);
    assert.throws(() => { player.name = 'old'; }, RunCancelledError);
    assert.throws(() => { position.x = 99; }, RunCancelledError);
    assert.throws(() => scope.getPlayer(), RunCancelledError);
    assert.equal(h.engine.player.getWalkSpeed(), 7);
  });
}

test('current API preserves identity, chaining, vector access, callbacks and physics', async t => {
  const h = await harness(t);
  const { scope } = h.begin();
  const cube = scope.createCube({ name: 'cube', physics: true });
  assert.equal(cube, scope.findObject('cube'));
  assert.equal(cube.setColor('red'), cube);
  assert.equal(cube.position.set(1, 2, 3), cube.position);
  assert.equal(scope.getPlayer().setWalkSpeed(8), scope.getPlayer());
  assert.equal(h.engine.player.getWalkSpeed(), 8);
  assert.equal(h.engine.physics.bodies.size, 1);
  let other;
  cube.onCollision(actor => { other = actor; });
  h.engine._notifyCollisionPair(h.api._objects[0], h.engine.player);
  assert.equal(other, scope.getPlayer());
  let clicked;
  cube.onClick(event => { clicked = event.gameObject; event.gameObject.color = 'blue'; });
  h.api._objects[0]._triggerClick({ gameObject: h.api._objects[0], point: new THREE.Vector3() });
  assert.equal(clicked, cube);
  assert.equal(cube.color, '#0000ff');
  scope.console.log(scope.getPlayer());
  assert.match(h.output[0], /player/);
  scope.destroy(cube);
  assert.equal(h.engine.physics.bodies.size, 0);
});

test('old update, click, collision, player and keyboard callbacks cannot fire in Run 2 (D)', async t => {
  const h = await harness(t);
  const { scope } = h.begin();
  const cube = scope.createCube();
  let calls = 0;
  const hit = () => { calls++; };
  scope.update(hit);
  cube.onClick(hit);
  cube.onCollision(hit);
  scope.getPlayer().onCollision(hit);
  scope.onKeyDown('KeyE', hit);
  scope.onKeyPressed('KeyE', hit);
  scope.onKeyReleased('KeyE', hit);
  const raw = h.api._objects[0];
  const oldCallbacks = [h.engine.userUpdateCallbacks[0], raw._onClick, raw._onCollision,
    h.engine.player._onCollision, ...h.api._keyHandlers.map(handler => handler.fn)];
  for (const callback of oldCallbacks) callback();
  assert.equal(calls, oldCallbacks.length);
  const current = h.begin();
  for (const callback of oldCallbacks) callback();
  h.engine.player._triggerCollision(null);
  assert.equal(calls, oldCallbacks.length);
  assert.throws(() => scope.update(hit), RunCancelledError);
  current.scope.onKeyPressed('KeyE', hit);
  h.api._emitKey({ code: 'KeyE' }, 'pressed');
  assert.equal(calls, oldCallbacks.length + 1);
});

test('async callbacks already in flight cannot mutate a retained player after await', async t => {
  const h = await harness(t);
  const { scope } = h.begin();
  const player = scope.getPlayer();
  const gate = deferred();
  scope.update(async () => { await gate.promise; player.setWalkSpeed(99); });
  const pending = h.engine.userUpdateCallbacks[0]();
  h.begin();
  gate.resolve();
  await pending;
  assert.equal(h.engine.player.getWalkSpeed(), 7);
});

test('stale console, HUD and completion/error reporting cannot affect Run 2 (F)', async t => {
  const h = await harness(t);
  const { run, scope } = h.begin();
  const gate = deferred();
  const reports = [];
  const pending = run.execute('await gate; throw new Error("old failure");', { ...scope, gate: gate.promise }, {
    success: () => reports.push('old success'), error: e => reports.push(e.message),
  });
  const current = h.begin();
  current.scope.print('current', { duration: 0 });
  current.scope.setText('score', 'current score');
  for (const call of [() => scope.print('old'), () => scope.setText('score', 'old'),
    () => scope.clearText(), () => scope.console.clear(), () => scope.console.log('old'),
    () => scope.console.error('old'), () => scope.console.count(), () => scope.log('old')]) {
    assert.throws(call, RunCancelledError);
  }
  gate.resolve();
  await pending;
  assert.deepEqual(h.output, ['current']);
  assert.equal(h.hud.children.length, 2);
  assert.equal(h.api.hud.namedTexts.get('score').textContent, 'current score');
  assert.deepEqual(reports, []);
});

test('catch/finally cannot bypass invalidation, even when wait cancellation is caught', async t => {
  const h = await harness(t);
  const { run, scope } = h.begin();
  const attempts = [];
  const pending = run.execute(`
    try { await wait(60000); }
    catch { try { createCube(); } catch { mark('create blocked'); } }
    finally { try { print('old'); } catch { mark('print blocked'); } }
  `, { ...scope, mark: value => attempts.push(value) });
  h.begin();
  await pending;
  assert.deepEqual(attempts, ['create blocked', 'print blocked']);
  assert.equal(h.engine.userMeshes.length, 0);
  assert.deepEqual(h.output, []);
});

test('Stop keeps ownership, waits and keyboard behavior unchanged', async t => {
  const h = await harness(t);
  const { run, scope } = h.begin();
  let keys = 0;
  scope.onKeyPressed('KeyE', () => { keys++; });
  scope.update(() => {});
  const pending = run.execute('await wait(0); createCube();', scope);
  h.engine.stop();
  assert.equal(run.active, true);
  assert.equal(h.engine.userUpdateCallbacks.length, 0);
  assert.equal(h.engine.player.input.enabled, false);
  h.api._emitKey({ code: 'KeyE' }, 'pressed');
  await pending;
  assert.equal(keys, 1);
  assert.equal(h.engine.userMeshes.length, 1);
});

for (const method of ['playEmberExplosion', 'createTyphoon']) {
  for (const phase of ['textures', 'construction']) {
    for (const action of ['Run', 'Reset', 'Clear']) {
      test(`${method}: ${action} invalidates pending ${phase} (E)`, async t => {
        const h = await harness(t);
        const gate = deferred();
        const started = deferred();
        let built = 0;
        let effect;
        const build = async staging => {
          built++;
          effect = { object3D: new THREE.Group(), disposed: false, on() {},
            dispose() { this.disposed = true; this.object3D.removeFromParent(); } };
          staging.add(effect.object3D);
          assert.notEqual(staging, h.engine.scene);
          started.resolve();
          if (phase === 'construction') await gate.promise;
          return effect;
        };
        const modules = {
          loadVfxTextures: () => phase === 'textures' ? gate.promise : Promise.resolve({}),
          loadTyphoonTextures: () => phase === 'textures' ? gate.promise : Promise.resolve({}),
          playEmberExplosion: build, createTyphoon: build,
        };
        h.engine.vfx = new VFXManager(h.engine, modules);
        const { run } = h.begin();
        const pending = h.engine.vfx[method]({}, run);
        if (phase === 'construction') await started.promise;
        h.invalidate(action);
        gate.resolve({});
        assert.equal(await pending, null);
        assert.equal(h.engine.vfx._effects.size, 0);
        assert.equal(h.engine.scene.children.length, 0);
        if (phase === 'textures') assert.equal(built, 0);
        else assert.equal(effect.disposed, true);
      });
    }
  }
}

test('current VFX and toolbar VFX still attach to the scene', async t => {
  const h = await harness(t);
  const build = async staging => {
    const effect = { object3D: new THREE.Group(), on() {}, dispose() { this.object3D.removeFromParent(); } };
    staging.add(effect.object3D);
    return effect;
  };
  h.engine.vfx = new VFXManager(h.engine, {
    loadVfxTextures: async () => ({}), loadTyphoonTextures: async () => ({}),
    playEmberExplosion: build, createTyphoon: build,
  });
  const { run, scope } = h.begin();
  assert.equal(scope.playTyphoon(), undefined, 'public VFX return contract stays void');
  const effect = await h.engine.vfx.playEmberExplosion({}, run);
  const toolbar = await h.engine.vfx.playEmberExplosion();
  assert.equal(effect.object3D.parent, h.engine.scene);
  assert.equal(toolbar.object3D.parent, h.engine.scene);
  assert.equal(h.engine.vfx._effects.size, 3);
});


import { CHALLENGES } from '../challenges/challengeCatalog.js';
import { createChallengeValidator } from '../challenges/challengeValidation.js';

test('number print preserves HUD, console, observer, options and undefined return', async t => {
  const h = await harness(t);
  const { run } = h.begin();
  const values = [];
  const scope = h.api.buildScope(run, { onPrint: value => values.push(value) });
  assert.equal(scope.print(9, { duration: 0, size: 24 }), undefined);
  assert.equal(h.hud.children[0].textContent, '9');
  assert.equal(h.hud.children[0].style.fontSize, '24px');
  assert.deepEqual(h.output, ['9']);
  assert.deepEqual(values, [9]);
  h.api.reset();
});

test('catalog answers complete through real run/API observations and stale observers cannot complete', async t => {
  const h = await harness(t);
  let completions = 0;
  let oldScope;
  for (const challenge of CHALLENGES) {
    const { run } = h.begin();
    const validator = createChallengeValidator(challenge, challenge.example, {
      isCurrent: () => run.active, onComplete: () => completions++,
    });
    const scope = h.api.buildScope(run, { onCall: validator.observe });
    const errors = [];
    await run.execute(challenge.example, scope, { success: validator.succeeded, error: e => errors.push(e) });
    assert.deepEqual(errors, [], challenge.title);
    assert.equal(validator.complete, true, challenge.title);
    oldScope = scope;
  }
  assert.equal(completions, CHALLENGES.length);
  h.begin();
  assert.throws(() => oldScope.getPlayer(), RunCancelledError);
  assert.equal(completions, CHALLENGES.length);
  h.api.reset();
});

test('only successful console, shape and jump-force calls report; stale player methods are guarded', async t => {
  const h = await harness(t);
  const { run } = h.begin();
  const calls = [];
  const scope = h.api.buildScope(run, { onCall: (name, value) => calls.push([name, value]) });
  scope.console.info('not log');
  const player = scope.getPlayer();
  assert.throws(() => player.setJumpForce(-1));
  scope.createSphere();
  player.setJumpForce(15);
  scope.console.log('hello');
  assert.deepEqual(calls.map(([name]) => name), ['getPlayer', 'createSphere', 'setJumpForce', 'console.log']);
  const setter = player.setJumpForce;
  h.begin();
  assert.throws(() => setter(20), RunCancelledError);
  assert.equal(calls.length, 4);
});


test('placement defaults use live unrounded player coordinates with explicit override and null fallback', async t => {
  const h = await harness(t);
  const { scope } = h.begin();
  // Models use the real ModelFactory with a small cloned visual fixture.
  h.engine.models = { has: () => true, clone: () => ({ root: new THREE.Group(), colliderParts: [] }) };
  for (const name of ['createCone', 'createCake']) {
    h.engine.player.body.setTranslation({ x: 5.25, y: 2, z: -8.75 }, true);
    const expected = h.engine.getPlayer().position.clone();
    const object = scope[name]({ collision: false });
    assert.deepEqual([...object.position.toArray()], expected.toArray());
    const explicit = [10.12345, 2, -4];
    assert.deepEqual([...scope[name]({ position: explicit, collision: false }).position.toArray()], explicit);
    h.engine.player.body.setTranslation({ x: 12.25, y: 4, z: 3 }, true);
    assert.deepEqual([...scope[name]({ collision: false }).position.toArray()], h.engine.getPlayer().position.toArray());
  }
  const getPlayer = h.engine.getPlayer;
  h.engine.getPlayer = () => null;
  assert.deepEqual([...scope.createCube().position.toArray()], [0, 0, 0]);
  assert.deepEqual([...scope.createCake({ collision: false }).position.toArray()], [0, 0, 0]);
  h.engine.getPlayer = () => { throw Error('not ready'); };
  assert.deepEqual([...scope.createCube().position.toArray()], [0, 0, 0]);
  h.engine.getPlayer = getPlayer;
});

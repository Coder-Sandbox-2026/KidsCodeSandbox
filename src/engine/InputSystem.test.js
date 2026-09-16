import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputSystem } from './InputSystem.js';

test('input requires capture and clears held keys, jumps and look across capture changes', t => {
  const previous = globalThis.document;
  const doc = Object.assign(new EventTarget(), { pointerLockElement: null });
  globalThis.document = doc;
  const input = new InputSystem();
  t.after(() => { input.dispose(); globalThis.document = previous; });
  const key = (code, repeat = false) => doc.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat }));
  key('KeyW'); key('Space');
  assert.equal(input.isDown('KeyW'), false);
  assert.equal(input.consumeJump(), false);
  doc.pointerLockElement = {};
  doc.dispatchEvent(new Event('pointerlockchange'));
  key('KeyW'); key('Space');
  assert.equal(input.isDown('KeyW'), true);
  assert.equal(input.consumeJump(), true);
  doc.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 4, movementY: 2 }));
  doc.pointerLockElement = null;
  doc.dispatchEvent(new Event('pointerlockchange'));
  doc.pointerLockElement = {};
  doc.dispatchEvent(new Event('pointerlockchange'));
  key('KeyW', true);
  assert.equal(input.isDown('KeyW'), false);
  assert.deepEqual(input.consumeLookDelta(), { x: 0, y: 0 });
  key('KeyW'); key('Space');
  input.setEnabled(false); input.setEnabled(true);
  assert.equal(input.isDown('KeyW'), false);
  assert.equal(input.consumeJump(), false);
});


import { FirstPersonCameraController } from './FirstPersonCameraController.js';

test('control styles map movement, turning and mouse look with capture and clean switching', t => {
  const previous = globalThis.document;
  const doc = Object.assign(new EventTarget(), { pointerLockElement: {} });
  globalThis.document = doc;
  let change;
  let unsubscribed = false;
  const input = new InputSystem({ get: () => 'experienced', subscribe: fn => {
    change = fn; return () => { unsubscribed = true; };
  } });
  t.after(() => { input.dispose(); globalThis.document = previous; });
  const key = code => doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code }));
  const mouse = () => doc.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 10, movementY: 5 }));
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { key(code); assert.equal(input.isDown(code), true); }
  mouse();
  assert.deepEqual(input.consumeLookDelta(.1), { x: 10, y: 5 });
  key('Space'); assert.equal(input.consumeJump(), true);
  mouse(); key('Space');
  change({ controlStyle: 'simple' }, 'controlStyle');
  assert.equal(input.isDown('KeyW'), false);
  assert.equal(input.consumeJump(), false);
  mouse();
  assert.deepEqual(input.consumeLookDelta(.1), { x: 0, y: 0, turnRadians: 0 });
  key('ArrowUp'); key('ArrowDown'); key('ArrowLeft'); key('KeyA'); key('KeyD');
  assert.equal(input.isDown('KeyW'), true);
  assert.equal(input.isDown('KeyS'), true);
  assert.equal(input.isDown('KeyA'), false);
  assert.equal(input.isDown('KeyD'), false);
  const camera = new FirstPersonCameraController({});
  camera.applyLook(input.consumeLookDelta(.5));
  assert.equal(camera.yaw, Math.PI / 4);
  input.clear(); key('ArrowRight');
  camera.applyLook(input.consumeLookDelta(.25));
  camera.applyLook(input.consumeLookDelta(.25));
  assert.equal(camera.yaw, 0);
  key('Space'); assert.equal(input.consumeJump(), true);
  doc.pointerLockElement = null;
  doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(key('ArrowUp'), true); // Inactive arrows keep normal browser behavior.
  assert.equal(input.isDown('KeyW'), false);
  assert.deepEqual(input.consumeLookDelta(.5), { x: 0, y: 0 });
  doc.pointerLockElement = {};
  key('ArrowUp');
  change({ controlStyle: 'experienced' }, 'controlStyle');
  assert.equal(input.isDown('KeyW'), false);
  assert.equal(input.isDown('ArrowUp'), false);
  input.dispose();
  assert.equal(unsubscribed, true);
});

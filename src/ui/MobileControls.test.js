import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joystickAxes, runEscapeAction, runReleasedAction, shouldShowMobileControls } from './MobileControls.js';
import { InputSystem } from '../engine/InputSystem.js';

test('mobile controls require capability, landscape, active unblocked gameplay input', () => {
  const ready = { capable: true, landscape: true, gameActive: true, inputAllowed: true, blocked: false };
  assert.equal(shouldShowMobileControls(ready), true);
  for (const key of ['capable', 'landscape', 'gameActive', 'inputAllowed']) {
    assert.equal(shouldShowMobileControls({ ...ready, [key]: false }), false);
  }
  assert.equal(shouldShowMobileControls({ ...ready, blocked: true }), false);
});

test('joystick maps axes with dead zone, circular clamp, and normalized diagonals', () => {
  assert.deepEqual(joystickAxes(5, 5, 100), { x: 0, y: 0 });
  const right = joystickAxes(100, 0, 100);
  assert.deepEqual(right, { x: 1, y: -0 });
  const diagonal = joystickAxes(100, -100, 100);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.ok(diagonal.x > 0 && diagonal.y > 0);
});

test('virtual input is analog, normalized, and clears without pointer lock', t => {
  const previous = globalThis.document;
  const doc = Object.assign(new EventTarget(), { pointerLockElement: null, activeElement: null });
  globalThis.document = doc;
  const input = new InputSystem({ get: () => 'experienced', subscribe: () => () => {} });
  t.after(() => { input.dispose(); globalThis.document = previous; });
  input.setVirtualActive(true);
  input.setVirtualMove(1, 1);
  input.setVirtualLook(.5, -.5);
  input.queueVirtualJump();
  const axes = input.getMoveAxes();
  assert.ok(Math.abs(Math.hypot(axes.x, axes.y) - 1) < 1e-12);
  assert.equal(input.consumeJump(), true);
  assert.notEqual(input.consumeLookDelta(1).turnRadians, 0);
  input.clearVirtual();
  assert.deepEqual(input.getMoveAxes(), { x: 0, y: 0 });
  assert.equal(input.consumeJump(), false);
  assert.equal(input.consumeLookDelta(1).turnRadians, 0);
});

test('escape control invokes the shared application action', () => {
  let calls = 0;
  runEscapeAction(() => { calls += 1; });
  assert.equal(calls, 1);
});

test('released action invokes its API callback once', () => {
  let calls = 0;
  runReleasedAction(() => { calls += 1; });
  assert.equal(calls, 1);
});

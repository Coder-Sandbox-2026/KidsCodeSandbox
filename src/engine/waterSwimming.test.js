import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FirstPersonMovementController } from './FirstPersonMovementController.js';
import { createPlayerSettings } from './playerSettings.js';

function volume(getBottomHeight = () => -3) {
  return {
    id: 'test-water', minX: -5, maxX: 5, minZ: -5, maxZ: 5,
    containsHorizontalPosition(x, z, margin = 0) {
      return x >= this.minX - margin && x <= this.maxX + margin
        && z >= this.minZ - margin && z <= this.maxZ + margin;
    },
    getSurfaceHeight: () => 1.05,
    getBottomHeight,
  };
}

function fixture(position = { x: 0, y: 0.91, z: 0 }, settings = createPlayerSettings()) {
  const body = {
    position: { ...position },
    translation() { return this.position; },
    setNextKinematicTranslation(next) { this.position = { ...next }; },
  };
  const character = {
    movement: { x: 0, y: 0, z: 0 },
    computeColliderMovement(_collider, movement) { this.movement = movement; },
    computedMovement() { return this.movement; },
    grounded: false,
    computedGrounded() { return this.grounded; },
    numComputedCollisions() { return 0; },
    enableAutostep() {}, enableSnapToGround() {}, setSlideEnabled() {}, setMaxSlopeClimbAngle() {},
  };
  const physics = {
    RAPIER: { QueryFilterFlags: { EXCLUDE_SENSORS: 1 } },
    createCharacterController: () => character,
  };
  const controller = new FirstPersonMovementController({
    physics, body, collider: {}, getSettings: () => settings,
  });
  const input = {
    axes: { x: 0, y: 0 }, jump: false,
    getMoveAxes() { return this.axes; },
    consumeJump() { const queued = this.jump; this.jump = false; return queued; },
  };
  const context = { waterVolumes: [volume()], eyeHeight: 0.8 };
  return { controller, body, input, context, settings, character };
}

test('swimming enters at immersion threshold and smoothly converges to surface height', () => {
  const h = fixture();
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false);

  h.body.position.y = 0.90;
  const first = h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true);
  assert.notEqual(first.y, 0.5, 'surface correction must not hard-snap');

  for (let i = 0; i < 240; i++) h.controller.update(1 / 60, h.input, 0, h.context);
  assert.ok(Math.abs(h.body.position.y - 0.5) < 0.015, `body y=${h.body.position.y}`);
});

test('swimming uses shared horizontal axes at reduced speed and ignores camera pitch', () => {
  const h = fixture({ x: 0, y: 0.5, z: 0 });
  h.input.axes = { x: 1, y: 1 };
  for (let i = 0; i < 120; i++) {
    h.controller.update(1 / 60, h.input, 0.4, h.context);
    h.body.position.x = 0;
    h.body.position.z = 0;
  }
  const speed = Math.hypot(h.controller.horizVelocity.x, h.controller.horizVelocity.z);
  assert.ok(Math.abs(speed - h.settings.walkSpeed * 0.65) < 0.01);
  assert.ok(Math.abs(Math.abs(h.controller.horizVelocity.x)
    - Math.abs(h.controller.horizVelocity.z)) > 0.1, 'yaw, not pitch, rotates the normalized axes');

  const withPitch = fixture({ x: 0, y: 0.5, z: 0 });
  withPitch.input.axes = { x: 0, y: 1 };
  const flat = fixture({ x: 0, y: 0.5, z: 0 });
  flat.input.axes = { x: 0, y: 1 };
  const a = withPitch.controller.update(1 / 60, withPitch.input, 0.4,
    { ...withPitch.context, cameraPitch: 1.4 });
  const b = flat.controller.update(1 / 60, flat.input, 0.4, flat.context);
  assert.equal(a.x, b.x);
  assert.equal(a.z, b.z);
});

test('swim jump stays modest, leaving restores gravity, and lifecycle clears state', () => {
  const settings = { ...createPlayerSettings(), jumpCount: 0 };
  const h = fixture({ x: 0, y: 0.5, z: 0 }, settings);
  h.controller.update(1 / 60, h.input, 0, h.context);
  h.input.jump = true;
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true);
  assert.ok(h.controller.velocity.y > 0, 'queued jump provides a surface boost');
  assert.ok(h.controller.velocity.y < 3, 'surface boost does not launch at the boundary');
  assert.equal(h.controller._jumpsUsed, 0, 'ordinary jump-count path was not used');

  h.body.position.x = 5.3;
  const before = h.controller.velocity.y;
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false);
  assert.ok(h.controller.velocity.y < before, 'normal gravity resumes outside water');

  h.body.position = { x: 0, y: 0.5, z: 0 };
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true);
  h.controller.velocity.y = 2;
  h.controller.clearSwimming(true); // Stop/disable path.
  assert.equal(h.controller.swimming, false);
  assert.equal(h.controller.velocity.y, 0);
  h.controller.reset(h.body.position); // Reset/teleport path.
  assert.equal(h.controller.swimming, false);
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true, 'submerged teleport is re-evaluated next update');
});

test('depth hysteresis keeps shallow water wading and exits swimming without flicker', () => {
  let bottomY = 0.12;
  const h = fixture({ x: 0, y: 0.5, z: 0 });
  h.context.waterVolumes = [volume(() => bottomY)];
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false, '0.93-deep shelf is wading water');

  bottomY = -3;
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true, 'deep center activates swimming');

  bottomY = -0.35; // 1.40 deep: between the entry and exit thresholds.
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, true, 'active swimming retains depth hysteresis');
  h.controller.clearSwimming();
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false, 'wading cannot re-enter inside the hysteresis band');

  bottomY = -3;
  h.controller.update(1 / 60, h.input, 0, h.context);
  bottomY = -0.28; // 1.33 deep: below the exit threshold.
  const before = h.controller.velocity.y;
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false);
  assert.ok(h.controller.velocity.y < before, 'normal gravity resumes in shallow water');
});

test('normal walking and grounded jumping are unchanged without water', () => {
  const h = fixture({ x: 0, y: 1, z: 0 });
  h.context.waterVolumes = [];
  h.character.grounded = true;
  h.input.axes = { x: 0, y: 1 };
  h.input.jump = true;
  h.controller.update(1 / 60, h.input, 0, h.context);
  assert.equal(h.controller.swimming, false);
  assert.equal(h.controller.horizVelocity.length(), h.settings.walkSpeed);
  assert.equal(h.controller.velocity.y, h.settings.jumpForce);
  assert.equal(h.controller._jumpsUsed, 1);
});

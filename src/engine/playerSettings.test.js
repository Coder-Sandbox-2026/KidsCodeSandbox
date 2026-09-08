/**
 * Small node:test checks for player settings validation and actor identity.
 * Run: node --test src/engine/playerSettings.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlayerSettings,
  createPlayerSettings,
  DEFAULT_PLAYER_SETTINGS,
  validatePlayerSetting,
} from './playerSettings.js';
import { Actor, ACTOR_KIND } from './Actor.js';

test('defaults match the original first-person feel', () => {
  const s = createPlayerSettings();
  assert.equal(s.walkSpeed, DEFAULT_PLAYER_SETTINGS.walkSpeed);
  assert.equal(s.jumpForce, 7);
  assert.equal(s.gravity, 25);
  assert.equal(s.jumpCount, 1);
});

test('rejects negative walk speed with a friendly message', () => {
  assert.throws(
    () => validatePlayerSetting('walkSpeed', -10),
    { message: 'Walk speed must be 0 or greater.' }
  );
});

test('rejects non-numbers', () => {
  assert.throws(
    () => validatePlayerSetting('jumpForce', 'boing'),
    { message: 'Jump force must be a number.' }
  );
});

test('air control must stay between 0 and 1', () => {
  assert.throws(
    () => validatePlayerSetting('airControl', 2),
    { message: 'Air control must be between 0 and 1.' }
  );
  assert.equal(validatePlayerSetting('airControl', 0.5), 0.5);
});

test('setSettings applies known keys and ignores extras', () => {
  const next = applyPlayerSettings(createPlayerSettings(), {
    walkSpeed: 8,
    jumpForce: 12,
    gravity: 20,
    notARealSetting: 99,
  });
  assert.equal(next.walkSpeed, 8);
  assert.equal(next.jumpForce, 12);
  assert.equal(next.gravity, 20);
  assert.equal(next.notARealSetting, undefined);
});

test('setSettings rejects a bad object', () => {
  assert.throws(
    () => applyPlayerSettings(createPlayerSettings(), 8),
    { message: /expects an object/ }
  );
});

test('Actor isPlayer is only true for the player kind', () => {
  const obj = new Actor();
  const player = new Actor({ kind: ACTOR_KIND.PLAYER });
  assert.equal(obj.isPlayer(), false);
  assert.equal(player.isPlayer(), true);
});

test('onCollision fires only when triggered (start, not a loop)', () => {
  const hits = [];
  const obj = new Actor();
  obj.onCollision((other) => hits.push(other));
  const player = new Actor({ kind: ACTOR_KIND.PLAYER });
  obj._triggerCollision(player);
  obj._triggerCollision(player);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].isPlayer(), true);
});

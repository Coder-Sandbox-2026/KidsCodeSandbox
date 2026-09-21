import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRenderPixelRatio, getTargetRenderHeight } from './graphicsProfiles.js';

test('profile defaults resolve to their target heights', () => {
  assert.equal(getTargetRenderHeight('low', 'profile'), 540);
  assert.equal(getTargetRenderHeight('medium', 'profile'), 720);
  assert.equal(getTargetRenderHeight('high', 'profile'), 900);
  assert.equal(getTargetRenderHeight('ultra', 'profile'), null);
});

test('profiles define the intended shadow quality tiers', async () => {
  const { GRAPHICS_PROFILES } = await import('./graphicsProfiles.js');
  assert.equal(GRAPHICS_PROFILES.low.shadowQuality, 'off');
  assert.equal(GRAPHICS_PROFILES.medium.shadowQuality, 'medium');
  assert.equal(GRAPHICS_PROFILES.high.shadowQuality, 'high');
  assert.equal(GRAPHICS_PROFILES.ultra.shadowQuality, 'high');
});

test('profiles define reduced bloom for Low/Medium and full bloom for High/Ultra', async () => {
  const { GRAPHICS_PROFILES } = await import('./graphicsProfiles.js');
  assert.equal(GRAPHICS_PROFILES.low.bloomQuality, 'reduced');
  assert.equal(GRAPHICS_PROFILES.medium.bloomQuality, 'reduced');
  assert.equal(GRAPHICS_PROFILES.high.bloomQuality, 'full');
  assert.equal(GRAPHICS_PROFILES.ultra.bloomQuality, 'full');
});

test('profiles define generic water quality tiers', async () => {
  const { GRAPHICS_PROFILES } = await import('./graphicsProfiles.js');
  assert.equal(GRAPHICS_PROFILES.low.waterQuality, 'low');
  assert.equal(GRAPHICS_PROFILES.medium.waterQuality, 'medium');
  assert.equal(GRAPHICS_PROFILES.high.waterQuality, 'high');
  assert.equal(GRAPHICS_PROFILES.ultra.waterQuality, 'ultra');
});

test('manual targets override profiles and never exceed native resolution', () => {
  assert.equal(getTargetRenderHeight('high', '720'), 720);
  assert.equal(getRenderPixelRatio(1080, 1, 'medium', 'profile'), 720 / 1080);
  assert.equal(getRenderPixelRatio(720, 1, 'high', 'profile'), 1);
  assert.equal(getRenderPixelRatio(720, 2, 'low', 'profile'), 0.75);
  assert.equal(getRenderPixelRatio(720, 2, 'medium', 'native'), 2);
});

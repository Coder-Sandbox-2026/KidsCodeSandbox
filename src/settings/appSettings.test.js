import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_DEFAULTS, isValidSettingValue } from './settingsSchema.js';

test('Code Coach default is High', () => {
  assert.equal(SETTINGS_DEFAULTS.codeCoach, 'high');
});

test('only known Code Coach levels are valid', () => {
  assert.equal(isValidSettingValue('codeCoach', 'high'), true);
  assert.equal(isValidSettingValue('codeCoach', 'off'), true);
  assert.equal(isValidSettingValue('codeCoach', 'super'), false);
  assert.equal(isValidSettingValue('theme', 'dark'), false);
});

test('graphics settings have safe defaults and validate saved values', () => {
  assert.equal(SETTINGS_DEFAULTS.graphicsProfile, 'medium');
  assert.equal(SETTINGS_DEFAULTS.renderResolutionOverride, 'profile');
  for (const value of ['low', 'medium', 'high', 'ultra']) {
    assert.equal(isValidSettingValue('graphicsProfile', value), true);
  }
  for (const value of ['profile', '360', '480', '540', '720', '900', '1080', 'native']) {
    assert.equal(isValidSettingValue('renderResolutionOverride', value), true);
  }
  assert.equal(isValidSettingValue('graphicsProfile', 'maximum'), false);
  assert.equal(isValidSettingValue('renderResolutionOverride', '1440'), false);
});


test('control style defaults and saved-value validation use the existing store', async t => {
  assert.equal(SETTINGS_DEFAULTS.controlStyle, 'experienced');
  assert.equal(isValidSettingValue('controlStyle', 'simple'), true);
  assert.equal(isValidSettingValue('controlStyle', 'unknown'), false);
  const previous = globalThis.localStorage;
  let saved = JSON.stringify({
    codeCoach: 'guided',
    controlStyle: 'unknown',
    graphicsProfile: 'maximum',
    renderResolutionOverride: '1440',
  });
  globalThis.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  t.after(() => { globalThis.localStorage = previous; });
  const { appSettings } = await import('./appSettings.js?controls-test');
  assert.equal(appSettings.get('controlStyle'), 'experienced');
  assert.equal(appSettings.get('codeCoach'), 'guided');
  assert.equal(appSettings.get('graphicsProfile'), 'medium');
  assert.equal(appSettings.get('renderResolutionOverride'), 'profile');
  appSettings.set('controlStyle', 'simple');
  assert.equal(JSON.parse(saved).controlStyle, 'simple');
  const reloaded = await import('./appSettings.js?controls-reload');
  assert.equal(reloaded.appSettings.get('controlStyle'), 'simple');
});

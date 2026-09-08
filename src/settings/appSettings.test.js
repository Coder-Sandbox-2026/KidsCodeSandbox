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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedStage } from './stageSelection.js';

test('fresh page defaults to Create First Person Level 1 and comments-only starter, retaining persistence', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../editor/EditorManager.js', import.meta.url), 'utf8');
  assert.match(main, /mode: 'create'/);
  assert.match(main, /gameType: 'first-person'/);
  assert.match(main, /level: 1/);
  assert.match(main, /engine.loadLevel\(selectedStage\(AppState\).levelId\)/);
  assert.equal(selectedStage({ mode: 'create', level: 1 }).levelId, 'challenge-1');
  const source = editor.match(/const DEFAULT_CODE = `([\s\S]*?)`;/)[1];
  assert.ok(source.trim().length > 0);
  assert.ok(source.split('\n').every(line => !line.trim() || line.trim().startsWith('//')));
  assert.match(editor, /this\._loadSaved\(\) \|\| DEFAULT_CODE/);
  assert.match(main, /const validator = currentChallengeRun === run \? createChallengeValidator/);
  assert.match(main, /if \(!selectedStage\(AppState\).challenge \|\| star !== challengeStar\) return/);
});


test('mode switches retain separate Create and Challenge selections', () => {
  const state = { mode: 'create', level: 7, challengeLevel: 11 };
  assert.deepEqual(selectedStage(state), { levelId: 'challenge-7', challenge: false });
  state.mode = 'challenge';
  assert.deepEqual(selectedStage(state), { levelId: 'challenge-11', challenge: true });
  state.mode = 'create';
  assert.deepEqual(selectedStage(state), { levelId: 'challenge-7', challenge: false });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYWORD_DOCS, MEMBER_DOCS, findCompletion } from './apiCompletions.js';
import { buildCompletion } from './completionEngine.js';

test('control-flow completions provide high-level snippets and placeholders', () => {
  for (const keyword of ['if', 'for', 'while']) {
    const item = findCompletion(keyword, KEYWORD_DOCS);
    const built = buildCompletion(item, { level: 'high', wordStartColumn: 1, wordEndColumn: keyword.length + 1 });
    assert.equal(built.isSnippet, true);
    assert.match(built.insertText, /\$\{1:/);
    assert.match(built.insertText, /\$\{0\}/);
  }
});

test('high collision completion explains other without hardcoding the object name', () => {
  const item = findCompletion('onCollision', MEMBER_DOCS);
  const built = buildCompletion(item, { level: 'high', wordStartColumn: 6, wordEndColumn: 12 });
  assert.match(built.insertText, /other/);
  assert.doesNotMatch(built.insertText, /coin\./);
});

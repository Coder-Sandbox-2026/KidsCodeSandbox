import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYWORD_DOCS, MEMBER_DOCS, findCompletion } from './apiCompletions.js';
import { buildCompletion } from './completionEngine.js';

test('control-flow completions provide high-level snippets and placeholders', () => {
  for (const keyword of ['if', 'if else', 'function', 'for', 'while']) {
    const item = findCompletion(keyword, KEYWORD_DOCS);
    const built = buildCompletion(item, { level: 'high', wordStartColumn: 1, wordEndColumn: keyword.length + 1 });
    assert.equal(built.isSnippet, true);
    assert.match(built.insertText, /\$\{1:/);
    assert.match(built.insertText, /\$\{0\}/);
  }
});

test('function completion inserts an editable declaration template', () => {
  const item = findCompletion('function', KEYWORD_DOCS);
  const built = buildCompletion(item, { level: 'high', wordStartColumn: 1, wordEndColumn: 9 });
  assert.match(built.insertText, /^\/\/ Create a function/);
  assert.match(built.insertText, /function \$\{1:myFunction\}\(\)/);
  assert.match(built.insertText, /\$\{2:\/\/ Your code here\}/);
  assert.match(built.insertText, /\}\n\n\$\{0\}$/);
  assert.equal(built.isSnippet, true);
});

test('if else completion includes both branches', () => {
  const item = findCompletion('if else', KEYWORD_DOCS);
  const built = buildCompletion(item, { level: 'high', wordStartColumn: 1, wordEndColumn: 8 });
  assert.match(built.insertText, /if \(\$\{1:condition\}\)/);
  assert.match(built.insertText, /\} else \{/);
  assert.match(built.insertText, /\$\{0\}/);
});

test('high collision completion explains other without hardcoding the object name', () => {
  const item = findCompletion('onCollision', MEMBER_DOCS);
  const built = buildCompletion(item, { level: 'high', wordStartColumn: 6, wordEndColumn: 12 });
  assert.match(built.insertText, /other/);
  assert.doesNotMatch(built.insertText, /coin\./);
});

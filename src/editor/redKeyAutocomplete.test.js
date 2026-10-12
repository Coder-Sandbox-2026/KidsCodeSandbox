import test from 'node:test';
import assert from 'node:assert/strict';
import { memberDocsForSource } from './AutocompleteProvider.js';
import { buildCompletion } from './completionEngine.js';
import { findCompletion } from './apiCompletions.js';

function labels(source) {
  return (memberDocsForSource(source) ?? []).map(item => item.label);
}

test('Red Key member inference supports getters, aliases, and conditional source', () => {
  assert.deepEqual(labels('const key = getKeyRed();\nkey.'), ['onCollision']);
  assert.deepEqual(labels('let key = getKeyRed();\nkey.'), ['onCollision']);
  assert.deepEqual(labels('const key = keyRed();\nkey.'), ['onCollision']);
  assert.deepEqual(labels('const key = getKeyRed();\nif (key) {\n  key.'), ['onCollision']);
  assert.deepEqual(labels('const firstKey = getKeyRed();\nconst secondKey = firstKey;\nsecondKey.'), ['onCollision']);
  assert.deepEqual(labels('getKeyRed()?.'), ['onCollision']);
});

test('Red Key onCollision keeps the existing callback snippet and restricted catalog', () => {
  const docs = memberDocsForSource('const key = getKeyRed();\nkey.');
  assert.deepEqual(docs.map(item => item.label), ['onCollision']);
  const item = findCompletion('onCollision', docs);
  const completion = buildCompletion(item, {
    level: 'high', line: 'key.onColl', wordStartColumn: 5, wordEndColumn: 12,
  });
  assert.match(completion.insertText, /^onCollision\(\(\$\{1:other\}\) => \{/);
  assert.match(completion.insertText, /\$\{0\}/);
  assert.equal(completion.isSnippet, true);
});

test('Gold Coin member completion remains unchanged', () => {
  assert.equal(memberDocsForSource('const coin = createGoldCoin();\ncoin.'), null);
});

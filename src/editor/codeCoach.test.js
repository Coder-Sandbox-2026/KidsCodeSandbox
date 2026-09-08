import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCompletion } from './apiCompletions.js';
import {
  inferCompletion,
  isExpressionContext,
  lineAlreadyHasCall,
  resolveCompletionInsert,
  shouldEndWithSemicolon,
} from './codeCoach.js';

const onKeyDown = findCompletion('onKeyDown');

test('Off inserts only the name', () => {
  assert.deepEqual(
    resolveCompletionInsert(onKeyDown, 'off'),
    { insertText: 'onKeyDown', isSnippet: false }
  );
});

test('Basic inserts empty parentheses and a semicolon as a statement', () => {
  assert.deepEqual(
    resolveCompletionInsert(onKeyDown, 'basic', { line: 'onKey', wordStartColumn: 1, wordEndColumn: 6 }),
    { insertText: 'onKeyDown();', isSnippet: false }
  );
});

test('Guided and High insert a callback template', () => {
  const guided = resolveCompletionInsert(onKeyDown, 'guided');
  const high = resolveCompletionInsert(onKeyDown, 'high');
  assert.match(guided.insertText, /KeyE/);
  assert.match(guided.insertText, /\(\) =>/);
  assert.equal(guided.isSnippet, true);
  assert.equal(high.insertText, guided.insertText);
  assert.doesNotMatch(high.insertText, /You win/);
  assert.match(high.insertText, /;\s*$/);
});

test('adds a semicolon after a statement call, not inside an expression', () => {
  assert.equal(shouldEndWithSemicolon('print', 1, 6, 'print("Hello!")'), true);
  assert.equal(shouldEndWithSemicolon('const cube = createCube', 14, 24, 'createCube()'), true);
  assert.equal(shouldEndWithSemicolon('cube.setColor', 6, 14, 'setColor("red")'), true);
  assert.equal(shouldEndWithSemicolon('if (other.isPlayer', 10, 18, 'isPlayer()'), false);
  assert.equal(shouldEndWithSemicolon('print(random', 7, 13, 'random(0, 10)'), false);
  assert.equal(shouldEndWithSemicolon('print("Hi");', 1, 6, 'print("Hello!")'), false);
});

test('isExpressionContext detects unfinished parens and if-conditions', () => {
  assert.equal(isExpressionContext('if'), true);
  assert.equal(isExpressionContext('print('), true);
  assert.equal(isExpressionContext('foo(cube.'), true);
  assert.equal(isExpressionContext('cube.'), false);
  assert.equal(isExpressionContext('const x ='), false);
});

test('does not duplicate an already-typed call', () => {
  const line = 'onKeyDown("KeyE",';
  assert.equal(lineAlreadyHasCall(line, 10), true);
  assert.deepEqual(
    resolveCompletionInsert(onKeyDown, 'high', { alreadyHasCall: true }),
    { insertText: 'onKeyDown', isSnippet: false }
  );
});

test('unknown level falls back to High', () => {
  const result = resolveCompletionInsert(onKeyDown, 'mystery');
  assert.match(result.insertText, /KeyE/);
});

test('items without metadata still get Off / Basic / High', () => {
  const item = { label: 'print', kind: 'Function', insertText: 'print("Hello!")' };
  const c = inferCompletion(item);
  assert.equal(c.off, 'print');
  assert.equal(c.basic, 'print()');
  assert.equal(c.high, 'print("Hello!")');
});

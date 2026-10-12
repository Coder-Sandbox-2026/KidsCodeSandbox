import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoopGuard, instrumentLoops, LoopLimitError } from './loopGuard.js';

function run(source, limit = 100) {
  const code = instrumentLoops(source);
  return new Function('__kidsCodeLoopTick', `"use strict";\n${code}`)(createLoopGuard(limit));
}

test('finite for, while, and do-while loops remain valid', () => {
  run('const pattern = /while (true)/;');
  run('for (let i = 0; i < 5; i++) {}');
  run('let i = 0; while (i < 5) i++;');
  run('let i = 0; do { i++; } while (i < 5);');
});

test('loop budget stops infinite and nested loops', () => {
  assert.throws(() => run('while (true) {}'), LoopLimitError);
  assert.throws(() => run('for (;;) { for (;;) {} }'), LoopLimitError);
});

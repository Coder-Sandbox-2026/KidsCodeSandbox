import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color } from 'three';
import { resolveColor } from './resolveColor.js';

test('random colors work with Three.js and ordinary values pass through', () => {
  for (const keyword of ['random', 'RANDOM', 'Random']) {
    const color = resolveColor(keyword);
    assert.match(color, /^#[0-9a-f]{6}$/);
    assert.equal('#' + new Color(color).getHexString(), color);
  }
  for (const value of ['red', '#abcdef', 'rgb(1, 2, 3)', 0xff0000, null]) {
    assert.equal(resolveColor(value), value);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { EnvironmentResources } from './EnvironmentResources.js';

function triangleArea(positions, offset) {
  const ax = positions[offset], ay = positions[offset + 1], az = positions[offset + 2];
  const bx = positions[offset + 3], by = positions[offset + 4], bz = positions[offset + 5];
  const cx = positions[offset + 6], cy = positions[offset + 7], cz = positions[offset + 8];
  const ab = [bx - ax, by - ay, bz - az];
  const ac = [cx - ax, cy - ay, cz - az];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  return cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2;
}

test('snow cap geometry has independent, non-overlapping top triangles', () => {
  const resources = new EnvironmentResources();
  const floor = resources.snowChecker(0, 0, 140, 140);
  const cap = resources.snowCheckerBox(18, -8, 8, 3.2, 0.16, 1.6);
  const positions = cap.attributes.position.array;

  assert.equal(cap.index, null);
  assert.equal(positions.length % 9, 0);
  assert.equal(cap.attributes.color.count, cap.attributes.position.count);
  assert.notEqual(cap, floor);
  assert.notEqual(cap.attributes.position, floor.attributes.position);

  const seen = new Set();
  let topTriangles = 0;
  for (let i = 0; i < positions.length; i += 9) {
    assert.ok(triangleArea(positions, i) > 1e-12, `degenerate triangle at ${i / 9}`);
    const points = [];
    for (let j = 0; j < 9; j += 3) {
      points.push(positions.slice(i + j, i + j + 3).map(value => value.toFixed(6)).join(','));
    }
    const key = points.sort().join('|');
    assert.equal(seen.has(key), false, `duplicate triangle at ${i / 9}`);
    seen.add(key);
    if (Math.abs(positions[i + 1] - 0.08) < 1e-6
      && Math.abs(positions[i + 4] - 0.08) < 1e-6
      && Math.abs(positions[i + 7] - 0.08) < 1e-6) {
      topTriangles += 1;
      const normalY = (positions[i + 3] - positions[i]) * (positions[i + 8] - positions[i + 2])
        - (positions[i + 5] - positions[i + 2]) * (positions[i + 6] - positions[i]);
      assert.ok(normalY < 0, 'top triangle winding must face upward');
    }
  }

  cap.computeBoundingBox();
  assert.deepEqual(cap.boundingBox.min.toArray().map(value => Number(value.toFixed(6))), [-4, -0.08, -1.6]);
  assert.deepEqual(cap.boundingBox.max.toArray().map(value => Number(value.toFixed(6))), [4, 0.08, 1.6]);
  assert.equal(topTriangles, 48);
});

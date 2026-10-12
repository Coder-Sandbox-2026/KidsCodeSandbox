import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PoolWater } from './PoolWater.js';

function createWater(quality = 'high') {
  return new PoolWater({
    createMesh: (geometry, material) => new THREE.Mesh(geometry, material),
    centerX: 0, centerZ: 0, width: 20, depth: 12, surfaceY: 1,
    rippleCenters: [[1, 2], [3, 4], [5, 6]],
    cloudReflection: { clouds: [{ position: [0, 10, 0] }] },
    quality,
  });
}

test('PoolWater selects three effective variants and preserves state when switching', () => {
  const water = createWater('low');
  const material = water.waterMaterial;
  const uniforms = material.uniforms;
  uniforms.time.value = 4.25;
  assert.equal(water.qualityVariant, 'LOW');
  assert.equal(water.setQuality('medium'), true);
  assert.equal(water.qualityVariant, 'MEDIUM');
  assert.equal(water.setQuality('high'), true);
  assert.equal(water.qualityVariant, 'FULL');
  assert.equal(water.setQuality('ultra'), false);
  assert.equal(water.quality, 'ultra');
  assert.equal(water.waterMaterial, material);
  assert.equal(water.waterMaterial.uniforms, uniforms);
  assert.equal(uniforms.time.value, 4.25);
  assert.equal(water.waterGeometry.parameters.widthSegments, 32);
  assert.equal(water.waterGeometry.parameters.heightSegments, 24);
  water.dispose();
});

test('invalid PoolWater quality safely falls back to Full', () => {
  const water = createWater('invalid');
  assert.equal(water.quality, 'high');
  assert.equal(water.qualityVariant, 'FULL');
  water.setQuality('low');
  assert.equal(water.setQuality('invalid'), true);
  assert.equal(water.qualityVariant, 'FULL');
  water.dispose();
});

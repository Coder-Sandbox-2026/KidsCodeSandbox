import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Snowfall, VOLUME } from './Snowfall.js';

test('snowfall uses one lightweight points object and recycles particles', () => {
  const scene = new THREE.Scene();
  const position = new THREE.Vector3(3, 2, -4);
  const snowfall = new Snowfall(scene, () => position, { count: 4 });
  assert.equal(scene.children.length, 1);
  assert.ok(snowfall.points instanceof THREE.Points);
  assert.equal(snowfall.geometry.attributes.position.count, 4);
  assert.equal(snowfall.material.size, 0.12);
  assert.equal(snowfall.material.opacity, 0.82);
  assert.equal(snowfall.material.depthTest, true);
  assert.equal(snowfall.material.depthWrite, false);
  const before = snowfall.geometry.attributes.position.array.slice();
  snowfall.update(1 / 60);
  assert.notDeepEqual([...snowfall.geometry.attributes.position.array], [...before]);
  position.set(20, 8, 15);
  snowfall.update(1 / 60);
  assert.ok(Math.abs(snowfall.points.position.x - 20) < VOLUME.width);
  snowfall.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(snowfall.points, null);
});

test('roofed snowfall hides inside the Level 14 roof area', () => {
  const scene = new THREE.Scene();
  const position = new THREE.Vector3(0, 1, 0);
  const snowfall = new Snowfall(scene, () => position, { roofed: true, count: 2 });
  snowfall.update(1 / 60);
  assert.equal(snowfall.points.visible, false);
  position.set(25, 1, 0);
  snowfall.update(1 / 60);
  assert.equal(snowfall.points.visible, true);
  snowfall.dispose();
});

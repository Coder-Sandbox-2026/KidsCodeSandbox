import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShapeFactories } from './ShapeFactory.js';

test('light cube, sphere, and cylinder do not cast or receive shadows', () => {
  const scene = new THREE.Scene();
  const engine = { scene, sceneManager: { scene }, userMeshes: [] };
  const shapes = createShapeFactories(engine);

  for (const create of [shapes.createLightCube, shapes.createLightSphere, shapes.createLightCylinder]) {
    const object = create();
    assert.equal(object.mesh.castShadow, false);
    assert.equal(object.mesh.receiveShadow, false);
    object.destroy();
  }
});

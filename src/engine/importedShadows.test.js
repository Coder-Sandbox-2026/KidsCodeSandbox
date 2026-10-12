import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  cleanupImportedShadows,
  configureImportedShadows,
  resolveImportedShadowSettings,
} from './importedShadows.js';

function mesh(name, userData = {}) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  object.name = name;
  object.userData = userData;
  return object;
}

test('imported shadow properties use independent defaults and nearest inheritance', () => {
  const root = new THREE.Group();
  root.userData.castShadow = false;
  root.userData.receiveShadow = true;
  root.userData.shadowMode = 'REAL';
  const child = mesh('Child');
  const override = mesh('Override', { castShadow: true });
  root.add(child, override);

  assert.deepEqual(resolveImportedShadowSettings(child), {
    castShadow: false, receiveShadow: true, shadowMode: 'REAL',
  });
  assert.deepEqual(resolveImportedShadowSettings(override), {
    castShadow: true, receiveShadow: true, shadowMode: 'REAL',
  });
  configureImportedShadows(root);
  assert.equal(child.castShadow, false);
  assert.equal(child.receiveShadow, true);
  assert.equal(override.castShadow, true);
});

test('NONE and helpers never participate in shadows', () => {
  const root = new THREE.Group();
  const none = mesh('None', { shadowMode: 'NONE' });
  const collision = mesh('COL_Wall', { castShadow: true, receiveShadow: true, shadowMode: 'FAKE' });
  root.add(none, collision);
  configureImportedShadows(root);
  assert.equal(none.castShadow, false);
  assert.equal(none.receiveShadow, false);
  assert.equal(collision.castShadow, false);
  assert.equal(collision.receiveShadow, false);
});

test('FAKE creates one shared-style shadow per configured parent and cleans up', () => {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const root = new THREE.Group();
  root.userData.shadowMode = 'FAKE';
  const body = mesh('Body');
  const detail = mesh('Detail');
  detail.position.x = 1;
  root.add(body, detail);
  root.position.y = 1;
  scene.add(root);
  configureImportedShadows(root, { scene });
  assert.equal(scene.children.filter(object => object.name === 'ImportedFakeShadow').length, 1);
  assert.equal(body.castShadow, false);
  assert.equal(body.receiveShadow, true);
  cleanupImportedShadows(root);
  assert.equal(scene.children.filter(object => object.name === 'ImportedFakeShadow').length, 0);
});

test('separate imported instances keep independent settings', () => {
  const template = mesh('Template', { castShadow: false });
  const a = template.clone(true);
  const b = template.clone(true);
  a.userData.castShadow = false;
  b.userData.castShadow = true;
  configureImportedShadows(a);
  configureImportedShadows(b);
  assert.equal(a.castShadow, false);
  assert.equal(b.castShadow, true);
});

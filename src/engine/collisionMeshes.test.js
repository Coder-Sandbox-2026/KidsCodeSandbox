import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  COL_PREFIX,
  ITEM_PREFIX,
  isColMesh,
  isItemMesh,
  isItemNode,
  isColNode,
  isHelperCollisionMesh,
  stripAndBakeCollisionMeshes,
} from './collisionMeshes.js';

function mesh(name) {
  return { isMesh: true, geometry: {}, name };
}

test('COL_ prefix marks solid, never-rendered collision meshes', () => {
  assert.equal(COL_PREFIX, 'COL_');
  assert.equal(isColMesh(mesh('COL_Wall')), true);
  assert.equal(isColMesh(mesh('COL_Stage.001')), true);
  assert.equal(isColMesh(mesh('GoldCoin')), false);
  assert.equal(isColMesh(mesh('ITEM_Coin')), false);
  assert.equal(isColMesh({ isMesh: false, geometry: {}, name: 'COL_X' }), false);
  assert.equal(isColNode({ name: 'COL_Wall' }), true);
});

test('ITEM_ prefix marks detect-only, never-rendered item volumes', () => {
  assert.equal(ITEM_PREFIX, 'ITEM_');
  assert.equal(isItemMesh(mesh('ITEM_Coin')), true);
  assert.equal(isItemMesh(mesh('ITEM_Pickup001')), true);
  assert.equal(isItemMesh(mesh('COL_Wall')), false);
  assert.equal(isItemMesh(mesh('GoldCoin')), false);
  assert.equal(isItemNode({ name: 'ITEM_Coin', isMesh: false }), true);
});

test('helper collision meshes are COL_ or ITEM_ only', () => {
  assert.equal(isHelperCollisionMesh(mesh('COL_Floor')), true);
  assert.equal(isHelperCollisionMesh(mesh('ITEM_Gold')), true);
  assert.equal(isHelperCollisionMesh(mesh('GoldCoin')), false);
});

test('ITEM_ child of a visual parent is baked and detached, parent stays', () => {
  const scene = new THREE.Group();
  scene.name = 'Scene';

  const coin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2));
  coin.name = 'GoldCoin';
  scene.add(coin);

  const item = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.5));
  item.name = 'ITEM_Coin';
  coin.add(item);

  scene.updateMatrixWorld(true);
  const parts = stripAndBakeCollisionMeshes(scene);

  assert.equal(parts.length, 1);
  assert.equal(parts[0].role, 'item');
  assert.equal(parts[0].name, 'ITEM_Coin');
  assert.equal(parts[0].parentName, 'GoldCoin');
  assert.equal(item.parent, null);
  assert.equal(coin.parent, scene);
  assert.ok(parts[0].hx > 0.5);
});

test('ITEM_ group child with an unnamed inner mesh is still collected', () => {
  const parent = new THREE.Group();
  parent.name = 'GoldCoin';

  const itemRoot = new THREE.Group();
  itemRoot.name = 'ITEM_Hitbox';
  const inner = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  inner.name = 'Cube';
  itemRoot.add(inner);
  parent.add(itemRoot);

  parent.updateMatrixWorld(true);
  const parts = stripAndBakeCollisionMeshes(parent);

  assert.equal(parts.length, 1);
  assert.equal(parts[0].role, 'item');
  assert.equal(parts[0].parentName, 'GoldCoin');
  assert.equal(itemRoot.parent, null);
  assert.equal(isHelperCollisionMesh(inner), true);
});

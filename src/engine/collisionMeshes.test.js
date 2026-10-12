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
  isTriggerNode,
  isMovingColliderNode,
  authoredAssociationKey,
  cuboidInRootSpace,
  cuboidInWorldSpace,
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

test('TRIGGER_ and MOVCOL_ volumes are hidden helpers with shared owner keys', () => {
  assert.equal(isTriggerNode({ name: 'TRIGGER_RedDoor' }), true);
  assert.equal(isMovingColliderNode({ name: 'MOVCOL_RedDoor' }), true);
  assert.equal(authoredAssociationKey('RedDoor'), authoredAssociationKey('MOVCOL_RedDoor'));
  assert.equal(authoredAssociationKey('DoorRed'), authoredAssociationKey('TRIGGER_RedDoor'));
});

test('helper collision meshes include all invisible authored volumes', () => {
  assert.equal(isHelperCollisionMesh(mesh('COL_Floor')), true);
  assert.equal(isHelperCollisionMesh(mesh('ITEM_Gold')), true);
  assert.equal(isHelperCollisionMesh(mesh('TRIGGER_Door')), true);
  assert.equal(isHelperCollisionMesh(mesh('MOVCOL_Door')), true);
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

test('COL_ groups bake every child mesh with inherited world transforms', () => {
  const root = new THREE.Group();
  root.rotation.y = Math.PI / 4;
  const collision = new THREE.Group();
  collision.name = 'COL_Compound';
  collision.position.set(3, 2, -1);
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const second = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
  second.position.x = 4;
  collision.add(first, second);
  root.add(collision);

  const parts = stripAndBakeCollisionMeshes(root);
  assert.equal(parts.length, 2);
  assert.ok(parts.every(part => part.role === 'col' && part.vertices.length && part.indices.length));
  assert.equal(collision.parent, null);
  assert.notDeepEqual(Array.from(parts[0].vertices), Array.from(parts[1].vertices));
});

test('MOVCOL_ cuboids retain authored rotation and dimensions', () => {
  const root = new THREE.Group();
  const moving = new THREE.Group();
  moving.name = 'MOVCOL_Test';
  moving.rotation.y = Math.PI / 4;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
  moving.add(mesh);
  root.add(moving);
  root.updateMatrixWorld(true);

  const cuboid = cuboidInRootSpace(moving, root);
  assert.ok(cuboid);
  assert.deepEqual(cuboid.rotation.map(value => Number(value.toFixed(6))), [0, 0.382683, 0, 0.92388]);
  assert.deepEqual([cuboid.hx, cuboid.hy, cuboid.hz], [1, 2, 1]);
});

test('MOVCOL_ world recipes bake the final parent transform exactly once', () => {
  const root = new THREE.Group();
  root.position.set(10, 1, -4);
  root.rotation.y = Math.PI / 2;
  root.scale.setScalar(2);

  const moving = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
  moving.name = 'MOVCOL_WorldTest';
  moving.position.set(1, 2, 3);
  moving.rotation.y = Math.PI / 4;
  root.add(moving);
  root.updateMatrixWorld(true);

  const recipe = cuboidInWorldSpace(moving);
  const center = moving.getWorldPosition(new THREE.Vector3());
  const rotation = moving.getWorldQuaternion(new THREE.Quaternion());

  assert.deepEqual([recipe.hx, recipe.hy, recipe.hz], [2, 4, 2]);
  assert.deepEqual([recipe.tx, recipe.ty, recipe.tz].map(value => Number(value.toFixed(6))), center.toArray().map(value => Number(value.toFixed(6))));
  assert.deepEqual(recipe.rotation.map(value => Number(value.toFixed(6))), rotation.toArray().map(value => Number(value.toFixed(6))));
});

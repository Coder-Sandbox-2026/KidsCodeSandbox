/**
 * collisionMeshes.js – Invisible helper objects inside a GLB.
 *
 * Artists parent extra volumes under the object they belong to:
 *
 *   Visual parent (GoldCoin)
 *     └── ITEM_*   child volume. Never drawn. Detects touches,
 *                  does NOT stop the player.
 *
 *   Visual parent or stage
 *     └── COL_*    child volume. Never drawn. Stops the player.
 *
 * ITEM_ is always a child of the object it is attached to.
 * We bake its box in that parent's space (then into the model root)
 * so it stays glued when the parent moves.
 *
 * COL_* matches RoomTest: collision-only, never rendered.
 */
import * as THREE from 'three';

export const COL_PREFIX = 'COL_';
export const ITEM_PREFIX = 'ITEM_';

function nodeName(obj) {
  return String(obj?.name ?? '').trim();
}

export function isColNode(obj) {
  return !!obj && nodeName(obj).startsWith(COL_PREFIX);
}

export function isItemNode(obj) {
  return !!obj && nodeName(obj).startsWith(ITEM_PREFIX);
}

export function isColMesh(obj) {
  return !!(obj?.isMesh && obj.geometry && isColNode(obj));
}

export function isItemMesh(obj) {
  return !!(obj?.isMesh && obj.geometry && isItemNode(obj));
}

/** True if this object is a COL_/ITEM_ helper, or lives under one. */
export function isHelperCollisionMesh(obj) {
  let node = obj;
  while (node) {
    if (isColNode(node) || isItemNode(node)) return true;
    node = node.parent;
  }
  return false;
}

function isSameKindHelper(obj, testFn) {
  return testFn(obj);
}

/**
 * Helper nodes (ITEM_* / COL_*) that are children of some parent in the model.
 * Nested helpers under another helper of the same kind are skipped.
 */
export function collectChildHelperNodes(root, testFn) {
  const list = [];
  if (!root) return list;

  root.traverse((obj) => {
    if (obj === root) return;
    if (!isSameKindHelper(obj, testFn)) return;

    let ancestor = obj.parent;
    while (ancestor && ancestor !== root) {
      if (isSameKindHelper(ancestor, testFn)) return;
      ancestor = ancestor.parent;
    }
    list.push(obj);
  });
  return list;
}

/** Matrix that takes a child's vertices into the root object's local space. */
function matrixInRootSpace(mesh, root) {
  root.updateMatrixWorld(true);
  mesh.updateWorldMatrix(true, false);
  return new THREE.Matrix4()
    .copy(root.matrixWorld)
    .invert()
    .multiply(mesh.matrixWorld);
}

/**
 * Axis-aligned box of a mesh, measured in the root's local space.
 */
export function boxInRootSpace(mesh, root) {
  if (!mesh?.geometry) return null;

  const geometry = mesh.geometry.index
    ? mesh.geometry.clone()
    : mesh.geometry.clone().toNonIndexed();

  geometry.applyMatrix4(matrixInRootSpace(mesh, root));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  geometry.dispose();

  if (!box || box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    hx: Math.max(size.x / 2, 0.05),
    hy: Math.max(size.y / 2, 0.05),
    hz: Math.max(size.z / 2, 0.05),
    tx: center.x,
    ty: center.y,
    tz: center.z,
  };
}

/** Union AABB of a helper node (mesh or group) in root-local space. */
export function boxOfObjectInRootSpace(obj, root) {
  const boxes = [];
  const take = (mesh) => {
    const box = boxInRootSpace(mesh, root);
    if (box) boxes.push(box);
  };

  if (obj.isMesh) take(obj);
  obj.traverse((child) => {
    if (child !== obj && child.isMesh) take(child);
  });

  if (!boxes.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.tx - b.hx);
    minY = Math.min(minY, b.ty - b.hy);
    minZ = Math.min(minZ, b.tz - b.hz);
    maxX = Math.max(maxX, b.tx + b.hx);
    maxY = Math.max(maxY, b.ty + b.hy);
    maxZ = Math.max(maxZ, b.tz + b.hz);
  }

  return {
    hx: Math.max((maxX - minX) / 2, 0.05),
    hy: Math.max((maxY - minY) / 2, 0.05),
    hz: Math.max((maxZ - minZ) / 2, 0.05),
    tx: (minX + maxX) / 2,
    ty: (minY + maxY) / 2,
    tz: (minZ + maxZ) / 2,
  };
}

/**
 * Trimesh vertices/indices in the root's local space.
 * Used for COL_* so the wall matches the authored shape.
 */
export function trimeshInRootSpace(mesh, root) {
  if (!mesh?.geometry) return null;

  const geometry = mesh.geometry.index
    ? mesh.geometry.clone()
    : mesh.geometry.clone().toNonIndexed();

  geometry.applyMatrix4(matrixInRootSpace(mesh, root));

  const position = geometry.getAttribute('position');
  if (!position) {
    geometry.dispose();
    return null;
  }

  const vertices = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    vertices[i * 3] = position.getX(i);
    vertices[i * 3 + 1] = position.getY(i);
    vertices[i * 3 + 2] = position.getZ(i);
  }

  let indices;
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.array);
  } else {
    indices = new Uint32Array(position.count);
    for (let i = 0; i < position.count; i++) indices[i] = i;
  }

  geometry.dispose();
  return { vertices, indices, name: nodeName(mesh) };
}

function collectMeshesUnder(node) {
  const meshes = [];
  if (node.isMesh && node.geometry) meshes.push(node);
  node.traverse((child) => {
    if (child !== node && child.isMesh && child.geometry) meshes.push(child);
  });
  return meshes;
}

function detachNode(node) {
  node.visible = false;
  node.layers.disableAll();
  node.traverse((child) => {
    child.visible = false;
    child.layers.disableAll();
  });
  if (node.parent) node.parent.remove(node);
}

/**
 * Find COL_* and ITEM_* children, bake collider recipes in the model root
 * (which includes each helper's parent transform), then detach those
 * children so they are never rendered.
 *
 * Call this on the loaded template (scale 1) before cloning.
 */
export function stripAndBakeCollisionMeshes(root) {
  const parts = [];
  if (!root) return parts;

  root.updateMatrixWorld(true);

  const colNodes = collectChildHelperNodes(root, isColNode);
  const itemNodes = collectChildHelperNodes(root, isItemNode);

  for (const node of colNodes) {
    const owner = node.parent;
    const box = boxOfObjectInRootSpace(node, root);
    const meshes = collectMeshesUnder(node);
    const tri = meshes.length === 1 ? trimeshInRootSpace(meshes[0], root) : null;
    if (!box && !tri) continue;
    parts.push({
      role: 'col',
      name: nodeName(node),
      parentName: nodeName(owner),
      ...(box || { hx: 0.05, hy: 0.05, hz: 0.05, tx: 0, ty: 0, tz: 0 }),
      vertices: tri?.vertices,
      indices: tri?.indices,
    });
    detachNode(node);
  }

  for (const node of itemNodes) {
    const owner = node.parent;
    const box = boxOfObjectInRootSpace(node, root);
    if (!box) continue;
    parts.push({
      role: 'item',
      name: nodeName(node),
      parentName: nodeName(owner),
      ...box,
    });
    detachNode(node);
  }

  return parts;
}

/**
 * Bounding box of the remaining (visible) meshes, in root-local space.
 * Used when a model has no ITEM_* child, so collectibles still work.
 */
export function visualBoundsInRootSpace(root) {
  if (!root) return null;
  root.updateMatrixWorld(true);

  const box = new THREE.Box3();
  let found = false;

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry || isHelperCollisionMesh(child)) return;
    const part = boxInRootSpace(child, root);
    if (!part) return;
    const local = new THREE.Box3(
      new THREE.Vector3(part.tx - part.hx, part.ty - part.hy, part.tz - part.hz),
      new THREE.Vector3(part.tx + part.hx, part.ty + part.hy, part.tz + part.hz)
    );
    if (!found) box.copy(local);
    else box.union(local);
    found = true;
  });

  if (!found || box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    role: 'bounds',
    name: root.name || 'bounds',
    hx: Math.max(size.x / 2, 0.05),
    hy: Math.max(size.y / 2, 0.05),
    hz: Math.max(size.z / 2, 0.05),
    tx: center.x,
    ty: center.y,
    tz: center.z,
  };
}

import * as THREE from 'three';
import { isHelperCollisionMesh } from './collisionMeshes.js';

export const IMPORTED_SHADOW_DEFAULTS = Object.freeze({
  castShadow: true,
  receiveShadow: true,
  shadowMode: 'REAL',
});

const MODES = new Set(['REAL', 'FAKE', 'NONE']);
const resourcesByScene = new WeakMap();
const cleanupsByRoot = new WeakMap();

function authoredName(object) {
  return String(object?.userData?.name ?? object?.name ?? '').trim();
}

function explicitValue(object, key) {
  const data = object?.userData;
  return data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
}

function explicitFakeOwner(object, root) {
  let node = object;
  while (node) {
    if (explicitValue(node, 'shadowMode') === 'FAKE') return node;
    if (node === root) break;
    node = node.parent;
  }
  return object;
}

function warnInvalid(key, value) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[imported-shadows] Invalid ${key} value; using its default.`, value);
  }
}

function validate(key, value) {
  if (key === 'castShadow' || key === 'receiveShadow') {
    if (typeof value === 'boolean') return value;
  } else if (typeof value === 'string' && MODES.has(value)) {
    return value;
  }
  warnInvalid(key, value);
  return IMPORTED_SHADOW_DEFAULTS[key];
}

/** Resolve every setting independently from the nearest imported ancestor. */
export function resolveImportedShadowSettings(object) {
  const result = { ...IMPORTED_SHADOW_DEFAULTS };
  for (const key of Object.keys(result)) {
    let node = object;
    while (node) {
      const value = explicitValue(node, key);
      if (value !== undefined) {
        result[key] = validate(key, value);
        break;
      }
      node = node.parent;
    }
  }
  return result;
}

function isExcluded(object) {
  let node = object;
  while (node) {
    const name = authoredName(node);
    if (isHelperCollisionMesh(node) || /^PH_Key(?:Red|Green|Yellow|Blue)$/.test(name)) return true;
    node = node.parent;
  }
  return false;
}

function resourcesFor(scene) {
  let resources = resourcesByScene.get(scene);
  if (resources) return resources;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = ((x + 0.5) / size) * 2 - 1;
    const dy = ((y + 0.5) / size) * 2 - 1;
    const alpha = Math.max(0, 1 - Math.hypot(dx, dy)) ** 2 * 255;
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
    data[i + 3] = alpha;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  resources = {
    geometry: new THREE.PlaneGeometry(1, 1),
    material: new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false,
    }),
  };
  resourcesByScene.set(scene, resources);
  return resources;
}

function visibleBounds(object) {
  const box = new THREE.Box3();
  let found = false;
  object.traverse(child => {
    if (!child.isMesh || !child.visible || isExcluded(child)) return;
    child.geometry?.computeBoundingBox();
    if (!child.geometry?.boundingBox) return;
    box.union(new THREE.Box3().copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld));
    found = true;
  });
  return found && !box.isEmpty() ? box : null;
}

function makeFakeShadow(owner, scene) {
  const bounds = visibleBounds(owner);
  if (!bounds) return null;
  const resources = resourcesFor(scene);
  const shadow = new THREE.Mesh(resources.geometry, resources.material);
  shadow.name = 'ImportedFakeShadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  const diameter = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 0.35);
  shadow.scale.set(diameter, diameter, diameter);
  scene.add(shadow);

  const ray = new THREE.Raycaster(
    new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y + 0.5, (bounds.min.z + bounds.max.z) / 2),
    new THREE.Vector3(0, -1, 0), 0, 1000,
  );
  const hits = ray.intersectObjects(scene.children, true).find(hit => {
    let node = hit.object;
    while (node) {
      if (node === owner || node === shadow) return false;
      node = node.parent;
    }
    return hit.object.visible && hit.object.isMesh;
  });
  if (!hits) shadow.visible = false;
  else shadow.position.set(ray.ray.origin.x, hits.point.y + 0.006, ray.ray.origin.z);
  return shadow;
}

/** Apply Blender-authored settings to one imported instance. */
export function configureImportedShadows(root, { scene = root?.parent } = {}) {
  if (!root) return () => {};
  root.updateMatrixWorld(true);
  const fakeOwners = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    if (isExcluded(object)) {
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    const settings = resolveImportedShadowSettings(object);
    object.castShadow = settings.shadowMode === 'REAL' ? settings.castShadow : false;
    object.receiveShadow = settings.shadowMode === 'REAL'
      ? settings.receiveShadow
      : settings.shadowMode === 'NONE' ? false : settings.receiveShadow;
    if (settings.shadowMode === 'FAKE') {
      fakeOwners.add(explicitFakeOwner(object, root));
    }
  });

  const shadows = [];
  if (scene) for (const owner of fakeOwners) {
    const shadow = makeFakeShadow(owner, scene);
    if (shadow) shadows.push(shadow);
  }
  const cleanup = () => {
    for (const shadow of shadows) shadow.removeFromParent();
    shadows.length = 0;
  };
  cleanupsByRoot.set(root, cleanup);
  root.userData.importedShadowCleanup = cleanup;
  return cleanup;
}

export function cleanupImportedShadows(root) {
  cleanupsByRoot.get(root)?.();
  if (root?.userData) delete root.userData.importedShadowCleanup;
}

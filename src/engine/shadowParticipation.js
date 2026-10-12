import * as THREE from 'three';

const MAX_GROUND_THICKNESS_RATIO = 0.1;
const MIN_GROUND_SPAN = 4;

/**
 * Broad, thin horizontal surfaces are shadow receivers, not useful shadow
 * casters. Preventing them from shadowing themselves avoids shadow-map acne
 * while leaving raised platforms and vertical structures as casters.
 */
export function isBroadHorizontalSurface(mesh) {
  if (!mesh?.isMesh || !mesh.geometry) return false;

  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box || box.isEmpty()) return false;

  mesh.updateWorldMatrix(true, false);
  const scale = mesh.getWorldScale(new THREE.Vector3());
  const worldUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  if (worldUp.y < 0.99999) return false;

  const size = box.getSize(new THREE.Vector3());
  const width = Math.abs(size.x * scale.x);
  const depth = Math.abs(size.z * scale.z);
  const height = Math.abs(size.y * scale.y);
  const span = Math.min(width, depth);
  return span >= MIN_GROUND_SPAN && height <= span * MAX_GROUND_THICKNESS_RATIO;
}

/** Apply the shared default shadow participation policy to a mesh hierarchy. */
export function configureShadowParticipation(root) {
  root?.traverse(object => {
    if (!object.isMesh) return;
    object.receiveShadow = true;
    object.castShadow = !isBroadHorizontalSurface(object);
  });
}

import * as THREE from 'three';

// Base/minimum intensity for DroneA's emissive materials.
export const DRONE_EMISSIVE_INTENSITY = 1.8;
export const DRONE_EMISSIVE_PULSE_PERIOD = 1;
export const DRONE_EMISSIVE_PULSE_MIN = 0.55;
export const DRONE_EMISSIVE_PULSE_MAX = 2.0;
// Additional multiplier for the emissive material on DroneA's camera mesh.
export const DRONE_CAMERA_EMISSIVE_MULTIPLIER = 4;

function isDroneCamera(object) {
  let current = object;
  while (current) {
    const name = String(current.userData?.name ?? current.name ?? '').trim();
    if (name.toLowerCase() === 'drone-camera') return true;
    current = current.parent;
  }
  return false;
}

/** A stationary DroneA visual that preserves the model-authored material values. */
export class DroneA {
  constructor(root) {
    this.root = root;
    this.glowMaterial = null;
    this.materials = new Set();
    this.emissiveMaterials = new Set();
    this.cameraMaterials = new Set();

    root.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = originalMaterials.map(material => {
        // GLTF can share Glow between the camera and body. Give the camera its
        // own material so its multiplier does not brighten every drone mesh.
        if (isDroneCamera(object) && material?.emissive) return material.clone();
        return material;
      });
      if (materials.some((material, index) => material !== originalMaterials[index])) {
        object.material = Array.isArray(object.material) ? materials : materials[0];
      }
      for (const material of materials) {
        if (!material) continue;
        this.materials.add(material);
        if (material.emissive) {
          this.emissiveMaterials.add(material);
          if (isDroneCamera(object)) this.cameraMaterials.add(material);
        }
        if (!this.glowMaterial && material.name === 'Glow') this.glowMaterial = material;
      }
    });

    this.elapsed = 0;
    this._applyEmissiveIntensity(DRONE_EMISSIVE_INTENSITY);
  }

  _applyEmissiveIntensity(intensity) {
    for (const material of this.emissiveMaterials) {
      material.emissiveIntensity = this.cameraMaterials.has(material)
        ? intensity * DRONE_CAMERA_EMISSIVE_MULTIPLIER
        : intensity;
    }
  }

  update(dt = 0) {
    this.elapsed += Math.max(0, dt || 0);
    const pulse = (1 + Math.cos((this.elapsed / DRONE_EMISSIVE_PULSE_PERIOD) * Math.PI * 2)) / 2;
    const pulseMultiplier = THREE.MathUtils.lerp(
      DRONE_EMISSIVE_PULSE_MIN,
      DRONE_EMISSIVE_PULSE_MAX,
      pulse,
    );
    this._applyEmissiveIntensity(DRONE_EMISSIVE_INTENSITY * pulseMultiplier);
  }

  clear() {
    for (const material of this.materials) material.dispose();
    this.glowMaterial = null;
    this.materials.clear();
    this.emissiveMaterials.clear();
    this.cameraMaterials.clear();
    this.elapsed = 0;
    this.root = null;
  }
}

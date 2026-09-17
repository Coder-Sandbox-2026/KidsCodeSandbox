import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createToyBoxGeometry(w, h, d) {
  // Keep the exact outer dimensions and use just one bevel segment.
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(0.07, Math.min(w, h, d) * 0.15));
}

export function createToySphereGeometry(radius) {
  return new THREE.SphereGeometry(radius, 24, 16);
}

export function createPrimitiveMaterial(color = 0xffffff, roughness = 0.45, settings = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...settings });
}

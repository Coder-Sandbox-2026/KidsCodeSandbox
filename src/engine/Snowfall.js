import * as THREE from 'three';
import { appSettings } from '../settings/appSettings.js';

const PARTICLE_COUNTS = { low: 100, medium: 200, high: 300, ultra: 400 };
const VOLUME = { width: 36, depth: 36, height: 16 };

function createSnowTexture() {
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(32, 32) : null;
  if (!canvas) return null;
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.42)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

/** Lightweight player-centered decorative snowfall for snowy outdoor levels. */
export class Snowfall {
  constructor(scene, getPlayerPosition, { roofed = false, count } = {}) {
    this.scene = scene;
    this.getPlayerPosition = getPlayerPosition;
    this.roofed = roofed;
    this.count = count ?? PARTICLE_COUNTS[appSettings.get('graphicsProfile')] ?? PARTICLE_COUNTS.medium;
    this._center = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._initialized = false;

    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);
    this._speed = new Float32Array(this.count);
    this._driftX = new Float32Array(this.count);
    this._driftZ = new Float32Array(this.count);
    const next = random(0x534e4f57 + this.count);
    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (next() - 0.5) * VOLUME.width;
      positions[i * 3 + 1] = (next() - 0.5) * VOLUME.height;
      positions[i * 3 + 2] = (next() - 0.5) * VOLUME.depth;
      const brightness = 0.78 + next() * 0.22;
      colors[i * 3] = brightness * 0.94;
      colors[i * 3 + 1] = brightness * 0.97;
      colors[i * 3 + 2] = brightness;
      this._speed[i] = 0.8 + next() * 0.55;
      this._driftX[i] = (next() - 0.5) * 0.16;
      this._driftZ[i] = (next() - 0.5) * 0.16;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.texture = createSnowTexture();
    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      map: this.texture,
      size: 0.12,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'snowfall';
    this.points.frustumCulled = false;
    this.points.castShadow = false;
    this.points.receiveShadow = false;
    this.scene.add(this.points);
  }

  _isUnderRoof(position) {
    return this.roofed && Math.abs(position.x) < 19 && Math.abs(position.z) < 19 && position.y < 4.7;
  }

  update(dt) {
    if (!this.points || !this.getPlayerPosition) return;
    const position = this.getPlayerPosition();
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return;
    this.points.visible = !this._isUnderRoof(position);
    this._target.set(position.x, position.y + 6, position.z);
    if (!this._initialized) {
      this._center.copy(this._target);
      this._initialized = true;
    } else {
      this._center.lerp(this._target, Math.min(1, Math.max(dt, 0) * 8));
    }
    this.points.position.copy(this._center);
    if (!this.points.visible) return;

    const positions = this.geometry.attributes.position.array;
    const halfWidth = VOLUME.width / 2;
    const halfDepth = VOLUME.depth / 2;
    const halfHeight = VOLUME.height / 2;
    const delta = Math.min(Math.max(dt, 0), 0.05);
    for (let i = 0; i < this.count; i++) {
      const index = i * 3;
      positions[index] += this._driftX[i] * delta;
      positions[index + 1] -= this._speed[i] * delta;
      positions[index + 2] += this._driftZ[i] * delta;
      if (positions[index + 1] < -halfHeight) positions[index + 1] = halfHeight;
      if (positions[index] < -halfWidth) positions[index] += VOLUME.width;
      else if (positions[index] > halfWidth) positions[index] -= VOLUME.width;
      if (positions[index + 2] < -halfDepth) positions[index + 2] += VOLUME.depth;
      else if (positions[index + 2] > halfDepth) positions[index + 2] -= VOLUME.depth;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    if (!this.points) return;
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.texture?.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
  }
}

export { PARTICLE_COUNTS, VOLUME };

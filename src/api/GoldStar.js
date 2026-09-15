import * as THREE from 'three';
import { GameObject } from './GameObject.js';

export class GoldStar extends GameObject {
  constructor(...args) {
    super(...args);
    this._spinRate = 0.01;
    attachGoldStar(this.engine, this);
  }

  getSpinRate() { return this._spinRate; }

  setSpinRate(rate) {
    if (!Number.isFinite(rate)) throw new TypeError('setSpinRate() expects a finite number');
    this._spinRate = rate;
    return this;
  }

  _triggerCollision(other) {
    if (this._destroyed || this._collected) return;
    if (!other?.isPlayer()) return super._triggerCollision(other);
    this._collected = true;
    try {
      this.engine.onGoldStarCollected?.(this);
      super._triggerCollision(other);
    } finally {
      this.destroy();
    }
  }
}


// Per-engine animation records, cleaned up when an item is destroyed or the run resets.
const effects = new WeakMap();
const INTERVAL = 0.12;
const LIFETIME = 0.8;

function glitterTexture() {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.abs((x + 0.5) / size * 2 - 1);
    const dy = Math.abs((y + 0.5) / size * 2 - 1);
    const alpha = Math.max(0, 1 - Math.hypot(dx, dy)) ** 3
      + Math.max(0, 1 - Math.min(dx, dy) * 12) * Math.max(0, 1 - Math.max(dx, dy)) * 0.5;
    data.set([255, 255, 255, Math.min(255, alpha * 255)], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

function attachGoldStar(engine, obj) {
  let records = effects.get(engine);
  if (!records) effects.set(engine, records = new Set());
  const materials = [];
  obj.mesh.traverse(child => {
    if (!child.isMesh || (child.userData.name ?? child.name) !== 'Gold Star') return;
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material?.emissive) continue;
      const originalEmissive = material.emissive.clone();
      const originalIntensity = material.emissiveIntensity;
      const hasAuthoredEmission = originalEmissive.getHex() !== 0;
      // Only derive a glow color when the model has no authored emission.
      if (!hasAuthoredEmission) material.emissive.copy(material.color);
      const midpoint = hasAuthoredEmission ? originalIntensity : 0.195;
      const amplitude = hasAuthoredEmission ? originalIntensity * 0.02 : 0.075;
      material.emissiveIntensity = midpoint;
      materials.push({ material, originalEmissive, originalIntensity, midpoint, amplitude });
    }
  });
  const texture = glitterTexture();
  const particles = [];
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  let elapsed = 0, spawnTime = 0;
  const record = {
    update(dt) {
      obj.rotation.y += obj.getSpinRate();
      elapsed += dt;
      for (const { material, midpoint, amplitude } of materials) {
        material.emissiveIntensity = midpoint + amplitude * Math.sin(elapsed * 2.5);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.age += dt;
        if (particle.age >= LIFETIME) {
          particle.sprite.removeFromParent();
          particle.sprite.material.dispose();
          particles.splice(i, 1);
        } else {
          particle.sprite.material.opacity = Math.sin(Math.PI * particle.age / LIFETIME) ** 2;
        }
      }
      spawnTime += dt;
      if (spawnTime < INTERVAL || !obj.mesh.visible) return;
      spawnTime %= INTERVAL; // At most one new particle per frame, even after a pause.
      bounds.setFromObject(obj.mesh);
      if (bounds.isEmpty()) return;
      bounds.getCenter(center);
      bounds.getSize(size);
      const radius = size.length() * 0.55;
      const material = new THREE.SpriteMaterial({
        map: texture, color: new THREE.Color(1, .7, 0.2), transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.randomDirection().multiplyScalar(radius * Math.cbrt(Math.random())).add(center);
      sprite.scale.setScalar(Math.max(0.001, radius * 0.065));
      // Scene children retain their spawn position when the star moves/scales.
      engine.scene.add(sprite);
      particles.push({ sprite, age: 0 });
    },
    dispose() {
      for (const { material, originalEmissive, originalIntensity } of materials) {
        material.emissive.copy(originalEmissive);
        material.emissiveIntensity = originalIntensity;
      }
      for (const { sprite } of particles) {
        sprite.removeFromParent();
        sprite.material.dispose();
      }
      particles.length = 0;
      texture.dispose();
      records.delete(record);
    },
  };
  records.add(record);
  const destroy = obj.destroy;
  obj.destroy = function (...args) {
    if (records.has(record)) record.dispose();
    return destroy.apply(this, args);
  };
}

export function updateGoldStars(engine, dt) {
  for (const record of effects.get(engine) ?? []) record.update(dt);
}

export function clearGoldStars(engine) {
  for (const record of effects.get(engine) ?? []) record.dispose();
}

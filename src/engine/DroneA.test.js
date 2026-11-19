import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DRONE_CAMERA_EMISSIVE_MULTIPLIER,
  DRONE_EMISSIVE_INTENSITY,
  DroneA,
} from './DroneA.js';

function makeDroneRoot() {
  const root = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({
    name: 'Glow',
    emissive: 0xffffff,
    emissiveIntensity: 5,
  });
  root.add(new THREE.Mesh(new THREE.BufferGeometry(), glow));
  root.add(new THREE.Mesh(new THREE.BufferGeometry(), glow));
  return { root, glow };
}

test('DroneA preserves the model-authored emissive strength', () => {
  const { root, glow } = makeDroneRoot();
  const drone = new DroneA(root);

  assert.equal(drone.glowMaterial, glow);
  drone.update(0, 1);
  drone.update(0, 2);
  assert.equal(glow.emissiveIntensity, DRONE_EMISSIVE_INTENSITY);
});

test('DroneA applies the configured intensity to every emissive material', () => {
  const root = new THREE.Group();
  const first = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 1 });
  const second = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 20 });
  root.add(new THREE.Mesh(new THREE.BufferGeometry(), first));
  root.add(new THREE.Mesh(new THREE.BufferGeometry(), second));

  new DroneA(root);

  assert.equal(first.emissiveIntensity, DRONE_EMISSIVE_INTENSITY);
  assert.equal(second.emissiveIntensity, DRONE_EMISSIVE_INTENSITY);
});

test('DroneA boosts the camera emissive material by the configured multiplier', () => {
  const root = new THREE.Group();
  const sharedMaterial = new THREE.MeshStandardMaterial({ emissive: 0xffffff });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
  const camera = new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
  const cameraNode = new THREE.Group();
  cameraNode.name = 'drone-camera';
  cameraNode.add(camera);
  root.add(body, cameraNode);

  new DroneA(root);

  assert.notEqual(camera.material, body.material);
  assert.equal(body.material.emissiveIntensity, DRONE_EMISSIVE_INTENSITY);
  assert.equal(
    camera.material.emissiveIntensity,
    DRONE_EMISSIVE_INTENSITY * DRONE_CAMERA_EMISSIVE_MULTIPLIER,
  );
});

test('DroneA does not replace duplicate model materials', () => {
  const root = new THREE.Group();
  const bodyGlow = new THREE.MeshStandardMaterial({ name: 'Glow', emissive: 0xffffff });
  const cameraGlow = new THREE.MeshStandardMaterial({ name: 'Glow', emissive: 0xffffff });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), bodyGlow);
  body.name = 'DroneBody';
  const camera = new THREE.Mesh(new THREE.BufferGeometry(), cameraGlow);
  camera.name = 'Lens';
  root.add(body, camera);

  const drone = new DroneA(root);

  assert.notEqual(body.material, camera.material);
  assert.equal(drone.glowMaterial.uuid, body.material.uuid);
});

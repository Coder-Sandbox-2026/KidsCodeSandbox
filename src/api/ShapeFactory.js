/**
 * ShapeFactory.js – Creates Three.js meshes + optional physics and wraps them
 * in GameObject instances. Each create* function is exposed globally to kids.
 */
import * as THREE from 'three';
import { GameObject } from './GameObject.js';

/**
 * Shared helper to apply common options to a mesh, optionally enable physics,
 * and return a GameObject.
 */
function buildObject(mesh, engine, opts = {}) {
  // Position
  if (opts.position) {
    const p = opts.position;
    mesh.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  }
  // Scale
  if (opts.scale) {
    const s = opts.scale;
    if (Array.isArray(s)) mesh.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
    else mesh.scale.set(s, s, s);
  }
  // Color
  if (opts.color) mesh.material.color.set(opts.color);
  // Name
  if (opts.name) mesh.name = opts.name;

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add to scene
  engine.scene.add(mesh);

  // Physics
  let physicsInfo = null;
  if (opts.physics) {
    const RAPIER = engine.RAPIER;
    let colDesc;

    if (mesh.geometry.type === 'SphereGeometry') {
      const r = mesh.geometry.parameters.radius * mesh.scale.x;
      colDesc = RAPIER.ColliderDesc.ball(r);
    } else if (mesh.geometry.type === 'CylinderGeometry') {
      const r = mesh.geometry.parameters.radiusTop * mesh.scale.x;
      const h = mesh.geometry.parameters.height * mesh.scale.y / 2;
      colDesc = RAPIER.ColliderDesc.cylinder(h, r);
    } else if (mesh.geometry.type === 'ConeGeometry') {
      const r = mesh.geometry.parameters.radius * mesh.scale.x;
      const h = mesh.geometry.parameters.height * mesh.scale.y / 2;
      colDesc = RAPIER.ColliderDesc.cone(h, r);
    } else {
      // box fallback
      const s = mesh.scale;
      const params = mesh.geometry.parameters || {};
      const w = (params.width || 1) * s.x / 2;
      const he = (params.height || 1) * s.y / 2;
      const d = (params.depth || 1) * s.z / 2;
      colDesc = RAPIER.ColliderDesc.cuboid(w, he, d);
    }

    physicsInfo = engine.physics.addDynamic(mesh, colDesc, {
      mass: opts.mass,
      restitution: opts.bounciness ?? 0.12,
      friction: opts.friction ?? 0.9,
      linearDamping: opts.linearDamping ?? (mesh.geometry.type === 'SphereGeometry' ? 0.6 : 0.5),
      angularDamping: opts.angularDamping ?? (mesh.geometry.type === 'SphereGeometry' ? 2.2 : 1.0),
    });
  }

  const obj = new GameObject(mesh, engine, physicsInfo, {
    collision: !!opts.collision,
    ownsGeometry: true,
  });
  if (opts.name) obj.name = opts.name;
  return obj;
}

export function createShapeFactories(engine) {
  function createCube(opts = {}) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 });
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createSphere(opts = {}) {
    const geo = new THREE.SphereGeometry(0.5, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createCone(opts = {}) {
    const geo = new THREE.ConeGeometry(0.5, 1, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createCylinder(opts = {}) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createPlane(opts = {}) {
    const geo = new THREE.PlaneGeometry(5, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // lay flat by default
    return buildObject(mesh, engine, opts);
  }

  return { createCube, createSphere, createCone, createCylinder, createPlane };
}

import { placementPosition } from './placementPosition.js';
import { resolveColor } from './resolveColor.js';
/**
 * ShapeFactory.js – Creates Three.js meshes + optional physics and wraps them
 * in GameObject instances. Each create* function is exposed globally to kids.
 */
import * as THREE from 'three';
import { GameObject } from './GameObject.js';
import { createToyBoxGeometry, createToySphereGeometry, createPrimitiveMaterial } from '../engine/primitiveStyle.js';

export const LIGHT_SHAPE_LIMITS = Object.freeze({
  maxActive: 10,
  defaultIntensity: 2,
  maxIntensity: 10,
  defaultRadius: 8,
  maxRadius: 30,
  maxScale: 5,
});

function finiteInRange(value, label, min, max, { inclusiveMin = true } = {}) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  if ((inclusiveMin ? value < min : value <= min) || value > max) {
    const lower = inclusiveMin ? `at least ${min}` : `greater than ${min}`;
    throw new RangeError(`${label} must be ${lower} and no more than ${max}.`);
  }
  return value;
}

function validateLightScale(x, y, z) {
  for (const value of [x, y, z]) {
    finiteInRange(value, 'Light shape scale', 0, LIGHT_SHAPE_LIMITS.maxScale, { inclusiveMin: false });
  }
}

/**
 * Shared helper to apply common options to a mesh, optionally enable physics,
 * and return a GameObject.
 */
function buildObject(mesh, engine, opts = {}, objectOpts = {}) {
  // Position
  const p = placementPosition(engine, opts.position);
  if (p) {
    mesh.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  }
  // Scale
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  if (opts.scale !== undefined) {
    const s = opts.scale;
    if (Array.isArray(s)) mesh.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
    else mesh.scale.set(s, s, s);
  }
  // Color
  if (opts.color) mesh.material.color.set(resolveColor(opts.color));
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
      linearDamping: opts.linearDamping ?? 0.05,
      angularDamping: opts.angularDamping ?? (mesh.geometry.type === 'SphereGeometry' ? 0.5 : 0.05),
    });
  }

  const obj = new GameObject(mesh, engine, physicsInfo, {
    collision: !!opts.collision,
    ownsGeometry: true,
    ignorePlayer: opts.ignorePlayer,
    ...objectOpts,
  });
  if (opts.name) obj.name = opts.name;
  return obj;
}

export function createShapeFactories(engine) {
  const activeLights = new Set();
  let lastLimitWarning = -Infinity;

  function createLightShape(createGeometry, opts = {}, roughness = 0.45, shadowless = false) {
    if (activeLights.size >= LIGHT_SHAPE_LIMITS.maxActive) {
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      if (now - lastLimitWarning >= 3000) {
        console.warn(`[lights] Limit reached: only ${LIGHT_SHAPE_LIMITS.maxActive} light shapes can be active. Destroy one before creating another.`);
        lastLimitWarning = now;
      }
      return null;
    }

    const intensity = finiteInRange(
      opts.lightIntensity ?? LIGHT_SHAPE_LIMITS.defaultIntensity,
      'lightIntensity', 0, LIGHT_SHAPE_LIMITS.maxIntensity
    );
    const radius = finiteInRange(
      opts.lightRadius ?? LIGHT_SHAPE_LIMITS.defaultRadius,
      'lightRadius', 0, LIGHT_SHAPE_LIMITS.maxRadius, { inclusiveMin: false }
    );
    const s = opts.scale ?? 1;
    const scale = Array.isArray(s) ? [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1] : [s, s, s];
    validateLightScale(...scale);

    const color = resolveColor(opts.color ?? 'white');
    const material = createPrimitiveMaterial(color, roughness, {
      emissive: color,
      emissiveIntensity: 0.8,
    });
    const mesh = new THREE.Mesh(createGeometry(), material);
    const light = new THREE.PointLight(color, intensity, radius, 2);
    light.castShadow = false;
    light.userData.validateIntensity = value => finiteInRange(
      value, 'lightIntensity', 0, LIGHT_SHAPE_LIMITS.maxIntensity
    );
    light.userData.validateRadius = value => finiteInRange(
      value, 'lightRadius', 0, LIGHT_SHAPE_LIMITS.maxRadius, { inclusiveMin: false }
    );
    mesh.add(light);

    let obj;
    obj = buildObject(mesh, engine, opts, {
      light,
      validateScale: validateLightScale,
      onDestroy: () => activeLights.delete(obj),
    });
    if (shadowless) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    activeLights.add(obj);
    return obj;
  }

  function createCube(opts = {}) {
    const geo = createToyBoxGeometry(1, 1, 1);
    const mat = createPrimitiveMaterial();
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createSphere(opts = {}) {
    const geo = createToySphereGeometry(0.5);
    const mat = createPrimitiveMaterial(0xffffff, 0.38);
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createCone(opts = {}) {
    const geo = new THREE.ConeGeometry(0.5, 1, 24);
    const mat = createPrimitiveMaterial();
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createCylinder(opts = {}) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    const mat = createPrimitiveMaterial();
    return buildObject(new THREE.Mesh(geo, mat), engine, opts);
  }

  function createLightCube(opts = {}) {
    return createLightShape(() => createToyBoxGeometry(1, 1, 1), opts, 0.45, true);
  }

  function createLightSphere(opts = {}) {
    return createLightShape(() => createToySphereGeometry(0.5), opts, 0.38, true);
  }

  function createLightCone(opts = {}) {
    return createLightShape(() => new THREE.ConeGeometry(0.5, 1, 24), opts);
  }

  function createLightCylinder(opts = {}) {
    return createLightShape(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 24), opts, 0.45, true);
  }

  function createPlane(opts = {}) {
    const geo = new THREE.PlaneGeometry(5, 5);
    const mat = createPrimitiveMaterial(0xffffff, 0.78, { side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // lay flat by default
    return buildObject(mesh, engine, opts);
  }

  return {
    createCube, createSphere, createCone, createCylinder, createPlane,
    createLightCube, createLightSphere, createLightCone, createLightCylinder,
  };
}

import * as THREE from 'three';
import { createToyBoxGeometry, createPrimitiveMaterial } from './primitiveStyle.js';

const TERRAIN_COLORS = Object.freeze({
  grass: 0x52b86c, grassLight: 0x65c27a, grassDark: 0x4aad62,
  grassEdge: 0xb5e947, cliffRock: 0x7186aa, cliffLight: 0x8899ba,
});

const TILE_SIZE = 5;
const CHECKER_COLORS = [0x94e953, 0x7bd446];

function coloredGeometry(positions, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function polygon(positions, colors, points, color) {
  for (let i = 1; i < points.length - 1; i++) {
    for (const point of [points[0], points[i], points[i + 1]]) {
      positions.push(...point);
      colors.push(color.r, color.g, color.b);
    }
  }
}

function facetColors(geometry, palette) {
  const colors = [];
  for (let i = 0; i < geometry.attributes.position.count; i += 3) {
    const color = new THREE.Color(palette[(i / 3 * 7) % palette.length]);
    for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function foliageGeometry(flower = false) {
  const positions = [], colors = [];
  const green = new THREE.Color(0x62b52c);
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3;
    const points = [[-0.07, 0, 0], [0.07, 0, 0], [0.2, 0.45 + blade * 0.12, 0], [0.12, 0.72 + blade * 0.09, 0], [-0.03, 0.3, 0]];
    polygon(positions, colors, points.map(([x, y, z]) => [Math.cos(angle) * x, y, Math.sin(angle) * x + z]), green);
  }
  if (flower) {
    polygon(positions, colors, [[-0.025, 0, 0], [0.025, 0, 0], [0.025, 0.7, 0], [-0.025, 0.7, 0]], green);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      const x = Math.cos(angle) * 0.13, z = Math.sin(angle) * 0.13;
      polygon(positions, colors, Array.from({ length: 6 }, (_, i) => [x + Math.cos(i * Math.PI / 3) * 0.12, 0.7, z + Math.sin(i * Math.PI / 3) * 0.12]).reverse(), new THREE.Color(0xfff9ea));
    }
    polygon(positions, colors, Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * 0.065, 0.705, Math.sin(i * Math.PI / 4) * 0.065]).reverse(), new THREE.Color(0xffcc24));
  }
  return coloredGeometry(positions, colors);
}

// Owned by one engine, retained across level changes. Only fixed environment
// definitions use this cache; random objects and student primitives stay private.
export class EnvironmentResources {
  constructor() {
    this.geometries = new Map();
    this.materials = new Map();
  }

  box(w, h, d, rounded = true) {
    const key = `box:${w}:${h}:${d}:${rounded}`;
    if (!this.geometries.has(key)) {
      this.geometries.set(key, rounded ? createToyBoxGeometry(w, h, d) : new THREE.BoxGeometry(w, h, d));
    }
    return this.geometries.get(key);
  }

  boxWithoutTop(w, h, d) {
    const key = `openTop:${w}:${h}:${d}`;
    if (!this.geometries.has(key)) {
      const geometry = this.box(w, h, d, false).clone();
      const indices = [], groups = [...geometry.groups];
      geometry.clearGroups();
      for (const group of groups) {
        const start = indices.length;
        if (group.materialIndex !== 2) {
          indices.push(...Array.from(geometry.index.array).slice(group.start, group.start + group.count));
        }
        geometry.addGroup(start, indices.length - start, group.materialIndex);
      }
      geometry.setIndex(indices);
      this.geometries.set(key, geometry);
    }
    return this.geometries.get(key);
  }

  scenery(kind) {
    if (!this.geometries.has(kind)) {
      let geometry;
      switch (kind) {
        case 'trunk': geometry = new THREE.CylinderGeometry(0.35, 0.45, 3, 8); break;
        case 'canopy': geometry = facetColors(new THREE.IcosahedronGeometry(1, 1), [0x59ad16, 0x75c51b, 0x96d528]); break;
        case 'bush': geometry = facetColors(new THREE.IcosahedronGeometry(1, 0), [0x68b825, 0x8dcb2a, 0xa2d735]); break;
        case 'rock': geometry = facetColors(new THREE.IcosahedronGeometry(1, 0), [0x8895b1, 0xa0a6be, 0x959bb5]); break;
        case 'grassTuft': geometry = foliageGeometry(); break;
        case 'flower': geometry = foliageGeometry(true); break;
        case 'cloud': {
          geometry = new THREE.SphereGeometry(1, 12, 8);
          const colors = [];
          for (let i = 0; i < geometry.attributes.position.count; i++) {
            const y = geometry.attributes.position.getY(i);
            const color = new THREE.Color(0xd3edff).lerp(new THREE.Color(0xffffff), (y + 1) / 2);
            colors.push(color.r, color.g, color.b);
          }
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          break;
        }
        case 'structureCone': geometry = new THREE.ConeGeometry(1, 1, 24); break;
        case 'structureCylinder': geometry = new THREE.CylinderGeometry(1, 1, 1, 24); break;
        case 'celestial': geometry = new THREE.SphereGeometry(1, 16, 12); break;
        case 'grassPatch': {
          // One reusable, asymmetric eight-sided silhouette; no tiles or noise.
          const shape = new THREE.Shape();
          shape.moveTo(-1, -0.2);
          for (const [x, y] of [[-0.65, -0.8], [0.15, -1], [0.85, -0.55], [1, 0.2], [0.5, 0.85], [-0.2, 1], [-0.9, 0.5]]) shape.lineTo(x, y);
          shape.closePath();
          geometry = new THREE.ShapeGeometry(shape);
          geometry.rotateX(-Math.PI / 2);
          break;
        }
        default: throw new Error(`Unknown environment geometry: ${kind}`);
      }
      this.geometries.set(kind, geometry);
    }
    return this.geometries.get(kind);
  }

  material(color, roughness = 0.78, flatShading = false) {
    const key = `${color}:${roughness}:${flatShading}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, createPrimitiveMaterial(color, roughness, { flatShading }));
    }
    return this.materials.get(key);
  }

  terrainMaterial(kind) {
    if (!(kind in TERRAIN_COLORS)) throw new Error(`Unknown terrain material: ${kind}`);
    return this.material(TERRAIN_COLORS[kind]);
  }

  vertexMaterial(kind = 'grass') {
    const key = `vertex:${kind}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, createPrimitiveMaterial(kind === 'nightGrass' ? 0xd1def9 : 0xffffff, kind === 'rock' ? 0.9 : 0.8, {
        vertexColors: true,
        flatShading: kind === 'foliage' || kind === 'rock',
        side: kind === 'sprout' ? THREE.DoubleSide : THREE.FrontSide,
      }));
    }
    return this.materials.get(key);
  }

  cloudMaterial(environment = 'day') {
    const key = `cloud:${environment}`;
    if (!this.materials.has(key)) {
      // Lit diffuse clouds retain their baked white/blue shading. A small fill
      // keeps undersides readable without the former unlit white bloom peaks.
      this.materials.set(key, new THREE.MeshLambertMaterial({
        color: environment === 'earlyDawn' ? 0xfff2e5 : environment === 'night' ? 0x9aadc9 : environment.startsWith('sunset') ? 0xffefdb : 0xe9f2fa,
        vertexColors: true, emissive: 0xc4d9ed, emissiveIntensity: environment === 'night' ? 0.08 : 0.45,
      }));
    }
    return this.materials.get(key);
  }

  celestialMaterial(kind) {
    const key = `celestial:${kind}`;
    if (!this.materials.has(key)) {
      const color = new THREE.Color(kind === 'dawnSun' ? 0xffd9a3 : kind === 'moon' ? 0xd4e2ff : 0xffc477);
      color.multiplyScalar(kind === 'moon' ? 1.25 : 2.3);
      this.materials.set(key, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    }
    return this.materials.get(key);
  }

  templeTierGeometry() {
    const key = 'templeTier';
    if (!this.geometries.has(key)) {
      const positions = [], colors = [];
      // Exposed walls, a narrow stone trim band, and a light flat top.
      // Omit undersides: upper tiers must not duplicate lower-tier top planes.
      for (let face = 0; face < 4; face++) {
        const angle = face * Math.PI / 2;
        for (const [bottom, top, tint] of [[-0.5, 0.34, 0xc6c6bb],
          [0.34, 0.42, 0xe4e9cc], [0.42, 0.5, 0xc6c6bb]]) {
          const points = [[-0.5, bottom, 0.5], [0.5, bottom, 0.5],
            [0.5, top, 0.5], [-0.5, top, 0.5]].map(([x, y, z]) =>
            [x * Math.cos(angle) + z * Math.sin(angle), y, z * Math.cos(angle) - x * Math.sin(angle)]);
          polygon(positions, colors, points, new THREE.Color(tint));
        }
      }
      polygon(positions, colors, [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]], new THREE.Color(0xfff4df));
      this.geometries.set(key, coloredGeometry(positions, colors));
    }
    return this.geometries.get(key);
  }

  templeMaterial(color) {
    const key = `temple:${color}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, createPrimitiveMaterial(color, 0.85, { vertexColors: true }));
    }
    return this.materials.get(key);
  }

  starField() {
    const key = 'nightStars';
    if (!this.geometries.has(key)) {
      const positions = [], colors = [], sizes = [];
      let seed = 917;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 220; i++) {
        const angle = random() * Math.PI * 2;
        const height = 0.3 + random() * 0.68;
        const radius = Math.sqrt(1 - height * height) * 450;
        positions.push(Math.cos(angle) * radius, height * 450, Math.sin(angle) * radius);
        const brightness = 0.55 + random() * 0.4;
        colors.push(brightness * 0.85, brightness * 0.92, brightness);
        sizes.push(0.7 + random() * 0.6);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
      this.geometries.set(key, geometry);
      const material = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false,
        vertexColors: true, toneMapped: false, depthWrite: false, fog: false });
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'attribute float starSize;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * starSize;');
        shader.fragmentShader = shader.fragmentShader.replace('void main() {',
          'void main() {\n if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;');
      };
      this.materials.set(key, material);
    }
    const stars = new THREE.Points(this.geometries.get(key), this.materials.get(key));
    stars.name = 'distantStars';
    return stars;
  }

  checkerGrass(x, z, w, d) {
    const key = `checker:${x}:${z}:${w}:${d}`;
    if (!this.geometries.has(key)) {
      const positions = [], colors = [];
      const left = x - w / 2, right = x + w / 2, back = z - d / 2, front = z + d / 2;
      for (let ix = Math.floor(left / TILE_SIZE); ix < Math.ceil(right / TILE_SIZE); ix++) {
        for (let iz = Math.floor(back / TILE_SIZE); iz < Math.ceil(front / TILE_SIZE); iz++) {
          const x0 = Math.max(left, ix * TILE_SIZE), x1 = Math.min(right, (ix + 1) * TILE_SIZE);
          const z0 = Math.max(back, iz * TILE_SIZE), z1 = Math.min(front, (iz + 1) * TILE_SIZE);
          const color = new THREE.Color(CHECKER_COLORS[(ix + iz) & 1]);
          // Stable world-cell hashing: motifs stay aligned across heights/resets.
          const hash = Math.imul(ix + 91, 374761393) ^ Math.imul(iz + 117, 668265263);
          const seed = (hash >>> 0) / 4294967296;
          const cx = (ix + 0.3 + seed * 0.7) * TILE_SIZE;
          const cz = (iz + 0.65 - seed * 0.5) * TILE_SIZE;
          const radius = seed < 0.08 ? 0.55 : 0.28;
          const tint = color.clone().multiplyScalar(seed < 0.22 ? 1.12 : 0.88);
          const petals = seed < 0.22 ? 5 : 3;
          const contour = [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]].map(p => new THREE.Vector2(...p));
          const motif = [];
          if (seed <= 0.45 && cx - radius * 2 > x0 && cx + radius * 2 < x1
            && cz - radius * 2 > z0 && cz + radius * 2 < z1) {
            // Two outline vertices per petal keep the triangulated tile + motif
            // at the same triangle budget as the former six-sided petal overlays.
            for (let i = 0; i < petals * 2; i++) {
              const angle = i * Math.PI * 2 / (petals * 2);
              const r = radius * (1.25 + 0.55 * Math.cos(petals * angle));
              motif.push(new THREE.Vector2(cx + Math.cos(angle + seed * 6) * r,
                -cz + Math.sin(angle + seed * 6) * r));
            }
          }
          // Cut the motif out of its tile, then fill it at the same height.
          // The colored regions meet at edges; no overlay competes for depth.
          const emit = (vertices, triangles, shade) => {
            for (const triangle of triangles) for (const index of triangle) {
              const point = vertices[index];
              positions.push(point.x, 0, -point.y);
              colors.push(shade.r, shade.g, shade.b);
            }
          };
          emit([...contour, ...motif], THREE.ShapeUtils.triangulateShape(contour, motif.length ? [motif] : []), color);
          if (motif.length) emit(motif, THREE.ShapeUtils.triangulateShape(motif, []), tint);
        }
      }
      this.geometries.set(key, coloredGeometry(positions, colors));
    }
    return this.geometries.get(key);
  }

  // Permanent engine teardown only; level.clear() must never dispose this cache.
  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometries.clear();
    this.materials.clear();
  }
}

/**
 * Build a stylized, game-ready cyan feather and export it as GLB.
 * Chunky collectible look: C-curve, raised rachis, sharp notches, barb ridges.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { Blob } from 'node:buffer';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/assets');
const LENGTH = 1.78;

if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob;

class FileReaderPolyfill {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onload = null;
    this.onerror = null;
  }

  async _finish(value) {
    this.result = value;
    const event = { target: this };
    this.onloadend?.(event);
    this.onload?.(event);
  }

  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buf) => this._finish(buf), (err) => this.onerror?.(err));
  }

  readAsDataURL(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buf) => {
      const b64 = Buffer.from(buf).toString('base64');
      this._finish(`data:${blob.type || 'application/octet-stream'};base64,${b64}`);
    }, (err) => this.onerror?.(err));
  }
}

globalThis.FileReader = FileReaderPolyfill;

// [t 0..1, half-width]. Linear segments = sharp triangular notches.
const LEFT_PROFILE = [
  [0.0, 0.0],
  [0.09, 0.0],
  [0.13, 0.055],
  [0.2, 0.3],
  [0.26, 0.46],
  [0.308, 0.125],
  [0.365, 0.485],
  [0.435, 0.115],
  [0.51, 0.43],
  [0.585, 0.12],
  [0.68, 0.26],
  [0.82, 0.1],
  [0.93, 0.03],
  [1.0, 0.0],
];

const RIGHT_PROFILE = [
  [0.0, 0.0],
  [0.09, 0.0],
  [0.125, 0.045],
  [0.18, 0.24],
  [0.238, 0.395],
  [0.288, 0.11],
  [0.348, 0.425],
  [0.42, 0.1],
  [0.492, 0.38],
  [0.568, 0.105],
  [0.67, 0.22],
  [0.815, 0.085],
  [0.93, 0.024],
  [1.0, 0.0],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sampleProfile(profile, t) {
  if (t <= profile[0][0]) return profile[0][1];
  const last = profile[profile.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < profile.length - 1; i++) {
    const [t0, w0] = profile[i];
    const [t1, w1] = profile[i + 1];
    if (t >= t0 && t <= t1) return lerp(w0, w1, (t - t0) / (t1 - t0));
  }
  return 0;
}

function spineRadius(t) {
  return lerp(0.048, 0.01, t ** 0.7) * (1 - smoothstep(0.9, 1, t)) + 0.002;
}

/** C-curve from quill (base) toward the tip. */
function frameAt(t) {
  const angle = -0.92 * t ** 1.08;
  const y = t * LENGTH;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const origin = new THREE.Vector3(-y * sa, y * ca, 0);
  const tangent = new THREE.Vector3(-sa, ca, 0).normalize();
  const binormal = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
  return { origin, tangent, normal, binormal, angle };
}

function paintColor(s, valley, onSpine, cz) {
  const cyan = new THREE.Color('#3ad4f0');
  const deep = new THREE.Color('#1aa0be');
  const lite = new THREE.Color('#9af2fb');
  const color = cyan.clone();
  color.lerp(deep, 0.28 * (1 - s) + 0.2 * (1 - valley));
  color.lerp(lite, 0.4 * s * valley + 0.22 * Math.max(0, cz) + (onSpine ? 0.16 : 0));
  return color;
}

function buildVaneGeometry() {
  const nLen = 72;
  const nWidth = 18;
  const positions = [];
  const colors = [];
  const uvs = [];

  const pushVertex = (p, color, u, v) => {
    positions.push(p.x, p.y, p.z);
    colors.push(color.r, color.g, color.b);
    uvs.push(u, v);
  };

  const top = [];
  const bot = [];

  for (let i = 0; i < nLen; i++) {
    const t = lerp(0.118, 1, i / (nLen - 1));
    const { origin, normal, binormal } = frameAt(t);
    const leftW = sampleProfile(LEFT_PROFILE, t);
    const rightW = sampleProfile(RIGHT_PROFILE, t);
      const thick = lerp(0.04, 0.018, t);
    const rowTop = [];
    const rowBot = [];

    for (let j = 0; j < nWidth; j++) {
      const u = j / (nWidth - 1);
      const x = lerp(-leftW, rightW, u);
      const half = x < 0 ? leftW : rightW;
      const xn = half > 1e-5 ? x / half : 0;
      const s = Math.min(1, Math.abs(xn));
      const edgePinch = Math.pow(Math.max(0, 1 - s * s), 0.42);
      const barb = t - 0.32 * s;
      const valley = 0.5 + 0.5 * Math.cos(barb * Math.PI * 11);
      const groove = -0.0065 * (1 - valley) * s * edgePinch;
      const zTop = thick * 0.55 * edgePinch + groove;
      const zBot = -thick * 0.4 * edgePinch + groove * 0.35;

      const pTop = origin.clone()
        .addScaledVector(normal, x)
        .addScaledVector(binormal, zTop);
      const pBot = origin.clone()
        .addScaledVector(normal, x)
        .addScaledVector(binormal, zBot);

      const color = paintColor(s, valley, false, zTop > 0 ? 1 : -1);
      rowTop.push({ p: pTop, color, u, t });
      rowBot.push({ p: pBot, color: color.clone().lerp(new THREE.Color('#117a96'), 0.12), u, t });
    }
    top.push(rowTop);
    bot.push(rowBot);
  }

  const indexOf = { top: [], bot: [] };
  const addRow = (rows, key) => {
    for (let i = 0; i < rows.length; i++) {
      indexOf[key][i] = [];
      for (let j = 0; j < nWidth; j++) {
        const v = rows[i][j];
        indexOf[key][i][j] = positions.length / 3;
        pushVertex(v.p, v.color, v.u, v.t);
      }
    }
  };
  addRow(top, 'top');
  addRow(bot, 'bot');

  const indices = [];
  const quad = (a, b, c, d) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < nLen - 1; i++) {
    for (let j = 0; j < nWidth - 1; j++) {
      quad(indexOf.top[i][j], indexOf.top[i][j + 1], indexOf.top[i + 1][j + 1], indexOf.top[i + 1][j]);
      quad(indexOf.bot[i][j], indexOf.bot[i + 1][j], indexOf.bot[i + 1][j + 1], indexOf.bot[i][j + 1]);
    }
    quad(
      indexOf.top[i][0],
      indexOf.top[i + 1][0],
      indexOf.bot[i + 1][0],
      indexOf.bot[i][0]
    );
    const e = nWidth - 1;
    quad(
      indexOf.top[i][e],
      indexOf.bot[i][e],
      indexOf.bot[i + 1][e],
      indexOf.top[i + 1][e]
    );
  }

  // Base and tip caps
  for (const i of [0, nLen - 1]) {
    for (let j = 0; j < nWidth - 1; j++) {
      if (i === 0) {
        quad(indexOf.top[i][j], indexOf.bot[i][j], indexOf.bot[i][j + 1], indexOf.top[i][j + 1]);
      } else {
        quad(indexOf.top[i][j], indexOf.top[i][j + 1], indexOf.bot[i][j + 1], indexOf.bot[i][j]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildSpineGeometry() {
  const nLen = 56;
  const nRad = 14;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < nLen; i++) {
    const t = i / (nLen - 1);
    const { origin, normal, binormal, tangent } = frameAt(t);
    const radius = spineRadius(t);
    const center = origin.clone().addScaledVector(binormal, radius * 0.55);

    for (let k = 0; k < nRad; k++) {
      const a = (k / nRad) * Math.PI * 2;
      const radial = normal.clone().multiplyScalar(Math.cos(a))
        .addScaledVector(binormal, Math.sin(a));
      const p = center.clone().addScaledVector(radial, i === 0 || i === nLen - 1 ? 0 : radius);
      if (i === 0) p.copy(origin.clone().addScaledVector(tangent, -0.012));
      if (i === nLen - 1) p.copy(origin);
      const s = Math.abs(Math.cos(a));
      const color = paintColor(s * 0.35, 0.7, true, Math.sin(a));
      positions.push(p.x, p.y, p.z);
      colors.push(color.r, color.g, color.b);
      uvs.push(k / nRad, t);
    }
  }

  for (let i = 0; i < nLen - 1; i++) {
    for (let k = 0; k < nRad; k++) {
      const k2 = (k + 1) % nRad;
      const a = i * nRad + k;
      const b = i * nRad + k2;
      const c = (i + 1) * nRad + k;
      const d = (i + 1) * nRad + k2;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePNG(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * (width * 4 + 1) + 1);
  }

  const chunk = (type, payload) => {
    const body = Buffer.concat([Buffer.from(type), payload]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, c]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function renderPreview(geometry, file) {
  const width = 720;
  const height = 720;
  const rgba = new Uint8Array(width * height * 4);
  const zbuf = new Float32Array(width * height);
  zbuf.fill(-Infinity);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 216;
    rgba[i * 4 + 1] = 216;
    rgba[i * 4 + 2] = 216;
    rgba[i * 4 + 3] = 255;
  }

  geometry = geometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationZ(0.38));
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(0.55));
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.18));
  geometry.computeVertexNormals();

  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const col = geometry.attributes.color;
  const idx = geometry.index;
  const light = new THREE.Vector3(0.45, 0.75, 0.48).normalize();
  const tmp = new THREE.Vector3();

  const project = (i) => {
    tmp.fromBufferAttribute(pos, i);
    const scale = 310;
    return {
      x: width * 0.5 + tmp.x * scale,
      y: height * 0.52 - tmp.y * scale,
      z: tmp.z,
      nx: nrm.getX(i),
      ny: nrm.getY(i),
      nz: nrm.getZ(i),
      r: col.getX(i),
      g: col.getY(i),
      b: col.getZ(i),
    };
  };

  const edge = (a, b, x, y) => (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);

  for (let t = 0; t < idx.count; t += 3) {
    const a = project(idx.getX(t));
    const b = project(idx.getX(t + 1));
    const c = project(idx.getX(t + 2));
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = edge(a, b, c.x, c.y);
    if (Math.abs(area) < 1e-4) continue;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = edge(b, c, x + 0.5, y + 0.5) / area;
        const w1 = edge(c, a, x + 0.5, y + 0.5) / area;
        const w2 = edge(a, b, x + 0.5, y + 0.5) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a.z + w1 * b.z + w2 * c.z;
        const p = y * width + x;
        if (z < zbuf[p]) continue;
        zbuf[p] = z;
        const nx = w0 * a.nx + w1 * b.nx + w2 * c.nx;
        const ny = w0 * a.ny + w1 * b.ny + w2 * c.ny;
        const nz = w0 * a.nz + w1 * b.nz + w2 * c.nz;
        const nd = Math.hypot(nx, ny, nz) || 1;
        const ndot = Math.max(0.22, (nx * light.x + ny * light.y + nz * light.z) / nd);
        const amb = 0.58;
        const lit = amb + 0.62 * ndot;
        rgba[p * 4] = Math.min(255, (w0 * a.r + w1 * b.r + w2 * c.r) * lit * 255);
        rgba[p * 4 + 1] = Math.min(255, (w0 * a.g + w1 * b.g + w2 * c.g) * lit * 255);
        rgba[p * 4 + 2] = Math.min(255, (w0 * a.b + w1 * b.b + w2 * c.b) * lit * 255);
        rgba[p * 4 + 3] = 255;
      }
    }
  }

  writePNG(file, width, height, rgba);
}

function exportGLB(scene) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (result) => resolve(Buffer.from(result)), reject, { binary: true });
  });
}

function assertFinitePositions(geometry, label) {
  const arr = geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) {
      throw new Error(`${label} has non-finite position at ${i}: ${arr[i]}`);
    }
  }
}

const vane = buildVaneGeometry();
assertFinitePositions(vane, 'vane');
const spine = buildSpineGeometry();
assertFinitePositions(spine, 'spine');
const geometry = mergeGeometries([vane, spine], false);
geometry.center();
geometry.computeVertexNormals();
geometry.computeBoundingBox();
geometry.computeBoundingSphere();

const material = new THREE.MeshStandardMaterial({
  name: 'FeatherCyan',
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.5,
  metalness: 0.06,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.name = 'Feather';
mesh.castShadow = true;
mesh.receiveShadow = true;

const scene = new THREE.Scene();
scene.add(mesh);

fs.mkdirSync(OUT_DIR, { recursive: true });
const glbPath = path.join(OUT_DIR, 'feather.glb');
const previewPath = path.join(OUT_DIR, 'feather-preview.png');
fs.writeFileSync(glbPath, await exportGLB(scene));
renderPreview(geometry, previewPath);

const size = new THREE.Vector3();
geometry.boundingBox.getSize(size);
console.log(`Wrote ${glbPath}`);
console.log(`Preview ${previewPath}`);
console.log(`Size: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
console.log(`Vertices: ${geometry.attributes.position.count}  Triangles: ${geometry.index.count / 3}`);

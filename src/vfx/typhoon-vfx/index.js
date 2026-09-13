import * as THREE from './three.js';
import { WaterTunnel } from './water-tunnel.js';
import { loadTyphoonTextures, getTyphoonTextures, disposeTyphoonTextures } from './textures.js';

const DECAL_LOOP = Math.PI * 40;
const DEFAULT_BOTTOM_RADIUS = 1;
const DEFAULT_TOP_RADIUS = 1.45;

/** Hidden look / timing defaults from the source Typhoon effect. */
const SHOCKWAVE_DEFAULTS = {
  startDuration: 1.02,
  spawnTornadoDuration: 8,
  endPhaseDuration: 0.49,
  scaleMin: 0.08,
  scaleMax: 2.4,
  alphaMin: 0.15,
  alphaMax: 0.84,
  maxHeight: 0.3,
  deformationAmount: 0.12,
  rotationMul: 1,
  groundLift: 0.045,
  loop: false,
  loopDelay: 2,
  radialSegments: 48,
  heightSegments: 14,
};

const DECAL_DEFAULTS = {
  alphaMin: 0.15,
  alphaMax: 0.80,
  distortion: 0.029,
  edgeMotion: 0.008,
  flow: 8,
  colors: ['#19cfff', '#008cff', '#55eaff'],
};

const TUNNEL_DEFAULTS = {
  height: 25,
  radius: 1.6,
  floorY: 0,
  twistSpeed: 8.5,
  twistAmount: 7.3,
  turbulence: 0.2,
  centerlineWander: 0.2,
  centerlineWanderSpeed: 0.48,
  upperTurbulence: 0.7,
  crownChaos: 0.4,
  radiusVariation: 0.95,
  formationCoreRadius: 1.2,
  formationSpeed: 0.68,
  formationTurbulence: 0.55,
  radialSegments: 64,
  heightSegments: 128,
  waterColor: '#2a7eb8',
  intensity: 1.5,
  noiseScale: 1.65,
  noiseSpeed: 1.16,
  waterNoiseScale: 2.35,
  waterNoiseSpeed: 0.34,
  foamAmount: 0.62,
  foamThreshold: 0.4,
  alpha: 1,
  fresnelPower: 5,
  fresnelStrength: 0.38,
  debugMode: 0,
  riseDuration: 0.35,
  fallDuration: 0.15,
  disturbDuration: 0.75,
  eruptDuration: 1.05,
  peakDuration: 1.7,
  dissipateDuration: 1.35,
};

const DECAL_LAYER_SOURCE = [
  { spinMul: 0.35, distortion: 0.035, opacity: 0.80, edgeMotion: 0.008, scale: 1.00, y: 0.012 },
  { spinMul: -0.22, distortion: 0.025, opacity: 0.30, edgeMul: 0.006, scale: 0.96, y: 0.016 },
  { spinMul: 0.12, distortion: 0.018, opacity: 0.14, edgeMul: 0.004, scale: 0.91, y: 0.020 },
];

const waterVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const waterFragmentShader = `
  uniform sampler2D uRingTexture;
  uniform sampler2D uBaseTexture;
  uniform sampler2D uNormalMap;
  uniform sampler2D uRoughnessMap;
  uniform float uTime;
  uniform float uSpin;
  uniform float uDistortion;
  uniform float uOpacity;
  uniform float uEdgeMotion;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 originalUV = vUv;
    vec2 centered = originalUV - 0.5;
    float originalRadius = length(centered);
    float originalAngle = atan(centered.y, centered.x);
    float time = uTime;
    float spin = time * uSpin;
    float angle = originalAngle + spin;

    float wave1 = sin(originalRadius * 30.0 - time * 2.0 + originalAngle * 4.0);
    float wave2 = sin(originalRadius * 54.0 + time * 1.4 - originalAngle * 6.0);
    float wave3 = sin(originalRadius * 17.0 - time * 0.8 + originalAngle * 2.0);
    float flow = wave1 * 0.50 + wave2 * 0.30 + wave3 * 0.20;
    float radius = originalRadius + flow * uDistortion * originalRadius;

    float tangentWarp = sin(originalRadius * 24.0 - time * 1.8 + originalAngle * 5.0) * uDistortion * 0.35;
    angle += tangentWarp * originalRadius;

    float edgeWave = sin(originalAngle * 7.0 + time * 0.9);
    edgeWave += sin(originalAngle * 11.0 - time * 0.6) * 0.35;
    edgeWave *= uEdgeMotion * smoothstep(0.45, 0.90, originalRadius);
    radius += edgeWave;

    vec2 uv;
    uv.x = cos(angle) * radius + 0.5;
    uv.y = sin(angle) * radius + 0.5;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      discard;
    }

    vec4 ring = texture2D(uRingTexture, uv);
    vec3 baseWater = texture2D(uBaseTexture, uv).rgb;
    vec3 normal = normalize(texture2D(uNormalMap, uv).rgb * 2.0 - 1.0);
    float roughness = texture2D(uRoughnessMap, uv).r;

    float movingFlow = sin(originalRadius * 46.0 - time * 2.7 + originalAngle * 5.0) * 0.5 + 0.5;
    float movingFlow2 = sin(originalRadius * 78.0 + time * 2.0 - originalAngle * 8.0) * 0.5 + 0.5;
    float highlight = smoothstep(0.68, 0.95, movingFlow) * 0.30;
    highlight += smoothstep(0.72, 1.0, movingFlow2) * 0.12;

    vec3 lightDirection = normalize(vec3(0.35, 0.70, 0.65));
    float normalLight = max(dot(normal, lightDirection), 0.0);
    float smoothness = 1.0 - roughness;
    float specularPower = mix(18.0, 80.0, smoothness);
    vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0));
    vec3 reflected = reflect(-lightDirection, normal);
    float specular = pow(max(dot(reflected, viewDirection), 0.0), specularPower) * smoothness;

    float surfaceLight = clamp(0.65 + normalLight * 0.55, 0.55, 1.35);
    vec3 color = baseWater * uColor * surfaceLight;
    color += uColor * highlight;
    color += vec3(0.65, 0.90, 1.0) * specular * 1.35;

    float edgeMask = smoothstep(0.40, 0.88, originalRadius);
    color += uColor * pow(edgeMask, 2.0) * 0.08;

    float alpha = ring.a * uOpacity;
    float pulse = 0.96 + sin(time * 1.2) * 0.04;
    alpha *= pulse;

    float radialFade = 1.0 - smoothstep(0.46, 0.72, originalRadius);
    alpha *= max(ring.a, radialFade * ring.a);

    gl_FragColor = vec4(color, alpha);
  }
`;

class Emitter {
  constructor() {
    this._listeners = new Map();
  }

  on(name, fn) {
    if (typeof fn !== 'function') return this;
    let list = this._listeners.get(name);
    if (!list) {
      list = [];
      this._listeners.set(name, list);
    }
    list.push(fn);
    return this;
  }

  off(name, fn) {
    const list = this._listeners.get(name);
    if (!list) return this;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    return this;
  }

  once(name, fn) {
    const wrap = (payload) => {
      this.off(name, wrap);
      fn(payload);
    };
    return this.on(name, wrap);
  }

  emit(name, payload) {
    const list = this._listeners.get(name);
    if (!list || list.length === 0) return this;
    for (const fn of list.slice()) fn(payload);
    return this;
  }

  clear() {
    this._listeners.clear();
  }
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function phaseWindows(cfg) {
  const startDur = Math.max(cfg.startDuration, 0.001);
  const holdDur = Math.max(cfg.spawnTornadoDuration, 0.001);
  const endDur = Math.max(cfg.endPhaseDuration, 0.001);
  return {
    startDur,
    holdDur,
    endDur,
    startEnd: startDur,
    holdEnd: startDur + holdDur,
    endEnd: startDur + holdDur + endDur,
  };
}

function createWaterMaterial(textures) {
  return new THREE.MeshStandardMaterial({
    color: '#6ecbe0',
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaMap: textures.splashAlpha,
    normalMap: textures.splashNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: textures.splashRoughness,
  });
}

function createDecalMaterial(textures, spin, distortion, opacity, edgeMotion, color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRingTexture: { value: textures.waterRing },
      uBaseTexture: { value: textures.waterBase },
      uNormalMap: { value: textures.waterNormal },
      uRoughnessMap: { value: textures.waterRoughness },
      uTime: { value: 0 },
      uSpin: { value: spin },
      uDistortion: { value: distortion },
      uOpacity: { value: opacity },
      uEdgeMotion: { value: edgeMotion },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
  });
}

function resolvePublicOptions(options = {}) {
  const radius = options.radius == null ? DEFAULT_BOTTOM_RADIUS : Number(options.radius);
  const duration = options.duration == null ? SHOCKWAVE_DEFAULTS.spawnTornadoDuration : Number(options.duration);
  const safeRadius = Number.isFinite(radius) ? Math.max(0.05, radius) : DEFAULT_BOTTOM_RADIUS;
  const safeDuration = Number.isFinite(duration) ? Math.max(0.05, duration) : SHOCKWAVE_DEFAULTS.spawnTornadoDuration;

  const position = options.position && options.position.isVector3
    ? options.position.clone()
    : new THREE.Vector3();

  return {
    position,
    radius: safeRadius,
    duration: safeDuration,
    loop: options.loop === true,
    textures: options.textures,
  };
}

class Shockwave {
  constructor(textures) {
    this.textures = textures;
    this.origin = new THREE.Vector3();
    this.material = createWaterMaterial(textures);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.name = 'TyphoonShockwave';
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.active = false;
    this.restPositions = null;
    this.baseHeight = 1;
    this.baseRadius = DEFAULT_BOTTOM_RADIUS;
    this.resetDefaults();
  }

  resetDefaults() {
    this.age = 0;
    this.finished = false;
    this.phase = 0;
    this.freqA = 3;
    this.freqB = 7;
    this.freqC = 5;
    this.speedA = 2.4;
    this.speedB = 1.7;
    this.speedC = 3.1;
  }

  buildGeometry(radiusTop, radiusBottom, height, cfg) {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    const geometry = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      cfg.radialSegments,
      cfg.heightSegments,
      true
    );
    this.mesh.geometry = geometry;
    this.restPositions = new Float32Array(geometry.attributes.position.array);
    this.baseHeight = height;
  }

  spawn(cfg, radii, origin) {
    this.resetDefaults();
    this.active = true;
    this.finished = false;
    this.age = 0;
    this.origin.copy(origin);
    this.baseRadius = radii.bottom;
    this.phase = Math.random() * Math.PI * 2;
    this.freqA = 2 + Math.floor(Math.random() * 4);
    this.freqB = 5 + Math.floor(Math.random() * 5);
    this.freqC = 3 + Math.floor(Math.random() * 4);
    this.speedA = randRange(1.6, 3.4);
    this.speedB = randRange(1.1, 2.6);
    this.speedC = randRange(2.0, 4.2);

    const height = Math.max(cfg.maxHeight, 0.001);
    this.buildGeometry(radii.top, radii.bottom, height, cfg);

    this.mesh.rotation.y = this.phase;
    this.mesh.scale.set(cfg.scaleMin, 1, cfg.scaleMin);
    this.mesh.position.set(
      origin.x,
      origin.y + this.baseHeight * 0.5 + cfg.groundLift,
      origin.z
    );
    this.material.opacity = cfg.alphaMin;
    this.mesh.visible = true;
  }

  destroy() {
    this.active = false;
    this.finished = true;
    this.mesh.visible = false;
    this.material.opacity = 0;
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.BufferGeometry();
    }
    this.restPositions = null;
  }

  dispose() {
    this.destroy();
    this.material.dispose();
  }

  update(dt, cfg, elapsed) {
    if (!this.active) return;
    this.age += dt;

    const timing = phaseWindows(cfg);
    if (this.age >= timing.endEnd) {
      this.destroy();
      return;
    }

    let radial;
    let opacity;
    if (this.age < timing.startEnd) {
      const t = this.age / timing.startDur;
      radial = THREE.MathUtils.lerp(cfg.scaleMin, cfg.scaleMax, t);
      opacity = THREE.MathUtils.lerp(cfg.alphaMin, cfg.alphaMax, t);
    } else if (this.age < timing.holdEnd) {
      radial = cfg.scaleMax;
      opacity = cfg.alphaMax;
    } else {
      const t = (this.age - timing.holdEnd) / timing.endDur;
      radial = cfg.scaleMax;
      opacity = THREE.MathUtils.lerp(cfg.alphaMax, 0, t);
    }

    this.mesh.scale.set(radial, 1, radial);
    this.mesh.rotation.y += cfg.rotationMul * Math.PI * 2 * dt;
    this.mesh.position.set(
      this.origin.x,
      this.origin.y + this.baseHeight * 0.5 + cfg.groundLift,
      this.origin.z
    );

    this.material.opacity = opacity;
    const n = 0.28 + 0.22 * THREE.MathUtils.clamp(opacity / Math.max(cfg.alphaMax, 0.001), 0, 1);
    this.material.normalScale.set(n, n);
    this.deform(elapsed, cfg.deformationAmount);
  }

  deform(elapsed, amount) {
    const pos = this.mesh.geometry.attributes.position;
    const rest = this.restPositions;
    if (!pos || !rest) return;
    const half = this.baseHeight * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = rest[ix];
      const y = rest[ix + 1];
      const z = rest[ix + 2];
      const angle = Math.atan2(z, x);
      const radius = Math.hypot(x, z);
      if (radius < 1e-5) {
        pos.setXYZ(i, x, y, z);
        continue;
      }
      const ht = THREE.MathUtils.clamp((y + half) / this.baseHeight, 0, 1);
      const wave =
        Math.sin(angle * this.freqA + elapsed * this.speedA + this.phase) * 0.55 +
        Math.sin(angle * this.freqB - elapsed * this.speedB + this.phase * 1.7) * 0.3 +
        Math.sin(ht * this.freqC * Math.PI + elapsed * this.speedC) * 0.25;
      const r = radius * (1 + wave * amount);
      pos.setXYZ(i, (x / radius) * r, y, (z / radius) * r);
    }
    pos.needsUpdate = true;
    if (amount > 0.001) this.mesh.geometry.computeVertexNormals();
  }
}

class Decal {
  constructor(textures) {
    this.group = new THREE.Group();
    this.group.name = 'TyphoonDecal';
    this.group.visible = false;
    this.active = false;
    this.origin = new THREE.Vector3();
    this.layers = DECAL_LAYER_SOURCE.map((source, index) => {
      const material = createDecalMaterial(
        textures,
        source.spinMul * DECAL_DEFAULTS.flow,
        source.distortion,
        0,
        source.edgeMotion != null ? source.edgeMotion : DECAL_DEFAULTS.flow * source.edgeMul,
        DECAL_DEFAULTS.colors[index]
      );
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = source.y;
      mesh.scale.setScalar(source.scale);
      mesh.renderOrder = index;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return { source, material, mesh };
    });
  }

  spawn(origin, rotationY, decalCfg) {
    this.active = true;
    this.origin.copy(origin);
    this.group.position.set(origin.x, origin.y, origin.z);
    this.group.rotation.y = rotationY;
    this.group.visible = true;
    this.applyLook(decalCfg);
    this.setOpacity(decalCfg.alphaMin);
  }

  destroy() {
    this.active = false;
    this.group.visible = false;
    this.layers.forEach((layer) => {
      layer.material.uniforms.uOpacity.value = 0;
    });
  }

  dispose() {
    this.destroy();
    this.layers.forEach((layer) => {
      layer.material.dispose();
      layer.mesh.geometry.dispose();
    });
  }

  applyLook(decalCfg) {
    const flow = decalCfg.flow;
    const distScale = decalCfg.distortion / DECAL_LAYER_SOURCE[0].distortion;
    const edgeScale = decalCfg.edgeMotion / DECAL_LAYER_SOURCE[0].edgeMotion;
    this.layers.forEach((layer, index) => {
      const source = layer.source;
      layer.material.uniforms.uSpin.value = source.spinMul * flow;
      layer.material.uniforms.uDistortion.value = source.distortion * distScale;
      layer.material.uniforms.uEdgeMotion.value =
        source.edgeMotion != null
          ? decalCfg.edgeMotion
          : flow * source.edgeMul * edgeScale;
      layer.material.uniforms.uColor.value.set(decalCfg.colors[index]);
    });
  }

  setOpacity(envelope) {
    const base = DECAL_LAYER_SOURCE[0].opacity;
    this.layers.forEach((layer) => {
      layer.material.uniforms.uOpacity.value = envelope * (layer.source.opacity / base);
    });
  }

  setRadius(radius) {
    this.group.scale.setScalar(Math.max(radius, 0.0001));
  }

  sync(wave, cfg, decalCfg, elapsed) {
    if (!this.active || !wave.active) return;

    const timing = phaseWindows(cfg);
    let opacity;
    if (wave.age < timing.startEnd) {
      const t = wave.age / timing.startDur;
      opacity = THREE.MathUtils.lerp(decalCfg.alphaMin, decalCfg.alphaMax, t);
    } else if (wave.age < timing.holdEnd) {
      opacity = decalCfg.alphaMax;
    } else {
      const t = (wave.age - timing.holdEnd) / timing.endDur;
      opacity = THREE.MathUtils.lerp(decalCfg.alphaMax, 0, t);
    }

    this.group.position.set(this.origin.x, this.origin.y, this.origin.z);
    this.group.rotation.y = wave.mesh.rotation.y;
    this.setRadius(wave.baseRadius * wave.mesh.scale.x * 1.25);
    this.applyLook(decalCfg);
    this.setOpacity(opacity);

    const time = elapsed % DECAL_LOOP;
    this.layers.forEach((layer) => {
      layer.material.uniforms.uTime.value = time;
    });
  }
}

export class TyphoonEffect {
  constructor(options = {}) {
    const publicOpts = resolvePublicOptions(options);
    this.textures = publicOpts.textures;
    this.config = {
      position: publicOpts.position,
      radius: publicOpts.radius,
      duration: publicOpts.duration,
      loop: publicOpts.loop,
    };

    this.shockwaveCfg = {
      ...SHOCKWAVE_DEFAULTS,
      spawnTornadoDuration: publicOpts.duration,
      loop: publicOpts.loop,
    };
    this.decalCfg = { ...DECAL_DEFAULTS, colors: [...DECAL_DEFAULTS.colors] };
    this.tunnelCfg = { ...TUNNEL_DEFAULTS };
    this.radii = {
      bottom: publicOpts.radius,
      top: DEFAULT_TOP_RADIUS * (publicOpts.radius / DEFAULT_BOTTOM_RADIUS),
    };

    this.object3D = new THREE.Group();
    this.object3D.name = 'TyphoonEffect';
    this.object3D.position.copy(this.config.position);

    this.wave = new Shockwave(this.textures);
    this.decal = new Decal(this.textures);
    this.tunnel = new WaterTunnel({
      noise: this.textures.tunnelNoise,
      waterNoise: this.textures.tunnelWaterNoise,
      foam: this.textures.tunnelFoam,
      waterMask: this.textures.tunnelWaterMask,
    });

    this.localOrigin = new THREE.Vector3();
    this.object3D.add(this.wave.mesh, this.decal.group, this.tunnel.group);

    this.elapsed = 0;
    this.restartDelay = 0;
    this.started = false;
    this.tunnelSpawned = false;
    this._finishedEmitted = false;
    this._events = new Emitter();
    this._splashScroll = 0;
  }

  on(name, fn) {
    return this._events.on(name, fn);
  }

  start() {
    this.spawnPair();
    this.started = true;
    return this;
  }

  spawnPair() {
    this._finishedEmitted = false;
    this.wave.spawn(this.shockwaveCfg, this.radii, this.localOrigin);
    this.decal.spawn(this.localOrigin, this.wave.mesh.rotation.y, this.decalCfg);
    this.decal.setRadius(this.wave.baseRadius * this.shockwaveCfg.scaleMin * 1.25);
    this.tunnel.reset();
    this.tunnelSpawned = false;
  }

  restart() {
    this.wave.destroy();
    this.decal.destroy();
    this.tunnel.reset();
    this.wave.finished = false;
    this.restartDelay = 0;
    this.started = false;
    this.tunnelSpawned = false;
    this.elapsed = 0;
    this._finishedEmitted = false;
  }

  tunnelRadius() {
    return Math.max(this.wave.baseRadius, 0.05) * 1.6;
  }

  syncTunnel(dt) {
    const timing = phaseWindows(this.shockwaveCfg);
    const inStart = this.wave.active && this.wave.age < timing.startEnd;
    const inSpawn = this.wave.active && this.wave.age >= timing.startEnd && this.wave.age < timing.holdEnd;
    const inEnd = (this.wave.active && this.wave.age >= timing.holdEnd) || (!this.wave.active && this.wave.finished);
    const driven = { ...this.tunnelCfg, radius: this.tunnelRadius() };

    if (inStart) return;

    if (inSpawn) {
      if (!this.tunnelSpawned) {
        this.tunnel.spawn(this.localOrigin, driven);
        this.tunnelSpawned = true;
      }
      this.tunnel.update(dt, driven);
      return;
    }

    if (inEnd && this.tunnelSpawned) {
      this.tunnel.beginDissipate();
      this.tunnel.update(dt, driven);
    }
  }

  update(dt) {
    if (!this.started) return;
    this.elapsed += dt;
    this._scrollSplash(dt);

    if (this.wave.active) {
      this.wave.update(dt, this.shockwaveCfg, this.elapsed);
    }

    if (this.wave.active) {
      this.decal.sync(this.wave, this.shockwaveCfg, this.decalCfg, this.elapsed);
    } else if (this.decal.active) {
      this.decal.destroy();
    }

    this.syncTunnel(dt);

    if (!this.wave.active && this.wave.finished && !this.tunnel.active) {
      if (this.shockwaveCfg.loop) {
        this.restartDelay += dt;
        if (this.restartDelay >= this.shockwaveCfg.loopDelay) {
          this.restartDelay = 0;
          this.spawnPair();
        }
      } else if (!this._finishedEmitted) {
        this._finishedEmitted = true;
        this._events.emit('finished', { time: this.elapsed });
      }
    }
  }

  _scrollSplash(dt) {
    const { splashAlpha, splashNormal, splashRoughness } = this.textures;
    this._splashScroll = (this._splashScroll + dt * 0.12) % 1;
    splashAlpha.offset.x = this._splashScroll;
    splashNormal.offset.x = this._splashScroll;
    splashRoughness.offset.x = this._splashScroll;
  }

  dispose() {
    this.wave.dispose();
    this.decal.dispose();
    this.tunnel.destroy();
    this.tunnel.material?.dispose();
    this.tunnel.mesh?.geometry?.dispose();
    this.object3D.removeFromParent();
    this._events.clear();
  }
}

/**
 * Spawn a Typhoon in the scene.
 * Public options: position, duration (spawn tornado hold), radius (shockwave base radius).
 */
export async function createTyphoon(scene, options = {}) {
  const textures = options.textures ?? await loadTyphoonTextures();
  const effect = new TyphoonEffect({
    ...options,
    textures,
    position: options.position ?? new THREE.Vector3(0, 0, 0),
  });
  scene.add(effect.object3D);
  effect.start();
  return effect;
}

export { loadTyphoonTextures, getTyphoonTextures, disposeTyphoonTextures };

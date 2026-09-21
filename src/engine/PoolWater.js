import * as THREE from 'three';

const waterCausticsUrl = new URL('../assets/textures/water-caustics.png', import.meta.url).href;
const POOL_WATER_DEBUG = false;
const MAX_REFLECTED_CLOUDS = 10;
const WATER_QUALITY_VARIANTS = Object.freeze({
  low: 'LOW', medium: 'MEDIUM', high: 'FULL', ultra: 'FULL',
});

const POOL_WATER_DEFAULTS = Object.freeze({
  largeWaveHeight: 0.035, largeWaveFrequency: 0.8, largeWaveSpeed: 0.8,
  mediumWaveHeight: 0.042, mediumWaveFrequency: 1.65, mediumWaveSpeed: 1.00,
  microRippleStrength: 0.08, microRippleFrequency: 0.91, microRippleSpeed: 2.0,
  waveWarpStrength: 0.5, fresnelStrength: 0.25, fresnelPower: 5.0,
  slopeLightStrength: 1.4, slopeDarkeningStrength: 1.0, sunlitWaveStrength: 0.105,
  softSpecularStrength: 0.59, sharpGlintStrength: 1.2, specularSharpness: 74,
  crestHighlightStrength: 0.38, shallowAlpha: 0.08, deepAlpha: 0.98,
  skyReflectionStrength: 0, skyHorizonInfluence: 0.8, skyTopInfluence: 0.7,
  cloudReflectionStrength: 0.88,
  sunReflectionStrength: 17.2, sunReflectionWidth: 0, sunReflectionLength: 0.73,
  sunGlintWarmth: 0,
  shallowAquaStrength: 0.145, deepBlueStrength: 1.0,
  depthTransitionWidth: 0.86, depthTransitionBias: 0.05,
  causticStrength: 1.0, causticScale: 0.6, causticSpeed: 1.0, causticWarp: 1.0,
  causticShallowFalloff: 0.16, causticDeepAttenuation: 0.025,
  rockRippleStrength: 0.15, rippleWidth: 0.006, rippleExpansionSpeed: 0.06,
});

const POOL_WATER_CONTROLS = [
  ['Waves', 'largeWaveHeight', 'Large Wave Height', 0, 0.035, 0.001],
  ['Waves', 'largeWaveFrequency', 'Large Wave Frequency', 0.15, 0.8, 0.01],
  ['Waves', 'largeWaveSpeed', 'Large Wave Speed', 0, 0.8, 0.01],
  ['Waves', 'mediumWaveHeight', 'Medium Wave Height', 0, 0.075, 0.001],
  ['Waves', 'mediumWaveFrequency', 'Medium Wave Frequency', 0.8, 2.8, 0.01],
  ['Waves', 'mediumWaveSpeed', 'Medium Wave Speed', 0.2, 2.0, 0.01],
  ['Waves', 'microRippleStrength', 'Micro Ripple Strength', 0, 0.08, 0.001],
  ['Waves', 'microRippleFrequency', 'Micro Ripple Frequency', 0.5, 1.8, 0.01],
  ['Waves', 'microRippleSpeed', 'Micro Ripple Speed', 0.2, 2.0, 0.01],
  ['Waves', 'waveWarpStrength', 'Wave Warp Strength', 0, 0.5, 0.01],
  ['Lighting', 'fresnelStrength', 'Fresnel Strength', 0, 0.25, 0.005],
  ['Lighting', 'fresnelPower', 'Fresnel Power', 1, 5, 0.05],
  ['Lighting', 'slopeLightStrength', 'Slope Light Strength', 0, 1.4, 0.02],
  ['Lighting', 'slopeDarkeningStrength', 'Slope Darkening', 0, 1.0, 0.02],
  ['Lighting', 'sunlitWaveStrength', 'Sunlit Wave Strength', 0, 0.25, 0.005],
  ['Lighting', 'softSpecularStrength', 'Soft Specular', 0, 0.7, 0.01],
  ['Lighting', 'sharpGlintStrength', 'Sharp Glint', 0, 1.2, 0.02],
  ['Lighting', 'specularSharpness', 'Specular Sharpness', 24, 128, 1],
  ['Lighting', 'crestHighlightStrength', 'Crest Highlight', 0, 0.5, 0.01],
  ['Reflection', 'skyReflectionStrength', 'Sky Reflection Strength', 0, 0.4, 0.01],
  ['Reflection', 'skyHorizonInfluence', 'Sky Horizon Influence', 0, 1.5, 0.02],
  ['Reflection', 'skyTopInfluence', 'Sky Top Influence', 0, 1.5, 0.02],
  ['Reflection', 'cloudReflectionStrength', 'Cloud Reflection Strength', 0, 2, 0.01],
  ['Reflection', 'sunReflectionStrength', 'Sun Reflection Strength', 0, 100, 0.1],
  ['Reflection', 'sunReflectionWidth', 'Sun Reflection Width', 0, 1, 0.01],
  ['Reflection', 'sunReflectionLength', 'Sun Reflection Length', 0, 1, 0.01],
  ['Reflection', 'sunGlintWarmth', 'Sun Glint Warmth', 0, 1, 0.02],
  ['Color', 'shallowAlpha', 'Shallow Alpha', 0.08, 0.45, 0.01],
  ['Color', 'deepAlpha', 'Deep Alpha', 0.55, 0.98, 0.01],
  ['Color', 'shallowAquaStrength', 'Shallow Aqua', 0, 0.18, 0.005],
  ['Color', 'deepBlueStrength', 'Deep Blue', 0.5, 1.0, 0.01],
  ['Color', 'depthTransitionWidth', 'Depth Transition Width', 0.10, 0.90, 0.01],
  ['Color', 'depthTransitionBias', 'Depth Transition Bias', 0.05, 0.50, 0.01],
  ['Caustics', 'causticStrength', 'Caustic Strength', 0, 2, 0.02],
  ['Caustics', 'causticScale', 'Caustic Scale', 0.6, 1.5, 0.01],
  ['Caustics', 'causticSpeed', 'Caustic Speed', 0, 2, 0.02],
  ['Caustics', 'causticWarp', 'Caustic Warp', 0, 2, 0.02],
  ['Caustics', 'causticShallowFalloff', 'Caustic Shallow Falloff', 0.05, 0.4, 0.01],
  ['Caustics', 'causticDeepAttenuation', 'Caustic Deep Attenuation', 0, 0.15, 0.005],
  ['Rock ripples', 'rockRippleStrength', 'Rock Ripple Strength', 0, 0.5, 0.01],
  ['Rock ripples', 'rippleWidth', 'Ripple Width', 0.002, 0.014, 0.001],
  ['Rock ripples', 'rippleExpansionSpeed', 'Ripple Expansion Speed', 0.01, 0.1, 0.005],
];

export class PoolWater {
  constructor({
    createMesh, centerX, centerZ, width, depth, surfaceY,
    sunlight = null, skyReflection = true, cloudReflection = null,
    caustics = true, rippleCenters = [],
    quality = 'high',
    debug = POOL_WATER_DEBUG,
  }) {
    this.debug = debug;
    this.quality = WATER_QUALITY_VARIANTS[quality] ? quality : 'high';
    this.qualityVariant = WATER_QUALITY_VARIANTS[this.quality];
    const rippleSeeds = [0.3, 1.7, 2.8];
    const buildRippleCalls = (centers) => centers.map(([x, z], index) => {
      const u = (x / (width - 0.3) + 0.5).toFixed(3);
      const v = (-z / (depth - 0.3) + 0.5).toFixed(3);
      const seed = rippleSeeds[index] ?? (0.3 + index * 1.1);
      return `rockRipples(vUv, vec2(${u}, ${v}), ${seed.toFixed(3)})`;
    }).join('\n            + ') || '0.0';
    const rippleCalls = buildRippleCalls(rippleCenters);
    const mediumRippleCalls = buildRippleCalls(rippleCenters.slice(0, 2));

    const sunlightPosition = sunlight?.position;
    const sunlightEnabled = sunlightPosition ? 1 : 0;
    const sunReflectionEnabled = sunlightPosition && sunlight.reflection !== false ? 1 : 0;
    const sunWaveLightingEnabled = sunlightPosition && sunlight.waveLighting !== false ? 1 : 0;
    const waterWidth = width - 0.3;
    const waterDepth = depth - 0.3;
    const cloudReflectionEnabled = !!cloudReflection && cloudReflection.enabled !== false;
    const suppliedClouds = cloudReflectionEnabled ? cloudReflection.clouds ?? [] : [];
    const reflectedClouds = suppliedClouds.slice(0, MAX_REFLECTED_CLOUDS);
    const cloudData = Array.from({ length: MAX_REFLECTED_CLOUDS }, () => new THREE.Vector4());
    const cloudOrientations = Array.from({ length: MAX_REFLECTED_CLOUDS }, () => new THREE.Vector2(1, 0));
    reflectedClouds.forEach(({ position, scale = 1, angle = 0, orientation }, index) => {
      cloudData[index].set(position[0], position[1], position[2], scale);
      if (orientation) cloudOrientations[index].set(orientation[0], orientation[1]);
      else cloudOrientations[index].set(Math.cos(angle), -Math.sin(angle));
    });
    this.cloudDescriptors = suppliedClouds;

    this.waterGeometry = new THREE.PlaneGeometry(waterWidth, waterDepth, 32, 24);
    this.waterCausticsTexture = new THREE.Texture();
    this.waterCausticsTexture.wrapS = this.waterCausticsTexture.wrapT = THREE.RepeatWrapping;
    this.waterCausticsTexture.minFilter = THREE.LinearFilter;
    this.waterCausticsTexture.magFilter = THREE.LinearFilter;
    this.waterCausticsTexture.generateMipmaps = false;
    if (typeof Image !== 'undefined') {
      const texture = this.waterCausticsTexture;
      const image = new Image();
      image.onload = () => {
        if (this.waterCausticsTexture !== texture) return;
        texture.image = image;
        texture.needsUpdate = true;
      };
      image.src = waterCausticsUrl;
    }
    this.waterMaterial = new THREE.ShaderMaterial({
      defines: { [`WATER_QUALITY_${this.qualityVariant}`]: 1 },
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 }, causticsMap: { value: this.waterCausticsTexture }, debugView: { value: 0 },
        ...Object.fromEntries(Object.entries(POOL_WATER_DEFAULTS).map(([key, value]) => [key, { value }])),
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        cameraWorldMatrix: { value: new THREE.Matrix4() },
        waterViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
        waterCenter: { value: new THREE.Vector2(centerX, centerZ) },
        waterSize: { value: new THREE.Vector2(waterWidth, waterDepth) },
        waterSurfaceY: { value: surfaceY },
        sunlightEnabled: { value: sunlightEnabled },
        sunReflectionEnabled: { value: sunReflectionEnabled },
        sunWaveLightingEnabled: { value: sunWaveLightingEnabled },
        skyReflectionEnabled: { value: skyReflection ? 1 : 0 },
        cloudReflectionEnabled: { value: cloudReflectionEnabled ? 1 : 0 },
        cloudCount: { value: reflectedClouds.length },
        cloudData: { value: cloudData },
        cloudOrientations: { value: cloudOrientations },
        causticsEnabled: { value: caustics ? 1 : 0 },
        sunWorldPosition: { value: sunlightPosition ?? new THREE.Vector3() },
      },
      vertexShader: `
        uniform float time;
        uniform float largeWaveHeight, largeWaveFrequency, largeWaveSpeed;
        uniform float mediumWaveHeight, mediumWaveFrequency, mediumWaveSpeed, waveWarpStrength;
        varying vec2 vUv;
        varying float vSurface;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vec3 p = position;
          vec2 directionA = normalize(vec2(0.86, 0.51));
          vec2 directionB = normalize(vec2(-0.62, 0.78));
          vec2 directionC = normalize(vec2(0.50, -0.87));
          float phaseA = dot(p.xy, directionA) * largeWaveFrequency + time * largeWaveSpeed;
          vec2 bendDirection = normalize(vec2(0.73, 0.29));
          float bendPhase = dot(p.xy, bendDirection) * 0.38 + time * 0.21;
          float phaseB = dot(p.xy, directionB) * mediumWaveFrequency - time * mediumWaveSpeed
            + sin(bendPhase) * waveWarpStrength;
          float phaseC = dot(p.xy, directionC) * 2.55 + time * 1.55;
          float waveA = sin(phaseA) * largeWaveHeight;
          float waveB = (sin(phaseB) + sin(phaseB * 2.0) * 0.16) * mediumWaveHeight;
          float waveC = sin(phaseC) * 0.013;
          vSurface = waveA + waveB + waveC;
          p.z += vSurface;
          vec2 phaseBGradient = directionB * mediumWaveFrequency
            + bendDirection * cos(bendPhase) * 0.38 * waveWarpStrength;
          vec2 gradient = directionA * cos(phaseA) * largeWaveHeight * largeWaveFrequency
            + phaseBGradient * (cos(phaseB) + cos(phaseB * 2.0) * 0.32) * mediumWaveHeight
            + directionC * cos(phaseC) * 0.03315;
          vec3 waveNormal = normalize(vec3(-gradient.x, -gradient.y, 1.0));
          vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * waveNormal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform sampler2D causticsMap;
        uniform int debugView;
        uniform mat4 inverseProjectionMatrix, cameraWorldMatrix;
        uniform vec4 waterViewport;
        uniform vec2 waterCenter, waterSize;
        uniform float waterSurfaceY;
        uniform float sunlightEnabled, sunReflectionEnabled, sunWaveLightingEnabled;
        uniform float skyReflectionEnabled, cloudReflectionEnabled, causticsEnabled;
        uniform int cloudCount;
        uniform vec4 cloudData[${MAX_REFLECTED_CLOUDS}];
        uniform vec2 cloudOrientations[${MAX_REFLECTED_CLOUDS}];
        uniform vec3 sunWorldPosition;
        uniform float largeWaveHeight, largeWaveFrequency, largeWaveSpeed;
        uniform float mediumWaveHeight, mediumWaveFrequency, mediumWaveSpeed, waveWarpStrength;
        uniform float microRippleStrength, microRippleFrequency, microRippleSpeed;
        uniform float fresnelStrength, fresnelPower, slopeLightStrength, slopeDarkeningStrength;
        uniform float sunlitWaveStrength;
        uniform float softSpecularStrength, sharpGlintStrength, specularSharpness, crestHighlightStrength;
        uniform float skyReflectionStrength, skyHorizonInfluence, skyTopInfluence;
        uniform float cloudReflectionStrength;
        uniform float sunReflectionStrength, sunReflectionWidth, sunReflectionLength, sunGlintWarmth;
        uniform float shallowAlpha, deepAlpha, shallowAquaStrength, deepBlueStrength;
        uniform float depthTransitionWidth, depthTransitionBias;
        uniform float causticStrength, causticScale, causticSpeed, causticWarp;
        uniform float causticShallowFalloff, causticDeepAttenuation;
        uniform float rockRippleStrength, rippleWidth, rippleExpansionSpeed;
        varying vec2 vUv;
        varying float vSurface;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        #if !defined(WATER_QUALITY_LOW)
        float rockRipples(vec2 uv, vec2 center, float seed) {
          vec2 offset = (uv - center) * vec2(waterSize.x / waterSize.y, 1.0);
          float angle = atan(offset.y, offset.x);
          float radius = length(offset) + sin(angle * 5.0 + time * 0.43 + seed) * 0.0035;
          float rings = 0.0;
          for (int i = 0; i < 3; i++) {
            float phase = fract(time * rippleExpansionSpeed + seed * 0.17 + float(i) / 3.0);
            float ringRadius = 0.018 + phase * 0.105;
            rings += (1.0 - smoothstep(rippleWidth * 0.4, rippleWidth * 1.4, abs(radius - ringRadius))) * (1.0 - phase);
          }
          return rings * (1.0 - smoothstep(0.07, 0.14, radius));
        }
        #endif
        void main() {
          vec2 waterAspect = vec2(waterSize.x / waterSize.y, 1.0);
          vec2 p = (vUv - 0.5) * waterAspect;
          vec2 warp = vec2(
            sin(dot(p, vec2(8.0, 5.0)) + sin(time * 0.31) + time * 0.23),
            sin(dot(p, vec2(-5.0, 9.0)) + cos(time * 0.27) - time * 0.19)
          ) * 0.065;
          vec2 q = abs(vUv * 2.0 - 1.0);
          float roundedEdge = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);
          float depthWarp = sin(dot(p, vec2(3.7, -2.9)) + time * 0.08) * 0.014
            + cos(dot(p, vec2(-2.1, 4.3)) - time * 0.06) * 0.010;
          float depthShape = (1.0 - roundedEdge) + (warp.x + warp.y) * 0.035 + depthWarp;
          float depth = smoothstep(depthTransitionBias - depthTransitionWidth * 0.5,
            depthTransitionBias + depthTransitionWidth * 0.5, depthShape);
          #if !defined(WATER_QUALITY_LOW)
          vec2 screenUv = (gl_FragCoord.xy - waterViewport.xy) / waterViewport.zw;
          vec4 viewRay = inverseProjectionMatrix * vec4(screenUv * 2.0 - 1.0, 1.0, 1.0);
          vec3 rayDirection = normalize((cameraWorldMatrix * vec4(viewRay.xyz / viewRay.w, 0.0)).xyz);
          float rayPlaneDistance = (waterSurfaceY - cameraPosition.y) / rayDirection.y;
          vec3 planarWorldPosition = cameraPosition + rayDirection * rayPlaneDistance;
          vec2 planarUv = vec2((planarWorldPosition.x - waterCenter.x) / waterSize.x + 0.5,
            -(planarWorldPosition.z - waterCenter.y) / waterSize.y + 0.5);
          vec2 causticP = (planarUv - 0.5) * waterAspect;
          vec2 causticDomainWarp = vec2(
            sin(dot(causticP, vec2(7.3, 4.7)) + time * 0.19),
            cos(dot(causticP, vec2(-4.4, 8.1)) - time * 0.16)
          ) * 0.065 * causticWarp;
          mat2 causticTurnA = mat2(0.96, -0.28, 0.28, 0.96);
          vec2 cellsUv = causticTurnA * ((planarUv - 0.5) * vec2(6.83, 5.07) * causticScale)
            + 7.0 + causticDomainWarp * 0.48
            + vec2(time * 0.012, -time * 0.009) * causticSpeed;
          float textureA = texture2D(causticsMap, cellsUv).r;
          float softA = smoothstep(0.27, 0.67, textureA);
          float coreA = smoothstep(0.58, 0.88, textureA);
          #if defined(WATER_QUALITY_FULL)
          mat2 causticTurnB = mat2(0.79, -0.61, 0.61, 0.79);
          vec2 fineUv = causticTurnB * ((planarUv - 0.5) * vec2(10.27, 7.19) * causticScale)
            + 12.0 + causticDomainWarp.yx * 0.62
            + vec2(-time * 0.010, time * 0.014) * causticSpeed;
          float textureB = texture2D(causticsMap, fineUv).r;
          float softB = smoothstep(0.31, 0.72, textureB);
          float coreB = smoothstep(0.64, 0.91, textureB);
          float primary = clamp(softA * 0.76 + softB * 0.20, 0.0, 1.0);
          float secondary = coreA * 0.68 + coreB * 0.24;
          float focus = coreA * coreB;
          #else
          float primary = softA * 0.96;
          float secondary = coreA * 0.82;
          float focus = coreA * coreA * 0.45;
          #endif
          float causticDepth = mix(1.0, causticDeepAttenuation,
            smoothstep(causticShallowFalloff, 0.96, depth));
          primary *= causticDepth;
          secondary *= causticDepth * 0.38;
          focus *= causticDepth;
          float shimmer = smoothstep(0.72, 0.98, sin(dot(p + warp, vec2(21.0, -17.0)) + time * 0.43) * 0.5 + 0.5);
          #else
          float primary = 0.0, secondary = 0.0, focus = 0.0, shimmer = 0.0;
          #endif
          #if !defined(WATER_QUALITY_LOW)
          float rippleWarpA = sin(dot(vUv, vec2(15.0, -11.0)) - time * 0.33)
            + sin(dot(vUv, vec2(-7.0, 19.0)) + time * 0.21) * 0.55;
          float ripplePhaseA = dot(vUv, vec2(121.0, 37.0) * microRippleFrequency)
            + time * 2.05 * microRippleSpeed + rippleWarpA * 1.35;
          #if defined(WATER_QUALITY_FULL)
          float rippleWarpB = cos(dot(vUv, vec2(12.0, 17.0)) + time * 0.27)
            + sin(dot(vUv, vec2(21.0, -6.0)) - time * 0.18) * 0.48;
          float ripplePhaseB = dot(vUv, vec2(-43.0, 137.0) * microRippleFrequency)
            - time * 1.72 * microRippleSpeed + rippleWarpB * 1.20;
          #endif
          #endif
          #if defined(WATER_QUALITY_LOW)
          vec3 analyticalNormal = normalize(vWorldNormal);
          #else
          vec2 waterPosition = (vUv - 0.5) * waterSize;
          vec2 directionA = normalize(vec2(0.86, 0.51));
          vec2 directionB = normalize(vec2(-0.62, 0.78));
          vec2 directionC = normalize(vec2(0.50, -0.87));
          vec2 bendDirection = normalize(vec2(0.73, 0.29));
          float largePhase = dot(waterPosition, directionA) * largeWaveFrequency + time * largeWaveSpeed;
          float bendPhase = dot(waterPosition, bendDirection) * 0.38 + time * 0.21;
          float mediumPhase = dot(waterPosition, directionB) * mediumWaveFrequency - time * mediumWaveSpeed
            + sin(bendPhase) * waveWarpStrength;
          float smallPhase = dot(waterPosition, directionC) * 2.55 + time * 1.55;
          vec2 mediumGradient = directionB * mediumWaveFrequency
            + bendDirection * cos(bendPhase) * 0.38 * waveWarpStrength;
          vec2 waveGradient = directionA * cos(largePhase) * largeWaveHeight * largeWaveFrequency
            + mediumGradient * (cos(mediumPhase) + cos(mediumPhase * 2.0) * 0.32) * mediumWaveHeight
            + directionC * cos(smallPhase) * 0.03315;
          vec3 analyticalNormal = normalize(vec3(-waveGradient.x, 1.0, waveGradient.y));
          #endif
          #if defined(WATER_QUALITY_LOW)
          vec3 surfaceNormal = analyticalNormal;
          #elif defined(WATER_QUALITY_MEDIUM)
          vec3 surfaceNormal = normalize(analyticalNormal + vec3(
            cos(ripplePhaseA) * microRippleStrength,
            0.0,
            cos(ripplePhaseA) * 0.55 * microRippleStrength
          ));
          #else
          vec3 surfaceNormal = normalize(analyticalNormal + vec3(
            (cos(ripplePhaseA) + cos(ripplePhaseB) * 0.625) * microRippleStrength,
            0.0,
            (cos(ripplePhaseA) * 0.55 - cos(ripplePhaseB) * 0.95) * microRippleStrength
          ));
          #endif
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float downwardView = clamp(dot(surfaceNormal, viewDirection), 0.0, 1.0);
          float fresnel = pow(1.0 - downwardView, fresnelPower);
          #if !defined(WATER_QUALITY_LOW)
          float causticVisibility = mix(0.10, 1.0, pow(downwardView, 0.72));
          #endif
          float deepVariation = sin(dot(p, vec2(4.1, -2.7)) + time * 0.10) * 0.032
            + cos(dot(p, vec2(-3.3, 3.8)) - time * 0.07) * 0.023;
          float colorDepth = clamp(depth + deepVariation * smoothstep(0.10, 0.88, depth), 0.0, 1.0);
          vec3 shallow = vec3(0.03, 0.83, 0.80);
          vec3 middle = vec3(0.00, 0.66, 0.84);
          vec3 deep = vec3(0.018, 0.245, 0.58);
          vec3 color = mix(shallow, middle, smoothstep(0.02, 0.76, colorDepth));
          color = mix(color, deep, smoothstep(0.62, 1.0, colorDepth) * deepBlueStrength * 0.90);
          #if defined(WATER_QUALITY_LOW)
          vec3 causticLight = vec3(0.0);
          #else
          float shallowCaustics = mix(1.45, 0.62, smoothstep(0.06, 0.70, depth));
          float causticVisibilityStrength = causticVisibility * shallowCaustics;
          float cellInterior = (1.0 - smoothstep(0.24, 0.48, textureA))
            * (1.0 - smoothstep(0.28, 0.82, depth)) * causticVisibility * causticsEnabled;
          color *= 1.0 - cellInterior * 0.12;
          vec3 causticLight = vec3(0.48, 0.88, 0.78) * primary * 0.105;
          causticLight += vec3(0.96, 0.91, 0.72) * secondary * 0.16;
          causticLight += vec3(1.00, 0.97, 0.86) * focus * 0.28;
          causticLight *= causticVisibilityStrength * causticStrength * causticsEnabled;
          #endif
          #if defined(WATER_QUALITY_MEDIUM)
          float ripples = ${mediumRippleCalls};
          color += vec3(0.62, 0.96, 1.0) * ripples * rockRippleStrength;
          color += vec3(0.30, 0.84, 0.92) * smoothstep(0.08, 0.48, ripples) * 0.08;
          #elif defined(WATER_QUALITY_FULL)
          float ripples = ${rippleCalls};
          color += vec3(0.62, 0.96, 1.0) * ripples * rockRippleStrength;
          color += vec3(0.30, 0.84, 0.92) * smoothstep(0.08, 0.48, ripples) * 0.08;
          #endif
          vec3 sunOffset = sunWorldPosition - vWorldPosition;
          float sunDistance = length(sunOffset);
          vec3 sunDirection = sunlightEnabled > 0.5 && sunDistance > 0.0001
            ? sunOffset / sunDistance : vec3(0.0, 1.0, 0.0);
          float sunFacing = dot(surfaceNormal, sunDirection);
          float flatSunFacing = max(sunDirection.y, 0.0);
          float sunlitWave = smoothstep(flatSunFacing + 0.01, flatSunFacing + 0.075,
            max(dot(analyticalNormal, sunDirection), 0.0));
          float broadReflectedSun = max(dot(reflect(-sunDirection, analyticalNormal), viewDirection), 0.0);
          float slopeLight = dot(surfaceNormal, normalize(vec3(-0.68, 0.0, 0.73)));
          float crestLight = smoothstep(0.022, 0.052, vSurface);
          float broadShine = 0.5 + 0.5 * sin(dot(p + warp * 0.4, vec2(5.0, -3.0)) + time * 0.22);
          #if defined(WATER_QUALITY_FULL)
          float reflectedSun = max(dot(reflect(-sunDirection, surfaceNormal), viewDirection), 0.0);
          float focusedSunResponse = pow(broadReflectedSun, mix(14.0, 3.0, sunReflectionWidth));
          float extendedSunResponse = pow(broadReflectedSun, mix(8.0, 1.5, sunReflectionLength));
          float macroSunReflection = mix(focusedSunResponse,
            max(focusedSunResponse, extendedSunResponse * 0.65), sunReflectionLength);
          float waveHighlight = pow(smoothstep(0.42, 0.88, reflectedSun), 1.6);
          float sunGlint = pow(reflectedSun, specularSharpness);
          float streakBands = sin(dot(vUv, vec2(83.0, -29.0)) + time * 1.08 + warp.x * 17.0);
          streakBands += sin(dot(vUv, vec2(-47.0, 96.0)) - time * 0.73 + warp.y * 13.0) * 0.65;
          float patchField = sin(dot(vUv, vec2(39.0, 57.0)) - time * 0.46 + rippleWarpA);
          patchField *= cos(dot(vUv, vec2(-61.0, 31.0)) + time * 0.38 + rippleWarpB);
          float patchMask = smoothstep(-0.18, 0.64, patchField);
          float rippleClusters = smoothstep(-0.18, 0.82,
            cos(ripplePhaseA) * 0.62 + cos(ripplePhaseB) * 0.38);
          float streakBreakup = smoothstep(0.27, 1.08, streakBands) * patchMask
            * (0.32 + rippleClusters * 0.68) * (0.45 + shimmer * 0.55);
          float grazingShine = 0.18 + fresnel * 0.82;
          float waveGatedSunReflection = macroSunReflection * waveHighlight * streakBreakup;
          float softHighlight = waveGatedSunReflection
            * (0.45 + fresnel * 0.55);
          float sharpHighlight = macroSunReflection * sunGlint * smoothstep(0.58, 0.94, rippleClusters)
            * smoothstep(0.48, 0.86, patchMask) * grazingShine;
          #else
          vec3 simpleSunNormal = normalize(analyticalNormal);
          vec3 simpleSunDirection = normalize(sunDirection);
          vec3 simpleViewDirection = normalize(viewDirection);
          float simpleSunFacing = max(dot(simpleSunNormal, simpleSunDirection), 0.0);
          vec3 simpleReflectedSun = normalize(reflect(-simpleSunDirection, simpleSunNormal));
          float simpleSunAlignment = clamp(dot(simpleReflectedSun, simpleViewDirection), 0.0, 1.0);
          float primarySunLobe = pow(simpleSunAlignment, mix(14.0, 3.0, sunReflectionWidth));
          float macroSunReflection = primarySunLobe
            * smoothstep(0.0, 0.08, simpleSunFacing)
            * 0.01744;
          float patchMask = 1.0;
          float streakBreakup = 1.0;
          float grazingShine = 0.18 + fresnel * 0.82;
          float waveGatedSunReflection = macroSunReflection;
          float softHighlight = macroSunReflection * (0.45 + fresnel * 0.55);
          float sharpHighlight = 0.0;
          #endif
          vec3 skyReflectionDirection = reflect(-viewDirection, surfaceNormal);
          float reflectedSkyHeight = smoothstep(0.04, 0.82, clamp(skyReflectionDirection.y, 0.0, 1.0));
          vec3 skyHorizonColor = vec3(0.333, 0.722, 0.949) * skyHorizonInfluence;
          vec3 skyTopColor = vec3(0.086, 0.518, 0.875) * skyTopInfluence;
          vec3 reflectedSkyColor = mix(skyHorizonColor, skyTopColor, reflectedSkyHeight);
          float reflectedCloudMask = 0.0;
          #if defined(WATER_QUALITY_MEDIUM)
          for (int i = 0; i < 3; i++) {
            if (i >= cloudCount) break;
            vec3 cloudOffset = cloudData[i].xyz - vWorldPosition;
            float inverseCloudDistance = inversesqrt(max(dot(cloudOffset, cloudOffset), 0.0001));
            vec3 cloudDirection = cloudOffset * inverseCloudDistance;
            vec3 cloudHorizontal = vec3(cloudOrientations[i].x, 0.0, cloudOrientations[i].y);
            vec3 cloudVertical = normalize(cross(cloudHorizontal, cloudDirection));
            vec2 angularSize = max(cloudData[i].w * vec2(8.0, 4.0) * inverseCloudDistance,
              vec2(0.004));
            vec2 angularOffset = vec2(dot(skyReflectionDirection, cloudHorizontal),
              dot(skyReflectionDirection, cloudVertical)) / angularSize;
            vec2 bodyCoord = angularOffset * vec2(0.92, 1.45);
            float bodyMask = 1.0 - smoothstep(0.42, 1.0, dot(bodyCoord, bodyCoord));
            float centerAlignment = dot(skyReflectionDirection, cloudDirection);
            float cloudMask = bodyMask * smoothstep(0.95, 0.995, centerAlignment);
            reflectedCloudMask = max(reflectedCloudMask, cloudMask);
          }
          #elif defined(WATER_QUALITY_FULL)
          for (int i = 0; i < ${MAX_REFLECTED_CLOUDS}; i++) {
            if (i >= cloudCount) break;
            vec3 cloudOffset = cloudData[i].xyz - vWorldPosition;
            float inverseCloudDistance = inversesqrt(max(dot(cloudOffset, cloudOffset), 0.0001));
            vec3 cloudDirection = cloudOffset * inverseCloudDistance;
            vec3 cloudHorizontal = vec3(cloudOrientations[i].x, 0.0, cloudOrientations[i].y);
            vec3 cloudVertical = normalize(cross(cloudHorizontal, cloudDirection));
            vec2 angularSize = max(cloudData[i].w * vec2(8.0, 4.0) * inverseCloudDistance,
              vec2(0.004));
            vec2 angularOffset = vec2(dot(skyReflectionDirection, cloudHorizontal),
              dot(skyReflectionDirection, cloudVertical)) / angularSize;
            vec2 bodyCoord = angularOffset * vec2(0.92, 1.45);
            vec2 leftCoord = (angularOffset - vec2(-0.38, -0.34)) * vec2(1.48, 0.94);
            vec2 rightCoord = (angularOffset - vec2(0.38, -0.30)) * vec2(1.52, 0.98);
            float bodyMask = 1.0 - smoothstep(0.42, 1.0, dot(bodyCoord, bodyCoord));
            float leftMask = 1.0 - smoothstep(0.42, 1.0, dot(leftCoord, leftCoord));
            float rightMask = 1.0 - smoothstep(0.42, 1.0, dot(rightCoord, rightCoord));
            float centerAlignment = dot(skyReflectionDirection, cloudDirection);
            float cloudMask = max(bodyMask, max(leftMask, rightMask))
              * smoothstep(0.95, 0.995, centerAlignment);
            reflectedCloudMask = max(reflectedCloudMask, cloudMask);
          }
          #endif
          float shoreline = 1.0 - smoothstep(0.012, 0.052, abs(1.0 - roundedEdge));
          #if defined(WATER_QUALITY_LOW)
          shoreline *= smoothstep(-0.55, 0.65, sin(dot(p, vec2(3.1, 2.7)) + time * 0.22));
          #else
          shoreline *= smoothstep(-0.55, 0.65, sin(cellsUv.x * 0.43 + cellsUv.y * 0.37 + time * 0.22));
          #endif
          float surfaceDetail = mix(0.68, 1.0, depth);
          float slopePatches = 0.28 + patchMask * 0.72;
          float litSlope = max(slopeLight, 0.0) * surfaceDetail * slopePatches;
          float darkSlope = max(-slopeLight, 0.0) * surfaceDetail * (0.45 + (1.0 - patchMask) * 0.55);
          float shallowSurface = (1.0 - smoothstep(0.10, 0.58, depth))
            * (0.30 + patchMask * 0.70) * (0.35 + max(slopeLight, 0.0) * 0.65);
          color *= 0.96 + max(sunFacing, 0.0) * 0.045 * sunWaveLightingEnabled
            + litSlope * slopeLightStrength - darkSlope * slopeDarkeningStrength;
          color = mix(color, color * vec3(0.76, 0.87, 0.99), clamp(darkSlope * 1.8, 0.0, 0.24));
          color += vec3(0.18, 0.76, 0.94) * litSlope * 0.54;
          color += vec3(0.08, 0.66, 0.72) * shallowSurface * shallowAquaStrength;
          color += vec3(0.72, 0.94, 1.00) * crestLight * streakBreakup * grazingShine
            * (0.05 + max(slopeLight, 0.0) * crestHighlightStrength);
          color += reflectedSkyColor * fresnel * skyReflectionStrength * skyReflectionEnabled
            * (0.65 + broadShine * 0.35);
          color += vec3(0.78, 0.88, 0.95) * reflectedCloudMask * fresnel
            * cloudReflectionStrength * cloudReflectionEnabled;
          vec3 sunlightColor = vec3(1.00, 0.953, 0.886);
          color += sunlightColor * sunlitWave * sunlitWaveStrength * sunWaveLightingEnabled;
          vec3 softSunColor = mix(vec3(0.62, 0.88, 1.00), sunlightColor, sunGlintWarmth);
          vec3 sharpSunColor = mix(vec3(1.00, 0.98, 0.90), sunlightColor, sunGlintWarmth);
          color += softSunColor * softHighlight * softSpecularStrength * sunReflectionStrength
            * sunReflectionEnabled;
          color += sharpSunColor * sharpHighlight * sharpGlintStrength * sunReflectionStrength
            * sunReflectionEnabled;
          color += vec3(0.30, 0.58, 0.74) * (0.04 + shimmer * (0.025 + fresnel * 0.08));
          color += vec3(0.46, 0.94, 0.96) * shoreline * 0.12;
          float alphaDepth = smoothstep(0.08, 0.96, colorDepth);
          float alpha = min(0.94, mix(shallowAlpha, deepAlpha, alphaDepth) + fresnel * fresnelStrength);
          alpha *= 1.0 - shoreline * 0.055;
          if (debugView == 1) { gl_FragColor = vec4(surfaceNormal * 0.5 + 0.5, 1.0); return; }
          if (debugView == 2) { gl_FragColor = vec4(vec3(clamp(primary + secondary + focus, 0.0, 1.0)), 1.0); return; }
          if (debugView == 3) { gl_FragColor = vec4(vec3(colorDepth), 1.0); return; }
          if (debugView == 4) {
            #if defined(WATER_QUALITY_FULL)
            gl_FragColor = vec4(fract(vec3(cellsUv.x, cellsUv.y, fineUv.x)), 1.0);
            #elif defined(WATER_QUALITY_MEDIUM)
            gl_FragColor = vec4(fract(vec3(cellsUv.x, cellsUv.y, cellsUv.x)), 1.0);
            #else
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            #endif
            return;
          }
          if (debugView == 5) { gl_FragColor = vec4(vec3(waveGatedSunReflection), 1.0); return; }
          if (debugView == 6) { gl_FragColor = vec4(vec3(max(softHighlight, sharpHighlight)), 1.0); return; }
          if (debugView == 7) { gl_FragColor = vec4(vec3(reflectedCloudMask), 1.0); return; }
          gl_FragColor = vec4(color * alpha + causticLight, alpha);
        }
      `,
    });
    this.waterMaterial.onBeforeRender = (renderer, _scene, camera) => {
      const uniforms = this.waterMaterial.uniforms;
      uniforms.inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      uniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
      renderer.getCurrentViewport(uniforms.waterViewport.value);
    };
    const water = createMesh(this.waterGeometry, this.waterMaterial, centerX, surfaceY, centerZ);
    water.rotation.x = -Math.PI / 2;
    water.name = 'waterSurface';
    water.castShadow = false;
    water.renderOrder = 1;
    this.object3D = water;
    this._createWaterDebugPanel();
  }

  _createWaterDebugPanel() {
    if (!this.debug || typeof document === 'undefined'
      || typeof document.getElementById !== 'function') return;
    const host = document.getElementById('viewport-pane');
    if (!host) return;
    this.waterDebugPanel?.remove();
    const panel = document.createElement('div');
    panel.dataset.poolWaterDebug = '';
    panel.style.cssText = 'position:absolute;right:10px;top:10px;z-index:10000;width:260px;max-height:calc(100% - 20px);overflow:auto;padding:8px;color:#def;font:11px/1.25 monospace;background:rgba(5,24,38,.88);border:1px solid rgba(130,225,255,.45);border-radius:6px;box-shadow:0 3px 16px #0018;pointer-events:auto;';
    panel.addEventListener('pointerdown', event => event.stopPropagation());
    panel.addEventListener('click', event => event.stopPropagation());
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-weight:bold;margin-bottom:6px;';
    header.textContent = 'Pool Water Debug';
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.textContent = '−';
    collapse.style.cssText = 'margin-left:8px;cursor:pointer;';
    header.appendChild(collapse);
    panel.appendChild(header);
    const contents = document.createElement('div');
    panel.appendChild(contents);
    collapse.addEventListener('click', () => {
      const collapsed = contents.hidden = !contents.hidden;
      collapse.textContent = collapsed ? '+' : '−';
      panel.style.width = collapsed ? 'auto' : '260px';
      header.firstChild.textContent = collapsed ? 'Water Debug' : 'Pool Water Debug';
    });

    const viewRow = document.createElement('label');
    viewRow.textContent = 'View: ';
    const view = document.createElement('select');
    for (const [label, value] of [['Final', 0], ['Surface Normal', 1], ['Caustics', 2], ['Depth', 3],
      ['Caustic UV', 4], ['Sun Reflection', 5], ['Sun Reflection Masked', 6], ['Cloud Mask', 7]]) {
      const option = document.createElement('option'); option.textContent = label; option.value = value; view.appendChild(option);
    }
    view.addEventListener('change', () => { this.waterMaterial.uniforms.debugView.value = Number(view.value); });
    viewRow.appendChild(view); contents.appendChild(viewRow);
    const pointerHint = document.createElement('span');
    pointerHint.textContent = 'P: toggle mouse / camera';
    pointerHint.style.cssText = 'float:right;color:#9bc7d4;';
    viewRow.appendChild(pointerHint);

    let group = '';
    const valueNodes = new Map();
    for (const [nextGroup, key, label, min, max, step] of POOL_WATER_CONTROLS) {
      if (nextGroup !== group) {
        group = nextGroup;
        const title = document.createElement('div'); title.textContent = group;
        title.style.cssText = 'margin-top:7px;color:#7de4ff;font-weight:bold;'; contents.appendChild(title);
      }
      const row = document.createElement('label');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 88px 44px;gap:4px;align-items:center;margin:2px 0;';
      const name = document.createElement('span'); name.textContent = label;
      const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step;
      input.value = POOL_WATER_DEFAULTS[key];
      const output = document.createElement('output'); output.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : 2);
      input.addEventListener('input', () => {
        const value = Number(input.value); this.waterMaterial.uniforms[key].value = value;
        output.textContent = value.toFixed(step < 0.01 ? 3 : 2);
      });
      row.append(name, input, output); contents.appendChild(row); valueNodes.set(key, [input, output, step]);
    }
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset Water Values';
    reset.addEventListener('click', () => {
      for (const [key, value] of Object.entries(POOL_WATER_DEFAULTS)) {
        this.waterMaterial.uniforms[key].value = value;
        const [input, output, step] = valueNodes.get(key); input.value = value; output.textContent = value.toFixed(step < 0.01 ? 3 : 2);
      }
    });
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy Values';
    copy.addEventListener('click', async () => {
      const values = Object.fromEntries(Object.keys(POOL_WATER_DEFAULTS).map(key => [key, this.waterMaterial.uniforms[key].value]));
      const text = JSON.stringify(values);
      try { await navigator.clipboard.writeText(text); } catch { console.info('Pool water values:', values); }
    });
    actions.append(reset, copy); contents.appendChild(actions);
    host.appendChild(panel);
    this.waterDebugPanel = panel;
    this.waterDebugKeyHandler = event => {
      if (event.code !== 'KeyP' || event.repeat || document.fullscreenElement !== host) return;
      event.preventDefault();
      event.stopPropagation();
      const gameContainer = document.getElementById('game-container');
      if (document.pointerLockElement) {
        host.dataset.waterDebugPointerFree = 'true';
        document.exitPointerLock?.();
      } else {
        delete host.dataset.waterDebugPointerFree;
        gameContainer?.requestPointerLock?.();
      }
    };
    document.addEventListener('keydown', this.waterDebugKeyHandler, true);
  }

  setQuality(quality) {
    const next = WATER_QUALITY_VARIANTS[quality] ? quality : 'high';
    const nextVariant = WATER_QUALITY_VARIANTS[next];
    this.quality = next;
    if (nextVariant === this.qualityVariant) return false;
    this.qualityVariant = nextVariant;
    this.waterMaterial.defines = { [`WATER_QUALITY_${nextVariant}`]: 1 };
    this.waterMaterial.needsUpdate = true;
    return true;
  }

  update(dt) {
    if (this.waterMaterial) this.waterMaterial.uniforms.time.value += dt;
  }

  dispose() {
    if (this.waterDebugKeyHandler && typeof document !== 'undefined'
      && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.waterDebugKeyHandler, true);
    }
    this.waterDebugKeyHandler = null;
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      const host = document.getElementById('viewport-pane');
      if (host) delete host.dataset.waterDebugPointerFree;
    }
    this.waterDebugPanel?.remove();
    this.waterDebugPanel = null;
    this.waterGeometry?.dispose();
    this.waterMaterial?.dispose();
    this.waterCausticsTexture?.dispose();
    this.waterGeometry = null;
    this.waterMaterial = null;
    this.waterCausticsTexture = null;
    this.cloudDescriptors = null;
    this.object3D = null;
  }
}

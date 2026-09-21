/**
 * Renderer.js – Manages the Three.js WebGL renderer and post-processing (bloom).
 * Created once and reused across Run/Reset cycles.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { appSettings } from '../settings/appSettings.js';
import { GRAPHICS_PROFILES, getRenderPixelRatio } from '../settings/graphicsProfiles.js';

const SHADOW_MAP_SIZE = {
  medium: 1024,
  high: 2048,
};

const BLOOM_RESOLUTION_SCALE = {
  reduced: 0.5,
  full: 1,
};

// This is the final composer pass. Combine in linear space, then apply output
// conversion once in bloom's existing final draw (no additional fullscreen pass).
class OutputBloomPass extends UnrealBloomPass {
  constructor(...args) {
    super(...args);
    this.resolutionScale = 1;
    this.blendMaterial.uniforms.sceneTexture = { value: null };
    this.blendMaterial.blending = THREE.NoBlending;
    this.blendMaterial.transparent = false;
    this.blendMaterial.fragmentShader = `
      uniform sampler2D sceneTexture;
      uniform sampler2D tDiffuse;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 sceneColor = texture2D(sceneTexture, vUv);
        vec3 bloomColor = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(sceneColor.rgb + opacity * bloomColor, sceneColor.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `;
  }

  setResolutionScale(scale) {
    this.resolutionScale = scale;
  }

  setSize(width, height) {
    super.setSize(
      Math.max(1, Math.round(width * this.resolutionScale)),
      Math.max(1, Math.round(height * this.resolutionScale)),
    );
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.blendMaterial.uniforms.sceneTexture.value = readBuffer.texture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

export class Renderer {
  constructor(container, settings = appSettings) {
    this.container = container;
    this.settings = settings;
    this.shadowLight = null;
    this._appliedShadowQuality = null;
    this.bloomPass = null;

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);
    this._applyShadowQuality();

    this.composer = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.settings.subscribe((_values, key) => {
      if (key === 'graphicsProfile' || key === 'renderResolutionOverride') this._resize();
      if (key === 'graphicsProfile') this._applyShadowQuality();
    });
  }

  /** Register the scene's shadow-casting directional light. */
  setShadowLight(light) {
    if (this.shadowLight === light) return;
    this.shadowLight = light;
    this._appliedShadowQuality = null;
    this._applyShadowQuality();
  }

  _applyShadowQuality() {
    const profile = GRAPHICS_PROFILES[this.settings.get('graphicsProfile')]
      || GRAPHICS_PROFILES.medium;
    const quality = profile.shadowQuality;
    if (quality === this._appliedShadowQuality) return;

    const enabled = quality !== 'off';
    this.renderer.shadowMap.enabled = enabled;

    const shadow = this.shadowLight?.shadow;
    const mapSize = SHADOW_MAP_SIZE[quality];
    if (shadow && mapSize) {
      if (shadow.mapSize.x !== mapSize || shadow.mapSize.y !== mapSize) {
        shadow.mapSize.set(mapSize, mapSize);
        shadow.map?.dispose();
        shadow.map = null;
      }
      shadow.needsUpdate = true;
      this.renderer.shadowMap.needsUpdate = true;
    }

    this._appliedShadowQuality = quality;
  }

  /** Set up post-processing for a given scene + camera */
  setupPostProcessing(scene, camera) {
    const { width, height } = this._getSize();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const bloom = new OutputBloomPass(
      new THREE.Vector2(width, height),
      0.4,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    bloom.setResolutionScale(this._getBloomResolutionScale());
    this.composer.addPass(bloom);
    this.bloomPass = bloom;
  }

  render(scene, camera) {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  _resize() {
    const { width, height } = this._getSize();
    const pixelRatio = getRenderPixelRatio(
      height,
      window.devicePixelRatio,
      this.settings.get('graphicsProfile'),
      this.settings.get('renderResolutionOverride'),
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.bloomPass?.setResolutionScale(this._getBloomResolutionScale());
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
    }
  }

  _getBloomResolutionScale() {
    const profile = GRAPHICS_PROFILES[this.settings.get('graphicsProfile')]
      || GRAPHICS_PROFILES.medium;
    return BLOOM_RESOLUTION_SCALE[profile.bloomQuality] ?? BLOOM_RESOLUTION_SCALE.reduced;
  }

  _getSize() {
    return {
      width: this.container.clientWidth || 1,
      height: this.container.clientHeight || 1,
    };
  }

  get aspect() {
    const s = this._getSize();
    return s.width / s.height;
  }

  get domElement() {
    return this.renderer.domElement;
  }
}

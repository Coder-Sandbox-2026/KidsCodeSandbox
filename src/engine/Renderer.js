/**
 * Renderer.js – Manages the Three.js WebGL renderer and post-processing (bloom).
 * Created once and reused across Run/Reset cycles.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// This is the final composer pass. Combine in linear space, then apply output
// conversion once in bloom's existing final draw (no additional fullscreen pass).
class OutputBloomPass extends UnrealBloomPass {
  constructor(...args) {
    super(...args);
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

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.blendMaterial.uniforms.sceneTexture.value = readBuffer.texture;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}

export class Renderer {
  constructor(container) {
    this.container = container;

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.composer = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
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
    this.composer.addPass(bloom);
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
    this.renderer.setSize(width, height);
    if (this.composer) this.composer.setSize(width, height);
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

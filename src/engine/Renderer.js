/**
 * Renderer.js – Manages the Three.js WebGL renderer and post-processing (bloom).
 * Created once and reused across Run/Reset cycles.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Renderer {
  constructor(container) {
    this.container = container;

    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
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

    const bloom = new UnrealBloomPass(
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

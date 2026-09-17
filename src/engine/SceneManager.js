/**
 * SceneManager.js – Creates and owns the Three.js scene, camera, and lighting.
 * Also builds the procedural sky sphere.
 */
import * as THREE from 'three';

const SKY_HORIZON = 0x55b8f2;
const SKY_TOP = 0x1684df;

const ENVIRONMENTS = {
  day: { horizon: SKY_HORIZON, top: SKY_TOP, ambient: 0xffffff, ambientIntensity: 0.2, skyLight: 0xe3f3ff, groundLight: 0x82966b, hemiIntensity: 0.65, sunColor: 0xfff3e2, sunIntensity: 1.5, position: [50, 80, 30] },
  sunset: { horizon: 0xffc36b, top: 0xeb854e, ambient: 0xffead2, ambientIntensity: 0.3, skyLight: 0xffe3b0, groundLight: 0x89956b, hemiIntensity: 0.85, sunColor: 0xffce86, sunIntensity: 1.5, position: [-65, 35, 25] },
  sunsetStrong: { horizon: 0xffb05d, top: 0xdf6a58, ambient: 0xffead2, ambientIntensity: 0.3, skyLight: 0xffd3a2, groundLight: 0x89956b, hemiIntensity: 0.85, sunColor: 0xffbd76, sunIntensity: 1.65, position: [-75, 28, 35] },
  night: { horizon: 0x233c78, top: 0x0b1740, ambient: 0xb9cff8, ambientIntensity: 0.4, skyLight: 0xb7d6ff, groundLight: 0x59726f, hemiIntensity: 0.95, sunColor: 0xd8e9ff, sunIntensity: 1.25, position: [-40, 65, -30] },
};

export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_HORIZON);
    // Beyond even the diagonal of the playground: no haze over playable objects.
    this.scene.fog = new THREE.Fog(SKY_HORIZON, 210, 500);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, renderer.aspect, 0.1, 2000);
    this.camera.position.set(0, 2, 5);

    // Lighting
    this._setupLighting();

    // Sky
    this._createSky();
    this.applyEnvironment('day');

    // Listen for resize
    window.addEventListener('resize', () => {
      this.camera.aspect = renderer.aspect;
      this.camera.updateProjectionMatrix();
    });
  }

  _setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this.ambient = ambient;
    this.scene.add(ambient);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0xe3f3ff, 0x82966b, 0.65);
    this.hemisphere = hemi;
    this.scene.add(hemi);

    // Sun (directional)
    this.sun = new THREE.DirectionalLight(0xfff3e2, 1.5);
    this.sun.position.set(50, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 200;
    const d = 60;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);

    // Small emissive sun sphere (for bloom glow)
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh = sunMesh;
    sunMesh.position.copy(this.sun.position);
    this.scene.add(sunMesh);
  }

  applyEnvironment(name = 'day') {
    const preset = ENVIRONMENTS[name];
    if (!preset) throw new Error(`Unknown environment: ${name}`);
    this.environment = name;
    this.scene.background.set(preset.horizon);
    this.scene.fog.color.set(preset.horizon);
    this.sky.material.uniforms.topColor.value.set(preset.top);
    this.sky.material.uniforms.bottomColor.value.set(preset.horizon);
    this.ambient.color.set(preset.ambient);
    this.ambient.intensity = preset.ambientIntensity;
    this.hemisphere.color.set(preset.skyLight);
    this.hemisphere.groundColor.set(preset.groundLight);
    this.hemisphere.intensity = preset.hemiIntensity;
    this.sun.color.set(preset.sunColor);
    this.sun.intensity = preset.sunIntensity;
    this.sun.position.set(...preset.position);
    this.sunMesh.visible = name === 'day';
    this.sunMesh.position.copy(this.sun.position);
  }

  _createSky() {
    // Procedural gradient sky sphere
    const geo = new THREE.SphereGeometry(900, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(SKY_TOP) },
        bottomColor: { value: new THREE.Color(SKY_HORIZON) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = smoothstep(0.0, 0.8, h);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
  }
}

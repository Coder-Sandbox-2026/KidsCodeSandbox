/**
 * SceneManager.js – Creates and owns the Three.js scene, camera, and lighting.
 * Also builds the procedural sky sphere.
 */
import * as THREE from 'three';

export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x88bbee, 0.0025);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, renderer.aspect, 0.1, 2000);
    this.camera.position.set(0, 2, 5);

    // Lighting
    this._setupLighting();

    // Sky
    this._createSky();

    // Listen for resize
    window.addEventListener('resize', () => {
      this.camera.aspect = renderer.aspect;
      this.camera.updateProjectionMatrix();
    });
  }

  _setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x9999cc, 0.6);
    this.scene.add(ambient);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.5);
    this.scene.add(hemi);

    // Sun (directional)
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
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
    this.scene.add(this.sun);

    // Small emissive sun sphere (for bloom glow)
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(this.sun.position);
    this.scene.add(sunMesh);
  }

  _createSky() {
    // Procedural gradient sky sphere
    const geo = new THREE.SphereGeometry(900, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1a3a6a) },
        bottomColor: { value: new THREE.Color(0x88ccee) },
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
          float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
  }
}

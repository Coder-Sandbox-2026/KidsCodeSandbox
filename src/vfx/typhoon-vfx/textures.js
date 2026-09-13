import * as THREE from './three.js';
import splashAlphaUrl from './textures/shockwave_splash_alpha.png?url';
import splashNormalUrl from './textures/shockwave_normal.png?url';
import splashRoughnessUrl from './textures/shockwave_roughness.png?url';
import waterRingUrl from './textures/water_ring.png?url';
import waterBaseUrl from './textures/water_base.png?url';
import waterNormalUrl from './textures/water_normal.png?url';
import waterRoughnessUrl from './textures/water_roughness.png?url';
import tunnelNoiseUrl from './textures/tunnel_noise.png?url';
import tunnelWaterNoiseUrl from './textures/tunnel_water_noise.png?url';
import tunnelFoamUrl from './textures/tunnel_foam.png?url';
import tunnelWaterMaskUrl from './textures/tunnel_water_mask.png?url';

const TEXTURE_URLS = {
  splashAlpha: splashAlphaUrl,
  splashNormal: splashNormalUrl,
  splashRoughness: splashRoughnessUrl,
  waterRing: waterRingUrl,
  waterBase: waterBaseUrl,
  waterNormal: waterNormalUrl,
  waterRoughness: waterRoughnessUrl,
  tunnelNoise: tunnelNoiseUrl,
  tunnelWaterNoise: tunnelWaterNoiseUrl,
  tunnelFoam: tunnelFoamUrl,
  tunnelWaterMask: tunnelWaterMaskUrl,
};

let cached = null;
let pending = null;

function configureSplashTexture(texture) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function configureDecalTexture(texture, colorSpace, minFilter) {
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = minFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function configureTunnelTexture(texture) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
  return texture;
}

function configureLoaded(name, texture) {
  switch (name) {
    case 'splashAlpha':
    case 'splashNormal':
    case 'splashRoughness':
      return configureSplashTexture(texture);
    case 'waterRing':
      return configureDecalTexture(texture, THREE.NoColorSpace, THREE.LinearFilter);
    case 'waterBase':
      return configureDecalTexture(texture, THREE.SRGBColorSpace, THREE.LinearMipmapLinearFilter);
    case 'waterNormal':
    case 'waterRoughness':
      return configureDecalTexture(texture, THREE.NoColorSpace, THREE.LinearMipmapLinearFilter);
    default:
      return configureTunnelTexture(texture);
  }
}

/**
 * Shared typhoon maps stay loaded for the current level.
 * Do not call disposeTyphoonTextures() when an effect finishes — only when the level changes.
 */
export function loadTyphoonTextures() {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  const loader = new THREE.TextureLoader();
  pending = Promise.all(
    Object.entries(TEXTURE_URLS).map(async ([name, url]) => [
      name,
      configureLoaded(name, await loader.loadAsync(url)),
    ])
  )
    .then((entries) => {
      cached = Object.fromEntries(entries);
      return cached;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });

  return pending;
}

export function getTyphoonTextures() {
  if (!cached) {
    throw new Error('Typhoon textures are not loaded. Call await loadTyphoonTextures() during initialization.');
  }
  return cached;
}

export function disposeTyphoonTextures() {
  if (!cached) {
    pending = null;
    return;
  }
  for (const texture of Object.values(cached)) {
    texture?.dispose?.();
  }
  cached = null;
  pending = null;
}

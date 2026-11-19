/**
 * Asset URLs that work locally and on GitHub Pages.
 *
 * Vite is configured with `base: './'`, so these resolve relative to the
 * page (./assets/..., ./basis/...), never from the domain root or a
 * Windows absolute path.
 */
import goldCoinUrl from './model/goldCoin.glb?url';
import cakeUrl from './model/Cake.glb?url';
import goldStarUrl from './model/GoldStar.glb?url';
import redKeyUrl from './model/Key Red/keyRed.gltf?url';
import greenKeyUrl from './model/Key Green/keyGreen.gltf?url';
import yellowKeyUrl from './model/Key Yellow/keyYellow.gltf?url';
import blueKeyUrl from './model/Key Blue/keyBlue.gltf?url';
import platformerTextureUrl from './textures/platformer_texture3.ktx2?url';
import droneAUrl from './model/Drones/droneA.gltf?url';
import droneABinUrl from './model/Drones/droneA.bin?url';
import droneTextureUrl from './model/Drones/drone_texture.ktx2?url';
import droneImage1Url from './model/Drones/Image_1.ktx2?url';
import droneImage2Url from './model/Drones/Image_2.ktx2?url';
import droneImage1PngUrl from './model/Drones/Image_1.png?url';
import droneImage2PngUrl from './model/Drones/Image_2.png?url';
import droneTexturePngUrl from './model/Drones/drone_texture.png?url';

export {
  goldCoinUrl, cakeUrl, goldStarUrl, redKeyUrl, greenKeyUrl, yellowKeyUrl, blueKeyUrl,
  platformerTextureUrl, droneAUrl, droneABinUrl, droneTextureUrl, droneImage1Url, droneImage2Url,
  droneImage1PngUrl, droneImage2PngUrl, droneTexturePngUrl,
};

/** Copied from public/basis/ next to the page (dev, dist, GitHub Pages). */
export function basisTranscoderPath() {
  return './basis/';
}

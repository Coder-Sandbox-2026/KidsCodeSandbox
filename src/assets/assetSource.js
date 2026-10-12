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
import platformerTextureUrl from './textures/platformer_texture3.ktx2?url';

export { goldCoinUrl, cakeUrl, goldStarUrl, redKeyUrl, platformerTextureUrl };

/** Copied from public/basis/ next to the page (dev, dist, GitHub Pages). */
export function basisTranscoderPath() {
  return './basis/';
}

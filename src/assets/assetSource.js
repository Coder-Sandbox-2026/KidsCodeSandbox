/**
 * Asset URLs that work locally and on GitHub Pages.
 *
 * Vite is configured with `base: './'`, so these resolve relative to the
 * page (./assets/..., ./basis/...), never from the domain root or a
 * Windows absolute path.
 */
import goldCoinUrl from './model/goldCoin.glb?url';
import cakeUrl from './model/Cake.glb?url';

export { goldCoinUrl, cakeUrl };

/** Copied from public/basis/ next to the page (dev, dist, GitHub Pages). */
export function basisTranscoderPath() {
  return './basis/';
}

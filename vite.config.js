import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Let Vite serve three.js Basis transcoder files during local debug.
  server: {
    fs: {
      allow: ['.'],
    },
  },
  assetsInclude: ['**/*.glb', '**/*.ktx2', '**/*.wasm'],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 15000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@dimforge/rapier3d-compat'],
    // Prebundling monaco breaks its ESM workers and JS language service.
    // Prebundling KTX2Loader breaks its import.meta.url path to the Basis WASM.
    exclude: ['monaco-editor', 'three/addons/loaders/KTX2Loader.js'],
  },
  worker: {
    format: 'es',
  },
});

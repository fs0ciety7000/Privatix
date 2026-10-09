import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 200000,
    chunkSizeWarningLimit: 2000,
    cssCodeSplit: false,
    modulePreload: false,
  },
});

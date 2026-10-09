import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Configuration Vite pour Privatix.
 * - `base: './'` : chemins relatifs, le build fonctionne derrière n'importe quel préfixe (Coolify/nginx).
 * - Phaser est isolé dans son propre chunk pour profiter du cache navigateur entre deux déploiements.
 * - Deux entrées pendant la migration 3D (docs/ARCHITECTURE.md, « Migration 3D ») :
 *   `index.html` (jeu Phaser, en production jusqu'à la parité) et `play3d.html` (Three.js, servi en
 *   `/play3d.html`). Three est isolé dans son propre chunk, comme Phaser ; aucune entrée ne charge
 *   le moteur de l'autre.
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Les bundles hashés vont dans dist/bundle/ pour ne PAS se mélanger
    // avec public/assets/ (non hashés) : politiques de cache distinctes dans nginx.
    assetsDir: 'bundle',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        play3d: fileURLToPath(new URL('./play3d.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          phaser: ['phaser'],
          three: ['three'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});

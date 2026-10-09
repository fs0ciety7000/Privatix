import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Configuration Vite pour Privatix.
 * - `base: './'` : chemins relatifs, le build fonctionne derrière n'importe quel préfixe (Coolify/nginx).
 * - Phaser est isolé dans son propre chunk pour profiter du cache navigateur entre deux déploiements.
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
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});

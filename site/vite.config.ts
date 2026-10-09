import { defineConfig } from 'vite';

/**
 * Site vitrine de Privatix, servi à la racine du domaine (le jeu est sous /jouer/, le prototype sous /3d/).
 * - `base: './'` : chemins relatifs, comme le jeu.
 * - Bundles et médias hashés dans dist/bundle/ (cache immuable dans nginx), fichiers publics à la racine.
 */
export default defineConfig({
  base: './',
  server: { port: 5175, strictPort: true, host: true },
  preview: { port: 4174, strictPort: true },
  build: {
    target: 'es2022',
    assetsDir: 'bundle',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});

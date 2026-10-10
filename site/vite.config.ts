import { defineConfig } from 'vite';

/**
 * Site vitrine de Privatix, servi à la racine du domaine (le jeu est sous /jouer/, le prototype sous /3d/).
 * - `base: './'` : chemins relatifs, comme le jeu.
 * - Bundles et médias hashés dans dist/bundle/ (cache immuable dans nginx), fichiers publics à la racine.
 * - Deux pages : l'accueil et l'artbook (planches, animations et press kit, fichiers lourds dans public/artbook/).
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
    rollupOptions: {
      input: {
        index: decodeURI(new URL('./index.html', import.meta.url).pathname),
        artbook: decodeURI(new URL('./artbook.html', import.meta.url).pathname),
      },
    },
  },
});

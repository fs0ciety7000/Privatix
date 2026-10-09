import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Visionneuse autonome : sert les GLB de public/models du dépôt (hors build du jeu).
const publicDir = fileURLToPath(new URL('../../../public', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir,
  server: { port: 4180, strictPort: false },
  preview: { port: 4180 },
  build: { outDir: 'dist', emptyOutDir: true, copyPublicDir: false },
});

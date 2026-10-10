#!/usr/bin/env node
/**
 * Recopie les icônes officielles de Privatix (desktop/icons/, issues de l'icône carrée du logo :
 * docs/marketing/officiel/logo/icone/, synchronisées par tools/marketing/sync-site.mjs) dans
 * build/, le dossier de ressources d'electron-builder :
 *   icon.png  1024 × 1024 (Linux, fenêtre)   icon.ico  16 → 256 (Windows)
 *   icon.icns 16 → 1024, grille macOS        512x512.png (Linux, entrée .desktop)
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'icons');
const out = join(root, 'build');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(src)) {
  copyFileSync(join(src, f), join(out, f));
  console.log(`[make-icon] ${join(out, f)}`);
}

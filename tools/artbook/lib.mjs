// Outils communs de l'artbook : Playwright (Chromium SwiftShader, sans GPU), chemins du dépôt.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const HERE = fileURLToPath(new URL('.', import.meta.url));
/** Rendus intermédiaires (non versionnés). */
export const CACHE = path.join(HERE, '.cache');
/** Sortie servie par le site vitrine ET référencée par docs/artbook/README.md (aucun doublon). */
export const OUT = path.join(ROOT, 'site', 'public', 'artbook');
export const DOCS = path.join(ROOT, 'docs', 'artbook');

export function playwright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch {
      /* suivant */
    }
  }
  throw new Error('Playwright introuvable (npm i -g playwright, puis npx playwright install chromium)');
}

export const CHROMIUM_ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'];

/** Vite (dépendance des projets du dépôt), résolu depuis la racine. */
export async function vite() {
  const req = createRequire(path.join(ROOT, 'package.json'));
  return import(req.resolve('vite'));
}

export function cli() {
  const a = process.argv.slice(2);
  const opt = (k, d) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : d;
  };
  const only = String(opt('--only', ''))
    .split(',')
    .filter(Boolean);
  return { a, opt, only, has: (k) => a.includes(k) };
}

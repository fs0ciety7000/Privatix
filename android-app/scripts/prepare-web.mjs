#!/usr/bin/env node
/**
 * Remplit android-app/www/ (webDir de Capacitor) avec le build web du jeu 3D.
 *
 * Même principe que desktop/scripts/prepare-app.mjs : on recopie un build Vite déjà construit
 * (`npm run build` à la racine -> dist/), sans toucher au jeu. Différences :
 *   - le point d'entrée est le jeu 3D : dist/play3d.html devient www/index.html (Capacitor ouvre
 *     toujours index.html) ;
 *   - l'ancienne version 2D (Phaser : index.html, bundle « main », chunk « phaser », sprites de
 *     public/assets/) n'est pas embarquée, pour alléger l'APK. Le tri se fait par accessibilité :
 *     on part de play3d.html et on garde tout fichier de bundle/ cité, de proche en proche.
 *
 * Source : --src <dossier> > PRIVATIX_WEB=<dossier> > ../dist (relatif à android-app/).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wwwDir = join(appDir, 'www');

let src = process.env.PRIVATIX_WEB || '../dist';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src') src = args[++i];
  else throw new Error(`Argument inconnu : ${args[i]}`);
}
const srcAbs = resolve(appDir, src);
const entry = join(srcAbs, 'play3d.html');
if (!existsSync(entry)) {
  console.error(
    `[prepare-web] ${entry} introuvable.\n  Construis d'abord le jeu web : « npm run build » à la racine du dépôt.`,
  );
  process.exit(1);
}

rmSync(wwwDir, { recursive: true, force: true });
mkdirSync(wwwDir, { recursive: true });

// 1. Fichiers de premier niveau : tout sauf les entrées HTML et le bundle (trié plus bas).
for (const name of readdirSync(srcAbs)) {
  if (name.endsWith('.html') || name === 'bundle') continue;
  cpSync(join(srcAbs, name), join(wwwDir, name), { recursive: true });
}

// 2. Le jeu 3D devient la page d'accueil.
const html = readFileSync(entry, 'utf8');
writeFileSync(join(wwwDir, 'index.html'), html);

// 3. Bundle : uniquement les fichiers atteignables depuis play3d.html.
const bundleSrc = join(srcAbs, 'bundle');
const bundleFiles = readdirSync(bundleSrc).filter((f) => statSync(join(bundleSrc, f)).isFile());
const kept = new Set();
const queue = [html];
while (queue.length > 0) {
  const text = queue.pop();
  for (const f of bundleFiles) {
    if (kept.has(f) || !text.includes(f)) continue;
    kept.add(f);
    if (/\.(js|css|mjs)$/.test(f)) queue.push(readFileSync(join(bundleSrc, f), 'utf8'));
  }
}
mkdirSync(join(wwwDir, 'bundle'));
for (const f of kept) cpSync(join(bundleSrc, f), join(wwwDir, 'bundle', f));
const dropped = bundleFiles.filter((f) => !kept.has(f));

// 4. public/assets/ ne sert qu'à la version 2D : on le retire si aucun fichier gardé ne le cite.
const keptText = [html, ...[...kept].filter((f) => /\.(js|css|mjs)$/.test(f)).map((f) => readFileSync(join(bundleSrc, f), 'utf8'))].join('\n');
if (existsSync(join(wwwDir, 'assets')) && !/["'`(/]assets\//.test(keptText)) {
  rmSync(join(wwwDir, 'assets'), { recursive: true, force: true });
  dropped.push('assets/ (sprites 2D)');
}

const size = (dir) =>
  readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f);
    const s = statSync(p);
    return n + (s.isDirectory() ? size(p) : s.size);
  }, 0);
console.log(`[prepare-web] ${srcAbs}/play3d.html -> www/index.html`);
console.log(`[prepare-web] bundle gardé : ${[...kept].sort().join(', ')}`);
if (dropped.length > 0) console.log(`[prepare-web] écarté (version 2D) : ${dropped.join(', ')}`);
console.log(`[prepare-web] www/ : ${(size(wwwDir) / 1048576).toFixed(1)} Mo`);

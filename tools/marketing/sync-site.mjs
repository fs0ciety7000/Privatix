#!/usr/bin/env node
// Recopie les visuels officiels (docs/marketing/officiel/) là où le site, le jeu et l'appli de
// bureau les servent. Le build du site ne voit que site/ (Dockerfile) : les fichiers sont donc
// versionnés aux deux endroits, et ce script garde les copies à jour.
//
//   node tools/marketing/sync-site.mjs
//
// ImageMagick (`convert`) produit les aperçus WebP.

import { copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const O = (p) => join(root, 'docs/marketing/officiel', p);
const R = (p) => join(root, p);

/** [source, destination] relatifs à la racine du dépôt. */
const COPIES = [
  // Press kit (site/public/artbook/presskit/, repris dans l'archive ZIP au build)
  [O('presskit/privatix-presskit-couverture-a4.pdf'), R('site/public/artbook/presskit/privatix-presskit-couverture.pdf')],
  [O('presskit/privatix-presskit-couverture.jpg'), R('site/public/artbook/presskit/privatix-presskit-couverture.jpg')],
  [O('affiche/privatix-affiche-marquise-4k.jpg'), R('site/public/artbook/presskit/privatix-affiche.jpg')],
  [O('affiche/keyart-affiche-marquise-4k.jpg'), R('site/public/artbook/presskit/privatix-affiche-sans-texte.jpg')],
  [O('bannieres/site-hero-2560x1440.jpg'), R('site/public/artbook/presskit/privatix-banniere.jpg')],
  [O('logo/privatix-lockup-vertical-sombre.png'), R('site/public/artbook/presskit/logo/privatix-logo-vertical.png')],
  [O('logo/privatix-lockup-vertical-clair.png'), R('site/public/artbook/presskit/logo/privatix-logo-vertical-fond-clair.png')],
  [O('logo/privatix-lockup-horizontal-sombre.png'), R('site/public/artbook/presskit/logo/privatix-logo-horizontal.png')],
  [O('logo/privatix-lockup-horizontal-clair.png'), R('site/public/artbook/presskit/logo/privatix-logo-horizontal-fond-clair.png')],
  [O('logo/privatix-wordmark-sombre.svg'), R('site/public/artbook/presskit/logo/privatix-wordmark.svg')],
  [O('logo/privatix-lockup-vertical-mono-blanc.svg'), R('site/public/artbook/presskit/logo/privatix-logo-mono-blanc.svg')],
  [O('logo/privatix-lockup-vertical-mono-noir.svg'), R('site/public/artbook/presskit/logo/privatix-logo-mono-noir.svg')],
  [O('logo/icone/privatix-icone-1024.png'), R('site/public/artbook/presskit/logo/privatix-icone-1024.png')],
  // Site vitrine : logo d'en-tête, favicons, partage
  [O('logo/privatix-wordmark-sombre.svg'), R('site/src/assets/img/privatix-wordmark.svg')],
  [O('logo/icone/favicon.svg'), R('site/public/favicon.svg')],
  [O('logo/icone/favicon.ico'), R('site/public/favicon.ico')],
  [O('logo/icone/privatix-icone-32.png'), R('site/public/favicon-32.png')],
  [O('logo/icone/apple-touch-icon-180.png'), R('site/public/apple-touch-icon.png')],
  [O('logo/icone/privatix-icone-512.png'), R('site/public/icon-512.png')],
  [O('logo/icone/privatix-icone-masquable-512.png'), R('site/public/icon-maskable-512.png')],
  [O('bannieres/open-graph-1200x630.jpg'), R('site/public/og-image.jpg')],
  // Jeu (public/ de la racine, servi à côté de play3d.html)
  [O('logo/icone/favicon.svg'), R('public/favicon.svg')],
  [O('logo/icone/favicon.ico'), R('public/favicon.ico')],
  // Appli de bureau (desktop/icons/, recopié dans build/ par scripts/make-icon.mjs)
  [O('logo/icone/privatix-icone-1024.png'), R('desktop/icons/icon.png')],
  [O('logo/icone/privatix-icone-512.png'), R('desktop/icons/512x512.png')],
  [O('logo/icone/privatix.ico'), R('desktop/icons/icon.ico')],
  [O('logo/icone/privatix.icns'), R('desktop/icons/icon.icns')],
];

/** Aperçus WebP : [source, destination, largeur]. */
const PREVIEWS = [
  [O('presskit/privatix-presskit-couverture.jpg'), R('site/public/artbook/presskit/privatix-presskit-couverture-960.webp'), 960],
  [O('affiche/privatix-affiche-marquise-4k.jpg'), R('site/public/artbook/presskit/privatix-affiche-960.webp'), 960],
];
// Affiche de la vidéo du hero (image LCP) : key art de la bannière SANS texte, le titre HTML du
// hero se pose dessus ; même format que l'ancienne affiche (960 × 540), la boucle vidéo garde sa place.
const HERO_POSTER = [O('refs/keyart-banniere-recadre.jpg'), R('site/src/assets/img/hero-poster.webp')];

for (const [src, dst] of COPIES) {
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log(`→ ${dst.slice(root.length + 1)}`);
}
for (const [src, dst, w] of PREVIEWS) {
  execFileSync('convert', [src, '-resize', `${w}x`, '-quality', '84', '-define', 'webp:method=6', dst]);
  console.log(`→ ${dst.slice(root.length + 1)} (${w} px)`);
}
execFileSync('convert', [HERO_POSTER[0], '-resize', '960x540^', '-gravity', 'center', '-extent', '960x540', '-quality', '75', '-define', 'webp:method=6', HERO_POSTER[1]]);
console.log('→ site/src/assets/img/hero-poster.webp (960 × 540)');
// Emblème du logo pour l'en-tête et le hero du site (le lockup se recompose en HTML : emblème
// WebP + wordmark SVG, plutôt que le SVG du lockup qui embarque l'emblème en PNG)
execFileSync('convert', [O('logo/embleme.png'), '-filter', 'Lanczos', '-resize', '640x', '-quality', '86', '-define', 'webp:alpha-quality=90', R('site/src/assets/img/privatix-embleme.webp')]);
console.log('→ site/src/assets/img/privatix-embleme.webp (640 px)');
// Icône 192 px du manifeste (site/public/site.webmanifest)
execFileSync('convert', [O('logo/icone/privatix-icone-1024.png'), '-filter', 'Lanczos', '-resize', '192x192', '-strip', R('site/public/icon-192.png')]);
console.log('→ site/public/icon-192.png');
// Aperçu du logo pour l'artbook : lockup vertical sur fond nuit, 1200 × 600
execFileSync('convert', [
  O('logo/privatix-lockup-vertical-sombre.png'), '-resize', '1100x560',
  '-background', '#0A0818', '-gravity', 'center', '-extent', '1200x600',
  '-quality', '86', R('site/public/artbook/presskit/logo/privatix-logo-1200.webp'),
]);
console.log('→ site/public/artbook/presskit/logo/privatix-logo-1200.webp');

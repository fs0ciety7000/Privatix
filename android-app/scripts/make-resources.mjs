#!/usr/bin/env node
/**
 * Régénère les icônes et écrans de démarrage Android depuis le logo officiel
 * (docs/marketing/officiel/logo/icone/), avec ImageMagick (« magick » ou « convert »).
 * Les PNG produits sont versionnés dans android/app/src/main/res/ : ce script ne sert qu'après un
 * changement de logo. (@capacitor/assets ferait la même chose mais télécharge sharp et ses
 * binaires natifs ; ImageMagick suffit et fonctionne hors ligne.)
 *
 * - Icône adaptative (Android 8+) : fond uni #0a0818 (couleur du bord de l'icône masquable) +
 *   avant-plan = icône masquable réduite à 82 % sur un calque 108 dp transparent. La zone visible
 *   d'une icône adaptative est le disque central de 72 dp : le dessin (zone sûre de l'icône
 *   masquable) y tient entier, quel que soit le masque du lanceur (cercle, carré arrondi, goutte).
 * - Icônes classiques (Android 7) : icône carrée arrondie 1024 (ic_launcher) et disque découpé
 *   dans l'icône masquable (ic_launcher_round).
 * - Écrans de démarrage (Android 7 à 11, avant l'API SplashScreen) : icône centrée sur fond
 *   #0a0818, en paysage et en portrait. Android 12+ affiche l'icône adaptative sur la couleur
 *   « windowSplashScreenBackground » (res/values/styles.xml).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logoDir = resolve(appDir, '../docs/marketing/officiel/logo/icone');
const res = join(appDir, 'android/app/src/main/res');
const ICON = join(logoDir, 'privatix-icone-1024.png');
const MASKABLE = join(logoDir, 'privatix-icone-masquable-512.png');
const BG = '#0a0818';

let im = 'magick';
try {
  execFileSync(im, ['-version'], { stdio: 'ignore' });
} catch {
  im = 'convert';
}
const run = (...args) => execFileSync(im, args, { stdio: 'inherit' });
const out = (dir, name) => {
  mkdirSync(join(res, dir), { recursive: true });
  return join(res, dir, name);
};

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const STRIP = ['-strip', '-define', 'png:exclude-chunks=date,time'];

for (const [d, k] of Object.entries(densities)) {
  const legacy = Math.round(48 * k);
  const layer = Math.round(108 * k);
  const art = Math.round(layer * 0.82);
  run(ICON, '-resize', `${legacy}x${legacy}`, ...STRIP, out(`mipmap-${d}`, 'ic_launcher.png'));
  run(
    MASKABLE, '-alpha', 'set', '-resize', `${legacy}x${legacy}`,
    '(', '-size', `${legacy}x${legacy}`, 'xc:none', '-fill', 'white',
    '-draw', `circle ${(legacy - 1) / 2},${(legacy - 1) / 2} ${(legacy - 1) / 2},0`, ')',
    '-compose', 'DstIn', '-composite', ...STRIP, out(`mipmap-${d}`, 'ic_launcher_round.png'),
  );
  run(
    '-size', `${layer}x${layer}`, 'xc:none',
    '(', MASKABLE, '-resize', `${art}x${art}`, ')', '-gravity', 'center', '-composite',
    ...STRIP, out(`mipmap-${d}`, 'ic_launcher_foreground.png'),
  );
}

// Écrans de démarrage : mêmes tailles que le gabarit Capacitor.
const splash = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [dir, [w, h]] of Object.entries(splash)) {
  const s = Math.round(Math.min(w, h) * 0.42);
  run(
    '-size', `${w}x${h}`, `xc:${BG}`,
    '(', ICON, '-resize', `${s}x${s}`, ')', '-gravity', 'center', '-composite',
    ...STRIP, out(dir, 'splash.png'),
  );
}
console.log(`[make-resources] icônes et splash régénérés dans ${res}`);

// Artbook & Press kit de Privatix : génère tout, des rendus aux pages.
//   node tools/artbook/build.mjs [étapes…] [--only id1,id2]
// Étapes (toutes par défaut, dans cet ordre) :
//   models    rendus des figurines (visionneuse toon, tools/render3d/viewer) → .cache/models
//   stills    captures du jeu 3D en 1920×1080 → .cache/game/stills
//   clips     séquences à 30 i/s en 960×540 → .cache/game/clips
//   sheets    planches (personnages, décors, loot/UI, VFX, palette) → site/public/artbook/planches
//   anim      GIF, WebM, MP4 et affiches → site/public/artbook/anim
//   presskit  logo, captures et textes du press kit → site/public/artbook/presskit
//   page      galeries de site/artbook.html et docs/artbook/README.md
// Les fichiers produits vivent dans site/public/artbook/ (servis par le site, référencés par
// docs/artbook/README.md) : rien n'est dupliqué. L'archive ZIP du press kit est assemblée au build du
// site (site/scripts/presskit.mjs).
// Variables : ARTBOOK_GAME_ROOT (capturer une autre copie du jeu, par exemple un commit extrait).
// Prérequis : Node 22, Playwright + Chromium, Python 3 + Pillow, ffmpeg (libvpx, libx264).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { HERE, ROOT, cli } from './lib.mjs';

const STEPS = ['models', 'stills', 'clips', 'sheets', 'anim', 'presskit', 'page'];
const { a, opt } = cli();
const asked = a.filter((x) => STEPS.includes(x));
const steps = asked.length ? asked : STEPS;
const only = opt('--only', null);
const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.map((x) => path.relative(ROOT, x) || x).join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
};
const node = (file, ...rest) => run(process.execPath, [path.join(HERE, file), ...rest, ...(only ? ['--only', only] : [])]);
const py = (file, ...rest) => run('python3', [path.join(HERE, file), ...rest, ...(only ? ['--only', only] : [])]);

const t0 = Date.now();
for (const s of steps) {
  if (s === 'models') node('models.mjs');
  if (s === 'stills') node('game.mjs', 'stills');
  if (s === 'clips') node('game.mjs', 'clips');
  if (s === 'sheets') {
    py('sheets_characters.py');
    py('sheets_scenes.py');
    if (!only) run('python3', [path.join(HERE, 'sheets_da.py')]);
  }
  if (s === 'anim') node('anim.mjs');
  if (s === 'presskit') run('python3', [path.join(HERE, 'presskit.py')]);
  if (s === 'page') run('python3', [path.join(HERE, 'page.py')]);
}
console.log(`\nartbook : ${steps.join(', ')} en ${((Date.now() - t0) / 60000).toFixed(1)} min`);

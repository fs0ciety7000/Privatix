#!/usr/bin/env node
// Composition typographique des affiches et bannières : un gabarit HTML/CSS (polices
// OFL embarquées dans ./fonts) posé sur un key art sans texte, rendu par Chromium
// via Playwright. Le texte n'est plus demandé au générateur d'images.
//
//   node tools/marketing/compose/render.mjs docs/marketing/lot2/compose.json
//   node tools/marketing/compose/render.mjs <compose.json> --only affiche-a   # ids séparés par des virgules
//   node tools/marketing/compose/render.mjs <compose.json> --png             # garde aussi un PNG sans perte
//
// Fichier de composition :
//   { "outDir": "docs/marketing/lot2",
//     "renders": [ { "id", "template": "affiche-marquee.html", "width", "height",
//                    "scale"?: 2, "vars": { "art": "docs/…/key-art.jpg", "tagline": "…", … } } ] }
// Les chemins sont relatifs à la racine du dépôt (dossier courant). Dans le gabarit,
// {{nom}} est remplacé par vars.nom (échappé en HTML) ; une variable dont le nom finit
// par « Url » ou vaut « art » est convertie en URL file:// absolue.
// Sortie : <id>.jpg (qualité 92, taille width×scale × height×scale), <id>-1600.webp
// (aperçu, ImageMagick facultatif) et, avec --png, <id>.png.
//
// Playwright est pris dans node_modules s'il y est, sinon dans l'installation globale.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const specFile = args.find((a) => !a.startsWith('--'));
const keepPng = args.includes('--png');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;

if (!specFile) {
  console.error('Usage : node tools/marketing/compose/render.mjs <compose.json> [--only id] [--png]');
  process.exit(2);
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const { execSync } = require('node:child_process');
    const root = execSync('npm root -g').toString().trim();
    return require(join(root, 'playwright'));
  }
}

const run = (cmd, argv) =>
  new Promise((ok, ko) => execFile(cmd, argv, (err) => (err ? ko(err) : ok())));
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const spec = JSON.parse(await readFile(specFile, 'utf8'));
await mkdir(spec.outDir, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

try {
  for (const r of spec.renders) {
    if (only && !only.has(r.id)) continue;
    const scale = r.scale ?? 2;
    const vars = { ...r.vars, width: r.width, height: r.height };
    let html = await readFile(join(here, 'templates', r.template), 'utf8');
    html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`${r.id} : variable {{${k}}} absente`);
      const v = vars[k];
      return k === 'art' || k.endsWith('Url') ? pathToFileURL(resolve(v)).href : esc(v);
    });
    // Le gabarit est servi depuis son dossier : ../fonts et ../assets se résolvent.
    const tmp = join(here, 'templates', `.render-${r.id}.html`);
    await writeFile(tmp, html);
    const page = await browser.newPage({
      viewport: { width: r.width, height: r.height },
      deviceScaleFactor: scale,
    });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const missing = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family),
    );
    if (missing.length) console.warn(`  polices en erreur : ${missing.join(', ')}`);

    const base = join(spec.outDir, r.id);
    await page.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 92 });
    if (keepPng) await page.screenshot({ path: `${base}.png`, type: 'png' });
    await page.close();
    await run('rm', ['-f', tmp]);
    try {
      await run('convert', [`${base}.jpg`, '-resize', '1600x1600>', '-quality', '86', `${base}-1600.webp`]);
    } catch {
      console.warn("  ImageMagick absent : pas d'aperçu WebP");
    }
    console.log(`✓ ${base}.jpg (${r.width * scale}×${r.height * scale})`);
  }
} finally {
  await browser.close();
}

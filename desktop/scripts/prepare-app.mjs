#!/usr/bin/env node
/**
 * Remplit desktop/app/ avec le(s) build(s) web à embarquer.
 *
 * Ordre de priorité (le plus fort en premier) :
 *   1. arguments CLI   : --main <dossier> [--extra clé=<dossier>]... [--no-extras]
 *   2. variables d'env : PRIVATIX_MAIN=<dossier>  PRIVATIX_EXTRAS="3d=<dossier>,autre=<dossier>" (ou "none")
 *   3. content.config.json
 *
 * Le build « main » est servi à app://game/ ; chaque extra à app://game/<clé>/.
 * Les chemins relatifs sont résolus depuis desktop/.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(desktopDir, 'app');

const config = JSON.parse(readFileSync(join(desktopDir, 'content.config.json'), 'utf8'));
let main = config.main;
let extras = { ...(config.extras ?? {}) };

const parseExtras = (str) =>
  Object.fromEntries(
    str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf('=');
        if (i <= 0) throw new Error(`Extra invalide « ${pair} » (attendu clé=dossier)`);
        return [pair.slice(0, i), pair.slice(i + 1)];
      }),
  );

if (process.env.PRIVATIX_MAIN) main = process.env.PRIVATIX_MAIN;
if (process.env.PRIVATIX_EXTRAS !== undefined) {
  extras = process.env.PRIVATIX_EXTRAS === 'none' ? {} : parseExtras(process.env.PRIVATIX_EXTRAS);
}

const args = process.argv.slice(2);
let cliExtras = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--main') main = args[++i];
  else if (a === '--no-extras') cliExtras = {};
  else if (a === '--extra') Object.assign((cliExtras ??= {}), parseExtras(args[++i]));
  else throw new Error(`Argument inconnu : ${a}`);
}
if (cliExtras) extras = cliExtras;

function checkBuild(label, dir) {
  const abs = resolve(desktopDir, dir);
  if (!existsSync(join(abs, 'index.html'))) {
    console.error(
      `[prepare-app] ${label} : ${abs}/index.html introuvable.\n` +
        `  Construis d'abord le jeu web (ex. « npm run build » à la racine, ` +
        `ou « npm run build » dans prototypes/proto3d).`,
    );
    process.exit(1);
  }
  return abs;
}

const mainAbs = checkBuild('main', main);
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
cpSync(mainAbs, appDir, { recursive: true });
console.log(`[prepare-app] main  ${mainAbs} -> app/`);

for (const [key, dir] of Object.entries(extras)) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(key)) throw new Error(`Clé d'extra invalide : ${key}`);
  const abs = checkBuild(`extra « ${key} »`, dir);
  const dest = join(appDir, key);
  if (existsSync(dest) && statSync(dest).isDirectory()) {
    throw new Error(`Conflit : app/${key}/ existe déjà dans le build main`);
  }
  cpSync(abs, dest, { recursive: true });
  console.log(`[prepare-app] extra ${abs} -> app/${key}/`);
}

// Lu par le process principal (raccourcis Ctrl+1..9 pour passer d'un build à l'autre).
writeFileSync(
  join(appDir, 'desktop-manifest.json'),
  JSON.stringify({ entries: ['', ...Object.keys(extras)], generatedAt: new Date().toISOString() }, null, 2),
);

// Tournage du trailer : chaque plan de `shots.mjs` est rejoué dans
// Chromium (SwiftShader) sur le serveur Vite de dev, en mode capture
// (`play3d.html?demo&cheat&trailer&seed=N&aspect=…`), et enregistré image par image (60 i/s, horloge
// de la simulation : le rendu ne dépend pas du temps réel, une prise se rejoue à l'identique).
//
//   node tools/trailer/shoot.mjs --format 16x9 [--preview] [--only s04,s05] [--out dossier] [--force]
//
// --format   16x9 (1920×1080) ou 9x16 (1080×1920) ; les déclinaisons 3:2 et 1:1 sont recadrées au
//            montage dans le master 16:9 (même hauteur de 1080 px : aucune perte de définition).
// --preview  tiers de la résolution (repérage rapide) ; --jobs N : plans tournés en parallèle.
// Sortie : <out>/<format>[-preview]/<plan>/00000.jpg… et un fichier `done` par plan terminé.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { SHOTS } = await import(process.env.SHOTS_FILE ?? './shots.mjs');

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const format = opt('format', '16x9');
const preview = flag('preview');
const force = flag('force');
const jobs = Number(opt('jobs', '1'));
const only = opt('only', '')
  .split(',')
  .filter(Boolean);
const outRoot = opt('out', 'trailer-frames');
const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '3x2': [1620, 1080] };
const [fw, fh] = SIZES[format] ?? SIZES['16x9'];
const scale = preview ? 1 / 3 : 1;
const W = Math.round(fw * scale);
const H = Math.round(fh * scale);
const outDir = `${outRoot}/${format}${preview ? '-preview' : ''}`;
// --need fichier.json : images réellement montées par plan ({ plan: [[début, fin], …] }, issu de
// l'EDL d'un montage d'aperçu) ; les autres sont jouées sans être dessinées (tournage plus court).
const needFile = opt('need', null);
const NEED = needFile ? JSON.parse(readFileSync(needFile, 'utf8')) : null;
const needed = (shot, i) => !NEED?.[shot] || NEED[shot].some(([a, b]) => i >= a && i <= b);
mkdirSync(outDir, { recursive: true });

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({ root, server: { port: 4230, strictPort: false, hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

/** Tourne un plan dans une page neuve (prise indépendante, reproductible). */
async function shoot(name) {
  const shot = SHOTS[name];
  const dir = `${outDir}/${name}`;
  if (!force && existsSync(`${dir}/done`)) {
    console.log(`${name} : déjà tourné`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
    if (m.type() === 'log' && m.text().startsWith('[trailer]')) console.log(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  const extra = shot.query ?? '';
  const quality = preview ? '&msaa=0&shadow=1024' : '&msaa=4';
  await page.goto(
    `${base}/play3d.html?demo&cheat&trailer&seed=${String(shot.seed ?? 7)}&aspect=${format}${quality}${extra}`,
  );
  await page.waitForFunction(() => window.__privatix3d?.frame !== undefined, null, {
    timeout: 240000,
  });
  // Modèles des biomes 2 et 3, chargés en arrière-plan après le titre.
  await page.waitForTimeout(2500);
  const api = (fn, ...a) => page.evaluate(([f, x]) => window.__privatix3d[f](...x), [fn, a]);
  let n = 0;
  /** Journal des événements de la sim par image enregistrée (calage des coupes au montage). */
  const log = {};
  const t0 = Date.now();
  const ctx = {
    api,
    page,
    format,
    portrait: format === '9x16',
    /** Évalue du code dans la page (accès à `window.__privatix3d` sous le nom `api`). */
    run: (fn, arg) => page.evaluate(fn, arg),
    skip: (k) => api('skip', k),
    /** Enregistre `k` images ; `events[i]` est joué avant l'image i (relative au début du `rec`). */
    rec: async (k, events = {}, each = null) => {
      for (let i = 0; i < k; i += 1) {
        const ev = events[i];
        if (ev) await ev();
        if (each) await each(i);
        const wanted = needed(name, n);
        const ev2 = await api('frame', W, H, wanted);
        if (Array.isArray(ev2) && ev2.length > 0) log[n] = ev2;
        if (wanted)
          await page.screenshot({
            path: `${dir}/${String(n).padStart(5, '0')}.jpg`,
            type: 'jpeg',
            quality: 94,
          });
        n += 1;
      }
    },
    log: (...m) => console.log(`  ${name} :`, ...m),
  };
  await shot.run(ctx);
  writeFileSync(`${dir}/events.json`, JSON.stringify(log, null, 1));
  writeFileSync(`${dir}/done`, `${String(n)}\n`);
  const s = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`${name} : ${String(n)} images en ${s} s${problems.length ? ` — ERREURS : ${problems.join(' | ')}` : ''}`);
  await page.close();
}

const names = Object.keys(SHOTS).filter((k) => only.length === 0 || only.includes(k));
// Les plans du boss final en dernier (renommage « Jean-Cul Lurcke » fusionné juste avant).
const queue = [...names];
await Promise.all(
  Array.from({ length: Math.max(1, jobs) }, async () => {
    for (;;) {
      const name = queue.shift();
      if (!name) return;
      try {
        await shoot(name);
      } catch (e) {
        console.error(`${name} : ÉCHEC ${e instanceof Error ? e.stack : String(e)}`);
        process.exitCode = 1;
      }
    }
  }),
);
console.log(`plans : ${readdirSync(outDir).join(', ')}`);
await browser.close();
await server.close();

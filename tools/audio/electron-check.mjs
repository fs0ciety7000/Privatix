// Vérifie que l'app Electron (protocole app://) sert l'OST en streaming : requête Range (206),
// élément audio qui joue et se déplace dans le fichier, page du jeu sans erreur console.
// Prérequis : `npm run build` puis `node desktop/scripts/prepare-app.mjs --no-extras`.
//   xvfb-run -a node tools/audio/electron-check.mjs [chemin de l'exécutable electron]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}
const desktop = fileURLToPath(new URL('../../desktop', import.meta.url));
const executablePath =
  process.argv[2] ??
  (() => {
    try {
      return require(require.resolve('electron', { paths: [desktop] }));
    } catch {
      return undefined;
    }
  })();

const app = await playwright._electron.launch({
  executablePath,
  args: ['--no-sandbox', desktop],
  env: { ...process.env, PRIVATIX_ENTRY: 'main' },
});
const page = await app.firstWindow();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('app://game/play3d.html?seed=1&q=bas');
await page.waitForSelector('.px-btn--primary', { timeout: 120000 });
await page.mouse.click(5, 5);
await page.waitForTimeout(4000);
const result = await page.evaluate(async () => {
  const range = await fetch('audio/music/01-prise-de-poste.webm', { headers: { Range: 'bytes=0-99' } });
  const el = new Audio('audio/music/02-occ-jour.webm');
  el.preload = 'auto';
  await new Promise((resolve, reject) => {
    el.addEventListener('canplaythrough', resolve, { once: true });
    el.addEventListener('error', () => reject(new Error('erreur média')), { once: true });
  });
  el.currentTime = 60;
  await new Promise((resolve) => el.addEventListener('seeked', resolve, { once: true }));
  let played = 'non';
  try {
    await el.play();
    await new Promise((r) => setTimeout(r, 800));
    played = el.currentTime > 60.2 ? 'oui' : `bloqué à ${String(el.currentTime)}`;
  } catch (e) {
    played = `refusé : ${String(e)}`;
  }
  el.pause();
  return {
    rangeStatus: range.status,
    contentRange: range.headers.get('content-range'),
    duration: el.duration,
    seekedTo: Math.round(el.currentTime),
    played,
  };
});
console.log(JSON.stringify({ ...result, errors }, null, 1));
await app.close();
if (result.rangeStatus !== 206 || result.played !== 'oui' || errors.length > 0) process.exit(1);
console.log('Electron : OST servie en streaming (Range) — OK');
